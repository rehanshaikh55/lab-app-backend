import { NODE_ENV } from '../config/env.js';
import { Errors } from '../common/errors.js';

// Provider-agnostic facade for masked/anonymized calling between customer and lab assistant
// (PRD §6.6 FR-1.3). This is intentionally a non-functional stub: no real telephony/SMS
// provider (Exotel, Knowlarity, Twilio, etc.) is ever contacted, in any environment or
// configuration. Real provider integration is out of scope for this project.
const provider = process.env.MASKED_CALL_PROVIDER || (NODE_ENV === 'production' ? null : 'STUB');

export const connect = async ({ bookingId, fromUserId, toUserId }) => {
  if (provider === 'STUB') return { callId: `stub_${bookingId}_${Date.now()}`, virtualNumber: '+910000000000' };
  if (!provider) throw Errors.SERVICE_UNAVAILABLE('Masked calling is not configured for this environment');
  // Deliberately not implemented: never attempt a real network call to a telephony provider,
  // even when MASKED_CALL_PROVIDER is set to something other than 'STUB'.
  throw Errors.SERVICE_UNAVAILABLE('Masked calling provider integration is not implemented');
};
