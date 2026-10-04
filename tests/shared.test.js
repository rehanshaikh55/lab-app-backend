import { test } from 'node:test';
import assert from 'node:assert/strict';
import { canTransition, assertTransition, VALID_TRANSITIONS } from '../services/_shared/transitions.js';
import { dayKey, weekdayName, addMinutes } from '../services/_shared/slotTime.js';

test('valid transitions', () => {
  assert.equal(canTransition('PENDING', 'CONFIRMED'), true);
  assert.equal(canTransition('CONFIRMED', 'COLLECTED'), true);
  assert.equal(canTransition('COMPLETED', 'CANCELLED'), false);
});

test('assertTransition throws DomainError on invalid', () => {
  assert.throws(() => assertTransition('COMPLETED', 'CANCELLED'), /INVALID_BOOKING_TRANSITION|Cannot move/);
});

test('slot time helpers', () => {
  assert.equal(addMinutes('10:00', 30), '10:30');
  assert.equal(addMinutes('09:45', 30), '10:15');
  assert.equal(dayKey('2026-05-28T10:00:00.000Z'), '2026-05-28');
  // Construct via local Y/M/D so weekday is TZ-independent (May 28 2026 is a Thursday).
  assert.equal(weekdayName(new Date(2026, 4, 28)), 'thursday');
});
