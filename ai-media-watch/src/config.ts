/**
 * Адрес бэкенда.
 * Локально: http://localhost:3001 (по умолчанию).
 * На Vercel: задаётся переменной окружения VITE_BACKEND_URL
 * (например, публичный URL туннеля ngrok/cloudflared к ноуту).
 */
export const BACKEND =
  import.meta.env.VITE_BACKEND_URL?.replace(/\/$/, '') || 'http://localhost:3001';
