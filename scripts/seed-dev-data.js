// Dev seed: realistic Ahmedabad labs, tests, reviews, packages, CMS home content,
// and a ready-made verified customer account for app testing.
//
//   node scripts/seed-dev-data.js
//
// Idempotent: re-running wipes and re-creates only the documents this script owns
// (matched by the @labzy.dev seed email domain and the seeded package slugs).
// Run while the backend's local Mongo is up (npm run start:local) or point
// MONGO_URI at any other instance.
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import User from '../models/user.js';
import Lab from '../models/lab.js';
import Test from '../models/test.js';
import Review from '../models/review.js';
import HealthPackage from '../models/healthPackage.js';
import AppContent from '../models/appContent.js';

const MONGO_URI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/labzy';

const WEEK_HOURS = {
  monday:    { open: '07:00', close: '21:00' },
  tuesday:   { open: '07:00', close: '21:00' },
  wednesday: { open: '07:00', close: '21:00' },
  thursday:  { open: '07:00', close: '21:00' },
  friday:    { open: '07:00', close: '21:00' },
  saturday:  { open: '07:00', close: '21:00' },
  sunday:    { open: '08:00', close: '14:00' },
};

// [lng, lat] — spread across Ahmedabad neighbourhoods
const LABS = [
  {
    name: 'Suburban Diagnostics — Navrangpura',
    address: { line1: '2nd Floor, Shail Complex, CG Road', line2: 'Navrangpura', city: 'Ahmedabad', state: 'Gujarat', zipCode: '380009' },
    coordinates: [72.5600, 23.0338], phone: '+91 79 4890 1201', email: 'navrangpura@suburban-labs.dev',
    certifications: ['NABL', 'ISO 15189'], rating: 4.6,
    description: 'Full-service NABL-accredited diagnostics centre on CG Road with in-house pathology, 60-minute home collection dispatch across west Ahmedabad, and same-day reports for most blood panels.',
    amenities: ['Home collection', 'Parking', 'Wheelchair accessible', 'AC waiting lounge', 'Digital reports'],
    homeCollectionFee: 100, waiverAbove: 999,
  },
  {
    name: 'Metropolis Healthcare — Satellite',
    address: { line1: 'GF-4, Shivalik Plaza, 100 Feet Road', line2: 'Satellite', city: 'Ahmedabad', state: 'Gujarat', zipCode: '380015' },
    coordinates: [72.5170, 23.0120], phone: '+91 79 4030 8822', email: 'satellite@metropolis-labs.dev',
    certifications: ['NABL', 'CAP'], rating: 4.4,
    description: 'Part of a national reference-lab network. Specialises in advanced endocrinology and fertility panels; samples are processed at the regional processing centre with a strict 6-hour cold chain.',
    amenities: ['Home collection', 'Parking', 'Online reports', 'Baby-friendly draw room'],
    homeCollectionFee: 150, waiverAbove: 1499,
  },
  {
    name: 'Dr. Lal PathLabs — Maninagar',
    address: { line1: 'Krishna Chambers, Station Road', line2: 'Maninagar', city: 'Ahmedabad', state: 'Gujarat', zipCode: '380008' },
    coordinates: [72.6030, 22.9960], phone: '+91 79 2546 7710', email: 'maninagar@lalpath-labs.dev',
    certifications: ['NABL'], rating: 4.5,
    description: 'Neighbourhood collection centre of one of India\'s largest diagnostics chains. Popular for early-morning fasting draws — the first slot opens at 7 AM and walk-ins are accepted before 9 AM.',
    amenities: ['Home collection', 'Early-morning slots', 'Digital reports', 'UPI payments'],
    homeCollectionFee: 0, waiverAbove: 0,
  },
  {
    name: 'Thyrocare Wellness — Bodakdev',
    address: { line1: '301, Sarthik Square, SG Highway', line2: 'Bodakdev', city: 'Ahmedabad', state: 'Gujarat', zipCode: '380054' },
    coordinates: [72.5070, 23.0450], phone: '+91 79 6635 4040', email: 'bodakdev@thyrocare-labs.dev',
    certifications: ['NABL', 'ISO 9001'], rating: 4.2,
    description: 'Wellness-focused lab known for affordable preventive-health packages and thyroid profiling. Fully automated analysers; reports for routine panels are typically ready the same evening.',
    amenities: ['Home collection', 'Parking', 'Preventive packages', 'Digital reports'],
    homeCollectionFee: 75, waiverAbove: 799,
  },
  {
    name: 'Unipath Specialty Laboratory — Ambawadi',
    address: { line1: 'Unipath House, Nr. Parimal Garden', line2: 'Ambawadi', city: 'Ahmedabad', state: 'Gujarat', zipCode: '380006' },
    coordinates: [72.5560, 23.0170], phone: '+91 79 4899 6677', email: 'ambawadi@unipath-labs.dev',
    certifications: ['NABL', 'CAP', 'ISO 15189'], rating: 4.7,
    description: 'Reference laboratory for oncology, histopathology and molecular diagnostics, trusted by leading hospitals across Gujarat. Also runs a full routine-pathology wing for direct patients.',
    amenities: ['Home collection', 'Valet parking', 'Wheelchair accessible', 'Priority senior-citizen queue', 'Digital reports'],
    homeCollectionFee: 120, waiverAbove: 1999,
  },
  {
    name: 'Neuberg Supratech — Ellisbridge',
    address: { line1: 'Supratech House, Nr. Town Hall', line2: 'Ellisbridge', city: 'Ahmedabad', state: 'Gujarat', zipCode: '380006' },
    coordinates: [72.5710, 23.0230], phone: '+91 79 6619 0000', email: 'ellisbridge@supratech-labs.dev',
    certifications: ['NABL'], rating: 4.3,
    description: 'Four-decade-old Ahmedabad institution now part of the Neuberg network. Broadest radiology + pathology menu in the old city, including X-ray and ultrasound alongside blood work.',
    amenities: ['Home collection', 'Radiology in-house', 'Parking', 'Digital reports'],
    homeCollectionFee: 100, waiverAbove: 999,
  },
];

