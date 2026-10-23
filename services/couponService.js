import Coupon from '../models/coupon.js';
import Booking from '../models/booking.js';
import { Errors } from '../common/errors.js';

export const evaluateCoupon = async ({ code, userId, amount }) => {
  const normalized = String(code || '').trim().toUpperCase();
  const coupon = normalized ? await Coupon.findOne({ code: normalized }) : null;
  if (!coupon || !coupon.isActive) {
    throw Errors.COUPON_INVALID("We couldn't find that coupon. Check the code and try again.");
  }
  if (coupon.validUntil && coupon.validUntil.getTime() < Date.now()) {
    throw Errors.COUPON_INVALID('This coupon has expired.');
  }
  if (amount < coupon.minOrder) {
    throw Errors.COUPON_INVALID(`Add ₹${coupon.minOrder - amount} more to use this coupon.`);
  }
  if (coupon.firstBookingOnly) {
    const existing = await Booking.exists({ user: userId, status: { $ne: 'CANCELLED' } });
    if (existing) throw Errors.COUPON_INVALID(`${coupon.code} is only for your first booking.`);
  }

  let discount;
  if (coupon.flatOff) {
    discount = coupon.flatOff;
  } else {
    discount = Math.round((amount * (coupon.percentOff || 0)) / 100);
    if (coupon.maxDiscount != null) discount = Math.min(coupon.maxDiscount, discount);
  }
  discount = Math.max(0, Math.min(discount, amount));
  return { code: coupon.code, discount, description: coupon.description };
};
