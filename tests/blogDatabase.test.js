import { test } from 'node:test';
import assert from 'node:assert/strict';
import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose from 'mongoose';
import Fastify from 'fastify';
import BlogPost from '../models/blogPost.js';
import { blogRoutes } from '../routes/blogRoutes.js';
import { prepareBlog } from '../services/blogPublishing.js';

test('persisted editorial lifecycle publishes, edits and withdraws articles without leaking drafts', async () => {
  const mongo = await MongoMemoryServer.create();
  const app = Fastify();
  try {
    await mongoose.connect(mongo.getUri());
    await BlogPost.init();
    await app.register(blogRoutes, { prefix: '/api' });
    const data = { contentType: 'service', title: 'Real article', slug: 'real-article', body: 'A paragraph.', excerpt: 'Summary.', author: 'Test author' };
    const draft = await BlogPost.create(data);
    await BlogPost.create({ ...data, slug: 'future-article', status: 'published', publishedAt: new Date(Date.now() + 86400000) });
    assert.equal((await app.inject('/api/blog/posts')).json().total, 0);
    assert.equal((await app.inject('/api/blog/posts/real-article')).statusCode, 404);
    const update = prepareBlog({ method: 'post', payload: { status: 'published' } }, { record: { params: draft.toObject() } });
    await BlogPost.findOneAndUpdate({ _id: draft._id }, { $set: update.payload }, { runValidators: true });
    const publicPost = (await app.inject('/api/blog/posts/real-article')).json();
    assert.equal(publicPost.title, data.title);
    assert.ok(publicPost.publishedAt);
    assert.equal(publicPost._id, undefined);
    assert.equal(publicPost.status, undefined);
    assert.equal((await app.inject('/api/blog/posts')).json().total, 1);
    await assert.rejects(BlogPost.create({ ...data, status: 'published' }), error => error.code === 11000);
    await BlogPost.updateOne({ _id: draft._id }, { status: 'draft' });
    assert.equal((await app.inject('/api/blog/posts/real-article')).statusCode, 404);
    assert.equal((await app.inject('/api/blog/posts')).json().total, 0);
  } finally {
    await app.close();
    await mongoose.disconnect();
    await mongo.stop();
  }
});
