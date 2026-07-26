import { verifyJWT } from '../middlewares/authMiddleware.js';
import { requireRoles } from '../middlewares/rbacMiddleware.js';
import {
  createBooking,
  listBookings,
  getBookingById,
  cancelBooking,
  rescheduleBooking,
  getBookingReport,
  getBookingEvents,
  setVisitNotes,
  getVisitOtp,
  connectCall,
} from '../controllers/bookingController.js';
import { createIntent } from '../controllers/paymentController.js';
import { setRetestReminder } from '../controllers/reportController.js';

export const bookingRoutes = async (fastify) => {
  const customerAuth = { preHandler: [verifyJWT, requireRoles('CUSTOMER')] };
  const auth         = { preHandler: [verifyJWT] };

  fastify.post('/bookings', {
    ...customerAuth,
    schema: {
      body: {
        type: 'object',
        required: ['labId', 'scheduledDate', 'slot', 'collectionType'],
        properties: {
          labId:          { type: 'string' },
          testIds:        { type: 'array', items: { type: 'string' } },
          packageId:      { type: 'string' },
          scheduledDate:  { type: 'string', format: 'date' },
          slot:           {
            type: 'object',
            required: ['start'],
            properties: { start: { type: 'string' } },
          },
          collectionType: { type: 'string', enum: ['HOME', 'IN_LAB'] },
          userAddressId:  { type: 'string' },
          dependentId:    { type: 'string' },
          paymentMethod:  { type: 'string', enum: ['ONLINE', 'PAY_AT_LAB'] },
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
          status: {
            type: 'string',
            enum: [
              'PENDING', 'CONFIRMED', 'ASSISTANT_ASSIGNED', 'ON_THE_WAY', 'ARRIVED',
              'COLLECTED', 'PROCESSING', 'COMPLETED', 'RESCHEDULED', 'NO_SHOW', 'CANCELLED',
            ],
          },
          page:   { type: 'integer', default: 1 },
          limit:  { type: 'integer', default: 20 },
        },
      },
    },
  }, listBookings);

  fastify.get('/bookings/:id', {
    ...auth,
    schema: { params: { type: 'object', required: ['id'], properties: { id: { type: 'string' } } } },
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

  fastify.post('/bookings/:id/reschedule', {
    ...auth,
    schema: {
      params: { type: 'object', required: ['id'], properties: { id: { type: 'string' } } },
      body: {
        type: 'object',
        required: ['scheduledDate', 'slot'],
        properties: {
          scheduledDate: { type: 'string', format: 'date' },
          slot: {
            type: 'object',
            required: ['start'],
            properties: { start: { type: 'string' } },
          },
        },
        additionalProperties: false,
      },
    },
  }, rescheduleBooking);

  fastify.post('/bookings/:id/payment-intent', {
    ...auth,
    schema: { params: { type: 'object', required: ['id'], properties: { id: { type: 'string' } } } },
  }, createIntent);

  fastify.get('/bookings/:id/report', {
    ...auth,
    schema: { params: { type: 'object', required: ['id'], properties: { id: { type: 'string' } } } },
  }, getBookingReport);

  fastify.get('/bookings/:id/events', {
    ...auth,
    schema: { params: { type: 'object', required: ['id'], properties: { id: { type: 'string' } } } },
  }, getBookingEvents);

  fastify.post('/bookings/:id/visit-notes', {
    ...customerAuth,
    schema: {
      params: { type: 'object', required: ['id'], properties: { id: { type: 'string' } } },
      body: {
        type: 'object',
        required: ['notes'],
        properties: { notes: { type: 'string', maxLength: 500 } },
        additionalProperties: false,
      },
    },
  }, setVisitNotes);

  fastify.get('/bookings/:id/visit-otp', {
    ...customerAuth,
    schema: { params: { type: 'object', required: ['id'], properties: { id: { type: 'string' } } } },
  }, getVisitOtp);

  fastify.post('/bookings/:id/calls/connect', {
    ...customerAuth,
    schema: {
      params: { type: 'object', required: ['id'], properties: { id: { type: 'string' } } },
      body: {
        type: 'object',
        required: ['side'],
        properties: { side: { type: 'string', enum: ['customer', 'lab'] } },
        additionalProperties: false,
      },
    },
  }, connectCall);

  fastify.post('/reports/:id/retest-reminder', {
    ...auth,
    schema: {
      params: { type: 'object', required: ['id'], properties: { id: { type: 'string' } } },
      body: {
        type: 'object',
        required: ['intervalDays'],
        properties: { intervalDays: { type: 'integer', minimum: 0, maximum: 365 } },
        additionalProperties: false,
      },
    },
  }, setRetestReminder);
};
