import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'
import { STAFF_ROLE_LABELS } from '../../types/database'
import type { StaffRole } from '../../types/database'

function generateInviteCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  return Array.from({ length: 6 }, () => chars[Math.floor(Math.random() * chars.length)]).join('')
}

type Mode = 'choose' | 'create' | 'join'
type Step = 'mode' | 'form' | 'code'

export default function OnboardingPage() {
  const { user, profile, refreshProfile, refreshTeam } = useAuth()
  const navigate = useNavigate()

  const [mode, setMode] = useState<Mode>('choose')
  const [step, setStep] = useState<Step>('mode')

  // Create flow
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [club, setClub] = useState('')
  const [inviteCode, setInviteCode] = useState('')
  const [copied, setCopied] = useState(false)

  // Join flow
  const [joinCode, setJoinCode] = useState('')
  const [codePreview, setCodePreview] = useState<{ team_name: string; role: StaffRole } | null>(null)
  const [codeError, setCodeError] = useState<string | null>(null)
  const [codeValidating, setCodeValidating] = useState(false)

  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  // ── Create flow ──────────────────────────────────────────────────────────────
  async function handleCreate(e: FormEvent) {
    e.preventDefault()
    if (!user) return
    setError(null)
    setLoading(true)

    const code = profile?.invite_code ?? generateInviteCode()

    const { error: dbErr } = await supabase.from('profiles').upsert({
      id: user.id,
      role: 'coach',
      first_name: firstName.trim(),
      last_name: lastName.trim(),
      club: club.trim() || null,
      invite_code: code,
      onboarding_completed: true,
    })

    if (dbErr) {
      setError(dbErr.message)
      setLoading(false)
      return
    }

    setInviteCode(code)
    await Promise.all([refreshProfile(), refreshTeam()])
    setStep('code')
    setLoading(false)
  }

  // ── Join flow — code validation ──────────────────────────────────────────────
  async function validateCode(code: string) {
    if (code.length < 6) { setCodePreview(null); setCodeError(null); return }
    setCodeValidating(true)
    setCodeError(null)

    const { data } = await supabase.rpc('validate_team_invite_code', { p_code: code.toUpperCase() })
    const result = data as { valid: boolean; team_name?: string; role?: string; error?: string } | null

    if (!result || !result.valid) {
      setCodePreview(null)
      setCodeError(result?.error ?? 'Code invalide')
    } else {
      setCodePreview({ team_name: result.team_name!, role: result.role as StaffRole })
      setCodeError(null)
    }
    setCodeValidating(false)
  }

  // ── Join flow — submit ───────────────────────────────────────────────────────
  async function handleJoin(e: FormEvent) {
    e.preventDefault()
    if (!user || !codePreview) return
    setError(null)
    setLoading(true)

    // 1. Join team first (so the trigger won't create a new team for this user)
    const { data: joinResult } = await supabase.rpc('join_team_with_code', {
      p_code: joinCode.toUpperCase(),
    })
    const join = joinResult as { success?: boolean; error?: string } | null

    if (!join?.success) {
      setError(join?.error ?? 'Impossible de rejoindre l\'équipe')
      setLoading(false)
      return
    }

    // 2. Complete profile (trigger fires but team_members row already exists)
    const code = profile?.invite_code ?? generateInviteCode()
    const { error: dbErr } = await supabase.from('profiles').upsert({
      id: user.id,
      role: 'coach',
      first_name: firstName.trim(),
      last_name: lastName.trim(),
      club: club.trim() || null,
      invite_code: code,
      onboarding_completed: true,
    })

    if (dbErr) {
      setError(dbErr.message)
      setLoading(false)
      return
    }

    await Promise.all([refreshProfile(), refreshTeam()])
    navigate('/')
    setLoading(false)
  }

  function copyCode() {
    navigator.clipboard.writeText(inviteCode)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  // ── Mode selection screen ────────────────────────────────────────────────────
  if (step === 'mode') {
    return (
      <div className="min-h-screen bg-ink flex items-center justify-center px-4">
        <div className="w-full max-w-sm">
          <div className="mb-10 text-center">
            <span className="text-brand font-bold text-2xl tracking-tight">SPYKE</span>
            <span className="text-white font-light text-2xl tracking-tight ml-1">Coach</span>
          </div>

          <h1 className="text-white text-2xl font-semibold mb-2 text-center">Bienvenue</h1>
          <p className="text-muted text-sm mb-8 text-center">Comment souhaitez-vous utiliser SPYKE Coach ?</p>

          <div className="space-y-3">
            <button
              onClick={() => { setMode('create'); setStep('form') }}
              className="w-full bg-sidebar border border-sidebar-border hover:border-brand/40 rounded-xl p-5 text-left transition-colors group"
            >
              <div className="flex items-start gap-4">
                <div className="w-10 h-10 bg-brand/20 rounded-lg flex items-center justify-center shrink-0 mt-0.5 group-hover:bg-brand/30 transition-colors">
                  <svg className="w-5 h-5 text-brand" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                </div>
                <div>
                  <p className="text-white font-semibold text-sm">Créer une équipe</p>
                  <p className="text-muted text-xs mt-1">Vous êtes coach principal. Vous gérerez un groupe d&apos;athlètes et pourrez inviter du staff.</p>
                </div>
              </div>
            </button>

            <button
              onClick={() => { setMode('join'); setStep('form') }}
              className="w-full bg-sidebar border border-sidebar-border hover:border-brand/40 rounded-xl p-5 text-left transition-colors group"
            >
              <div className="flex items-start gap-4">
                <div className="w-10 h-10 bg-white/10 rounded-lg flex items-center justify-center shrink-0 mt-0.5 group-hover:bg-white/15 transition-colors">
                  <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
                  </svg>
                </div>
                <div>
                  <p className="text-white font-semibold text-sm">Rejoindre une équipe</p>
                  <p className="text-muted text-xs mt-1">Vous avez reçu un code d&apos;invitation. Rejoignez l&apos;équipe d&apos;un coach principal.</p>
                </div>
              </div>
            </button>
          </div>
        </div>
      </div>
    )
  }

  // ── Invite code display (after create) ───────────────────────────────────────
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

          <h1 className="text-white text-2xl font-semibold mb-2">Équipe créée !</h1>
          <p className="text-muted text-sm mb-8">
            Partagez ce code à vos athlètes pour qu&apos;ils vous rejoignent dans l&apos;application mobile SPYKE.
          </p>

          <div className="bg-sidebar rounded-xl border border-sidebar-border p-6 mb-6">
            <p className="text-muted text-xs uppercase tracking-widest mb-3">Code d&apos;invitation athlètes</p>
            <p className="text-white text-3xl font-mono font-bold tracking-[0.2em] mb-4">{inviteCode}</p>
            <button onClick={copyCode} className="text-sm text-brand hover:text-white transition-colors">
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

  // ── Profile form (shared between create and join) ─────────────────────────────
  return (
    <div className="min-h-screen bg-ink flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="mb-10">
          <span className="text-brand font-bold text-2xl tracking-tight">SPYKE</span>
          <span className="text-white font-light text-2xl tracking-tight ml-1">Coach</span>
        </div>

        <button
          onClick={() => setStep('mode')}
          className="flex items-center gap-1.5 text-muted hover:text-white text-sm mb-6 transition-colors"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Retour
        </button>

        <h1 className="text-white text-2xl font-semibold mb-2">Votre profil</h1>
        <p className="text-muted text-sm mb-8">
          {mode === 'create'
            ? 'Quelques informations pour créer votre équipe'
            : 'Quelques informations pour finaliser votre compte'}
        </p>

        <form onSubmit={mode === 'create' ? handleCreate : handleJoin} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm text-muted mb-1.5">Prénom</label>
              <input
                type="text"
                value={firstName}
                onChange={e => setFirstName(e.target.value)}
                required
                placeholder="Jean"
                className="w-full bg-sidebar-border border border-sidebar-border rounded-lg px-4 py-3 text-white placeholder-muted text-sm focus:outline-none focus:border-brand focus:ring-1 focus:ring-brand transition-colors"
              />
            </div>
            <div>
              <label className="block text-sm text-muted mb-1.5">Nom</label>
              <input
                type="text"
                value={lastName}
                onChange={e => setLastName(e.target.value)}
                required
                placeholder="Dupont"
                className="w-full bg-sidebar-border border border-sidebar-border rounded-lg px-4 py-3 text-white placeholder-muted text-sm focus:outline-none focus:border-brand focus:ring-1 focus:ring-brand transition-colors"
              />
            </div>
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

          {/* Join: code d'invitation équipe */}
          {mode === 'join' && (
            <div>
              <label className="block text-sm text-muted mb-1.5">Code d&apos;invitation équipe</label>
              <input
                type="text"
                value={joinCode}
                onChange={e => {
                  const v = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '')
                  setJoinCode(v)
                  validateCode(v)
                }}
                required
                placeholder="XXXXXXXX"
                maxLength={8}
                className={`w-full bg-sidebar-border border rounded-lg px-4 py-3 text-white placeholder-muted text-sm font-mono tracking-widest uppercase focus:outline-none transition-colors ${
                  codeError
                    ? 'border-accent focus:border-accent focus:ring-1 focus:ring-accent'
                    : codePreview
                    ? 'border-emerald-500 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500'
                    : 'border-sidebar-border focus:border-brand focus:ring-1 focus:ring-brand'
                }`}
              />
              {codeValidating && (
                <p className="text-muted text-xs mt-1.5">Vérification…</p>
              )}
              {codeError && !codeValidating && (
                <p className="text-accent text-xs mt-1.5">{codeError}</p>
              )}
              {codePreview && !codeValidating && (
                <p className="text-emerald-400 text-xs mt-1.5">
                  Vous rejoindrez <strong>{codePreview.team_name}</strong> en tant que{' '}
                  <strong>{STAFF_ROLE_LABELS[codePreview.role]}</strong>
                </p>
              )}
            </div>
          )}

          {error && (
            <p className="text-accent text-sm bg-accent/10 border border-accent/20 rounded-lg px-4 py-3">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading || (mode === 'join' && !codePreview)}
            className="w-full bg-brand hover:bg-brand-hover text-white font-medium py-3 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed mt-2"
          >
            {loading
              ? mode === 'create' ? 'Création…' : 'Connexion…'
              : mode === 'create' ? 'Créer mon équipe' : 'Rejoindre l\'équipe'}
          </button>
        </form>
      </div>
    </div>
  )
}
