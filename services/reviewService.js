import Review from '../models/review.js';
import Lab from '../models/lab.js';
import Booking from '../models/booking.js';
import { Errors } from '../common/errors.js';

const recomputeLabRating = async (labId) => {
  const agg = await Review.aggregate([
    { $match: { lab: labId } },
    { $group: { _id: '$lab', avg: { $avg: '$rating' }, count: { $sum: 1 } } },
  ]);
  await Lab.findByIdAndUpdate(labId, {
    rating: agg[0]?.avg || 0,
    totalRatings: agg[0]?.count || 0,
  });
};

export const createReview = async ({ user, labId, rating, comment, bookingId }) => {
  const lab = await Lab.findById(labId);
  if (!lab) throw Errors.NOT_FOUND('Lab');

  if (bookingId) {
    const booking = await Booking.findById(bookingId);
    if (!booking || booking.user.toString() !== user._id.toString()) {
      throw Errors.BOOKING_NOT_FOUND(`/labs/${labId}/reviews`);
    }
    if (booking.lab.toString() !== labId.toString()) {
      throw Errors.VALIDATION_ERROR('Booking is not for this lab');
    }
    if (await Review.exists({ user: user._id, booking: bookingId })) {
      throw Errors.CONFLICT('Already reviewed this booking');
    }
  }

  const review = await Review.create({
    user: user._id,
    lab: labId,
    booking: bookingId || null,
    rating,
    comment,
  });
  await recomputeLabRating(lab._id);
  return review;
};

export const listReviewsForLab = async ({ labId, page = 1, limit = 10 }) => {
  const skip = (parseInt(page) - 1) * parseInt(limit);
  const [reviews, total] = await Promise.all([
    Review.find({ lab: labId })
      .populate('user', 'name')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit)),
    Review.countDocuments({ lab: labId }),
  ]);
  return { reviews, total, page: parseInt(page), limit: parseInt(limit) };
};
