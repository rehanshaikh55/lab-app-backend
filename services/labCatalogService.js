import Lab from '../models/lab.js';
import Test from '../models/test.js';
import Booking from '../models/booking.js';
import Review from '../models/review.js';
import mongoose from 'mongoose';
import { Errors } from '../common/errors.js';
import { weekdayName } from './_shared/slotTime.js';
import { expand } from './searchSynonymService.js';

export const searchTests = async (q) => {
  const filter = { isActive: true };
  if (q.q) filter.$text = { $search: q.q };
  else if (q.category) filter.category = { $regex: new RegExp(`^${q.category}$`, 'i') };
  if (q.minPrice !== undefined || q.maxPrice !== undefined) {
    filter.price = {};
    if (q.minPrice !== undefined) filter.price.$gte = parseFloat(q.minPrice);
    if (q.maxPrice !== undefined) filter.price.$lte = parseFloat(q.maxPrice);
  }
  const allowedSort = ['price', 'name', 'turnaroundHours', 'createdAt'];
  const sortField = allowedSort.includes(q.sortBy) ? q.sortBy : 'price';
  const sortOrder = q.order === 'desc' ? -1 : 1;
  const page = parseInt(q.page) || 1;
  const lim = Math.min(parseInt(q.limit) || 20, 100);
  const skip = (page - 1) * lim;
  const [tests, total] = await Promise.all([
    Test.find(filter)
      .populate('lab', 'name address rating certifications isActive')
      .select('-__v')
      .sort({ [sortField]: sortOrder })
      .skip(skip)
      .limit(lim),
    Test.countDocuments(filter),
  ]);
  return { tests, total, page, limit: lim, pages: Math.ceil(total / lim) };
};

export const listLabs = async (q) => {
  const filter = {};
  if (q.isActive !== undefined) filter.isActive = q.isActive === 'true' || q.isActive === true;
  if (q.isVerified !== undefined) filter.isVerified = q.isVerified === 'true' || q.isVerified === true;
  if (q.city) filter['address.city'] = { $regex: new RegExp(q.city, 'i') };
  if (q.search) filter.name = { $regex: new RegExp(q.search, 'i') };
  const allowedSort = ['name', 'rating', 'createdAt'];
  const sortField = allowedSort.includes(q.sortBy) ? q.sortBy : 'createdAt';
  const sortOrder = q.order === 'asc' ? 1 : -1;
  const page = parseInt(q.page) || 1;
  const lim = Math.min(parseInt(q.limit) || 20, 100);
  const skip = (page - 1) * lim;
  const [labs, total] = await Promise.all([
    Lab.find(filter)
      .populate('owner', 'name email phone')
      .select('-__v')
      .sort({ [sortField]: sortOrder })
      .skip(skip)
      .limit(lim),
    Lab.countDocuments(filter),
  ]);
  return { labs, total, page, limit: lim, pages: Math.ceil(total / lim) };
};

