import { verifyJWT } from '../middlewares/authMiddleware.js';
import { getCatalogTests } from '../controllers/catalogController.js';

export const catalogRoutes = async (fastify) => {
  const auth = { preHandler: [verifyJWT] };

  fastify.get('/catalog/tests', {
    ...auth,
    schema: {
      querystring: {
        type: 'object',
        properties: {
          q:          { type: 'string' },
          category:   { type: 'string' },
          isPackage:  { type: 'string', enum: ['true', 'false'] },
          homeOnly:   { type: 'string', enum: ['true', 'false'] },
          noFasting:  { type: 'string', enum: ['true', 'false'] },
          maxTat:     { type: 'integer', minimum: 0 },
          maxPrice:   { type: 'number', minimum: 0 },
          sampleType: { type: 'string' },
          sort:       { type: 'string', enum: ['rel', 'low', 'high', 'fast'], default: 'rel' },
          lat:        { type: 'number' },
          lng:        { type: 'number' },
          radius:     { type: 'integer', default: 10000, minimum: 1 },
          page:       { type: 'integer', default: 1, minimum: 1 },
          limit:      { type: 'integer', default: 20, minimum: 1, maximum: 100 },
        },
      },
    },
  }, getCatalogTests);
};
