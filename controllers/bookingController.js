import Booking from '../models/booking.js';
import Lab from '../models/lab.js';
import Test from '../models/test.js';
import { storage } from '../integrations/storage/storage.js';
import { Errors } from '../common/errors.js';
import { asyncHandler } from '../utils/asyncHandler.js';

const VALID_TRANSITIONS = {
  PENDING:   ['CONFIRMED', 'CANCELLED'],
  CONFIRMED: ['COLLECTED', 'CANCELLED'],
  COLLECTED: ['COMPLETED'],
  COMPLETED: [],
  CANCELLED: [],
};

export const createBooking = asyncHandler(async (request, reply) => {
  const { labId, testIds, scheduledDate, slot, collectionType, userAddressId } = request.body;
  const userId = request.user._id;

  const lab = await Lab.findById(labId);
  if (!lab || !lab.isActive) {
    const err = Errors.NOT_FOUND('Lab', '/bookings');
    return reply.code(err.statusCode).send(err.toRFC7807());
  }

  // Check lab is open on that day
  const dayName = new Date(scheduledDate).toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase();
  const dayHours = lab.openingHours?.[dayName];
  if (!dayHours || dayHours.isClosed) {
    const err = Errors.LAB_CLOSED('Lab is closed on that day');
    return reply.code(err.statusCode).send(err.toRFC7807());
  }

  // Check slot capacity
  const startOfDay = new Date(scheduledDate);
  const endOfDay = new Date(scheduledDate);
  endOfDay.setDate(endOfDay.getDate() + 1);
  const slotCount = await Booking.countDocuments({
    lab: labId,
    scheduledDate: { $gte: startOfDay, $lt: endOfDay },
    'slot.start': slot.start,
    status: { $in: ['PENDING', 'CONFIRMED', 'COLLECTED'] },
  });
  const maxPerSlot = lab.slotMatrix?.maxBookingsPerSlot || 5;
  if (slotCount >= maxPerSlot) {
    const err = Errors.SLOT_UNAVAILABLE(
      `The ${slot.start} slot on ${scheduledDate} is fully booked`, '/bookings',
    );
    return reply.code(err.statusCode).send(err.toRFC7807());
  }

  // Fetch tests and compute total
  const tests = await Test.find({ _id: { $in: testIds }, lab: labId, isActive: true });
  if (tests.length !== testIds.length) {
    const err = Errors.VALIDATION_ERROR('One or more tests not found or inactive for this lab');
    return reply.code(err.statusCode).send(err.toRFC7807());
  }
  const totalAmount = tests.reduce((sum, t) => sum + t.price, 0);

  // Address snapshot for HOME collection
  let userAddress = null;
  if (collectionType === 'HOME' && userAddressId) {
    const addr = request.user.addresses?.find(a => a._id.toString() === userAddressId);
    if (addr) userAddress = addr.toObject();
  }

  // Compute slot end time
  const [h, m] = slot.start.split(':').map(Number);
  const dur = lab.slotMatrix?.duration || 30;
  const endMin = h * 60 + m + dur;
  const slotEnd = `${String(Math.floor(endMin / 60)).padStart(2, '0')}:${String(endMin % 60).padStart(2, '0')}`;

  const booking = await Booking.create({
    user: userId,
    lab: labId,
    tests: testIds,
    scheduledDate: new Date(scheduledDate),
    slot: { start: slot.start, end: slotEnd },
    collectionType,
    userAddress,
    totalAmount,
    slotHoldExpiry: new Date(Date.now() + 15 * 60 * 1000),
    status: 'PENDING',
  });

  return reply.code(201).send({ booking });
});

export const listBookings = asyncHandler(async (request, reply) => {
  const { status, page = 1, limit = 20 } = request.query;
  const query = { user: request.user._id };
  if (status) query.status = status;
  const skip = (parseInt(page) - 1) * parseInt(limit);
  const [bookings, total] = await Promise.all([
    Booking.find(query)
      .populate('lab', 'name address')
      .populate('tests', 'name price')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit)),
    Booking.countDocuments(query),
  ]);
  return reply.code(200).send({ bookings, total, page: parseInt(page), limit: parseInt(limit) });
});

export const getBookingById = asyncHandler(async (request, reply) => {
  const booking = await Booking.findById(request.params.id)
    .populate('lab', 'name address phone')
    .populate('tests', 'name price sampleRequirements')
    .populate('report')
    .populate('labAssistant', 'name phone');
  if (!booking || booking.user.toString() !== request.user._id.toString()) {
    const err = Errors.BOOKING_NOT_FOUND(`/bookings/${request.params.id}`);
    return reply.code(err.statusCode).send(err.toRFC7807());
  }
  return reply.code(200).send({ booking });
});

export const cancelBooking = asyncHandler(async (request, reply) => {
  const booking = await Booking.findById(request.params.id);
  if (!booking || booking.user.toString() !== request.user._id.toString()) {
    const err = Errors.BOOKING_NOT_FOUND(`/bookings/${request.params.id}`);
    return reply.code(err.statusCode).send(err.toRFC7807());
  }
  if (!VALID_TRANSITIONS[booking.status]?.includes('CANCELLED')) {
    const err = Errors.INVALID_BOOKING_TRANSITION(`Cannot cancel a ${booking.status} booking`);
    return reply.code(err.statusCode).send(err.toRFC7807());
  }
  booking.status = 'CANCELLED';
  booking.cancelReason = request.body?.reason || 'Cancelled by customer';
  await booking.save();
  return reply.code(200).send({ booking });
});

export const getBookingReport = asyncHandler(async (request, reply) => {
  const booking = await Booking.findById(request.params.id).populate('report');
  if (!booking || booking.user.toString() !== request.user._id.toString()) {
    const err = Errors.BOOKING_NOT_FOUND(`/bookings/${request.params.id}`);
    return reply.code(err.statusCode).send(err.toRFC7807());
  }
  if (!booking.report) {
    const err = Errors.NOT_FOUND('Report', `/bookings/${request.params.id}/report`);
    return reply.code(err.statusCode).send(err.toRFC7807());
  }
  const signedUrl = await storage.getSignedUrl(booking.report.file.uri);
  return reply.code(200).send({ signedUrl, issuedAt: booking.report.issuedAt });
});
