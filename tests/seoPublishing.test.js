import test from 'node:test';
import assert from 'node:assert/strict';
import Fastify from 'fastify';
import BlogPost from '../models/blogPost.js';
import Lead from '../models/lead.js';
import { leadRoutes } from '../routes/leadRoutes.js';
import { blogRoutes } from '../routes/blogRoutes.js';
import { prepareBlog, blogAdminOptions } from '../services/blogPublishing.js';

const article = { title: 'Test preparation', slug: 'test-preparation', excerpt: 'A draft', body: 'Draft clinical text.', author: 'Writer', contentType: 'medical', status: 'published' };
const review = { reviewStatus: 'approved', reviewedBy: 'Reviewer supplied by publisher', reviewerCredentials: 'Publisher-verified qualification', reviewedAt: new Date(), references: [{ title: 'MedlinePlus', url: 'https://medlineplus.gov/lab-tests/' }] };
test('medical publication requires complete review provenance and references', async () => {
  await assert.rejects(new BlogPost(article).validate());
  await assert.rejects(new BlogPost({ ...article, ...review, references: [] }).validate());
  await assert.rejects(new BlogPost({ ...article, ...review, reviewedAt: new Date(Date.now() + 86400000) }).validate());
  await assert.rejects(new BlogPost({ ...article, ...review, references: [{ title: 'Unsafe', url: 'javascript:alert(1)' }] }).validate());
  await new BlogPost({ ...article, ...review }).validate();
  await new BlogPost({ ...article, status: 'draft' }).validate();
  await new BlogPost({ ...article, contentType: 'service' }).validate();
});
test('public blog keeps legacy unclassified records as service and excludes unreviewed medical records', async t => {
  const app = Fastify(); t.after(() => app.close());
  await app.register(blogRoutes, { prefix: '/api' });
  t.mock.method(BlogPost, 'findOne', filter => {
    assert.ok(filter.$or.some(rule => rule.contentType?.$in?.includes('service') && rule.contentType.$in.includes(null)));
    assert.ok(filter.$or.some(rule => rule.contentType === 'medical' && rule.reviewStatus === 'approved' && rule.reviewedBy && rule.references));
    return { select(fields) { assert.equal(fields.reviewerCredentials, 1); return this; }, lean: async () => null };
  });
  assert.equal((await app.inject('/api/blog/posts/test-preparation')).statusCode, 404);
});
test('protected editor exposes SEO/review fields and preserves only allowed reference fields', () => {
  for (const field of ['seoTitle', 'seoDescription', 'contentType', 'reviewedBy', 'reviewerCredentials', 'reviewedAt', 'references']) assert.ok(blogAdminOptions.editProperties.includes(field));
  const result = prepareBlog({ method: 'post', payload: { contentType: 'medical', 'references.0.title': 'Source', 'references.0.url': 'https://medlineplus.gov/', 'references.0.secret': 'discard', injected: 'discard' } }, {});
  assert.equal(result.payload['references.0.url'], 'https://medlineplus.gov/');
  assert.equal(result.payload['references.0.secret'], undefined);
});
test('editing previously reviewed medical content requires a renewed review date', () => {
  const current = { ...article, ...review, reviewedAt: '2026-01-01', body: 'Previously reviewed.' };
  const result = prepareBlog({ method: 'post', payload: { ...current, body: 'Changed clinical claims.' } }, { record: { params: current } });
  assert.equal(result.payload.status, 'draft');
  assert.equal(result.payload.reviewStatus, 'unreviewed');
});
test('editing a reviewed article as a draft invalidates review before subsequent publication', () => {
  const current = { ...article, ...review, reviewedAt: '2026-01-01', body: 'Previously reviewed.' };
  const draft = prepareBlog({ method: 'post', payload: { ...current, status: 'draft', body: 'New unreviewed clinical claims.' } }, { record: { params: current } });
  assert.equal(draft.payload.reviewStatus, 'unreviewed');
  const publish = prepareBlog({ method: 'post', payload: { status: 'published' } }, { record: { params: { ...current, ...draft.payload } } });
  assert.equal(publish.payload.status, 'draft');
});
test('versioned website enquiries require explicit consent and persist provenance without echoing PII', async t => {
  const app = Fastify(); t.after(() => app.close());
  await app.register(leadRoutes, { prefix: '/api' });
  const saved = [];
  t.mock.method(Lead.collection, 'insertOne', async lead => { saved.push(lead); return { acknowledged: true, insertedId: lead._id }; });
  const payload = { type: 'LAUNCH_WAITLIST', phone: '9876543210', source: '/', formVersion: '2026-11', consentVersion: '2026-11-28', consent: true };
  for (const [index, consent] of [false, undefined, 'true'].entries()) assert.equal((await app.inject({ method: 'POST', url: '/api/leads', payload: { ...payload, consent }, remoteAddress: `192.0.2.${index}` })).statusCode, 400);
  const response = await app.inject({ method: 'POST', url: '/api/leads', payload, remoteAddress: '192.0.2.99' });
  assert.equal(response.statusCode, 201, response.body);
  assert.deepEqual(response.json(), { ok: true });
  assert.equal(saved[0].consentVersion, payload.consentVersion);
  assert.ok(saved[0].consentedAt instanceof Date);
  const bot = await app.inject({ method: 'POST', url: '/api/leads', payload: { ...payload, honeypot: 'bot' }, remoteAddress: '192.0.2.100' });
  assert.equal(bot.statusCode, 201); assert.equal(saved.length, 1);
});
test('contact enquiries require a name, message, and explicit consent', async t => {
  const app = Fastify(); t.after(() => app.close());
  await app.register(leadRoutes, { prefix: '/api' });
  const saved = [];
  t.mock.method(Lead.collection, 'insertOne', async lead => { saved.push(lead); return { acknowledged: true, insertedId: lead._id }; });
  const payload = { type: 'CONTACT', name: 'Visitor', phone: '9876543210', message: 'Please contact me', source: '/contact/', formVersion: '2026-11', consentVersion: '2026-11-28', consent: true };
  for (const [index, changed] of [{ name: ' ' }, { message: ' ' }, { consent: false }, { formVersion: undefined }].entries()) assert.equal((await app.inject({ method: 'POST', url: '/api/leads', payload: { ...payload, ...changed }, remoteAddress: `192.0.2.${index}` })).statusCode, 400);
  assert.equal((await app.inject({ method: 'POST', url: '/api/leads', payload, remoteAddress: '192.0.2.100' })).statusCode, 201);
  assert.equal(saved[0].message, payload.message);
  assert.ok(saved[0].consentedAt instanceof Date);
});
