import { RouterProvider } from '@tanstack/react-router'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Toaster } from 'react-hot-toast'
import { router } from './router'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime:         60_000,        // 1 min
      gcTime:            5 * 60_000,    // 5 min
      retry:             2,
      refetchOnWindowFocus: false,
    },
    mutations: {
      retry: 0,
    },
  },
})

export function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
      <Toaster
        position="top-center"
        toastOptions={{
          duration: 3000,
          style: {
            background: '#2d1f12',
            color: '#fdf8f0',
            borderRadius: '12px',
            fontSize: '13px',
            fontWeight: '500',
            border: '1px solid #4a3320',
            padding: '10px 16px',
          },
          success: {
            iconTheme: { primary: '#4a7c59', secondary: '#fdf8f0' },
          },
          error: {
            iconTheme: { primary: '#c0562a', secondary: '#fdf8f0' },
          },
        }}
      />
    </QueryClientProvider>
  )
}
