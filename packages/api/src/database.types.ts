// Sinh bởi Supabase (MCP generate_typescript_types) cho project erpchess-dev — không sửa tay.
// Sinh lại sau mỗi migration.

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
      academies: {
        Row: {
          created_at: string
          created_by: string | null
          description: string
          id: string
          logo_url: string | null
          name: string
          slug: string
          socials: Json
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          description?: string
          id?: string
          logo_url?: string | null
          name: string
          slug: string
          socials?: Json
        }
        Update: {
          created_at?: string
          created_by?: string | null
          description?: string
          id?: string
          logo_url?: string | null
          name?: string
          slug?: string
          socials?: Json
        }
        Relationships: [
          {
            foreignKeyName: "academies_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      activity_attempts: {
        Row: {
          activity_id: string
          answers: Json
          finished_at: string | null
          id: string
          score: number
          solved: boolean
          student_id: string
          time_ms: number
          tries: number
          updated_at: string
        }
        Insert: {
          activity_id: string
          answers?: Json
          finished_at?: string | null
          id?: string
          score?: number
          solved?: boolean
          student_id: string
          time_ms?: number
          tries?: number
          updated_at?: string
        }
        Update: {
          activity_id?: string
          answers?: Json
          finished_at?: string | null
          id?: string
          score?: number
          solved?: boolean
          student_id?: string
          time_ms?: number
          tries?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "activity_attempts_activity_id_fkey"
            columns: ["activity_id"]
            isOneToOne: false
            referencedRelation: "study_activities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activity_attempts_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      assignment_items: {
        Row: {
          assignment_id: string
          id: string
          position: number
          puzzle_id: string
        }
        Insert: {
          assignment_id: string
          id?: string
          position: number
          puzzle_id: string
        }
        Update: {
          assignment_id?: string
          id?: string
          position?: number
          puzzle_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "assignment_items_assignment_id_fkey"
            columns: ["assignment_id"]
            isOneToOne: false
            referencedRelation: "assignment_progress"
            referencedColumns: ["assignment_id"]
          },
          {
            foreignKeyName: "assignment_items_assignment_id_fkey"
            columns: ["assignment_id"]
            isOneToOne: false
            referencedRelation: "assignments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assignment_items_puzzle_id_fkey"
            columns: ["puzzle_id"]
            isOneToOne: false
            referencedRelation: "puzzles"
            referencedColumns: ["id"]
          },
        ]
      }
      assignment_targets: {
        Row: {
          assignment_id: string
          group_id: string | null
          id: string
          student_id: string | null
        }
        Insert: {
          assignment_id: string
          group_id?: string | null
          id?: string
          student_id?: string | null
        }
        Update: {
          assignment_id?: string
          group_id?: string | null
          id?: string
          student_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "assignment_targets_assignment_id_fkey"
            columns: ["assignment_id"]
            isOneToOne: false
            referencedRelation: "assignment_progress"
            referencedColumns: ["assignment_id"]
          },
          {
            foreignKeyName: "assignment_targets_assignment_id_fkey"
            columns: ["assignment_id"]
            isOneToOne: false
            referencedRelation: "assignments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assignment_targets_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assignment_targets_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      assignments: {
        Row: {
          academy_id: string
          created_at: string
          created_by: string | null
          due_at: string | null
          exercise_id: string | null
          id: string
          instructions: string | null
          title: string
        }
        Insert: {
          academy_id: string
          created_at?: string
          created_by?: string | null
          due_at?: string | null
          exercise_id?: string | null
          id?: string
          instructions?: string | null
          title: string
        }
        Update: {
          academy_id?: string
          created_at?: string
          created_by?: string | null
          due_at?: string | null
          exercise_id?: string | null
          id?: string
          instructions?: string | null
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "assignments_academy_id_fkey"
            columns: ["academy_id"]
            isOneToOne: false
            referencedRelation: "academies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assignments_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assignments_exercise_id_fkey"
            columns: ["exercise_id"]
            isOneToOne: false
            referencedRelation: "exercises"
            referencedColumns: ["id"]
          },
        ]
      }
      attempts: {
        Row: {
          finished_at: string | null
          id: string
          item_id: string
          moves: Json
          solved: boolean
          started_at: string
          student_id: string
          time_ms: number
          tries: number
          updated_at: string
        }
        Insert: {
          finished_at?: string | null
          id?: string
          item_id: string
          moves?: Json
          solved?: boolean
          started_at?: string
          student_id: string
          time_ms?: number
          tries?: number
          updated_at?: string
        }
        Update: {
          finished_at?: string | null
          id?: string
          item_id?: string
          moves?: Json
          solved?: boolean
          started_at?: string
          student_id?: string
          time_ms?: number
          tries?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "attempts_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "assignment_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attempts_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      calendar_events: {
        Row: {
          academy_id: string
          classroom_id: string | null
          coach_id: string | null
          created_at: string
          created_by: string | null
          ends_at: string
          id: string
          kind: string
          starts_at: string
          title: string
        }
        Insert: {
          academy_id: string
          classroom_id?: string | null
          coach_id?: string | null
          created_at?: string
          created_by?: string | null
          ends_at: string
          id?: string
          kind: string
          starts_at: string
          title: string
        }
        Update: {
          academy_id?: string
          classroom_id?: string | null
          coach_id?: string | null
          created_at?: string
          created_by?: string | null
          ends_at?: string
          id?: string
          kind?: string
          starts_at?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "calendar_events_academy_id_fkey"
            columns: ["academy_id"]
            isOneToOne: false
            referencedRelation: "academies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "calendar_events_classroom_id_fkey"
            columns: ["classroom_id"]
            isOneToOne: true
            referencedRelation: "classrooms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "calendar_events_coach_id_fkey"
            columns: ["coach_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "calendar_events_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      classroom_attendance: {
        Row: {
          classroom_id: string
          joined_at: string | null
          note: string
          status: string
          student_id: string
          updated_at: string
        }
        Insert: {
          classroom_id: string
          joined_at?: string | null
          note?: string
          status: string
          student_id: string
          updated_at?: string
        }
        Update: {
          classroom_id?: string
          joined_at?: string | null
          note?: string
          status?: string
          student_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "classroom_attendance_classroom_id_fkey"
            columns: ["classroom_id"]
            isOneToOne: false
            referencedRelation: "classrooms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "classroom_attendance_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      classroom_events: {
        Row: {
          actor_id: string | null
          at: string
          classroom_id: string
          id: number
          kind: string
          payload: Json
        }
        Insert: {
          actor_id?: string | null
          at?: string
          classroom_id: string
          id?: never
          kind: string
          payload?: Json
        }
        Update: {
          actor_id?: string | null
          at?: string
          classroom_id?: string
          id?: never
          kind?: string
          payload?: Json
        }
        Relationships: [
          {
            foreignKeyName: "classroom_events_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "classroom_events_classroom_id_fkey"
            columns: ["classroom_id"]
            isOneToOne: false
            referencedRelation: "classrooms"
            referencedColumns: ["id"]
          },
        ]
      }
      classroom_targets: {
        Row: {
          classroom_id: string
          group_id: string | null
          id: string
          student_id: string | null
        }
        Insert: {
          classroom_id: string
          group_id?: string | null
          id?: string
          student_id?: string | null
        }
        Update: {
          classroom_id?: string
          group_id?: string | null
          id?: string
          student_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "classroom_targets_classroom_id_fkey"
            columns: ["classroom_id"]
            isOneToOne: false
            referencedRelation: "classrooms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "classroom_targets_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "classroom_targets_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      classrooms: {
        Row: {
          academy_id: string
          coach_id: string | null
          created_at: string
          created_by: string | null
          ended_at: string | null
          group_id: string | null
          id: string
          is_public: boolean
          kind: string
          minutes: number
          series_id: string | null
          starts_at: string
          state: Json
          title: string
          video_mode: string
        }
        Insert: {
          academy_id: string
          coach_id?: string | null
          created_at?: string
          created_by?: string | null
          ended_at?: string | null
          group_id?: string | null
          id?: string
          is_public?: boolean
          kind?: string
          minutes?: number
          series_id?: string | null
          starts_at: string
          state?: Json
          title?: string
          video_mode?: string
        }
        Update: {
          academy_id?: string
          coach_id?: string | null
          created_at?: string
          created_by?: string | null
          ended_at?: string | null
          group_id?: string | null
          id?: string
          is_public?: boolean
          kind?: string
          minutes?: number
          series_id?: string | null
          starts_at?: string
          state?: Json
          title?: string
          video_mode?: string
        }
        Relationships: [
          {
            foreignKeyName: "classrooms_academy_id_fkey"
            columns: ["academy_id"]
            isOneToOne: false
            referencedRelation: "academies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "classrooms_coach_id_fkey"
            columns: ["coach_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "classrooms_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "classrooms_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
        ]
      }
      coach_availability: {
        Row: {
          academy_id: string
          coach_id: string
          day: number
          id: string
          minutes: number
          start: string
        }
        Insert: {
          academy_id: string
          coach_id: string
          day: number
          id?: string
          minutes: number
          start: string
        }
        Update: {
          academy_id?: string
          coach_id?: string
          day?: number
          id?: string
          minutes?: number
          start?: string
        }
        Relationships: [
          {
            foreignKeyName: "coach_availability_academy_id_fkey"
            columns: ["academy_id"]
            isOneToOne: false
            referencedRelation: "academies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "coach_availability_coach_id_fkey"
            columns: ["coach_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      database_games: {
        Row: {
          black: string
          black_elo: number | null
          created_at: string
          database_id: string
          date: string
          eco: string
          event: string
          id: string
          pgn: string
          ply_count: number
          result: string
          site: string
          start_fen: string | null
          white: string
          white_elo: number | null
        }
        Insert: {
          black?: string
          black_elo?: number | null
          created_at?: string
          database_id: string
          date?: string
          eco?: string
          event?: string
          id?: string
          pgn: string
          ply_count?: number
          result?: string
          site?: string
          start_fen?: string | null
          white?: string
          white_elo?: number | null
        }
        Update: {
          black?: string
          black_elo?: number | null
          created_at?: string
          database_id?: string
          date?: string
          eco?: string
          event?: string
          id?: string
          pgn?: string
          ply_count?: number
          result?: string
          site?: string
          start_fen?: string | null
          white?: string
          white_elo?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "database_games_database_id_fkey"
            columns: ["database_id"]
            isOneToOne: false
            referencedRelation: "game_databases"
            referencedColumns: ["id"]
          },
        ]
      }
      exercise_items: {
        Row: {
          exercise_id: string
          position: number
          puzzle_id: string
        }
        Insert: {
          exercise_id: string
          position: number
          puzzle_id: string
        }
        Update: {
          exercise_id?: string
          position?: number
          puzzle_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "exercise_items_exercise_id_fkey"
            columns: ["exercise_id"]
            isOneToOne: false
            referencedRelation: "exercises"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "exercise_items_puzzle_id_fkey"
            columns: ["puzzle_id"]
            isOneToOne: false
            referencedRelation: "puzzles"
            referencedColumns: ["id"]
          },
        ]
      }
      exercises: {
        Row: {
          academy_id: string
          created_at: string
          created_by: string | null
          description: string
          id: string
          level_id: string | null
          tags: string[]
          title: string
        }
        Insert: {
          academy_id: string
          created_at?: string
          created_by?: string | null
          description?: string
          id?: string
          level_id?: string | null
          tags?: string[]
          title: string
        }
        Update: {
          academy_id?: string
          created_at?: string
          created_by?: string | null
          description?: string
          id?: string
          level_id?: string | null
          tags?: string[]
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "exercises_academy_id_fkey"
            columns: ["academy_id"]
            isOneToOne: false
            referencedRelation: "academies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "exercises_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "exercises_level_id_fkey"
            columns: ["level_id"]
            isOneToOne: false
            referencedRelation: "levels"
            referencedColumns: ["id"]
          },
        ]
      }
      game_databases: {
        Row: {
          academy_id: string
          created_at: string
          created_by: string | null
          id: string
          name: string
          visibility: string
        }
        Insert: {
          academy_id: string
          created_at?: string
          created_by?: string | null
          id?: string
          name: string
          visibility?: string
        }
        Update: {
          academy_id?: string
          created_at?: string
          created_by?: string | null
          id?: string
          name?: string
          visibility?: string
        }
        Relationships: [
          {
            foreignKeyName: "game_databases_academy_id_fkey"
            columns: ["academy_id"]
            isOneToOne: false
            referencedRelation: "academies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "game_databases_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      games: {
        Row: {
          academy_id: string
          base_ms: number | null
          black_id: string | null
          black_ms: number | null
          bot_elo: number | null
          category: string | null
          created_at: string
          created_by: string | null
          draw_offer_by: string | null
          fen: string
          finished_at: string | null
          id: string
          inc_ms: number
          initial_fen: string
          moves: string[]
          pgn: string | null
          rated: boolean
          rating_change: Json | null
          reason: string | null
          result: string | null
          simul_id: string | null
          started_at: string | null
          status: string
          turn_started_at: string | null
          version: number
          white_id: string | null
          white_ms: number | null
        }
        Insert: {
          academy_id: string
          base_ms?: number | null
          black_id?: string | null
          black_ms?: number | null
          bot_elo?: number | null
          category?: string | null
          created_at?: string
          created_by?: string | null
          draw_offer_by?: string | null
          fen: string
          finished_at?: string | null
          id?: string
          inc_ms?: number
          initial_fen?: string
          moves?: string[]
          pgn?: string | null
          rated?: boolean
          rating_change?: Json | null
          reason?: string | null
          result?: string | null
          simul_id?: string | null
          started_at?: string | null
          status?: string
          turn_started_at?: string | null
          version?: number
          white_id?: string | null
          white_ms?: number | null
        }
        Update: {
          academy_id?: string
          base_ms?: number | null
          black_id?: string | null
          black_ms?: number | null
          bot_elo?: number | null
          category?: string | null
          created_at?: string
          created_by?: string | null
          draw_offer_by?: string | null
          fen?: string
          finished_at?: string | null
          id?: string
          inc_ms?: number
          initial_fen?: string
          moves?: string[]
          pgn?: string | null
          rated?: boolean
          rating_change?: Json | null
          reason?: string | null
          result?: string | null
          simul_id?: string | null
          started_at?: string | null
          status?: string
          turn_started_at?: string | null
          version?: number
          white_id?: string | null
          white_ms?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "games_academy_id_fkey"
            columns: ["academy_id"]
            isOneToOne: false
            referencedRelation: "academies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "games_black_id_fkey"
            columns: ["black_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "games_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "games_draw_offer_by_fkey"
            columns: ["draw_offer_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "games_white_id_fkey"
            columns: ["white_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      group_members: {
        Row: {
          created_at: string
          group_id: string
          student_id: string
        }
        Insert: {
          created_at?: string
          group_id: string
          student_id: string
        }
        Update: {
          created_at?: string
          group_id?: string
          student_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "group_members_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "group_members_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      groups: {
        Row: {
          academy_id: string
          coach_id: string | null
          created_at: string
          id: string
          kind: string
          level_id: string | null
          name: string
          schedule: Json
        }
        Insert: {
          academy_id: string
          coach_id?: string | null
          created_at?: string
          id?: string
          kind?: string
          level_id?: string | null
          name: string
          schedule?: Json
        }
        Update: {
          academy_id?: string
          coach_id?: string | null
          created_at?: string
          id?: string
          kind?: string
          level_id?: string | null
          name?: string
          schedule?: Json
        }
        Relationships: [
          {
            foreignKeyName: "groups_academy_id_fkey"
            columns: ["academy_id"]
            isOneToOne: false
            referencedRelation: "academies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "groups_coach_id_fkey"
            columns: ["coach_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "groups_level_id_fkey"
            columns: ["level_id"]
            isOneToOne: false
            referencedRelation: "levels"
            referencedColumns: ["id"]
          },
        ]
      }
      invitations: {
        Row: {
          academy_id: string
          accepted_at: string | null
          accepted_by: string | null
          created_at: string
          created_by: string | null
          email: string | null
          expires_at: string
          id: string
          role: Database["public"]["Enums"]["academy_role"]
          student_id: string | null
          token: string
        }
        Insert: {
          academy_id: string
          accepted_at?: string | null
          accepted_by?: string | null
          created_at?: string
          created_by?: string | null
          email?: string | null
          expires_at?: string
          id?: string
          role: Database["public"]["Enums"]["academy_role"]
          student_id?: string | null
          token?: string
        }
        Update: {
          academy_id?: string
          accepted_at?: string | null
          accepted_by?: string | null
          created_at?: string
          created_by?: string | null
          email?: string | null
          expires_at?: string
          id?: string
          role?: Database["public"]["Enums"]["academy_role"]
          student_id?: string | null
          token?: string
        }
        Relationships: [
          {
            foreignKeyName: "invitations_academy_id_fkey"
            columns: ["academy_id"]
            isOneToOne: false
            referencedRelation: "academies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invitations_accepted_by_fkey"
            columns: ["accepted_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invitations_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invitations_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      levels: {
        Row: {
          academy_id: string
          color: string
          created_at: string
          criteria: Json
          id: string
          max_rating: number | null
          min_rating: number
          name: string
          position: number
        }
        Insert: {
          academy_id: string
          color?: string
          created_at?: string
          criteria?: Json
          id?: string
          max_rating?: number | null
          min_rating?: number
          name: string
          position: number
        }
        Update: {
          academy_id?: string
          color?: string
          created_at?: string
          criteria?: Json
          id?: string
          max_rating?: number | null
          min_rating?: number
          name?: string
          position?: number
        }
        Relationships: [
          {
            foreignKeyName: "levels_academy_id_fkey"
            columns: ["academy_id"]
            isOneToOne: false
            referencedRelation: "academies"
            referencedColumns: ["id"]
          },
        ]
      }
      memberships: {
        Row: {
          academy_id: string
          created_at: string
          level_id: string | null
          role: Database["public"]["Enums"]["academy_role"]
          user_id: string
        }
        Insert: {
          academy_id: string
          created_at?: string
          level_id?: string | null
          role: Database["public"]["Enums"]["academy_role"]
          user_id: string
        }
        Update: {
          academy_id?: string
          created_at?: string
          level_id?: string | null
          role?: Database["public"]["Enums"]["academy_role"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "memberships_academy_id_fkey"
            columns: ["academy_id"]
            isOneToOne: false
            referencedRelation: "academies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "memberships_level_id_fkey"
            columns: ["level_id"]
            isOneToOne: false
            referencedRelation: "levels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "memberships_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      parent_links: {
        Row: {
          academy_id: string
          created_at: string
          parent_id: string
          student_id: string
        }
        Insert: {
          academy_id: string
          created_at?: string
          parent_id: string
          student_id: string
        }
        Update: {
          academy_id?: string
          created_at?: string
          parent_id?: string
          student_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "parent_links_academy_id_fkey"
            columns: ["academy_id"]
            isOneToOne: false
            referencedRelation: "academies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "parent_links_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "parent_links_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      practice_chapters: {
        Row: {
          academy_id: string
          created_at: string
          created_by: string | null
          description: string
          id: string
          title: string
          visibility: string
        }
        Insert: {
          academy_id: string
          created_at?: string
          created_by?: string | null
          description?: string
          id?: string
          title: string
          visibility?: string
        }
        Update: {
          academy_id?: string
          created_at?: string
          created_by?: string | null
          description?: string
          id?: string
          title?: string
          visibility?: string
        }
        Relationships: [
          {
            foreignKeyName: "practice_chapters_academy_id_fkey"
            columns: ["academy_id"]
            isOneToOne: false
            referencedRelation: "academies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "practice_chapters_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      practice_positions: {
        Row: {
          chapter_id: string
          elo: number | null
          fen: string
          goal: string
          id: string
          position: number
          side: string
          title: string
        }
        Insert: {
          chapter_id: string
          elo?: number | null
          fen: string
          goal?: string
          id?: string
          position: number
          side: string
          title?: string
        }
        Update: {
          chapter_id?: string
          elo?: number | null
          fen?: string
          goal?: string
          id?: string
          position?: number
          side?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "practice_positions_chapter_id_fkey"
            columns: ["chapter_id"]
            isOneToOne: false
            referencedRelation: "practice_chapters"
            referencedColumns: ["id"]
          },
        ]
      }
      practice_results: {
        Row: {
          created_at: string
          id: string
          moves: number
          position_id: string
          result: string
          student_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          moves?: number
          position_id: string
          result: string
          student_id: string
        }
        Update: {
          created_at?: string
          id?: string
          moves?: number
          position_id?: string
          result?: string
          student_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "practice_results_position_id_fkey"
            columns: ["position_id"]
            isOneToOne: false
            referencedRelation: "practice_positions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "practice_results_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          display_name: string
          id: string
          locale: string
          updated_at: string
          username: string | null
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string
          id: string
          locale?: string
          updated_at?: string
          username?: string | null
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string
          id?: string
          locale?: string
          updated_at?: string
          username?: string | null
        }
        Relationships: []
      }
      puzzles: {
        Row: {
          academy_id: string | null
          created_at: string
          created_by: string | null
          fen: string
          id: string
          moves: string[]
          rating: number
          themes: string[]
          title: string
        }
        Insert: {
          academy_id?: string | null
          created_at?: string
          created_by?: string | null
          fen: string
          id?: string
          moves: string[]
          rating?: number
          themes?: string[]
          title: string
        }
        Update: {
          academy_id?: string | null
          created_at?: string
          created_by?: string | null
          fen?: string
          id?: string
          moves?: string[]
          rating?: number
          themes?: string[]
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "puzzles_academy_id_fkey"
            columns: ["academy_id"]
            isOneToOne: false
            referencedRelation: "academies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "puzzles_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      quiz_attempts: {
        Row: {
          answers: Json
          finished_at: string | null
          id: string
          item_id: string
          score: number
          solved: boolean
          state: Json
          student_id: string
          time_ms: number
          tries: number
          updated_at: string
        }
        Insert: {
          answers?: Json
          finished_at?: string | null
          id?: string
          item_id: string
          score?: number
          solved?: boolean
          state?: Json
          student_id: string
          time_ms?: number
          tries?: number
          updated_at?: string
        }
        Update: {
          answers?: Json
          finished_at?: string | null
          id?: string
          item_id?: string
          score?: number
          solved?: boolean
          state?: Json
          student_id?: string
          time_ms?: number
          tries?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "quiz_attempts_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "quiz_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quiz_attempts_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      quiz_items: {
        Row: {
          id: string
          kind: string
          max_attempts: number | null
          payload: Json
          points: number
          position: number
          quiz_id: string
          source_activity_id: string | null
          title: string
          wrong_penalty: number
        }
        Insert: {
          id?: string
          kind: string
          max_attempts?: number | null
          payload: Json
          points?: number
          position: number
          quiz_id: string
          source_activity_id?: string | null
          title?: string
          wrong_penalty?: number
        }
        Update: {
          id?: string
          kind?: string
          max_attempts?: number | null
          payload?: Json
          points?: number
          position?: number
          quiz_id?: string
          source_activity_id?: string | null
          title?: string
          wrong_penalty?: number
        }
        Relationships: [
          {
            foreignKeyName: "quiz_items_quiz_id_fkey"
            columns: ["quiz_id"]
            isOneToOne: false
            referencedRelation: "quizzes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quiz_items_source_activity_id_fkey"
            columns: ["source_activity_id"]
            isOneToOne: false
            referencedRelation: "study_activities"
            referencedColumns: ["id"]
          },
        ]
      }
      quiz_targets: {
        Row: {
          group_id: string | null
          id: string
          quiz_id: string
          student_id: string | null
        }
        Insert: {
          group_id?: string | null
          id?: string
          quiz_id: string
          student_id?: string | null
        }
        Update: {
          group_id?: string | null
          id?: string
          quiz_id?: string
          student_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "quiz_targets_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quiz_targets_quiz_id_fkey"
            columns: ["quiz_id"]
            isOneToOne: false
            referencedRelation: "quizzes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quiz_targets_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      quizzes: {
        Row: {
          academy_id: string
          auto: boolean
          created_at: string
          created_by: string | null
          due_at: string | null
          id: string
          level_id: string | null
          open_to_all: boolean
          starts_at: string | null
          title: string
          topics: string[]
        }
        Insert: {
          academy_id: string
          auto?: boolean
          created_at?: string
          created_by?: string | null
          due_at?: string | null
          id?: string
          level_id?: string | null
          open_to_all?: boolean
          starts_at?: string | null
          title: string
          topics?: string[]
        }
        Update: {
          academy_id?: string
          auto?: boolean
          created_at?: string
          created_by?: string | null
          due_at?: string | null
          id?: string
          level_id?: string | null
          open_to_all?: boolean
          starts_at?: string | null
          title?: string
          topics?: string[]
        }
        Relationships: [
          {
            foreignKeyName: "quizzes_academy_id_fkey"
            columns: ["academy_id"]
            isOneToOne: false
            referencedRelation: "academies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quizzes_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quizzes_level_id_fkey"
            columns: ["level_id"]
            isOneToOne: false
            referencedRelation: "levels"
            referencedColumns: ["id"]
          },
        ]
      }
      ratings: {
        Row: {
          academy_id: string
          category: string
          games: number
          rating: number
          rd: number
          student_id: string
          updated_at: string
          vol: number
        }
        Insert: {
          academy_id: string
          category: string
          games?: number
          rating?: number
          rd?: number
          student_id: string
          updated_at?: string
          vol?: number
        }
        Update: {
          academy_id?: string
          category?: string
          games?: number
          rating?: number
          rd?: number
          student_id?: string
          updated_at?: string
          vol?: number
        }
        Relationships: [
          {
            foreignKeyName: "ratings_academy_id_fkey"
            columns: ["academy_id"]
            isOneToOne: false
            referencedRelation: "academies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ratings_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      studies: {
        Row: {
          academy_id: string | null
          created_at: string
          created_by: string | null
          description: string
          id: string
          level_id: string | null
          title: string
          updated_at: string
          visibility: string
        }
        Insert: {
          academy_id?: string | null
          created_at?: string
          created_by?: string | null
          description?: string
          id?: string
          level_id?: string | null
          title: string
          updated_at?: string
          visibility?: string
        }
        Update: {
          academy_id?: string | null
          created_at?: string
          created_by?: string | null
          description?: string
          id?: string
          level_id?: string | null
          title?: string
          updated_at?: string
          visibility?: string
        }
        Relationships: [
          {
            foreignKeyName: "studies_academy_id_fkey"
            columns: ["academy_id"]
            isOneToOne: false
            referencedRelation: "academies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "studies_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "studies_level_id_fkey"
            columns: ["level_id"]
            isOneToOne: false
            referencedRelation: "levels"
            referencedColumns: ["id"]
          },
        ]
      }
      study_activities: {
        Row: {
          created_at: string
          hint_penalty: number
          id: string
          kind: string
          max_attempts: number | null
          payload: Json
          points: number
          position: number
          study_id: string
          time_limit_s: number | null
          title: string
          topics: string[]
          wrong_penalty: number
        }
        Insert: {
          created_at?: string
          hint_penalty?: number
          id?: string
          kind: string
          max_attempts?: number | null
          payload: Json
          points?: number
          position: number
          study_id: string
          time_limit_s?: number | null
          title?: string
          topics?: string[]
          wrong_penalty?: number
        }
        Update: {
          created_at?: string
          hint_penalty?: number
          id?: string
          kind?: string
          max_attempts?: number | null
          payload?: Json
          points?: number
          position?: number
          study_id?: string
          time_limit_s?: number | null
          title?: string
          topics?: string[]
          wrong_penalty?: number
        }
        Relationships: [
          {
            foreignKeyName: "study_activities_study_id_fkey"
            columns: ["study_id"]
            isOneToOne: false
            referencedRelation: "studies"
            referencedColumns: ["id"]
          },
        ]
      }
      study_collection_items: {
        Row: {
          collection_id: string
          position: number
          study_id: string
        }
        Insert: {
          collection_id: string
          position?: number
          study_id: string
        }
        Update: {
          collection_id?: string
          position?: number
          study_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "study_collection_items_collection_id_fkey"
            columns: ["collection_id"]
            isOneToOne: false
            referencedRelation: "study_collections"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "study_collection_items_study_id_fkey"
            columns: ["study_id"]
            isOneToOne: false
            referencedRelation: "studies"
            referencedColumns: ["id"]
          },
        ]
      }
      study_collections: {
        Row: {
          academy_id: string
          created_at: string
          created_by: string | null
          id: string
          name: string
        }
        Insert: {
          academy_id: string
          created_at?: string
          created_by?: string | null
          id?: string
          name: string
        }
        Update: {
          academy_id?: string
          created_at?: string
          created_by?: string | null
          id?: string
          name?: string
        }
        Relationships: [
          {
            foreignKeyName: "study_collections_academy_id_fkey"
            columns: ["academy_id"]
            isOneToOne: false
            referencedRelation: "academies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "study_collections_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      assignment_progress: {
        Row: {
          academy_id: string | null
          assignment_id: string | null
          last_activity: string | null
          solved_items: number | null
          student_id: string | null
          time_ms: number | null
          total_items: number | null
          tries: number | null
        }
        Relationships: [
          {
            foreignKeyName: "assignments_academy_id_fkey"
            columns: ["academy_id"]
            isOneToOne: false
            referencedRelation: "academies"
            referencedColumns: ["id"]
          },
        ]
      }
      quiz_progress: {
        Row: {
          last_activity: string | null
          quiz_id: string | null
          score: number | null
          solved_items: number | null
          student_id: string | null
          time_ms: number | null
          total_items: number | null
          tries: number | null
        }
        Relationships: [
          {
            foreignKeyName: "quiz_attempts_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quiz_items_quiz_id_fkey"
            columns: ["quiz_id"]
            isOneToOne: false
            referencedRelation: "quizzes"
            referencedColumns: ["id"]
          },
        ]
      }
      study_progress: {
        Row: {
          completed: number | null
          last_activity: string | null
          score: number | null
          student_id: string | null
          study_id: string | null
          time_ms: number | null
          total_activities: number | null
        }
        Relationships: [
          {
            foreignKeyName: "activity_attempts_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "study_activities_study_id_fkey"
            columns: ["study_id"]
            isOneToOne: false
            referencedRelation: "studies"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      academy_leaderboard: {
        Args: { p_academy: string; p_from: string; p_to: string }
        Returns: {
          avatar_url: string
          display_name: string
          points: number
          solved: number
          student_id: string
          tries: number
        }[]
      }
      academy_stats: {
        Args: { p_academy: string }
        Returns: {
          assignments: number
          attempts_week: number
          batches: number
          groups: number
          staff: number
          students: number
        }[]
      }
      accept_invitation: { Args: { p_token: string }; Returns: string }
      activity_for_student: {
        Args: { p_activity: string; p_student: string }
        Returns: {
          hint_penalty: number
          kind: string
          max_attempts: number
          payload: Json
          points: number
          wrong_penalty: number
        }[]
      }
      classroom_join: { Args: { p_classroom: string }; Returns: string }
      create_academy: {
        Args: { p_name: string; p_slug: string }
        Returns: {
          created_at: string
          created_by: string | null
          description: string
          id: string
          logo_url: string | null
          name: string
          slug: string
          socials: Json
        }
        SetofOptions: {
          from: "*"
          to: "academies"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      create_invitation: {
        Args: {
          p_academy: string
          p_email?: string
          p_role: Database["public"]["Enums"]["academy_role"]
          p_student?: string
        }
        Returns: {
          academy_id: string
          accepted_at: string | null
          accepted_by: string | null
          created_at: string
          created_by: string | null
          email: string | null
          expires_at: string
          id: string
          role: Database["public"]["Enums"]["academy_role"]
          student_id: string | null
          token: string
        }
        SetofOptions: {
          from: "*"
          to: "invitations"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      puzzle_for_student_item: {
        Args: { p_item: string; p_student: string }
        Returns: {
          fen: string
          moves: string[]
          puzzle_id: string
        }[]
      }
      quiz_item_for_student: {
        Args: { p_item: string; p_student: string }
        Returns: {
          due_at: string
          kind: string
          max_attempts: number
          payload: Json
          points: number
          starts_at: string
          wrong_penalty: number
        }[]
      }
      quiz_items_for_student: {
        Args: { p_quiz: string }
        Returns: {
          id: string
          item_position: number
          kind: string
          max_attempts: number
          payload: Json
          points: number
          title: string
        }[]
      }
      quiz_leaderboard: {
        Args: { p_quiz: string }
        Returns: {
          display_name: string
          score: number
          solved: number
          student_id: string
          time_ms: number
        }[]
      }
      set_student_level: {
        Args: { p_academy: string; p_level: string; p_student: string }
        Returns: undefined
      }
    }
    Enums: {
      academy_role: "owner" | "coach" | "student" | "parent"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      academy_role: ["owner", "coach", "student", "parent"],
    },
  },
} as const
