import { verifyJWT } from '../middlewares/authMiddleware.js';
import { razorpayWebhook, listPayments, getInvoice, requestRefund } from '../controllers/paymentController.js';

export const paymentRoutes = async (fastify) => {
  fastify.post('/payments/webhook', razorpayWebhook);

  const auth = { preHandler: [verifyJWT] };

  fastify.get('/me/payments', auth, listPayments);

  fastify.get('/invoices/:id', {
    ...auth,
    schema: { params: { type: 'object', required: ['id'], properties: { id: { type: 'string' } } } },
  }, getInvoice);

  fastify.post('/bookings/:id/refund', {
    ...auth,
    schema: {
      params: { type: 'object', required: ['id'], properties: { id: { type: 'string' } } },
      body: {
        type: 'object',
        properties: {
          testIds: { type: 'array', items: { type: 'string' } },
          reason:  { type: 'string' },
        },
        additionalProperties: false,
      },
    },
  }, requestRefund);
};
