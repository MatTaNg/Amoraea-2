/**
 * Hand-maintained subset of Supabase schema for typed client usage.
 * Regenerate from the live DB when adding tables/columns (`supabase gen types typescript`).
 */
export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          email: string | null;
          profile_json: Record<string, unknown>;
          created_at: string;
          updated_at: string;
          full_name: string | null;
          avatar_url: string | null;
          display_name: string | null;
          insight_display_acknowledged_at: string | null;
        };
        Insert: {
          id: string;
          email?: string | null;
          profile_json?: Record<string, unknown>;
          created_at?: string;
          updated_at?: string;
          full_name?: string | null;
          avatar_url?: string | null;
          display_name?: string | null;
          insight_display_acknowledged_at?: string | null;
        };
        Update: {
          id?: string;
          email?: string | null;
          profile_json?: Record<string, unknown>;
          created_at?: string;
          updated_at?: string;
          full_name?: string | null;
          avatar_url?: string | null;
          display_name?: string | null;
          insight_display_acknowledged_at?: string | null;
        };
      };
      typologies: {
        Row: {
          id: string;
          profile_id: string;
          typology_type: string;
          typology_data: Record<string, unknown>;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          profile_id: string;
          typology_type: string;
          typology_data: Record<string, unknown>;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          profile_id?: string;
          typology_type?: string;
          typology_data?: Record<string, unknown>;
          created_at?: string;
          updated_at?: string;
        };
      };
      compatibility: {
        Row: {
          id: string;
          profile_id: string;
          compatibility_data: Record<string, unknown>;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          profile_id: string;
          compatibility_data: Record<string, unknown>;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          profile_id?: string;
          compatibility_data?: Record<string, unknown>;
          created_at?: string;
          updated_at?: string;
        };
      };
      profile_photos: {
        Row: {
          id: string;
          profile_id: string;
          storage_path: string;
          public_url: string;
          display_order: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          profile_id: string;
          storage_path: string;
          public_url: string;
          display_order: number;
          created_at?: string;
        };
        Update: {
          id?: string;
          profile_id?: string;
          storage_path?: string;
          public_url?: string;
          display_order?: number;
          created_at?: string;
        };
      };
      user_personality_documents: {
        Row: {
          id: string;
          user_id: string;
          file_name: string;
          file_type: string;
          storage_path: string;
          extracted_signals: Record<string, unknown> | null;
          narrative_summary: string | null;
          processing_status: string;
          uploaded_at: string;
          processed_at: string | null;
        };
        Insert: {
          id?: string;
          user_id: string;
          file_name: string;
          file_type: string;
          storage_path: string;
          extracted_signals?: Record<string, unknown> | null;
          narrative_summary?: string | null;
          processing_status?: string;
          uploaded_at?: string;
          processed_at?: string | null;
        };
        Update: {
          id?: string;
          user_id?: string;
          file_name?: string;
          file_type?: string;
          storage_path?: string;
          extracted_signals?: Record<string, unknown> | null;
          narrative_summary?: string | null;
          processing_status?: string;
          uploaded_at?: string;
          processed_at?: string | null;
        };
      };
    };
    Views: {
      user_interview_routing: {
        Row: {
          id: string;
          email: string | null;
          interview_completed: boolean | null;
          interview_passed: boolean | null;
          interview_passed_computed: boolean | null;
          interview_passed_admin_override: boolean | null;
          latest_attempt_id: string | null;
          interview_attempt_count: number | null;
          is_alpha_tester: boolean;
          referral_boost_active: boolean;
          referral_notice_pending: string | null;
          psychometrics_completed_at: string | null;
          interview_completed_at: string | null;
          market_research_completed_at: string | null;
          launch_notification_phone: string | null;
          launch_notification_submitted_at: string | null;
          created_at: string;
          updated_at: string;
        };
      };
    };
  };
}
