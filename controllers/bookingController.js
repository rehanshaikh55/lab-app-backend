import * as bookingService from '../services/bookingService.js';
import { asyncHandler } from '../utils/asyncHandler.js';

export const createBooking = asyncHandler(async (request, reply) => {
  const { labId, testIds, packageId, scheduledDate, slot, collectionType, userAddressId, dependentId, paymentMethod } = request.body;
  const booking = await bookingService.createBooking({
    user: request.user,
    labId,
    testIds,
    packageId,
    scheduledDate,
    slot,
    collectionType,
    userAddressId,
    dependentId,
    paymentMethod,
  });
  return reply.code(201).send({ booking });
});

export const listBookings = asyncHandler(async (request, reply) => {
  const { status, page, limit } = request.query;
  const result = await bookingService.listBookings({
    userId: request.user._id,
    status,
    page,
    limit,
  });
  return reply.code(200).send(result);
});

export const getBookingById = asyncHandler(async (request, reply) => {
  const booking = await bookingService.getBookingForUser({
    userId: request.user._id,
    bookingId: request.params.id,
  });
  return reply.code(200).send({ booking });
});

export const cancelBooking = asyncHandler(async (request, reply) => {
  const booking = await bookingService.cancelBooking({
    user: request.user,
    bookingId: request.params.id,
    reason: request.body?.reason,
  });
  return reply.code(200).send({ booking });
});

export const rescheduleBooking = asyncHandler(async (request, reply) => {
  const { scheduledDate, slot } = request.body;
  const booking = await bookingService.rescheduleBooking({
    user: request.user,
    bookingId: request.params.id,
    scheduledDate,
    slot,
  });
  return reply.code(200).send({ booking });
});

export const getBookingReport = asyncHandler(async (request, reply) => {
  const result = await bookingService.getBookingReportUrl({
    userId: request.user._id,
    bookingId: request.params.id,
  });
  return reply.code(200).send(result);
});

export const getBookingEvents = asyncHandler(async (request, reply) => {
  const events = await bookingService.getBookingEvents({
    userId: request.user._id,
    bookingId: request.params.id,
  });
  return reply.code(200).send({ events });
});

export const setVisitNotes = asyncHandler(async (request, reply) => {
  const booking = await bookingService.setVisitNotes({
    userId: request.user._id, bookingId: request.params.id, notes: request.body.notes,
  });
  return reply.code(200).send({ booking });
});

export const getVisitOtp = asyncHandler(async (request, reply) => {
  const result = await bookingService.getVisitOtp({ userId: request.user._id, bookingId: request.params.id });
  return reply.code(200).send(result);
});

export const connectCall = asyncHandler(async (request, reply) => {
  const result = await bookingService.connectCall({
    userId: request.user._id, bookingId: request.params.id, side: request.body.side,
  });
  return reply.code(200).send(result);
});
