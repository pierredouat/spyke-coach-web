import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'

function generateInviteCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  return Array.from({ length: 6 }, () => chars[Math.floor(Math.random() * chars.length)]).join('')
}

type Step = 'form' | 'code'

export default function OnboardingPage() {
  const { user, profile, refreshProfile } = useAuth()
  const navigate = useNavigate()
  const [step, setStep] = useState<Step>('form')
  const [fullName, setFullName] = useState('')
  const [club, setClub] = useState('')
  const [inviteCode, setInviteCode] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [copied, setCopied] = useState(false)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!user) return
    setError(null)
    setLoading(true)

    const code = profile?.invitation_code ?? generateInviteCode()

    const { error } = await supabase.from('profiles').upsert({
      id: user.id,
      role: 'coach',
      full_name: fullName.trim(),
      club: club.trim() || null,
      invitation_code: code,
    })

    if (error) {
      setError(error.message)
      setLoading(false)
      return
    }

    setInviteCode(code)
    await refreshProfile()
    setStep('code')
    setLoading(false)
  }

  function copyCode() {
    navigator.clipboard.writeText(inviteCode)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  if (step === 'code') {
    return (
      <div className="min-h-screen bg-ink flex items-center justify-center px-4">
        <div className="w-full max-w-sm text-center">
          <div className="mb-10">
            <span className="text-brand font-bold text-2xl tracking-tight">SPYKE</span>
            <span className="text-white font-light text-2xl tracking-tight ml-1">Coach</span>
          </div>

          <div className="w-12 h-12 bg-brand/20 rounded-full flex items-center justify-center mx-auto mb-6">
            <svg className="w-6 h-6 text-brand" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>

          <h1 className="text-white text-2xl font-semibold mb-2">Compte créé !</h1>
          <p className="text-muted text-sm mb-8">
            Partagez ce code à vos athlètes pour qu'ils vous rejoignent dans l'application mobile SPYKE.
          </p>

          <div className="bg-sidebar rounded-xl border border-sidebar-border p-6 mb-6">
            <p className="text-muted text-xs uppercase tracking-widest mb-3">Code d'invitation</p>
            <p className="text-white text-3xl font-mono font-bold tracking-[0.2em] mb-4">{inviteCode}</p>
            <button
              onClick={copyCode}
              className="text-sm text-brand hover:text-white transition-colors"
            >
              {copied ? 'Copié !' : 'Copier le code'}
            </button>
          </div>

          <button
            onClick={() => navigate('/')}
            className="w-full bg-brand hover:bg-brand-hover text-white font-medium py-3 rounded-lg transition-colors"
          >
            Accéder au dashboard
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-ink flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="mb-10">
          <span className="text-brand font-bold text-2xl tracking-tight">SPYKE</span>
          <span className="text-white font-light text-2xl tracking-tight ml-1">Coach</span>
        </div>

        <h1 className="text-white text-2xl font-semibold mb-2">Votre profil coach</h1>
        <p className="text-muted text-sm mb-8">Quelques informations pour finaliser votre compte</p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm text-muted mb-1.5">Nom complet</label>
            <input
              type="text"
              value={fullName}
              onChange={e => setFullName(e.target.value)}
              required
              placeholder="Jean Dupont"
              className="w-full bg-sidebar-border border border-sidebar-border rounded-lg px-4 py-3 text-white placeholder-muted text-sm focus:outline-none focus:border-brand focus:ring-1 focus:ring-brand transition-colors"
            />
          </div>
          <div>
            <label className="block text-sm text-muted mb-1.5">Club <span className="text-muted/60">(optionnel)</span></label>
            <input
              type="text"
              value={club}
              onChange={e => setClub(e.target.value)}
              placeholder="AC Paris Athlétisme"
              className="w-full bg-sidebar-border border border-sidebar-border rounded-lg px-4 py-3 text-white placeholder-muted text-sm focus:outline-none focus:border-brand focus:ring-1 focus:ring-brand transition-colors"
            />
          </div>

          {error && (
            <p className="text-accent text-sm bg-accent/10 border border-accent/20 rounded-lg px-4 py-3">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-brand hover:bg-brand-hover text-white font-medium py-3 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed mt-2"
          >
            {loading ? 'Enregistrement…' : 'Continuer'}
          </button>
        </form>
      </div>
    </div>
  )
}
