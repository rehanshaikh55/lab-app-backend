
import admin from '../config/firebase.js';
import User from '../models/user.js';

export async function verifyFirebaseToken(request, reply) {
  const authHeader = request.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    return reply.code(401).send({ message: 'Missing Firebase ID token' });
  }
  const idToken = authHeader.split('Bearer ')[1];
  try {
    const decoded = await admin.auth().verifyIdToken(idToken);
    let user = await User.findOne({ firebaseUid: decoded.uid });
    if (!user) {
      user = await User.create({
        firebaseUid: decoded.uid,
        email: decoded.email,
        name: decoded.name,
        role: 'user',
        picture: decoded.picture,
      });
    }
    request.user = user;
  } catch (err) {
    return reply.code(401).send({ message: 'Invalid Firebase ID token', error: err.message });
  }
}
