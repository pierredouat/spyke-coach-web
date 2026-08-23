import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'
import type { Profile, Discipline } from '../../types/database'

const disciplineLabels: Record<Discipline, string> = {
  sprint: 'Sprint',
  demi_fond: 'Demi-fond',
  fond: 'Fond',
  sauts: 'Sauts',
  lancers: 'Lancers',
  combines: 'Combinés',
  marche: 'Marche',
}

export default function OverviewPage() {
  const { user } = useAuth()
  const [athletes, setAthletes] = useState<Profile[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user) return

    async function fetchAthletes() {
      const { data: relationships } = await supabase
        .from('coach_athlete_relationships')
        .select('athlete_id')
        .eq('coach_id', user!.id)

      if (!relationships?.length) {
        setLoading(false)
        return
      }

      const athleteIds = relationships.map(r => r.athlete_id)
      const { data: profiles } = await supabase
        .from('profiles')
        .select('*')
        .in('id', athleteIds)

      setAthletes(profiles ?? [])
      setLoading(false)
    }

    fetchAthletes()
  }, [user])

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-ink text-2xl font-semibold">Vue d&apos;ensemble</h1>
        <p className="text-muted text-sm mt-1">Votre groupe d&apos;athlètes</p>
      </div>

      {loading ? (
        <div className="flex items-center gap-2 text-muted text-sm">
          <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          Chargement…
        </div>
      ) : athletes.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-100 p-12 text-center max-w-md">
          <div className="w-12 h-12 bg-brand/10 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-6 h-6 text-brand" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
            </svg>
          </div>
          <p className="text-ink font-medium mb-1">Aucun athlète pour l&apos;instant</p>
          <p className="text-muted text-sm">
            Partagez votre code d&apos;invitation à vos athlètes pour qu&apos;ils rejoignent votre groupe via l&apos;app mobile SPYKE.
          </p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
          <div className="grid grid-cols-[1fr_auto] px-5 py-3 border-b border-gray-50 text-xs font-medium text-muted uppercase tracking-wide">
            <span>Athlète</span>
            <span>Discipline</span>
          </div>
          {athletes.map((athlete, i) => (
            <div
              key={athlete.id}
              className={`grid grid-cols-[1fr_auto] items-center px-5 py-4 gap-4 ${i < athletes.length - 1 ? 'border-b border-gray-50' : ''}`}
            >
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-8 h-8 rounded-full bg-brand/10 flex items-center justify-center shrink-0">
                  <span className="text-brand text-xs font-semibold">
                    {(athlete.first_name ?? athlete.last_name ?? '?').charAt(0).toUpperCase()}
                  </span>
                </div>
                <span className="text-ink text-sm font-medium truncate">
                  {[athlete.first_name, athlete.last_name].filter(Boolean).join(' ') || '—'}
                </span>
              </div>
              <span className="text-muted text-sm">
                {athlete.disciplines?.length
                  ? athlete.disciplines.map(d => disciplineLabels[d]).join(', ')
                  : '—'}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
