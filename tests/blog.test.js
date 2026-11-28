import { test } from 'node:test';
import assert from 'node:assert/strict';
import Fastify from 'fastify';
import BlogPost from '../models/blogPost.js';
import { blogRoutes } from '../routes/blogRoutes.js';
import { prepareBlog, rebuildBlog, blogAdminOptions } from '../services/blogPublishing.js';

const article = { contentType: 'service', title: 'Booking a test', slug: 'booking-a-test', excerpt: 'Booking steps', body: 'Open the app.', author: 'Labzy team', status: 'published' };

test('validates slugs, publication state and HTTPS cover images', async () => {
  const post = new BlogPost(article);
  await post.validate();
  assert.ok(post.publishedAt instanceof Date);
  for (const invalid of [{ slug: '../private' }, { status: 'other' }, { coverImage: 'javascript:alert(1)' }, { slug: 'UPPER' }]) {
    await assert.rejects(new BlogPost({ ...article, ...invalid }).validate());
  }
  const draft = new BlogPost({ ...article, status: 'draft' });
  await draft.validate();
  assert.equal(draft.publishedAt, undefined);
});

test('admin publishing stamps first publication, preserves dates and reports deployment failures', async t => {
  const request = { method: 'post', payload: { ...article, publishedAt: '2000-01-01', unexpected: 'discard' } };
  const prepared = prepareBlog(request, {});
  assert.ok(Date.parse(prepared.payload.publishedAt) > Date.parse('2026-01-01'));
  assert.equal(prepared.payload.unexpected, undefined);
  assert.equal(prepareBlog(request, { record: { params: { publishedAt: '2026-01-01' } } }).payload.publishedAt, undefined);
  assert.equal(blogAdminOptions.actions.bulkDelete.isAccessible, false);
  t.mock.method(globalThis, 'fetch', async () => ({ ok: true }));
  const original = process.env.BLOG_DEPLOY_HOOK_URL;
  t.after(() => { if (original === undefined) delete process.env.BLOG_DEPLOY_HOOK_URL; else process.env.BLOG_DEPLOY_HOOK_URL = original; });
  process.env.BLOG_DEPLOY_HOOK_URL = 'https://api.render.com/deploy/test?key=private';
  const response = { record: { errors: {} } };
  assert.match((await rebuildBlog(response, request)).notice.message, /rebuild requested/);
  assert.equal(globalThis.fetch.mock.callCount(), 1);
  assert.equal(await rebuildBlog(response, { method: 'get' }), response);
  const invalid = { record: { errors: { title: { message: 'Required' } } } };
  assert.equal(await rebuildBlog(invalid, request), invalid);
  process.env.BLOG_DEPLOY_HOOK_URL = 'https://other.example/test';
  assert.match((await rebuildBlog(response, request)).notice.message, /could not be requested/);
  assert.equal(globalThis.fetch.mock.callCount(), 1);
  delete process.env.BLOG_DEPLOY_HOOK_URL;
  assert.match((await rebuildBlog(response, request)).notice.message, /not configured/);
});

test('public routes filter unpublished content, project fields, paginate and return real 404s', async t => {
  const app = Fastify();
  await app.register(blogRoutes, { prefix: '/api' });
  t.after(() => app.close());
  const filters = [];
  t.mock.method(BlogPost, 'countDocuments', async filter => { filters.push(filter); return 1; });
  t.mock.method(BlogPost, 'find', filter => {
    filters.push(filter);
    return { select(fields) { assert.equal(fields._id, 0); assert.equal(fields.status, undefined); return this; }, sort() { return this; }, skip() { return this; }, limit() { return this; }, lean: async () => [article] };
  });
  t.mock.method(BlogPost, 'findOne', filter => {
    filters.push(filter);
    return { select() { return this; }, lean: async () => null };
  });
  const response = await app.inject('/api/blog/posts?page=1&limit=10');
  assert.equal(response.statusCode, 200);
  assert.equal(response.json().total, 1);
  assert.equal((await app.inject('/api/blog/posts/missing')).statusCode, 404);
  assert.equal((await app.inject('/api/blog/posts?page=0')).statusCode, 400);
  assert.equal((await app.inject('/api/blog/posts/UPPER')).statusCode, 400);
  assert.equal((await app.inject({ method: 'POST', url: '/api/blog/posts', payload: article })).statusCode, 404);
  for (const filter of filters) {
    assert.equal(filter.status, 'published');
    assert.ok(filter.publishedAt.$lte instanceof Date);
  }
});
