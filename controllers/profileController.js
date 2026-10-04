import * as profileService from '../services/profileService.js';
import * as discoveryService from '../services/discoveryService.js';
import { asyncHandler } from '../utils/asyncHandler.js';

export const getProfile = asyncHandler(async (req, reply) =>
  reply.code(200).send({ user: await profileService.getProfile(req.user._id) }));

export const updateProfile = asyncHandler(async (req, reply) =>
  reply.code(200).send({
    user: await profileService.updateProfile({ userId: req.user._id, body: req.body }),
  }));

export const addAddress = asyncHandler(async (req, reply) =>
  reply.code(201).send({
    addresses: await profileService.addAddress({ userId: req.user._id, body: req.body }),
  }));

export const updateAddress = asyncHandler(async (req, reply) =>
  reply.code(200).send({
    addresses: await profileService.updateAddress({
      userId: req.user._id,
      addressId: req.params.id,
      body: req.body,
    }),
  }));

export const deleteAddress = asyncHandler(async (req, reply) =>
  reply.code(200).send({
    addresses: await profileService.deleteAddress({
      userId: req.user._id,
      addressId: req.params.id,
    }),
  }));

export const updateLocation = asyncHandler(async (req, reply) =>
  reply.code(200).send(await profileService.updateLocation({
    userId: req.user._id,
    ...req.body,
  })));

// Dependents

export const listDependents = asyncHandler(async (req, reply) =>
  reply.code(200).send({ dependents: await profileService.listDependents(req.user._id) }));

export const addDependent = asyncHandler(async (req, reply) =>
  reply.code(201).send({
    dependents: await profileService.addDependent({ userId: req.user._id, body: req.body }),
  }));

export const updateDependent = asyncHandler(async (req, reply) =>
  reply.code(200).send({
    dependents: await profileService.updateDependent({
      userId: req.user._id,
      dependentId: req.params.id,
      body: req.body,
    }),
  }));

export const deleteDependent = asyncHandler(async (req, reply) =>
  reply.code(200).send({
    dependents: await profileService.deleteDependent({
      userId: req.user._id,
      dependentId: req.params.id,
    }),
  }));

// Account deletion grace period (Task 24)

export const deleteAccount = asyncHandler(async (req, reply) =>
  reply.code(200).send(await profileService.requestAccountDeletion({ userId: req.user._id })));

export const restoreAccount = asyncHandler(async (req, reply) =>
  reply.code(200).send(await profileService.cancelAccountDeletion({ userId: req.user._id })));

// Discovery: recently-viewed searches + "notify me when a lab joins nearby" (Task 25, PRD §6.2)

export const listRecentSearches = asyncHandler(async (req, reply) =>
  reply.code(200).send({ searches: await discoveryService.listRecentSearches(req.user._id) }));

export const recordSearch = asyncHandler(async (req, reply) =>
  reply.code(201).send({
    search: await discoveryService.recordSearch({ userId: req.user._id, ...req.body }),
  }));

export const watchLabsNearby = asyncHandler(async (req, reply) =>
  reply.code(201).send({
    watch: await discoveryService.watchLabsNearby({ userId: req.user._id, ...req.body }),
  }));
