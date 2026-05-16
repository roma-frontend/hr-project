/**
 * Server-side input sanitization for user-generated content.
 * Strips HTML tags and dangerous patterns to prevent stored XSS.
 */

/** Strip all HTML tags from input */
export function stripHtml(input: string): string {
  return input.replace(/<[^>]*>/g, '');
}

/** Sanitize user text input — strip HTML, trim, limit length */
export function sanitizeText(input: string, maxLength = 10_000): string {
  return stripHtml(input).trim().slice(0, maxLength);
}

/** Sanitize a short field (title, name) — strip HTML, trim, limit */
export function sanitizeTitle(input: string, maxLength = 500): string {
  return stripHtml(input).trim().slice(0, maxLength);
}
