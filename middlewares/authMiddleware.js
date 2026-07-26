import jwt from 'jsonwebtoken';
import User from '../models/user.js';
import { JWT_SECRET } from '../config/env.js';
import { Errors } from '../common/errors.js';

export const verifyJWT = async (request) => {
  const authHeader = request.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) throw Errors.UNAUTHORIZED();
  const token = authHeader.split('Bearer ')[1];
  let decoded;
  try { decoded = jwt.verify(token, JWT_SECRET); }
  catch { throw Errors.UNAUTHORIZED(); }
  const user = await User.findById(decoded.id).select('-passwordHash');
  if (!user) throw Errors.UNAUTHORIZED();
  request.user = user;
};
