import Subscription from '../models/subscription.js';
import SubscriptionOccurrence from '../models/subscriptionOccurrence.js';
import Lab from '../models/lab.js';
import Booking from '../models/booking.js';
import { Errors } from '../common/errors.js';
import { reserveSlot } from './slotCapacityService.js';
import { generateCode } from './bookingCodeService.js';
import { findSlot } from './_shared/slotIntelligence.js';

export const nextBookingDate = (from, frequency, customIntervalDays) => {
  const d = new Date(from);
  if (frequency === 'WEEKLY') d.setDate(d.getDate() + 7);
  else if (frequency === 'CUSTOM') d.setDate(d.getDate() + (customIntervalDays || 30));
  else d.setMonth(d.getMonth() + 1); // MONTHLY default
  return d;
};

const ownedSub = async (userId, id) => {
  const sub = await Subscription.findById(id);
  if (!sub || sub.user.toString() !== userId.toString()) throw Errors.NOT_FOUND('Subscription');
  return sub;
};

export const createSubscription = async ({ userId, labId, testId, frequency, customIntervalDays, autoPayment, startDate }) =>
  Subscription.create({
    user: userId,
    lab: labId,
    test: testId,
    frequency,
    customIntervalDays: frequency === 'CUSTOM' ? customIntervalDays : undefined,
    nextBookingDate: startDate ? new Date(startDate) : new Date(),
    autoPayment: autoPayment || false,
    status: 'ACTIVE',
  });

export const listSubscriptions = async (userId) =>
  Subscription.find({ user: userId })
    .populate('lab', 'name')
    .populate('test', 'name price')
    .sort({ createdAt: -1 });

export const getSubscription = async ({ userId, id }) => {
  const sub = await Subscription.findById(id)
    .populate('lab', 'name')
    .populate('test', 'name price');
  if (!sub || sub.user.toString() !== userId.toString()) throw Errors.NOT_FOUND('Subscription');
  return sub;
};

export const updateSubscription = async ({ userId, id, body }) => {
  const sub = await ownedSub(userId, id);
  if (body.frequency !== undefined) sub.frequency = body.frequency;
  if (body.customIntervalDays !== undefined) sub.customIntervalDays = body.customIntervalDays;
  if (body.autoPayment !== undefined) sub.autoPayment = body.autoPayment;
  await sub.save();
  return sub;
};

export const pauseSubscription = async ({ userId, id }) => {
  const sub = await ownedSub(userId, id);
  if (sub.status !== 'ACTIVE') throw Errors.INVALID_SUBSCRIPTION_STATE('Only ACTIVE subscriptions can be paused');
  sub.status = 'PAUSED';
  await sub.save();
  return sub;
};

export const resumeSubscription = async ({ userId, id }) => {
  const sub = await ownedSub(userId, id);
  if (sub.status !== 'PAUSED') throw Errors.INVALID_SUBSCRIPTION_STATE('Only PAUSED subscriptions can be resumed');
  sub.status = 'ACTIVE';
  sub.nextBookingDate = nextBookingDate(new Date(), sub.frequency, sub.customIntervalDays);
  await sub.save();
  return sub;
};

export const cancelSubscription = async ({ userId, id }) => {
  const sub = await ownedSub(userId, id);
  if (sub.status === 'CANCELLED') throw Errors.INVALID_SUBSCRIPTION_STATE('Subscription is already cancelled');
  sub.status = 'CANCELLED';
  await sub.save();
  return sub;
};

export const approveOccurrence = async ({ userId, occurrenceId }) => {
  const occ = await SubscriptionOccurrence.findById(occurrenceId).populate('subscription');
  if (!occ || occ.subscription.user.toString() !== userId.toString()) throw Errors.NOT_FOUND('Occurrence');
  if (occ.state !== 'AWAITING_APPROVAL') throw Errors.INVALID_SUBSCRIPTION_STATE('Occurrence is not awaiting approval');
  const sub = occ.subscription;
  const lab = await Lab.findById(sub.lab);
  const found = await findSlot({
    labId: sub.lab, date: occ.scheduledFor,
    windowStart: sub.preferredTimeWindow?.start || '09:00',
    windowEnd:   sub.preferredTimeWindow?.end   || '18:00',
  });
  if (!found) {
    occ.state = 'NO_SLOT';
    await occ.save();
    throw Errors.SLOT_UNAVAILABLE('No slot available in your preferred window');
  }
  await reserveSlot({ labId: sub.lab, scheduledDate: found.date, slotStart: found.slot.start,
    maxPerSlot: lab?.slotMatrix?.maxBookingsPerSlot || 5 });
  const code = await generateCode();
  const booking = await Booking.create({
    user: sub.user, lab: sub.lab, tests: [sub.test], subscription: sub._id,
    scheduledDate: found.date, slot: found.slot, status: 'PENDING',
    collectionType: sub.collectionType || 'IN_LAB', totalAmount: 0, code,
    idempotencyKey: `sub_${sub._id}_${found.date.toISOString().slice(0, 10)}`,
  });
  occ.state = 'BOOKED';
  occ.booking = booking._id;
  occ.shiftedTo = found.shifted ? found.date : undefined;
  await occ.save();
  sub.nextBookingDate = nextBookingDate(sub.nextBookingDate, sub.frequency, sub.customIntervalDays);
  await sub.save();
  return occ;
};

export const skipNextOccurrence = async ({ userId, id }) => {
  const sub = await ownedSub(userId, id);
  await SubscriptionOccurrence.create({ subscription: sub._id, scheduledFor: sub.nextBookingDate,
    state: 'SKIPPED', reason: 'Skipped by user' });
  sub.nextBookingDate = nextBookingDate(sub.nextBookingDate, sub.frequency, sub.customIntervalDays);
  await sub.save();
  return sub;
};

export const pauseUntil = async ({ userId, id, until }) => {
  const sub = await ownedSub(userId, id);
  sub.status = 'PAUSED';
  sub.pauseUntil = new Date(until);
  await sub.save();
  return sub;
};

export const listOccurrences = async ({ userId, id }) => {
  await ownedSub(userId, id);
  return SubscriptionOccurrence.find({ subscription: id }).sort({ createdAt: -1 }).limit(100);
};

// Used by scheduler
export const runDueSubscriptions = async ({ now, log, createBookingForSub }) => {
  const tenMinAgo = new Date(now.getTime() - 10 * 60 * 1000);
  const due = await Subscription.find({
    status: 'ACTIVE',
    nextBookingDate: { $lte: now },
    $or: [{ lockedAt: null }, { lockedAt: { $lt: tenMinAgo } }],
  }).limit(50);
  let processed = 0;
  for (const sub of due) {
    const claimed = await Subscription.findOneAndUpdate(
      {
        _id: sub._id,
        status: 'ACTIVE',
        $or: [{ lockedAt: null }, { lockedAt: { $lt: tenMinAgo } }],
      },
      { $set: { lockedAt: now } },
      { new: true },
    );
    if (!claimed) continue;
    try {
      await createBookingForSub(claimed);
      claimed.nextBookingDate = nextBookingDate(claimed.nextBookingDate, claimed.frequency, claimed.customIntervalDays);
      claimed.lastRunAt = now;
      claimed.retryCount = 0;
      claimed.lockedAt = null;
      await claimed.save();
      processed += 1;
    } catch (err) {
      log?.error({ err, subId: claimed._id }, 'Subscription booking failed');
      claimed.retryCount = (claimed.retryCount || 0) + 1;
      if (claimed.retryCount >= 3) claimed.status = 'PAUSED';
      claimed.lockedAt = null;
      await claimed.save();
    }
  }
  return processed;
};
