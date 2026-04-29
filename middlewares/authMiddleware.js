import jwt from 'jsonwebtoken';
import User from '../models/user.js';
import { JWT_SECRET } from '../config/env.js';
import { Errors } from '../common/errors.js';

export const verifyJWT = async (request, reply) => {
  const authHeader = request.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    const err = Errors.UNAUTHORIZED();
    return reply.code(err.statusCode).send(err.toRFC7807());
  }
  const token = authHeader.split('Bearer ')[1];
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    const user = await User.findById(decoded.id).select('-passwordHash -refreshToken');
    if (!user) {
      const err = Errors.UNAUTHORIZED();
      return reply.code(err.statusCode).send(err.toRFC7807());
    }
    request.user = user;
  } catch {
    const err = Errors.UNAUTHORIZED();
    return reply.code(err.statusCode).send(err.toRFC7807());
  }
};
