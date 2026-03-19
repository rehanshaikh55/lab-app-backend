import { verifyJWT } from '../middlewares/authMiddleware.js';
import { requireRoles } from '../middlewares/rbacMiddleware.js';
import {
  createBooking,
  listBookings,
  getBookingById,
  cancelBooking,
  getBookingReport,
} from '../controllers/bookingController.js';

export const bookingRoutes = async (fastify) => {
  const customerAuth = { preHandler: [verifyJWT, requireRoles('CUSTOMER')] };
  const auth         = { preHandler: [verifyJWT] };

  fastify.post('/bookings', {
    ...customerAuth,
    schema: {
      body: {
        type: 'object',
        required: ['labId', 'testIds', 'scheduledDate', 'slot', 'collectionType'],
        properties: {
          labId:          { type: 'string' },
          testIds:        { type: 'array', items: { type: 'string' }, minItems: 1 },
          scheduledDate:  { type: 'string', format: 'date' },
          slot:           {
            type: 'object',
            required: ['start'],
            properties: { start: { type: 'string' } },
          },
          collectionType: { type: 'string', enum: ['HOME', 'IN_LAB'] },
          userAddressId:  { type: 'string' },
        },
        additionalProperties: false,
      },
    },
  }, createBooking);

  fastify.get('/bookings', {
    ...auth,
    schema: {
      querystring: {
        type: 'object',
        properties: {
          status: { type: 'string', enum: ['PENDING', 'CONFIRMED', 'COLLECTED', 'COMPLETED', 'CANCELLED'] },
          page:   { type: 'integer', default: 1 },
          limit:  { type: 'integer', default: 20 },
        },
      },
    },
  }, listBookings);

  fastify.get('/bookings/:id', {
    ...auth,
    schema: {
      params: { type: 'object', required: ['id'], properties: { id: { type: 'string' } } },
    },
  }, getBookingById);

  fastify.post('/bookings/:id/cancel', {
    ...auth,
    schema: {
      params: { type: 'object', required: ['id'], properties: { id: { type: 'string' } } },
      body: {
        type: 'object',
        properties: { reason: { type: 'string' } },
        additionalProperties: false,
      },
    },
  }, cancelBooking);

  fastify.get('/bookings/:id/report', {
    ...auth,
    schema: {
      params: { type: 'object', required: ['id'], properties: { id: { type: 'string' } } },
    },
  }, getBookingReport);
};
