import fs from 'fs/promises';
import path from 'path';
import { detectPokerFileFormat } from '../utils/parsePokerLog.js';
import { UPLOAD } from '../config/limits.js';

// Content validation for staged import files.
//
// The extension check is a cheap first pass, not the gate - anything can
// be named .txt. The real check reads the file's leading bytes and asks
// detectPokerFileFormat (utils/parsePokerLog.js) to identify it, the same
// sniff the parser dispatcher already uses. A file that doesn't resolve to
// ACR, GGPOKER, or POKERNOW never gets queued, so junk is rejected while
// it's one small file on disk rather than after a parser has tried to
// build hand objects out of it.
//
// This mirrors the approach imageService.js already takes with
// sniffImageType: trust the bytes, not the client.

// Rejects binary content before it ever reaches a text parser. A NUL byte
// is the giveaway - no legitimate hand history has one, and every common
// binary container (JPEG, PNG, zip, PDF) hits one almost immediately.
function looksBinary(buffer) {
  return buffer.includes(0x00);
}

export function hasAllowedExtension(filename) {
  return UPLOAD.ALLOWED_EXTENSIONS.includes(path.extname(filename).toLowerCase());
}

// multer fileFilter. Only the cheap checks belong here: this runs while
// the request is still streaming, before the file is fully on disk, so the
// content sniff can't happen yet.
export function importFileFilter(req, file, cb) {
  if (!hasAllowedExtension(file.originalname)) {
    return cb(new Error(`${file.originalname}: only .txt and .csv hand history files are accepted`));
  }
  cb(null, true);
}

// Reads the head of a staged file and identifies it. Returns
// { format } on success or { error } with a user-facing message.
// Never throws for bad content - an unreadable or unrecognizable file is
// an expected outcome here, not an exception.
export async function sniffStagedFile(storedPath) {
  let handle;
  try {
    handle = await fs.open(storedPath, 'r');
    const buffer = Buffer.alloc(UPLOAD.SNIFF_BYTES);
    const { bytesRead } = await handle.read(buffer, 0, UPLOAD.SNIFF_BYTES, 0);
    const head = buffer.subarray(0, bytesRead);

    if (bytesRead === 0) {
      return { error: 'File is empty' };
    }
    if (looksBinary(head)) {
      return { error: 'File contains binary data, not a text hand history' };
    }

    // Decode leniently: a truncated multi-byte character at the 64KB
    // boundary is an artifact of only reading the head, not a bad file.
    const text = head.toString('utf8');
    const format = detectPokerFileFormat(text);
    if (format === 'UNKNOWN') {
      return {
        error: 'Unrecognized file format. Expected a PokerNow CSV export, ' +
               'an ACR hand history .txt export, or a GGPoker hand history .txt export.',
      };
    }
    return { format };
  } catch (err) {
    return { error: `Could not read file: ${err.message}` };
  } finally {
    await handle?.close();
  }
}
