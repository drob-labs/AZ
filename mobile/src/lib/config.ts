export const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL ?? '';
export const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '';
export const configured = SUPABASE_URL !== '' && SUPABASE_ANON_KEY !== '';

/** Punëtorët kyçen me numër personal; brenda Supabase ky bëhet një email sintetik (nuk dërgohet asnjë email). */
export const WORKER_EMAIL_DOMAIN =
  process.env.EXPO_PUBLIC_WORKER_EMAIL_DOMAIN || 'workers.az-innenausbau.de';
export const workerEmail = (personnelNo: string) =>
  `${personnelNo.trim().toLowerCase()}@${WORKER_EMAIL_DOMAIN}`;

export const SUPPORT_EMAIL = 'info@az-innenausbau.de';
export const PRIVACY_URL = 'https://az-innenausbau.de/datenschutz';
