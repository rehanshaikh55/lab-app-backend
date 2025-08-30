import 'dotenv/config';
import admin from 'firebase-admin';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const keyPath = process.env.FIREBASE_SERVICE_ACCOUNT_PATH;
if (!keyPath) throw new Error('FIREBASE_SERVICE_ACCOUNT_PATH not defined');
const serviceAccount = JSON.parse(
  readFileSync(resolve(process.cwd(), keyPath), 'utf8')
);

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});
console.log('✅ Firebase Admin initialized');

export default admin;
