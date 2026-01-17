type EnvKey =
  | 'API_URL'
  | 'WS_URL'
  | 'SITE_URL'
  | 'SUPABASE_URL'
  | 'SUPABASE_ANON_KEY'
  | 'SUPABASE_STORAGE_BUCKET'
  | 'MAPBOX_TOKEN'
  | 'MAPBOX_ACCESS_TOKEN';

function readEnvRaw(key: EnvKey): string | undefined {
  const env = (import.meta as any).env || {};

  const vite = env[`VITE_${key}`];
  if (typeof vite === 'string' && vite.trim()) return vite.trim();

  const next = env[`NEXT_PUBLIC_${key}`];
  if (typeof next === 'string' && next.trim()) return next.trim();

  return undefined;
}

export const appEnv = {
  apiUrl(): string {
    return readEnvRaw('API_URL') || '/api';
  },

  assetBasePath(): string {
    const base = ((import.meta as any).env?.BASE_URL as string | undefined) || '/';
    return base.endsWith('/') ? base : `${base}/`;
  },

  assetUrl(path: string): string {
    const prefix = appEnv.assetBasePath();
    const p = path.startsWith('/') ? path.slice(1) : path;
    return `${prefix}${p}`;
  },

  wsUrl(): string {
    const explicit = readEnvRaw('WS_URL');
    if (explicit) return explicit;

    const isDev = Boolean((import.meta as any).env?.DEV);
    if (isDev) {
      return 'http://localhost:3001';
    }

    const api = readEnvRaw('API_URL');
    if (api) {
      try {
        return new URL(api).origin;
      } catch {
        return api;
      }
    }

    return typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3001';
  },

  siteUrl(): string {
    const configured = readEnvRaw('SITE_URL');
    if (configured) return configured;
    return typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000';
  },

  supabaseUrl(): string {
    const v = readEnvRaw('SUPABASE_URL');
    if (!v) throw new Error('Missing SUPABASE_URL env');
    return v;
  },

  supabaseAnonKey(): string {
    const v = readEnvRaw('SUPABASE_ANON_KEY');
    if (!v) throw new Error('Missing SUPABASE_ANON_KEY env');
    return v;
  },

  supabaseStorageBucket(): string | undefined {
    return readEnvRaw('SUPABASE_STORAGE_BUCKET');
  },

  mapboxToken(): string | undefined {
    return readEnvRaw('MAPBOX_ACCESS_TOKEN') || readEnvRaw('MAPBOX_TOKEN');
  },
};
