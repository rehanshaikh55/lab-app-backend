import { verifyJWT } from '../middlewares/authMiddleware.js';
import { requireRoles } from '../middlewares/rbacMiddleware.js';
import { startJourney, markArrived, verifyVisitOtp } from '../controllers/assistantController.js';

export const assistantRoutes = async (fastify) => {
  const assistantAuth = { preHandler: [verifyJWT, requireRoles('LAB_ASSISTANT')] };

  fastify.post('/assistant/bookings/:id/start-journey', {
    ...assistantAuth,
    schema: { params: { type: 'object', required: ['id'], properties: { id: { type: 'string' } } } },
  }, startJourney);

  fastify.post('/assistant/bookings/:id/arrived', {
    ...assistantAuth,
    schema: { params: { type: 'object', required: ['id'], properties: { id: { type: 'string' } } } },
  }, markArrived);

  fastify.post('/assistant/bookings/:id/verify-otp', {
    ...assistantAuth,
    schema: {
      params: { type: 'object', required: ['id'], properties: { id: { type: 'string' } } },
      body: { type: 'object', required: ['otp'], properties: { otp: { type: 'string' } }, additionalProperties: false },
    },
  }, verifyVisitOtp);
};
