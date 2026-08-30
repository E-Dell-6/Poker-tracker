import express from 'express';
import multer from 'multer';
import userAuth from '../middleware/userAuth.js';
import { ALLOWED_MIME_TO_EXT } from '../services/imageService.js';
import { uploadImage, removeImage } from '../controllers/imageController.js';

const router = express.Router();

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

router.post('/', userAuth, upload.single('image'), uploadImage);
router.delete('/:filename', userAuth, removeImage);

export default router;
