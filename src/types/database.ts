export type Json = string | number | boolean | null | { [key: string]: Json } | Json[]

export type UserRole = 'athlete' | 'coach'
export type Discipline = 'sprint' | 'demi_fond' | 'fond' | 'sauts' | 'lancers' | 'combines' | 'marche'
export type RelationshipStatus = 'pending' | 'active' | 'inactive'
export type ExerciseFamily = 'discipline' | 'musculation' | 'plyometrie' | 'gainage_prehab' | 'cardio_aerobie'
export type ExerciseDisciplineGroup = 'sprint' | 'sauts' | 'lancers' | 'demi_fond' | 'haies' | 'combines' | 'marche'
export type MuscuCycle = 'force' | 'puissance' | 'vitesse' | 'hypertrophie'
export type ExerciseUnit = 'kg' | 's' | 'm' | 'reps' | 'points'

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string
          role: UserRole | null
          first_name: string | null
          last_name: string | null
          discipline: Discipline | null
          disciplines: Discipline[]
          avatar_url: string | null
          birth_year: number | null
          club: string | null
          invite_code: string | null
          onboarding_completed: boolean
          created_at: string | null
          updated_at: string | null
        }
        Insert: {
          id: string
          role?: UserRole | null
          first_name?: string | null
          last_name?: string | null
          discipline?: Discipline | null
          disciplines?: Discipline[]
          avatar_url?: string | null
          birth_year?: number | null
          club?: string | null
          invite_code?: string | null
          onboarding_completed?: boolean
          created_at?: string | null
          updated_at?: string | null
        }
        Update: {
          id?: string
          role?: UserRole | null
          first_name?: string | null
          last_name?: string | null
          discipline?: Discipline | null
          disciplines?: Discipline[]
          avatar_url?: string | null
          birth_year?: number | null
          club?: string | null
          invite_code?: string | null
          onboarding_completed?: boolean
          created_at?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      coach_athlete_relationships: {
        Row: {
          id: string
          coach_id: string
          athlete_id: string
          status: RelationshipStatus
          invited_at: string
          accepted_at: string | null
        }
        Insert: {
          id?: string
          coach_id: string
          athlete_id: string
          status?: RelationshipStatus
          invited_at?: string
          accepted_at?: string | null
        }
        Update: {
          id?: string
          coach_id?: string
          athlete_id?: string
          status?: RelationshipStatus
          invited_at?: string
          accepted_at?: string | null
        }
        Relationships: []
      }
      exercises: {
        Row: {
          id: string
          coach_id: string | null
          name: string
          category: string | null
          default_unit: ExerciseUnit | null
          family: ExerciseFamily | null
          discipline_group: ExerciseDisciplineGroup | null
          musculation_cycle: MuscuCycle | null
          created_at: string
        }
        Insert: {
          id?: string
          coach_id?: string | null
          name: string
          category?: string | null
          default_unit?: ExerciseUnit | null
          family?: ExerciseFamily | null
          discipline_group?: ExerciseDisciplineGroup | null
          musculation_cycle?: MuscuCycle | null
          created_at?: string
        }
        Update: {
          id?: string
          coach_id?: string | null
          name?: string
          category?: string | null
          default_unit?: ExerciseUnit | null
          family?: ExerciseFamily | null
          discipline_group?: ExerciseDisciplineGroup | null
          musculation_cycle?: MuscuCycle | null
          created_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

export type Profile = Database['public']['Tables']['profiles']['Row']
export type CoachAthleteRelationship = Database['public']['Tables']['coach_athlete_relationships']['Row']
export type Exercise = Database['public']['Tables']['exercises']['Row']
