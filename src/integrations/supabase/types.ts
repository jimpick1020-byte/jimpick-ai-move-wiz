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
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      estimate_staff_shares: {
        Row: {
          company_id: string
          created_at: string
          created_by: string
          estimate_id: string
          expires_at: string
          id: string
          last_opened_at: string | null
          open_count: number
          opened_at: string | null
          revoked_at: string | null
          secure_token_hash: string
          share_method: string
          shared_at: string | null
          staff_name: string | null
          staff_snapshot: string | null
          updated_at: string
        }
        Insert: {
          company_id: string
          created_at?: string
          created_by: string
          estimate_id: string
          expires_at: string
          id?: string
          last_opened_at?: string | null
          open_count?: number
          opened_at?: string | null
          revoked_at?: string | null
          secure_token_hash: string
          share_method?: string
          shared_at?: string | null
          staff_name?: string | null
          staff_snapshot?: string | null
          updated_at?: string
        }
        Update: {
          company_id?: string
          created_at?: string
          created_by?: string
          estimate_id?: string
          expires_at?: string
          id?: string
          last_opened_at?: string | null
          open_count?: number
          opened_at?: string | null
          revoked_at?: string | null
          secure_token_hash?: string
          share_method?: string
          shared_at?: string | null
          staff_name?: string | null
          staff_snapshot?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      estimate_terms: {
        Row: {
          access_token: string
          contact_phone: string | null
          created_at: string
          customer_name: string
          estimate_id: string
          id: string
          move_date: string | null
          sent_at: string | null
          sent_msg_id: string | null
          sheet_no: string | null
          sheet_snapshot: string | null
          sheet_version: number
          terms_document_id: string | null
          terms_effective_at: string | null
          terms_name: string
          terms_version: string
          total: number
          updated_at: string
          user_id: string
          viewed_at: string | null
        }
        Insert: {
          access_token: string
          contact_phone?: string | null
          created_at?: string
          customer_name?: string
          estimate_id: string
          id?: string
          move_date?: string | null
          sent_at?: string | null
          sent_msg_id?: string | null
          sheet_no?: string | null
          sheet_snapshot?: string | null
          sheet_version?: number
          terms_document_id?: string | null
          terms_effective_at?: string | null
          terms_name: string
          terms_version: string
          total?: number
          updated_at?: string
          user_id: string
          viewed_at?: string | null
        }
        Update: {
          access_token?: string
          contact_phone?: string | null
          created_at?: string
          customer_name?: string
          estimate_id?: string
          id?: string
          move_date?: string | null
          sent_at?: string | null
          sent_msg_id?: string | null
          sheet_no?: string | null
          sheet_snapshot?: string | null
          sheet_version?: number
          terms_document_id?: string | null
          terms_effective_at?: string | null
          terms_name?: string
          terms_version?: string
          total?: number
          updated_at?: string
          user_id?: string
          viewed_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "estimate_terms_terms_document_id_fkey"
            columns: ["terms_document_id"]
            isOneToOne: false
            referencedRelation: "terms_documents"
            referencedColumns: ["id"]
          },
        ]
      }
      payments: {
        Row: {
          amount: number
          created_at: string
          currency: string
          id: string
          method: string
          paid_at: string
          plan: Database["public"]["Enums"]["plan_tier"]
          receipt_no: string | null
          status: string
          user_id: string
        }
        Insert: {
          amount: number
          created_at?: string
          currency?: string
          id?: string
          method?: string
          paid_at?: string
          plan: Database["public"]["Enums"]["plan_tier"]
          receipt_no?: string | null
          status?: string
          user_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          currency?: string
          id?: string
          method?: string
          paid_at?: string
          plan?: Database["public"]["Enums"]["plan_tier"]
          receipt_no?: string | null
          status?: string
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          company_name: string | null
          created_at: string
          id: string
          owner_name: string | null
          phone: string | null
          updated_at: string
        }
        Insert: {
          company_name?: string | null
          created_at?: string
          id: string
          owner_name?: string | null
          phone?: string | null
          updated_at?: string
        }
        Update: {
          company_name?: string | null
          created_at?: string
          id?: string
          owner_name?: string | null
          phone?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      subscriptions: {
        Row: {
          cancel_at_period_end: boolean
          created_at: string
          current_period_end: string
          current_period_start: string
          id: string
          interval: string
          plan: Database["public"]["Enums"]["plan_tier"]
          price: number
          status: Database["public"]["Enums"]["sub_status"]
          updated_at: string
          user_id: string
        }
        Insert: {
          cancel_at_period_end?: boolean
          created_at?: string
          current_period_end?: string
          current_period_start?: string
          id?: string
          interval?: string
          plan?: Database["public"]["Enums"]["plan_tier"]
          price?: number
          status?: Database["public"]["Enums"]["sub_status"]
          updated_at?: string
          user_id: string
        }
        Update: {
          cancel_at_period_end?: boolean
          created_at?: string
          current_period_end?: string
          current_period_start?: string
          id?: string
          interval?: string
          plan?: Database["public"]["Enums"]["plan_tier"]
          price?: number
          status?: Database["public"]["Enums"]["sub_status"]
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      terms_acceptances: {
        Row: {
          accept_method: string
          accepted: boolean
          accepted_at: string
          created_at: string
          estimate_id: string
          estimate_snapshot: string | null
          estimate_terms_id: string
          id: string
          reservation_status: string
          sent_at: string | null
          sent_msg_id: string | null
          sheet_version: number
          terms_effective_at: string | null
          terms_name: string
          terms_snapshot: string
          terms_version: string
          token_hint: string | null
          user_agent: string | null
          user_id: string
        }
        Insert: {
          accept_method?: string
          accepted?: boolean
          accepted_at?: string
          created_at?: string
          estimate_id: string
          estimate_snapshot?: string | null
          estimate_terms_id: string
          id?: string
          reservation_status?: string
          sent_at?: string | null
          sent_msg_id?: string | null
          sheet_version?: number
          terms_effective_at?: string | null
          terms_name: string
          terms_snapshot: string
          terms_version: string
          token_hint?: string | null
          user_agent?: string | null
          user_id: string
        }
        Update: {
          accept_method?: string
          accepted?: boolean
          accepted_at?: string
          created_at?: string
          estimate_id?: string
          estimate_snapshot?: string | null
          estimate_terms_id?: string
          id?: string
          reservation_status?: string
          sent_at?: string | null
          sent_msg_id?: string | null
          sheet_version?: number
          terms_effective_at?: string | null
          terms_name?: string
          terms_snapshot?: string
          terms_version?: string
          token_hint?: string | null
          user_agent?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "terms_acceptances_estimate_terms_id_fkey"
            columns: ["estimate_terms_id"]
            isOneToOne: true
            referencedRelation: "estimate_terms"
            referencedColumns: ["id"]
          },
        ]
      }
      terms_documents: {
        Row: {
          body: string
          created_at: string
          effective_at: string
          id: string
          name: string
          source: string
          summary: Json
          updated_at: string
          version: string
        }
        Insert: {
          body: string
          created_at?: string
          effective_at: string
          id?: string
          name: string
          source: string
          summary?: Json
          updated_at?: string
          version: string
        }
        Update: {
          body?: string
          created_at?: string
          effective_at?: string
          id?: string
          name?: string
          source?: string
          summary?: Json
          updated_at?: string
          version?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "user"
      plan_tier: "free" | "basic" | "pro"
      sub_status: "trialing" | "active" | "past_due" | "canceled"
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
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
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
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
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
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
      app_role: ["admin", "user"],
      plan_tier: ["free", "basic", "pro"],
      sub_status: ["trialing", "active", "past_due", "canceled"],
    },
  },
} as const
