import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'
import type { Discipline } from '../../types/database'
import { formatDisciplines } from '../../lib/disciplines'

type AthleteProfile = {
  first_name: string | null
  last_name: string | null
  disciplines: Discipline[]
  club: string | null
}

type RelationRow = {
  id: string
  athlete_id: string
  status: 'pending' | 'active' | 'inactive'
  invited_at: string
  accepted_at: string | null
  athlete: AthleteProfile | null
}

function athleteName(a: AthleteProfile | null): string {
  if (!a) return 'Athlète inconnu'
  return [a.first_name, a.last_name].filter(Boolean).join(' ') || '—'
}

function athleteInitial(a: AthleteProfile | null): string {
  return (a?.first_name ?? a?.last_name ?? '?').charAt(0).toUpperCase()
}

function Avatar({ athlete, size = 'md' }: { athlete: AthleteProfile | null; size?: 'sm' | 'md' }) {
  const dim = size === 'sm' ? 'w-7 h-7 text-xs' : 'w-9 h-9 text-sm'
  return (
    <div className={`${dim} rounded-full bg-brand/10 flex items-center justify-center shrink-0`}>
      <span className="text-brand font-semibold">{athleteInitial(athlete)}</span>
    </div>
  )
}

export default function AthletesPage() {
  const { user, team, loading: authLoading } = useAuth()
  const navigate = useNavigate()
  const [pending, setPending] = useState<RelationRow[]>([])
  const [active, setActive] = useState<RelationRow[]>([])
  const [loading, setLoading] = useState(true)
  const [processingId, setProcessingId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (authLoading || !user) return
    if (!team) { setLoading(false); return }
    fetchRelations()
  }, [authLoading, user, team])

  async function fetchRelations() {
    if (!team) return
    setLoading(true)
    const { data, error } = await supabase
      .from('coach_athlete_relationships')
      .select(`
        id,
        athlete_id,
        status,
        invited_at,
        accepted_at,
        athlete:profiles!coach_athlete_relationships_athlete_id_fkey (
          first_name,
          last_name,
          disciplines,
          club
        )
      `)
      .eq('team_id', team.id)
      .in('status', ['pending', 'active'])
      .order('invited_at', { ascending: false })

    if (!error && data) {
      const rows = data as unknown as RelationRow[]
      setPending(rows.filter(r => r.status === 'pending'))
      setActive(rows.filter(r => r.status === 'active'))
    }
    setLoading(false)
  }

  async function handleAccept(row: RelationRow) {
    setProcessingId(row.id)
    setError(null)

    // Optimistic update
    setPending(prev => prev.filter(r => r.id !== row.id))
    setActive(prev => [{ ...row, status: 'active', accepted_at: new Date().toISOString() }, ...prev])

    const { error } = await supabase
      .from('coach_athlete_relationships')
      .update({ status: 'active', accepted_at: new Date().toISOString() })
      .eq('id', row.id)

    if (error) {
      // Revert
      setActive(prev => prev.filter(r => r.id !== row.id))
      setPending(prev => [row, ...prev])
      setError(error.message)
    }

    setProcessingId(null)
  }

  async function handleRefuse(row: RelationRow) {
    setProcessingId(row.id)
    setError(null)

    // Optimistic update
    setPending(prev => prev.filter(r => r.id !== row.id))

    const { error } = await supabase
      .from('coach_athlete_relationships')
      .update({ status: 'inactive' })
      .eq('id', row.id)

    if (error) {
      // Revert
      setPending(prev => [row, ...prev])
      setError(error.message)
    }

    setProcessingId(null)
  }

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-muted text-sm pt-4">
        <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
        Chargement…
      </div>
    )
  }

  return (
    <div className="max-w-3xl">
      <div className="mb-8">
        <h1 className="text-ink text-2xl font-semibold">Athlètes</h1>
        <p className="text-muted text-sm mt-1">Gérez votre groupe et les demandes d&apos;adhésion</p>
      </div>

      {error && (
        <div className="mb-6 text-accent text-sm bg-accent/10 border border-accent/20 rounded-lg px-4 py-3">
          {error}
        </div>
      )}

      {/* Pending requests */}
      <section className="mb-8">
        <div className="flex items-center gap-3 mb-3">
          <h2 className="text-ink text-base font-semibold">Demandes en attente</h2>
          {pending.length > 0 && (
            <span className="bg-accent text-white text-xs font-semibold px-2 py-0.5 rounded-full">
              {pending.length}
            </span>
          )}
        </div>

        {pending.length === 0 ? (
          <div className="bg-white rounded-xl border border-gray-100 px-5 py-8 text-center">
            <p className="text-muted text-sm">Aucune demande en attente</p>
          </div>
        ) : (
          <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
            {pending.map((row, i) => (
              <div
                key={row.id}
                className={`flex items-center gap-4 px-5 py-4 ${i < pending.length - 1 ? 'border-b border-gray-50' : ''}`}
              >
                <Avatar athlete={row.athlete} />

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-ink text-sm font-medium truncate">{athleteName(row.athlete)}</p>
                    <span className="shrink-0 text-accent text-xs font-medium bg-accent/8 border border-accent/15 px-2 py-0.5 rounded-full">
                      Nouvelle demande
                    </span>
                  </div>
                  <p className="text-muted text-xs mt-0.5">
                    {formatDisciplines(row.athlete?.disciplines)}
                    {row.athlete?.club ? ` · ${row.athlete.club}` : ''}
                  </p>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={() => handleRefuse(row)}
                    disabled={processingId === row.id}
                    className="text-sm text-muted hover:text-ink border border-gray-200 hover:border-gray-300 px-3 py-1.5 rounded-lg transition-colors disabled:opacity-40"
                  >
                    Refuser
                  </button>
                  <button
                    onClick={() => handleAccept(row)}
                    disabled={processingId === row.id}
                    className="text-sm text-white bg-brand hover:bg-brand-hover px-3 py-1.5 rounded-lg transition-colors disabled:opacity-40 flex items-center gap-1.5"
                  >
                    {processingId === row.id ? (
                      <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                      </svg>
                    ) : null}
                    Accepter
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Active athletes */}
      <section>
        <div className="flex items-center gap-3 mb-3">
          <h2 className="text-ink text-base font-semibold">Mes athlètes actifs</h2>
          {active.length > 0 && (
            <span className="text-muted text-xs font-medium bg-gray-100 px-2 py-0.5 rounded-full">
              {active.length}
            </span>
          )}
        </div>

        {active.length === 0 ? (
          <div className="bg-white rounded-xl border border-gray-100 px-5 py-8 text-center">
            <p className="text-muted text-sm">Aucun athlète actif pour l&apos;instant</p>
          </div>
        ) : (
          <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
            <div className="grid grid-cols-[1fr_1fr_auto] px-5 py-3 border-b border-gray-50 text-xs font-medium text-muted uppercase tracking-wide">
              <span>Athlète</span>
              <span>Discipline</span>
              <span>Club</span>
            </div>
            {active.map((row, i) => (
              <button
                key={row.id}
                onClick={() => navigate(`/athletes/${row.athlete_id}`)}
                className={`w-full grid grid-cols-[1fr_1fr_auto] items-center px-5 py-4 gap-4 text-left hover:bg-gray-50 transition-colors ${i < active.length - 1 ? 'border-b border-gray-50' : ''}`}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <Avatar athlete={row.athlete} size="sm" />
                  <span className="text-ink text-sm font-medium truncate">{athleteName(row.athlete)}</span>
                </div>
                <span className="text-muted text-sm truncate">{formatDisciplines(row.athlete?.disciplines)}</span>
                <span className="text-muted text-sm">{row.athlete?.club ?? '—'}</span>
              </button>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}
