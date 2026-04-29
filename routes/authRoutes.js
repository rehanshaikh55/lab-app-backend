import { register, login, refresh, logout, forgotPassword, resetPassword } from '../controllers/authController.js';
import { verifyJWT } from '../middlewares/authMiddleware.js';

export const authRoutes = async (fastify) => {
  fastify.post('/auth/register', {
    schema: {
      body: {
        type: 'object',
        required: ['name', 'email', 'password'],
        properties: {
          name:     { type: 'string', minLength: 2 },
          email:    { type: 'string', format: 'email' },
          password: { type: 'string', minLength: 6 },
          phone:    { type: 'string' },
          role:     { type: 'string', enum: ['CUSTOMER', 'LAB_OWNER'] },
        },
        additionalProperties: false,
      },
    },
  }, register);

  fastify.post('/auth/login', {
    schema: {
      body: {
        type: 'object',
        required: ['email', 'password'],
        properties: {
          email:    { type: 'string', format: 'email' },
          password: { type: 'string' },
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
        properties: { refreshToken: { type: 'string' } },
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

  fastify.post('/auth/logout', { preHandler: [verifyJWT] }, logout);
};
