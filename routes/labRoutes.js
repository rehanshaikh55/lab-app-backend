import { verifyJWT } from '../middlewares/authMiddleware.js';
import { getAllLabs, getNearbyLabs, getLabById, getLabTests, getLabSlots, getTests } from '../controllers/labController.js';

export const labRoutes = async (fastify) => {
  const auth = { preHandler: [verifyJWT] };

  // GET /api/tests — search/filter all tests across all labs
  fastify.get('/tests', {
    ...auth,
    schema: {
      querystring: {
        type: 'object',
        properties: {
          q:        { type: 'string',  description: 'Full-text search on test name and category' },
          category: { type: 'string',  description: 'Filter by category (e.g. Blood, Urine, Cardiac)' },
          minPrice: { type: 'number',  description: 'Minimum price (INR)' },
          maxPrice: { type: 'number',  description: 'Maximum price (INR)' },
          sortBy:   { type: 'string',  enum: ['price', 'name', 'turnaroundHours', 'createdAt'], default: 'price' },
          order:    { type: 'string',  enum: ['asc', 'desc'], default: 'asc' },
          page:     { type: 'integer', default: 1, minimum: 1 },
          limit:    { type: 'integer', default: 20, minimum: 1, maximum: 100 },
        },
      },
    },
  }, getTests);

  fastify.get('/labs', {
    ...auth,
    schema: {
      querystring: {
        type: 'object',
        properties: {
          search:     { type: 'string',  description: 'Search by lab name' },
          city:       { type: 'string',  description: 'Filter by city' },
          isActive:   { type: 'string',  enum: ['true', 'false'] },
          isVerified: { type: 'string',  enum: ['true', 'false'] },
          sortBy:     { type: 'string',  enum: ['name', 'rating', 'createdAt'], default: 'createdAt' },
          order:      { type: 'string',  enum: ['asc', 'desc'], default: 'desc' },
          page:       { type: 'integer', default: 1, minimum: 1 },
          limit:      { type: 'integer', default: 20, minimum: 1, maximum: 100 },
        },
      },
    },
  }, getAllLabs);

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
