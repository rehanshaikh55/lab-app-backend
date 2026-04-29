import Subscription from '../models/subscription.js';
import Booking from '../models/booking.js';
import Lab from '../models/lab.js';

const INTERVAL_MS = 60 * 60 * 1000; // hourly
const MAX_RETRIES = 3;

function calcNextBookingDate(sub, from) {
  const next = new Date(from);
  if (sub.frequency === 'WEEKLY') {
    next.setDate(next.getDate() + 7);
  } else if (sub.frequency === 'CUSTOM' && sub.customIntervalDays > 0) {
    next.setDate(next.getDate() + sub.customIntervalDays);
  } else {
    // MONTHLY (default)
    next.setMonth(next.getMonth() + 1);
  }
  return next;
}

function pickFirstAvailableSlot(lab, scheduledDate) {
  const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
  const dayName = days[scheduledDate.getDay()];
  const hours = lab.openingHours?.[dayName];

  if (!hours || hours.isClosed || !hours.open) {
    return { start: '09:00', end: '09:30' }; // safe fallback
  }

  const [openH, openM] = hours.open.split(':').map(Number);
  const duration = lab.slotMatrix?.duration || 30;
  const endH = Math.floor((openH * 60 + openM + duration) / 60);
  const endM = (openH * 60 + openM + duration) % 60;
  const pad = (n) => String(n).padStart(2, '0');
  return {
    start: `${pad(openH)}:${pad(openM)}`,
    end:   `${pad(endH)}:${pad(endM)}`,
  };
}

export const initSubscriptionsJobRunner = (app) => {
  setInterval(async () => {
    try {
      const now = new Date();
      const due = await Subscription.find({
        status: 'ACTIVE',
        nextBookingDate: { $lte: now },
      }).limit(50);

      for (const sub of due) {
        const dateStr = sub.nextBookingDate.toISOString().slice(0, 10).replace(/-/g, '');
        const idempotencyKey = `sub_${sub._id}_${dateStr}`;

        // Skip if already created for this run
        const exists = await Booking.exists({ idempotencyKey });
        if (exists) {
          app.log.info({ subId: sub._id }, 'Subscription booking already created, skipping');
          sub.nextBookingDate = calcNextBookingDate(sub, sub.nextBookingDate);
          sub.lastRunAt = now;
          await sub.save();
          continue;
        }

        try {
          const lab = await Lab.findById(sub.lab);
          const slot = lab ? pickFirstAvailableSlot(lab, sub.nextBookingDate) : { start: '09:00', end: '09:30' };

          await Booking.create({
            user:           sub.user,
            lab:            sub.lab,
            tests:          [sub.test],
            subscription:   sub._id,
            scheduledDate:  sub.nextBookingDate,
            slot,
            status:         'PENDING',
            collectionType: 'IN_LAB',
            totalAmount:    0,
            idempotencyKey,
          });

          app.log.info({ subId: sub._id, idempotencyKey }, 'Subscription booking created');

          sub.nextBookingDate = calcNextBookingDate(sub, sub.nextBookingDate);
          sub.lastRunAt = now;
          sub.retryCount = 0;
          await sub.save();
        } catch (bookingErr) {
          app.log.error({ err: bookingErr, subId: sub._id }, 'Failed to create subscription booking');
          sub.retryCount = (sub.retryCount || 0) + 1;
          if (sub.retryCount >= MAX_RETRIES) {
            sub.status = 'PAUSED';
            app.log.warn({ subId: sub._id }, 'Subscription paused after max retries');
          }
          await sub.save();
        }
      }
    } catch (err) {
      app.log.error({ err }, 'Subscription job error');
    }
  }, INTERVAL_MS);
};
