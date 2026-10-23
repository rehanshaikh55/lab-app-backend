import { test, before, after, beforeEach, mock } from 'node:test';
import assert from 'node:assert/strict';
import bcrypt from 'bcryptjs';
import { setupTestApp, teardownTestApp } from './helpers/buildApp.js';
import { storage } from '../integrations/storage/storage.js';
import User from '../models/user.js';
import Ticket from '../models/ticket.js';
import Lab from '../models/lab.js';
import { Errors } from '../common/errors.js';

let app, token, customer, uploadMock;

before(async () => { app = await setupTestApp(); });
after(async () => { mock.restoreAll(); await teardownTestApp(app); });

const BOUNDARY = '----labzytestboundary';
const multipart = ({ file, note }) => {
  const parts = [];
  if (note !== undefined) {
    parts.push(Buffer.from(`--${BOUNDARY}\r\nContent-Disposition: form-data; name="note"\r\n\r\n${note}\r\n`));
  }
  if (file) {
    parts.push(Buffer.from(`--${BOUNDARY}\r\nContent-Disposition: form-data; name="file"; filename="${file.name}"\r\nContent-Type: ${file.type}\r\n\r\n`));
    parts.push(file.data, Buffer.from('\r\n'));
  }
  parts.push(Buffer.from(`--${BOUNDARY}--\r\n`));
  return Buffer.concat(parts);
};

const post = (body, auth = true) => app.inject({
  method: 'POST', url: '/api/me/prescriptions',
  headers: {
    'content-type': `multipart/form-data; boundary=${BOUNDARY}`,
    ...(auth ? { authorization: `Bearer ${token}` } : {}),
  },
  payload: body,
});

beforeEach(async () => {
  await Promise.all([User.deleteMany({}), Ticket.deleteMany({}), Lab.deleteMany({})]);
  customer = await User.create({ name: 'Cust', email: 'rx-cust@x.com', roles: ['CUSTOMER'], passwordHash: await bcrypt.hash('pass123', 12) });
  const login = await app.inject({ method: 'POST', url: '/api/auth/login', payload: { email: 'rx-cust@x.com', password: 'pass123' } });
  token = login.json().accessToken;
  mock.restoreAll();
  uploadMock = mock.method(storage, 'uploadBuffer', async () => {});
});

test('PNG upload creates a HIGH priority PRESCRIPTION ticket with one attachment', async () => {
  const res = await post(multipart({ file: { name: 'rx.png', type: 'image/png', data: Buffer.from('png-bytes') }, note: 'Dr. Rao' }));
  assert.equal(res.statusCode, 201);
  const body = res.json();
  assert.equal(body.ticket.state, 'OPEN');
  assert.equal(body.ticket.category, 'PRESCRIPTION');
  const row = await Ticket.findById(body.ticket._id);
  assert.equal(row.priority, 'HIGH');
  assert.equal(row.subject, 'Prescription uploaded');
  assert.equal(row.messages.length, 1);
  assert.equal(row.messages[0].text, 'Dr. Rao');
  assert.equal(row.messages[0].fromRole, 'CUSTOMER');
  assert.equal(row.messages[0].attachments.length, 1);
  const [buf, path, mime] = uploadMock.mock.calls[0].arguments;
  assert.equal(buf.toString(), 'png-bytes');
  assert.ok(path.startsWith(`prescriptions/${customer._id}/`));
  assert.ok(/\/\d+\.png$/.test(path));
  assert.equal(mime, 'image/png');
  assert.equal(row.messages[0].attachments[0].uri, path);
});

test('default message text when no note is given', async () => {
  const res = await post(multipart({ file: { name: 'rx.jpg', type: 'image/jpeg', data: Buffer.from('x') } }));
  assert.equal(res.statusCode, 201);
  const row = await Ticket.findById(res.json().ticket._id);
  assert.equal(row.messages[0].text, 'Please add the tests on my prescription.');
});

test('application/pdf is rejected with INVALID_FILE_TYPE', async () => {
  const res = await post(multipart({ file: { name: 'rx.pdf', type: 'application/pdf', data: Buffer.from('%PDF') } }));
  assert.equal(res.statusCode, Errors.INVALID_FILE_TYPE().statusCode);
  assert.match(res.body, /INVALID_FILE_TYPE/);
  assert.equal(uploadMock.mock.callCount(), 0);
});

test('11 MB file is rejected with FILE_TOO_LARGE', async () => {
  const res = await post(multipart({ file: { name: 'rx.png', type: 'image/png', data: Buffer.alloc(11 * 1024 * 1024, 1) } }));
  assert.equal(res.statusCode, Errors.FILE_TOO_LARGE().statusCode);
  assert.match(res.body, /FILE_TOO_LARGE/);
  assert.equal(uploadMock.mock.callCount(), 0);
  assert.equal(await Ticket.countDocuments({}), 0);
});

test('missing auth returns 401', async () => {
  const res = await post(multipart({ file: { name: 'rx.png', type: 'image/png', data: Buffer.from('x') } }), false);
  assert.equal(res.statusCode, 401);
});

test('wrong file type uses a prescription-specific detail', async () => {
  const res = await post(multipart({ file: { name: 'rx.pdf', type: 'application/pdf', data: Buffer.from('%PDF') } }));
  assert.equal(res.json().detail, 'Please upload a JPG, PNG or HEIC photo of your prescription.');
});

test('request without a file part returns 400 VALIDATION_ERROR', async () => {
  const res = await post(multipart({ note: 'just a note' }));
  assert.equal(res.statusCode, 400);
  assert.match(res.body, /VALIDATION_ERROR/);
  assert.equal(await Ticket.countDocuments({}), 0);
});

test('note is truncated to 500 characters', async () => {
  const res = await post(multipart({ note: 'a'.repeat(600), file: { name: 'rx.png', type: 'image/png', data: Buffer.from('x') } }));
  assert.equal(res.statusCode, 201);
  const row = await Ticket.findById(res.json().ticket._id);
  assert.equal(row.messages[0].text.length, 500);
});

test('partner report upload over 10 MB returns FILE_TOO_LARGE', async () => {
  const owner = await User.create({ name: 'Owner', email: 'rx-owner@x.com', roles: ['LAB_OWNER'], passwordHash: await bcrypt.hash('pass123', 12) });
  await Lab.create({
    owner: owner._id, name: 'Lab A', location: { type: 'Point', coordinates: [77.5, 12.9] },
    slotMatrix: { duration: 30, intervalMinutes: 30, maxBookingsPerSlot: 5 }, isActive: true, isVerified: true,
  });
  const login = await app.inject({ method: 'POST', url: '/api/auth/login', payload: { email: 'rx-owner@x.com', password: 'pass123' } });
  const res = await app.inject({
    method: 'POST', url: '/api/partner/reports/upload',
    headers: { 'content-type': `multipart/form-data; boundary=${BOUNDARY}`, authorization: `Bearer ${login.json().accessToken}` },
    payload: multipart({ file: { name: 'r.pdf', type: 'application/pdf', data: Buffer.alloc(11 * 1024 * 1024, 1) } }),
  });
  assert.equal(res.statusCode, 413);
  assert.match(res.body, /FILE_TOO_LARGE/);
});
