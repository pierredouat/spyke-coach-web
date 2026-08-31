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
