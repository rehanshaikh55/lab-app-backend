import mongoose from 'mongoose';

export const BLOG_SLUG_PATTERN = '^[a-z0-9]+(?:-[a-z0-9]+)*$';
const schema = new mongoose.Schema({
  title: { type: String, required: true, trim: true, maxlength: 180 },
  slug: { type: String, required: true, trim: true, maxlength: 160, match: new RegExp(BLOG_SLUG_PATTERN), unique: true },
  excerpt: { type: String, required: true, trim: true, maxlength: 400 },
  body: { type: String, required: true, trim: true, maxlength: 100000 },
  author: { type: String, required: true, trim: true, maxlength: 120 },
  category: { type: String, trim: true, maxlength: 60 },
  coverImage: { type: String, trim: true, maxlength: 2048, validate: value => {
    if (!value) return true;
    try { const url = new URL(value); return url.protocol === 'https:' && !url.username && !url.password; } catch { return false; }
  } },
  seoTitle: { type: String, trim: true, maxlength: 180 },
  seoDescription: { type: String, trim: true, maxlength: 320 },
  status: { type: String, enum: ['draft', 'published'], default: 'draft', required: true },
  publishedAt: Date,
}, { timestamps: true });
schema.index({ status: 1, publishedAt: -1, _id: -1 });
schema.pre('validate', function () {
  if (this.status === 'published' && !this.publishedAt) this.publishedAt = new Date();
});
export default mongoose.model('BlogPost', schema);
