import { useMutation } from '@tanstack/react-query'
import { apiClient } from '@/api/client'
import { useAuthStore } from '@/store/authStore'
import type { TokenResponse, UserOut } from '@/lib/types'

export function useLogin() {
  const { setTokens, setUser } = useAuthStore()
  return useMutation({
    mutationFn: async ({ email, password }: { email: string; password: string }) => {
      const form = new URLSearchParams()
      form.set('username', email)
      form.set('password', password)
      const { data } = await apiClient.post<TokenResponse>('/api/v1/auth/login', form, {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      })
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
      full_name,
    }: {
      email: string
      password: string
      full_name?: string
    }) => {
      const { data } = await apiClient.post<UserOut>('/api/v1/auth/register', {
        email,
        password,
        full_name,
      })
      return data
    },
  })
}
