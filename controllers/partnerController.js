import Booking from '../models/booking.js';
import Lab from '../models/lab.js';
import LabAssistant from '../models/labAssistant.js';
import Report from '../models/report.js';
import { storage } from '../integrations/storage/storage.js';
import { Errors } from '../common/errors.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import crypto from 'crypto';

const VALID_TRANSITIONS = {
  PENDING:   ['CONFIRMED', 'CANCELLED'],
  CONFIRMED: ['COLLECTED', 'CANCELLED'],
  COLLECTED: ['COMPLETED'],
  COMPLETED: [],
  CANCELLED: [],
};

async function getOwnedLab(userId) {
  return Lab.findOne({ owner: userId, isActive: true });
}

export const getDailyBookings = asyncHandler(async (request, reply) => {
  const lab = await getOwnedLab(request.user._id);
  if (!lab) {
    const err = Errors.NOT_FOUND('Lab');
    return reply.code(err.statusCode).send(err.toRFC7807());
  }
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const bookings = await Booking.find({
    lab: lab._id,
    scheduledDate: { $gte: today, $lt: tomorrow },
  })
    .populate('user', 'name phone email')
    .populate('tests', 'name price')
    .populate('labAssistant', 'name phone')
    .sort({ 'slot.start': 1 });
  return reply.code(200).send({ bookings, date: today.toISOString().split('T')[0] });
});

export const getPartnerBookings = asyncHandler(async (request, reply) => {
  const lab = await getOwnedLab(request.user._id);
  if (!lab) {
    const err = Errors.NOT_FOUND('Lab');
    return reply.code(err.statusCode).send(err.toRFC7807());
  }
  const { status, page = 1, limit = 20 } = request.query;
  const query = { lab: lab._id };
  if (status) query.status = status;
  const skip = (parseInt(page) - 1) * parseInt(limit);
  const [bookings, total] = await Promise.all([
    Booking.find(query)
      .populate('user', 'name phone email')
      .populate('tests', 'name price')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit)),
    Booking.countDocuments(query),
  ]);
  return reply.code(200).send({ bookings, total, page: parseInt(page), limit: parseInt(limit) });
});

export const acceptBooking = asyncHandler(async (request, reply) => {
  const lab = await getOwnedLab(request.user._id);
  if (!lab) {
    const err = Errors.NOT_FOUND('Lab');
    return reply.code(err.statusCode).send(err.toRFC7807());
  }
  const booking = await Booking.findOne({ _id: request.params.id, lab: lab._id });
  if (!booking) {
    const err = Errors.BOOKING_NOT_FOUND(`/partner/bookings/${request.params.id}`);
    return reply.code(err.statusCode).send(err.toRFC7807());
  }
  if (!VALID_TRANSITIONS[booking.status]?.includes('CONFIRMED')) {
    const err = Errors.INVALID_BOOKING_TRANSITION(`Cannot confirm a ${booking.status} booking`);
    return reply.code(err.statusCode).send(err.toRFC7807());
  }
  booking.status = 'CONFIRMED';
  await booking.save();
  return reply.code(200).send({ booking });
});

export const rejectBooking = asyncHandler(async (request, reply) => {
  const lab = await getOwnedLab(request.user._id);
  if (!lab) {
    const err = Errors.NOT_FOUND('Lab');
    return reply.code(err.statusCode).send(err.toRFC7807());
  }
  const booking = await Booking.findOne({ _id: request.params.id, lab: lab._id });
  if (!booking) {
    const err = Errors.BOOKING_NOT_FOUND(`/partner/bookings/${request.params.id}`);
    return reply.code(err.statusCode).send(err.toRFC7807());
  }
  if (!VALID_TRANSITIONS[booking.status]?.includes('CANCELLED')) {
    const err = Errors.INVALID_BOOKING_TRANSITION(`Cannot reject a ${booking.status} booking`);
    return reply.code(err.statusCode).send(err.toRFC7807());
  }
  booking.status = 'CANCELLED';
  booking.cancelReason = request.body?.reason || 'Rejected by lab';
  await booking.save();
  return reply.code(200).send({ booking });
});

