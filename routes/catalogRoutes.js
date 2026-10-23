import { verifyJWT } from '../middlewares/authMiddleware.js';
import { getCatalogTests, quoteCatalogCart, evaluateCouponCode } from '../controllers/catalogController.js';

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

  fastify.post('/catalog/quote', {
    ...auth,
    schema: {
      body: {
        type: 'object',
        required: ['codes'],
        properties: {
          codes:  { type: 'array', items: { type: 'string', minLength: 1 }, minItems: 1, maxItems: 30, uniqueItems: true },
          lat:    { type: 'number' },
          lng:    { type: 'number' },
          radius: { type: 'integer', default: 10000, minimum: 1 },
        },
      },
    },
  }, quoteCatalogCart);

  fastify.get('/coupons/:code/evaluate', {
    ...auth,
    schema: {
      params: { type: 'object', required: ['code'], properties: { code: { type: 'string', maxLength: 40 } } },
      querystring: { type: 'object', required: ['amount'], properties: { amount: { type: 'number', minimum: 0 } } },
    },
  }, evaluateCouponCode);
};
