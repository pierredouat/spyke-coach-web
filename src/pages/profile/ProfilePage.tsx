import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'

export default function ProfilePage() {
  const { profile } = useAuth()
  const navigate = useNavigate()
  const [copied, setCopied] = useState(false)

  const fullName = [profile?.first_name, profile?.last_name].filter(Boolean).join(' ') || '—'
  const inviteCode = profile?.invite_code

  function copyCode() {
    if (!inviteCode) return
    navigator.clipboard.writeText(inviteCode)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  async function handleLogout() {
    await supabase.auth.signOut()
    navigate('/login')
  }

  return (
    <div className="max-w-lg">
      <div className="mb-8">
        <h1 className="text-ink text-2xl font-semibold">Mon profil</h1>
        <p className="text-muted text-sm mt-1">Informations de votre compte coach</p>
      </div>

      {/* Identity */}
      <div className="bg-white rounded-xl border border-gray-100 p-6 mb-4">
        <h2 className="text-xs font-medium text-muted uppercase tracking-wide mb-4">Identité</h2>
        <div className="flex items-center gap-4 mb-5">
          <div className="w-12 h-12 rounded-full bg-brand/10 flex items-center justify-center shrink-0">
            <span className="text-brand text-lg font-semibold">
              {(profile?.first_name ?? profile?.last_name ?? '?').charAt(0).toUpperCase()}
            </span>
          </div>
          <div>
            <p className="text-ink font-semibold">{fullName}</p>
            {profile?.club && <p className="text-muted text-sm mt-0.5">{profile.club}</p>}
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <p className="text-muted text-xs mb-1">Prénom</p>
            <p className="text-ink">{profile?.first_name ?? '—'}</p>
          </div>
          <div>
            <p className="text-muted text-xs mb-1">Nom</p>
            <p className="text-ink">{profile?.last_name ?? '—'}</p>
          </div>
          <div>
            <p className="text-muted text-xs mb-1">Club</p>
            <p className="text-ink">{profile?.club ?? '—'}</p>
          </div>
        </div>
      </div>

      {/* Invite code */}
      <div className="bg-white rounded-xl border border-gray-100 p-6 mb-4">
        <h2 className="text-xs font-medium text-muted uppercase tracking-wide mb-1">Code d&apos;invitation</h2>
        <p className="text-muted text-xs mb-4">
          Partagez ce code à vos athlètes pour qu&apos;ils vous rejoignent dans l&apos;app mobile SPYKE.
        </p>
        {inviteCode ? (
          <div className="flex items-center justify-between bg-surface rounded-lg border border-gray-100 px-5 py-4">
            <span className="text-ink text-2xl font-mono font-bold tracking-[0.18em]">{inviteCode}</span>
            <button
              onClick={copyCode}
              className="flex items-center gap-1.5 text-sm text-brand hover:text-brand-hover font-medium transition-colors"
            >
              {copied ? (
                <>
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  Copié
                </>
              ) : (
                <>
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                  </svg>
                  Copier
                </>
              )}
            </button>
          </div>
        ) : (
          <p className="text-muted text-sm italic">Aucun code généré.</p>
        )}
      </div>

      {/* Logout */}
      <div className="bg-white rounded-xl border border-gray-100 p-6">
        <h2 className="text-xs font-medium text-muted uppercase tracking-wide mb-4">Session</h2>
        <button
          onClick={handleLogout}
          className="flex items-center gap-2 text-sm text-muted hover:text-ink transition-colors"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
          </svg>
          Se déconnecter
        </button>
      </div>
    </div>
  )
}
