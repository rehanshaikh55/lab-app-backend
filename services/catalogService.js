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
  }

  const itemMatch = {};
  if (q.noFasting === 'true' || q.noFasting === true) itemMatch.fastingHours = { $not: { $gt: 0 } };
  if (q.homeOnly === 'true' || q.homeOnly === true) itemMatch.homeCollection = true;
  if (q.maxTat !== undefined) itemMatch.turnaroundHours = { $lte: parseInt(q.maxTat) };
  if (q.maxPrice !== undefined) itemMatch.price = { $lte: parseFloat(q.maxPrice) };

  const sort = SORTS[q.sort] || SORTS.rel;

  const pipeline = [
    { $match: testMatch },
    { $lookup: {
        from: 'labs', localField: 'lab', foreignField: '_id', as: 'labDoc',
        pipeline: [{ $match: { isActive: true } }, { $project: { _id: 1 } }],
    } },
    { $match: { labDoc: { $ne: [] } } },
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