export const reassignAssistant = asyncHandler(async (request, reply) => {
  const lab = await getOwnedLab(request.user._id);
  if (!lab) {
    const err = Errors.NOT_FOUND('Lab');
    return reply.code(err.statusCode).send(err.toRFC7807());
  }
  const { assistantId } = request.body;
  const booking = await Booking.findOne({ _id: request.params.id, lab: lab._id });
  if (!booking) {
    const err = Errors.BOOKING_NOT_FOUND(`/partner/bookings/${request.params.id}`);
    return reply.code(err.statusCode).send(err.toRFC7807());
  }
  const assistant = await LabAssistant.findOne({ _id: assistantId, lab: lab._id, isActive: true });
  if (!assistant) {
    const err = Errors.ASSISTANT_UNAVAILABLE();
    return reply.code(err.statusCode).send(err.toRFC7807());
  }
  booking.labAssistant = assistantId;
  await booking.save();
  return reply.code(200).send({ booking });
});

export const uploadReport = asyncHandler(async (request, reply) => {
  const lab = await getOwnedLab(request.user._id);
  if (!lab) {
    const err = Errors.NOT_FOUND('Lab');
    return reply.code(err.statusCode).send(err.toRFC7807());
  }
  const data = await request.file();
  if (!data) {
    const err = Errors.VALIDATION_ERROR('No file uploaded');
    return reply.code(err.statusCode).send(err.toRFC7807());
  }
  if (data.mimetype !== 'application/pdf') {
    const err = Errors.INVALID_FILE_TYPE();
    return reply.code(err.statusCode).send(err.toRFC7807());
  }

  const chunks = [];
  let totalSize = 0;
  const MAX_SIZE = 10 * 1024 * 1024;
  for await (const chunk of data.file) {
    totalSize += chunk.length;
    if (totalSize > MAX_SIZE) {
      const err = Errors.FILE_TOO_LARGE();
      return reply.code(err.statusCode).send(err.toRFC7807());
    }
    chunks.push(chunk);
  }
  const buffer = Buffer.concat(chunks);
  const checksum = crypto.createHash('sha256').update(buffer).digest('hex');
  const bookingId = data.fields?.bookingId?.value || 'tmp';
  const filePath = `reports/${bookingId}/${Date.now()}.pdf`;

  await storage.uploadBuffer(buffer, filePath, 'application/pdf');

  return reply.code(200).send({ uri: filePath, checksum });
});

export const linkReport = asyncHandler(async (request, reply) => {
  const lab = await getOwnedLab(request.user._id);
  if (!lab) {
    const err = Errors.NOT_FOUND('Lab');
    return reply.code(err.statusCode).send(err.toRFC7807());
  }
  const booking = await Booking.findOne({ _id: request.params.id, lab: lab._id });
  if (!booking) {
    const err = Errors.BOOKING_NOT_FOUND(`/partner/bookings/${request.params.id}/report`);
    return reply.code(err.statusCode).send(err.toRFC7807());
  }
  const { uri, checksum, testId } = request.body;
  const report = await Report.create({
    booking: booking._id,
    test: testId || booking.tests[0],
    file: { uri, storageProvider: 'FIREBASE', checksum },
    issuedAt: new Date(),
    isAccessible: true,
  });
  booking.report = report._id;
  booking.status = 'COMPLETED';
  await booking.save();
  return reply.code(201).send({ report });
});

export const listAssistants = asyncHandler(async (request, reply) => {
  const lab = await getOwnedLab(request.user._id);
  if (!lab) {
    const err = Errors.NOT_FOUND('Lab');
    return reply.code(err.statusCode).send(err.toRFC7807());
  }
  const assistants = await LabAssistant.find({ lab: lab._id, isActive: true });
  return reply.code(200).send({ assistants });
});

export const createAssistant = asyncHandler(async (request, reply) => {
  const lab = await getOwnedLab(request.user._id);
  if (!lab) {
    const err = Errors.NOT_FOUND('Lab');
    return reply.code(err.statusCode).send(err.toRFC7807());
  }
  const { name, phone, userId } = request.body;
  const assistant = await LabAssistant.create({
    lab: lab._id,
    user: userId || request.user._id,
    name,
    phone,
  });
  return reply.code(201).send({ assistant });
});

export const updateAssistant = asyncHandler(async (request, reply) => {
  const lab = await getOwnedLab(request.user._id);
  if (!lab) {
    const err = Errors.NOT_FOUND('Lab');
    return reply.code(err.statusCode).send(err.toRFC7807());
  }
  const assistant = await LabAssistant.findOneAndUpdate(
    { _id: request.params.id, lab: lab._id },
    request.body,
    { new: true },
  );
  if (!assistant) {
    const err = Errors.NOT_FOUND('Assistant');
    return reply.code(err.statusCode).send(err.toRFC7807());
  }
  return reply.code(200).send({ assistant });
});

