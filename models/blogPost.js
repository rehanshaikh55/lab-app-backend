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
  // Unclassified legacy records must be reviewed before they become public.
  contentType: { type: String, enum: ['medical', 'service'], default: 'medical', required: true },
  reviewStatus: { type: String, enum: ['unreviewed', 'approved'], default: 'unreviewed' },
  reviewedBy: { type: String, trim: true, maxlength: 120 },
  reviewerCredentials: { type: String, trim: true, maxlength: 300 },
  reviewedAt: Date,
  references: [{ _id: false, title: { type: String, trim: true, required: true, maxlength: 200 }, url: { type: String, required: true, maxlength: 2048, validate: value => {
    try { const url = new URL(value); return url.protocol === 'https:' && !url.username && !url.password; } catch { return false; }
  } } }],
  status: { type: String, enum: ['draft', 'published'], default: 'draft', required: true },
  publishedAt: Date,
}, { timestamps: true });
schema.index({ status: 1, publishedAt: -1, _id: -1 });
schema.pre('validate', function () {
  if (this.status === 'published' && !this.publishedAt) this.publishedAt = new Date();
  if (this.status === 'published' && this.contentType !== 'service') {
    if (this.reviewStatus !== 'approved') this.invalidate('reviewStatus', 'Medical content needs qualified review.');
    if (!this.reviewedBy?.trim()) this.invalidate('reviewedBy', 'Name the medical reviewer.');
    if (!this.reviewerCredentials?.trim()) this.invalidate('reviewerCredentials', 'Record verified reviewer credentials.');
    if (!this.reviewedAt || this.reviewedAt > new Date()) this.invalidate('reviewedAt', 'Record a completed review date.');
    if (!this.references?.length) this.invalidate('references', 'Medical content needs authoritative references.');
  }
});
export default mongoose.model('BlogPost', schema);
