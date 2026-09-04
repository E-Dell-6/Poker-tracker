import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import crypto from 'crypto';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const uploadsDir = path.join(__dirname, '../uploads/profile-images');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
  console.log('Created uploads directory at:', uploadsDir);
}

// SVG excluded on purpose: served statically, can embed <script> -> stored XSS
export const ALLOWED_MIME_TO_EXT = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
  'image/gif': '.gif',
};

export function hashBuffer(buffer) {
  return crypto.createHash('sha256').update(buffer).digest('hex');
}

// Checks actual file bytes, not the client-supplied mimetype
export function sniffImageType(buffer) {
  if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return 'image/jpeg';
  if (buffer.length >= 8 && buffer.slice(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return 'image/png';
  if (buffer.length >= 12 && buffer.slice(0, 4).toString('ascii') === 'RIFF' && buffer.slice(8, 12).toString('ascii') === 'WEBP') return 'image/webp';
  if (buffer.length >= 6 && (buffer.slice(0, 6).toString('ascii') === 'GIF87a' || buffer.slice(0, 6).toString('ascii') === 'GIF89a')) return 'image/gif';
  return null;
}

// Returns { imageUrl, filename, duplicate } on success, or
// { error: 'no-file' | 'invalid-type' } to let the controller pick the
// right 400 message.
export function saveImage(buffer) {
  const sniffed = sniffImageType(buffer);
  if (!sniffed) {
    return { error: 'invalid-type' };
  }

  // Name the file after its own content hash. Deduplication is then a
  // single stat() on a known path, rather than what this used to do: read
  // and SHA-256 *every* file in the directory on every upload, which is an
  // O(files-on-disk) burst of synchronous disk I/O per request and a
  // steadily worsening DoS vector as the directory grows.
  //
  // The extension still comes from the sniffed type, never the client's.
  const ext = ALLOWED_MIME_TO_EXT[sniffed];
  const filename = `${hashBuffer(buffer)}${ext}`;
  const filePath = path.join(uploadsDir, filename);

  // Files uploaded before this change have timestamp names and won't be
  // matched here, so a re-upload of one is stored once more under its hash
  // name. That's a one-time cost on legacy images; every URL already handed
  // out keeps working, because nothing is renamed or removed.
  if (fs.existsSync(filePath)) {
    return {
      imageUrl: `/uploads/profile-images/${filename}`,
      filename,
      duplicate: true,
      message: 'This image has already been uploaded.',
    };
  }

  fs.writeFileSync(filePath, buffer);

  return {
    imageUrl: `/uploads/profile-images/${filename}`,
    filename,
    duplicate: false,
  };
}

// Returns true if the file was deleted, false if it didn't exist. Throws
// only for an unsafe filename (path traversal attempt).
export function deleteImage(filename) {
  const safeName = path.basename(filename); // blocks path traversal
  const filePath = path.join(uploadsDir, safeName);
  const resolved = path.resolve(filePath);
  if (!resolved.startsWith(path.resolve(uploadsDir) + path.sep)) {
    const err = new Error('Invalid filename');
    err.code = 'INVALID_FILENAME';
    throw err;
  }

  if (fs.existsSync(resolved)) {
    fs.unlinkSync(resolved);
    return true;
  }
  return false;
}
