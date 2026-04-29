import admin from 'firebase-admin';
import { readFileSync } from 'fs';

let initialized = false;

export const initFirebase = () => {
  if (initialized || admin.apps.length > 0) {
    initialized = true;
    return admin;
  }

  const serviceAccountPath = process.env.FIREBASE_SERVICE_ACCOUNT_PATH;
  if (!serviceAccountPath) {
    console.warn('Firebase not initialized: FIREBASE_SERVICE_ACCOUNT_PATH not set');
    return null;
  }

  try {
    const serviceAccount = JSON.parse(readFileSync(serviceAccountPath, 'utf8'));
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
      storageBucket: process.env.FIREBASE_STORAGE_BUCKET,
    });
    initialized = true;
    console.log('Firebase initialized successfully');
    return admin;
  } catch (err) {
    console.warn('Firebase initialization failed:', err.message);
    return null;
  }
};

export default admin;
