// PRD §6.2 FR-5 — small starter dictionary; admins can extend via AppContent ("search_synonyms" key).
import { getContent } from './contentService.js';

const DEFAULT = {
  'sugar':        ['fasting blood glucose', 'random blood sugar', 'HbA1c'],
  'sugar test':   ['fasting blood glucose', 'HbA1c'],
  'thyroid':      ['TSH', 'T3', 'T4'],
  'diabetes':     ['HbA1c', 'fasting blood glucose'],
  'cholesterol':  ['lipid profile'],
  'kidney':       ['creatinine', 'urea', 'eGFR'],
};

let cache;
export const expand = async (term) => {
  if (!term) return [];
  const lower = term.toLowerCase().trim();
  cache ||= await getContent('search_synonyms').catch(() => ({ payload: DEFAULT }));
  const dict = cache.payload || DEFAULT;
  return [lower, ...(dict[lower] || [])];
};
