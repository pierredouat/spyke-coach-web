import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import type { Session, User } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'
import type { Profile, Team, StaffRole } from '../types/database'

interface AuthContextValue {
  session: Session | null
  user: User | null
  profile: Profile | null
  team: Team | null
  teamRole: StaffRole | null
  loading: boolean
  refreshProfile: () => Promise<void>
  refreshTeam: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue>({
  session: null,
  user: null,
  profile: null,
  team: null,
  teamRole: null,
  loading: true,
  refreshProfile: async () => {},
  refreshTeam: async () => {},
})

const DEFAULT_BRAND = '#3743ba'
const DEFAULT_BRAND_HOVER = '#2d389e'

// Darken a hex color by `amount` (0–1). Used to derive --color-brand-hover.
function darkenHex(hex: string, amount = 0.12): string {
  const raw = hex.replace('#', '')
  if (raw.length !== 6) return DEFAULT_BRAND_HOVER
  const r = parseInt(raw.slice(0, 2), 16)
  const g = parseInt(raw.slice(2, 4), 16)
  const b = parseInt(raw.slice(4, 6), 16)
  const f = 1 - amount
  return '#' + [r, g, b]
    .map(c => Math.round(c * f).toString(16).padStart(2, '0'))
    .join('')
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [team, setTeam] = useState<Team | null>(null)
  const [teamRole, setTeamRole] = useState<StaffRole | null>(null)
  const [loading, setLoading] = useState(true)

  async function fetchProfile(userId: string) {
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single()
    setProfile(data)
  }

  async function fetchTeam(userId: string) {
    const { data: membership } = await supabase
      .from('team_members')
      .select('team_id, role')
      .eq('user_id', userId)
      .single()

    if (!membership) {
      setTeam(null)
      setTeamRole(null)
      return
    }

    setTeamRole(membership.role as StaffRole)

    const { data: teamData } = await supabase
      .from('teams')
      .select('*')
      .eq('id', membership.team_id)
      .single()

    setTeam(teamData)
  }

  async function refreshProfile() {
    if (session?.user) await fetchProfile(session.user.id)
  }

  // Inject team brand color as CSS variables on :root — covers all Tailwind
  // utility classes (bg-brand, text-brand, border-brand, etc.) and FullCalendar
  // vars that reference var(--color-brand). Falls back to default blue.
  useEffect(() => {
    const color = (team?.primary_color ?? DEFAULT_BRAND).toLowerCase()
    document.documentElement.style.setProperty('--color-brand', color)
    document.documentElement.style.setProperty('--color-brand-hover', darkenHex(color))
  }, [team?.primary_color])

  async function refreshTeam() {
    if (session?.user) await fetchTeam(session.user.id)
  }

  async function loadUser(userId: string) {
    await Promise.all([fetchProfile(userId), fetchTeam(userId)])
    setLoading(false)
  }

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      if (session?.user) loadUser(session.user.id)
      else setLoading(false)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
      if (session?.user) {
        fetchProfile(session.user.id)
        fetchTeam(session.user.id)
      } else {
        setProfile(null)
        setTeam(null)
        setTeamRole(null)
      }
    })

    return () => subscription.unsubscribe()
  }, [])

  return (
    <AuthContext.Provider value={{
      session, user: session?.user ?? null,
      profile, team, teamRole,
      loading, refreshProfile, refreshTeam,
    }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)
