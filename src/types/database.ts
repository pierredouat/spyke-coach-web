export type Json = string | number | boolean | null | { [key: string]: Json } | Json[]

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string
          role: string | null
          full_name: string | null
          club: string | null
          invitation_code: string | null
          discipline: string | null
          avatar_url: string | null
          created_at: string | null
        }
        Insert: {
          id: string
          role?: string | null
          full_name?: string | null
          club?: string | null
          invitation_code?: string | null
          discipline?: string | null
          avatar_url?: string | null
          created_at?: string | null
        }
        Update: {
          id?: string
          role?: string | null
          full_name?: string | null
          club?: string | null
          invitation_code?: string | null
          discipline?: string | null
          avatar_url?: string | null
          created_at?: string | null
        }
        Relationships: []
      }
      coach_athlete_relationships: {
        Row: {
          id: string
          coach_id: string
          athlete_id: string
          created_at: string | null
        }
        Insert: {
          id?: string
          coach_id: string
          athlete_id: string
          created_at?: string | null
        }
        Update: {
          id?: string
          coach_id?: string
          athlete_id?: string
          created_at?: string | null
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
