import Ticket from '../models/ticket.js';
import Booking from '../models/booking.js';
import { Errors } from '../common/errors.js';

const HIGH_PRIORITY_CATEGORIES = ['REFUND', 'REPORT_ISSUE', 'SAFETY', 'PAYMENT'];
const REOPEN_WINDOW_MS = 7 * 24 * 3600 * 1000;

const ownedTicket = async (userId, ticketId, instance) => {
  const ticket = await Ticket.findById(ticketId);
  if (!ticket || ticket.user.toString() !== userId.toString()) {
    throw Errors.NOT_FOUND('Ticket', instance);
  }
  return ticket;
};

export const createTicket = async ({ userId, bookingId, category, subject, message }) => {
  if (bookingId) {
    const booking = await Booking.findById(bookingId);
    if (!booking || booking.user.toString() !== userId.toString()) {
      throw Errors.NOT_FOUND('Booking', '/tickets');
    }
  }
  const priority = HIGH_PRIORITY_CATEGORIES.includes(category) ? 'HIGH' : 'NORMAL';
  const messages = message
    ? [{ fromUserId: userId, fromRole: 'CUSTOMER', text: message }]
    : [];
  return Ticket.create({ user: userId, booking: bookingId || undefined, category, priority, subject, messages });
};

export const listTickets = async ({ userId, state, page = 1, limit = 20 }) => {
  const query = { user: userId };
  if (state) query.state = state;
  const skip = (parseInt(page) - 1) * parseInt(limit);
  const [tickets, total] = await Promise.all([
    Ticket.find(query).sort({ createdAt: -1 }).skip(skip).limit(parseInt(limit)),
    Ticket.countDocuments(query),
  ]);
  return { tickets, total, page: parseInt(page), limit: parseInt(limit) };
};

export const getTicketForUser = async ({ userId, ticketId }) =>
  ownedTicket(userId, ticketId, `/tickets/${ticketId}`);

export const addMessage = async ({ userId, ticketId, text, attachments }) => {
  const ticket = await ownedTicket(userId, ticketId, `/tickets/${ticketId}/messages`);
  ticket.messages.push({ fromUserId: userId, fromRole: 'CUSTOMER', text, attachments: attachments || [] });
  if (ticket.state === 'OPEN') ticket.state = 'IN_PROGRESS';
  await ticket.save();
  return ticket;
};

export const reopenTicket = async ({ userId, ticketId }) => {
  const ticket = await ownedTicket(userId, ticketId, `/tickets/${ticketId}/reopen`);
  if (ticket.state !== 'RESOLVED') {
    throw Errors.VALIDATION_ERROR('Only resolved tickets can be reopened');
  }
  if (!ticket.resolvedAt || Date.now() - ticket.resolvedAt.getTime() > REOPEN_WINDOW_MS) {
    throw Errors.VALIDATION_ERROR('Reopen window has expired (7 days after resolution)');
  }
  ticket.state = 'OPEN';
  ticket.resolvedAt = undefined;
  await ticket.save();
  return ticket;
};
