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
          id: string
          name: string
          slug: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          name: string
          slug: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          name?: string
          slug?: string
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
          id: string
          instructions: string | null
          title: string
        }
        Insert: {
          academy_id: string
          created_at?: string
          created_by?: string | null
          due_at?: string | null
          id?: string
          instructions?: string | null
          title: string
        }
        Update: {
          academy_id?: string
          created_at?: string
          created_by?: string | null
          due_at?: string | null
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
          name: string
        }
        Insert: {
          academy_id: string
          coach_id?: string | null
          created_at?: string
          id?: string
          name: string
        }
        Update: {
          academy_id?: string
          coach_id?: string | null
          created_at?: string
          id?: string
          name?: string
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
      memberships: {
        Row: {
          academy_id: string
          created_at: string
          role: Database["public"]["Enums"]["academy_role"]
          user_id: string
        }
        Insert: {
          academy_id: string
          created_at?: string
          role: Database["public"]["Enums"]["academy_role"]
          user_id: string
        }
        Update: {
          academy_id?: string
          created_at?: string
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
    }
    Functions: {
      accept_invitation: { Args: { p_token: string }; Returns: string }
      create_academy: {
        Args: { p_name: string; p_slug: string }
        Returns: {
          created_at: string
          created_by: string | null
          id: string
          name: string
          slug: string
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