// Catalogue applied to every lab with a small per-lab price jitter so labs aren't identical.
const TEST_CATALOG = [
  { name: 'Complete Blood Count (CBC)', category: 'Blood', price: 299, turnaroundHours: 6, fastingHours: 0, sampleType: 'Blood',
    plainLanguageDescription: 'A routine blood test that counts your red cells, white cells and platelets — the first check for infections, anaemia and general health.' },
  { name: 'Lipid Profile', category: 'Blood', price: 549, turnaroundHours: 8, fastingHours: 10, sampleType: 'Blood',
    plainLanguageDescription: 'Measures your cholesterol and triglycerides to assess heart-disease risk. Requires 10 hours of fasting — water is fine.' },
  { name: 'HbA1c (Glycated Haemoglobin)', category: 'Diabetes', price: 449, turnaroundHours: 6, fastingHours: 0, sampleType: 'Blood',
    plainLanguageDescription: 'Shows your average blood-sugar level over the past 3 months. The key test for diagnosing and monitoring diabetes — no fasting needed.' },
  { name: 'Fasting Blood Sugar (FBS)', category: 'Diabetes', price: 149, turnaroundHours: 4, fastingHours: 8, sampleType: 'Blood',
    plainLanguageDescription: 'A simple sugar check after an overnight fast. Often paired with HbA1c to screen for diabetes.' },
  { name: 'Thyroid Profile (T3, T4, TSH)', category: 'Hormones', price: 499, turnaroundHours: 12, fastingHours: 0, sampleType: 'Blood',
    plainLanguageDescription: 'Checks how well your thyroid gland is working — useful if you have unexplained weight change, tiredness or hair fall.' },
  { name: 'Vitamin D (25-OH)', category: 'Vitamins', price: 899, turnaroundHours: 24, fastingHours: 0, sampleType: 'Blood',
    plainLanguageDescription: 'Measures the vitamin your body makes from sunlight. Low levels are very common and cause bone pain and fatigue.' },
  { name: 'Vitamin B12', category: 'Vitamins', price: 699, turnaroundHours: 24, fastingHours: 0, sampleType: 'Blood',
    plainLanguageDescription: 'Checks the vitamin needed for healthy nerves and blood cells. Important for vegetarians, who are often deficient.' },
  { name: 'Liver Function Test (LFT)', category: 'Blood', price: 599, turnaroundHours: 8, fastingHours: 8, sampleType: 'Blood',
    plainLanguageDescription: 'A panel of enzymes and proteins that shows how well your liver is working.' },
  { name: 'Kidney Function Test (KFT)', category: 'Blood', price: 599, turnaroundHours: 8, fastingHours: 0, sampleType: 'Blood',
    plainLanguageDescription: 'Creatinine, urea and electrolytes — the standard check of how well your kidneys filter your blood.' },
  { name: 'Urine Routine & Microscopy', category: 'Urine', price: 199, turnaroundHours: 4, fastingHours: 0, sampleType: 'Urine',
    plainLanguageDescription: 'A basic urine check for infection, sugar and protein. You\'ll be given a sterile container at the lab or during home collection.' },
  { name: 'Iron Studies (Ferritin, TIBC)', category: 'Blood', price: 799, turnaroundHours: 24, fastingHours: 8, sampleType: 'Blood',
    plainLanguageDescription: 'Measures the iron stored in your body — the definitive check for iron-deficiency anaemia.' },
  { name: 'CRP (C-Reactive Protein)', category: 'Blood', price: 399, turnaroundHours: 6, fastingHours: 0, sampleType: 'Blood',
    plainLanguageDescription: 'A marker of inflammation anywhere in the body, often used to track infections and flare-ups.' },
];

