type Method = 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';

export type ApiRequestOptions = {
  method?: Method;
  body?: unknown;
  formData?: FormData;
  signal?: AbortSignal;
  headers?: Record<string, string>;
  skipAuthRefresh?: boolean;
};

const DEFAULT_BASE_URL = 'http://localhost:3001';

let accessToken: string | null = null;
let refreshPromise: Promise<string | null> | null = null;
let baseUrl = readBaseUrlFromEnv();

function readBaseUrlFromEnv(): string {
  const fromEnv =
    typeof import.meta !== 'undefined' && import.meta.env
      ? (import.meta.env.VITE_API_URL as string | undefined)
      : undefined;
  return (fromEnv ?? DEFAULT_BASE_URL).replace(/\/$/, '');
}

export function setAccessToken(token: string | null): void {
  accessToken = token;
}

export function getAccessToken(): string | null {
  return accessToken;
}

export function configureApiClient(options: { baseUrl?: string }): void {
  if (options.baseUrl !== undefined) {
    baseUrl = options.baseUrl.replace(/\/$/, '');
  }
}

export function getBaseUrl(): string {
  return baseUrl;
}

export class ApiError extends Error {
  readonly status: number;
  readonly body: unknown;

  constructor(status: number, message: string, body: unknown) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.body = body;
  }
}

async function refreshAccessToken(): Promise<string | null> {
  if (refreshPromise) return refreshPromise;
  refreshPromise = (async () => {
    try {
      const res = await fetch(`${baseUrl}/api/auth/refresh`, {
        method: 'POST',
        credentials: 'include',
      });
      if (!res.ok) {
        accessToken = null;
        return null;
      }
      const data = (await res.json()) as { accessToken?: string };
      accessToken = data.accessToken ?? null;
      return accessToken;
    } catch {
      accessToken = null;
      return null;
    } finally {
      refreshPromise = null;
    }
  })();
  return refreshPromise;
}

async function safeJson(res: Response): Promise<unknown> {
  const text = await res.text();
  if (!text) return undefined;
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return text;
  }
}

function buildInit(options: ApiRequestOptions, token: string | null): RequestInit {
  const headers: Record<string, string> = { ...(options.headers ?? {}) };
  if (token) headers.Authorization = `Bearer ${token}`;

  let body: BodyInit | undefined;
  if (options.formData) {
    body = options.formData;
  } else if (options.body !== undefined) {
    body = JSON.stringify(options.body);
    headers['Content-Type'] = headers['Content-Type'] ?? 'application/json';
  }

  return {
    method: options.method ?? 'GET',
    headers,
    credentials: 'include',
    body,
    signal: options.signal,
  };
}

export async function apiRequest<T = unknown>(
  path: string,
  options: ApiRequestOptions = {},
): Promise<T> {
  const url = path.startsWith('http') ? path : `${baseUrl}${path}`;

  let res = await fetch(url, buildInit(options, accessToken));

  if (res.status === 401 && accessToken && !options.skipAuthRefresh) {
    const newToken = await refreshAccessToken();
    if (newToken) {
      res = await fetch(url, buildInit(options, newToken));
    }
  }

  if (!res.ok) {
    const errorBody = await safeJson(res);
    const message =
      typeof errorBody === 'object' && errorBody && 'error' in errorBody
        ? String((errorBody as { error: unknown }).error)
        : `Request failed with status ${res.status}`;
    throw new ApiError(res.status, message, errorBody);
  }

  if (res.status === 204 || res.headers.get('Content-Length') === '0') {
    return undefined as T;
  }

  const contentType = res.headers.get('Content-Type') ?? '';
  if (contentType.includes('application/json')) {
    return (await res.json()) as T;
  }
  return (await res.text()) as unknown as T;
}

export const api = {
  get: <T = unknown>(path: string, options?: ApiRequestOptions) =>
    apiRequest<T>(path, { ...options, method: 'GET' }),
  post: <T = unknown>(path: string, body?: unknown, options?: ApiRequestOptions) =>
    apiRequest<T>(path, { ...options, method: 'POST', body }),
  patch: <T = unknown>(path: string, body?: unknown, options?: ApiRequestOptions) =>
    apiRequest<T>(path, { ...options, method: 'PATCH', body }),
  put: <T = unknown>(path: string, body?: unknown, options?: ApiRequestOptions) =>
    apiRequest<T>(path, { ...options, method: 'PUT', body }),
  delete: <T = unknown>(path: string, options?: ApiRequestOptions) =>
    apiRequest<T>(path, { ...options, method: 'DELETE' }),
  upload: <T = unknown>(path: string, formData: FormData, options?: ApiRequestOptions) =>
    apiRequest<T>(path, { ...options, method: 'POST', formData }),
};
