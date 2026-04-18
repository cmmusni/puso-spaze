// ─────────────────────────────────────────────
// utils/optimizeImage.ts
// Cloudinary URL transformer for on-the-fly image optimisation.
// Inserts f_auto (WebP/AVIF), q_auto, and optional width
// so the CDN delivers the smallest possible image.
// ─────────────────────────────────────────────

/**
 * Transform a Cloudinary URL to include resize / format / quality params.
 * Non-Cloudinary URLs are returned unchanged.
 *
 * @param url - Original image URL (may be Cloudinary or legacy)
 * @param width - Desired display width in CSS pixels (optional)
 */
export function optimizeCloudinaryUrl(
  url: string | null | undefined,
  width?: number,
): string {
  if (!url) return '';

  // Only transform Cloudinary URLs
  if (!url.includes('res.cloudinary.com')) return url;

  // Cloudinary URL pattern:
  //   https://res.cloudinary.com/{cloud}/image/upload/{existing_transforms/}{version}/{path}
  // We insert our transforms right after "/upload/"
  const parts = url.split('/upload/');
  if (parts.length !== 2) return url;

  const transforms = ['f_auto', 'q_auto'];
  if (width && width > 0) {
    // Request 2× for retina displays, capped at 1600px
    const w = Math.min(Math.round(width * 2), 1600);
    transforms.push(`w_${w}`);
  }

  return `${parts[0]}/upload/${transforms.join(',')}/${parts[1]}`;
}
