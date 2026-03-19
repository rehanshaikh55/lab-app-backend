import { verifyJWT } from '../middlewares/authMiddleware.js';
import { getNearbyLabs, getLabById, getLabTests, getLabSlots } from '../controllers/labController.js';

export const labRoutes = async (fastify) => {
  const auth = { preHandler: [verifyJWT] };

  fastify.get('/labs/nearby', {
    ...auth,
    schema: {
      querystring: {
        type: 'object',
        required: ['lat', 'lng'],
        properties: {
          lat:       { type: 'number' },
          lng:       { type: 'number' },
          radius:    { type: 'integer', default: 5000 },
          minRating: { type: 'number' },
          page:      { type: 'integer', default: 1 },
          limit:     { type: 'integer', default: 20 },
        },
      },
    },
  }, getNearbyLabs);

  fastify.get('/labs/:id', {
    ...auth,
    schema: {
      params: { type: 'object', required: ['id'], properties: { id: { type: 'string' } } },
    },
  }, getLabById);

  fastify.get('/labs/:id/tests', {
    ...auth,
    schema: {
      params: { type: 'object', required: ['id'], properties: { id: { type: 'string' } } },
    },
  }, getLabTests);

  fastify.get('/labs/:id/slots', {
    ...auth,
    schema: {
      params: {
        type: 'object',
        required: ['id'],
        properties: { id: { type: 'string' } },
      },
      querystring: {
        type: 'object',
        required: ['date'],
        properties: { date: { type: 'string', pattern: '^\\d{4}-\\d{2}-\\d{2}$' } },
      },
    },
  }, getLabSlots);
};
