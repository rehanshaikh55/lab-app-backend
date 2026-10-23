import Ticket from '../models/ticket.js';
import { storage } from '../integrations/storage/storage.js';
import { Errors } from '../common/errors.js';

const MAX_PRESCRIPTION_SIZE = 10 * 1024 * 1024;
const EXT_BY_MIME = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/heic': 'heic' };
const DEFAULT_NOTE = 'Please add the tests on my prescription.';

export const uploadPrescription = async ({ userId, fileData }) => {
  if (!fileData) throw Errors.VALIDATION_ERROR('No file uploaded');
  const ext = EXT_BY_MIME[fileData.mimetype];
  if (!ext) throw Errors.INVALID_FILE_TYPE();

  const chunks = [];
  let total = 0;
  try {
    for await (const chunk of fileData.file) {
      total += chunk.length;
      if (total > MAX_PRESCRIPTION_SIZE) throw Errors.FILE_TOO_LARGE();
      chunks.push(chunk);
    }
  } catch (err) {
    if (err?.code === 'FST_REQ_FILE_TOO_LARGE') throw Errors.FILE_TOO_LARGE();
    throw err;
  }
  if (fileData.file.truncated) throw Errors.FILE_TOO_LARGE();

  const buffer = Buffer.concat(chunks);
  const uri = `prescriptions/${userId}/${Date.now()}.${ext}`;
  await storage.uploadBuffer(buffer, uri, fileData.mimetype);

  const note = fileData.fields?.note?.value;
  const ticket = await Ticket.create({
    user: userId,
    category: 'PRESCRIPTION',
    priority: 'HIGH',
    subject: 'Prescription uploaded',
    messages: [{
      fromUserId: userId,
      fromRole: 'CUSTOMER',
      text: note || DEFAULT_NOTE,
      attachments: [{ uri }],
    }],
  });
  return { _id: ticket._id, state: ticket.state, category: ticket.category };
};
