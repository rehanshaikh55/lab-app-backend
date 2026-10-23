import Ticket from '../models/ticket.js';
import { storage } from '../integrations/storage/storage.js';
import { Errors } from '../common/errors.js';
import { readUploadBuffer } from './_shared/readUpload.js';

const MAX_PRESCRIPTION_SIZE = 10 * 1024 * 1024;
const EXT_BY_MIME = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/heic': 'heic', 'image/heif': 'heif', 'image/jpg': 'jpg' };
const MAX_NOTE_LENGTH = 500;
const DEFAULT_NOTE = 'Please add the tests on my prescription.';

export const uploadPrescription = async ({ userId, fileData }) => {
  if (!fileData) throw Errors.VALIDATION_ERROR('No file uploaded');
  const ext = EXT_BY_MIME[fileData.mimetype];
  if (!ext) throw Errors.INVALID_FILE_TYPE('Please upload a JPG, PNG, HEIC or HEIF photo of your prescription.');

  const buffer = await readUploadBuffer(fileData, MAX_PRESCRIPTION_SIZE);
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
      text: note ? note.slice(0, MAX_NOTE_LENGTH) : DEFAULT_NOTE,
      attachments: [{ uri }],
    }],
  });
  return { _id: ticket._id, state: ticket.state, category: ticket.category };
};
