import { verifyJWT } from '../middlewares/authMiddleware.js';
import { getReport } from '../controllers/reportController.js';

export const reportRoutes = async (fastify) => {
  fastify.get('/reports/:id', { preHandler: [verifyJWT] }, getReport);
};