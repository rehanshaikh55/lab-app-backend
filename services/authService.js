import User from '../models/user.js';
import Session from '../models/session.js';
import ConsentRecord from '../models/consentRecord.js';
import bcrypt from 'bcryptjs';
import nodemailer from 'nodemailer';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import { generateAccessToken, generateRefreshToken } from '../utils/generateToken.js';
import { JWT_REFRESH_SECRET, EMAIL_USER, EMAIL_PASS, FRONTEND_URL } from '../config/env.js';
import { Errors } from '../common/errors.js';
import { brevoTransport } from '../integrations/email/brevo.js';

const REQUIRED_CONSENTS = ['TOS', 'PRIVACY', 'HEALTH_RECORDS'];
const MIN_AGE_YEARS = 18;
const MAX_SESSIONS = 3;

// bcrypt truncates its input at 72 bytes. Refresh-token JWTs for the same user share
// an identical prefix (header + the "id" claim) that alone eats most/all of that
// budget, so bcrypt-hashing the raw token would make every token issued to a given
// user hash-collide with every other one — silently defeating rotation, eviction and
// per-device logout. Pre-digesting with SHA-256 folds the *entire* token (including
// the trailing jti/iat/exp/signature) into a fixed 64-char string before it reaches
// bcrypt, so distinct tokens for the same user always compare as distinct.
const digestToken = (token) => crypto.createHash('sha256').update(token).digest('hex');

const ageYearsFrom = (birthDate) => {
  if (!birthDate) return null;
  const ageMs = Date.now() - new Date(birthDate).getTime();
  return ageMs / (365.25 * 24 * 3600 * 1000);
};

let _transporter;
const getTransporter = () => {
  if (process.env.BREVO_API_KEY) return brevoTransport(process.env.BREVO_API_KEY);
  if (_transporter) return _transporter;
  if (EMAIL_USER && EMAIL_PASS) {
    _transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: { user: EMAIL_USER, pass: EMAIL_PASS },
      connectionTimeout: 10000,
      greetingTimeout: 10000,
      socketTimeout: 15000,
    });
  }
  return _transporter;
};

// Per-device session cap (PRD §6.1 FR-6): a user may be logged in on at most
// MAX_SESSIONS devices at once; the oldest (by lastUsedAt) is evicted on overflow.
const issueTokens = async (user, { deviceId, deviceLabel, ua, ip } = {}) => {
  const accessToken = generateAccessToken(user._id);
  const refreshToken = generateRefreshToken(user._id);
  const refreshTokenHash = await bcrypt.hash(digestToken(refreshToken), 10);

  // Re-login on the same device replaces that device's session instead of adding a new one.
  if (deviceId) await Session.deleteMany({ user: user._id, deviceId });

  await Session.create({ user: user._id, refreshTokenHash, deviceId, deviceLabel, ua, ip });

  const sessions = await Session.find({ user: user._id }).sort({ lastUsedAt: -1 });
  if (sessions.length > MAX_SESSIONS) {
    const evict = sessions.slice(MAX_SESSIONS).map((s) => s._id);
    await Session.deleteMany({ _id: { $in: evict } });
  }
  return { accessToken, refreshToken };
};

const publicUser = (user) => ({
  id: user._id,
  name: user.name,
  email: user.email,
  phone: user.phone,
  roles: user.roles,
  registrationStep: user.registrationStep ?? 2, // absent on legacy users = fully registered
});

export const register = async ({ name, email, password, phone, role, gender, birthDate, consents, deviceId, deviceLabel, ip, ua }) => {
  if (await User.findOne({ email })) throw Errors.CONFLICT('Email already in use');

  const isCustomer = role !== 'LAB_OWNER';
  if (isCustomer) {
    const accepted = new Set((consents || []).filter((c) => c.given).map((c) => c.kind));
    for (const k of REQUIRED_CONSENTS) {
      if (!accepted.has(k)) throw Errors.VALIDATION_ERROR(`Missing required consent: ${k}`);
    }
  }
  if (isCustomer && birthDate) {
    const age = ageYearsFrom(birthDate);
    if (age !== null && age < MIN_AGE_YEARS) {
      throw Errors.VALIDATION_ERROR('Users under 18 must be added as a family member under an adult account');
    }
  }

  const passwordHash = await bcrypt.hash(password, 12);
  const roles = role === 'LAB_OWNER' ? ['LAB_OWNER'] : ['CUSTOMER'];
  const user = await User.create({
    name, email, passwordHash, phone, roles, gender, registrationStep: 0,
    birthDate: birthDate ? new Date(birthDate) : undefined,
  });

  if (isCustomer && Array.isArray(consents)) {
    await ConsentRecord.insertMany(consents.map((c) => ({
      user: user._id, kind: c.kind, version: c.version || '1.0', given: !!c.given, ip, ua,
    })));
  }

  const tokens = await issueTokens(user, { deviceId, deviceLabel, ua, ip });
  return { ...tokens, user: publicUser(user) };
};

