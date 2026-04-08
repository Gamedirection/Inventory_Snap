import { useMutation } from '@tanstack/react-query'
import { apiClient } from '@/api/client'
import { useAuthStore } from '@/store/authStore'
import type { TokenResponse, UserOut } from '@/lib/types'

export function useLogin() {
  const { setTokens, setUser } = useAuthStore()
  return useMutation({
    mutationFn: async ({ email, password }: { email: string; password: string }) => {
      const { data } = await apiClient.post<TokenResponse>('/api/v1/auth/login', { email, password })
      return data
    },
    onSuccess: async (tokens) => {
      setTokens(tokens.access_token, tokens.refresh_token)
      // Fetch current user
      const { data: user } = await apiClient.get<UserOut>('/api/v1/auth/me', {
        headers: { Authorization: `Bearer ${tokens.access_token}` },
      })
      setUser(user)
    },
  })
}

export function useRegister() {
  return useMutation({
    mutationFn: async ({
      email,
      password,
      display_name,
    }: {
      email: string
      password: string
      display_name?: string
    }) => {
      const { data } = await apiClient.post<UserOut>('/api/v1/auth/register', {
        email,
        password,
        display_name,
      })
      return data
    },
  })
}

export function useUpdateMe() {
  const { setUser } = useAuthStore()
  return useMutation({
    mutationFn: async (payload: {
      email?: string
      display_name?: string | null
      avatar_url?: string | null
    }) => {
      const { data } = await apiClient.patch<UserOut>('/api/v1/auth/me', payload)
      return data
    },
    onSuccess: (user) => {
      setUser(user)
    },
  })
}

export function useChangePassword() {
  return useMutation({
    mutationFn: async (payload: {
      current_password: string
      new_password: string
    }) => {
      await apiClient.post('/api/v1/auth/me/change-password', payload)
    },
  })
}
