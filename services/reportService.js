import Report from '../models/report.js';
import Booking from '../models/booking.js';
import Lab from '../models/lab.js';
import { storage } from '../integrations/storage/storage.js';
import { Errors } from '../common/errors.js';
import { notify } from './notificationService.js';
import { assertTransition } from './_shared/transitions.js';
import { recordEvent } from './_shared/events.js';

// Duplicated here (rather than importing partnerService.js's getOwnedLab) to avoid a circular
// import: partnerService.js already imports linkReport from this module at module scope, so a
// static top-level import of partnerService.js from here would create a real cycle.
const getOwnedLab = async (userId) => {
  const lab = await Lab.findOne({ owner: userId, isActive: true });
  if (!lab) throw Errors.NOT_FOUND('Lab');
  return lab;
};

export const linkReport = async ({ booking, uri, checksum, testId, parameters }) => {
  const report = await Report.create({
    booking: booking._id,
    test: testId || booking.tests[0],
    file: { uri, storageProvider: 'FIREBASE', checksum },
    parameters: parameters || [],
    issuedAt: new Date(),
    isAccessible: true,
  });

  const linkedTestId = testId || booking.tests[0];
  booking.reports = booking.reports || [];
  // Replace (not duplicate) any existing entry for this test — handles re-linking a report.
  booking.reports = booking.reports.filter((r) => r.test?.toString() !== linkedTestId.toString());
  booking.reports.push({ test: linkedTestId, report: report._id });

  const allTestIds = booking.tests.map((t) => t.toString());
  const reportedTestIds = new Set(booking.reports.map((r) => r.test?.toString()));
  const allReported = allTestIds.every((id) => reportedTestIds.has(id));

  if (allReported && booking.status !== 'COMPLETED') {
    const fromStatus = booking.status;
    assertTransition(fromStatus, 'COMPLETED');
    booking.status = 'COMPLETED';
    await booking.save();
    await recordEvent({ booking, fromStatus, toStatus: 'COMPLETED', actorType: 'SYSTEM', reason: 'all-reports-linked' });
  } else {
    await booking.save();
  }

  return report;
};

export const replaceReport = async ({ userId, oldReportId, uri, checksum, parameters, reason }) => {
  if (!reason) throw Errors.VALIDATION_ERROR('A reason is required to replace a report');
  const old = await Report.findById(oldReportId).populate('booking');
  if (!old) throw Errors.NOT_FOUND('Report');
  const lab = await getOwnedLab(userId);
  if (!old.booking || old.booking.lab.toString() !== lab._id.toString()) {
    throw Errors.NOT_FOUND('Report');
  }

  const fresh = await Report.create({
    booking: old.booking._id,
    test: old.test,
    file: { uri, storageProvider: 'FIREBASE', checksum },
    parameters: parameters || [],
    issuedAt: new Date(),
    isAccessible: true,
  });

  old.isAccessible = false;
  old.replacedAt = new Date();
  old.replacedBy = fresh._id;
  old.replaceReason = reason;
  await old.save();

  const booking = old.booking;
  booking.reports = (booking.reports || []).map((r) =>
    r.report?.toString() === old._id.toString() ? { test: r.test, report: fresh._id } : r);
  await booking.save();

  // Notify the customer (booking owner) whose report changed — not the lab owner performing the replace.
  await notify({
    userId: booking.user,
    event: 'REPORT_REPLACED',
    title: 'Report updated',
    body: `Your previous report was replaced. Reason: ${reason}`,
  }).catch(() => {});

  return fresh;
};

export const getTatBoard = async (userId) => {
  const lab = await getOwnedLab(userId);
  const now = new Date();
  const items = await Booking.aggregate([
    { $match: { lab: lab._id, status: 'PROCESSING' } },
    { $lookup: { from: 'tests', localField: 'tests', foreignField: '_id', as: 'testDocs' } },
    { $addFields: { expectedAt: { $add: ['$createdAt',
        { $multiply: [{ $max: '$testDocs.turnaroundHours' }, 3600 * 1000] }] } } },
    { $addFields: {
        dueSoon: { $and: [{ $gt: ['$expectedAt', now] }, { $lt: ['$expectedAt', new Date(now.getTime() + 4 * 3600 * 1000)] }] },
        overdue: { $lt: ['$expectedAt', now] },
    } },
    { $project: { testDocs: 0 } },
    { $sort: { expectedAt: 1 } },
  ]);
  return { items };
};

export const getReportForUser = async ({ userId, reportId }) => {
  const report = await Report.findById(reportId).populate('booking');
  if (!report || !report.isAccessible) throw Errors.REPORT_ACCESS_DENIED();
  if (report.booking.user.toString() !== userId.toString()) throw Errors.REPORT_ACCESS_DENIED();
  const signedUrl = await storage.getSignedUrl(report.file.uri);
  return {
    signedUrl,
    issuedAt: report.issuedAt,
    parameters: report.parameters || [],
  };
};

export const setRetestReminder = async ({ userId, reportId, intervalDays }) => {
  const report = await Report.findById(reportId).populate('booking');
  if (!report) throw Errors.NOT_FOUND('Report');
  if (report.booking.user.toString() !== userId.toString()) throw Errors.REPORT_ACCESS_DENIED();
  report.remindRetestAt = intervalDays > 0
    ? new Date(Date.now() + intervalDays * 24 * 60 * 60 * 1000)
    : null;
  await report.save();
  return { remindRetestAt: report.remindRetestAt };
};
