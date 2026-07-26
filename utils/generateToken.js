import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { JWT_SECRET, JWT_REFRESH_SECRET } from '../config/env.js';

export const generateAccessToken = (userId) => {
  return jwt.sign({ id: userId }, JWT_SECRET, { expiresIn: '15m' });
};

export const generateRefreshToken = (userId) => {
  // jti ensures two refresh tokens minted for the same user in the same wall-clock
  // second are never byte-identical (jwt.sign truncates iat to seconds) — without
  // this, rotation's "old token stops working" guarantee silently breaks whenever
  // a device re-authenticates within the same second (Task 24: Session-backed cap
  // + rotation depend on each refresh token being unique).
  return jwt.sign({ id: userId, jti: crypto.randomUUID() }, JWT_REFRESH_SECRET, { expiresIn: '7d' });
};

export default generateAccessToken;
