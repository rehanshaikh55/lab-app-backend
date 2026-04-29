import Subscription from '../models/subscription.js';
import { Errors } from '../common/errors.js';
import { asyncHandler } from '../utils/asyncHandler.js';

const getNextDate = (from, frequency, customIntervalDays) => {
  const d = new Date(from);
  if (frequency === 'WEEKLY')      d.setDate(d.getDate() + 7);
  else if (frequency === 'MONTHLY') d.setMonth(d.getMonth() + 1);
  else if (frequency === 'CUSTOM')  d.setDate(d.getDate() + (customIntervalDays || 30));
  return d;
};

export const createSubscription = asyncHandler(async (request, reply) => {
  const { labId, testId, frequency, customIntervalDays, autoPayment, startDate } = request.body;
  const nextBookingDate = startDate ? new Date(startDate) : new Date();
  const sub = await Subscription.create({
    user: request.user._id,
    lab: labId,
    test: testId,
    frequency,
    customIntervalDays: frequency === 'CUSTOM' ? customIntervalDays : undefined,
    nextBookingDate,
    autoPayment: autoPayment || false,
    status: 'ACTIVE',
  });
  return reply.code(201).send({ subscription: sub });
});

export const listSubscriptions = asyncHandler(async (request, reply) => {
  const subs = await Subscription.find({ user: request.user._id })
    .populate('lab', 'name')
    .populate('test', 'name price')
    .sort({ createdAt: -1 });
  return reply.code(200).send({ subscriptions: subs });
});

export const getSubscriptionById = asyncHandler(async (request, reply) => {
  const sub = await Subscription.findById(request.params.id)
    .populate('lab', 'name')
    .populate('test', 'name price');
  if (!sub || sub.user.toString() !== request.user._id.toString()) {
    const err = Errors.NOT_FOUND('Subscription');
    return reply.code(err.statusCode).send(err.toRFC7807());
  }
  return reply.code(200).send({ subscription: sub });
});

export const updateSubscription = asyncHandler(async (request, reply) => {
  const sub = await Subscription.findById(request.params.id);
  if (!sub || sub.user.toString() !== request.user._id.toString()) {
    const err = Errors.NOT_FOUND('Subscription');
    return reply.code(err.statusCode).send(err.toRFC7807());
  }
  const { frequency, customIntervalDays, autoPayment } = request.body;
  if (frequency !== undefined)          sub.frequency = frequency;
  if (customIntervalDays !== undefined) sub.customIntervalDays = customIntervalDays;
  if (autoPayment !== undefined)        sub.autoPayment = autoPayment;
  await sub.save();
  return reply.code(200).send({ subscription: sub });
});

export const pauseSubscription = asyncHandler(async (request, reply) => {
  const sub = await Subscription.findById(request.params.id);
  if (!sub || sub.user.toString() !== request.user._id.toString()) {
    const err = Errors.NOT_FOUND('Subscription');
    return reply.code(err.statusCode).send(err.toRFC7807());
  }
  if (sub.status !== 'ACTIVE') {
    const err = Errors.INVALID_SUBSCRIPTION_STATE('Only ACTIVE subscriptions can be paused');
    return reply.code(err.statusCode).send(err.toRFC7807());
  }
  sub.status = 'PAUSED';
  await sub.save();
  return reply.code(200).send({ subscription: sub });
});

export const resumeSubscription = asyncHandler(async (request, reply) => {
  const sub = await Subscription.findById(request.params.id);
  if (!sub || sub.user.toString() !== request.user._id.toString()) {
    const err = Errors.NOT_FOUND('Subscription');
    return reply.code(err.statusCode).send(err.toRFC7807());
  }
  if (sub.status !== 'PAUSED') {
    const err = Errors.INVALID_SUBSCRIPTION_STATE('Only PAUSED subscriptions can be resumed');
    return reply.code(err.statusCode).send(err.toRFC7807());
  }
  sub.status = 'ACTIVE';
  sub.nextBookingDate = getNextDate(new Date(), sub.frequency, sub.customIntervalDays);
  await sub.save();
  return reply.code(200).send({ subscription: sub });
});

export const cancelSubscription = asyncHandler(async (request, reply) => {
  const sub = await Subscription.findById(request.params.id);
  if (!sub || sub.user.toString() !== request.user._id.toString()) {
    const err = Errors.NOT_FOUND('Subscription');
    return reply.code(err.statusCode).send(err.toRFC7807());
  }
  if (sub.status === 'CANCELLED') {
    const err = Errors.INVALID_SUBSCRIPTION_STATE('Subscription is already cancelled');
    return reply.code(err.statusCode).send(err.toRFC7807());
  }
  sub.status = 'CANCELLED';
  await sub.save();
  return reply.code(200).send({ subscription: sub });
});
