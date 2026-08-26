export type Json = string | number | boolean | null | { [key: string]: Json } | Json[]

export type UserRole = 'athlete' | 'coach'
export type Discipline = 'sprint' | 'demi_fond' | 'fond' | 'sauts' | 'lancers' | 'combines' | 'marche'
export type RelationshipStatus = 'pending' | 'active' | 'inactive'
export type SleepHoursEnum = 'less_6' | '6_to_8' | 'more_8'
export type SleepQualityTextEnum = 'agitated' | 'okay' | 'restful'
export type ExerciseFamily = 'discipline' | 'musculation' | 'plyometrie' | 'gainage_prehab' | 'cardio_aerobie'
export type ExerciseDisciplineGroup = 'sprint' | 'sauts' | 'lancers' | 'demi_fond' | 'haies' | 'combines' | 'marche'
export type MuscuCycle = 'force' | 'puissance' | 'vitesse' | 'hypertrophie'
export type ExerciseUnit = 'kg' | 's' | 'm' | 'reps' | 'points'
export type SessionStatus = 'a_faire' | 'en_cours' | 'termine' | 'modifie'

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
      sessions: {
        Row: {
          id: string
          plan_id: string | null
          coach_id: string
          athlete_id: string
          scheduled_date: string
          title: string
          description: string | null
          location: string | null
          estimated_duration_minutes: number | null
          status: SessionStatus
          coach_notes: string | null
          is_revealed: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          plan_id?: string | null
          coach_id: string
          athlete_id: string
          scheduled_date: string
          title: string
          description?: string | null
          location?: string | null
          estimated_duration_minutes?: number | null
          status?: SessionStatus
          coach_notes?: string | null
          is_revealed?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          plan_id?: string | null
          coach_id?: string
          athlete_id?: string
          scheduled_date?: string
          title?: string
          description?: string | null
          location?: string | null
          estimated_duration_minutes?: number | null
          status?: SessionStatus
          coach_notes?: string | null
          is_revealed?: boolean
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      session_exercises: {
        Row: {
          id: string
          session_id: string
          exercise_id: string | null
          order_index: number
          name: string
          sets: number | null
          reps: number | null
          distance_meters: number | null
          duration_seconds: number | null
          rest_seconds: number | null
          intensity: string | null
          intention: string | null
          technical_notes: string | null
          notes: string | null
          created_at: string
        }
        Insert: {
          id?: string
          session_id: string
          exercise_id?: string | null
          order_index: number
          name: string
          sets?: number | null
          reps?: number | null
          distance_meters?: number | null
          duration_seconds?: number | null
          rest_seconds?: number | null
          intensity?: string | null
          intention?: string | null
          technical_notes?: string | null
          notes?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          session_id?: string
          exercise_id?: string | null
          order_index?: number
          name?: string
          sets?: number | null
          reps?: number | null
          distance_meters?: number | null
          duration_seconds?: number | null
          rest_seconds?: number | null
          intensity?: string | null
          intention?: string | null
          technical_notes?: string | null
          notes?: string | null
          created_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      journal_entries_coach_summary: {
        Row: {
          athlete_id:        string
          date:              string
          sleep_hours:       SleepHoursEnum | null
          sleep_quality_text: SleepQualityTextEnum | null
          stress_level:      number | null
          soreness_level:    number | null
          motivation_level:  number | null
        }
        Relationships: []
      }
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

export type Session = {
  id: string
  plan_id: string | null
  coach_id: string
  athlete_id: string
  scheduled_date: string
  title: string
  description: string | null
  location: string | null
  estimated_duration_minutes: number | null
  status: SessionStatus
  coach_notes: string | null
  is_revealed: boolean
  created_at: string
  updated_at: string
}

export type SessionExercise = {
  id: string
  session_id: string
  exercise_id: string | null
  order_index: number
  name: string
  sets: number | null
  reps: number | null
  distance_meters: number | null
  duration_seconds: number | null
  rest_seconds: number | null
  intensity: string | null
  intention: string | null
  technical_notes: string | null
  notes: string | null
  created_at: string
}

export type SessionWithExercises = Session & { session_exercises: SessionExercise[] }

export type Profile = Database['public']['Tables']['profiles']['Row']
export type CoachAthleteRelationship = Database['public']['Tables']['coach_athlete_relationships']['Row']
export type Exercise = Database['public']['Tables']['exercises']['Row']

// View: journal_entries_coach_summary — only whitelisted fields, never raw journal_entries
export type JournalCoachSummary = Database['public']['Views']['journal_entries_coach_summary']['Row']
