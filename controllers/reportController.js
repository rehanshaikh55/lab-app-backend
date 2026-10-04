import * as reportService from '../services/reportService.js';
import { asyncHandler } from '../utils/asyncHandler.js';

export const getReport = asyncHandler(async (request, reply) =>
  reply.code(200).send(await reportService.getReportForUser({
    userId: request.user._id,
    reportId: request.params.id,
  })));

export const setRetestReminder = asyncHandler(async (request, reply) =>
  reply.code(200).send(await reportService.setRetestReminder({
    userId: request.user._id,
    reportId: request.params.id,
    intervalDays: request.body.intervalDays,
  })));

export const replaceReport = asyncHandler(async (request, reply) =>
  reply.code(200).send({
    report: await reportService.replaceReport({
      userId: request.user._id,
      oldReportId: request.params.reportId,
      ...request.body,
    }),
  }));
