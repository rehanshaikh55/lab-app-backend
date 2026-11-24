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
  const allowed = ['title', 'slug', 'excerpt', 'body', 'author', 'category', 'coverImage', 'seoTitle', 'seoDescription', 'status'];
  const payload = Object.fromEntries(allowed.filter(key => key in (request.payload || {})).map(key => [key, request.payload[key]]));
  if (payload.status === 'published' && !context.record?.params.publishedAt) payload.publishedAt = new Date().toISOString();
  return { ...request, payload };
}

export const blogAdminOptions = {
  navigation: { name: 'Website', icon: 'FileText' },
  sort: { sortBy: 'updatedAt', direction: 'desc' },
  listProperties: ['title', 'author', 'status', 'publishedAt', 'updatedAt'],
  filterProperties: ['title', 'status', 'category', 'author'],
  editProperties: ['title', 'slug', 'excerpt', 'body', 'author', 'category', 'coverImage', 'seoTitle', 'seoDescription', 'status'],
  properties: {
    body: { type: 'textarea', props: { rows: 24 }, description: 'Plain text. Separate paragraphs with a blank line. HTML is displayed as text.' },
    excerpt: { type: 'textarea' },
    slug: { description: 'Unique URL name, e.g. booking-lab-tests-ahmedabad. Lowercase letters, numbers and hyphens only. Keep stable after publishing.' },
    coverImage: { description: 'Optional HTTPS image URL. Use an image you have permission to publish.' },
    author: { description: 'Actual author or editorial team. Have medical content reviewed before publishing.' },
    status: { availableValues: [{ value: 'draft', label: 'Draft' }, { value: 'published', label: 'Published' }] },
  },
  actions: {
    new: { before: prepareBlog, after: rebuildBlog }, edit: { before: prepareBlog, after: rebuildBlog }, delete: { after: rebuildBlog },
    bulkDelete: { isAccessible: false },
  },
};
