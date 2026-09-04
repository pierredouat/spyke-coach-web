export type Json = string | number | boolean | null | { [key: string]: Json } | Json[]

export type UserRole = 'athlete' | 'coach'
export type StaffRole = 'head_coach' | 'assistant_coach' | 'strength_coach' | 'trainer'
export type Gender = 'men' | 'women'
export type Discipline = 'sprint' | 'demi_fond' | 'fond' | 'sauts' | 'lancers' | 'combines' | 'marche'
export type RelationshipStatus = 'pending' | 'active' | 'inactive'
export type SleepHoursEnum = 'less_6' | '6_to_8' | 'more_8'
export type SleepQualityTextEnum = 'agitated' | 'okay' | 'restful'
export type ExerciseFamily =
  | 'discipline'
  | 'musculation'
  | 'explosif'
  | 'pliometrie'
  | 'gainage'
  | 'mobilite'
  | 'vitesse'
  | 'coordination'
  | 'cardio_aerobie'
export type ExerciseDisciplineGroup = 'sprint' | 'sauts' | 'lancers' | 'demi_fond' | 'haies' | 'combines' | 'marche'
export type MuscuCycle = 'force' | 'puissance' | 'vitesse' | 'hypertrophie'
export type ExerciseUnit = 'kg' | 's' | 'm' | 'reps' | 'points'
export type SessionStatus = 'a_faire' | 'en_cours' | 'termine' | 'modifie'
export type BodyZone =
  | 'tete' | 'cou'
  | 'epaule' | 'bras' | 'coude' | 'avant_bras' | 'poignet'
  | 'poitrine' | 'abdomen'
  | 'dos_superieur' | 'dos_inferieur'
  | 'hanche' | 'fessier'
  | 'quadriceps' | 'ischio_jambiers' | 'adducteurs'
  | 'genou' | 'mollet' | 'tibia' | 'cheville'

export type InjuryStatus = 'active' | 'recovered'
export type AppointmentStatus = 'requested' | 'confirmed' | 'cancelled'

export type AthleticEvent =
  | '60m' | '100m' | '200m' | '400m'
  | '60m_haies' | '100m_haies' | '110m_haies' | '400m_haies'
  | '4x100m' | '4x400m'
  | '800m' | '1500m' | 'mile' | '3000m' | '3000m_steeple'
  | '5000m' | '10000m' | 'semi_marathon' | 'marathon' | 'cross'
  | 'longueur' | 'triple_saut' | 'hauteur' | 'perche'
  | 'poids' | 'disque' | 'javelot' | 'marteau'
  | 'decathlon' | 'heptathlon' | 'pentathlon'
  | 'marche_10km' | 'marche_20km' | 'marche_35km' | 'marche_50km'
export type MarkUnit = 'seconds' | 'meters' | 'points'

export const STAFF_ROLE_LABELS: Record<StaffRole, string> = {
  head_coach:       'Coach Principal',
  assistant_coach:  'Coach Adjoint',
  strength_coach:   'Préparateur Physique',
  trainer:          'Soigneur / Kiné',
}

