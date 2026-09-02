import { useEffect, useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'
import type { StaffRole, TeamInvitation, BodyZone } from '../../types/database'
import { STAFF_ROLE_LABELS, BODY_ZONE_LABELS } from '../../types/database'

type TeamInjuryRow = {
  id: string
  athlete_id: string
  body_zone: BodyZone
  side: string | null
  severity: number
  created_at: string
  profiles: { first_name: string | null; last_name: string | null } | null
}

function injurySeverityClass(s: number) {
  if (s <= 3) return 'text-emerald-700 bg-emerald-50 border-emerald-200'
  if (s <= 6) return 'text-amber-700 bg-amber-50 border-amber-200'
  return 'text-red-700 bg-red-50 border-red-200'
}

function daysSince(isoDate: string) {
  return Math.floor((Date.now() - new Date(isoDate).getTime()) / 86400000)
}

type StaffMember = {
  user_id: string
  role: StaffRole
  created_at: string
  profile: {
    first_name: string | null
    last_name: string | null
    avatar_url: string | null
  } | null
}

function generateStaffCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  return Array.from({ length: 8 }, () => chars[Math.floor(Math.random() * chars.length)]).join('')
}

function memberName(m: StaffMember): string {
  const p = m.profile
  if (!p) return 'Membre inconnu'
  return [p.first_name, p.last_name].filter(Boolean).join(' ') || '—'
}

function memberInitial(m: StaffMember): string {
  const p = m.profile
  return (p?.first_name ?? p?.last_name ?? '?').charAt(0).toUpperCase()
}

// ─── Role badge ───────────────────────────────────────────────────────────────
const ROLE_COLORS: Record<StaffRole, string> = {
  head_coach:      'bg-brand/10 text-brand',
  assistant_coach: 'bg-slate-100 text-slate-600',
  strength_coach:  'bg-amber-50 text-amber-700',
  trainer:         'bg-emerald-50 text-emerald-700',
}

