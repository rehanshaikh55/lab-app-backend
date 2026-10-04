import * as partnerService from '../services/partnerService.js';
import * as reportService from '../services/reportService.js';
import { asyncHandler } from '../utils/asyncHandler.js';

export const getDailyBookings = asyncHandler(async (req, reply) =>
  reply.code(200).send(await partnerService.getDailyBookings(req.user._id)));

export const getPartnerBookings = asyncHandler(async (req, reply) =>
  reply.code(200).send(await partnerService.getPartnerBookings({
    userId: req.user._id,
    ...req.query,
  })));

export const getToday = asyncHandler(async (req, reply) =>
  reply.code(200).send(await partnerService.getTodaySummary(req.user._id)));

export const acceptBooking = asyncHandler(async (req, reply) =>
  reply.code(200).send({
    booking: await partnerService.acceptBooking({
      userId: req.user._id,
      bookingId: req.params.id,
    }),
  }));

export const rejectBooking = asyncHandler(async (req, reply) =>
  reply.code(200).send({
    booking: await partnerService.rejectBooking({
      userId: req.user._id,
      bookingId: req.params.id,
      reason: req.body?.reason,
    }),
  }));

export const markCollected = asyncHandler(async (req, reply) =>
  reply.code(200).send({
    booking: await partnerService.markCollected({
      userId: req.user._id,
      bookingId: req.params.id,
    }),
  }));

export const markProcessing = asyncHandler(async (req, reply) =>
  reply.code(200).send({
    booking: await partnerService.markProcessing({
      userId: req.user._id,
      bookingId: req.params.id,
    }),
  }));

export const reassignAssistant = asyncHandler(async (req, reply) =>
  reply.code(200).send({
    booking: await partnerService.reassignAssistant({
      userId: req.user._id,
      bookingId: req.params.id,
      assistantId: req.body.assistantId,
    }),
  }));

export const uploadReport = asyncHandler(async (req, reply) =>
  reply.code(200).send(await partnerService.uploadReportFile({
    userId: req.user._id,
    fileData: await req.file(),
  })));

export const linkReport = asyncHandler(async (req, reply) =>
  reply.code(201).send({
    report: await partnerService.linkReport({
      userId: req.user._id,
      bookingId: req.params.id,
      ...req.body,
    }),
  }));

export const listAssistants = asyncHandler(async (req, reply) =>
  reply.code(200).send({ assistants: await partnerService.listAssistants(req.user._id) }));

export const createAssistant = asyncHandler(async (req, reply) =>
  reply.code(201).send({
    assistant: await partnerService.createAssistant({
      userId: req.user._id,
      name: req.body.name,
      phone: req.body.phone,
      assistantUserId: req.body.userId,
    }),
  }));

export const updateAssistant = asyncHandler(async (req, reply) =>
  reply.code(200).send({
    assistant: await partnerService.updateAssistant({
      userId: req.user._id,
      assistantId: req.params.id,
      update: req.body,
    }),
  }));

export const setAssistantAvailability = asyncHandler(async (req, reply) =>
  reply.code(200).send({
    assistant: await partnerService.setAssistantAvailability({
      userId: req.user._id,
      assistantId: req.params.id,
      availability: req.body,
    }),
  }));

export const getAnalyticsOverview = asyncHandler(async (req, reply) =>
  reply.code(200).send(await partnerService.getAnalyticsOverview(req.user._id)));

export const getRevenueAnalytics = asyncHandler(async (req, reply) =>
  reply.code(200).send(await partnerService.getRevenueAnalytics({
    userId: req.user._id,
    ...req.query,
  })));

export const getSlotsAnalytics = asyncHandler(async (req, reply) =>
  reply.code(200).send(await partnerService.getSlotsAnalytics(req.user._id)));

export const getCustomerHistory = asyncHandler(async (req, reply) =>
  reply.code(200).send(await partnerService.getCustomerHistory({
    userId: req.user._id,
    customerId: req.params.customerId,
  })));

export const getTatBoard = asyncHandler(async (req, reply) =>
  reply.code(200).send(await reportService.getTatBoard(req.user._id)));
