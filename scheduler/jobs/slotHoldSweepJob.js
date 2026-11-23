import Booking from '../../models/booking.js';
import { releaseSlot } from '../../services/slotCapacityService.js';
import { refundCancelledBooking } from '../../services/refundService.js';

export const runSlotHoldSweep = async ({ now = new Date(), log } = {}) => {
  const expired = await Booking.find({
    status: 'PENDING',
    slotHoldExpiry: { $lt: now },
  }).limit(200);

  for (const b of expired) {
    b.status = 'CANCELLED';
    b.cancelReason = 'Hold expired';
    await b.save();
    await releaseSlot({
      labId: b.lab,
      scheduledDate: b.scheduledDate,
      slotStart: b.slot.start,
    });
    // Normally nothing was paid; covers a capture that landed just before the sweep.
    await refundCancelledBooking({ booking: b, reason: 'slot hold expired' });
    log?.info({ bookingId: b._id }, 'Expired hold released');
  }
  return expired.length;
};
