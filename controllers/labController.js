import * as labCatalogService from '../services/labCatalogService.js';
import * as reviewService from '../services/reviewService.js';
import { asyncHandler } from '../utils/asyncHandler.js';

export const getTests = asyncHandler(async (request, reply) =>
  reply.code(200).send(await labCatalogService.searchTests(request.query)));

export const getAllLabs = asyncHandler(async (request, reply) =>
  reply.code(200).send(await labCatalogService.listLabs(request.query)));

export const getNearbyLabs = asyncHandler(async (request, reply) =>
  reply.code(200).send(await labCatalogService.nearbyLabs(request.query)));

export const getLabById = asyncHandler(async (request, reply) =>
  reply.code(200).send({ lab: await labCatalogService.getLab(request.params.id) }));

export const getLabTests = asyncHandler(async (request, reply) =>
  reply.code(200).send({ tests: await labCatalogService.getLabTests(request.params.id) }));

export const getLabSlots = asyncHandler(async (request, reply) =>
  reply.code(200).send(await labCatalogService.computeLabSlots({
    labId: request.params.id,
    date: request.query.date,
  })));

export const getLabReviews = asyncHandler(async (request, reply) =>
  reply.code(200).send(await reviewService.listReviewsForLab({
    labId: request.params.id,
    page: request.query.page,
    limit: request.query.limit,
  })));

export const createLabReview = asyncHandler(async (request, reply) =>
  reply.code(201).send({
    review: await reviewService.createReview({
      user: request.user,
      labId: request.params.id,
      rating: request.body.rating,
      comment: request.body.comment,
      bookingId: request.body.bookingId,
    }),
  }));
