import Booking from '../models/booking.js';
import LabAssistant from '../models/labAssistant.js';
import { Errors } from '../common/errors.js';
import { assertTransition, buildTimeline } from './_shared/transitions.js';
import { recordEvent } from './_shared/events.js';
import { notifyBookingStatus } from './notificationService.js';

const withTimeline = (b) => {
  if (!b) return b;
  const obj = typeof b.toObject === 'function' ? b.toObject({ virtuals: true }) : b;
  return { ...obj, timeline: buildTimeline(obj.status) };
};

const ownedByAssistant = async (userId, bookingId) => {
  const asst = await LabAssistant.findOne({ user: userId, isActive: true });
  if (!asst) throw Errors.FORBIDDEN();
  const booking = await Booking.findOne({ _id: bookingId, labAssistant: asst._id });
  if (!booking) throw Errors.BOOKING_NOT_FOUND(`/assistant/bookings/${bookingId}`);
  return { booking, assistant: asst };
};

export const startJourney = async ({ userId, bookingId }) => {
  const { booking } = await ownedByAssistant(userId, bookingId);
  assertTransition(booking.status, 'ON_THE_WAY');
  const fromStatus = booking.status;
  booking.status = 'ON_THE_WAY';
  await booking.save();
  await recordEvent({ booking, fromStatus, toStatus: 'ON_THE_WAY', actorType: 'LAB_ASSISTANT', actorId: userId });
  notifyBookingStatus(booking).catch(() => {});
  return withTimeline(booking);
};

export const markArrived = async ({ userId, bookingId }) => {
  const { booking } = await ownedByAssistant(userId, bookingId);
  assertTransition(booking.status, 'ARRIVED');
  const fromStatus = booking.status;
  booking.status = 'ARRIVED';
  await booking.save();
  await recordEvent({ booking, fromStatus, toStatus: 'ARRIVED', actorType: 'LAB_ASSISTANT', actorId: userId });
  notifyBookingStatus(booking).catch(() => {});
  return withTimeline(booking);
};

export const verifyVisitOtp = async ({ userId, bookingId, otp }) => {
  const { booking } = await ownedByAssistant(userId, bookingId);
  if (!booking.visitOtp || booking.visitOtp !== otp) throw Errors.UNAUTHORIZED();
  assertTransition(booking.status, 'COLLECTED');
  const fromStatus = booking.status;
  booking.visitOtpVerifiedAt = new Date();
  booking.status = 'COLLECTED';
  await booking.save();
  await recordEvent({ booking, fromStatus, toStatus: 'COLLECTED', actorType: 'LAB_ASSISTANT', actorId: userId,
    reason: 'visit-otp-verified' });
  notifyBookingStatus(booking).catch(() => {});
  return withTimeline(booking);
};
