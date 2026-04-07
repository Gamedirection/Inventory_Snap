// Always use relative URLs so requests go through the Vite proxy.
// VITE_API_BASE_URL is used by vite.config.ts to set the proxy *target* (server-side only).
export const API_BASE = ''
export const MINIO_PUBLIC_URL = import.meta.env.VITE_MINIO_PUBLIC_URL || 'http://localhost:9000'
