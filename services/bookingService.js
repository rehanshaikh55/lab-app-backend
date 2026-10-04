import Booking from '../models/booking.js';
import BookingEvent from '../models/bookingEvent.js';
import Lab from '../models/lab.js';
import Test from '../models/test.js';
import { storage } from '../integrations/storage/storage.js';
import { Errors } from '../common/errors.js';
import { assertTransition, buildTimeline } from './_shared/transitions.js';
import { recordEvent } from './_shared/events.js';
import { addMinutes, weekdayName } from './_shared/slotTime.js';
import { reserveSlot, releaseSlot } from './slotCapacityService.js';
import { notifyBookingStatus } from './notificationService.js';
import { generateCode } from './bookingCodeService.js';
import { connect as connectMaskedCall } from './maskedCallService.js';

const HOLD_MS = 10 * 60 * 1000; // PRD §6.4 FR-5

const withTimeline = (b) => {
  if (!b) return b;
  const obj = typeof b.toObject === 'function' ? b.toObject({ virtuals: true }) : b;
  return { ...obj, timeline: buildTimeline(obj.status) };
};

const resolveCart = async ({ labId, packageId, testIds }) => {
  if (packageId) {
    const HealthPackage = (await import('../models/healthPackage.js')).default;
    const pkg = await HealthPackage.findById(packageId).populate('tests');
    if (!pkg || !pkg.isActive) throw Errors.NOT_FOUND('Package');
    if (pkg.lab && pkg.lab.toString() !== labId.toString()) {
      throw Errors.VALIDATION_ERROR('Package does not belong to the requested lab');
    }
    return {
      testIds: pkg.tests.map((t) => t._id),
      totalAmount: pkg.price,
      packageRef: pkg._id,
    };
  }
  const tests = await Test.find({ _id: { $in: testIds }, lab: labId, isActive: true });
  if (tests.length !== testIds.length) {
    throw Errors.VALIDATION_ERROR('One or more tests not found or inactive for this lab');
  }
  return {
    testIds: tests.map((t) => t._id),
    totalAmount: tests.reduce((sum, t) => sum + t.price, 0),
    packageRef: null,
  };
};

const resolvePatient = (user, dependentId) => {
  if (!dependentId) {
    return { name: user.name, isSelf: true };
  }
  const dep = user.dependents?.find((d) => d._id.toString() === dependentId);
  if (!dep) throw Errors.NOT_FOUND('Dependent');
  return {
    dependentId: dep._id,
    name: dep.name,
    relation: dep.relation,
    gender: dep.gender,
    birthDate: dep.birthDate,
    isSelf: false,
  };
};

export const createBooking = async ({ user, labId, testIds, packageId, scheduledDate, slot, collectionType, userAddressId, dependentId, paymentMethod = 'ONLINE' }) => {
  const lab = await Lab.findById(labId);
  if (!lab || !lab.isActive) throw Errors.NOT_FOUND('Lab', '/bookings');

  const dayHours = lab.openingHours?.[weekdayName(scheduledDate)];
  if (!dayHours || dayHours.isClosed) throw Errors.LAB_CLOSED('Lab is closed on that day');

  const cart = await resolveCart({ labId, packageId, testIds });

  let userAddress = null;
  if (collectionType === 'HOME' && userAddressId) {
    const addr = user.addresses?.find((a) => a._id.toString() === userAddressId);
    if (addr) userAddress = addr.toObject();
  }

  const patient = resolvePatient(user, dependentId);

  const duration = lab.slotMatrix?.duration || 30;
  const maxPerSlot = lab.slotMatrix?.maxBookingsPerSlot || 5;
  const slotEnd = addMinutes(slot.start, duration);

  let homeCollectionFee = 0;
  if (collectionType === 'HOME') {
    homeCollectionFee = lab.policy?.homeCollectionFee || 0;
    const waiverThreshold = lab.policy?.homeCollectionWaiverAbove || 0;
    if (waiverThreshold > 0 && cart.totalAmount >= waiverThreshold) homeCollectionFee = 0;
  }

  await reserveSlot({ labId, scheduledDate, slotStart: slot.start, maxPerSlot });

  try {
    const code = await generateCode();
    const booking = await Booking.create({
      user: user._id,
      lab: labId,
      tests: cart.testIds,
      package: cart.packageRef,
      scheduledDate: new Date(scheduledDate),
      slot: { start: slot.start, end: slotEnd },
      collectionType,
      userAddress,
      patient,
      totalAmount: cart.totalAmount + homeCollectionFee,
      homeCollectionFee,
      slotHoldExpiry: new Date(Date.now() + HOLD_MS),
      status: 'PENDING',
      code,
      paymentMethod,
    });
    return withTimeline(booking);
  } catch (err) {
    await releaseSlot({ labId, scheduledDate, slotStart: slot.start });
    throw err;
  }
};

