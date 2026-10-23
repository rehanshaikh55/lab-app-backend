import * as catalogService from '../services/catalogService.js';
import { asyncHandler } from '../utils/asyncHandler.js';

export const getCatalogTests = asyncHandler(async (request, reply) =>
  reply.code(200).send(await catalogService.listCatalog(request.query)));

export const quoteCatalogCart = asyncHandler(async (request, reply) =>
  reply.code(200).send(await catalogService.quoteCart(request.body)));
