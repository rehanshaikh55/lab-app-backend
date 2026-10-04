import BookingEvent from '../../models/bookingEvent.js';

export const recordEvent = async ({ booking, fromStatus, toStatus, actorType, actorId, reason, meta }) =>
  BookingEvent.create({ booking: booking._id, fromStatus, toStatus, actorType, actorId, reason, meta });