function RoleBadge({ role }: { role: StaffRole }) {
  return (
    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${ROLE_COLORS[role]}`}>
      {STAFF_ROLE_LABELS[role]}
    </span>
  )
}

// ─── Invite modal ─────────────────────────────────────────────────────────────
function InviteModal({
  teamId,
  createdBy,
  onClose,
  onCreated,
}: {
  teamId: string
  createdBy: string
  onClose: () => void
  onCreated: (inv: TeamInvitation) => void
}) {
  const [role, setRole] = useState<StaffRole>('assistant_coach')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const staffRoles: StaffRole[] = ['assistant_coach', 'strength_coach', 'trainer']

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const code = generateStaffCode()
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()

    const { data, error: dbErr } = await supabase
      .from('team_invitations')
      .insert({ team_id: teamId, role, code, created_by: createdBy, expires_at: expiresAt })
      .select()
      .single()

    if (dbErr) {
      setError(dbErr.message)
      setLoading(false)
      return
    }

    onCreated(data as TeamInvitation)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm mx-4 p-6">
        <h2 className="text-ink text-lg font-semibold mb-1">Inviter un membre du staff</h2>
        <p className="text-muted text-sm mb-5">
          Un code d&apos;invitation valable 7 jours sera généré. Transmettez-le à la personne concernée.
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm text-muted mb-1.5">Rôle</label>
            <select
              value={role}
              onChange={e => setRole(e.target.value as StaffRole)}
              className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm text-ink focus:outline-none focus:border-brand focus:ring-1 focus:ring-brand"
            >
              {staffRoles.map(r => (
                <option key={r} value={r}>{STAFF_ROLE_LABELS[r]}</option>
              ))}
            </select>
          </div>

          {error && (
            <p className="text-accent text-sm bg-accent/10 border border-accent/20 rounded-lg px-3 py-2">
              {error}
            </p>
          )}

          <div className="flex gap-2 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 border border-gray-200 text-ink text-sm font-medium py-2.5 rounded-lg hover:bg-gray-50 transition-colors"
            >
              Annuler
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 bg-brand hover:bg-brand-hover text-white text-sm font-medium py-2.5 rounded-lg transition-colors disabled:opacity-50"
            >
              {loading ? 'Génération…' : 'Générer le code'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ─── Team settings section ────────────────────────────────────────────────────
function TeamSettingsSection({
  teamId,
  initialName,
  onUpdated,
}: {
  teamId: string
  initialName: string
  onUpdated: (name: string) => void
}) {
  const [name, setName] = useState(initialName)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSave(e: FormEvent) {
    e.preventDefault()
    if (!name.trim()) return
    setSaving(true)
    setError(null)

    const { error: dbErr } = await supabase
      .from('teams')
      .update({ name: name.trim() })
      .eq('id', teamId)

    if (dbErr) {
      setError(dbErr.message)
    } else {
      onUpdated(name.trim())
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    }
    setSaving(false)
  }

  return (
    <section className="bg-white rounded-xl border border-gray-100 p-5">
      <h2 className="text-ink text-base font-semibold mb-4">Réglages de l&apos;équipe</h2>
      <form onSubmit={handleSave} className="space-y-4 max-w-sm">
        <div>
          <label className="block text-sm text-muted mb-1.5">Nom de l&apos;équipe</label>
          <input
            type="text"
            value={name}
            onChange={e => setName(e.target.value)}
            required
            className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm text-ink focus:outline-none focus:border-brand focus:ring-1 focus:ring-brand"
          />
        </div>

        {error && (
          <p className="text-accent text-sm">{error}</p>
        )}

        <button
          type="submit"
          disabled={saving || !name.trim() || name.trim() === initialName}
          className="text-sm bg-brand hover:bg-brand-hover text-white font-medium px-4 py-2 rounded-lg transition-colors disabled:opacity-40"
        >
          {saving ? 'Enregistrement…' : saved ? 'Enregistré ✓' : 'Enregistrer'}
        </button>
      </form>
    </section>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────
export default function TeamPage() {
  const { user, team, teamRole, refreshTeam } = useAuth()
  const navigate = useNavigate()
  const [members, setMembers] = useState<StaffMember[]>([])
  const [invitations, setInvitations] = useState<TeamInvitation[]>([])
  const [injuries, setInjuries] = useState<TeamInjuryRow[]>([])
  const [loading, setLoading] = useState(true)
  const [showInvite, setShowInvite] = useState(false)
  const [newCode, setNewCode] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [removingId, setRemovingId] = useState<string | null>(null)

  const isHeadCoach = teamRole === 'head_coach'

  useEffect(() => {
    if (!team) return
    loadTeamData()
  }, [team])

  async function loadTeamData() {
    if (!team) return
    setLoading(true)

    const [{ data: membersData }, { data: invData }, { data: injuriesData }] = await Promise.all([
      supabase
        .from('team_members')
        .select(`
          user_id, role, created_at,
          profile:profiles!team_members_user_id_fkey (first_name, last_name, avatar_url)
        `)
        .eq('team_id', team.id)
        .order('created_at'),
      isHeadCoach
        ? supabase
            .from('team_invitations')
            .select('*')
            .eq('team_id', team.id)
            .is('used_by', null)
            .gt('expires_at', new Date().toISOString())
            .order('created_at', { ascending: false })
        : Promise.resolve({ data: [] }),
      supabase
        .from('injuries')
        .select(`
          id, athlete_id, body_zone, side, severity, created_at,
          profiles!injuries_athlete_id_fkey(first_name, last_name)
        `)
        .eq('status', 'active')
        .order('severity', { ascending: false }),
    ])

    setMembers((membersData ?? []) as unknown as StaffMember[])
    setInvitations((invData ?? []) as TeamInvitation[])
    setInjuries((injuriesData ?? []) as unknown as TeamInjuryRow[])
    setLoading(false)
  }

  async function handleRemoveMember(userId: string) {
    if (!team) return
    setRemovingId(userId)

    const { error } = await supabase
      .from('team_members')
      .delete()
      .eq('team_id', team.id)
      .eq('user_id', userId)

    if (!error) {
      setMembers(prev => prev.filter(m => m.user_id !== userId))
    }
    setRemovingId(null)
  }

  function handleInviteCreated(inv: TeamInvitation) {
    setInvitations(prev => [inv, ...prev])
    setNewCode(inv.code)
    setShowInvite(false)
  }

  function copyCode(code: string) {
    navigator.clipboard.writeText(code)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  if (!team && !loading) {
    return (
      <div className="max-w-2xl">
        <div className="mb-8">
          <h1 className="text-ink text-2xl font-semibold">Mon équipe</h1>
        </div>
        <div className="bg-white rounded-xl border border-gray-100 p-10 text-center">
          <p className="text-muted text-sm">Aucune équipe associée à votre compte.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-2xl space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-ink text-2xl font-semibold">Mon équipe</h1>
        {team && <p className="text-muted text-sm mt-1">{team.name}</p>}
      </div>

      {/* New invitation code banner */}
      {newCode && (
        <div className="bg-brand/5 border border-brand/15 rounded-xl p-5">
          <p className="text-ink text-sm font-medium mb-1">Code d&apos;invitation généré</p>
          <p className="text-muted text-xs mb-3">
            Transmettez ce code au nouveau membre du staff. Il devra le saisir lors de son inscription.
          </p>
          <div className="flex items-center gap-3">
            <code className="text-brand font-mono text-xl font-bold tracking-widest">{newCode}</code>
            <button
              onClick={() => copyCode(newCode)}
              className="text-xs text-brand hover:text-brand-hover border border-brand/30 px-3 py-1.5 rounded-lg transition-colors"
            >
              {copied ? 'Copié !' : 'Copier'}
            </button>
            <button
              onClick={() => setNewCode(null)}
              className="ml-auto text-xs text-muted hover:text-ink"
            >
              Fermer
            </button>
          </div>
        </div>
      )}

      {/* Staff list */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <h2 className="text-ink text-base font-semibold">Staff</h2>
            {members.length > 0 && (
              <span className="text-muted text-xs bg-gray-100 px-2 py-0.5 rounded-full">
                {members.length}
              </span>
            )}
          </div>
          {isHeadCoach && (
            <button
              onClick={() => setShowInvite(true)}
              className="flex items-center gap-1.5 text-sm text-brand border border-brand/30 hover:bg-brand/5 px-3 py-1.5 rounded-lg transition-colors"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Inviter un membre
            </button>
          )}
        </div>

        {loading ? (
          <div className="flex items-center gap-2 text-muted text-sm py-6">
            <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            Chargement…
          </div>
        ) : (
          <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
            {members.map((member, i) => (
              <div
                key={member.user_id}
                className={`flex items-center gap-4 px-5 py-4 ${i < members.length - 1 ? 'border-b border-gray-50' : ''}`}
              >
                <div className="w-9 h-9 rounded-full bg-brand/10 flex items-center justify-center shrink-0">
                  <span className="text-brand text-sm font-semibold">{memberInitial(member)}</span>
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-ink text-sm font-medium">{memberName(member)}</span>
                    {member.user_id === user?.id && (
                      <span className="text-muted text-xs">(vous)</span>
                    )}
                    <RoleBadge role={member.role} />
                  </div>
                </div>

                {isHeadCoach && member.user_id !== user?.id && (
                  <button
                    onClick={() => handleRemoveMember(member.user_id)}
                    disabled={removingId === member.user_id}
                    className="text-xs text-muted hover:text-accent border border-gray-200 hover:border-accent/30 px-2.5 py-1.5 rounded-lg transition-colors disabled:opacity-40 shrink-0"
                  >
                    {removingId === member.user_id ? '…' : 'Retirer'}
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Pending invitations */}
      {isHeadCoach && invitations.length > 0 && (
        <section>
          <h2 className="text-ink text-base font-semibold mb-3">Invitations en attente</h2>
          <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
            {invitations.map((inv, i) => (
              <div
                key={inv.id}
                className={`flex items-center gap-4 px-5 py-4 ${i < invitations.length - 1 ? 'border-b border-gray-50' : ''}`}
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <code className="text-sm font-mono font-semibold text-ink tracking-widest">{inv.code}</code>
                    <RoleBadge role={inv.role} />
                  </div>
                  <p className="text-muted text-xs mt-0.5">
                    Expire le {new Date(inv.expires_at).toLocaleDateString('fr-FR')}
                  </p>
                </div>
                <button
                  onClick={() => copyCode(inv.code)}
                  className="text-xs text-brand hover:text-brand-hover border border-brand/30 px-2.5 py-1.5 rounded-lg transition-colors shrink-0"
                >
                  Copier
                </button>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Team settings — head_coach only */}
      {isHeadCoach && team && (
        <TeamSettingsSection
          teamId={team.id}
          initialName={team.name}
          onUpdated={async () => { await refreshTeam() }}
        />
      )}

      {/* Blessures actives */}
      <section>
        <div className="flex items-center gap-2 mb-3">
          <h2 className="text-ink text-base font-semibold">Blessures actives</h2>
          {injuries.length > 0 && (
            <span className="text-xs bg-accent/10 text-accent border border-accent/20 px-2 py-0.5 rounded-full">
              {injuries.length}
            </span>
          )}
        </div>

        {loading ? (
          <div className="flex items-center gap-2 text-muted text-sm py-4">
            <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            Chargement…
          </div>
        ) : injuries.length === 0 ? (
          <div className="bg-white rounded-xl border border-gray-100 px-5 py-6 text-center">
            <p className="text-muted text-sm">Aucune blessure active dans l&apos;équipe.</p>
          </div>
        ) : (
          <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
            {injuries.map((inj, i) => {
              const athleteName = [inj.profiles?.first_name, inj.profiles?.last_name]
                .filter(Boolean).join(' ') || '—'
              return (
                <button
                  key={inj.id}
                  onClick={() => navigate(`/athletes/${inj.athlete_id}`)}
                  className={`w-full flex items-center gap-4 px-5 py-4 text-left hover:bg-gray-50 transition-colors ${i < injuries.length - 1 ? 'border-b border-gray-50' : ''}`}
                >
                  <div className="w-8 h-8 rounded-full bg-accent/10 flex items-center justify-center shrink-0">
                    <span className="text-accent text-xs font-semibold">
                      {athleteName.charAt(0).toUpperCase()}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-0.5">
                      <span className="text-ink text-sm font-medium">{athleteName}</span>
                      <span className={`text-xs px-2 py-0.5 rounded-full border ${injurySeverityClass(inj.severity)}`}>
                        {inj.severity}/10
                      </span>
                    </div>
                    <p className="text-muted text-xs">
                      {BODY_ZONE_LABELS[inj.body_zone]}
                      {inj.side ? ` · ${inj.side === 'left' ? 'Gauche' : 'Droite'}` : ''}
                      {' · '}depuis {daysSince(inj.created_at)} jour{daysSince(inj.created_at) > 1 ? 's' : ''}
                    </p>
                  </div>
                  <svg className="w-4 h-4 text-muted shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </button>
              )
            })}
          </div>
        )}
      </section>

      {/* Invite modal */}
      {showInvite && team && user && (
        <InviteModal
          teamId={team.id}
          createdBy={user.id}
          onClose={() => setShowInvite(false)}
          onCreated={handleInviteCreated}
        />
      )}
    </div>
  )
}
