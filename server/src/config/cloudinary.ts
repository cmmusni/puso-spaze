// ─────────────────────────────────────────────
// src/config/cloudinary.ts
// Cloudinary client + upload helper.
// Images are stored in Cloudinary instead of the
// local filesystem so uploads survive redeploys.
// ─────────────────────────────────────────────

import { v2 as cloudinary } from 'cloudinary';
import { env } from './env';

cloudinary.config({
  cloud_name: env.CLOUDINARY_CLOUD_NAME,
  api_key: env.CLOUDINARY_API_KEY,
  api_secret: env.CLOUDINARY_API_SECRET,
  secure: true,
});

export { cloudinary };

/**
 * Upload a raw buffer to Cloudinary and return the secure URL.
 * @param buffer - File content from multer memoryStorage
 * @param folder - Cloudinary folder (e.g. 'puso-spaze/avatars')
 */
export function uploadBuffer(buffer: Buffer, folder: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        folder,
        resource_type: 'image',
        // Optimise at upload time: auto-quality + WebP/AVIF auto-format
        transformation: [
          { quality: 'auto', fetch_format: 'auto' },
        ],
      },
      (error, result) => {
        if (error || !result) {
          return reject(error ?? new Error('Cloudinary upload failed'));
        }
        resolve(result.secure_url);
      }
    );
    stream.end(buffer);
  });
}
