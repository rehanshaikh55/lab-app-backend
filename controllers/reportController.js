import Report from '../models/report.js';
import { storage } from '../integrations/storage/storage.js';
import { Errors } from '../common/errors.js';
import { asyncHandler } from '../utils/asyncHandler.js';

export const getReport = asyncHandler(async (request, reply) => {
  const report = await Report.findById(request.params.id).populate('booking');
  if (!report || !report.isAccessible) {
    const err = Errors.REPORT_ACCESS_DENIED();
    return reply.code(err.statusCode).send(err.toRFC7807());
  }
  // Verify user owns the booking
  if (report.booking.user.toString() !== request.user._id.toString()) {
    const err = Errors.REPORT_ACCESS_DENIED();
    return reply.code(err.statusCode).send(err.toRFC7807());
  }
  const signedUrl = await storage.getSignedUrl(report.file.uri);
  return reply.code(200).send({ signedUrl, issuedAt: report.issuedAt });
});
