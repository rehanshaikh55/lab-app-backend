import * as ticketService from '../services/ticketService.js';
import { asyncHandler } from '../utils/asyncHandler.js';

export const createTicket = asyncHandler(async (request, reply) => {
  const { bookingId, category, subject, message } = request.body;
  const ticket = await ticketService.createTicket({ userId: request.user._id, bookingId, category, subject, message });
  return reply.code(201).send({ ticket });
});

export const listTickets = asyncHandler(async (request, reply) => {
  const { state, page, limit } = request.query;
  const result = await ticketService.listTickets({ userId: request.user._id, state, page, limit });
  return reply.code(200).send(result);
});

export const getTicketById = asyncHandler(async (request, reply) => {
  const ticket = await ticketService.getTicketForUser({ userId: request.user._id, ticketId: request.params.id });
  return reply.code(200).send({ ticket });
});

export const addMessage = asyncHandler(async (request, reply) => {
  const { text, attachments } = request.body;
  const ticket = await ticketService.addMessage({ userId: request.user._id, ticketId: request.params.id, text, attachments });
  return reply.code(200).send({ ticket });
});

export const reopenTicket = asyncHandler(async (request, reply) => {
  const ticket = await ticketService.reopenTicket({ userId: request.user._id, ticketId: request.params.id });
  return reply.code(200).send({ ticket });
});
