import BlogPost, { BLOG_SLUG_PATTERN } from '../models/blogPost.js';

// Only editorial fields are exposed; never return internal IDs or draft status.
const fields = { _id: 0, title: 1, slug: 1, excerpt: 1, body: 1, author: 1, category: 1, coverImage: 1, seoTitle: 1, seoDescription: 1, publishedAt: 1, updatedAt: 1, contentType: 1, reviewStatus: 1, reviewedBy: 1, reviewerCredentials: 1, reviewedAt: 1, references: 1 };
const published = () => ({ status: 'published', publishedAt: { $lte: new Date() }, $or: [
  // Articles published before classification existed have no contentType; keep them public as service.
  { contentType: { $in: ['service', null] } },
  { contentType: 'medical', reviewStatus: 'approved', reviewedBy: { $regex: '\\S' }, reviewerCredentials: { $regex: '\\S' }, reviewedAt: { $lte: new Date() }, references: { $elemMatch: { title: { $regex: '\\S' }, url: { $regex: '^https://' } } } },
] });

export async function blogRoutes(app) {
  app.get('/blog/posts', {
    schema: { querystring: {
      type: 'object', additionalProperties: false,
      properties: { page: { type: 'integer', minimum: 1, maximum: 10000, default: 1 }, limit: { type: 'integer', minimum: 1, maximum: 50, default: 50 } },
    } },
  }, async request => {
    const { page, limit } = request.query;
    const filter = published();
    const [posts, total] = await Promise.all([
      BlogPost.find(filter).select(fields).sort({ publishedAt: -1, _id: -1 }).skip((page - 1) * limit).limit(limit).lean(),
      BlogPost.countDocuments(filter),
    ]);
    return { posts, total, page, limit };
  });
  app.get('/blog/posts/:slug', {
    schema: { params: { type: 'object', required: ['slug'], properties: { slug: { type: 'string', maxLength: 160, pattern: BLOG_SLUG_PATTERN } } } },
  }, async (request, reply) => {
    const post = await BlogPost.findOne({ ...published(), slug: request.params.slug }).select(fields).lean();
    if (!post) return reply.code(404).send({ message: 'Article not found' });
    return post;
  });
}
