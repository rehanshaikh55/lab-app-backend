import { initFirebase } from '../../config/firebase.js';

class FirebaseStorageAdapter {
  _getBucket() {
    const firebaseAdmin = initFirebase();
    if (!firebaseAdmin) {
      throw new Error('Firebase Storage not configured. Set FIREBASE_SERVICE_ACCOUNT_PATH and FIREBASE_STORAGE_BUCKET in .env');
    }
    return firebaseAdmin.storage().bucket();
  }

  async getSignedUrl(filePath) {
    try {
      const file = this._getBucket().file(filePath);
      const [url] = await file.getSignedUrl({
        action: 'read',
        expires: Date.now() + 60 * 60 * 1000, // 1 hour
      });
      return url;
    } catch (err) {
      console.warn('Could not generate signed URL:', err.message);
      return filePath; // graceful fallback
    }
  }

  async uploadBuffer(buffer, filePath, contentType = 'application/pdf') {
    const file = this._getBucket().file(filePath);
    await file.save(buffer, { contentType, resumable: false });
    return filePath;
  }

  async deleteFile(filePath) {
    await this._getBucket().file(filePath).delete();
  }
}

export const storage = new FirebaseStorageAdapter();