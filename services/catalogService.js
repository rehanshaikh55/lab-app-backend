import Lab from '../models/lab.js';
import Test from '../models/test.js';
import { expand } from './searchSynonymService.js';

const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const SORTS = {
  rel:  { labCount: -1, price: 1, name: 1 },
  low:  { price: 1, name: 1 },
  high: { price: -1, name: 1 },
  fast: { turnaroundHours: 1, price: 1, name: 1 },
};

// Cross-lab catalog: one item per catalogCode, aggregated over active tests in active labs.
export const listCatalog = async (q = {}) => {
  const page = Math.max(parseInt(q.page) || 1, 1);
  const lim = Math.min(Math.max(parseInt(q.limit) || 20, 1), 100);

  const testMatch = { isActive: true, catalogCode: { $exists: true, $ne: null } };
  if (q.q) {
    const terms = await expand(q.q);
    testMatch.name = { $regex: new RegExp(terms.map(escapeRegex).join('|'), 'i') };
  }
  if (q.category) testMatch.category = { $regex: new RegExp(`^${escapeRegex(q.category)}$`, 'i') };
  if (q.isPackage !== undefined) testMatch.isPackage = q.isPackage === 'true' || q.isPackage === true;
  if (q.sampleType) testMatch.sampleType = q.sampleType;

  if (q.lat !== undefined && q.lng !== undefined) {
    const labIds = await Lab.find({
      isActive: true,
      location: {
        $nearSphere: {
          $geometry: { type: 'Point', coordinates: [parseFloat(q.lng), parseFloat(q.lat)] },
          $maxDistance: parseInt(q.radius) || 10000,
        },
      },
    }).distinct('_id');
    testMatch.lab = { $in: labIds };
  } else {
    testMatch.lab = { $in: await Lab.find({ isActive: true }).distinct('_id') };
  }

  const itemMatch = {};
  if (q.noFasting === 'true' || q.noFasting === true) itemMatch.fastingHours = { $not: { $gt: 0 } };
  if (q.homeOnly === 'true' || q.homeOnly === true) itemMatch.homeCollection = true;
  if (q.maxTat !== undefined) itemMatch.turnaroundHours = { $lte: parseInt(q.maxTat) };
  if (q.maxPrice !== undefined) itemMatch.price = { $lte: parseFloat(q.maxPrice) };

  const sort = SORTS[q.sort] || SORTS.rel;

  const pipeline = [
    { $match: testMatch },
    { $sort: { price: 1 } },
    { $group: {
        _id: '$catalogCode',
        name: { $first: '$name' },
        category: { $first: '$category' },
        description: { $first: '$description' },
        plainLanguageDescription: { $first: '$plainLanguageDescription' },
        parametersCount: { $first: '$parametersCount' },
        sampleType: { $first: '$sampleType' },
        fastingHours: { $first: '$fastingHours' },
        isPackage: { $first: '$isPackage' },
        price: { $first: '$price' },
        mrp: { $first: '$mrp' },
        turnaroundHours: { $min: '$turnaroundHours' },
        homeCollection: { $max: '$homeCollection' },
        labCount: { $sum: 1 },
    } },
    { $addFields: { code: '$_id' } },
    { $project: { _id: 0 } },
  ];
  if (Object.keys(itemMatch).length) pipeline.push({ $match: itemMatch });
  pipeline.push({ $sort: sort });
  pipeline.push({ $facet: {
    items: [{ $skip: (page - 1) * lim }, { $limit: lim }],
    meta: [{ $count: 'total' }],
  } });

  const [res] = await Test.aggregate(pipeline);
  const total = res.meta[0]?.total || 0;
  return { items: res.items, total, page, pages: Math.ceil(total / lim) };
};

// Labs (active, optionally within radius) able to fulfil every code in the cart, cheapest first.
export const quoteCart = async ({ codes, lat, lng, radius = 10000 }) => {
  let labs;
  if (lat !== undefined && lng !== undefined) {
    labs = await Lab.aggregate([
      { $geoNear: {
          near: { type: 'Point', coordinates: [parseFloat(lng), parseFloat(lat)] },
          distanceField: 'distanceMeters',
          maxDistance: parseInt(radius),
          spherical: true,
          query: { isActive: true },
      } },
    ]);
  } else {
    labs = await Lab.find({ isActive: true }).lean();
  }
  const labById = new Map(labs.map((l) => [String(l._id), l]));

  const tests = await Test.find({
    isActive: true, catalogCode: { $in: codes }, lab: { $in: [...labById.keys()] },
  }).lean();

  const seen = new Set();
  const byLab = new Map();
  for (const t of tests) {
    seen.add(t.catalogCode);
    const key = String(t.lab);
    if (!byLab.has(key)) byLab.set(key, new Map());
    const items = byLab.get(key);
    const prev = items.get(t.catalogCode);
    if (!prev || t.price < prev.price) items.set(t.catalogCode, t); // duplicate code in one lab: cheapest wins
  }

  const quotes = [];
  for (const [labId, items] of byLab) {
    if (items.size !== codes.length) continue;
    const l = labById.get(labId);
    const rows = codes.map((code) => {
      const t = items.get(code);
      return {
        code, testId: String(t._id), name: t.name, price: t.price, mrp: t.mrp ?? t.price,
        turnaroundHours: t.turnaroundHours, fastingHours: t.fastingHours, homeCollection: t.homeCollection,
      };
    });
    quotes.push({
      lab: {
        _id: l._id, name: l.name, address: l.address, rating: l.rating, totalRatings: l.totalRatings,
        certifications: l.certifications, photos: l.photos, offerText: l.offerText,
        openingHours: l.openingHours,
        cancellationCutoffHours: l.policy?.cancellationCutoffHours,
        distanceMeters: l.distanceMeters ?? null,
      },
      items: rows,
      subtotal: rows.reduce((s, r) => s + r.price, 0),
      mrpTotal: rows.reduce((s, r) => s + r.mrp, 0),
      maxTurnaroundHours: Math.max(...rows.map((r) => r.turnaroundHours || 0)),
      homeCollectionAvailable: rows.every((r) => r.homeCollection),
      homeCollectionFee: l.policy?.homeCollectionFee ?? 0,
      homeCollectionWaiverAbove: l.policy?.homeCollectionWaiverAbove ?? 0,
    });
  }
  quotes.sort((a, b) => a.subtotal - b.subtotal || (b.lab.rating || 0) - (a.lab.rating || 0));

  return { labs: quotes, missing: codes.filter((c) => !seen.has(c)) };
};
