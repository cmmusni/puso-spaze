// ─────────────────────────────────────────────
// src/utils/validateImageMagicBytes.ts
// QUALITY.md Scenario 8: Validate uploaded files
// by checking magic bytes, not just MIME headers.
// ─────────────────────────────────────────────

import fs from 'fs';

/**
 * Known image magic byte signatures.
 * Returns true if the file starts with a valid image signature.
 */
export function isValidImageFile(filePath: string): boolean {
  try {
    const fd = fs.openSync(filePath, 'r');
    const header = Buffer.alloc(12);
    fs.readSync(fd, header, 0, 12, 0);
    fs.closeSync(fd);

    // JPEG: FF D8 FF
    if (header[0] === 0xFF && header[1] === 0xD8 && header[2] === 0xFF) {
      return true;
    }

    // PNG: 89 50 4E 47 0D 0A 1A 0A
    if (
      header[0] === 0x89 && header[1] === 0x50 &&
      header[2] === 0x4E && header[3] === 0x47 &&
      header[4] === 0x0D && header[5] === 0x0A &&
      header[6] === 0x1A && header[7] === 0x0A
    ) {
      return true;
    }

    // GIF: GIF87a or GIF89a
    if (
      header[0] === 0x47 && header[1] === 0x49 && header[2] === 0x46 &&
      header[3] === 0x38 && (header[4] === 0x37 || header[4] === 0x39) &&
      header[5] === 0x61
    ) {
      return true;
    }

    // WebP: RIFF....WEBP
    if (
      header[0] === 0x52 && header[1] === 0x49 &&
      header[2] === 0x46 && header[3] === 0x46 &&
      header[8] === 0x57 && header[9] === 0x45 &&
      header[10] === 0x42 && header[11] === 0x50
    ) {
      return true;
    }

    return false;
  } catch {
    return false;
  }
}