// PRD §6.2 FR-1 (relevance = distance + rating blend) and FR-5 (synonym expansion on `q`).
//
// Uses `$geoNear` (aggregation) instead of the plain `find()` + `$near` query used previously,
// because relevance scoring needs the computed `distanceMeters` value that only `$geoNear`
// provides. Note this changes the shape of the returned `labs` array from hydrated Mongoose
// documents to plain JS objects — see the report for why that's safe for current callers.
export const nearbyLabs = async ({ lat, lng, radius = 5000, minRating, sortBy = 'relevance', q, page = 1, limit = 20 }) => {
  const expanded = q ? await expand(q) : null;
  const pipeline = [
    { $geoNear: {
        near: { type: 'Point', coordinates: [parseFloat(lng), parseFloat(lat)] },
        distanceField: 'distanceMeters',
        maxDistance: parseInt(radius),
        spherical: true,
        query: { isActive: true, ...(minRating ? { rating: { $gte: parseFloat(minRating) } } : {}) },
    } },
  ];
  if (expanded) {
    pipeline.push({ $lookup: {
      from: 'tests', localField: '_id', foreignField: 'lab', as: 'matchingTests',
      pipeline: [{ $match: { isActive: true, name: { $regex: new RegExp(expanded.join('|'), 'i') } } }],
    } });
    pipeline.push({ $match: { matchingTests: { $not: { $size: 0 } } } });
  }
  if (sortBy === 'relevance') {
    pipeline.push({ $addFields: {
      relevanceScore: {
        $add: [
          { $multiply: ['$rating', 100] },
          { $multiply: [{ $divide: [10000, { $add: ['$distanceMeters', 100] }] }, 1] },
        ],
      },
    } });
    pipeline.push({ $sort: { relevanceScore: -1 } });
  } else if (sortBy === 'distance') pipeline.push({ $sort: { distanceMeters: 1 } });
  else if (sortBy === 'rating')     pipeline.push({ $sort: { rating: -1 } });

  pipeline.push({ $skip: (parseInt(page) - 1) * parseInt(limit) });
  pipeline.push({ $limit: parseInt(limit) });
  pipeline.push({ $project: { __v: 0, matchingTests: 0 } });
  const labs = await Lab.aggregate(pipeline);
  return { labs, count: labs.length };
};

export const getLab = async (id) => {
  const [lab, dist] = await Promise.all([
    Lab.findById(id).populate('owner', 'name email phone').select('-__v'),
    Review.aggregate([
      { $match: { lab: new mongoose.Types.ObjectId(id) } },
      { $group: { _id: '$rating', count: { $sum: 1 } } },
    ]),
  ]);
  if (!lab) throw Errors.NOT_FOUND('Lab', `/labs/${id}`);
  const ratingDistribution = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  for (const d of dist) ratingDistribution[d._id] = d.count;
  return { ...lab.toObject(), ratingDistribution };
};

export const getLabTests = async (id) =>
  Test.find({ lab: id, isActive: true }).select('-__v');

export const computeLabSlots = async ({ labId, date }) => {
  const lab = await Lab.findById(labId);
  if (!lab) throw Errors.NOT_FOUND('Lab');
  const dayHours = lab.openingHours?.[weekdayName(date)];
  if (!dayHours || dayHours.isClosed) throw Errors.LAB_CLOSED(`Lab is closed on ${weekdayName(date)}`);

  const { duration = 30, intervalMinutes = 30, maxBookingsPerSlot = 5 } = lab.slotMatrix || {};
  const [openH, openM] = (dayHours.open || '09:00').split(':').map(Number);
  const [closeH, closeM] = (dayHours.close || '18:00').split(':').map(Number);
  let current = openH * 60 + openM;
  const closeTotal = closeH * 60 + closeM;

  const startOfDay = new Date(date);
  const endOfDay = new Date(date);
  endOfDay.setDate(endOfDay.getDate() + 1);
  const existing = await Booking.find({
    lab: lab._id,
    scheduledDate: { $gte: startOfDay, $lt: endOfDay },
    status: { $in: ['PENDING', 'CONFIRMED', 'COLLECTED', 'PROCESSING'] },
  });

  const slots = [];
  while (current + duration <= closeTotal) {
    const pad = (n) => String(n).padStart(2, '0');
    const slotStart = `${pad(Math.floor(current / 60))}:${pad(current % 60)}`;
    const endMin = current + duration;
    const slotEnd = `${pad(Math.floor(endMin / 60))}:${pad(endMin % 60)}`;
    const booked = existing.filter((b) => b.slot?.start === slotStart).length;
    slots.push({
      start: slotStart,
      end: slotEnd,
      available: booked < maxBookingsPerSlot,
      booked,
      capacity: maxBookingsPerSlot,
    });
    current += intervalMinutes;
  }
  return { date, slots };
};
