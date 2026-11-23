import { useState, FormEvent, KeyboardEvent } from 'react'
import { Link } from 'react-router-dom'
import { Shield, Eye, EyeOff, Users, AlertCircle, Zap, Star, Map, ArrowRight } from 'lucide-react'
import { authApi } from '@/api/client'
import { useAuthStore } from '@/store/auth'
import { useTranslation } from 'react-i18next'
import Button from '@/components/ui/Button'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'

export default function LoginPage() {
  const { t } = useTranslation()
  useDocumentTitle(t('login.title'))
  const login = useAuthStore((s) => s.login)
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [showPw, setShowPw]     = useState(false)
  const [capsLock, setCapsLock] = useState(false)
  const [error, setError]       = useState('')
  const [loading, setLoading]   = useState(false)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const { token, user } = await authApi.login(username.trim(), password)
      login(token, user)
    } catch (err) {
      setError(err instanceof Error ? err.message : t('login.failed'))
    } finally {
      setLoading(false)
    }
  }

  function checkCaps(e: KeyboardEvent<HTMLInputElement>) {
    setCapsLock(e.getModifierState?.('CapsLock') ?? false)
  }

  const features = [
    { icon: Zap,  text: t('login.heroFeature1') },
    { icon: Star, text: t('login.heroFeature2') },
    { icon: Map,  text: t('login.heroFeature3') },
  ]

  return (
    <div className="flex min-h-screen bg-white dark:bg-slate-950">
      {/* ── Form side ─────────────────────────────────────────────────────── */}
      <div className="flex flex-1 flex-col px-6 py-10 sm:px-12">
        <div className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 shadow-sm shadow-indigo-500/30">
            <Shield className="h-[18px] w-[18px] text-white" />
          </div>
          <div>
            <p className="text-sm font-semibold leading-tight text-slate-900 dark:text-white">Team Board</p>
            <p className="text-xs leading-tight text-slate-500 dark:text-slate-400">Scrum Management</p>
          </div>
        </div>

        <div className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center py-12 animate-slide-up">
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900 dark:text-slate-50">{t('login.welcome')}</h1>
          <p className="mt-1.5 text-sm text-slate-500 dark:text-slate-400">{t('login.welcomeSubtitle')}</p>

          <form onSubmit={handleSubmit} className="mt-8 space-y-5">
            <div>
              <label htmlFor="login-username" className="form-label">{t('login.username')}</label>
              <input
                id="login-username"
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="form-input h-11"
                placeholder={t('login.usernamePlaceholder')}
                autoComplete="username"
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
                autoFocus
                required
              />
            </div>

            <div>
              <label htmlFor="login-password" className="form-label">{t('login.password')}</label>
              <div className="relative">
                <input
                  id="login-password"
                  type={showPw ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  onKeyUp={checkCaps}
                  onKeyDown={checkCaps}
                  onBlur={() => setCapsLock(false)}
                  className="form-input h-11 pr-11"
                  placeholder="••••••••"
                  autoComplete="current-password"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPw((v) => !v)}
                  aria-label={showPw ? t('login.hidePassword') : t('login.showPassword')}
                  title={showPw ? t('login.hidePassword') : t('login.showPassword')}
                  className="absolute inset-y-0 right-0 flex items-center rounded-r-lg px-3 text-slate-400 transition-colors hover:text-slate-600 dark:hover:text-slate-300"
                >
                  {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              {capsLock && (
                <p className="mt-1.5 flex items-center gap-1 text-xs font-medium text-amber-600 dark:text-amber-400">
                  <AlertCircle className="h-3.5 w-3.5" />
                  {t('login.capsLock')}
                </p>
              )}
            </div>

            {error && (
              <div role="alert" className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-700 animate-slide-down dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-300">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                {error}
              </div>
            )}

            <Button
              type="submit"
              variant="primary"
              size="lg"
              fullWidth
              loading={loading}
              disabled={!username.trim() || !password}
              iconRight={!loading ? <ArrowRight /> : undefined}
            >
              {loading ? t('login.signingIn') : t('login.title')}
            </Button>
          </form>

          <div className="mt-8 border-t border-slate-100 pt-6 dark:border-slate-800">
            <Link
              to="/public-dashboard"
              className="group inline-flex items-center gap-2 text-sm font-medium text-slate-500 transition-colors hover:text-indigo-600 dark:text-slate-400 dark:hover:text-indigo-400"
            >
              <Users className="h-4 w-4" />
              {t('login.publicDashboardLink')}
              <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
            </Link>
          </div>
        </div>
      </div>

      {/* ── Brand side (desktop) ──────────────────────────────────────────── */}
      <div className="relative hidden w-[46%] max-w-2xl overflow-hidden bg-slate-950 lg:block">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(99,102,241,0.55),transparent_45%),radial-gradient(circle_at_80%_70%,rgba(139,92,246,0.45),transparent_50%),radial-gradient(circle_at_50%_110%,rgba(14,165,233,0.25),transparent_45%)]" />
        <div
          className="absolute inset-0 opacity-[0.07]"
          style={{
            backgroundImage:
              'linear-gradient(to right, white 1px, transparent 1px), linear-gradient(to bottom, white 1px, transparent 1px)',
            backgroundSize: '40px 40px',
          }}
        />
        <div className="relative flex h-full flex-col justify-end p-12 xl:p-16">
          <h2 className="max-w-md text-3xl font-semibold leading-tight tracking-tight text-white xl:text-4xl">
            {t('login.heroTitle')}
          </h2>
          <ul className="mt-8 space-y-4">
            {features.map(({ icon: Icon, text }) => (
              <li key={text} className="flex items-center gap-3 text-sm text-slate-300">
                <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/10 ring-1 ring-inset ring-white/15 backdrop-blur">
                  <Icon className="h-4 w-4 text-indigo-200" />
                </span>
                {text}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  )
}
