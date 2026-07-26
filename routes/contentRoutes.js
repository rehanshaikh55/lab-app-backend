import { verifyJWT } from '../middlewares/authMiddleware.js';
import { requireRoles } from '../middlewares/rbacMiddleware.js';
import { getContent, setContent } from '../controllers/contentController.js';

export const contentRoutes = async (fastify) => {
  fastify.get('/content/:key', {
    schema: { params: { type: 'object', required: ['key'], properties: { key: { type: 'string' } } } },
  }, getContent);

  fastify.put('/content/:key', {
    preHandler: [verifyJWT, requireRoles('ADMIN')],
    schema: {
      params: { type: 'object', required: ['key'], properties: { key: { type: 'string' } } },
      body: {
        type: 'object',
        required: ['payload'],
        properties: { payload: {} },
        additionalProperties: false,
      },
    },
  }, setContent);
};
