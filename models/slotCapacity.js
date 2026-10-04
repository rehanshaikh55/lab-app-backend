import mongoose from 'mongoose';

const slotCapacitySchema = new mongoose.Schema({
  lab:       { type: mongoose.Schema.Types.ObjectId, ref: 'Lab', required: true },
  day:       { type: String, required: true }, // 'YYYY-MM-DD'
  slotStart: { type: String, required: true }, // '10:00'
  count:     { type: Number, default: 0 },
}, { timestamps: true });

slotCapacitySchema.index({ lab: 1, day: 1, slotStart: 1 }, { unique: true });

export default mongoose.model('SlotCapacity', slotCapacitySchema);
