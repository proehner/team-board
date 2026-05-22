import { useAuthStore } from '@/store/auth'

export function usePagePermission(page: string) {
  const canWrite       = useAuthStore((s) => s.canWrite)
  const canWriteOwn    = useAuthStore((s) => s.canWriteOwn)
  const isAllowed      = useAuthStore((s) => s.isAllowed)
  const pagePermission = useAuthStore((s) => s.pagePermission)

  return {
    canWrite:    canWrite(page),
    canWriteOwn: canWriteOwn(page),
    isAllowed:   isAllowed(page),
    permission:  pagePermission(page),
    isReadOnly:  isAllowed(page) && !canWrite(page),
  }
}
