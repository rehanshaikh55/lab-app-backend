import rateLimit from '@fastify/rate-limit';
import Lead, { LEAD_PHONE_PATTERN, LEAD_TYPES } from '../models/lead.js';
import { brevoTransport } from '../integrations/email/brevo.js';

const leadBody = {
  type: 'object',
  required: ['type', 'phone', 'source'],
  additionalProperties: false,
  properties: {
    type: { type: 'string', enum: LEAD_TYPES },
    name: { type: 'string', maxLength: 120 },
    labName: { type: 'string', maxLength: 160 },
    phone: { type: 'string', pattern: LEAD_PHONE_PATTERN.source },
    email: { type: 'string', format: 'email', maxLength: 254 },
    city: { type: 'string', maxLength: 120 },
    branches: { type: 'string', maxLength: 32 },
    message: { type: 'string', maxLength: 2000 },
    source: { type: 'string', pattern: '\\S', maxLength: 200 },
    honeypot: { type: 'string' },
    formVersion: { type: 'string', const: '2026-11' },
    consentVersion: { type: 'string', const: '2026-11-28' },
    consent: { type: 'boolean', const: true },
  },
  allOf: [
    { if: { properties: { type: { const: 'LAB_PARTNER' } }, required: ['type'] }, then: { properties: { name: { type: 'string', pattern: '\\S' } }, required: ['name'] } },
    { if: { properties: { type: { const: 'CONTACT' } }, required: ['type'] }, then: { required: ['name', 'message'], properties: { name: { type: 'string', pattern: '\\S' }, message: { type: 'string', pattern: '\\S', maxLength: 1000 } } } },
  ],
};

export const leadRoutes = async (fastify) => {
  await fastify.register(rateLimit, { global: false });

  fastify.post('/leads', {
    bodyLimit: 16 * 1024,
    preValidation: async (request, reply) => {
      const body = request.body;
      if (body && (body.type === 'LAUNCH_WAITLIST' || body.type === 'CONTACT' || body.formVersion !== undefined) &&
          (body.formVersion !== '2026-11' || body.consent !== true || body.consentVersion !== '2026-11-28')) {
        return reply.code(400).send({ message: 'Explicit contact consent and current form version are required.' });
      }
    },
    config: {
      rateLimit: {
        max: 5,
        timeWindow: '1 hour',
        // Render appends the visitor IP. Ignore earlier caller-supplied entries.
        keyGenerator: (request) => request.ips?.[1] ?? request.ip,
      },
    },
    schema: {
      body: leadBody,
      response: {
        201: { type: 'object', required: ['ok'], properties: { ok: { type: 'boolean' } } },
      },
    },
  }, async (request, reply) => {
    const { honeypot, consent, ...fields } = request.body;
    if (honeypot) return reply.code(201).send({ ok: true });

    const lead = await Lead.create({ ...fields, ...(consent === true ? { consentedAt: new Date() } : {}) });
    const { BREVO_API_KEY, LEAD_ALERT_EMAIL } = process.env;
    if (BREVO_API_KEY && LEAD_ALERT_EMAIL) {
      try {
        await brevoTransport(BREVO_API_KEY).sendMail({
          to: LEAD_ALERT_EMAIL,
          subject: `New Labzy lead: ${lead.type}`,
          text: `Lead ${lead.id} from ${lead.source}. Open the Lead resource in AdminJS to follow up.`,
        });
      } catch (error) {
        request.log.warn({ leadId: lead.id, err: error }, 'Lead alert email failed');
      }
    }

    return reply.code(201).send({ ok: true });
  });
};
