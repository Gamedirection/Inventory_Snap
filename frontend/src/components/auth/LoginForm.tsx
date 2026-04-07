import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useNavigate } from '@tanstack/react-router'
import toast from 'react-hot-toast'
import { Mail, Lock } from 'lucide-react'
import { useLogin } from '@/api/hooks/useAuth'
import { Button } from '@/components/ui/Button'

const schema = z.object({
  email:    z.string().email('Enter a valid email'),
  password: z.string().min(1, 'Password is required'),
})

type FormValues = z.infer<typeof schema>

export function LoginForm() {
  const navigate = useNavigate()
  const login = useLogin()

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ resolver: zodResolver(schema) })

  const onSubmit = async (values: FormValues) => {
    try {
      await login.mutateAsync(values)
      navigate({ to: '/sites' })
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail
        ?? 'Invalid email or password'
      toast.error(msg)
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
      {/* Email */}
      <div>
        <label className="label" htmlFor="email">Email</label>
        <div className="relative">
          <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-kraft-400 pointer-events-none" />
          <input
            id="email"
            type="email"
            autoComplete="email"
            placeholder="you@example.com"
            className={`input pl-9 ${errors.email ? 'border-accent-rust' : ''}`}
            {...register('email')}
          />
        </div>
        {errors.email && (
          <p className="mt-1 text-xs text-accent-rust">{errors.email.message}</p>
        )}
      </div>

      {/* Password */}
      <div>
        <label className="label" htmlFor="password">Password</label>
        <div className="relative">
          <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-kraft-400 pointer-events-none" />
          <input
            id="password"
            type="password"
            autoComplete="current-password"
            placeholder="••••••••"
            className={`input pl-9 ${errors.password ? 'border-accent-rust' : ''}`}
            {...register('password')}
          />
        </div>
        {errors.password && (
          <p className="mt-1 text-xs text-accent-rust">{errors.password.message}</p>
        )}
      </div>

      <Button
        type="submit"
        variant="primary"
        size="lg"
        loading={isSubmitting || login.isPending}
        className="w-full mt-2"
      >
        Sign In
      </Button>
    </form>
  )
}
