import { register, login, refresh, logout, forgotPassword, resetPassword, consents } from '../controllers/authController.js';
import { verifyJWT } from '../middlewares/authMiddleware.js';

export const authRoutes = async (fastify) => {
  fastify.post('/auth/register', {
    schema: {
      body: {
        type: 'object',
        required: ['name', 'email', 'password'],
        properties: {
          name:      { type: 'string', minLength: 2 },
          email:     { type: 'string', format: 'email' },
          password:  { type: 'string', minLength: 6 },
          phone:     { type: 'string' },
          role:      { type: 'string', enum: ['CUSTOMER', 'LAB_OWNER'] },
          gender:    { type: 'string', enum: ['male', 'female', 'other', 'prefer_not_to_say'] },
          birthDate: { type: 'string', format: 'date' },
          deviceId:    { type: 'string' },
          deviceLabel: { type: 'string' },
          consents: { type: 'array', items: { type: 'object',
            required: ['kind', 'given'],
            properties: {
              kind:    { type: 'string', enum: ['TOS', 'PRIVACY', 'HEALTH_RECORDS', 'MARKETING'] },
              given:   { type: 'boolean' },
              version: { type: 'string' },
            }, additionalProperties: false } },
        },
        additionalProperties: false,
      },
    },
  }, register);

  fastify.post('/auth/consents', {
    preHandler: [verifyJWT],
    schema: {
      body: { type: 'object', required: ['consents'],
        properties: { consents: { type: 'array' } },
        additionalProperties: false } },
  }, consents);

  fastify.post('/auth/login', {
    schema: {
      body: {
        type: 'object',
        required: ['email', 'password'],
        properties: {
          email:       { type: 'string', format: 'email' },
          password:    { type: 'string' },
          deviceId:    { type: 'string' },
          deviceLabel: { type: 'string' },
        },
        additionalProperties: false,
      },
    },
  }, login);

  fastify.post('/auth/refresh', {
    schema: {
      body: {
        type: 'object',
        required: ['refreshToken'],
        properties: {
          refreshToken: { type: 'string' },
          deviceId:     { type: 'string' },
        },
        additionalProperties: false,
      },
    },
  }, refresh);

  fastify.post('/auth/forgot-password', {
    schema: {
      body: {
        type: 'object',
        required: ['email'],
        properties: { email: { type: 'string', format: 'email' } },
        additionalProperties: false,
      },
    },
  }, forgotPassword);

  fastify.post('/auth/reset-password/:token', {
    schema: {
      params: {
        type: 'object',
        required: ['token'],
        properties: { token: { type: 'string' } },
      },
      body: {
        type: 'object',
        required: ['newPassword'],
        properties: { newPassword: { type: 'string', minLength: 6 } },
        additionalProperties: false,
      },
    },
  }, resetPassword);

  fastify.post('/auth/logout', {
    preHandler: [verifyJWT],
    schema: {
      body: {
        type: 'object',
        properties: { refreshToken: { type: 'string' } },
        additionalProperties: false,
      },
    },
  }, logout);
};
