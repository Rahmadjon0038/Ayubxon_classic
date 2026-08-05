import crypto from 'crypto';
import fs from 'fs/promises';
import path from 'path';
import axios from 'axios';
import { env } from '../config/env';
import { UPLOAD_DIR } from './uploads';

const EXT_BY_CONTENT_TYPE: Record<string, string> = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
  'image/gif': '.gif',
};

// Bizning /uploads orqali berilayotgan (ozimiz saqlagan) rasmmi, yoki tashqi (masalan Meta CDN) havolami tekshiradi.
export function isLocalUploadUrl(url: string | null | undefined): boolean {
  if (!url) return false;
  try {
    return new URL(url).pathname.startsWith('/uploads/');
  } catch {
    return false;
  }
}

// Instagram'ning profil rasm havolasi vaqtinchalik — bir necha soat/kundan keyin muddati tugaydi
// va rasm korinmay qoladi. Shuning uchun rasmni ozimizga yuklab olib, doimiy /uploads havolasi
// sifatida saqlaymiz (attachmentlar kabi).
export async function downloadContactAvatar(sourceUrl: string): Promise<string | null> {
  if (!env.BACKEND_URL) return null;
  try {
    const response = await axios.get<ArrayBuffer>(sourceUrl, {
      responseType: 'arraybuffer',
      timeout: 15_000,
    });
    const contentType = String(response.headers['content-type'] ?? 'image/jpeg').split(';')[0];
    const ext = EXT_BY_CONTENT_TYPE[contentType] ?? '.jpg';
    const filename = `${crypto.randomUUID()}${ext}`;
    await fs.writeFile(path.join(UPLOAD_DIR, filename), Buffer.from(response.data));
    return `${env.BACKEND_URL.replace(/\/$/, '')}/uploads/${filename}`;
  } catch (err) {
    console.warn('[avatar] Kontakt rasmi yuklab olinmadi:', err instanceof Error ? err.message : err);
    return null;
  }
}
