import RecentSearch from '../models/recentSearch.js';
import LabWatch from '../models/labWatch.js';
import { notify } from './notificationService.js';

export const recordSearch = async ({ userId, kind, value, ref }) => {
  const created = await RecentSearch.create({ user: userId, kind, value, ref });
  // Keep at most 20 per user.
  const old = await RecentSearch.find({ user: userId }).sort({ createdAt: -1 }).skip(20);
  if (old.length) await RecentSearch.deleteMany({ _id: { $in: old.map((r) => r._id) } });
  return created;
};

export const listRecentSearches = (userId) =>
  RecentSearch.find({ user: userId }).sort({ createdAt: -1 }).limit(20);

export const watchLabsNearby = ({ userId, lat, lng, radiusMeters }) =>
  LabWatch.create({ user: userId, location: { type: 'Point', coordinates: [lng, lat] }, radiusMeters });

// PRD §6.2 — "Notify me when a lab joins near me". Called from a Lab post-save hook
// (models/lab.js) whenever a lab transitions into isActive=true (including brand-new labs,
// which is the primary case for this feature).
//
// Design note: each LabWatch has its own radiusMeters, so a plain $near query (single fixed
// $maxDistance for the whole query) can't select "watches whose OWN radius covers this lab".
// We use $geoNear (the aggregation form of $near) to compute a per-document distanceMeters,
// then $match with $expr to compare that distance against each watch's own radiusMeters field.
// Matched watches are notified once and marked with notifiedAt so they don't re-fire on every
// subsequent lab activation nearby (a fresh watch would be needed to be notified again).
export const notifyLabWatchers = async (lab) => {
  const [lng, lat] = lab.location.coordinates;
  const watches = await LabWatch.aggregate([
    { $geoNear: {
        near: { type: 'Point', coordinates: [lng, lat] },
        distanceField: 'distanceMeters',
        spherical: true,
        query: { notifiedAt: null },
    } },
    { $match: { $expr: { $lte: ['$distanceMeters', '$radiusMeters'] } } },
  ]);

  for (const watch of watches) {
    await notify({
      userId: watch.user,
      event: 'LAB_JOINED_NEARBY',
      title: 'A new lab joined near you',
      body: `${lab.name} is now open near one of your watched locations.`,
      data: { labId: lab._id.toString() },
    });
    await LabWatch.updateOne({ _id: watch._id }, { notifiedAt: new Date() });
  }
};
