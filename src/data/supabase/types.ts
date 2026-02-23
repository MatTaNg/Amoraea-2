export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          created_at: string;
          updated_at: string;
          onboarding_completed: boolean;
          onboarding_step: number;
          name: string | null;
          age: number | null;
          gender: string | null;
          attracted_to: string[] | null;
          height_centimeters: number | null;
          occupation: string | null;
          location_latitude: number | null;
          location_longitude: number | null;
          location_label: string | null;
          primary_photo_url: string | null;
        };
        Insert: {
          id: string;
          created_at?: string;
          updated_at?: string;
          onboarding_completed?: boolean;
          onboarding_step?: number;
          name?: string | null;
          age?: number | null;
          gender?: string | null;
          attracted_to?: string[] | null;
          height_centimeters?: number | null;
          occupation?: string | null;
          location_latitude?: number | null;
          location_longitude?: number | null;
          location_label?: string | null;
          primary_photo_url?: string | null;
        };
        Update: {
          id?: string;
          created_at?: string;
          updated_at?: string;
          onboarding_completed?: boolean;
          onboarding_step?: number;
          name?: string | null;
          age?: number | null;
          gender?: string | null;
          attracted_to?: string[] | null;
          height_centimeters?: number | null;
          occupation?: string | null;
          location_latitude?: number | null;
          location_longitude?: number | null;
          location_label?: string | null;
          primary_photo_url?: string | null;
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
    };
  };
}

