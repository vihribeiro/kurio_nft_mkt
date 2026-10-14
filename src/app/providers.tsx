import { QueryClientProvider } from '@tanstack/react-query'
import { RouterProvider } from '@tanstack/react-router'
import { Toaster } from '@/components/ui/sonner'
import { TooltipProvider } from '@/components/ui/tooltip'
import { SessionProvider } from '@/features/auth/session'
import { RealtimeProvider } from '@/features/realtime/RealtimeProvider'
import { queryClient } from './query-client'
import { router } from './router'

/**
 * Composição da aplicação.
 *
 * A ordem tem motivo e não é arbitrária:
 *
 *  1. `QueryClientProvider` — o cache é a fonte de verdade dos dados.
 *  2. `SessionProvider` — quem é o usuário (lê o cache e o token).
 *  3. `RealtimeProvider` — precisa da sessão para se autenticar no socket.
 *  4. `RouterProvider` — as telas consomem tudo o que veio antes.
 */
export function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <SessionProvider>
        <RealtimeProvider>
          <TooltipProvider>
            <RouterProvider router={router} />
            <Toaster />
          </TooltipProvider>
        </RealtimeProvider>
      </SessionProvider>
    </QueryClientProvider>
  )
}
