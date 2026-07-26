import Lab from '../../models/lab.js';
import Booking from '../../models/booking.js';
import { weekdayName, addMinutes } from './slotTime.js';

// Shifts across up to 3 days (dayOffset 0..2) starting from `date`, looking for the first slot
// within the preferred time window (day 0) or full opening hours (subsequent days) that still has
// spare capacity. Returns null if no slot was found within the 3-day horizon.
export const findSlot = async ({ labId, date, windowStart, windowEnd }) => {
  for (let dayOffset = 0; dayOffset <= 2; dayOffset += 1) {
    const day = new Date(date);
    day.setDate(day.getDate() + dayOffset);
    const lab = await Lab.findById(labId);
    const hours = lab.openingHours?.[weekdayName(day)];
    if (!hours || hours.isClosed) continue;
    const dur = lab.slotMatrix?.duration || 30;
    const step = lab.slotMatrix?.intervalMinutes || 30;
    const maxPerSlot = lab.slotMatrix?.maxBookingsPerSlot || 5;
    const winStart = dayOffset === 0 ? windowStart : hours.open;
    const winEnd = dayOffset === 0 ? windowEnd : hours.close;
    const startOfDay = new Date(day); startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(startOfDay); endOfDay.setDate(endOfDay.getDate() + 1);
    const existing = await Booking.find({
      lab: labId, scheduledDate: { $gte: startOfDay, $lt: endOfDay },
      status: { $in: ['PENDING', 'CONFIRMED', 'COLLECTED', 'PROCESSING'] },
    });
    const [winSH, winSM] = winStart.split(':').map(Number);
    const [winEH, winEM] = winEnd.split(':').map(Number);
    let cur = winSH * 60 + winSM;
    const end = winEH * 60 + winEM;
    while (cur + dur <= end) {
      const pad = (n) => String(n).padStart(2, '0');
      const slotStart = `${pad(Math.floor(cur / 60))}:${pad(cur % 60)}`;
      const booked = existing.filter((b) => b.slot?.start === slotStart).length;
      if (booked < maxPerSlot) return { date: day, slot: { start: slotStart, end: addMinutes(slotStart, dur) }, shifted: dayOffset !== 0 };
      cur += step;
    }
  }
  return null;
};
