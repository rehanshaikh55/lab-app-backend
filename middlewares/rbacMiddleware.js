import { Errors } from '../common/errors.js';

export const requireRoles = (...allowed) => async (request) => {
  const userRoles = request.user?.roles || [];
  if (!allowed.some((r) => userRoles.includes(r))) throw Errors.FORBIDDEN();
};
