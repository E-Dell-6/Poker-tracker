import multer from 'multer';
import { saveImage, deleteImage } from '../services/imageService.js';

// multer's own middleware (file-size limit, fileFilter's rejected-type
// error) fails BEFORE uploadImage below ever runs, by calling next(err) -
// which skips straight to Express's default error handler and returns an
// HTML error page (with a stack trace) instead of JSON, unless an
// error-handling middleware (4 args) is wired in after it. This is that
// handler - keeps upload failures in the same JSON `{ error }` shape as
// every other response here.
export function handleUploadError(err, req, res, next) {
  if (!err) return next();
  if (err instanceof multer.MulterError && err.code === 'LIMIT_FILE_SIZE') {
    return res.status(400).json({ error: 'Image must be under 5MB' });
  }
  // Covers both other MulterErrors and the fileFilter's own thrown Error
  // (unsupported file type) - both carry a safe, user-facing message.
  res.status(400).json({ error: err.message || 'Failed to upload image' });
}

export function uploadImage(req, res) {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const result = saveImage(req.file.buffer);
    if (result.error === 'invalid-type') {
      return res.status(400).json({ error: 'File content does not match a supported image type' });
    }

    res.status(200).json({ success: true, ...result });
  } catch (error) {
    console.error('[UPLOAD] ERROR:', error);
    res.status(500).json({ error: 'Failed to upload image' });
  }
}

export function removeImage(req, res) {
  try {
    const deleted = deleteImage(req.params.filename);
    if (deleted) {
      res.json({ success: true, message: 'Image deleted' });
    } else {
      res.status(404).json({ error: 'Image not found' });
    }
  } catch (error) {
    if (error.code === 'INVALID_FILENAME') {
      return res.status(400).json({ error: 'Invalid filename' });
    }
    console.error('Delete error:', error);
    res.status(500).json({ error: 'Failed to delete image' });
  }
}
