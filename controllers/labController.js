import Lab from '../models/lab.js';
import Test from '../models/test.js';
import Booking from '../models/booking.js';
import { Errors } from '../common/errors.js';
import { asyncHandler } from '../utils/asyncHandler.js';

export const getTests = asyncHandler(async (request, reply) => {
  const {
    q,
    category,
    minPrice,
    maxPrice,
    sortBy = 'price',
    order = 'asc',
    page = 1,
    limit = 20,
  } = request.query;

  const filter = { isActive: true };

  // Full-text search on name + category
  if (q) {
    filter.$text = { $search: q };
  } else if (category) {
    // category-only filter (case-insensitive)
    filter.category = { $regex: new RegExp(`^${category}$`, 'i') };
  }

  // Price range
  if (minPrice !== undefined || maxPrice !== undefined) {
    filter.price = {};
    if (minPrice !== undefined) filter.price.$gte = parseFloat(minPrice);
    if (maxPrice !== undefined) filter.price.$lte = parseFloat(maxPrice);
  }

  const sortOrder = order === 'desc' ? -1 : 1;
  const allowedSort = ['price', 'name', 'turnaroundHours', 'createdAt'];
  const sortField = allowedSort.includes(sortBy) ? sortBy : 'price';

  const skip = (parseInt(page) - 1) * parseInt(limit);
  const lim  = Math.min(parseInt(limit), 100); // cap at 100

  const [tests, total] = await Promise.all([
    Test.find(filter)
      .populate('lab', 'name address rating certifications isActive')
      .select('-__v')
      .sort({ [sortField]: sortOrder })
      .skip(skip)
      .limit(lim),
    Test.countDocuments(filter),
  ]);

  return reply.code(200).send({
    tests,
    total,
    page: parseInt(page),
    limit: lim,
    pages: Math.ceil(total / lim),
  });
});

export const getAllLabs = asyncHandler(async (request, reply) => {
  const {
    search,
    isActive,
    isVerified,
    city,
    sortBy = 'createdAt',
    order = 'desc',
    page = 1,
    limit = 20,
  } = request.query;

  const filter = {};

  if (isActive !== undefined) filter.isActive = isActive === 'true' || isActive === true;
  if (isVerified !== undefined) filter.isVerified = isVerified === 'true' || isVerified === true;
  if (city) filter['address.city'] = { $regex: new RegExp(city, 'i') };
  if (search) filter.name = { $regex: new RegExp(search, 'i') };

  const allowedSort = ['name', 'rating', 'createdAt'];
  const sortField = allowedSort.includes(sortBy) ? sortBy : 'createdAt';
  const sortOrder = order === 'asc' ? 1 : -1;

  const skip = (parseInt(page) - 1) * parseInt(limit);
  const lim = Math.min(parseInt(limit), 100);

  const [labs, total] = await Promise.all([
    Lab.find(filter)
      .populate('owner', 'name email phone')
      .select('-__v')
      .sort({ [sortField]: sortOrder })
      .skip(skip)
      .limit(lim),
    Lab.countDocuments(filter),
  ]);

  return reply.code(200).send({
    labs,
    total,
    page: parseInt(page),
    limit: lim,
    pages: Math.ceil(total / lim),
  });
});

export const getNearbyLabs = asyncHandler(async (request, reply) => {
  const { lat, lng, radius = 5000, minRating, page = 1, limit = 20 } = request.query;
  const query = {
    location: {
      $near: {
        $geometry: { type: 'Point', coordinates: [parseFloat(lng), parseFloat(lat)] },
        $maxDistance: parseInt(radius),
      },
    },
    isActive: true,
  };
  if (minRating) query.rating = { $gte: parseFloat(minRating) };
  const skip = (parseInt(page) - 1) * parseInt(limit);
  const labs = await Lab.find(query).skip(skip).limit(parseInt(limit)).select('-__v');
  return reply.code(200).send({ labs, count: labs.length });
});

export const getLabById = asyncHandler(async (request, reply) => {
  const lab = await Lab.findById(request.params.id)
    .populate('owner', 'name email phone')
    .select('-__v');
  if (!lab) {
    const err = Errors.NOT_FOUND('Lab', `/labs/${request.params.id}`);
    return reply.code(err.statusCode).send(err.toRFC7807());
  }
  return reply.code(200).send({ lab });
});

export const getLabTests = asyncHandler(async (request, reply) => {
  const tests = await Test.find({ lab: request.params.id, isActive: true }).select('-__v');
  return reply.code(200).send({ tests });
});

export const getLabSlots = asyncHandler(async (request, reply) => {
  const { date } = request.query;
  const lab = await Lab.findById(request.params.id);
  if (!lab) {
    const err = Errors.NOT_FOUND('Lab');
    return reply.code(err.statusCode).send(err.toRFC7807());
  }

  const dayName = new Date(date).toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase();
  const dayHours = lab.openingHours?.[dayName];
  if (!dayHours || dayHours.isClosed) {
    const err = Errors.LAB_CLOSED(`Lab is closed on ${dayName}`);
    return reply.code(err.statusCode).send(err.toRFC7807());
  }

  const { duration = 30, intervalMinutes = 30, maxBookingsPerSlot = 5 } = lab.slotMatrix || {};
  const [openH, openM] = (dayHours.open || '09:00').split(':').map(Number);
  const [closeH, closeM] = (dayHours.close || '18:00').split(':').map(Number);
  let current = openH * 60 + openM;
  const closeTotal = closeH * 60 + closeM;

  const startOfDay = new Date(date);
  const endOfDay = new Date(date);
  endOfDay.setDate(endOfDay.getDate() + 1);
  const existingBookings = await Booking.find({
    lab: lab._id,
    scheduledDate: { $gte: startOfDay, $lt: endOfDay },
    status: { $in: ['PENDING', 'CONFIRMED', 'COLLECTED'] },
  });

  const slots = [];
  while (current + duration <= closeTotal) {
    const hh = String(Math.floor(current / 60)).padStart(2, '0');
    const mm = String(current % 60).padStart(2, '0');
    const slotStart = `${hh}:${mm}`;
    const endMin = current + duration;
    const eh = String(Math.floor(endMin / 60)).padStart(2, '0');
    const em = String(endMin % 60).padStart(2, '0');
    const slotEnd = `${eh}:${em}`;
    const booked = existingBookings.filter(b => b.slot?.start === slotStart).length;
    slots.push({
      start: slotStart,
      end: slotEnd,
      available: booked < maxBookingsPerSlot,
      booked,
      capacity: maxBookingsPerSlot,
    });
    current += intervalMinutes;
  }

  return reply.code(200).send({ date, slots });
});
