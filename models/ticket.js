import mongoose from 'mongoose';

const ticketSchema = new mongoose.Schema({
  user:    { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  booking: { type: mongoose.Schema.Types.ObjectId, ref: 'Booking' },
  category: {
    type: String, required: true,
    enum: ['DELAY', 'REFUND', 'REPORT_ISSUE', 'ASSISTANT_BEHAVIOR', 'PAYMENT', 'SAFETY', 'OTHER'],
  },
  priority: { type: String, enum: ['NORMAL', 'HIGH'], default: 'NORMAL' },
  state:    { type: String, enum: ['OPEN', 'IN_PROGRESS', 'RESOLVED'], default: 'OPEN' },
  subject:  { type: String, required: true },
  messages: [{
    fromUserId:  { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    fromRole:    { type: String, enum: ['CUSTOMER', 'SUPPORT'], required: true },
    text:        String,
    attachments: [{ uri: String }],
    createdAt:   { type: Date, default: Date.now },
  }],
  resolutionNote: String,
  resolvedAt:     Date,
}, { timestamps: true });

ticketSchema.index({ user: 1, state: 1 });
ticketSchema.index({ createdAt: -1 });

export default mongoose.model('Ticket', ticketSchema);
