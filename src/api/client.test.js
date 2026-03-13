import { describe, expect, it, vi, afterEach } from 'vitest'
import { clearAuthSession, registerAuthHandlers, syncAuthSession } from './authSession'
import { apiRequest, ApiError, downloadFile } from './client'

afterEach(() => {
  vi.restoreAllMocks()
  clearAuthSession()
  registerAuthHandlers({ refresh: null, logout: null })
})

describe('downloadFile', () => {
  it('creates a File from an authenticated backend response', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      status: 200,
      headers: new Headers({
        'content-disposition': 'attachment; filename="avatar.vrm"',
      }),
      blob: async () => new Blob(['avatar-bytes'], { type: 'application/octet-stream' }),
    })

    const file = await downloadFile('/api/avatars/1/file', 'jwt-token', 'fallback.vrm')

    expect(file).toBeInstanceOf(File)
    expect(file.name).toBe('avatar.vrm')
    expect(file.size).toBeGreaterThan(0)
  })
})

describe('apiRequest', () => {
  it('refreshes an expired access token and retries once', async () => {
    const refresh = vi.fn().mockResolvedValue({
      token: 'fresh-access-token',
      refreshToken: 'fresh-refresh-token',
    })

    registerAuthHandlers({ refresh, logout: vi.fn() })
    syncAuthSession({ token: 'expired-access-token', refreshToken: 'stale-refresh-token' })

    const fetchMock = vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce({
        ok: false,
        status: 401,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: async () => ({ message: 'Expired access token.' }),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: async () => ({ id: 1, email: 'user@example.com' }),
      })

    const data = await apiRequest('/api/me', { token: 'expired-access-token' })

    expect(refresh).toHaveBeenCalledWith('stale-refresh-token')
    expect(data).toEqual({ id: 1, email: 'user@example.com' })
    expect(fetchMock).toHaveBeenCalledTimes(2)

    const secondHeaders = fetchMock.mock.calls[1][1].headers
    expect(secondHeaders.get('Authorization')).toBe('Bearer fresh-access-token')
  })

  it('surfaces validation errors from the backend', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: false,
      status: 422,
      headers: new Headers({ 'content-type': 'application/json' }),
      json: async () => ({
        errors: {
          email: 'This email is already registered.',
        },
      }),
    })

    await expect(apiRequest('/api/register', {
      method: 'POST',
      json: {
        email: 'duplicate@example.com',
        password: 'password123',
      },
    })).rejects.toEqual(new ApiError('This email is already registered.', 422, {
      errors: {
        email: 'This email is already registered.',
      },
    }))
  })
})
