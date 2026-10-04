import HealthPackage from '../models/healthPackage.js';
import { Errors } from '../common/errors.js';

const withSavings = (pkg) => {
  const sumOfTests = (pkg.tests || []).reduce((s, t) => s + (t.price || 0), 0);
  return { ...pkg.toObject(), sumOfTests, savings: Math.max(0, sumOfTests - pkg.price) };
};

export const listPackages = async (q) => {
  const filter = { isActive: true };
  if (q.category) filter.category = q.category;
  if (q.lab) filter.lab = q.lab;
  if (q.q) filter.name = { $regex: new RegExp(q.q, 'i') };
  const page = parseInt(q.page) || 1;
  const limit = Math.min(parseInt(q.limit) || 20, 100);
  const skip = (page - 1) * limit;
  const [packages, total] = await Promise.all([
    HealthPackage.find(filter)
      .populate('tests', 'name price')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit),
    HealthPackage.countDocuments(filter),
  ]);
  return { packages: packages.map(withSavings), total, page, limit, pages: Math.ceil(total / limit) };
};

export const getPackage = async (slug) => {
  const pkg = await HealthPackage.findOne({ slug, isActive: true })
    .populate('tests', 'name price description');
  if (!pkg) throw Errors.NOT_FOUND('Package');
  return withSavings(pkg);
};
