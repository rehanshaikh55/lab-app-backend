import SlotCapacity from '../models/slotCapacity.js';
import { Errors } from '../common/errors.js';
import { dayKey } from './_shared/slotTime.js';

export const reserveSlot = async ({ labId, scheduledDate, slotStart, maxPerSlot }) => {
  const day = dayKey(scheduledDate);
  const key = { lab: labId, day, slotStart };

  // Ensure the counter document exists (idempotent; ignore concurrent-insert dup-key).
  try {
    await SlotCapacity.updateOne(key, { $setOnInsert: { count: 0 } }, { upsert: true });
  } catch (e) {
    if (e?.code !== 11000) throw e;
  }

  // Atomic guarded increment: only succeeds if count < max.
  const updated = await SlotCapacity.findOneAndUpdate(
    { ...key, count: { $lt: maxPerSlot } },
    { $inc: { count: 1 } },
    { new: true },
  );

  if (!updated) {
    throw Errors.SLOT_UNAVAILABLE(`The ${slotStart} slot on ${day} is fully booked`, '/bookings');
  }
  return updated;
};

export const releaseSlot = async ({ labId, scheduledDate, slotStart }) => {
  const day = dayKey(scheduledDate);
  await SlotCapacity.findOneAndUpdate(
    { lab: labId, day, slotStart, count: { $gt: 0 } },
    { $inc: { count: -1 } },
  );
};
