import Subscription from '../../models/subscription.js';
import SubscriptionOccurrence from '../../models/subscriptionOccurrence.js';
import Booking from '../../models/booking.js';
import Lab from '../../models/lab.js';
import { reserveSlot } from '../../services/slotCapacityService.js';
import { generateCode } from '../../services/bookingCodeService.js';
import { findSlot } from '../../services/_shared/slotIntelligence.js';
import { nextBookingDate } from '../../services/subscriptionService.js';
import { notify } from '../../services/notificationService.js';

const REMINDER_LOOKAHEAD = 7 * 24 * 3600 * 1000;
const APPROVAL_WINDOW    = 48 * 3600 * 1000;
const LOCK_STALE_MS      = 10 * 60 * 1000;

// PRD §6.5 — occurrence-by-occurrence semantics. Each run: (1) finds ACTIVE subscriptions due within
// the reminder lookahead window and, for ones within their own preBookingReminderDays, atomically
// claims them via the lockedAt pattern (preserves the double-book-proof safety property from the
// original runDueSubscriptions), then either creates an AWAITING_APPROVAL occurrence + notification
// (APPROVE_EACH_TIME) or auto-books via findSlot's day-shifting slot intelligence (AUTO_PAY);
// (2) expires any AWAITING_APPROVAL occurrences whose 48h approval window has elapsed.
export const runSubscriptionsJob = async ({ now = new Date(), log } = {}) => {
  const subs = await Subscription.find({
    status: 'ACTIVE',
    nextBookingDate: { $lte: new Date(now.getTime() + REMINDER_LOOKAHEAD) },
  });

  for (const sub of subs) {
    if (sub.pauseUntil && sub.pauseUntil > now) continue;
    const dueIn = (sub.nextBookingDate - now) / (24 * 3600 * 1000);
    if (dueIn > sub.preBookingReminderDays) continue;

    // Atomic claim, preserving the existing lockedAt safety property (prevents double-run across instances).
    const tenMinAgo = new Date(now.getTime() - LOCK_STALE_MS);
    const claimed = await Subscription.findOneAndUpdate(
      { _id: sub._id, status: 'ACTIVE', $or: [{ lockedAt: null }, { lockedAt: { $lt: tenMinAgo } }] },
      { $set: { lockedAt: now } },
      { new: true },
    );
    if (!claimed) continue;

    try {
      const exists = await SubscriptionOccurrence.findOne({
        subscription: claimed._id,
        scheduledFor: { $gte: new Date(claimed.nextBookingDate.getTime() - 12 * 3600 * 1000),
                        $lte: new Date(claimed.nextBookingDate.getTime() + 12 * 3600 * 1000) },
      });
      if (exists) { claimed.lockedAt = null; await claimed.save(); continue; }

      if (claimed.approvalMode === 'APPROVE_EACH_TIME') {
        await SubscriptionOccurrence.create({ subscription: claimed._id, scheduledFor: claimed.nextBookingDate,
          state: 'AWAITING_APPROVAL' });
        await notify({ userId: claimed.user, event: 'SUBSCRIPTION_AWAITING_APPROVAL',
          title: 'Your subscription needs approval',
          body: `Tap to confirm your next booking on ${claimed.nextBookingDate.toDateString()}.`,
          data: { subscriptionId: claimed._id.toString() } });
      } else {
        const found = await findSlot({ labId: claimed.lab, date: claimed.nextBookingDate,
          windowStart: claimed.preferredTimeWindow?.start || '09:00',
          windowEnd:   claimed.preferredTimeWindow?.end   || '18:00' });
        if (!found) {
          await SubscriptionOccurrence.create({ subscription: claimed._id, scheduledFor: claimed.nextBookingDate,
            state: 'NO_SLOT' });
          await notify({ userId: claimed.user, event: 'SUBSCRIPTION_NO_SLOT',
            title: 'No slot for your recurring test', body: 'Open the app to book manually.' });
        } else {
          const lab = await Lab.findById(claimed.lab);
          await reserveSlot({ labId: claimed.lab, scheduledDate: found.date, slotStart: found.slot.start,
            maxPerSlot: lab?.slotMatrix?.maxBookingsPerSlot || 5 });
          const code = await generateCode();
          const booking = await Booking.create({
            user: claimed.user, lab: claimed.lab, tests: [claimed.test], subscription: claimed._id,
            scheduledDate: found.date, slot: found.slot, status: 'PENDING',
            collectionType: claimed.collectionType || 'IN_LAB', totalAmount: 0, code,
            idempotencyKey: `sub_${claimed._id}_${found.date.toISOString().slice(0, 10)}`,
          });
          await SubscriptionOccurrence.create({ subscription: claimed._id, scheduledFor: claimed.nextBookingDate,
            state: 'BOOKED', booking: booking._id, shiftedTo: found.shifted ? found.date : undefined });
          claimed.nextBookingDate = nextBookingDate(claimed.nextBookingDate, claimed.frequency, claimed.customIntervalDays);
          claimed.lastRunAt = now;
          claimed.retryCount = 0;
        }
      }
      claimed.lockedAt = null;
      await claimed.save();
    } catch (err) {
      log?.error({ err, subId: claimed._id }, 'subscriptionsJob failed for subscription');
      claimed.retryCount = (claimed.retryCount || 0) + 1;
      if (claimed.retryCount >= 3) claimed.status = 'PAUSED';
      claimed.lockedAt = null;
      await claimed.save();
    }
  }

  const stale = await SubscriptionOccurrence.find({ state: 'AWAITING_APPROVAL',
    createdAt: { $lte: new Date(now.getTime() - APPROVAL_WINDOW) } });
  for (const s of stale) { s.state = 'SKIPPED'; s.reason = 'Approval window elapsed'; await s.save(); }

  return subs.length;
};
