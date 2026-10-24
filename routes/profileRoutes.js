import { registerMultipart } from './_multipart.js';
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
  listMyReports,
  uploadPrescription,
} from '../controllers/profileController.js';

import { NAME_SCHEMA } from './_schemas.js';

export const profileRoutes = async (fastify) => {
  await registerMultipart(fastify);
  const auth = { preHandler: [verifyJWT] };

  fastify.get('/me', auth, getProfile);

  fastify.put('/profile', {
    ...auth,
    schema: {
      body: {
        type: 'object',
        properties: {
          name:      NAME_SCHEMA,
          phone:     { type: 'string' },
          fcmToken:  { type: 'string' },
          gender:    { type: 'string', enum: ['male', 'female', 'other', 'prefer_not_to_say'] },
          birthDate: { type: 'string' },
          age:       { type: 'integer', minimum: 1, maximum: 120 },
          weight:    { type: 'number', minimum: 20, maximum: 200 },
          height:    { type: 'number', minimum: 100, maximum: 250 },
          bloodGroup: { type: 'string', enum: ['A+', 'A-', 'B+', 'B-', 'O+', 'O-', 'AB+', 'AB-', 'unknown'] },
          registrationStep: { type: 'integer', enum: [1, 2] },
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
          name:      NAME_SCHEMA,
          relation:  { type: 'string', enum: ['self', 'spouse', 'father', 'mother', 'son', 'daughter', 'sibling', 'child', 'parent', 'other'] },
          gender:    { type: 'string', enum: ['male', 'female', 'other', 'prefer_not_to_say'] },
          birthDate: { type: 'string' },
          age:       { type: 'integer', minimum: 0, maximum: 120 },
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
          name:      NAME_SCHEMA,
          relation:  { type: 'string', enum: ['self', 'spouse', 'father', 'mother', 'son', 'daughter', 'sibling', 'child', 'parent', 'other'] },
          gender:    { type: 'string', enum: ['male', 'female', 'other', 'prefer_not_to_say'] },
          birthDate: { type: 'string' },
          age:       { type: 'integer', minimum: 0, maximum: 120 },
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

  // Reports tab feed: READY reports + PROCESSING bookings, newest first
  fastify.get('/me/reports', {
    ...auth,
    schema: {
      querystring: {
        type: 'object',
        properties: { patient: { type: 'string', default: 'all' } },
      },
    },
  }, listMyReports);

  // Prescription upload (multipart: file + optional note) -> HIGH priority ticket
  fastify.post('/me/prescriptions', auth, uploadPrescription);
};
