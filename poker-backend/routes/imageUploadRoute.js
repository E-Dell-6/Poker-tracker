import express from 'express';
import multer from 'multer';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import crypto from 'crypto';
import userAuth from '../middleware/userAuth.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const router = express.Router();

const uploadsDir = path.join(__dirname, '../uploads/profile-images');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
  console.log('Created uploads directory at:', uploadsDir);
}

// SVG excluded on purpose: served statically, can embed <script> -> stored XSS
const ALLOWED_MIME_TO_EXT = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
  'image/gif': '.gif',
};

function hashBuffer(buffer) {
  return crypto.createHash('sha256').update(buffer).digest('hex');
}

// Checks actual file bytes, not the client-supplied mimetype
function sniffImageType(buffer) {
  if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return 'image/jpeg';
  if (buffer.length >= 8 && buffer.slice(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return 'image/png';
  if (buffer.length >= 12 && buffer.slice(0, 4).toString('ascii') === 'RIFF' && buffer.slice(8, 12).toString('ascii') === 'WEBP') return 'image/webp';
  if (buffer.length >= 6 && (buffer.slice(0, 6).toString('ascii') === 'GIF87a' || buffer.slice(0, 6).toString('ascii') === 'GIF89a')) return 'image/gif';
  return null;
}

function findDuplicateInDir(incomingHash, incomingSize) {
  let files;
  try {
    files = fs.readdirSync(uploadsDir);
  } catch {
    return null;
  }

  for (const filename of files) {
    const filePath = path.join(uploadsDir, filename);
    try {
      const stat = fs.statSync(filePath);
      if (stat.size !== incomingSize) continue;
      const buffer = fs.readFileSync(filePath);
      if (hashBuffer(buffer) === incomingHash) return filename;
    } catch {}
  }
  return null;
}

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (ALLOWED_MIME_TO_EXT[file.mimetype]) {
      cb(null, true);
    } else {
      cb(new Error('Only JPEG, PNG, WEBP, or GIF images are allowed!'));
    }
  }
});

router.post('/', userAuth, upload.single('image'), (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const sniffed = sniffImageType(req.file.buffer);
    if (!sniffed) {
      return res.status(400).json({ error: 'File content does not match a supported image type' });
    }

    const incomingHash = hashBuffer(req.file.buffer);
    const incomingSize = req.file.buffer.length;

    const duplicateFilename = findDuplicateInDir(incomingHash, incomingSize);
    if (duplicateFilename) {
      return res.status(200).json({
        success: true,
        imageUrl: `/uploads/profile-images/${duplicateFilename}`,
        filename: duplicateFilename,
        duplicate: true,
        message: 'This image has already been uploaded.',
      });
    }

    const ext = ALLOWED_MIME_TO_EXT[sniffed];
    const filename = `${Date.now()}-${Math.round(Math.random() * 1e9)}${ext}`;
    const filePath = path.join(uploadsDir, filename);

    fs.writeFileSync(filePath, req.file.buffer);

    res.status(200).json({
      success: true,
      imageUrl: `/uploads/profile-images/${filename}`,
      filename,
      duplicate: false,
    });
  } catch (error) {
    console.error('[UPLOAD] ERROR:', error);
    res.status(500).json({ error: 'Failed to upload image' });
  }
});

router.delete('/:filename', userAuth, (req, res) => {
  try {
    const safeName = path.basename(req.params.filename); // blocks path traversal
    const filePath = path.join(uploadsDir, safeName);
    const resolved = path.resolve(filePath);
    if (!resolved.startsWith(path.resolve(uploadsDir) + path.sep)) {
      return res.status(400).json({ error: 'Invalid filename' });
    }

    if (fs.existsSync(resolved)) {
      fs.unlinkSync(resolved);
      res.json({ success: true, message: 'Image deleted' });
    } else {
      res.status(404).json({ error: 'Image not found' });
    }
  } catch (error) {
    console.error('Delete error:', error);
    res.status(500).json({ error: 'Failed to delete image' });
  }
});

export default router;