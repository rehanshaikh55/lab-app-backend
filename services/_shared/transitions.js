import { Errors } from '../../common/errors.js';

export const VALID_TRANSITIONS = {
  PENDING:            ['CONFIRMED', 'CANCELLED'],
  CONFIRMED:          ['ASSISTANT_ASSIGNED', 'COLLECTED', 'RESCHEDULED', 'CANCELLED', 'NO_SHOW'],
  ASSISTANT_ASSIGNED: ['ON_THE_WAY', 'ASSISTANT_ASSIGNED', 'CANCELLED', 'NO_SHOW'],
  ON_THE_WAY:         ['ARRIVED', 'CANCELLED', 'NO_SHOW'],
  ARRIVED:            ['COLLECTED', 'NO_SHOW'],
  COLLECTED:          ['PROCESSING', 'CANCELLED'],
  PROCESSING:         ['COMPLETED'],
  COMPLETED:          [],
  RESCHEDULED:        ['CONFIRMED'],
  CANCELLED:          [],
  NO_SHOW:            [],
};

export const canTransition = (from, to) =>
  VALID_TRANSITIONS[from]?.includes(to) ?? false;

export const assertTransition = (from, to, detail) => {
  if (!canTransition(from, to)) {
    throw Errors.INVALID_BOOKING_TRANSITION(detail || `Cannot move booking from ${from} to ${to}`);
  }
};

export const TIMELINE_STEPS = ['Booked', 'Confirmed', 'On the way', 'Sample collected', 'Processing', 'Report ready'];

const STATUS_TO_TIMELINE_INDEX = {
  PENDING: 0, CONFIRMED: 1, ASSISTANT_ASSIGNED: 1,
  ON_THE_WAY: 2, ARRIVED: 2,
  COLLECTED: 3, PROCESSING: 4, COMPLETED: 5,
  RESCHEDULED: 1, NO_SHOW: -1, CANCELLED: -1,
};

export const buildTimeline = (status) => {
  const idx = STATUS_TO_TIMELINE_INDEX[status] ?? -1;
  return TIMELINE_STEPS.map((label, i) => ({
    label, state: i < idx ? 'done' : i === idx ? 'active' : 'pending',
  }));
};
