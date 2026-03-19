import { verifyJWT } from '../middlewares/authMiddleware.js';
import { requireRoles } from '../middlewares/rbacMiddleware.js';
import {
  createSubscription,
  listSubscriptions,
  getSubscriptionById,
  updateSubscription,
  pauseSubscription,
  resumeSubscription,
  cancelSubscription,
} from '../controllers/subscriptionController.js';

export const subscriptionRoutes = async (fastify) => {
  const customerAuth = { preHandler: [verifyJWT, requireRoles('CUSTOMER')] };
  const auth         = { preHandler: [verifyJWT] };

  fastify.post('/subscriptions', {
    ...customerAuth,
    schema: {
      body: {
        type: 'object',
        required: ['labId', 'testId', 'frequency'],
        properties: {
          labId:              { type: 'string' },
          testId:             { type: 'string' },
          frequency:          { type: 'string', enum: ['WEEKLY', 'MONTHLY', 'CUSTOM'] },
          customIntervalDays: { type: 'integer', minimum: 1 },
          autoPayment:        { type: 'boolean' },
          startDate:          { type: 'string', format: 'date' },
        },
        additionalProperties: false,
      },
    },
  }, createSubscription);

  fastify.get('/subscriptions',     { ...auth }, listSubscriptions);
  fastify.get('/subscriptions/:id', {
    ...auth,
    schema: {
      params: { type: 'object', required: ['id'], properties: { id: { type: 'string' } } },
    },
  }, getSubscriptionById);

  fastify.put('/subscriptions/:id', {
    ...auth,
    schema: {
      params: { type: 'object', required: ['id'], properties: { id: { type: 'string' } } },
      body: {
        type: 'object',
        properties: {
          frequency:          { type: 'string', enum: ['WEEKLY', 'MONTHLY', 'CUSTOM'] },
          customIntervalDays: { type: 'integer', minimum: 1 },
          autoPayment:        { type: 'boolean' },
        },
        additionalProperties: false,
      },
    },
  }, updateSubscription);

  fastify.post('/subscriptions/:id/pause',  { ...auth }, pauseSubscription);
  fastify.post('/subscriptions/:id/resume', { ...auth }, resumeSubscription);
  fastify.post('/subscriptions/:id/cancel', { ...auth }, cancelSubscription);
};
