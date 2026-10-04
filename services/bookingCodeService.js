import Booking from '../models/booking.js';

// Crockford-ish alphabet (no I, O, 0, 1) → unambiguous when read aloud or typed.
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

const encode = (n) => {
  let s = '';
  let remaining = n;
  while (remaining > 0) {
    s = ALPHABET[remaining % 32] + s;
    remaining = Math.floor(remaining / 32);
  }
  return s.padStart(5, ALPHABET[0]);
};

export const generateCode = async () => {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const base = (Date.now() % 1e9) + Math.floor(Math.random() * 1024);
    const candidate = `LBZ-${encode(base)}`;
    const exists = await Booking.exists({ code: candidate });
    if (!exists) return candidate;
  }
  throw new Error('Failed to generate unique booking code after 5 attempts');
};
