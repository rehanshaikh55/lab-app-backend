import AppContent from '../models/appContent.js';
import { Errors } from '../common/errors.js';

const DEFAULTS = {
  home_banners: [
    { tag: 'Flash deal · Today only', h: '50% OFF', sub: 'On all health packages',
      cta: 'Book now', ctaC: '#0C6055', g: 'linear-gradient(125deg,#107A6C,#1DB69F)' },
    { tag: 'Zero collection charge', h: '₹0 visit fee', sub: 'Home sample pickup free',
      cta: 'Explore', ctaC: '#1E3A8A', g: 'linear-gradient(125deg,#1D4ED8,#6D28D9)' },
    { tag: 'Diabetes care pack', h: '₹799', sub: '12 tests · save ₹1,100',
      cta: 'View pack', ctaC: '#7C2D12', g: 'linear-gradient(125deg,#B45309,#EA580C)' },
  ],
  home_categories: [
    { key: 'blood',    label: 'Blood Test',     icon: 'droplet',      bg: '#FEF2F2', color: '#DC2626' },
    { key: 'urine',    label: 'Urine Test',     icon: 'flask',        bg: '#FFFBEB', color: '#D97706' },
    { key: 'thyroid',  label: 'Thyroid',        icon: 'activity',     bg: '#F5F3FF', color: '#7C3AED' },
    { key: 'diabetes', label: 'Diabetes',       icon: 'zap',          bg: '#FEFCE8', color: '#CA8A04' },
    { key: 'heart',    label: 'Heart ECG',      icon: 'heart',        bg: '#FFF1F2', color: '#E11D48' },
    { key: 'vitamin',  label: 'Vitamins',       icon: 'gift',         bg: '#F0FDF4', color: '#16A34A' },
    { key: 'fullbody', label: 'Full Body',      icon: 'shield-check', bg: '#ECFDF5', color: '#059669' },
    { key: 'xray',     label: 'X-Ray',          icon: 'thermometer',  bg: '#EFF6FF', color: '#2563EB' },
    { key: 'culture',  label: 'Culture',        icon: 'flask',        bg: '#FDF4FF', color: '#A21CAF' },
    { key: 'cancer',   label: 'Cancer Markers', icon: 'activity',     bg: '#FFF7ED', color: '#C2410C' },
  ],
};

export const getContent = async (key) => {
  const doc = await AppContent.findOne({ key });
  if (doc) return { key, payload: doc.payload, updatedAt: doc.updatedAt };
  const fallback = DEFAULTS[key];
  if (!fallback) throw Errors.NOT_FOUND('Content');
  return { key, payload: fallback, updatedAt: null };
};

export const setContent = async ({ key, payload }) => {
  const doc = await AppContent.findOneAndUpdate(
    { key },
    { payload },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  );
  return { key: doc.key, payload: doc.payload, updatedAt: doc.updatedAt };
};
