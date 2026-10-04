import { verifyJWT } from '../middlewares/authMiddleware.js';
import { requireRoles } from '../middlewares/rbacMiddleware.js';
import {
  getAllLabs,
  getNearbyLabs,
  getLabById,
  getLabTests,
  getLabSlots,
  getTests,
  getLabReviews,
  createLabReview,
} from '../controllers/labController.js';

export const labRoutes = async (fastify) => {
  const auth = { preHandler: [verifyJWT] };
  const customerAuth = { preHandler: [verifyJWT, requireRoles('CUSTOMER')] };

  fastify.get('/tests', {
    ...auth,
    schema: {
      querystring: {
        type: 'object',
        properties: {
          q:        { type: 'string' },
          category: { type: 'string' },
          minPrice: { type: 'number' },
          maxPrice: { type: 'number' },
          sortBy:   { type: 'string', enum: ['price', 'name', 'turnaroundHours', 'createdAt'], default: 'price' },
          order:    { type: 'string', enum: ['asc', 'desc'], default: 'asc' },
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
          search:     { type: 'string' },
          city:       { type: 'string' },
          isActive:   { type: 'string', enum: ['true', 'false'] },
          isVerified: { type: 'string', enum: ['true', 'false'] },
          sortBy:     { type: 'string', enum: ['name', 'rating', 'createdAt'], default: 'createdAt' },
          order:      { type: 'string', enum: ['asc', 'desc'], default: 'desc' },
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
          sortBy:    { type: 'string', enum: ['relevance', 'distance', 'rating'], default: 'relevance' },
          q:         { type: 'string' },
          page:      { type: 'integer', default: 1 },
          limit:     { type: 'integer', default: 20 },
        },
      },
    },
  }, getNearbyLabs);

  fastify.get('/labs/:id', {
    ...auth,
    schema: { params: { type: 'object', required: ['id'], properties: { id: { type: 'string' } } } },
  }, getLabById);

  fastify.get('/labs/:id/tests', {
    ...auth,
    schema: { params: { type: 'object', required: ['id'], properties: { id: { type: 'string' } } } },
  }, getLabTests);

  fastify.get('/labs/:id/slots', {
    ...auth,
    schema: {
      params: { type: 'object', required: ['id'], properties: { id: { type: 'string' } } },
      querystring: {
        type: 'object',
        required: ['date'],
        properties: { date: { type: 'string', pattern: '^\\d{4}-\\d{2}-\\d{2}$' } },
      },
    },
  }, getLabSlots);

  fastify.get('/labs/:id/reviews', {
    ...auth,
    schema: {
      params: { type: 'object', required: ['id'], properties: { id: { type: 'string' } } },
      querystring: {
        type: 'object',
        properties: {
          page:  { type: 'integer', default: 1, minimum: 1 },
          limit: { type: 'integer', default: 10, minimum: 1, maximum: 100 },
        },
      },
    },
  }, getLabReviews);

  fastify.post('/labs/:id/reviews', {
    ...customerAuth,
    schema: {
      params: { type: 'object', required: ['id'], properties: { id: { type: 'string' } } },
      body: {
        type: 'object',
        required: ['rating'],
        properties: {
          rating:    { type: 'integer', minimum: 1, maximum: 5 },
          comment:   { type: 'string' },
          bookingId: { type: 'string' },
        },
        additionalProperties: false,
      },
    },
  }, createLabReview);
};
