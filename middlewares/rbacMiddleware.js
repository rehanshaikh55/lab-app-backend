import { Errors } from '../common/errors.js';

export const requireRoles = (...allowed) => {
  return async (request, reply) => {
    const userRoles = request.user?.roles || [];
    const hasRole = allowed.some(r => userRoles.includes(r));
    if (!hasRole) {
      const err = Errors.FORBIDDEN();
      return reply.code(err.statusCode).send(err.toRFC7807());
    }
    // explicitly return to signal Fastify the preHandler completed successfully
    return;
  };
};
