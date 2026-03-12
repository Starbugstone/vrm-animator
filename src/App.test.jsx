import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import App from './App'

vi.mock('./hooks/useAuth.js', () => ({
  default: () => ({
    token: '',
    user: null,
    isLoading: false,
    error: '',
    isAuthenticated: false,
    login: vi.fn(),
    register: vi.fn(),
    googleLogin: vi.fn(),
    logout: vi.fn(),
  }),
}))

describe('App', () => {
  it('renders the authentication screen when not authenticated', () => {
    render(<App />)

    expect(screen.getByText('Sign in')).toBeInTheDocument()
    expect(screen.getByText(/manage your private avatars/i)).toBeInTheDocument()
  })
})
