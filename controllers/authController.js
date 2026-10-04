import * as authService from '../services/authService.js';
import { asyncHandler } from '../utils/asyncHandler.js';

export const register = asyncHandler(async (req, reply) =>
  reply.code(201).send(await authService.register({
    ...req.body, ip: req.ip, ua: req.headers['user-agent'],
  })));

export const consents = asyncHandler(async (req, reply) =>
  reply.code(200).send(await authService.recordConsents({
    userId: req.user._id,
    consents: req.body.consents,
    ip: req.ip,
    ua: req.headers['user-agent'],
  })));

export const login = asyncHandler(async (req, reply) =>
  reply.code(200).send(await authService.login({
    ...req.body, ip: req.ip, ua: req.headers['user-agent'],
  })));

export const refresh = asyncHandler(async (req, reply) =>
  reply.code(200).send(await authService.refresh(req.body)));

export const logout = asyncHandler(async (req, reply) =>
  reply.code(200).send(await authService.logout(req.user, req.body?.refreshToken)));

export const forgotPassword = asyncHandler(async (req, reply) =>
  reply.code(200).send(await authService.forgotPassword(req.body, req.log)));

export const resetPassword = asyncHandler(async (req, reply) =>
  reply.code(200).send(await authService.resetPassword({
    token: req.params.token,
    newPassword: req.body.newPassword,
  })));
