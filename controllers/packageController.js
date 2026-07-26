import * as healthPackageService from '../services/healthPackageService.js';
import { asyncHandler } from '../utils/asyncHandler.js';

export const listPackages = asyncHandler(async (req, reply) =>
  reply.code(200).send(await healthPackageService.listPackages(req.query)));

export const getPackage = asyncHandler(async (req, reply) =>
  reply.code(200).send({ package: await healthPackageService.getPackage(req.params.slug) }));
