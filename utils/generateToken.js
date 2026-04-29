import jwt from 'jsonwebtoken';
import { JWT_SECRET, JWT_REFRESH_SECRET } from '../config/env.js';

export const generateAccessToken = (userId) => {
  return jwt.sign({ id: userId }, JWT_SECRET, { expiresIn: '15m' });
};

export const generateRefreshToken = (userId) => {
  return jwt.sign({ id: userId }, JWT_REFRESH_SECRET, { expiresIn: '7d' });
};

export default generateAccessToken;
