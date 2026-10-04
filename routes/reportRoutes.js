import { verifyJWT } from '../middlewares/authMiddleware.js';
import { requireRoles } from '../middlewares/rbacMiddleware.js';
import { getReport, replaceReport } from '../controllers/reportController.js';

export const reportRoutes = async (fastify) => {
  fastify.get('/reports/:id', { preHandler: [verifyJWT] }, getReport);

  fastify.put('/partner/bookings/:id/reports/:reportId', {
    preHandler: [verifyJWT, requireRoles('LAB_OWNER')],
    schema: {
      params: {
        type: 'object', required: ['id', 'reportId'],
        properties: { id: { type: 'string' }, reportId: { type: 'string' } },
      },
      body: {
        type: 'object',
        required: ['uri', 'checksum', 'reason'],
        properties: {
          uri:      { type: 'string' },
          checksum: { type: 'string' },
          reason:   { type: 'string' },
          parameters: {
            type: 'array',
            items: {
              type: 'object',
              required: ['name', 'value'],
              properties: {
                name: { type: 'string' }, value: { type: 'string' }, unit: { type: 'string' },
                refLow: { type: 'number' }, refHigh: { type: 'number' },
                flag: { type: 'string', enum: ['LOW', 'NORMAL', 'HIGH'] },
              },
              additionalProperties: false,
            },
          },
        },
        additionalProperties: false,
      },
    },
  }, replaceReport);
};