export const recordConsents = async ({ userId, consents, ip, ua }) => {
  const docs = await ConsentRecord.insertMany((consents || []).map((c) => ({
    user: userId, kind: c.kind, version: c.version || '1.0', given: !!c.given, ip, ua,
  })));
  return { recorded: docs.length };
};

export const login = async ({ email, password, deviceId, deviceLabel, ip, ua }) => {
  const user = await User.findOne({ email });
  if (!user || !user.passwordHash || !(await bcrypt.compare(password, user.passwordHash))) {
    throw Errors.INVALID_CREDENTIALS();
  }
  user.lastLoginAt = new Date();
  // issueTokens no longer persists the user doc (it only writes Session rows now),
  // so lastLoginAt must be saved explicitly.
  await user.save();
  const tokens = await issueTokens(user, { deviceId, deviceLabel, ua, ip });
  return { ...tokens, user: publicUser(user) };
};

export const refresh = async ({ refreshToken, deviceId }) => {
  if (!refreshToken) throw Errors.UNAUTHORIZED();
  let decoded;
  try { decoded = jwt.verify(refreshToken, JWT_REFRESH_SECRET); }
  catch { throw Errors.UNAUTHORIZED(); }
  const sessions = await Session.find({ user: decoded.id });
  const tokenDigest = digestToken(refreshToken);
  let matched = null;
  for (const s of sessions) {
    if (await bcrypt.compare(tokenDigest, s.refreshTokenHash)) { matched = s; break; }
  }
  if (!matched) throw Errors.UNAUTHORIZED();
  await Session.deleteOne({ _id: matched._id });

  const user = await User.findById(decoded.id);
  if (!user) throw Errors.UNAUTHORIZED();
  return issueTokens(user, { deviceId, ua: matched.ua, ip: matched.ip });
};

export const logout = async (user, refreshToken) => {
  if (refreshToken) {
    const sessions = await Session.find({ user: user._id });
    const tokenDigest = digestToken(refreshToken);
    for (const s of sessions) {
      if (await bcrypt.compare(tokenDigest, s.refreshTokenHash)) { await Session.deleteOne({ _id: s._id }); break; }
    }
  } else {
    await Session.deleteMany({ user: user._id });
  }
  return { message: 'Logged out successfully' };
};

// The reset page is served by this backend (routes/resetPasswordPage.js). Never
// derive this from request headers: a forged Host/X-Forwarded-Host would send
// victims a link (and their token) to an attacker's site.
const publicBaseUrl = () =>
  (process.env.PUBLIC_URL || process.env.RENDER_EXTERNAL_URL || FRONTEND_URL).replace(/\/+$/, '');

export const forgotPassword = async ({ email }, log, transporterOverride) => {
  const user = await User.findOne({ email });
  if (user) {
    const resetToken = crypto.randomBytes(32).toString('hex');
    user.resetToken = resetToken;
    user.resetTokenExpiry = Date.now() + 3600000;
    await user.save();
    const resetURL = `${publicBaseUrl()}/reset-password/${resetToken}`;
    const transporter = transporterOverride || getTransporter();
    if (!transporter) log?.warn('Password reset requested but no email provider is configured (BREVO_API_KEY or EMAIL_USER/EMAIL_PASS); no email sent');
    if (transporter) {
      // Fire-and-forget: the response must not wait on the mail provider, or a
      // slow/blocked provider turns into a client timeout.
      Promise.resolve()
        .then(() => transporter.sendMail({
          from: process.env.EMAIL_FROM || EMAIL_USER,
          to: user.email,
          subject: 'Password Reset — Labzy',
          html: `<p>Click <a href="${resetURL}">here</a> to reset your password. This link expires in 1 hour.</p>`,
        }))
        .then(() => log?.info({ to: user.email }, 'Password reset email sent'))
        .catch((e) => log?.error({ err: e }, 'Failed to send reset email'));
    }
  }
  return { message: 'If that email exists, a reset link was sent' };
};

export const resetPassword = async ({ token, newPassword }) => {
  const user = await User.findOne({ resetToken: token, resetTokenExpiry: { $gt: Date.now() } });
  if (!user) throw Errors.VALIDATION_ERROR('Invalid or expired reset token');
  user.passwordHash = await bcrypt.hash(newPassword, 12);
  user.resetToken = undefined;
  user.resetTokenExpiry = undefined;
  await user.save();
  return { message: 'Password reset successfully' };
};
