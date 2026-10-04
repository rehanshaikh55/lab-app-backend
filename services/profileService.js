import User from '../models/user.js';
import Session from '../models/session.js';
import { geocodeAddress, reverseGeocode } from './locationService.js';
import { notify } from './notificationService.js';
import { Errors } from '../common/errors.js';

const SAFE_SELECT = '-passwordHash -resetToken -resetTokenExpiry';
const GRACE_DAYS = 30;

export const getProfile = async (userId) => {
  const user = await User.findById(userId).select(SAFE_SELECT);
  if (!user) throw Errors.NOT_FOUND('User');
  return user;
};

export const updateProfile = async ({ userId, body }) => {
  const update = {};
  for (const k of ['name', 'phone', 'fcmToken', 'gender']) {
    if (body[k] !== undefined) update[k] = body[k];
  }
  if (body.birthDate !== undefined) update.birthDate = new Date(body.birthDate);
  return User.findByIdAndUpdate(userId, update, { new: true }).select(SAFE_SELECT);
};

export const addAddress = async ({ userId, body }) => {
  const user = await User.findById(userId);
  if (!user) throw Errors.NOT_FOUND('User');
  const { label, line1, line2, city, state, zipCode, country } = body;
  user.addresses.push({ label, line1, line2, city, state, zipCode, country: country || 'India' });
  await user.save();
  return user.addresses;
};

export const updateAddress = async ({ userId, addressId, body }) => {
  const user = await User.findById(userId);
  if (!user) throw Errors.NOT_FOUND('User');
  const addr = user.addresses.id(addressId);
  if (!addr) throw Errors.NOT_FOUND('Address');
  for (const k of ['label', 'line1', 'line2', 'city', 'state', 'zipCode', 'country']) {
    if (body[k] !== undefined) addr[k] = body[k];
  }
  await user.save();
  return user.addresses;
};

export const deleteAddress = async ({ userId, addressId }) => {
  const user = await User.findById(userId);
  if (!user) throw Errors.NOT_FOUND('User');
  user.addresses = user.addresses.filter((a) => a._id.toString() !== addressId);
  await user.save();
  return user.addresses;
};

export const updateLocation = async ({ userId, address, latitude, longitude }) => {
  let coords = [longitude || 0, latitude || 0];
  let resolvedAddress = address;
  if (address && !latitude) {
    try {
      const geo = await geocodeAddress(address);
      coords = geo.coordinates || coords;
      resolvedAddress = geo.address || address;
    } catch { /* keep originals */ }
  } else if (latitude && longitude && !address) {
    try {
      const geo = await reverseGeocode(latitude, longitude);
      resolvedAddress = geo.address || `${latitude},${longitude}`;
    } catch {
      resolvedAddress = `${latitude},${longitude}`;
    }
  }
  const user = await User.findByIdAndUpdate(
    userId,
    { location: { type: 'Point', coordinates: coords } },
    { new: true },
  ).select(SAFE_SELECT);
  return { user, resolvedAddress };
};

// Dependents (Phase 2 Task 18)

export const listDependents = async (userId) => {
  const user = await User.findById(userId).select('dependents');
  if (!user) throw Errors.NOT_FOUND('User');
  return user.dependents || [];
};

export const addDependent = async ({ userId, body }) => {
  const user = await User.findById(userId);
  if (!user) throw Errors.NOT_FOUND('User');
  const { name, relation, gender, birthDate } = body;
  user.dependents.push({ name, relation, gender, birthDate: birthDate ? new Date(birthDate) : undefined });
  await user.save();
  return user.dependents;
};

export const updateDependent = async ({ userId, dependentId, body }) => {
  const user = await User.findById(userId);
  if (!user) throw Errors.NOT_FOUND('User');
  const dep = user.dependents.id(dependentId);
  if (!dep) throw Errors.NOT_FOUND('Dependent');
  for (const k of ['name', 'relation', 'gender']) {
    if (body[k] !== undefined) dep[k] = body[k];
  }
  if (body.birthDate !== undefined) dep.birthDate = body.birthDate ? new Date(body.birthDate) : undefined;
  await user.save();
  return user.dependents;
};

export const deleteDependent = async ({ userId, dependentId }) => {
  const user = await User.findById(userId);
  if (!user) throw Errors.NOT_FOUND('User');
  user.dependents = user.dependents.filter((d) => d._id.toString() !== dependentId);
  await user.save();
  return user.dependents;
};

// Account deletion grace period (Task 24, PRD §6.1 FR-7): "30-day grace period,
// irreversible after." Requesting deletion also logs the account out everywhere
// (all Session rows are dropped) since a scheduled-for-deletion account shouldn't
// keep active sessions around; login itself is still allowed during the grace
// period per the plan (no extra blocking behavior beyond what's specified).

export const requestAccountDeletion = async ({ userId }) => {
  const user = await User.findById(userId);
  if (!user) throw Errors.NOT_FOUND('User');
  user.deletionScheduledAt = new Date(Date.now() + GRACE_DAYS * 24 * 3600 * 1000);
  await user.save();
  await Session.deleteMany({ user: userId });
  await notify({
    userId,
    event: 'ACCOUNT_DELETION_REQUESTED',
    title: 'Account deletion scheduled',
    body: `Your account will be deleted on ${user.deletionScheduledAt.toDateString()}. You can cancel until then.`,
  });
  return { deletionScheduledAt: user.deletionScheduledAt };
};

export const cancelAccountDeletion = async ({ userId }) => {
  const user = await User.findById(userId);
  if (!user) throw Errors.NOT_FOUND('User');
  if (!user.deletionScheduledAt) throw Errors.VALIDATION_ERROR('No deletion is scheduled');
  if (user.deletionScheduledAt < new Date()) throw Errors.VALIDATION_ERROR('Grace period has elapsed');
  user.deletionScheduledAt = null;
  await user.save();
  return { message: 'Account deletion cancelled' };
};
