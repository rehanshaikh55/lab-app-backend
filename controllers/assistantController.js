import * as assistantService from '../services/assistantService.js';
import { asyncHandler } from '../utils/asyncHandler.js';

export const startJourney = asyncHandler(async (request, reply) => {
  const booking = await assistantService.startJourney({ userId: request.user._id, bookingId: request.params.id });
  return reply.code(200).send({ booking });
});

export const markArrived = asyncHandler(async (request, reply) => {
  const booking = await assistantService.markArrived({ userId: request.user._id, bookingId: request.params.id });
  return reply.code(200).send({ booking });
});

export const verifyVisitOtp = asyncHandler(async (request, reply) => {
  const booking = await assistantService.verifyVisitOtp({
    userId: request.user._id, bookingId: request.params.id, otp: request.body.otp,
  });
  return reply.code(200).send({ booking });
});
