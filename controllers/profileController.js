import User from '../models/user.js';
import Lab from '../models/lab.js';
import { geocodeAddress, reverseGeocode } from '../services/locationService.js';
import { Errors } from '../common/errors.js';
import { asyncHandler } from '../utils/asyncHandler.js';

export const getProfile = asyncHandler(async (request, reply) => {
  const user = await User.findById(request.user._id)
    .select('-passwordHash -refreshToken -resetToken -resetTokenExpiry');
  if (!user) {
    const err = Errors.NOT_FOUND('User');
    return reply.code(err.statusCode).send(err.toRFC7807());
  }
  return reply.code(200).send({ user });
});

export const updateProfile = asyncHandler(async (request, reply) => {
  const { name, phone, fcmToken, gender, birthDate } = request.body;
  const update = {};
  if (name !== undefined)      update.name = name;
  if (phone !== undefined)     update.phone = phone;
  if (fcmToken !== undefined)  update.fcmToken = fcmToken;
  if (gender !== undefined)    update.gender = gender;
  if (birthDate !== undefined) update.birthDate = new Date(birthDate);
  const user = await User.findByIdAndUpdate(request.user._id, update, { new: true })
    .select('-passwordHash -refreshToken');
  return reply.code(200).send({ user });
});

export const addAddress = asyncHandler(async (request, reply) => {
  const user = await User.findById(request.user._id);
  if (!user) {
    const err = Errors.NOT_FOUND('User');
    return reply.code(err.statusCode).send(err.toRFC7807());
  }
  const { label, line1, line2, city, state, zipCode, country } = request.body;
  user.addresses.push({ label, line1, line2, city, state, zipCode, country: country || 'India' });
  await user.save();
  return reply.code(201).send({ addresses: user.addresses });
});

export const updateAddress = asyncHandler(async (request, reply) => {
  const { id } = request.params;
  const user = await User.findById(request.user._id);
  if (!user) {
    const err = Errors.NOT_FOUND('User');
    return reply.code(err.statusCode).send(err.toRFC7807());
  }
  const addr = user.addresses.id(id);
  if (!addr) {
    const err = Errors.NOT_FOUND('Address');
    return reply.code(err.statusCode).send(err.toRFC7807());
  }
  const { label, line1, line2, city, state, zipCode, country } = request.body;
  if (label !== undefined)   addr.label = label;
  if (line1 !== undefined)   addr.line1 = line1;
  if (line2 !== undefined)   addr.line2 = line2;
  if (city !== undefined)    addr.city = city;
  if (state !== undefined)   addr.state = state;
  if (zipCode !== undefined) addr.zipCode = zipCode;
  if (country !== undefined) addr.country = country;
  await user.save();
  return reply.code(200).send({ addresses: user.addresses });
});

export const deleteAddress = asyncHandler(async (request, reply) => {
  const { id } = request.params;
  const user = await User.findById(request.user._id);
  if (!user) {
    const err = Errors.NOT_FOUND('User');
    return reply.code(err.statusCode).send(err.toRFC7807());
  }
  user.addresses = user.addresses.filter(a => a._id.toString() !== id);
  await user.save();
  return reply.code(200).send({ addresses: user.addresses });
});

export const updateLocation = asyncHandler(async (request, reply) => {
  const { address, latitude, longitude } = request.body;
  let coords = [longitude || 0, latitude || 0];
  let resolvedAddress = address;

  if (address && !latitude) {
    try {
      const geo = await geocodeAddress(address);
      coords = [geo.longitude, geo.latitude];
      resolvedAddress = geo.formattedAddress || address;
    } catch { /* keep original */ }
  } else if (latitude && longitude && !address) {
    try {
      const geo = await reverseGeocode(latitude, longitude);
      resolvedAddress = geo.formattedAddress || `${latitude},${longitude}`;
    } catch {
      resolvedAddress = `${latitude},${longitude}`;
    }
  }

  const user = await User.findByIdAndUpdate(
    request.user._id,
    { location: { type: 'Point', coordinates: coords } },
    { new: true },
  ).select('-passwordHash -refreshToken');
  return reply.code(200).send({ user, resolvedAddress });
});

export const getNearbyLabs = asyncHandler(async (request, reply) => {
  const { lat, lng, radius = 5000, minRating, page = 1, limit = 20 } = request.query;
  const query = {
    location: {
      $near: {
        $geometry: { type: 'Point', coordinates: [parseFloat(lng), parseFloat(lat)] },
        $maxDistance: parseInt(radius),
      },
    },
    isActive: true,
  };
  if (minRating) query.rating = { $gte: parseFloat(minRating) };
  const skip = (parseInt(page) - 1) * parseInt(limit);
  const labs = await Lab.find(query).skip(skip).limit(parseInt(limit));
  return reply.code(200).send({ labs, count: labs.length });
});
