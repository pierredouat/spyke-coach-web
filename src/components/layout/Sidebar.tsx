import { NavLink } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import type { StaffRole } from '../../types/database'

type NavItem = {
  to: string
  end?: boolean
  label: string
  icon: React.ReactNode
}

const NAV_OVERVIEW: NavItem = {
  to: '/',
  end: true,
  label: "Vue d'ensemble",
  icon: (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
    </svg>
  ),
}

const NAV_ATHLETES: NavItem = {
  to: '/athletes',
  label: 'Athlètes',
  icon: (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  ),
}

const NAV_PLANNING: NavItem = {
  to: '/planning',
  label: 'Planning',
  icon: (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
    </svg>
  ),
}

const NAV_EXERCISES: NavItem = {
  to: '/exercises',
  label: "Banque d'exercices",
  icon: (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
    </svg>
  ),
}

const NAV_TEAM: NavItem = {
  to: '/team',
  label: 'Mon équipe',
  icon: (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
    </svg>
  ),
}

const NAV_TRAINER: NavItem = {
  to: '/trainer',
  label: 'Disponibilités',
  icon: (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
    </svg>
  ),
}

function getNavItems(role: StaffRole | null): NavItem[] {
  switch (role) {
    case 'trainer':
      return [NAV_OVERVIEW, NAV_ATHLETES, NAV_TRAINER, NAV_TEAM]
    case 'head_coach':
    case 'assistant_coach':
    case 'strength_coach':
    default:
      return [NAV_OVERVIEW, NAV_ATHLETES, NAV_PLANNING, NAV_EXERCISES, NAV_TEAM]
  }
}

function NavItemLink({ item }: { item: NavItem }) {
  return (
    <NavLink
      to={item.to}
      end={item.end ?? false}
      className={({ isActive }) =>
        `flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors ${
          isActive
            ? 'bg-brand/15 text-brand'
            : 'text-muted hover:text-white hover:bg-white/5'
        }`
      }
    >
      <span className="shrink-0">{item.icon}</span>
      <span className="text-sm font-medium">{item.label}</span>
    </NavLink>
  )
}

export default function Sidebar() {
  const { profile, team, teamRole } = useAuth()
  const navItems = getNavItems(teamRole)

  return (
    <aside className="w-60 min-h-screen bg-sidebar border-r border-sidebar-border flex flex-col fixed left-0 top-0 bottom-0">
      <div className="px-5 pt-5 pb-4 border-b border-sidebar-border">
        {/* App wordmark — toujours présent */}
        <div className="flex items-center gap-1 mb-3">
          <span className="text-brand font-bold text-base tracking-tight">SPYKE</span>
          <span className="text-white/50 font-light text-base tracking-tight">Coach</span>
        </div>

        {/* Identité équipe */}
        {team && (
          <div className="flex items-center gap-2.5 min-w-0">
            {team.logo_url && (
              <img
                src={team.logo_url}
                alt=""
                className="w-8 h-8 rounded-lg object-contain bg-white/5 shrink-0"
              />
            )}
            <span className="text-white text-sm font-semibold truncate leading-tight">
              {team.name}
            </span>
          </div>
        )}
      </div>

      <nav className="flex-1 px-3 py-4 space-y-0.5">
        {navItems.map(item => (
          <NavItemLink key={item.to} item={item} />
        ))}
      </nav>

      <div className="px-3 py-3 border-t border-sidebar-border">
        <NavLink
          to="/profile"
          className={({ isActive }) =>
            `flex items-center gap-3 w-full px-3 py-2.5 rounded-lg transition-colors ${
              isActive
                ? 'bg-brand/15 text-brand'
                : 'text-muted hover:text-white hover:bg-white/5'
            }`
          }
        >
          <div className="w-6 h-6 rounded-full bg-white/10 flex items-center justify-center shrink-0 text-xs font-semibold">
            {(profile?.first_name ?? profile?.last_name ?? 'C').charAt(0).toUpperCase()}
          </div>
          <div className="min-w-0">
            <p className="text-sm font-medium truncate">
              {[profile?.first_name, profile?.last_name].filter(Boolean).join(' ') || 'Mon profil'}
            </p>
            {profile?.club && <p className="text-xs text-muted/70 truncate">{profile.club}</p>}
          </div>
        </NavLink>
      </div>
    </aside>
  )
}
