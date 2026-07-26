import PDFDocument from 'pdfkit';
import { storage } from '../integrations/storage/storage.js';
import Invoice from '../models/invoice.js';

const nextInvoiceNumber = async () => {
  const last = await Invoice.findOne().sort({ createdAt: -1 });
  const lastN = last ? parseInt(last.number.split('-').pop(), 10) || 0 : 0;
  return `LBZ-INV-${new Date().getFullYear()}-${String(lastN + 1).padStart(6, '0')}`;
};

// PDF render + storage upload is best-effort: the storage adapter (FirebaseStorageAdapter.uploadBuffer)
// throws when Firebase isn't configured (the case in tests/dev — FIREBASE_SERVICE_ACCOUNT_PATH unset).
// Never let that propagate — this is called from inside the payment webhook handler, and a storage
// failure must not fail the webhook (Razorpay would retry-storm it). Matches the graceful-fallback
// convention already used by storage.getSignedUrl().
const renderAndUploadPdf = async ({ number, booking, lines, total }) => {
  try {
    const doc = new PDFDocument();
    const chunks = [];
    doc.on('data', (c) => chunks.push(c));
    doc.fontSize(18).text('Labzy Invoice', { align: 'right' }).moveDown();
    doc.fontSize(11).text(`Invoice: ${number}`).text(`Booking: ${booking.code || booking._id}`).moveDown();
    for (const l of lines) doc.text(`${l.description} — ₹${l.amount}`);
    doc.moveDown().text(`Total: ₹${total}`);
    doc.end();
    await new Promise((resolve, reject) => {
      doc.on('end', resolve);
      doc.on('error', reject);
    });
    const pdfPath = `invoices/${number}.pdf`;
    await storage.uploadBuffer(Buffer.concat(chunks), pdfPath, 'application/pdf');
    return pdfPath;
  } catch (err) {
    console.warn('Invoice PDF generation/upload failed, continuing without pdfUri:', err.message);
    return null;
  }
};

export const generateInvoice = async ({ user, booking, transaction, tests }) => {
  const number = await nextInvoiceNumber();
  const lines = (tests || []).map((t) => ({ description: t.name, amount: t.price, qty: 1 }));
  const subtotal = lines.reduce((s, l) => s + l.amount * l.qty, 0);
  const total = subtotal;
  const pdfUri = await renderAndUploadPdf({ number, booking, lines, total });
  return Invoice.create({
    user: user?._id || user, booking: booking._id, transaction: transaction._id,
    number, lines, subtotal, total, pdfUri,
  });
};
