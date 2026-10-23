import Booking from '../models/booking.js';
import Report from '../models/report.js';

const HOUR_MS = 3600 * 1000;
const PROCESSING_STATUSES = ['COLLECTED', 'PROCESSING'];

const patientOf = (booking) => ({
  name: booking.patient?.name ?? null,
  relation: booking.patient?.relation ?? null,
  dependentId: booking.patient?.dependentId ? String(booking.patient.dependentId) : null,
});

const matchesPatient = (booking, patient) => {
  const depId = booking.patient?.dependentId ? String(booking.patient.dependentId) : null;
  if (patient === 'all') return true;
  if (patient === 'self') return !depId;
  return depId === patient;
};

const base = (booking, patient) => ({
  bookingId: String(booking._id),
  bookingCode: booking.code ?? null,
  lab: { _id: String(booking.lab._id), name: booking.lab.name },
  patient,
});

export const listMyReports = async ({ userId, patient = 'all' }) => {
  const bookings = (await Booking.find({ user: userId })
    .populate('lab', 'name')
    .populate('tests', 'name catalogCode turnaroundHours')
    .lean())
    .filter((b) => b.lab && matchesPatient(b, patient));
  if (!bookings.length) return [];

  const byId = new Map(bookings.map((b) => [String(b._id), b]));
  const reports = await Report.find({ booking: { $in: [...byId.keys()] }, replacedAt: null }).lean();
  const accessible = reports.filter((r) => r.isAccessible);

  const rows = [];
  const doneTests = new Map(); // bookingId -> Set(testId)

  for (const r of accessible) {
    const booking = byId.get(String(r.booking));
    const testDoc = booking.tests.find((t) => String(t._id) === String(r.test));
    if (!doneTests.has(String(booking._id))) doneTests.set(String(booking._id), new Set());
    if (r.test) doneTests.get(String(booking._id)).add(String(r.test));
    rows.push({
      sortAt: r.issuedAt,
      row: {
        _id: String(r._id),
        ...base(booking, patientOf(booking)),
        status: 'READY',
        title: testDoc?.name ?? 'Report',
        testIds: r.test ? [String(r.test)] : [],
        catalogCodes: testDoc?.catalogCode ? [testDoc.catalogCode] : [],
        issuedAt: r.issuedAt ?? null,
        expectedAt: r.expectedAt ?? null,
        parameters: r.parameters ?? [],
        remindRetestAt: r.remindRetestAt ?? null,
      },
    });
  }

  for (const booking of bookings) {
    if (!PROCESSING_STATUSES.includes(booking.status)) continue;
    const done = doneTests.get(String(booking._id)) ?? new Set();
    const missing = booking.tests.filter((t) => !done.has(String(t._id)));
    if (!missing.length) continue;

    const missingIds = new Set(missing.map((t) => String(t._id)));
    const placeholder = reports.find((r) => !r.isAccessible && r.expectedAt
      && String(r.booking) === String(booking._id) && (!r.test || missingIds.has(String(r.test))));
    const maxTat = Math.max(0, ...missing.map((t) => t.turnaroundHours ?? 0));
    const expectedAt = placeholder?.expectedAt
      ?? new Date(new Date(booking.scheduledDate).getTime() + maxTat * HOUR_MS);

    rows.push({
      sortAt: booking.scheduledDate,
      row: {
        _id: `pending-${booking._id}`,
        ...base(booking, patientOf(booking)),
        status: 'PROCESSING',
        title: missing.map((t) => t.name).join(', '),
        testIds: missing.map((t) => String(t._id)),
        catalogCodes: missing.map((t) => t.catalogCode).filter(Boolean),
        issuedAt: null,
        expectedAt,
        parameters: [],
        remindRetestAt: null,
      },
    });
  }

  return rows
    .sort((a, b) => new Date(b.sortAt) - new Date(a.sortAt))
    .map((x) => x.row);
};
