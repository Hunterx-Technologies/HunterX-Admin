// Largest image file the admin can upload (task artwork, coupon product
// images). Same limit as the backend (HunterX-Backend src/routes/admin.js
// MAX_IMAGE_BYTES). next.config.ts raises the Server Action body limit to
// fit two of these (a task's male + female artwork) plus form fields.
export const MAX_IMAGE_BYTES = 2 * 1024 * 1024;
export const MAX_IMAGE_LABEL = '2MB';

const toMb = (bytes: number) => (bytes / (1024 * 1024)).toFixed(1);

/** The error to show for a picked file, or null if it's fine. */
export function imageFileError(file: File): string | null {
  if (!file.type.startsWith('image/')) return `${file.name} isn't an image. Use WebP, PNG or JPG.`;
  if (file.size > MAX_IMAGE_BYTES) return `Images must be ${MAX_IMAGE_LABEL} or smaller (${file.name} is ${toMb(file.size)}MB).`;
  return null;
}