// Only Neuberg Supratech (index 5) gets imaging
const IMAGING_TESTS = [
  { name: 'Chest X-Ray (PA View)', category: 'Radiology', price: 450, turnaroundHours: 2, fastingHours: 0, sampleType: 'Imaging',
    plainLanguageDescription: 'A quick chest scan done in-lab. Walk in any time during working hours — the report is ready in about 2 hours.' },
  { name: 'Ultrasound — Whole Abdomen', category: 'Radiology', price: 1200, turnaroundHours: 3, fastingHours: 6, sampleType: 'Imaging',
    plainLanguageDescription: 'A painless scan of your abdominal organs. Come fasting for 6 hours with a full bladder for the clearest images.' },
];

const REVIEWERS = [
  { name: 'Priya Mehta',   comment5: 'Phlebotomist was gentle and the report came in by evening. Very smooth experience.', },
  { name: 'Amit Trivedi',  comment5: 'Booked a home collection for my father — the assistant arrived exactly on time.', },
  { name: 'Sneha Patel',   comment4: 'Clean lab and quick draw, though the waiting area gets crowded on weekend mornings.', },
  { name: 'Rakesh Shah',   comment4: 'Reports were accurate and matched my hospital retest. Parking is a bit tight.', },
  { name: 'Farhan Qureshi',comment5: 'Transparent pricing, no upselling. The app-report PDF was easy to share with my doctor.', },
  { name: 'Divya Nair',    comment3: 'Test itself was fine but my report was delayed by a few hours past the promised time.', },
  { name: 'Jignesh Dave',  comment5: 'Senior-citizen queue meant my mother was done in 15 minutes. Highly recommend.', },
  { name: 'Ritu Agarwal',  comment4: 'Good hygiene, fresh needle opened in front of me, and staff explained the fasting rules clearly.', },
];

const HOME_BANNERS = [
  { tag: 'FLASH DEAL · TODAY ONLY', h: '50% OFF', sub: 'on Full Body Health Checkups', cta: 'Book now', ctaC: '#0C6055', g: '' },
  { tag: 'FOR LIMITED PERIOD', h: 'BUY 1 GET 1', sub: 'on all Diabetes panels', cta: 'Grab offer', ctaC: '#0C6055', g: '' },
];

