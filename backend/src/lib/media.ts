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
  'video/mp4': '.mp4',
  'video/quicktime': '.mov',
  'video/webm': '.webm',
};

export interface DownloadedMedia {
  localUrl: string;
  type: 'image' | 'video';
}

// Instagramning vaqtinchalik (imzoli, muddati tugaydigan) media havolalarini — masalan
// story_mention orqali kelgan asset — ozimizga yuklab olib, doimiy /uploads havolasiga
// aylantiradi. Content-Type asosida rasm yoki video ekanini aniqlaydi.
export async function downloadRemoteMedia(sourceUrl: string): Promise<DownloadedMedia | null> {
  if (!env.BACKEND_URL) return null;
  try {
    const response = await axios.get<ArrayBuffer>(sourceUrl, {
      responseType: 'arraybuffer',
      timeout: 30_000,
      maxContentLength: 50 * 1024 * 1024,
    });
    const contentType = String(response.headers['content-type'] ?? '').split(';')[0];
    const ext = EXT_BY_CONTENT_TYPE[contentType];
    if (!ext) {
      console.warn(`[media] Notanish content-type, yuklab olinmadi: ${contentType || '-'}`);
      return null;
    }
    const type: 'image' | 'video' = contentType.startsWith('video/') ? 'video' : 'image';
    const filename = `${crypto.randomUUID()}${ext}`;
    await fs.writeFile(path.join(UPLOAD_DIR, filename), Buffer.from(response.data));
    return { localUrl: `${env.BACKEND_URL.replace(/\/$/, '')}/uploads/${filename}`, type };
  } catch (err) {
    console.warn('[media] Media yuklab olinmadi:', err instanceof Error ? err.message : err);
    return null;
  }
}