export const listBookings = async ({ userId, status, page = 1, limit = 20 }) => {
  const query = { user: userId };
  if (status) query.status = status;
  const skip = (parseInt(page) - 1) * parseInt(limit);
  const [bookings, total] = await Promise.all([
    Booking.find(query)
      .populate('lab', 'name address phone')
      .populate('tests', 'name price')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit)),
    Booking.countDocuments(query),
  ]);
  return {
    bookings: bookings.map(withTimeline),
    total,
    page: parseInt(page),
    limit: parseInt(limit),
  };
};

export const getBookingForUser = async ({ userId, bookingId }) => {
  const booking = await Booking.findById(bookingId)
    .populate('lab', 'name address phone')
    .populate('tests', 'name price sampleRequirements')
    .populate('reports.report')
    .populate('labAssistant', 'name phone');
  if (!booking || booking.user.toString() !== userId.toString()) {
    throw Errors.BOOKING_NOT_FOUND(`/bookings/${bookingId}`);
  }
  return withTimeline(booking);
};

export const cancelBooking = async ({ user, bookingId, reason }) => {
  const booking = await Booking.findById(bookingId);
  if (!booking || booking.user.toString() !== user._id.toString()) {
    throw Errors.BOOKING_NOT_FOUND(`/bookings/${bookingId}`);
  }
  assertTransition(booking.status, 'CANCELLED', `Cannot cancel a ${booking.status} booking`);
  const fromStatus = booking.status;
  booking.status = 'CANCELLED';
  booking.cancelBy = 'CUSTOMER';
  booking.cancelReason = reason || 'Cancelled by customer';

  // PRD §6.4 FR-9: cancelling inside the lab's cancellation cutoff carries a fee. No
  // charge/refund service exists yet in this task's scope (see CANCELLATION_FEE_APPLICABLE in
  // common/errors.js, reserved for that later task), so this only annotates cancelReason as a
  // safe, non-blocking record of fee applicability rather than enforcing/charging it.
  const lab = await Lab.findById(booking.lab).select('policy');
  const cancellationFee = lab?.policy?.cancellationFee || 0;
  if (cancellationFee > 0) {
    const cutoffHours = lab?.policy?.cancellationCutoffHours ?? 4;
    const slotMoment = new Date(booking.scheduledDate);
    const [h, m] = booking.slot.start.split(':').map(Number);
    slotMoment.setHours(h, m, 0, 0);
    if (slotMoment.getTime() - Date.now() < cutoffHours * 3600 * 1000) {
      booking.cancelReason += ` (cancellation fee of ${cancellationFee} applies — inside ${cutoffHours}h cutoff)`;
    }
  }

  await booking.save();
  await recordEvent({ booking, fromStatus, toStatus: 'CANCELLED', actorType: 'CUSTOMER', actorId: user._id, reason: booking.cancelReason });
  await releaseSlot({ labId: booking.lab, scheduledDate: booking.scheduledDate, slotStart: booking.slot.start });
  notifyBookingStatus(booking).catch(() => {});
  return withTimeline(booking);
};

