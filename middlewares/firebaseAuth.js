import admin from '../config/firebase.js';

// Only verify Firebase token; no custom user sync
export async function verifyFirebaseToken(request, reply) {
  const authHeader = request.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    return reply.code(401).send({ message: 'Missing Firebase ID token' });
  }
  const idToken = authHeader.split('Bearer ')[1];
  try {
    const decoded = await admin.auth().verifyIdToken(idToken);
    request.firebaseUser = decoded;
  } catch (err) {
    return reply.code(401).send({ message: 'Invalid Firebase ID token', error: err.message });
  }
}
