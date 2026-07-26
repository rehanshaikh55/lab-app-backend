import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';

let mongod, reserveSlot, releaseSlot;

before(async () => {
  mongod = await MongoMemoryServer.create();
  await mongoose.connect(mongod.getUri());
  ({ reserveSlot, releaseSlot } = await import('../services/slotCapacityService.js'));
});
after(async () => { await mongoose.disconnect(); await mongod.stop(); });

test('reserve allows exactly maxPerSlot concurrent reservations', async () => {
  const labId = new mongoose.Types.ObjectId();
  const args = { labId, scheduledDate: '2026-06-01', slotStart: '10:00', maxPerSlot: 3 };
  const results = await Promise.allSettled(
    Array.from({ length: 5 }, () => reserveSlot(args)),
  );
  const ok = results.filter((r) => r.status === 'fulfilled').length;
  const failed = results.filter((r) => r.status === 'rejected').length;
  assert.equal(ok, 3);
  assert.equal(failed, 2);
});

test('release frees a slot so one more can reserve', async () => {
  const labId = new mongoose.Types.ObjectId();
  const args = { labId, scheduledDate: '2026-06-02', slotStart: '11:00', maxPerSlot: 1 };
  await reserveSlot(args);
  await assert.rejects(() => reserveSlot(args), /fully booked|SLOT_UNAVAILABLE/);
  await releaseSlot(args);
  await assert.doesNotReject(() => reserveSlot(args));
});
