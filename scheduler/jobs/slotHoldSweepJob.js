import Booking from '../../models/booking.js';
import { releaseSlot } from '../../services/slotCapacityService.js';

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
    log?.info({ bookingId: b._id }, 'Expired hold released');
  }
  return expired.length;
};
