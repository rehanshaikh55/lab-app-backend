import crypto from 'crypto';
import Booking from '../models/booking.js';
import Lab from '../models/lab.js';
import LabAssistant from '../models/labAssistant.js';
import { storage } from '../integrations/storage/storage.js';
import { Errors } from '../common/errors.js';
import { assertTransition, buildTimeline } from './_shared/transitions.js';
import { recordEvent } from './_shared/events.js';
import { releaseSlot } from './slotCapacityService.js';
import { linkReport as linkReportDoc } from './reportService.js';
import { notifyBookingStatus } from './notificationService.js';

const MAX_REPORT_SIZE = 10 * 1024 * 1024;

const withTimeline = (b) => {
  if (!b) return b;
  const obj = typeof b.toObject === 'function' ? b.toObject({ virtuals: true }) : b;
  return { ...obj, timeline: buildTimeline(obj.status) };
};

export const getOwnedLab = async (userId) => {
  const lab = await Lab.findOne({ owner: userId, isActive: true });
  if (!lab) throw Errors.NOT_FOUND('Lab');
  return lab;
};

const findOwnedBooking = async (userId, bookingId, instance) => {
  const lab = await getOwnedLab(userId);
  const booking = await Booking.findOne({ _id: bookingId, lab: lab._id });
  if (!booking) throw Errors.BOOKING_NOT_FOUND(instance);
  return { lab, booking };
};

export const getDailyBookings = async (userId) => {
  const lab = await getOwnedLab(userId);
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
  return { bookings: bookings.map(withTimeline), date: today.toISOString().split('T')[0] };
};

export const getPartnerBookings = async ({ userId, status, page = 1, limit = 20 }) => {
  const lab = await getOwnedLab(userId);
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
  return {
    bookings: bookings.map(withTimeline),
    total,
    page: parseInt(page),
    limit: parseInt(limit),
  };
};

export const getTodaySummary = async (userId) => {
  const lab = await getOwnedLab(userId);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const match = { lab: lab._id, scheduledDate: { $gte: today, $lt: tomorrow } };
  const [total, pending, inProgress, done, requests] = await Promise.all([
    Booking.countDocuments(match),
    Booking.countDocuments({ ...match, status: 'PENDING' }),
    Booking.countDocuments({ ...match, status: { $in: ['CONFIRMED', 'COLLECTED', 'PROCESSING'] } }),
    Booking.countDocuments({ ...match, status: 'COMPLETED' }),
    Booking.find({ ...match, status: 'PENDING' })
      .populate('user', 'name phone')
      .populate('tests', 'name price')
      .sort({ createdAt: 1 })
      .limit(10),
  ]);
  return {
    lab: { id: lab._id, name: lab.name },
    stats: { total, pending, inProgress, done },
    requests: requests.map(withTimeline),
  };
};

export const acceptBooking = async ({ userId, bookingId }) => {
  const { booking } = await findOwnedBooking(userId, bookingId, `/partner/bookings/${bookingId}`);
  assertTransition(booking.status, 'CONFIRMED', `Cannot confirm a ${booking.status} booking`);
  const fromStatus = booking.status;
  booking.status = 'CONFIRMED';
  await booking.save();
  await recordEvent({ booking, fromStatus, toStatus: 'CONFIRMED', actorType: 'LAB_OWNER', actorId: userId });
  notifyBookingStatus(booking).catch(() => {});
  return withTimeline(booking);
};

export const rejectBooking = async ({ userId, bookingId, reason }) => {
  const { booking } = await findOwnedBooking(userId, bookingId, `/partner/bookings/${bookingId}`);
  assertTransition(booking.status, 'CANCELLED', `Cannot reject a ${booking.status} booking`);
  const fromStatus = booking.status;
  booking.status = 'CANCELLED';
  booking.cancelBy = 'LAB';
  booking.cancelReason = reason || 'Rejected by lab';
  await booking.save();
  await recordEvent({ booking, fromStatus, toStatus: 'CANCELLED', actorType: 'LAB_OWNER', actorId: userId, reason: booking.cancelReason });
  await releaseSlot({ labId: booking.lab, scheduledDate: booking.scheduledDate, slotStart: booking.slot.start });
  notifyBookingStatus(booking).catch(() => {});
  return withTimeline(booking);
};

const advance = async ({ userId, bookingId, toStatus, allowedFrom }) => {
  const { booking } = await findOwnedBooking(userId, bookingId, `/partner/bookings/${bookingId}`);
  if (!allowedFrom.includes(booking.status)) {
    throw Errors.INVALID_BOOKING_TRANSITION(`Cannot move booking from ${booking.status} to ${toStatus}`);
  }
  assertTransition(booking.status, toStatus, `Cannot move booking from ${booking.status} to ${toStatus}`);
  const fromStatus = booking.status;
  booking.status = toStatus;
  await booking.save();
  await recordEvent({ booking, fromStatus, toStatus, actorType: 'LAB_OWNER', actorId: userId });
  notifyBookingStatus(booking).catch(() => {});
  return withTimeline(booking);
};

export const markCollected  = (args) => advance({ ...args, toStatus: 'COLLECTED',  allowedFrom: ['CONFIRMED'] });
export const markProcessing = (args) => advance({ ...args, toStatus: 'PROCESSING', allowedFrom: ['COLLECTED'] });