const HOME_CATEGORIES = [
  { key: 'blood',    label: 'Blood Tests',     icon: 'droplet',     bg: '#FEF2F2', color: '#DC2626' },
  { key: 'diabetes', label: 'Diabetes',        icon: 'zap',         bg: '#FFF7ED', color: '#EA580C' },
  { key: 'heart',    label: 'Heart',           icon: 'heart',       bg: '#FDF2F8', color: '#DB2777' },
  { key: 'immunity', label: 'Immunity',        icon: 'shield',      bg: '#EFF6FF', color: '#2563EB' },
  { key: 'fever',    label: 'Fever Panel',     icon: 'thermometer', bg: '#FEFCE8', color: '#CA8A04' },
  { key: 'wellness', label: 'Wellness',        icon: 'leaf',        bg: '#F0FDF4', color: '#16A34A' },
  { key: 'skin',     label: 'Skin & Hair',     icon: 'sparkles',    bg: '#F5F3FF', color: '#7C3AED' },
  { key: 'women',    label: "Women's Health",  icon: 'flower2',     bg: '#FDF4FF', color: '#C026D3' },
];

const PACKAGE_DEFS = [
  { slug: 'full-body-essential', name: 'Full Body Checkup — Essential', category: 'Wellness', icon: 'sparkles', price: 1499,
    testNames: ['Complete Blood Count (CBC)', 'Lipid Profile', 'HbA1c (Glycated Haemoglobin)', 'Liver Function Test (LFT)', 'Kidney Function Test (KFT)', 'Urine Routine & Microscopy'],
    description: 'The six most-ordered panels in one visit — blood counts, sugar, cholesterol, liver, kidney and urine.' },
  { slug: 'diabetes-care', name: 'Diabetes Care Panel', category: 'Diabetes', icon: 'zap', price: 649,
    testNames: ['HbA1c (Glycated Haemoglobin)', 'Fasting Blood Sugar (FBS)', 'Urine Routine & Microscopy'],
    description: 'Everything your physician needs to diagnose or monitor diabetes.' },
  { slug: 'heart-health', name: 'Heart Health Panel', category: 'Heart', icon: 'heart', price: 999,
    testNames: ['Lipid Profile', 'CRP (C-Reactive Protein)', 'Complete Blood Count (CBC)'],
    description: 'Cholesterol plus inflammation markers to assess cardiac risk early.' },
  { slug: 'womens-wellness', name: "Women's Wellness Panel", category: "Women's Health", icon: 'flower2', price: 1799,
    testNames: ['Complete Blood Count (CBC)', 'Thyroid Profile (T3, T4, TSH)', 'Vitamin D (25-OH)', 'Vitamin B12', 'Iron Studies (Ferritin, TIBC)'],
    description: 'Thyroid, iron and vitamin levels — the panels most often abnormal in women aged 25–50.' },
  { slug: 'thyroid-care', name: 'Thyroid Care Panel', category: 'Hormones', icon: 'shield', price: 449,
    testNames: ['Thyroid Profile (T3, T4, TSH)'],
    description: 'The complete T3/T4/TSH profile at a package price.' },
  { slug: 'senior-citizen', name: 'Senior Citizen Complete', category: 'Wellness', icon: 'leaf', price: 2299,
    testNames: ['Complete Blood Count (CBC)', 'Lipid Profile', 'HbA1c (Glycated Haemoglobin)', 'Liver Function Test (LFT)', 'Kidney Function Test (KFT)', 'Vitamin D (25-OH)', 'Vitamin B12', 'Urine Routine & Microscopy'],
    description: 'A comprehensive annual screen designed for the 60+ age group, with priority home collection.' },
];

const jitter = (price, i) => price + [0, 20, -20, 30, 10, -10][i % 6];