export const rescheduleBooking = async ({ user, bookingId, scheduledDate, slot }) => {
  const booking = await Booking.findById(bookingId);
  if (!booking || booking.user.toString() !== user._id.toString()) {
    throw Errors.BOOKING_NOT_FOUND(`/bookings/${bookingId}`);
  }
  if (!['PENDING', 'CONFIRMED'].includes(booking.status)) {
    throw Errors.INVALID_BOOKING_TRANSITION(`Cannot reschedule a ${booking.status} booking`);
  }
  const lab = await Lab.findById(booking.lab);
  if (!lab) throw Errors.NOT_FOUND('Lab');

  const dayHours = lab.openingHours?.[weekdayName(scheduledDate)];
  if (!dayHours || dayHours.isClosed) throw Errors.LAB_CLOSED('Lab is closed on that day');

  // PRD §6.4 FR-8: can't reschedule inside the cutoff before the CURRENT slot, and only up to
  // maxReschedulesPerBooking times.
  const cutoffMs = (lab.policy?.rescheduleCutoffHours ?? 4) * 3600 * 1000;
  const slotMoment = new Date(booking.scheduledDate);
  const [h, m] = booking.slot.start.split(':').map(Number);
  slotMoment.setHours(h, m, 0, 0);
  if (slotMoment.getTime() - Date.now() < cutoffMs) {
    throw Errors.RESCHEDULE_CUTOFF_PASSED(`Reschedule cutoff is ${lab.policy?.rescheduleCutoffHours ?? 4} hours before slot`);
  }
  const maxR = lab.policy?.maxReschedulesPerBooking ?? 2;
  if (booking.rescheduleCount >= maxR) {
    throw Errors.RESCHEDULE_LIMIT_REACHED(`Reschedules exhausted (max ${maxR})`);
  }

  const maxPerSlot = lab.slotMatrix?.maxBookingsPerSlot || 5;
  const duration = lab.slotMatrix?.duration || 30;

  await reserveSlot({ labId: booking.lab, scheduledDate, slotStart: slot.start, maxPerSlot });
  await releaseSlot({ labId: booking.lab, scheduledDate: booking.scheduledDate, slotStart: booking.slot.start });

  booking.scheduledDate = new Date(scheduledDate);
  booking.slot = { start: slot.start, end: addMinutes(slot.start, duration) };
  booking.slotHoldExpiry = new Date(Date.now() + HOLD_MS);
  booking.rescheduleCount += 1;
  await booking.save();

  notifyBookingStatus(booking).catch(() => {});
  return withTimeline(booking);
};

export const getBookingEvents = async ({ userId, bookingId }) => {
  const booking = await Booking.findById(bookingId);
  if (!booking || booking.user.toString() !== userId.toString()) {
    throw Errors.BOOKING_NOT_FOUND(`/bookings/${bookingId}/events`);
  }
  return BookingEvent.find({ booking: bookingId }).sort({ createdAt: 1 });
};

export const setVisitNotes = async ({ userId, bookingId, notes }) => {
  const booking = await Booking.findById(bookingId);
  if (!booking || booking.user.toString() !== userId.toString()) {
    throw Errors.BOOKING_NOT_FOUND(`/bookings/${bookingId}/visit-notes`);
  }
  booking.visitNotes = notes;
  await booking.save();
  return withTimeline(booking);
};

export const getVisitOtp = async ({ userId, bookingId }) => {
  const booking = await Booking.findById(bookingId);
  if (!booking || booking.user.toString() !== userId.toString()) {
    throw Errors.BOOKING_NOT_FOUND(`/bookings/${bookingId}/visit-otp`);
  }
  if (!booking.visitOtp) throw Errors.NOT_FOUND('Visit OTP', `/bookings/${bookingId}/visit-otp`);
  return { otp: booking.visitOtp };
};

export const connectCall = async ({ userId, bookingId, side }) => {
  const booking = await Booking.findById(bookingId);
  if (!booking || booking.user.toString() !== userId.toString()) {
    throw Errors.BOOKING_NOT_FOUND(`/bookings/${bookingId}/calls/connect`);
  }
  return connectMaskedCall({ bookingId, fromUserId: userId, toUserId: booking.labAssistant });
};

export const getBookingReportUrl = async ({ userId, bookingId }) => {
  const booking = await Booking.findById(bookingId).populate('reports.report').populate('tests', 'name');
  if (!booking || booking.user.toString() !== userId.toString()) {
    throw Errors.BOOKING_NOT_FOUND(`/bookings/${bookingId}`);
  }
  const accessible = (booking.reports || []).filter((r) => r.report?.isAccessible);
  if (!accessible.length) throw Errors.NOT_FOUND('Report', `/bookings/${bookingId}/report`);
  const results = await Promise.all(accessible.map(async (r) => ({
    testId: r.test,
    signedUrl: await storage.getSignedUrl(r.report.file.uri),
    issuedAt: r.report.issuedAt,
    parameters: r.report.parameters || [],
  })));
  return { reports: results };
};
