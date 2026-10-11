// Images stored in the vault: <vault>/attachments/<name>-<hash>.<ext>, referenced vault-relative
// ("attachments/x.png") by image nodes (data.imagePath) and in markdown (![alt](attachments/x.png)).

export const ATTACHMENTS_DIR = 'attachments';
export const MAX_IMAGE_BYTES = 20 * 1024 * 1024;

const IMAGE_TYPES: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/gif': 'gif',
  'image/webp': 'webp',
  'image/svg+xml': 'svg',
  'image/avif': 'avif',
  'image/bmp': 'bmp',
};

export const IMAGE_EXTENSIONS = ['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg', 'avif', 'bmp'];

export function isImageFileName(name: string): boolean {
  return IMAGE_EXTENSIONS.includes(name.split('.').pop()?.toLowerCase() ?? '');
}

/** File extension for an image MIME type, or null when it is not an image we store. */
export function imageExtension(mime: string): string | null {
  return IMAGE_TYPES[mime.toLowerCase().split(';')[0].trim()] ?? null;
}

/** Recognises the common image formats from their first bytes (content type headers are not trusted). */
export function sniffImageType(bytes: Uint8Array): string | null {
  const b = bytes;
  if (b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) return 'image/png';
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return 'image/jpeg';
  if (b[0] === 0x47 && b[1] === 0x49 && b[2] === 0x46) return 'image/gif';
  if (b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x46 && b[8] === 0x57 && b[9] === 0x45 && b[10] === 0x42 && b[11] === 0x50) return 'image/webp';
  if (b[0] === 0x42 && b[1] === 0x4d) return 'image/bmp';
  if (b[4] === 0x66 && b[5] === 0x74 && b[6] === 0x79 && b[7] === 0x70 && b[8] === 0x61 && b[9] === 0x76 && b[10] === 0x69) return 'image/avif';
  const head = new TextDecoder().decode(b.slice(0, 512)).trimStart().toLowerCase();
  if (head.startsWith('<svg') || (head.startsWith('<?xml') && head.includes('<svg'))) return 'image/svg+xml';
  return null;
}

/** Pixel size of PNG, GIF, JPEG and WebP images; null for other formats or unreadable headers. */
export function imageSize(bytes: Uint8Array): { width: number; height: number } | null {
  const b = bytes;
  const view = new DataView(b.buffer, b.byteOffset, b.byteLength);
  try {
    switch (sniffImageType(b)) {
      case 'image/png':
        return { width: view.getUint32(16), height: view.getUint32(20) };
      case 'image/gif':
        return { width: view.getUint16(6, true), height: view.getUint16(8, true) };
      case 'image/webp': {
        const chunk = String.fromCharCode(b[12], b[13], b[14], b[15]);
        if (chunk === 'VP8X') return { width: 1 + (b[24] | (b[25] << 8) | (b[26] << 16)), height: 1 + (b[27] | (b[28] << 8) | (b[29] << 16)) };
        if (chunk === 'VP8L') {
          const bits = view.getUint32(21, true);
          return { width: 1 + (bits & 0x3fff), height: 1 + ((bits >> 14) & 0x3fff) };
        }
        if (chunk === 'VP8 ') return { width: view.getUint16(26, true) & 0x3fff, height: view.getUint16(28, true) & 0x3fff };
        return null;
      }
      case 'image/jpeg': {
        let i = 2;
        while (i + 9 < b.length) {
          if (b[i] !== 0xff) return null;
          const marker = b[i + 1];
          const length = view.getUint16(i + 2);
          // SOF0..SOF15 except DHT (C4), JPG (C8) and DAC (CC) carry the frame size.
          if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) {
            return { width: view.getUint16(i + 7), height: view.getUint16(i + 5) };
          }
          i += 2 + length;
        }
        return null;
      }
    }
  } catch {
    // Truncated header.
  }
  return null;
}

/** A vault-relative path inside attachments/ with no way out of it. */
export function isAttachmentPath(path: string): boolean {
  if (!path.startsWith(`${ATTACHMENTS_DIR}/`) || path.includes('\\') || path.includes(':')) return false;
  return path.split('/').every((part) => part && part !== '.' && part !== '..');
}

/** Short content hash used in attachment file names. */
export async function contentHash(bytes: Uint8Array): Promise<string> {
  const digest = new Uint8Array(await globalThis.crypto.subtle.digest('SHA-256', bytes as BufferSource));
  return [...digest.slice(0, 5)].map((x) => x.toString(16).padStart(2, '0')).join('');
}

/** Stable file name: a slug of the original name plus a content hash, so the same image is stored once. */
export async function attachmentFileName(bytes: Uint8Array, originalName: string, ext: string): Promise<string> {
  const hash = await contentHash(bytes);
  const stem = originalName.replace(/\.[^.]+$/, '').normalize('NFKD').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40) || 'image';
  return `${stem}-${hash}.${ext}`;
}

/** Decodes a data: URL (base64 or percent-encoded) into its MIME type and bytes. */
export function decodeDataUrl(url: string): { mime: string; bytes: Uint8Array } | null {
  const m = /^data:([^;,]+)?((?:;[^;,]+)*?)(;base64)?,(.*)$/s.exec(url);
  if (!m) return null;
  const mime = m[1] ?? 'text/plain';
  if (m[3]) {
    const bin = atob(m[4].replace(/\s+/g, ''));
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return { mime, bytes };
  }
  return { mime, bytes: new TextEncoder().encode(decodeURIComponent(m[4])) };
}
