import User from '../models/user.js';
import bcrypt from 'bcryptjs';
import nodemailer from 'nodemailer';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import { generateAccessToken, generateRefreshToken } from '../utils/generateToken.js';
import { JWT_REFRESH_SECRET, EMAIL_USER, EMAIL_PASS, FRONTEND_URL } from '../config/env.js';
import { Errors } from '../common/errors.js';

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: { user: EMAIL_USER, pass: EMAIL_PASS },
});

export const register = async (request, reply) => {
  const { name, email, password, phone, role } = request.body;
  const existing = await User.findOne({ email });
  if (existing) {
    const err = Errors.CONFLICT('Email already in use');
    return reply.code(err.statusCode).send(err.toRFC7807());
  }
  const passwordHash = await bcrypt.hash(password, 12);
  const roles = role === 'LAB_OWNER' ? ['LAB_OWNER'] : ['CUSTOMER'];
  const user = await User.create({ name, email, passwordHash, phone, roles });
  const accessToken = generateAccessToken(user._id);
  const refreshToken = generateRefreshToken(user._id);
  user.refreshToken = await bcrypt.hash(refreshToken, 10);
  await user.save();
  return reply.code(201).send({
    accessToken,
    refreshToken,
    user: { id: user._id, name: user.name, email: user.email, roles: user.roles },
  });
};

export const login = async (request, reply) => {
  const { email, password } = request.body;
  const user = await User.findOne({ email });
  if (!user || !user.passwordHash || !(await bcrypt.compare(password, user.passwordHash))) {
    const err = Errors.UNAUTHORIZED();
    return reply.code(err.statusCode).send(err.toRFC7807());
  }
  const accessToken = generateAccessToken(user._id);
  const refreshToken = generateRefreshToken(user._id);
  user.refreshToken = await bcrypt.hash(refreshToken, 10);
  user.lastLoginAt = new Date();
  await user.save();
  return reply.code(200).send({
    accessToken,
    refreshToken,
    user: { id: user._id, name: user.name, email: user.email, roles: user.roles },
  });
};

export const refresh = async (request, reply) => {
  const { refreshToken } = request.body;
  if (!refreshToken) {
    const err = Errors.UNAUTHORIZED();
    return reply.code(err.statusCode).send(err.toRFC7807());
  }
  let decoded;
  try {
    decoded = jwt.verify(refreshToken, JWT_REFRESH_SECRET);
  } catch {
    const err = Errors.UNAUTHORIZED();
    return reply.code(err.statusCode).send(err.toRFC7807());
  }
  const user = await User.findById(decoded.id);
  if (!user || !user.refreshToken || !(await bcrypt.compare(refreshToken, user.refreshToken))) {
    const err = Errors.UNAUTHORIZED();
    return reply.code(err.statusCode).send(err.toRFC7807());
  }
  const newAccessToken = generateAccessToken(user._id);
  const newRefreshToken = generateRefreshToken(user._id);
  user.refreshToken = await bcrypt.hash(newRefreshToken, 10);
  await user.save();
  return reply.code(200).send({ accessToken: newAccessToken, refreshToken: newRefreshToken });
};

export const logout = async (request, reply) => {
  request.user.refreshToken = null;
  await request.user.save();
  return reply.code(200).send({ message: 'Logged out successfully' });
};

export const forgotPassword = async (request, reply) => {
  const { email } = request.body;
  const user = await User.findOne({ email });
  // Always return same message to prevent email enumeration
  if (!user) return reply.code(200).send({ message: 'If that email exists, a reset link was sent' });
  const resetToken = crypto.randomBytes(32).toString('hex');
  user.resetToken = resetToken;
  user.resetTokenExpiry = Date.now() + 3600000; // 1 hour
  await user.save();
  const resetURL = `${FRONTEND_URL}/reset-password/${resetToken}`;
  try {
    await transporter.sendMail({
      from: EMAIL_USER,
      to: user.email,
      subject: 'Password Reset — Labzy',
      html: `<p>Click <a href="${resetURL}">here</a> to reset your password. This link expires in 1 hour.</p>`,
    });
  } catch (e) {
    request.log.error({ err: e }, 'Failed to send reset email');
  }
  return reply.code(200).send({ message: 'If that email exists, a reset link was sent' });
};

export const resetPassword = async (request, reply) => {
  const { token } = request.params;
  const { newPassword } = request.body;
  const user = await User.findOne({ resetToken: token, resetTokenExpiry: { $gt: Date.now() } });
  if (!user) {
    const err = Errors.VALIDATION_ERROR('Invalid or expired reset token');
    return reply.code(err.statusCode).send(err.toRFC7807());
  }
  user.passwordHash = await bcrypt.hash(newPassword, 12);
  user.resetToken = undefined;
  user.resetTokenExpiry = undefined;
  await user.save();
  return reply.code(200).send({ message: 'Password reset successfully' });
};