export const BODY_ZONE_LABELS: Record<BodyZone, string> = {
  tete:             'Tête',
  cou:              'Cou',
  epaule:           'Épaule',
  bras:             'Bras',
  coude:            'Coude',
  avant_bras:       'Avant-bras',
  poignet:          'Poignet',
  poitrine:         'Poitrine',
  abdomen:          'Abdomen',
  dos_superieur:    'Dos supérieur',
  dos_inferieur:    'Dos inférieur',
  hanche:           'Hanche',
  fessier:          'Fessier',
  quadriceps:       'Quadriceps',
  ischio_jambiers:  'Ischio-jambiers',
  adducteurs:       'Adducteurs',
  genou:            'Genou',
  mollet:           'Mollet',
  tibia:            'Tibia',
  cheville:         'Cheville',
}

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
          gender: Gender | null
          weight_kg: number | null
          height_cm: number | null
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
          gender?: Gender | null
          weight_kg?: number | null
          height_cm?: number | null
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
          gender?: Gender | null
          weight_kg?: number | null
          height_cm?: number | null
        }
        Relationships: []
      }
      coach_athlete_relationships: {
        Row: {
          id: string
          coach_id: string
          athlete_id: string
          team_id: string | null
          status: RelationshipStatus
          invited_at: string
          accepted_at: string | null
        }
        Insert: {
          id?: string
          coach_id: string
          athlete_id: string
          team_id?: string | null
          status?: RelationshipStatus
          invited_at?: string
          accepted_at?: string | null
        }
        Update: {
          id?: string
          coach_id?: string
          athlete_id?: string
          team_id?: string | null
          status?: RelationshipStatus
          invited_at?: string
          accepted_at?: string | null
        }
        Relationships: []
      }
      teams: {
        Row: {
          id: string
          name: string
          university_name: string | null
          logo_url: string | null
          primary_color: string
          created_at: string
        }
        Insert: {
          id?: string
          name: string
          university_name?: string | null
          logo_url?: string | null
          primary_color?: string
          created_at?: string
        }
        Update: {
          id?: string
          name?: string
          university_name?: string | null
          logo_url?: string | null
          primary_color?: string
          created_at?: string
        }
        Relationships: []
      }
      team_members: {
        Row: {
          team_id: string
          user_id: string
          role: StaffRole
          created_at: string
        }
        Insert: {
          team_id: string
          user_id: string
          role?: StaffRole
          created_at?: string
        }
        Update: {
          team_id?: string
          user_id?: string
          role?: StaffRole
          created_at?: string
        }
        Relationships: []
      }
      team_invitations: {
        Row: {
          id: string
          team_id: string
          role: StaffRole
          code: string
          created_by: string
          used_by: string | null
          used_at: string | null
          expires_at: string
          created_at: string
        }
        Insert: {
          id?: string
          team_id: string
          role?: StaffRole
          code: string
          created_by: string
          used_by?: string | null
          used_at?: string | null
          expires_at?: string
          created_at?: string
        }
        Update: {
          id?: string
          team_id?: string
          role?: StaffRole
          code?: string
          created_by?: string
          used_by?: string | null
          used_at?: string | null
          expires_at?: string
          created_at?: string
        }
        Relationships: []
      }
      performances: {
        Row: {
          id: string
          athlete_id: string
          event: AthleticEvent
          mark: string
          mark_value: number
          unit: MarkUnit
          is_pb: boolean
          date: string
          location: string | null
          notes: string | null
          video_url: string | null
          created_at: string
        }
        Insert: {
          id?: string
          athlete_id: string
          event: AthleticEvent
          mark: string
          mark_value: number
          unit: MarkUnit
          is_pb?: boolean
          date: string
          location?: string | null
          notes?: string | null
          video_url?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          athlete_id?: string
          event?: AthleticEvent
          mark?: string
          mark_value?: number
          unit?: MarkUnit
          is_pb?: boolean
          date?: string
          location?: string | null
          notes?: string | null
          video_url?: string | null
          created_at?: string
        }
        Relationships: []
      }
      exercise_results: {
        Row: {
          id: string
          session_exercise_id: string
          exercise_id: string | null
          athlete_id: string
          actual_value: string
          actual_value_numeric: number | null
          unit: string | null
          notes: string | null
          recorded_at: string
        }
        Insert: {
          id?: string
          session_exercise_id: string
          exercise_id?: string | null
          athlete_id: string
          actual_value: string
          actual_value_numeric?: number | null
          unit?: string | null
          notes?: string | null
          recorded_at?: string
        }
        Update: {
          id?: string
          session_exercise_id?: string
          exercise_id?: string | null
          athlete_id?: string
          actual_value?: string
          actual_value_numeric?: number | null
          unit?: string | null
          notes?: string | null
          recorded_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "exercise_results_exercise_id_fkey"
            columns: ["exercise_id"]
            isOneToOne: false
            referencedRelation: "exercises"
            referencedColumns: ["id"]
          }
        ]
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
          intensity_mode: 'fixed' | 'percentage'
          intensity_percentage: number | null
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
          intensity_mode?: 'fixed' | 'percentage'
          intensity_percentage?: number | null
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
          intensity_mode?: 'fixed' | 'percentage'
          intensity_percentage?: number | null
          intention?: string | null
          technical_notes?: string | null
          notes?: string | null
          created_at?: string
        }
        Relationships: []
      }
      athlete_maxes: {
        Row: {
          id: string
          athlete_id: string
          exercise_id: string
          max_value_kg: number
          updated_at: string
        }
        Insert: {
          id?: string
          athlete_id: string
          exercise_id: string
          max_value_kg: number
          updated_at?: string
        }
        Update: {
          id?: string
          athlete_id?: string
          exercise_id?: string
          max_value_kg?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'athlete_maxes_athlete_id_fkey'
            columns: ['athlete_id']
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'athlete_maxes_exercise_id_fkey'
            columns: ['exercise_id']
            referencedRelation: 'exercises'
            referencedColumns: ['id']
          }
        ]
      }
      injuries: {
        Row: {
          id: string
          athlete_id: string
          body_zone: BodyZone
          side: string | null
          severity: number
          notes: string | null
          status: InjuryStatus
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          athlete_id: string
          body_zone: BodyZone
          side?: string | null
          severity: number
          notes?: string | null
          status?: InjuryStatus
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          athlete_id?: string
          body_zone?: BodyZone
          side?: string | null
          severity?: number
          notes?: string | null
          status?: InjuryStatus
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "injuries_athlete_id_fkey"
            columns: ["athlete_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          }
        ]
      }
      trainer_availability: {
        Row: {
          id: string
          trainer_id: string
          team_id: string
          start_time: string
          end_time: string
          is_booked: boolean
          created_at: string
        }
        Insert: {
          id?: string
          trainer_id: string
          team_id: string
          start_time: string
          end_time: string
          is_booked?: boolean
          created_at?: string
        }
        Update: {
          id?: string
          trainer_id?: string
          team_id?: string
          start_time?: string
          end_time?: string
          is_booked?: boolean
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "trainer_availability_trainer_id_fkey"
            columns: ["trainer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          }
        ]
      }
      appointments: {
        Row: {
          id: string
          trainer_availability_id: string
          athlete_id: string
          injury_id: string | null
          status: AppointmentStatus
          created_at: string
        }
        Insert: {
          id?: string
          trainer_availability_id: string
          athlete_id: string
          injury_id?: string | null
          status?: AppointmentStatus
          created_at?: string
        }
        Update: {
          id?: string
          trainer_availability_id?: string
          athlete_id?: string
          injury_id?: string | null
          status?: AppointmentStatus
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "appointments_trainer_availability_id_fkey"
            columns: ["trainer_availability_id"]
            isOneToOne: false
            referencedRelation: "trainer_availability"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointments_athlete_id_fkey"
            columns: ["athlete_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointments_injury_id_fkey"
            columns: ["injury_id"]
            isOneToOne: false
            referencedRelation: "injuries"
            referencedColumns: ["id"]
          }
        ]
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
      get_my_team_ids: {
        Args: Record<never, never>
        Returns: string[]
      }
      book_trainer_slot: {
        Args: { p_availability_id: string; p_injury_id?: string | null }
        Returns: string
      }
      join_team_with_code: {
        Args: { p_code: string }
        Returns: Json
      }
      validate_team_invite_code: {
        Args: { p_code: string }
        Returns: Json
      }
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
  intensity_mode: 'fixed' | 'percentage'
  intensity_percentage: number | null
  intention: string | null
  technical_notes: string | null
  notes: string | null
  created_at: string
}

export type SessionWithExercises = Session & { session_exercises: SessionExercise[] }

export type Profile = Database['public']['Tables']['profiles']['Row']
export type CoachAthleteRelationship = Database['public']['Tables']['coach_athlete_relationships']['Row']
export type Exercise = Database['public']['Tables']['exercises']['Row']
export type Team = Database['public']['Tables']['teams']['Row']
export type TeamMember = Database['public']['Tables']['team_members']['Row']
export type TeamInvitation = Database['public']['Tables']['team_invitations']['Row']
export type Performance = Database['public']['Tables']['performances']['Row']
export type ExerciseResult = Database['public']['Tables']['exercise_results']['Row']
export type Injury = Database['public']['Tables']['injuries']['Row']
export type TrainerAvailability = Database['public']['Tables']['trainer_availability']['Row']
export type Appointment = Database['public']['Tables']['appointments']['Row']

// View: journal_entries_coach_summary — only whitelisted fields, never raw journal_entries
export type JournalCoachSummary = Database['public']['Views']['journal_entries_coach_summary']['Row']
