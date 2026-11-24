// Adds only this seed's five explicitly labelled demo labs and sample test menus.
// Names/addresses come from the sources in data/juhapura-demo-labs.json.
// Prices, slots, turnaround and home collection are fixtures, not real offers.
// node scripts/seed-juhapura-demos.js             (read-only preview)
// node scripts/seed-juhapura-demos.js --apply     (idempotent, no deletes)
import 'dotenv/config';
import fs from 'node:fs/promises';
import mongoose from 'mongoose';
import User from '../models/user.js';
import Lab from '../models/lab.js';
import Test from '../models/test.js';
import { toCatalogCode } from '../services/_shared/catalogCode.js';
import { listCatalog, quoteCart } from '../services/catalogService.js';

const definitions = JSON.parse(await fs.readFile(new URL('./data/juhapura-demo-labs.json', import.meta.url), 'utf8'));
const DOMAIN = 'juhapura-demo.example.invalid';
const OWNER_EMAIL = `owner@${DOMAIN}`;
const DAYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
const bloodTests = [
  { name: 'Complete Blood Count (CBC)', category: 'Blood', price: 299, parametersCount: 24 },
  { name: 'HbA1c (Glycated Haemoglobin)', category: 'Diabetes', price: 449, parametersCount: 1 },
  { name: 'Fasting Blood Sugar (FBS)', category: 'Diabetes', price: 149, fastingHours: 8 },
  { name: 'Thyroid Profile (T3, T4, TSH)', category: 'Hormones', price: 499, parametersCount: 3 },
  { name: 'Lipid Profile', category: 'Blood', price: 549, parametersCount: 7, fastingHours: 10 },
  { name: 'Diabetes Care Panel', category: 'Diabetes', price: 799, parametersCount: 8, fastingHours: 8, isPackage: true },
];
const imagingTests = [
  { name: 'Chest X-Ray (PA View)', category: 'Radiology', price: 450, sampleType: 'Imaging', homeCollection: false, turnaroundHours: 2 },
  { name: 'Ultrasound — Whole Abdomen', category: 'Radiology', price: 1200, sampleType: 'Imaging', homeCollection: false, fastingHours: 6, turnaroundHours: 3 },
];

const menu = definition => [
  ...(definition.imagingOnly ? [] : bloodTests),
  ...(definition.imaging ? imagingTests : []),
];

async function main() {
  if (!process.env.MONGO_URI) throw new Error('MONGO_URI is required; no default database is selected.');
  await mongoose.connect(process.env.MONGO_URI, { dbName: process.env.DB_NAME || 'labzy', serverSelectionTimeoutMS: 15000 });
  try {
    // Validate every proposed document before any write.
    const validationOwner = new mongoose.Types.ObjectId();
    for (const definition of definitions) {
      await new Lab({ owner: validationOwner, name: `[DEMO] ${definition.name}`, location: { type: 'Point', coordinates: definition.coordinates } }).validate();
      for (const row of menu(definition)) {
        await new Test({ lab: validationOwner, ...row, catalogCode: toCatalogCode(row.name) }).validate();
      }
    }
    const proposed = definitions.map(definition => ({
      name: `[DEMO] ${definition.name}`, source: definition.source,
      testCount: menu(definition).length, coordinateAccuracy: definition.coordinateAccuracy,
    }));
    if (!process.argv.includes('--apply')) {
      console.log(JSON.stringify({ mode: 'preview', database: mongoose.connection.name, labs: proposed }, null, 2));
      return;
    }
    const session = await mongoose.startSession();
    try {
      await session.withTransaction(async () => {
        // This synthetic owner has no password or verified contact and cannot log in.
        const owner = await User.findOneAndUpdate({ email: OWNER_EMAIL }, { $setOnInsert: {
          name: 'Juhapura Demo Lab Owner', roles: ['LAB_OWNER'], isVerified: false, registrationStep: 2,
        } }, { upsert: true, new: true, runValidators: true, session });
        for (const [index, definition] of definitions.entries()) {
          const lab = await Lab.findOneAndUpdate({ email: `${definition.key}@${DOMAIN}` }, { $set: {
            owner: owner._id, name: `[DEMO] ${definition.name}`,
            address: { line1: definition.line1, line2: definition.line2, city: 'Ahmedabad', state: 'Gujarat', zipCode: '380055', country: 'India' },
            location: { type: 'Point', coordinates: definition.coordinates },
            description: `DEMO record based on a publicly listed centre, not an onboarded Labzy partner. Test menus, prices, hours and collection options are sample data. ${definition.coordinateAccuracy}. Source: ${definition.source}`,
            offerText: 'Demo listing · sample prices and availability',
            isActive: true, isVerified: false, certifications: [], rating: 0, totalRatings: 0,
            openingHours: Object.fromEntries(DAYS.map(day => [day, { open: '09:00', close: '18:00', isClosed: false }])),
            slotMatrix: { duration: 30, intervalMinutes: 30, maxBookingsPerSlot: 5 },
            policy: { homeCollectionFee: 0, homeCollectionWaiverAbove: 0, cancellationCutoffHours: 4 },
          } }, { upsert: true, new: true, runValidators: true, session });
          for (const row of menu(definition)) {
            const price = row.price + index * 10;
            await Test.updateOne({ lab: lab._id, catalogCode: toCatalogCode(row.name) }, { $set: {
              sampleType: 'Blood', fastingHours: 0, turnaroundHours: 6, homeCollection: true, parametersCount: 1, isPackage: false,
              ...row, price, mrp: price + 100, isActive: true,
              description: 'Demo test offering for application testing. Not a confirmed offer from the real business.',
              plainLanguageDescription: 'Sample test listing for testing Labzy. Price and availability are demonstration data.',
            } }, { upsert: true, runValidators: true, session });
          }
        }
      });
    } finally { await session.endSession(); }

    const demoLabs = await Lab.find({ email: { $regex: `@${DOMAIN.replaceAll('.', '\\.')}$` } }).select('_id name').lean();
    const labIds = demoLabs.map(lab => lab._id);
    const testCount = await Test.countDocuments({ lab: { $in: labIds } });
    const search = await listCatalog({ q: 'HbA1c', lat: 22.982265, lng: 72.512345, limit: 100 });
    const quote = await quoteCart({ codes: [toCatalogCode('HbA1c (Glycated Haemoglobin)')], lat: 22.982265, lng: 72.512345 });
    const demoQuoteCount = quote.labs.filter(row => labIds.some(id => String(id) === String(row.lab._id))).length;
    if (demoLabs.length !== 5 || testCount !== 28 || demoQuoteCount !== 4 || search.items.length === 0) {
      throw new Error(`Unexpected seed verification counts: labs=${demoLabs.length}, tests=${testCount}, HbA1cQuotes=${demoQuoteCount}`);
    }
    console.log(JSON.stringify({ mode: 'applied', database: mongoose.connection.name, demoLabs, demoTests: testCount, nearbyHbA1cDemoLabs: demoQuoteCount, catalogSearchMatches: search.items.length }, null, 2));
  } finally { await mongoose.disconnect(); }
}

main().catch(error => {
  // Connection errors may contain credentials in their message; do not print them.
  console.error(`Seed failed (${error.name}). No credentials are logged. Check the database connection and validation results.`);
  process.exitCode = 1;
});
