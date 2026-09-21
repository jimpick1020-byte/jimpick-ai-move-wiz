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
      app_cron_secrets: {
        Row: {
          created_at: string
          name: string
          secret: string
        }
        Insert: {
          created_at?: string
          name: string
          secret?: string
        }
        Update: {
          created_at?: string
          name?: string
          secret?: string
        }
        Relationships: []
      }
      billing_keys: {
        Row: {
          billing_key: string
          card_company: string | null
          card_number_masked: string | null
          card_type: string | null
          created_at: string
          customer_key: string
          updated_at: string
          user_id: string
        }
        Insert: {
          billing_key: string
          card_company?: string | null
          card_number_masked?: string | null
          card_type?: string | null
          created_at?: string
          customer_key: string
          updated_at?: string
          user_id: string
        }
        Update: {
          billing_key?: string
          card_company?: string | null
          card_number_masked?: string | null
          card_type?: string | null
          created_at?: string
          customer_key?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      company_size_presets: {
        Row: {
          created_at: string
          payload: Json
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          payload?: Json
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          payload?: Json
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      deposit_records: {
        Row: {
          amount: number
          confirmed_at: string | null
          confirmed_by: string | null
          created_at: string
          customer_name: string
          dedupe_key: string
          deposited_at: string | null
          depositor_name: string
          estimate_id: string
          estimate_version: number
          id: string
          name_matched: boolean
          notified_at: string | null
          notify_error: string | null
          raw_text: string | null
          review_note: string | null
          sheet_no: string | null
          source: string
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          amount?: number
          confirmed_at?: string | null
          confirmed_by?: string | null
          created_at?: string
          customer_name?: string
          dedupe_key: string
          deposited_at?: string | null
          depositor_name?: string
          estimate_id: string
          estimate_version?: number
          id?: string
          name_matched?: boolean
          notified_at?: string | null
          notify_error?: string | null
          raw_text?: string | null
          review_note?: string | null
          sheet_no?: string | null
          source?: string
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          amount?: number
          confirmed_at?: string | null
          confirmed_by?: string | null
          created_at?: string
          customer_name?: string
          dedupe_key?: string
          deposited_at?: string | null
          depositor_name?: string
          estimate_id?: string
          estimate_version?: number
          id?: string
          name_matched?: boolean
          notified_at?: string | null
          notify_error?: string | null
          raw_text?: string | null
          review_note?: string | null
          sheet_no?: string | null
          source?: string
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      error_logs: {
        Row: {
          attempts: number
          created_at: string
          detail: string | null
          id: string
          kind: string
          message: string
          occurred_at: string
          recovery: string
          resolved: boolean
          resolved_at: string | null
          screen: string
          user_id: string
        }
        Insert: {
          attempts?: number
          created_at?: string
          detail?: string | null
          id?: string
          kind?: string
          message: string
          occurred_at?: string
          recovery?: string
          resolved?: boolean
          resolved_at?: string | null
          screen: string
          user_id: string
        }
        Update: {
          attempts?: number
          created_at?: string
          detail?: string | null
          id?: string
          kind?: string
          message?: string
          occurred_at?: string
          recovery?: string
          resolved?: boolean
          resolved_at?: string | null
          screen?: string
          user_id?: string
        }
        Relationships: []
      }
      estimate_deliveries: {
        Row: {
          company_id: string | null
          created_at: string
          delivery_method: string
          error_code: string | null
          error_message: string | null
          estimate_id: string | null
          estimate_version: number | null
          failed_at: string | null
          id: string
          idempotency_key: string | null
          msg_id: string | null
          msg_type: string | null
          provider: string
          provider_message_id: string | null
          provider_result: Json | null
          requested_at: string
          sent_at: string
          sheet_no: string | null
          status: string
          test_mode: boolean
          to_masked: string
          user_id: string | null
        }
        Insert: {
          company_id?: string | null
          created_at?: string
          delivery_method?: string
          error_code?: string | null
          error_message?: string | null
          estimate_id?: string | null
          estimate_version?: number | null
          failed_at?: string | null
          id?: string
          idempotency_key?: string | null
          msg_id?: string | null
          msg_type?: string | null
          provider?: string
          provider_message_id?: string | null
          provider_result?: Json | null
          requested_at?: string
          sent_at?: string
          sheet_no?: string | null
          status: string
          test_mode?: boolean
          to_masked: string
          user_id?: string | null
        }
        Update: {
          company_id?: string | null
          created_at?: string
          delivery_method?: string
          error_code?: string | null
          error_message?: string | null
          estimate_id?: string | null
          estimate_version?: number | null
          failed_at?: string | null
          id?: string
          idempotency_key?: string | null
          msg_id?: string | null
          msg_type?: string | null
          provider?: string
          provider_message_id?: string | null
          provider_result?: Json | null
          requested_at?: string
          sent_at?: string
          sheet_no?: string | null
          status?: string
          test_mode?: boolean
          to_masked?: string
          user_id?: string | null
        }
        Relationships: []
      }
      estimate_drafts: {
        Row: {
          created_at: string
          deleted_at: string | null
          deleted_by: string | null
          deletion_reason: string | null
          deletion_source: string | null
          estimate_id: string
          id: string
          payload: Json
          revision: number
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          deleted_at?: string | null
          deleted_by?: string | null
          deletion_reason?: string | null
          deletion_source?: string | null
          estimate_id: string
          id?: string
          payload?: Json
          revision?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          deleted_at?: string | null
          deleted_by?: string | null
          deletion_reason?: string | null
          deletion_source?: string | null
          estimate_id?: string
          id?: string
          payload?: Json
          revision?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
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
          balance_paid: number
          balance_paid_at: string | null
          company_phone: string | null
          contact_phone: string | null
          created_at: string
          customer_name: string
          deleted_at: string | null
          deleted_by: string | null
          deletion_reason: string | null
          deletion_source: string | null
          deposit_paid: number
          deposit_paid_at: string | null
          estimate_id: string
          first_viewed_at: string | null
          id: string
          last_viewed_at: string | null
          move_date: string | null
          payment_confirmed_at: string | null
          payment_confirmed_by: string | null
          payment_note: string | null
          payment_status: string
          sent_at: string | null
          sent_msg_id: string | null
          sheet_no: string | null
          sheet_snapshot: string | null
          sheet_version: number
          terms_document_id: string | null
          terms_effective_at: string | null
          terms_name: string
          terms_version: string
          terms_viewed_at: string | null
          total: number
          updated_at: string
          user_id: string
          view_count: number
          viewed_at: string | null
        }
        Insert: {
          access_token: string
          balance_paid?: number
          balance_paid_at?: string | null
          company_phone?: string | null
          contact_phone?: string | null
          created_at?: string
          customer_name?: string
          deleted_at?: string | null
          deleted_by?: string | null
          deletion_reason?: string | null
          deletion_source?: string | null
          deposit_paid?: number
          deposit_paid_at?: string | null
          estimate_id: string
          first_viewed_at?: string | null
          id?: string
          last_viewed_at?: string | null
          move_date?: string | null
          payment_confirmed_at?: string | null
          payment_confirmed_by?: string | null
          payment_note?: string | null
          payment_status?: string
          sent_at?: string | null
          sent_msg_id?: string | null
          sheet_no?: string | null
          sheet_snapshot?: string | null
          sheet_version?: number
          terms_document_id?: string | null
          terms_effective_at?: string | null
          terms_name: string
          terms_version: string
          terms_viewed_at?: string | null
          total?: number
          updated_at?: string
          user_id: string
          view_count?: number
          viewed_at?: string | null
        }
        Update: {
          access_token?: string
          balance_paid?: number
          balance_paid_at?: string | null
          company_phone?: string | null
          contact_phone?: string | null
          created_at?: string
          customer_name?: string
          deleted_at?: string | null
          deleted_by?: string | null
          deletion_reason?: string | null
          deletion_source?: string | null
          deposit_paid?: number
          deposit_paid_at?: string | null
          estimate_id?: string
          first_viewed_at?: string | null
          id?: string
          last_viewed_at?: string | null
          move_date?: string | null
          payment_confirmed_at?: string | null
          payment_confirmed_by?: string | null
          payment_note?: string | null
          payment_status?: string
          sent_at?: string | null
          sent_msg_id?: string | null
          sheet_no?: string | null
          sheet_snapshot?: string | null
          sheet_version?: number
          terms_document_id?: string | null
          terms_effective_at?: string | null
          terms_name?: string
          terms_version?: string
          terms_viewed_at?: string | null
          total?: number
          updated_at?: string
          user_id?: string
          view_count?: number
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
      experimental_feature_settings: {
        Row: {
          ai_photo_scan: boolean
          ai_video_scan: boolean
          created_at: string
          setting_key: string
          updated_at: string
          updated_by: string | null
          voice_item_input: boolean
        }
        Insert: {
          ai_photo_scan?: boolean
          ai_video_scan?: boolean
          created_at?: string
          setting_key?: string
          updated_at?: string
          updated_by?: string | null
          voice_item_input?: boolean
        }
        Update: {
          ai_photo_scan?: boolean
          ai_video_scan?: boolean
          created_at?: string
          setting_key?: string
          updated_at?: string
          updated_by?: string | null
          voice_item_input?: boolean
        }
        Relationships: []
      }
      item_icons: {
        Row: {
          active: boolean
          cat: string
          category_group: string
          created_at: string
          created_by: string
          default_volume: number
          display_name: string
          from_photo: boolean
          generation_id: string | null
          generation_prompt: string | null
          id: string
          image_path: string | null
          image_url: string | null
          is_generated: boolean
          item_id: string
          metadata: Json
          name: string
          norm_name: string
          normalized_name: string
          original_name: string | null
          prompt: string | null
          requested_name: string | null
          room: string | null
          size_label: string
          sort_order: number
          source: string
          status: string
          storage_path: string | null
          subcategory_group: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          active?: boolean
          cat?: string
          category_group: string
          created_at?: string
          created_by: string
          default_volume?: number
          display_name: string
          from_photo?: boolean
          generation_id?: string | null
          generation_prompt?: string | null
          id?: string
          image_path?: string | null
          image_url?: string | null
          is_generated?: boolean
          item_id: string
          metadata?: Json
          name: string
          norm_name: string
          normalized_name: string
          original_name?: string | null
          prompt?: string | null
          requested_name?: string | null
          room?: string | null
          size_label?: string
          sort_order?: number
          source?: string
          status?: string
          storage_path?: string | null
          subcategory_group?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          active?: boolean
          cat?: string
          category_group?: string
          created_at?: string
          created_by?: string
          default_volume?: number
          display_name?: string
          from_photo?: boolean
          generation_id?: string | null
          generation_prompt?: string | null
          id?: string
          image_path?: string | null
          image_url?: string | null
          is_generated?: boolean
          item_id?: string
          metadata?: Json
          name?: string
          norm_name?: string
          normalized_name?: string
          original_name?: string | null
          prompt?: string | null
          requested_name?: string | null
          room?: string | null
          size_label?: string
          sort_order?: number
          source?: string
          status?: string
          storage_path?: string | null
          subcategory_group?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      move_reminders: {
        Row: {
          accepted_at: string | null
          aligo_message_id: string | null
          auto_retried: boolean
          company_id: string
          company_phone: string | null
          created_at: string
          customer_name: string
          customer_phone: string
          customer_viewed_at: string | null
          delivered_at: string | null
          delivery_type: string
          error_code: string | null
          error_reason: string | null
          estimate_id: string
          estimate_terms_id: string | null
          failed_at: string | null
          from_address: string | null
          id: string
          idempotency_key: string
          last_checked_at: string | null
          last_viewed_at: string | null
          message_snapshot: string | null
          message_type: string | null
          missed_reason: string | null
          move_date: string
          processing_at: string | null
          provider: string
          provider_message_id: string | null
          provider_response: Json | null
          requested_at: string | null
          retry_count: number
          scheduled_at: string
          scheduled_date: string
          sent_at: string | null
          start_time: string | null
          status: string
          to_address: string | null
          to_masked: string | null
          updated_at: string
          user_id: string
          view_count: number
          view_token: string | null
        }
        Insert: {
          accepted_at?: string | null
          aligo_message_id?: string | null
          auto_retried?: boolean
          company_id: string
          company_phone?: string | null
          created_at?: string
          customer_name?: string
          customer_phone?: string
          customer_viewed_at?: string | null
          delivered_at?: string | null
          delivery_type?: string
          error_code?: string | null
          error_reason?: string | null
          estimate_id: string
          estimate_terms_id?: string | null
          failed_at?: string | null
          from_address?: string | null
          id?: string
          idempotency_key: string
          last_checked_at?: string | null
          last_viewed_at?: string | null
          message_snapshot?: string | null
          message_type?: string | null
          missed_reason?: string | null
          move_date: string
          processing_at?: string | null
          provider?: string
          provider_message_id?: string | null
          provider_response?: Json | null
          requested_at?: string | null
          retry_count?: number
          scheduled_at: string
          scheduled_date: string
          sent_at?: string | null
          start_time?: string | null
          status?: string
          to_address?: string | null
          to_masked?: string | null
          updated_at?: string
          user_id: string
          view_count?: number
          view_token?: string | null
        }
        Update: {
          accepted_at?: string | null
          aligo_message_id?: string | null
          auto_retried?: boolean
          company_id?: string
          company_phone?: string | null
          created_at?: string
          customer_name?: string
          customer_phone?: string
          customer_viewed_at?: string | null
          delivered_at?: string | null
          delivery_type?: string
          error_code?: string | null
          error_reason?: string | null
          estimate_id?: string
          estimate_terms_id?: string | null
          failed_at?: string | null
          from_address?: string | null
          id?: string
          idempotency_key?: string
          last_checked_at?: string | null
          last_viewed_at?: string | null
          message_snapshot?: string | null
          message_type?: string | null
          missed_reason?: string | null
          move_date?: string
          processing_at?: string | null
          provider?: string
          provider_message_id?: string | null
          provider_response?: Json | null
          requested_at?: string | null
          retry_count?: number
          scheduled_at?: string
          scheduled_date?: string
          sent_at?: string | null
          start_time?: string | null
          status?: string
          to_address?: string | null
          to_masked?: string | null
          updated_at?: string
          user_id?: string
          view_count?: number
          view_token?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "move_reminders_estimate_terms_id_fkey"
            columns: ["estimate_terms_id"]
            isOneToOne: false
            referencedRelation: "estimate_terms"
            referencedColumns: ["id"]
          },
        ]
      }
      payments: {
        Row: {
          amount: number
          created_at: string
          currency: string
          fail_reason: string | null
          id: string
          method: string
          next_billing_at: string | null
          order_id: string | null
          paid_at: string
          payment_key: string | null
          plan: Database["public"]["Enums"]["plan_tier"]
          provider: string | null
          receipt_no: string | null
          status: string
          test_mode: boolean
          user_id: string
        }
        Insert: {
          amount: number
          created_at?: string
          currency?: string
          fail_reason?: string | null
          id?: string
          method?: string
          next_billing_at?: string | null
          order_id?: string | null
          paid_at?: string
          payment_key?: string | null
          plan: Database["public"]["Enums"]["plan_tier"]
          provider?: string | null
          receipt_no?: string | null
          status?: string
          test_mode?: boolean
          user_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          currency?: string
          fail_reason?: string | null
          id?: string
          method?: string
          next_billing_at?: string | null
          order_id?: string | null
          paid_at?: string
          payment_key?: string | null
          plan?: Database["public"]["Enums"]["plan_tier"]
          provider?: string | null
          receipt_no?: string | null
          status?: string
          test_mode?: boolean
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          bank_account: string | null
          bank_holder: string | null
          bank_name: string | null
          business_number: string | null
          cert_path: string | null
          company_name: string | null
          consent_version: string | null
          created_at: string
          favorite_item_ids: string[]
          id: string
          marketing_accepted: boolean | null
          marketing_accepted_at: string | null
          owner_name: string | null
          phone: string | null
          privacy_accepted_at: string | null
          staff_name: string | null
          staff_phone: string | null
          terms_accepted_at: string | null
          updated_at: string
        }
        Insert: {
          bank_account?: string | null
          bank_holder?: string | null
          bank_name?: string | null
          business_number?: string | null
          cert_path?: string | null
          company_name?: string | null
          consent_version?: string | null
          created_at?: string
          favorite_item_ids?: string[]
          id: string
          marketing_accepted?: boolean | null
          marketing_accepted_at?: string | null
          owner_name?: string | null
          phone?: string | null
          privacy_accepted_at?: string | null
          staff_name?: string | null
          staff_phone?: string | null
          terms_accepted_at?: string | null
          updated_at?: string
        }
        Update: {
          bank_account?: string | null
          bank_holder?: string | null
          bank_name?: string | null
          business_number?: string | null
          cert_path?: string | null
          company_name?: string | null
          consent_version?: string | null
          created_at?: string
          favorite_item_ids?: string[]
          id?: string
          marketing_accepted?: boolean | null
          marketing_accepted_at?: string | null
          owner_name?: string | null
          phone?: string | null
          privacy_accepted_at?: string | null
          staff_name?: string | null
          staff_phone?: string | null
          terms_accepted_at?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      reminder_job_runs: {
        Row: {
          checked: number
          created_at: string
          failed: number
          id: string
          job: string
          missed: number
          note: string | null
          picked: number
          ran_at: string
          sent: number
        }
        Insert: {
          checked?: number
          created_at?: string
          failed?: number
          id?: string
          job: string
          missed?: number
          note?: string | null
          picked?: number
          ran_at?: string
          sent?: number
        }
        Update: {
          checked?: number
          created_at?: string
          failed?: number
          id?: string
          job?: string
          missed?: number
          note?: string | null
          picked?: number
          ran_at?: string
          sent?: number
        }
        Relationships: []
      }
      service_fix_notices: {
        Row: {
          created_at: string
          created_by: string | null
          error_log_id: string | null
          error_message: string | null
          failed_at: string | null
          id: string
          provider_message_id: string | null
          sent_at: string | null
          source: string
          status: string
          summary: string
          title: string
          to_masked: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          error_log_id?: string | null
          error_message?: string | null
          failed_at?: string | null
          id?: string
          provider_message_id?: string | null
          sent_at?: string | null
          source?: string
          status?: string
          summary: string
          title: string
          to_masked?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          error_log_id?: string | null
          error_message?: string | null
          failed_at?: string | null
          id?: string
          provider_message_id?: string | null
          sent_at?: string | null
          source?: string
          status?: string
          summary?: string
          title?: string
          to_masked?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "service_fix_notices_error_log_id_fkey"
            columns: ["error_log_id"]
            isOneToOne: false
            referencedRelation: "error_logs"
            referencedColumns: ["id"]
          },
        ]
      }
      service_ops_settings: {
        Row: {
          id: boolean
          notice_phone: string | null
          notify_enabled: boolean
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          id?: boolean
          notice_phone?: string | null
          notify_enabled?: boolean
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          id?: boolean
          notice_phone?: string | null
          notify_enabled?: boolean
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      sms_usage: {
        Row: {
          created_at: string
          free_used: number
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          free_used?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          free_used?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      sms_usage_events: {
        Row: {
          created_at: string
          idempotency_key: string
          recipients: number
          state: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          idempotency_key: string
          recipients?: number
          state?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          idempotency_key?: string
          recipients?: number
          state?: string
          updated_at?: string
          user_id?: string
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
          trial_ends_at: string | null
          trial_started_at: string | null
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
          trial_ends_at?: string | null
          trial_started_at?: string | null
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
          trial_ends_at?: string | null
          trial_started_at?: string | null
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
          confirmed_by: string
          confirmed_by_user_id: string | null
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
          confirmed_by?: string
          confirmed_by_user_id?: string | null
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
          confirmed_by?: string
          confirmed_by_user_id?: string | null
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
      trial_identities: {
        Row: {
          created_at: string
          first_user_id: string
          identity_hash: string
          kind: string
        }
        Insert: {
          created_at?: string
          first_user_id: string
          identity_hash: string
          kind: string
        }
        Update: {
          created_at?: string
          first_user_id?: string
          identity_hash?: string
          kind?: string
        }
        Relationships: []
      }
      trial_reviews: {
        Row: {
          created_at: string
          id: string
          identity_hash: string | null
          reason: string
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          identity_hash?: string | null
          reason: string
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          identity_hash?: string | null
          reason?: string
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
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
      cancel_reservation: { Args: { _terms_id: string }; Returns: boolean }
      cancel_reservation_all: { Args: { _terms_id: string }; Returns: Json }
      cancel_reservation_all_for: {
        Args: { _terms_id: string; _user_id: string }
        Returns: Json
      }
      claim_move_reminders: {
        Args: { _limit?: number }
        Returns: {
          accepted_at: string | null
          aligo_message_id: string | null
          auto_retried: boolean
          company_id: string
          company_phone: string | null
          created_at: string
          customer_name: string
          customer_phone: string
          customer_viewed_at: string | null
          delivered_at: string | null
          delivery_type: string
          error_code: string | null
          error_reason: string | null
          estimate_id: string
          estimate_terms_id: string | null
          failed_at: string | null
          from_address: string | null
          id: string
          idempotency_key: string
          last_checked_at: string | null
          last_viewed_at: string | null
          message_snapshot: string | null
          message_type: string | null
          missed_reason: string | null
          move_date: string
          processing_at: string | null
          provider: string
          provider_message_id: string | null
          provider_response: Json | null
          requested_at: string | null
          retry_count: number
          scheduled_at: string
          scheduled_date: string
          sent_at: string | null
          start_time: string | null
          status: string
          to_address: string | null
          to_masked: string | null
          updated_at: string
          user_id: string
          view_count: number
          view_token: string | null
        }[]
        SetofOptions: {
          from: "*"
          to: "move_reminders"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      claim_trial_identity: {
        Args: { _business: string; _phone: string }
        Returns: Json
      }
      claim_trial_identity_for: {
        Args: { _business: string; _phone: string; _user_id: string }
        Returns: Json
      }
      confirm_free_sms: {
        Args: { _key: string; _user_id: string }
        Returns: undefined
      }
      confirm_reservation_atomic: {
        Args: {
          _accept_method: string
          _estimate_snapshot: string
          _terms_id: string
          _terms_snapshot: string
          _token_hint: string
          _user_agent: string
        }
        Returns: Json
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_super_admin: { Args: { _user_id?: string }; Returns: boolean }
      mark_reminder_viewed: { Args: { _token: string }; Returns: Json }
      owner_confirm_contract: {
        Args: {
          _contact_phone?: string
          _customer_name: string
          _estimate_id: string
          _estimate_snapshot: string
          _move_date: string
          _sheet_no: string
          _sheet_version: number
          _total: number
        }
        Returns: Json
      }
      release_free_sms: {
        Args: { _key: string; _user_id: string }
        Returns: Json
      }
      reserve_free_sms: {
        Args: { _count?: number; _key: string; _user_id: string }
        Returns: Json
      }
      sms_free_limit: { Args: never; Returns: number }
      sms_quota: { Args: { _user_id?: string }; Returns: Json }
      soft_delete_estimate: {
        Args: { _estimate_id: string; _reason?: string; _source?: string }
        Returns: Json
      }
    }
    Enums: {
      app_role: "admin" | "user" | "super_admin" | "subscriber"
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
      app_role: ["admin", "user", "super_admin", "subscriber"],
      plan_tier: ["free", "basic", "pro"],
      sub_status: ["trialing", "active", "past_due", "canceled"],
    },
  },
} as const
