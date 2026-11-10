// Set BUN_PUBLIC_BACKEND_URL (no trailing slash) to point the UI at a deployed
// backend. Bun inlines BUN_PUBLIC_* variables into the browser bundle
// (see bunfig.toml), so this must be set when the frontend server starts.
export const BACKEND_URL =
  process.env.BUN_PUBLIC_BACKEND_URL?.replace(/\/+$/, "") ||
  "http://localhost:3001";
