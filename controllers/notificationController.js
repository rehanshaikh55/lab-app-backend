import * as notificationService from '../services/notificationService.js';
import { asyncHandler } from '../utils/asyncHandler.js';

export const listNotifications = asyncHandler(async (req, reply) =>
  reply.code(200).send(await notificationService.listNotifications({
    userId: req.user._id,
    page: req.query.page,
    limit: req.query.limit,
  })));

export const markRead = asyncHandler(async (req, reply) =>
  reply.code(200).send(await notificationService.markRead({
    userId: req.user._id,
    id: req.params.id,
  })));

export const markAllRead = asyncHandler(async (req, reply) =>
  reply.code(200).send(await notificationService.markAllRead({
    userId: req.user._id,
  })));

export const unreadCount = asyncHandler(async (req, reply) =>
  reply.code(200).send(await notificationService.unreadCount({
    userId: req.user._id,
  })));
