import admin from 'firebase-admin';
import { readFileSync } from 'fs';

const keyPath = process.env.FIREBASE_SERVICE_ACCOUNT_PATH || './config/labzy-bd702-firebase-adminsdk-fbsvc-70083f5571.json';
const serviceAccount = JSON.parse(readFileSync(keyPath, 'utf8'));

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

export default admin;
