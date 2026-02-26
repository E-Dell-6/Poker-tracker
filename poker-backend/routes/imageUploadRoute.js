import express from 'express';
import multer from 'multer';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import crypto from 'crypto';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const router = express.Router();

const uploadsDir = path.join(__dirname, '../uploads/profile-images');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
  console.log('Created uploads directory at:', uploadsDir);
}

function hashBuffer(buffer) {
  return crypto.createHash('sha256').update(buffer).digest('hex');
}

function findDuplicateInDir(incomingHash, incomingSize) {
  let files;
  try {
    files = fs.readdirSync(uploadsDir);
  } catch {
    return null;
  }

  console.log(`[DEDUP] Scanning ${files.length} existing file(s) in ${uploadsDir}`);

  for (const filename of files) {
    const filePath = path.join(uploadsDir, filename);
    try {
      const stat = fs.statSync(filePath);
      const existingSize = stat.size;

      console.log(`[DEDUP]   Checking: ${filename} | size: ${existingSize} bytes`);

      if (existingSize !== incomingSize) {
        console.log(`[DEDUP]     → Size mismatch (${incomingSize} vs ${existingSize}), skipping`);
        continue;
      }

      const buffer = fs.readFileSync(filePath);
      const existingHash = hashBuffer(buffer);
      console.log(`[DEDUP]     → Size match! Comparing hashes: incoming=${incomingHash} existing=${existingHash}`);

      if (existingHash === incomingHash) {
        console.log(`[DEDUP]     → DUPLICATE FOUND: ${filename}`);
        return filename;
      } else {
        console.log(`[DEDUP]     → Hash mismatch, not a duplicate`);
      }
    } catch (err) {
      console.warn(`[DEDUP]   Could not read ${filename}:`, err.message);
    }
  }

  console.log(`[DEDUP] No duplicate found.`);
  return null;
}

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed!'));
    }
  }
});

// POST /api/upload-image
router.post('/', upload.single('image'), (req, res) => {
  try {
    if (!req.file) {
      console.log('[UPLOAD] No file in request');
      return res.status(400).json({ error: 'No file uploaded' });
    }

    console.log('[UPLOAD] ─────────────────────────────────');
    console.log('[UPLOAD] Original name :', req.file.originalname);
    console.log('[UPLOAD] MIME type     :', req.file.mimetype);
    console.log('[UPLOAD] Buffer size   :', req.file.buffer.length, 'bytes');

    const incomingHash = hashBuffer(req.file.buffer);
    const incomingSize = req.file.buffer.length;

    console.log('[UPLOAD] SHA-256 hash  :', incomingHash);

    const duplicateFilename = findDuplicateInDir(incomingHash, incomingSize);

    if (duplicateFilename) {
      const imageUrl = `/uploads/profile-images/${duplicateFilename}`;
      console.log('[UPLOAD] → Returning duplicate, no file written:', imageUrl);
      return res.status(200).json({
        success: true,
        imageUrl,
        filename: duplicateFilename,
        duplicate: true,
        message: 'This image has already been uploaded.',
      });
    }

    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    const filename = uniqueSuffix + path.extname(req.file.originalname);
    const filePath = path.join(uploadsDir, filename);

    fs.writeFileSync(filePath, req.file.buffer);

    const writtenSize = fs.statSync(filePath).size;
    console.log('[UPLOAD] → New file written:', filePath);
    console.log('[UPLOAD]   Written size    :', writtenSize, 'bytes');

    const imageUrl = `/uploads/profile-images/${filename}`;
    res.status(200).json({
      success: true,
      imageUrl,
      filename,
      duplicate: false,
    });
  } catch (error) {
    console.error('[UPLOAD] ERROR:', error);
    res.status(500).json({ error: 'Failed to upload image' });
  }
});

// DELETE /api/upload-image/:filename
router.delete('/:filename', (req, res) => {
  try {
    const filename = req.params.filename;
    const filePath = path.join(uploadsDir, filename);

    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
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