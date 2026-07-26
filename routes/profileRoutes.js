import { verifyJWT } from '../middlewares/authMiddleware.js';
import {
  getProfile,
  updateProfile,
  addAddress,
  updateAddress,
  deleteAddress,
  updateLocation,
  listDependents,
  addDependent,
  updateDependent,
  deleteDependent,
  deleteAccount,
  restoreAccount,
  listRecentSearches,
  recordSearch,
  watchLabsNearby,
} from '../controllers/profileController.js';

export const profileRoutes = async (fastify) => {
  const auth = { preHandler: [verifyJWT] };

  fastify.get('/me', auth, getProfile);

  fastify.put('/profile', {
    ...auth,
    schema: {
      body: {
        type: 'object',
        properties: {
          name:      { type: 'string' },
          phone:     { type: 'string' },
          fcmToken:  { type: 'string' },
          gender:    { type: 'string', enum: ['male', 'female', 'other', 'prefer_not_to_say'] },
          birthDate: { type: 'string' },
        },
        additionalProperties: false,
      },
    },
  }, updateProfile);

  fastify.post('/addresses', {
    ...auth,
    schema: {
      body: {
        type: 'object',
        required: ['line1', 'city', 'state', 'zipCode'],
        properties: {
          label:   { type: 'string' },
          line1:   { type: 'string' },
          line2:   { type: 'string' },
          city:    { type: 'string' },
          state:   { type: 'string' },
          zipCode: { type: 'string' },
          country: { type: 'string' },
        },
        additionalProperties: false,
      },
    },
  }, addAddress);

  fastify.put('/addresses/:id', {
    ...auth,
    schema: {
      params: { type: 'object', required: ['id'], properties: { id: { type: 'string' } } },
      body: {
        type: 'object',
        properties: {
          label:   { type: 'string' },
          line1:   { type: 'string' },
          line2:   { type: 'string' },
          city:    { type: 'string' },
          state:   { type: 'string' },
          zipCode: { type: 'string' },
          country: { type: 'string' },
        },
        additionalProperties: false,
      },
    },
  }, updateAddress);

  fastify.delete('/addresses/:id', {
    ...auth,
    schema: { params: { type: 'object', required: ['id'], properties: { id: { type: 'string' } } } },
  }, deleteAddress);

  fastify.post('/location', {
    ...auth,
    schema: {
      body: {
        type: 'object',
        properties: {
          address:   { type: 'string' },
          latitude:  { type: 'number' },
          longitude: { type: 'number' },
        },
        additionalProperties: false,
      },
    },
  }, updateLocation);

  // Dependents (Phase 2 Task 18)
  fastify.get('/me/dependents', auth, listDependents);

  fastify.post('/me/dependents', {
    ...auth,
    schema: {
      body: {
        type: 'object',
        required: ['name'],
        properties: {
          name:      { type: 'string', minLength: 1 },
          relation:  { type: 'string', enum: ['self', 'spouse', 'father', 'mother', 'son', 'daughter', 'sibling', 'other'] },
          gender:    { type: 'string', enum: ['male', 'female', 'other', 'prefer_not_to_say'] },
          birthDate: { type: 'string' },
        },
        additionalProperties: false,
      },
    },
  }, addDependent);

  fastify.put('/me/dependents/:id', {
    ...auth,
    schema: {
      params: { type: 'object', required: ['id'], properties: { id: { type: 'string' } } },
      body: {
        type: 'object',
        properties: {
          name:      { type: 'string', minLength: 1 },
          relation:  { type: 'string', enum: ['self', 'spouse', 'father', 'mother', 'son', 'daughter', 'sibling', 'other'] },
          gender:    { type: 'string', enum: ['male', 'female', 'other', 'prefer_not_to_say'] },
          birthDate: { type: 'string' },
        },
        additionalProperties: false,
      },
    },
  }, updateDependent);

  fastify.delete('/me/dependents/:id', {
    ...auth,
    schema: { params: { type: 'object', required: ['id'], properties: { id: { type: 'string' } } } },
  }, deleteDependent);

  // Account deletion grace period (Task 24, PRD §6.1 FR-7)
  fastify.delete('/me', auth, deleteAccount);
  fastify.post('/me/restore', auth, restoreAccount);

  // Discovery: recently-viewed searches + "notify me when a lab joins nearby" (Task 25, PRD §6.2)
  fastify.get('/me/recent-searches', auth, listRecentSearches);

  fastify.post('/me/recent-searches', {
    ...auth,
    schema: {
      body: {
        type: 'object',
        required: ['kind', 'value'],
        properties: {
          kind:  { type: 'string', enum: ['LAB', 'TEST', 'PACKAGE', 'QUERY'] },
          value: { type: 'string' },
          ref:   { type: 'string' },
        },
      },
    },
  }, recordSearch);

  fastify.post('/me/lab-watches', {
    ...auth,
    schema: {
      body: {
        type: 'object',
        required: ['lat', 'lng'],
        properties: {
          lat:          { type: 'number' },
          lng:          { type: 'number' },
          radiusMeters: { type: 'integer' },
        },
      },
    },
  }, watchLabsNearby);
};