const main = async () => {
  await mongoose.connect(MONGO_URI);
  console.log(`connected to ${MONGO_URI}`);

  // ── Wipe previous seed (only documents this script owns) ──────────────────
  const seedUsers = await User.find({ email: /@labzy\.dev$/ }).select('_id');
  const seedUserIds = seedUsers.map(u => u._id);
  const seedLabs = await Lab.find({ owner: { $in: seedUserIds } }).select('_id');
  const seedLabIds = seedLabs.map(l => l._id);
  await Review.deleteMany({ $or: [{ lab: { $in: seedLabIds } }, { user: { $in: seedUserIds } }] });
  await Test.deleteMany({ lab: { $in: seedLabIds } });
  await HealthPackage.deleteMany({ slug: { $in: PACKAGE_DEFS.map(p => p.slug) } });
  await Lab.deleteMany({ _id: { $in: seedLabIds } });
  await User.deleteMany({ email: /@labzy\.dev$/ });
  console.log('previous seed data cleared');

  const passwordHash = await bcrypt.hash('Password123!', 12);

  // ── Lab owners ────────────────────────────────────────────────────────────
  const owners = await User.insertMany(LABS.map((lab, i) => ({
    name: `${lab.name.split(' — ')[0]} Admin`,
    email: `owner${i + 1}@labzy.dev`,
    passwordHash,
    roles: ['LAB_OWNER'],
    isVerified: true,
    emailVerifiedAt: new Date(),
  })));

  // ── Labs ──────────────────────────────────────────────────────────────────
  const labs = await Lab.insertMany(LABS.map((lab, i) => ({
    owner: owners[i]._id,
    name: lab.name,
    address: { ...lab.address, country: 'India' },
    location: { type: 'Point', coordinates: lab.coordinates },
    phone: lab.phone,
    email: lab.email,
    certifications: lab.certifications,
    openingHours: WEEK_HOURS,
    slotMatrix: { duration: 30, intervalMinutes: 30, maxBookingsPerSlot: 4 },
    rating: lab.rating,
    totalRatings: 0, // corrected below once reviews are inserted
    photos: [
      { url: `https://picsum.photos/seed/labzy-${i}a/440/280`, caption: 'Reception' },
      { url: `https://picsum.photos/seed/labzy-${i}b/440/280`, caption: 'Sample collection room' },
      { url: `https://picsum.photos/seed/labzy-${i}c/440/280`, caption: 'Analyser wing' },
    ],
    description: lab.description,
    amenities: lab.amenities,
    isActive: true,
    isVerified: true,
    policy: {
      responseSlaMinutes: 120,
      rescheduleCutoffHours: 4,
      maxReschedulesPerBooking: 2,
      cancellationCutoffHours: 4,
      cancellationFee: 0,
      noShowFee: 100,
      noShowGraceMinutes: 30,
      homeCollectionFee: lab.homeCollectionFee,
      homeCollectionWaiverAbove: lab.waiverAbove,
    },
  })));
  console.log(`${labs.length} labs created`);

  // ── Tests ─────────────────────────────────────────────────────────────────
  const testDocs = [];
  labs.forEach((lab, i) => {
    TEST_CATALOG.forEach(t => testDocs.push({ ...t, price: Math.max(99, jitter(t.price, i)), lab: lab._id, isActive: true }));
    if (i === 5) IMAGING_TESTS.forEach(t => testDocs.push({ ...t, lab: lab._id, isActive: true }));
  });
  const tests = await Test.insertMany(testDocs);
  console.log(`${tests.length} tests created`);

  // ── Reviewers + reviews ───────────────────────────────────────────────────
  const reviewers = await User.insertMany(REVIEWERS.map((r, i) => ({
    name: r.name,
    email: `reviewer${i + 1}@labzy.dev`,
    passwordHash,
    roles: ['CUSTOMER'],
    isVerified: true,
    emailVerifiedAt: new Date(),
  })));

  const reviewDocs = [];
  labs.forEach((lab, li) => {
    // each lab gets 5–8 of the reviewers, rotated so labs don't share identical review lists
    const count = 5 + (li % 4);
    for (let k = 0; k < count; k++) {
      const reviewer = REVIEWERS[(li * 3 + k) % REVIEWERS.length];
      const user = reviewers[(li * 3 + k) % REVIEWERS.length];
      const rating = reviewer.comment5 ? 5 : reviewer.comment4 ? 4 : 3;
      reviewDocs.push({
        user: user._id,
        lab: lab._id,
        // unique placeholder id: the sparse {user, booking} unique index still indexes
        // booking:null docs, so a reviewer couldn't otherwise review more than one lab
        booking: new mongoose.Types.ObjectId(),
        rating,
        comment: reviewer.comment5 ?? reviewer.comment4 ?? reviewer.comment3,
        createdAt: new Date(Date.now() - (k + 1) * 86400000 * 3),
      });
    }
  });
  const reviews = await Review.insertMany(reviewDocs);
  console.log(`${reviews.length} reviews created`);

  // keep lab.rating/totalRatings consistent with the seeded reviews
  for (const lab of labs) {
    const labReviews = reviews.filter(r => r.lab.equals(lab._id));
    const avg = labReviews.reduce((s, r) => s + r.rating, 0) / labReviews.length;
    await Lab.updateOne({ _id: lab._id }, { rating: Math.round(avg * 10) / 10, totalRatings: labReviews.length });
  }

  // ── Health packages (global, priced off Suburban's catalogue) ─────────────
  const suburbTests = tests.filter(t => t.lab.equals(labs[0]._id));
  const byName = Object.fromEntries(suburbTests.map(t => [t.name, t]));
  await HealthPackage.insertMany(PACKAGE_DEFS.map(p => ({
    lab: null,
    name: p.name,
    slug: p.slug,
    description: p.description,
    category: p.category,
    icon: p.icon,
    tests: p.testNames.map(n => byName[n]._id),
    price: p.price,
    mrp: p.testNames.reduce((s, n) => s + byName[n].price, 0),
    isActive: true,
  })));
  console.log(`${PACKAGE_DEFS.length} health packages created`);

  // ── CMS home content ──────────────────────────────────────────────────────
  await AppContent.updateOne({ key: 'home_banners' }, { payload: HOME_BANNERS }, { upsert: true });
  await AppContent.updateOne({ key: 'home_categories' }, { payload: HOME_CATEGORIES }, { upsert: true });
  console.log('home_banners + home_categories upserted');

  // ── Test customer account ─────────────────────────────────────────────────
  // Upsert so re-running never duplicates; if the account already exists (real
  // signup), enrich the profile but leave the existing password untouched.
  const TEST_CUSTOMER_EMAIL = 'shaikhrehan1016@gmail.com';
  const customerProfile = {
    name: 'Rehan Shaikh',
    phone: '+91 90000 12345',
    roles: ['CUSTOMER'],
    isVerified: true,
    emailVerifiedAt: new Date(),
    profileCompleted: true,
    gender: 'male',
    birthDate: new Date('1995-08-14'),
    location: { type: 'Point', coordinates: [72.5600, 23.0338] },
    addresses: [
      { label: 'Home', line1: 'B-402, Shilp Residency, Nr. Parimal Garden', line2: 'Ambawadi', city: 'Ahmedabad', state: 'Gujarat', zipCode: '380006', country: 'India', coordinates: [72.5560, 23.0170] },
      { label: 'Office', line1: '9th Floor, Westgate Business Bay, SG Highway', line2: 'Makarba', city: 'Ahmedabad', state: 'Gujarat', zipCode: '380051', country: 'India', coordinates: [72.5030, 23.0080] },
    ],
    dependents: [
      { name: 'Salim Shaikh', relation: 'father', gender: 'male', birthDate: new Date('1965-03-02') },
      { name: 'Ayesha Shaikh', relation: 'spouse', gender: 'female', birthDate: new Date('1997-11-21') },
    ],
  };
  const existingCustomer = await User.findOne({ email: TEST_CUSTOMER_EMAIL });
  if (existingCustomer) {
    await User.updateOne({ _id: existingCustomer._id }, { $set: customerProfile });
    console.log(`test customer updated (password unchanged): ${TEST_CUSTOMER_EMAIL}`);
  } else {
    await User.create({ ...customerProfile, email: TEST_CUSTOMER_EMAIL, passwordHash });
    console.log(`test customer created: ${TEST_CUSTOMER_EMAIL} / Password123!`);
  }

  await mongoose.disconnect();
  console.log('done.');
};

main().catch(err => { console.error(err); process.exit(1); });
