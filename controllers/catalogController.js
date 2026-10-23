import * as catalogService from '../services/catalogService.js';
import { evaluateCoupon } from '../services/couponService.js';
import { asyncHandler } from '../utils/asyncHandler.js';

export const getCatalogTests = asyncHandler(async (request, reply) =>
  reply.code(200).send(await catalogService.listCatalog(request.query)));

export const evaluateCouponCode = asyncHandler(async (request, reply) => {
  const coupon = await evaluateCoupon({
    code: request.params.code,
    userId: request.user._id,
    amount: request.query.amount,
  });
  return reply.code(200).send({ coupon });
});

export const quoteCatalogCart = asyncHandler(async (request, reply) =>
  reply.code(200).send(await catalogService.quoteCart(request.body)));