export const reassignAssistant = async ({ userId, bookingId, assistantId }) => {
  const { lab, booking } = await findOwnedBooking(userId, bookingId, `/partner/bookings/${bookingId}`);
  const assistant = await LabAssistant.findOne({ _id: assistantId, lab: lab._id, isActive: true });
  if (!assistant) throw Errors.ASSISTANT_UNAVAILABLE();
  const fromStatus = booking.status;
  booking.labAssistant = assistantId;
  if (!booking.visitOtp) {
    booking.visitOtp = String(crypto.randomInt(1000, 9999));
  }
  if (booking.status === 'CONFIRMED') {
    assertTransition(booking.status, 'ASSISTANT_ASSIGNED');
    booking.status = 'ASSISTANT_ASSIGNED';
  }
  await booking.save();
  if (booking.status !== fromStatus) {
    await recordEvent({ booking, fromStatus, toStatus: booking.status, actorType: 'LAB_OWNER', actorId: userId });
  }
  return withTimeline(booking);
};

export const uploadReportFile = async ({ userId, fileData }) => {
  await getOwnedLab(userId);
  if (!fileData) throw Errors.VALIDATION_ERROR('No file uploaded');
  if (fileData.mimetype !== 'application/pdf') throw Errors.INVALID_FILE_TYPE();
  const chunks = [];
  let total = 0;
  for await (const chunk of fileData.file) {
    total += chunk.length;
    if (total > MAX_REPORT_SIZE) throw Errors.FILE_TOO_LARGE();
    chunks.push(chunk);
  }
  const buffer = Buffer.concat(chunks);
  const checksum = crypto.createHash('sha256').update(buffer).digest('hex');
  const bookingId = fileData.fields?.bookingId?.value || 'tmp';
  const filePath = `reports/${bookingId}/${Date.now()}.pdf`;
  await storage.uploadBuffer(buffer, filePath, 'application/pdf');
  return { uri: filePath, checksum };
};

export const linkReport = async ({ userId, bookingId, uri, checksum, testId, parameters }) => {
  const { booking } = await findOwnedBooking(userId, bookingId, `/partner/bookings/${bookingId}/report`);
  const report = await linkReportDoc({ booking, uri, checksum, testId, parameters });
  notifyBookingStatus(booking).catch(() => {});
  return report;
};

export const listAssistants = async (userId) => {
  const lab = await getOwnedLab(userId);
  return LabAssistant.find({ lab: lab._id, isActive: true });
};

export const createAssistant = async ({ userId, name, phone, assistantUserId }) => {
  const lab = await getOwnedLab(userId);
  return LabAssistant.create({
    lab: lab._id,
    user: assistantUserId || userId,
    name,
    phone,
  });
};

export const updateAssistant = async ({ userId, assistantId, update }) => {
  const lab = await getOwnedLab(userId);
  const assistant = await LabAssistant.findOneAndUpdate(
    { _id: assistantId, lab: lab._id },
    update,
    { new: true },
  );
  if (!assistant) throw Errors.NOT_FOUND('Assistant');
  return assistant;
};

export const setAssistantAvailability = async ({ userId, assistantId, availability }) => {
  const lab = await getOwnedLab(userId);
  const assistant = await LabAssistant.findOneAndUpdate(
    { _id: assistantId, lab: lab._id },
    { availability },
    { new: true },
  );
  if (!assistant) throw Errors.NOT_FOUND('Assistant');
  return assistant;
};

export const getAnalyticsOverview = async (userId) => {
  const lab = await getOwnedLab(userId);
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
    { $match: { lab: lab._id, status: { $in: ['CONFIRMED', 'COLLECTED', 'PROCESSING', 'COMPLETED'] } } },
    { $unwind: '$tests' },
    { $group: { _id: '$tests', count: { $sum: 1 } } },
    { $sort: { count: -1 } },
    { $limit: 5 },
    { $lookup: { from: 'tests', localField: '_id', foreignField: '_id', as: 'test' } },
    { $unwind: '$test' },
    { $project: { name: '$test.name', count: 1 } },
  ]);
  return {
    totalBookings,
    completedBookings,
    cancelledBookings,
    totalRevenue: revenueResult[0]?.total || 0,
    topTests,
  };
};

export const getRevenueAnalytics = async ({ userId, from, to }) => {
  const lab = await getOwnedLab(userId);
  const match = { lab: lab._id, status: 'COMPLETED' };
  if (from || to) {
    match.createdAt = {};
    if (from) match.createdAt.$gte = new Date(from);
    if (to) match.createdAt.$lte = new Date(to);
  }
  const revenue = await Booking.aggregate([
    { $match: match },
    {
      $group: {
        _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
        revenue: { $sum: '$totalAmount' },
        count: { $sum: 1 },
      },
    },
    { $sort: { _id: 1 } },
  ]);
  return { revenue };
};

export const getSlotsAnalytics = async (userId) => {
  const lab = await getOwnedLab(userId);
  const peakSlots = await Booking.aggregate([
    { $match: { lab: lab._id, status: { $in: ['CONFIRMED', 'COLLECTED', 'PROCESSING', 'COMPLETED'] } } },
    { $group: { _id: '$slot.start', count: { $sum: 1 } } },
    { $sort: { count: -1 } },
    { $limit: 10 },
  ]);
  return { peakSlots };
};

export const getCustomerHistory = async ({ userId, customerId }) => {
  const lab = await getOwnedLab(userId);
  const bookings = await Booking.find({ lab: lab._id, user: customerId })
    .populate('tests', 'name price')
    .populate('reports.report')
    .sort({ createdAt: -1 });
  return { bookings: bookings.map(withTimeline) };
};