export const setAssistantAvailability = asyncHandler(async (request, reply) => {
  const lab = await getOwnedLab(request.user._id);
  if (!lab) {
    const err = Errors.NOT_FOUND('Lab');
    return reply.code(err.statusCode).send(err.toRFC7807());
  }
  const assistant = await LabAssistant.findOneAndUpdate(
    { _id: request.params.id, lab: lab._id },
    { availability: request.body },
    { new: true },
  );
  if (!assistant) {
    const err = Errors.NOT_FOUND('Assistant');
    return reply.code(err.statusCode).send(err.toRFC7807());
  }
  return reply.code(200).send({ assistant });
});

export const getAnalyticsOverview = asyncHandler(async (request, reply) => {
  const lab = await getOwnedLab(request.user._id);
  if (!lab) {
    const err = Errors.NOT_FOUND('Lab');
    return reply.code(err.statusCode).send(err.toRFC7807());
  }
  const [totalBookings, completedBookings, cancelledBookings, revenueResult] = await Promise.all([
    Booking.countDocuments({ lab: lab._id }),
    Booking.countDocuments({ lab: lab._id, status: 'COMPLETED' }),
    Booking.countDocuments({ lab: lab._id, status: 'CANCELLED' }),
    Booking.aggregate([
      { $match: { lab: lab._id, status: 'COMPLETED' } },
      { $group: { _id: null, total: { $sum: '$totalAmount' } } },
    ]),
  ]);
  const topTests = await Booking.aggregate([
    { $match: { lab: lab._id, status: { $in: ['CONFIRMED', 'COMPLETED'] } } },
    { $unwind: '$tests' },
    { $group: { _id: '$tests', count: { $sum: 1 } } },
    { $sort: { count: -1 } },
    { $limit: 5 },
    { $lookup: { from: 'tests', localField: '_id', foreignField: '_id', as: 'test' } },
    { $unwind: '$test' },
    { $project: { name: '$test.name', count: 1 } },
  ]);
  return reply.code(200).send({
    totalBookings,
    completedBookings,
    cancelledBookings,
    totalRevenue: revenueResult[0]?.total || 0,
    topTests,
  });
});

export const getRevenueAnalytics = asyncHandler(async (request, reply) => {
  const lab = await getOwnedLab(request.user._id);
  if (!lab) {
    const err = Errors.NOT_FOUND('Lab');
    return reply.code(err.statusCode).send(err.toRFC7807());
  }
  const { from, to } = request.query;
  const matchStage = { lab: lab._id, status: 'COMPLETED' };
  if (from || to) {
    matchStage.createdAt = {};
    if (from) matchStage.createdAt.$gte = new Date(from);
    if (to)   matchStage.createdAt.$lte = new Date(to);
  }
  const revenue = await Booking.aggregate([
    { $match: matchStage },
    {
      $group: {
        _id:     { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
        revenue: { $sum: '$totalAmount' },
        count:   { $sum: 1 },
      },
    },
    { $sort: { _id: 1 } },
  ]);
  return reply.code(200).send({ revenue });
});

export const getSlotsAnalytics = asyncHandler(async (request, reply) => {
  const lab = await getOwnedLab(request.user._id);
  if (!lab) {
    const err = Errors.NOT_FOUND('Lab');
    return reply.code(err.statusCode).send(err.toRFC7807());
  }
  const peakSlots = await Booking.aggregate([
    { $match: { lab: lab._id, status: { $in: ['CONFIRMED', 'COMPLETED'] } } },
    { $group: { _id: '$slot.start', count: { $sum: 1 } } },
    { $sort: { count: -1 } },
    { $limit: 10 },
  ]);
  return reply.code(200).send({ peakSlots });
});

export const getCustomerHistory = asyncHandler(async (request, reply) => {
  const lab = await getOwnedLab(request.user._id);
  if (!lab) {
    const err = Errors.NOT_FOUND('Lab');
    return reply.code(err.statusCode).send(err.toRFC7807());
  }
  const bookings = await Booking.find({ lab: lab._id, user: request.params.customerId })
    .populate('tests', 'name price')
    .populate('report')
    .sort({ createdAt: -1 });
  return reply.code(200).send({ bookings });
});
