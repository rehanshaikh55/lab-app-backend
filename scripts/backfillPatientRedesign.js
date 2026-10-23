import 'dotenv/config';
import mongoose from 'mongoose';
import Test from '../models/test.js';
import { toCatalogCode } from '../services/_shared/catalogCode.js';

// Idempotent: only touches tests missing catalogCode / mrp. Returns counts.
export async function backfillCatalog() {
  let catalogCode = 0;
  let mrp = 0;

  const missingCode = await Test.collection
    .find({ $or: [{ catalogCode: { $exists: false } }, { catalogCode: null }, { catalogCode: '' }] })
    .project({ name: 1 })
    .toArray();
  for (const t of missingCode) {
    const code = toCatalogCode(t.name);
    if (!code) continue;
    await Test.collection.updateOne({ _id: t._id }, { $set: { catalogCode: code } });
    catalogCode++;
  }

  const res = await Test.collection.updateMany(
    { $or: [{ mrp: { $exists: false } }, { mrp: null }], price: { $type: 'number' } },
    [{ $set: { mrp: '$price' } }],
  );
  mrp = res.modifiedCount;

  return { catalogCode, mrp };
}

async function main() {
  await mongoose.connect(process.env.MONGO_URI);
  try {
    const counts = { catalog: await backfillCatalog() };
    console.log('Backfill complete:', JSON.stringify(counts));
  } finally {
    await mongoose.disconnect();
  }
}

if (process.argv[1]?.endsWith('backfillPatientRedesign.js')) {
  main().catch((err) => { console.error(err); process.exit(1); });
}
