import { verifyJWT } from '../middlewares/authMiddleware.js';
import { requireRoles } from '../middlewares/rbacMiddleware.js';
import {
  getDailyBookings,
  getPartnerBookings,
  acceptBooking,
  rejectBooking,
  reassignAssistant,
  uploadReport,
  linkReport,
  listAssistants,
  createAssistant,
  updateAssistant,
  setAssistantAvailability,
  getAnalyticsOverview,
  getRevenueAnalytics,
  getSlotsAnalytics,
  getCustomerHistory,
} from '../controllers/partnerController.js';

export const partnerRoutes = async (fastify) => {
  const ownerAuth = { preHandler: [verifyJWT, requireRoles('LAB_OWNER')] };

  // Bookings
  fastify.get('/partner/bookings/daily', { ...ownerAuth }, getDailyBookings);
  fastify.get('/partner/bookings', {
    ...ownerAuth,
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
  }, getPartnerBookings);

  fastify.post('/partner/bookings/:id/accept', {
    ...ownerAuth,
    schema: {
      params: { type: 'object', required: ['id'], properties: { id: { type: 'string' } } },
    },
  }, acceptBooking);

  fastify.post('/partner/bookings/:id/reject', {
    ...ownerAuth,
    schema: {
      params: { type: 'object', required: ['id'], properties: { id: { type: 'string' } } },
      body: {
        type: 'object',
        properties: { reason: { type: 'string' } },
        additionalProperties: false,
      },
    },
  }, rejectBooking);

  fastify.post('/partner/bookings/:id/reassign', {
    ...ownerAuth,
    schema: {
      params: { type: 'object', required: ['id'], properties: { id: { type: 'string' } } },
      body: {
        type: 'object',
        required: ['assistantId'],
        properties: { assistantId: { type: 'string' } },
        additionalProperties: false,
      },
    },
  }, reassignAssistant);

  // Reports
  fastify.post('/partner/reports/upload', { ...ownerAuth }, uploadReport);

  fastify.post('/partner/bookings/:id/report', {
    ...ownerAuth,
    schema: {
      params: { type: 'object', required: ['id'], properties: { id: { type: 'string' } } },
      body: {
        type: 'object',
        required: ['uri', 'checksum'],
        properties: {
          uri:      { type: 'string' },
          checksum: { type: 'string' },
          testId:   { type: 'string' },
        },
        additionalProperties: false,
      },
    },
  }, linkReport);

  // Assistants
  fastify.get('/partner/assistants', { ...ownerAuth }, listAssistants);

  fastify.post('/partner/assistants', {
    ...ownerAuth,
    schema: {
      body: {
        type: 'object',
        required: ['name'],
        properties: {
          name:   { type: 'string' },
          phone:  { type: 'string' },
          userId: { type: 'string' },
        },
        additionalProperties: false,
      },
    },
  }, createAssistant);

  fastify.put('/partner/assistants/:id', {
    ...ownerAuth,
    schema: {
      params: { type: 'object', required: ['id'], properties: { id: { type: 'string' } } },
    },
  }, updateAssistant);

  fastify.put('/partner/assistants/:id/availability', {
    ...ownerAuth,
    schema: {
      params: { type: 'object', required: ['id'], properties: { id: { type: 'string' } } },
    },
  }, setAssistantAvailability);

  // Analytics
  fastify.get('/partner/analytics/overview', { ...ownerAuth }, getAnalyticsOverview);

  fastify.get('/partner/analytics/revenue', {
    ...ownerAuth,
    schema: {
      querystring: {
        type: 'object',
        properties: {
          from: { type: 'string', format: 'date' },
          to:   { type: 'string', format: 'date' },
        },
      },
    },
  }, getRevenueAnalytics);

  fastify.get('/partner/analytics/slots', { ...ownerAuth }, getSlotsAnalytics);

  fastify.get('/partner/customers/:customerId/history', {
    ...ownerAuth,
    schema: {
      params: { type: 'object', required: ['customerId'], properties: { customerId: { type: 'string' } } },
    },
  }, getCustomerHistory);
};
