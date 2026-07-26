// Day key in UTC; reserve and release must both use this so they agree.
export const dayKey = (date) => new Date(date).toISOString().slice(0, 10); // 'YYYY-MM-DD'

// Matches existing controllers' weekday derivation (server-local long weekday).
export const weekdayName = (date) =>
  new Date(date).toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase();

// 'HH:MM' + minutes -> 'HH:MM'
export const addMinutes = (hhmm, minutes) => {
  const [h, m] = hhmm.split(':').map(Number);
  const total = h * 60 + m + minutes;
  const pad = (n) => String(n).padStart(2, '0');
  return `${pad(Math.floor(total / 60))}:${pad(total % 60)}`;
};
