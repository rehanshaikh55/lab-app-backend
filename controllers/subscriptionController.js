import * as subscriptionService from '../services/subscriptionService.js';
import { asyncHandler } from '../utils/asyncHandler.js';

export const createSubscription = asyncHandler(async (req, reply) =>
  reply.code(201).send({
    subscription: await subscriptionService.createSubscription({
      userId: req.user._id,
      ...req.body,
    }),
  }));

export const listSubscriptions = asyncHandler(async (req, reply) =>
  reply.code(200).send({
    subscriptions: await subscriptionService.listSubscriptions(req.user._id),
  }));

export const getSubscriptionById = asyncHandler(async (req, reply) =>
  reply.code(200).send({
    subscription: await subscriptionService.getSubscription({
      userId: req.user._id,
      id: req.params.id,
    }),
  }));

export const updateSubscription = asyncHandler(async (req, reply) =>
  reply.code(200).send({
    subscription: await subscriptionService.updateSubscription({
      userId: req.user._id,
      id: req.params.id,
      body: req.body,
    }),
  }));

export const pauseSubscription = asyncHandler(async (req, reply) =>
  reply.code(200).send({
    subscription: await subscriptionService.pauseSubscription({
      userId: req.user._id,
      id: req.params.id,
    }),
  }));

export const resumeSubscription = asyncHandler(async (req, reply) =>
  reply.code(200).send({
    subscription: await subscriptionService.resumeSubscription({
      userId: req.user._id,
      id: req.params.id,
    }),
  }));

export const cancelSubscription = asyncHandler(async (req, reply) =>
  reply.code(200).send({
    subscription: await subscriptionService.cancelSubscription({
      userId: req.user._id,
      id: req.params.id,
    }),
  }));

export const skipNext = asyncHandler(async (req, reply) =>
  reply.code(200).send({
    subscription: await subscriptionService.skipNextOccurrence({ userId: req.user._id, id: req.params.id }),
  }));

export const pauseUntilHandler = asyncHandler(async (req, reply) =>
  reply.code(200).send({
    subscription: await subscriptionService.pauseUntil({ userId: req.user._id, id: req.params.id, until: req.body.until }),
  }));

export const listOccurrences = asyncHandler(async (req, reply) =>
  reply.code(200).send({
    occurrences: await subscriptionService.listOccurrences({ userId: req.user._id, id: req.params.id }),
  }));

export const approveOccurrence = asyncHandler(async (req, reply) =>
  reply.code(200).send({
    occurrence: await subscriptionService.approveOccurrence({ userId: req.user._id, occurrenceId: req.params.occId }),
  }));
