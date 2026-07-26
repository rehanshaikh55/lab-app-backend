import { verifyJWT } from '../middlewares/authMiddleware.js';
import {
  listNotifications,
  markRead,
  markAllRead,
  unreadCount,
} from '../controllers/notificationController.js';

export const notificationRoutes = async (fastify) => {
  const auth = { preHandler: [verifyJWT] };

  fastify.get('/notifications', {
    ...auth,
    schema: {
      querystring: {
        type: 'object',
        properties: {
          page:  { type: 'integer', default: 1 },
          limit: { type: 'integer', default: 20 },
        },
      },
    },
  }, listNotifications);

  fastify.get('/notifications/unread-count', auth, unreadCount);

  fastify.post('/notifications/read-all', auth, markAllRead);

  fastify.post('/notifications/:id/read', {
    ...auth,
    schema: { params: { type: 'object', required: ['id'], properties: { id: { type: 'string' } } } },
  }, markRead);
};
