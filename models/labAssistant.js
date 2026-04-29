import mongoose from 'mongoose';

const labAssistantSchema = new mongoose.Schema({
  user:  { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  lab:   { type: mongoose.Schema.Types.ObjectId, ref: 'Lab', required: true },
  name:  { type: String, required: true },
  phone: { type: String },
  availability: {
    monday:    { type: Boolean, default: true },
    tuesday:   { type: Boolean, default: true },
    wednesday: { type: Boolean, default: true },
    thursday:  { type: Boolean, default: true },
    friday:    { type: Boolean, default: true },
    saturday:  { type: Boolean, default: false },
    sunday:    { type: Boolean, default: false },
  },
  isActive: { type: Boolean, default: true },
}, { timestamps: true });

labAssistantSchema.index({ lab: 1, isActive: 1 });

export default mongoose.model('LabAssistant', labAssistantSchema);
