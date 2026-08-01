// Allow-list matches the platform's stated attachment support (PDF, Word,
// Excel, PowerPoint, images, videos, drawings, zip). Validated against the
// browser-declared MIME type — a first line of defense, not a substitute for
// virus scanning in a hardened production deployment.
export const ALLOWED_MIME_TYPES = new Set<string>([
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-powerpoint",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "image/jpeg",
  "image/png",
  "image/gif",
  "video/mp4",
  "application/zip",
  "application/x-zip-compressed",
]);

export const MAX_ATTACHMENT_SIZE = 100 * 1024 * 1024; // 100MB
