import { saveImage, deleteImage } from '../services/imageService.js';

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
