// Web page behind the "reset your password" email link. Served by the backend
// itself so no separate website is needed. The form posts to the existing
// POST /api/auth/reset-password/:token endpoint.

const TOKEN_RE = /^[a-f0-9]{64}$/; // authService: crypto.randomBytes(32).toString('hex')

const page = (body) => `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex">
<title>Reset password · Labzy</title>
<style>
  :root { color-scheme: light dark; --bg:#f6f7f9; --card:#fff; --text:#111827; --muted:#6b7280; --accent:#0f766e; --err:#b91c1c; --border:#d1d5db; }
  @media (prefers-color-scheme: dark) { :root { --bg:#0b0f14; --card:#151b23; --text:#e5e7eb; --muted:#9ca3af; --border:#374151; --accent:#14b8a6; --err:#f87171; } }
  * { box-sizing: border-box; }
  body { margin:0; min-height:100vh; display:grid; place-items:center; background:var(--bg); color:var(--text);
         font:16px/1.5 system-ui,-apple-system,"Segoe UI",Roboto,sans-serif; padding:16px; }
  .card { width:100%; max-width:380px; background:var(--card); border:1px solid var(--border); border-radius:14px; padding:28px; }
  h1 { font-size:22px; margin:0 0 6px; }
  p { margin:0 0 18px; color:var(--muted); }
  label { display:block; font-size:14px; margin:14px 0 6px; }
  input { width:100%; padding:12px; font-size:16px; border:1px solid var(--border); border-radius:10px; background:transparent; color:inherit; }
  button { width:100%; margin-top:20px; padding:12px; font-size:16px; font-weight:600; color:#fff; background:var(--accent); border:0; border-radius:10px; cursor:pointer; }
  button:disabled { opacity:.6; cursor:default; }
  .msg { margin-top:16px; font-size:14px; }
  .err { color:var(--err); }
</style>
</head>
<body><main class="card">${body}</main></body>
</html>`;

const formBody = (token) => `
  <h1>Set a new password</h1>
  <p>Choose a new password for your Labzy account.</p>
  <form id="f" novalidate>
    <label for="p1">New password</label>
    <input id="p1" type="password" autocomplete="new-password" minlength="6" required>
    <label for="p2">Confirm password</label>
    <input id="p2" type="password" autocomplete="new-password" minlength="6" required>
    <button id="b" type="submit">Reset password</button>
    <div id="m" class="msg" role="status"></div>
  </form>
  <script>
    const f = document.getElementById('f'), b = document.getElementById('b'), m = document.getElementById('m');
    const say = (t, err) => { m.textContent = t; m.className = 'msg' + (err ? ' err' : ''); };
    f.addEventListener('submit', async (e) => {
      e.preventDefault();
      const p1 = document.getElementById('p1').value, p2 = document.getElementById('p2').value;
      if (p1.length < 6) return say('Use at least 6 characters.', true);
      if (p1 !== p2) return say('The passwords do not match.', true);
      b.disabled = true; say('Saving…');
      try {
        const r = await fetch('/api/auth/reset-password/${token}', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ newPassword: p1 }),
        });
        if (r.ok) {
          f.innerHTML = '<h1>Password updated</h1><p>You can now log in to the Labzy app with your new password.</p>';
          return;
        }
        const d = await r.json().catch(() => ({}));
        say(d.detail || 'This link is invalid or has expired. Request a new one from the app.', true);
      } catch { say('Network error. Check your connection and try again.', true); }
      b.disabled = false;
    });
  </script>`;

const invalidBody = `
  <h1>Link not valid</h1>
  <p class="err">This reset link is broken. Open the Labzy app and tap "Forgot password" to get a new one.</p>`;

export const resetPasswordPageRoutes = async (fastify) => {
  fastify.get('/reset-password/:token', async (req, reply) => {
    const { token } = req.params;
    reply
      .type('text/html; charset=utf-8')
      .header('Cache-Control', 'no-store')
      .header('Referrer-Policy', 'no-referrer');
    if (!TOKEN_RE.test(token)) return reply.code(400).send(page(invalidBody));
    return reply.send(page(formBody(token)));
  });
};
