import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  api,
  apiRequest,
  ApiError,
  configureApiClient,
  getAccessToken,
  getBaseUrl,
  setAccessToken,
} from './apiClient';

const TEST_BASE = 'http://test.local';

function jsonResponse(body: unknown, init: ResponseInit = {}): Response {
  return new Response(JSON.stringify(body), {
    status: init.status ?? 200,
    headers: { 'Content-Type': 'application/json', ...(init.headers ?? {}) },
  });
}

function emptyResponse(status = 204): Response {
  return new Response(null, { status });
}

let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  setAccessToken(null);
  configureApiClient({ baseUrl: TEST_BASE });
  fetchMock = vi.fn();
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('apiClient — request shape', () => {
  it('uses VITE_API_URL-derived baseUrl after configure() override', () => {
    expect(getBaseUrl()).toBe(TEST_BASE);
  });

  it('sends GET to {baseUrl}/{path} with credentials included and no Authorization when unauthenticated', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ ok: true }));
    await api.get('/api/jobs');
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe(`${TEST_BASE}/api/jobs`);
    expect((init as RequestInit).method).toBe('GET');
    expect((init as RequestInit).credentials).toBe('include');
    const headers = (init as RequestInit).headers as Record<string, string>;
    expect(headers.Authorization).toBeUndefined();
  });

  it('injects Authorization: Bearer <token> when an access token is set', async () => {
    setAccessToken('abc.def.ghi');
    fetchMock.mockResolvedValueOnce(jsonResponse({ ok: true }));
    await api.get('/api/users/me');
    const headers = (fetchMock.mock.calls[0]![1] as RequestInit).headers as Record<string, string>;
    expect(headers.Authorization).toBe('Bearer abc.def.ghi');
  });

  it('serializes JSON bodies and sets Content-Type', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ id: 1 }));
    await api.post('/api/employer/request', { firstName: 'a' });
    const init = fetchMock.mock.calls[0]![1] as RequestInit;
    expect(init.method).toBe('POST');
    expect(init.body).toBe(JSON.stringify({ firstName: 'a' }));
    expect((init.headers as Record<string, string>)['Content-Type']).toBe('application/json');
  });

  it('sends FormData uploads without a JSON Content-Type', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ id: 1 }));
    const fd = new FormData();
    fd.append('file', new File(['x'], 'a.pdf'));
    await api.upload('/api/employer/request', fd);
    const init = fetchMock.mock.calls[0]![1] as RequestInit;
    expect(init.body).toBe(fd);
    expect((init.headers as Record<string, string>)['Content-Type']).toBeUndefined();
  });
});

describe('apiClient — responses', () => {
  it('parses JSON response bodies', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ ok: true, n: 7 }));
    const data = await api.get<{ ok: boolean; n: number }>('/x');
    expect(data).toEqual({ ok: true, n: 7 });
  });

  it('returns undefined for 204 No Content', async () => {
    fetchMock.mockResolvedValueOnce(emptyResponse(204));
    const data = await api.delete<undefined>('/api/users/me');
    expect(data).toBeUndefined();
  });

  it('throws ApiError with status and parsed error message on non-2xx', async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({ error: 'invalid_credentials' }, { status: 401 }),
    );
    await expect(apiRequest('/api/auth/login', { method: 'POST' })).rejects.toMatchObject({
      name: 'ApiError',
      status: 401,
      message: 'invalid_credentials',
    });
  });
});

describe('apiClient — 401 refresh-and-retry', () => {
  it('refreshes the access token and retries the request when authenticated request returns 401', async () => {
    setAccessToken('old.token');
    fetchMock
      .mockResolvedValueOnce(jsonResponse({ error: 'jwt_expired' }, { status: 401 }))
      .mockResolvedValueOnce(jsonResponse({ accessToken: 'new.token' }))
      .mockResolvedValueOnce(jsonResponse({ id: 'u1' }));

    const data = await api.get<{ id: string }>('/api/users/me');

    expect(data).toEqual({ id: 'u1' });
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(fetchMock.mock.calls[1]![0]).toBe(`${TEST_BASE}/api/auth/refresh`);
    const retryHeaders = (fetchMock.mock.calls[2]![1] as RequestInit).headers as Record<
      string,
      string
    >;
    expect(retryHeaders.Authorization).toBe('Bearer new.token');
    expect(getAccessToken()).toBe('new.token');
  });

  it('does NOT attempt refresh when there is no access token', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ error: 'unauthorized' }, { status: 401 }));
    await expect(api.get('/api/users/me')).rejects.toBeInstanceOf(ApiError);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('clears the access token and surfaces the original 401 if refresh fails', async () => {
    setAccessToken('old.token');
    fetchMock
      .mockResolvedValueOnce(jsonResponse({ error: 'jwt_expired' }, { status: 401 }))
      .mockResolvedValueOnce(jsonResponse({ error: 'no_refresh_token' }, { status: 401 }));

    await expect(api.get('/api/users/me')).rejects.toBeInstanceOf(ApiError);
    expect(getAccessToken()).toBeNull();
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('skips the refresh dance when skipAuthRefresh is set (used by login/refresh themselves)', async () => {
    setAccessToken('old.token');
    fetchMock.mockResolvedValueOnce(
      jsonResponse({ error: 'invalid_credentials' }, { status: 401 }),
    );
    await expect(
      apiRequest('/api/auth/login', {
        method: 'POST',
        body: { email: 'a', password: 'b' },
        skipAuthRefresh: true,
      }),
    ).rejects.toBeInstanceOf(ApiError);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('shares an in-flight refresh across concurrent 401s instead of refreshing twice', async () => {
    setAccessToken('old.token');
    let resolveRefresh!: (res: Response) => void;
    fetchMock
      .mockResolvedValueOnce(jsonResponse({ error: 'jwt_expired' }, { status: 401 }))
      .mockResolvedValueOnce(jsonResponse({ error: 'jwt_expired' }, { status: 401 }))
      .mockImplementationOnce(
        () =>
          new Promise<Response>((resolve) => {
            resolveRefresh = resolve;
          }),
      )
      .mockResolvedValueOnce(jsonResponse({ ok: 1 }))
      .mockResolvedValueOnce(jsonResponse({ ok: 2 }));

    const p1 = api.get('/a');
    const p2 = api.get('/b');

    await Promise.resolve();
    resolveRefresh(jsonResponse({ accessToken: 'new.token' }));

    await Promise.all([p1, p2]);

    const refreshCalls = fetchMock.mock.calls.filter(
      (call) => call[0] === `${TEST_BASE}/api/auth/refresh`,
    );
    expect(refreshCalls).toHaveLength(1);
    expect(getAccessToken()).toBe('new.token');
  });
});
