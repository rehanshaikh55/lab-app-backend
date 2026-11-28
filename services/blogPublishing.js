// This hook is server-only. Never include it in website code or API responses.
export async function rebuildBlog(response, request) {
  if (request.method !== 'post' || response.notice?.type === 'error' || Object.keys(response.record?.errors || {}).length) return response;
  const hook = process.env.BLOG_DEPLOY_HOOK_URL;
  let message = 'Saved. Rebuild the website to apply this change (automatic publishing is not configured).';
  if (hook) {
    try {
      const url = new URL(hook);
      if (url.protocol !== 'https:' || url.hostname !== 'api.render.com') throw new Error('Invalid deploy hook');
      const result = await fetch(url, { method: 'POST', signal: AbortSignal.timeout(8000), redirect: 'error' });
      if (!result.ok) throw new Error('Deploy rejected');
      message = 'Saved. Website rebuild requested; the change appears after deployment completes.';
    } catch {
      message = 'Saved, but the website rebuild could not be requested. Check the deploy hook and rebuild the website manually.';
    }
  }
  return { ...response, notice: { type: 'info', message } };
}

export function prepareBlog(request, context) {
  if (request.method !== 'post') return request;
  const allowed = ['title', 'slug', 'excerpt', 'body', 'author', 'category', 'coverImage', 'seoTitle', 'seoDescription', 'status', 'contentType', 'reviewStatus', 'reviewedBy', 'reviewerCredentials', 'reviewedAt', 'references'];
  const payload = Object.fromEntries(Object.entries(request.payload || {}).filter(([key]) => allowed.includes(key) || /^references\.\d+\.(title|url)$/.test(key)));
  // AdminJS edit uses findOneAndUpdate; model document hooks do not run there.
  // Fail closed on edits too, including body changes to previously reviewed text.
  const current = context.record?.params || {};
  const merged = { ...current, ...payload };
  if (merged.contentType !== 'service') {
    const changed = ['body', 'title', 'excerpt'].some(key => key in payload && payload[key] !== current[key]);
    if (changed && (!payload.reviewedAt || Date.parse(payload.reviewedAt) <= Date.parse(current.reviewedAt))) payload.reviewStatus = 'unreviewed';
    const referenceKeys = Object.keys(merged).some(key => /^references\.\d+\.url$/.test(key) && /^https:\/\//.test(merged[key]));
    if (merged.status === 'published' && (payload.reviewStatus === 'unreviewed' || merged.reviewStatus !== 'approved' || !merged.reviewedBy?.trim() || !merged.reviewerCredentials?.trim() || !Number.isFinite(Date.parse(merged.reviewedAt)) || Date.parse(merged.reviewedAt) > Date.now() || !(merged.references?.length || referenceKeys))) payload.status = 'draft';
  }
  if (payload.status === 'published' && !context.record?.params.publishedAt) payload.publishedAt = new Date().toISOString();
  return { ...request, payload };
}

export const blogAdminOptions = {
  navigation: { name: 'Website', icon: 'FileText' },
  sort: { sortBy: 'updatedAt', direction: 'desc' },
  listProperties: ['title', 'contentType', 'reviewStatus', 'status', 'publishedAt', 'updatedAt'],
  filterProperties: ['title', 'status', 'category', 'author', 'contentType', 'reviewStatus'],
  editProperties: ['title', 'slug', 'excerpt', 'body', 'author', 'category', 'coverImage', 'seoTitle', 'seoDescription', 'contentType', 'reviewStatus', 'reviewedBy', 'reviewerCredentials', 'reviewedAt', 'references', 'status'],
  properties: {
    body: { type: 'textarea', props: { rows: 24 }, description: 'Plain text. Separate paragraphs with a blank line. HTML is displayed as text.' },
    excerpt: { type: 'textarea' },
    slug: { description: 'Unique URL name, e.g. booking-lab-tests-ahmedabad. Lowercase letters, numbers and hyphens only. Keep stable after publishing.' },
    coverImage: { description: 'Optional HTTPS image URL. Use an image you have permission to publish.' },
    author: { description: 'Actual author or editorial team. Have medical content reviewed before publishing.' },
    contentType: { description: 'Use service only for nonclinical product/booking content. All clinical or preparation advice is medical.' },
    reviewStatus: { description: 'Approval requires a real qualified reviewer, verified credentials, completed review date and authoritative references. Never invent these.' },
    reviewerCredentials: { type: 'textarea' },
    status: { availableValues: [{ value: 'draft', label: 'Draft' }, { value: 'published', label: 'Published' }] },
  },
  actions: {
    new: { before: prepareBlog, after: rebuildBlog }, edit: { before: prepareBlog, after: rebuildBlog }, delete: { after: rebuildBlog },
    bulkDelete: { isAccessible: false },
  },
};
