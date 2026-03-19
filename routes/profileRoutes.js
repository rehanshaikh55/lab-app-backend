import { verifyJWT } from '../middlewares/authMiddleware.js';
import {
  getProfile,
  updateProfile,
  addAddress,
  updateAddress,
  deleteAddress,
  updateLocation,
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
    schema: {
      params: { type: 'object', required: ['id'], properties: { id: { type: 'string' } } },
    },
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

};
