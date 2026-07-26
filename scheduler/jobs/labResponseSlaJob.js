import Booking from '../../models/booking.js';
import Lab from '../../models/lab.js';
import { releaseSlot } from '../../services/slotCapacityService.js';
import { notifyBookingStatus } from '../../services/notificationService.js';
import { recordEvent } from '../../services/_shared/events.js';

// PRD §6.4 FR-10: if a lab doesn't respond to a PENDING booking within its response SLA, auto
// cancel with full refund (slot release). `createdAt <= now - 1h` is just a cheap Mongo-level
// pre-filter to keep the candidate set small (the default SLA is 2h, so nothing younger than 1h
// could ever be overdue); the authoritative check is the per-lab `slaDeadline` comparison below.
export const runLabResponseSlaSweep = async ({ now = new Date(), log } = {}) => {
  const candidates = await Booking.find({
    status: 'PENDING',
    createdAt: { $lte: new Date(now.getTime() - 60 * 60 * 1000) },
  }).limit(200);
  let cancelled = 0;
  for (const b of candidates) {
    const lab = await Lab.findById(b.lab).select('policy');
    const slaMin = lab?.policy?.responseSlaMinutes ?? 120;
    const slaDeadline = new Date(b.createdAt.getTime() + slaMin * 60 * 1000);
    if (now.getTime() < slaDeadline.getTime()) continue;
    const fromStatus = b.status;
    b.status = 'CANCELLED';
    b.cancelBy = 'SYSTEM';
    b.cancelReason = 'Lab did not respond within SLA';
    await b.save();
    await releaseSlot({ labId: b.lab, scheduledDate: b.scheduledDate, slotStart: b.slot.start });
    await recordEvent({ booking: b, fromStatus, toStatus: 'CANCELLED', actorType: 'SYSTEM',
      reason: 'lab-response-sla' });
    notifyBookingStatus(b).catch(() => {});
    cancelled += 1;
  }
  log?.info({ cancelled }, 'Lab response SLA sweep complete');
  return cancelled;
};
