import { verifyJWT } from '../middlewares/authMiddleware.js';
import {
  createTicket, listTickets, getTicketById, addMessage, reopenTicket,
} from '../controllers/ticketController.js';

export const ticketRoutes = async (fastify) => {
  const auth = { preHandler: [verifyJWT] };

  fastify.post('/tickets', {
    ...auth,
    schema: {
      body: {
        type: 'object',
        required: ['category', 'subject'],
        properties: {
          bookingId: { type: 'string' },
          category:  { type: 'string', enum: ['DELAY', 'REFUND', 'REPORT_ISSUE', 'ASSISTANT_BEHAVIOR', 'PAYMENT', 'SAFETY', 'OTHER'] },
          subject:   { type: 'string' },
          message:   { type: 'string' },
        },
        additionalProperties: false,
      },
    },
  }, createTicket);

  fastify.get('/tickets', {
    ...auth,
    schema: {
      querystring: {
        type: 'object',
        properties: {
          state: { type: 'string', enum: ['OPEN', 'IN_PROGRESS', 'RESOLVED'] },
          page:  { type: 'integer', default: 1 },
          limit: { type: 'integer', default: 20 },
        },
      },
    },
  }, listTickets);

  fastify.get('/tickets/:id', {
    ...auth,
    schema: { params: { type: 'object', required: ['id'], properties: { id: { type: 'string' } } } },
  }, getTicketById);

  fastify.post('/tickets/:id/messages', {
    ...auth,
    schema: {
      params: { type: 'object', required: ['id'], properties: { id: { type: 'string' } } },
      body: {
        type: 'object',
        required: ['text'],
        properties: {
          text: { type: 'string' },
          attachments: { type: 'array', items: { type: 'object', properties: { uri: { type: 'string' } }, additionalProperties: false } },
        },
        additionalProperties: false,
      },
    },
  }, addMessage);

  fastify.post('/tickets/:id/reopen', {
    ...auth,
    schema: { params: { type: 'object', required: ['id'], properties: { id: { type: 'string' } } } },
  }, reopenTicket);
};
