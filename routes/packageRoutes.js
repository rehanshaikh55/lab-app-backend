import { listPackages, getPackage } from '../controllers/packageController.js';

export const packageRoutes = async (fastify) => {
  fastify.get('/packages', {
    schema: {
      querystring: {
        type: 'object',
        properties: {
          category: { type: 'string' },
          lab:      { type: 'string' },
          q:        { type: 'string' },
          page:     { type: 'integer', default: 1, minimum: 1 },
          limit:    { type: 'integer', default: 20, minimum: 1, maximum: 100 },
        },
      },
    },
  }, listPackages);

  fastify.get('/packages/:slug', {
    schema: { params: { type: 'object', required: ['slug'], properties: { slug: { type: 'string' } } } },
  }, getPackage);
};
