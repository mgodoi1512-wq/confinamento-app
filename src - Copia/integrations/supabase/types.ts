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
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {

      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
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
  public: {
    Tables: {
      lot_system_history: { Row: {id:string;farm_id:string;lot_id:string;from_system:string|null;to_system:string;from_pen_id:string|null;to_pen_id:string;effective_date:string;created_by:string|null;created_at:string;request_id:string|null;request_payload:Json|null}; Insert: {farm_id:string;lot_id:string;to_system:string;to_pen_id:string;effective_date:string}; Update: {to_system?:string}; Relationships: [] };
      farm_feed_settings: {
        Row: { farm_id: string; schedule: Json; updated_at: string };
        Insert: { farm_id: string; schedule: Json; updated_at?: string };
        Update: { schedule?: Json; updated_at?: string };
        Relationships: [];
      };
      daily_feed_plans: {
        Row: { stock_mapping?: Json | null; meal_count: number | null; id: string; farm_id: string; lot_id: string; pen_id: string; date: string; diet_id: string; diet_name: string; head_count: number; average_weight_kg: number; ingredients: Json; schedule: Json; daily_kg_per_head: number; daily_total_kg: number; created_at: string };
        Insert: { farm_id: string; lot_id: string; pen_id: string; date: string; diet_id: string; diet_name: string; head_count: number; average_weight_kg: number; ingredients: Json; schedule: Json; daily_kg_per_head: number; daily_total_kg: number; id?: string; created_at?: string };
        Update: { schedule?: Json };
        Relationships: [];
      };
      farm_cost_sheets: {
        Row: { farm_id: string; parameters: Json; created_at: string; updated_at: string };
        Insert: { farm_id?: string; parameters: Json; created_at?: string; updated_at?: string };
        Update: { parameters?: Json; updated_at?: string };
        Relationships: [];
      };

      beta_feedback: {
        Row: { id: string; user_id: string; farm_id: string; author: string; kind: string; description: string; page: string; screenshot: string | null; has_screenshot: boolean; status: string; notes: string; created_at: string; updated_at: string };
        Insert: { id: string; user_id: string; farm_id: string; author: string; kind: string; description: string; page: string; screenshot?: string | null; status?: string; notes?: string };
        Update: { status?: string; notes?: string };
        Relationships: [];
      };

      adaptation_plans: {
        Row: { id: string; farm_id: string; lot_id: string; parameters: Json; created_at: string; updated_at: string }
        Insert: { id?: string; farm_id?: string; lot_id: string; parameters: Json; created_at?: string; updated_at?: string }
        Update: { parameters?: Json; updated_at?: string }
        Relationships: []
      }

      app_members: {
        Row: { user_id: string; enabled: boolean; created_at: string }
        Insert: { user_id: string; enabled?: boolean; created_at?: string }
        Update: { enabled?: boolean }
        Relationships: []
      }

      animals: {
        Row: {
          breed: string | null
          created_at: string
          current_weight_kg: number | null
          ear_tag: string
          entry_weight_kg: number | null
          health_status: string
          id: string
          lot_id: string | null
          notes: string | null
          owner_id: string | null
          pen_id: string | null
          sex: string | null
          sisbov: string | null
          status: string
          withdrawal_until: string | null
        }
        Insert: {
          breed?: string | null
          created_at?: string
          current_weight_kg?: number | null
          ear_tag: string
          entry_weight_kg?: number | null
          health_status?: string
          id?: string
          lot_id?: string | null
          notes?: string | null
          owner_id?: string | null
          pen_id?: string | null
          sex?: string | null
          sisbov?: string | null
          status?: string
          withdrawal_until?: string | null
        }
        Update: {
          breed?: string | null
          created_at?: string
          current_weight_kg?: number | null
          ear_tag?: string
          entry_weight_kg?: number | null
          health_status?: string
          id?: string
          lot_id?: string | null
          notes?: string | null
          owner_id?: string | null
          pen_id?: string | null
          sex?: string | null
          sisbov?: string | null
          status?: string
          withdrawal_until?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "animals_lot_id_fkey"
            columns: ["lot_id"]
            isOneToOne: false
            referencedRelation: "lots"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "animals_pen_id_fkey"
            columns: ["pen_id"]
            isOneToOne: false
            referencedRelation: "pens"
            referencedColumns: ["id"]
          },
        ]
      }
      diet_items: {
        Row: {
          diet_id: string
          id: string
          ingredient: string
          body_weight_pct: number | null
          kg_per_head_day: number
          owner_id: string | null
        }
        Insert: {
          diet_id: string
          id?: string
          ingredient: string
          body_weight_pct?: number | null
          kg_per_head_day?: number
          owner_id?: string | null
        }
        Update: {
          diet_id?: string
          id?: string
          ingredient?: string
          body_weight_pct?: number | null
          kg_per_head_day?: number
          owner_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "diet_items_diet_id_fkey"
            columns: ["diet_id"]
            isOneToOne: false
            referencedRelation: "diets"
            referencedColumns: ["id"]
          },
        ]
      }
      diets: {
        Row: {
          created_at: string
          dry_matter_pct: number | null
          farm_id: string | null
          id: string
          is_active: boolean
          name: string
          notes: string | null
          owner_id: string | null
        }
        Insert: {
          created_at?: string
          dry_matter_pct?: number | null
          farm_id?: string | null
          id?: string
          is_active?: boolean
          name: string
          notes?: string | null
          owner_id?: string | null
        }
        Update: {
          created_at?: string
          dry_matter_pct?: number | null
          farm_id?: string | null
          id?: string
          is_active?: boolean
          name?: string
          notes?: string | null
          owner_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "diets_farm_id_fkey"
            columns: ["farm_id"]
            isOneToOne: false
            referencedRelation: "farms"
            referencedColumns: ["id"]
          },
        ]
      }
      farms: {
        Row: { production_systems?: string[]; default_production_system?: string | null; systems_updated_at?: string | null;
          city: string | null
          created_at: string
          id: string
          name: string
          owner_id: string | null
          state: string | null
        }
        Insert: { production_systems?: string[]; default_production_system?: string | null; systems_updated_at?: string | null;
          city?: string | null
          created_at?: string
          id?: string
          name: string
          owner_id?: string | null
          state?: string | null
        }
        Update: { production_systems?: string[]; default_production_system?: string | null; systems_updated_at?: string | null;
          city?: string | null
          created_at?: string
          id?: string
          name?: string
          owner_id?: string | null
          state?: string | null
        }
        Relationships: []
      }
      feed_logs: {
        Row: {
          day_plan_id?: string | null
          planned_time?: string | null
          ingredient_quantities?: Json | null
          planned_request_id?: string | null
          planned_request_payload?: Json | null
          created_at: string
          date: string
          diet_id: string | null
          head_count: number
          id: string
          kg_per_head: number
          lot_id: string | null
          notes: string | null
          owner_id: string | null
          pen_id: string
          recorded_by: string | null
          shift: string
          total_kg: number
        }
        Insert: {
          created_at?: string
          date?: string
          diet_id?: string | null
          head_count?: number
          id?: string
          kg_per_head?: number
          lot_id?: string | null
          notes?: string | null
          owner_id?: string | null
          pen_id: string
          recorded_by?: string | null
          shift?: string
          total_kg?: number
        }
        Update: {
          created_at?: string
          date?: string
          diet_id?: string | null
          head_count?: number
          id?: string
          kg_per_head?: number
          lot_id?: string | null
          notes?: string | null
          owner_id?: string | null
          pen_id?: string
          recorded_by?: string | null
          shift?: string
          total_kg?: number
        }
        Relationships: [
          {
            foreignKeyName: "feed_logs_diet_id_fkey"
            columns: ["diet_id"]
            isOneToOne: false
            referencedRelation: "diets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "feed_logs_lot_id_fkey"
            columns: ["lot_id"]
            isOneToOne: false
            referencedRelation: "lots"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "feed_logs_pen_id_fkey"
            columns: ["pen_id"]
            isOneToOne: false
            referencedRelation: "pens"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "feed_logs_recorded_by_fkey"
            columns: ["recorded_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      health_events: {
        Row: {
          head_count: number
          animal_id: string | null
          created_at: string
          diagnosis: string | null
          dose: string | null
          event_date: string
          id: string
          kind: string
          lot_id: string | null
          notes: string | null
          owner_id: string | null
          pen_id: string | null
          product: string | null
          recorded_by: string | null
          withdrawal_until: string | null
        }
        Insert: {
          head_count?: number
          animal_id?: string | null
          created_at?: string
          diagnosis?: string | null
          dose?: string | null
          event_date?: string
          id?: string
          kind?: string
          lot_id?: string | null
          notes?: string | null
          owner_id?: string | null
          pen_id?: string | null
          product?: string | null
          recorded_by?: string | null
          withdrawal_until?: string | null
        }
        Update: {
          head_count?: number
          animal_id?: string | null
          created_at?: string
          diagnosis?: string | null
          dose?: string | null
          event_date?: string
          id?: string
          kind?: string
          lot_id?: string | null
          notes?: string | null
          owner_id?: string | null
          pen_id?: string | null
          product?: string | null
          recorded_by?: string | null
          withdrawal_until?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "health_events_animal_id_fkey"
            columns: ["animal_id"]
            isOneToOne: false
            referencedRelation: "animals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "health_events_lot_id_fkey"
            columns: ["lot_id"]
            isOneToOne: false
            referencedRelation: "lots"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "health_events_pen_id_fkey"
            columns: ["pen_id"]
            isOneToOne: false
            referencedRelation: "pens"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "health_events_recorded_by_fkey"
            columns: ["recorded_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      lots: {
        Row: { production_system?: string | null; system_started_on?: string | null; system_updated_at?: string | null;
          initial_head_count: number
          breed: string | null
          category: string | null
          code: string
          created_at: string
          diet_id: string | null
          entry_avg_weight_kg: number
          entry_date: string
          farm_id: string | null
          head_count: number
          id: string
          notes: string | null
          origin: string | null
          owner_id: string | null
          pen_id: string | null
          protocol_id: string | null
          status: string
          target_weight_kg: number
        }
        Insert: { production_system?: string | null; system_started_on?: string | null; system_updated_at?: string | null;
          initial_head_count?: number
          breed?: string | null
          category?: string | null
          code: string
          created_at?: string
          diet_id?: string | null
          entry_avg_weight_kg?: number
          entry_date?: string
          farm_id?: string | null
          head_count?: number
          id?: string
          notes?: string | null
          origin?: string | null
          owner_id?: string | null
          pen_id?: string | null
          protocol_id?: string | null
          status?: string
          target_weight_kg?: number
        }
        Update: { production_system?: string | null; system_started_on?: string | null; system_updated_at?: string | null;
          initial_head_count?: number
          breed?: string | null
          category?: string | null
          code?: string
          created_at?: string
          diet_id?: string | null
          entry_avg_weight_kg?: number
          entry_date?: string
          farm_id?: string | null
          head_count?: number
          id?: string
          notes?: string | null
          origin?: string | null
          owner_id?: string | null
          pen_id?: string | null
          protocol_id?: string | null
          status?: string
          target_weight_kg?: number
        }
        Relationships: [
          {
            foreignKeyName: "lots_diet_id_fkey"
            columns: ["diet_id"]
            isOneToOne: false
            referencedRelation: "diets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lots_farm_id_fkey"
            columns: ["farm_id"]
            isOneToOne: false
            referencedRelation: "farms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lots_pen_id_fkey"
            columns: ["pen_id"]
            isOneToOne: false
            referencedRelation: "pens"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lots_protocol_id_fkey"
            columns: ["protocol_id"]
            isOneToOne: false
            referencedRelation: "protocols"
            referencedColumns: ["id"]
          },
        ]
      }
      pens: {
        Row: { location_type?: string;
          area_m2: number | null
          capacity_head: number
          code: string
          created_at: string
          farm_id: string | null
          id: string
          notes: string | null
          owner_id: string | null
          status: string
        }
        Insert: { location_type?: string;
          area_m2?: number | null
          capacity_head?: number
          code: string
          created_at?: string
          farm_id?: string | null
          id?: string
          notes?: string | null
          owner_id?: string | null
          status?: string
        }
        Update: { location_type?: string;
          area_m2?: number | null
          capacity_head?: number
          code?: string
          created_at?: string
          farm_id?: string | null
          id?: string
          notes?: string | null
          owner_id?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "pens_farm_id_fkey"
            columns: ["farm_id"]
            isOneToOne: false
            referencedRelation: "farms"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          full_name: string | null
          id: string
          role: string
        }
        Insert: {
          created_at?: string
          full_name?: string | null
          id: string
          role?: string
        }
        Update: {
          created_at?: string
          full_name?: string | null
          id?: string
          role?: string
        }
        Relationships: []
      }
      protocol_items: {
        Row: {
          dose: string | null
          id: string
          kind: string
          owner_id: string | null
          product: string
          protocol_id: string
          withdrawal_days: number
        }
        Insert: {
          dose?: string | null
          id?: string
          kind?: string
          owner_id?: string | null
          product: string
          protocol_id: string
          withdrawal_days?: number
        }
        Update: {
          dose?: string | null
          id?: string
          kind?: string
          owner_id?: string | null
          product?: string
          protocol_id?: string
          withdrawal_days?: number
        }
        Relationships: [
          {
            foreignKeyName: "protocol_items_protocol_id_fkey"
            columns: ["protocol_id"]
            isOneToOne: false
            referencedRelation: "protocols"
            referencedColumns: ["id"]
          },
        ]
      }
      protocols: {
        Row: {
          created_at: string
          description: string | null
          farm_id: string | null
          id: string
          is_active: boolean
          name: string
          owner_id: string | null
        }
        Insert: {
          created_at?: string
          description?: string | null
          farm_id?: string | null
          id?: string
          is_active?: boolean
          name: string
          owner_id?: string | null
        }
        Update: {
          created_at?: string
          description?: string | null
          farm_id?: string | null
          id?: string
          is_active?: boolean
          name?: string
          owner_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "protocols_farm_id_fkey"
            columns: ["farm_id"]
            isOneToOne: false
            referencedRelation: "farms"
            referencedColumns: ["id"]
          },
        ]
      }
      trough_readings: {
        Row: {
          base_kg_per_head: number | null
          adjustment_kg: number
          adjustment_pct: number
          created_at: string
          date: string
          id: string
          leftover_kg: number | null
          lot_id: string | null
          notes: string | null
          owner_id: string | null
          pen_id: string
          recorded_by: string | null
          score: number
        }
        Insert: {
          base_kg_per_head?: number | null
          adjustment_kg?: number
          adjustment_pct?: number
          created_at?: string
          date?: string
          id?: string
          leftover_kg?: number | null
          lot_id?: string | null
          notes?: string | null
          owner_id?: string | null
          pen_id: string
          recorded_by?: string | null
          score: number
        }
        Update: {
          base_kg_per_head?: number | null
          adjustment_kg?: number
          adjustment_pct?: number
          created_at?: string
          date?: string
          id?: string
          leftover_kg?: number | null
          lot_id?: string | null
          notes?: string | null
          owner_id?: string | null
          pen_id?: string
          recorded_by?: string | null
          score?: number
        }
        Relationships: [
          {
            foreignKeyName: "trough_readings_lot_id_fkey"
            columns: ["lot_id"]
            isOneToOne: false
            referencedRelation: "lots"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trough_readings_pen_id_fkey"
            columns: ["pen_id"]
            isOneToOne: false
            referencedRelation: "pens"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trough_readings_recorded_by_fkey"
            columns: ["recorded_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      weighings: {
        Row: {
          avg_weight_kg: number
          created_at: string
          date: string
          head_count_weighed: number
          id: string
          kind: string
          lot_id: string | null
          notes: string | null
          owner_id: string | null
          pen_id: string | null
          recorded_by: string | null
        }
        Insert: {
          avg_weight_kg: number
          created_at?: string
          date?: string
          head_count_weighed?: number
          id?: string
          kind?: string
          lot_id?: string | null
          notes?: string | null
          owner_id?: string | null
          pen_id?: string | null
          recorded_by?: string | null
        }
        Update: {
          avg_weight_kg?: number
          created_at?: string
          date?: string
          head_count_weighed?: number
          id?: string
          kind?: string
          lot_id?: string | null
          notes?: string | null
          owner_id?: string | null
          pen_id?: string | null
          recorded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "weighings_lot_id_fkey"
            columns: ["lot_id"]
            isOneToOne: false
            referencedRelation: "lots"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "weighings_pen_id_fkey"
            columns: ["pen_id"]
            isOneToOne: false
            referencedRelation: "pens"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "weighings_recorded_by_fkey"
            columns: ["recorded_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      weight_records: {
        Row: {
          animal_id: string
          id: string
          owner_id: string | null
          weighing_id: string
          weight_kg: number
        }
        Insert: {
          animal_id: string
          id?: string
          owner_id?: string | null
          weighing_id: string
          weight_kg: number
        }
        Update: {
          animal_id?: string
          id?: string
          owner_id?: string | null
          weighing_id?: string
          weight_kg?: number
        }
        Relationships: [
          {
            foreignKeyName: "weight_records_animal_id_fkey"
            columns: ["animal_id"]
            isOneToOne: false
            referencedRelation: "animals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "weight_records_weighing_id_fkey"
            columns: ["weighing_id"]
            isOneToOne: false
            referencedRelation: "weighings"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      app_production_settings: { Args: {p_payload: Json}; Returns: Json };
      app_change_lot_system: { Args: {p_payload: Json; p_request_id: string}; Returns: Json };
      app_feed_stock: { Args: Record<PropertyKey, never>; Returns: Json };
      app_stock_production: { Args: { p_action: string; p_payload?: Json }; Returns: Json };
      app_equipment: { Args: { p_action: string; p_payload?: Json }; Returns: Json };
      app_create_loan: { Args: { p_payload: Json; p_request_id: string }; Returns: Json };
      app_record_loan_outflow: { Args: { p_payload: Json; p_request_id: string }; Returns: Json };
      app_next_ear_tag: { Args: Record<string, never>; Returns: Json };
      app_register_missing_lot_animals: { Args: { p_payload: Json; p_request_id: string }; Returns: Json };
      app_create_priced_lot: { Args: { p_payload: Json; p_request_id: string }; Returns: Json };
      app_stock_animal_values: { Args: { p_action: string; p_payload?: Json }; Returns: Json };
      app_finance_workspace: { Args: { p_action: string; p_payload?: Json }; Returns: Json };
      app_my_production_plan: { Args: Record<string, never>; Returns: Json };
      app_my_plan: { Args: Record<string, never>; Returns: Json };
      app_billing_admin: { Args: { p_action: string; p_payload?: Json }; Returns: Json };
      app_save_feed_schedule: { Args: { p_schedule: Json; p_expected_updated_at?: string | null }; Returns: Json };
      app_record_planned_feed: { Args: { p_payload: Json; p_request_id: string }; Returns: Json };
      app_save_cost_sheet: { Args: { p_parameters: Json; p_expected_updated_at?: string | null }; Returns: Json };
      app_submit_feedback: { Args: { p_id: string; p_kind: string; p_description: string; p_page: string; p_screenshot?: string | null }; Returns: string };
      app_review_feedback: { Args: { p_id: string; p_status: string; p_notes: string; p_expected_updated_at: string }; Returns: Json };
      app_delete_adaptation: { Args: { p_id: string; p_expected_updated_at: string }; Returns: Json };
      app_save_adaptation: {
        Args: { p_lot_id: string; p_parameters: Json; p_expected_updated_at?: string | null }
        Returns: Json
      }

      app_tenant: { Args: { p_action: string; p_payload?: Json }; Returns: Json };
      app_apply_readings: {
        Args: { p_date: string; p_request_id: string }
        Returns: Json
      }
      app_correct_weight_record: {
        Args: {
          p_record_id: string
          p_weight: number | null
          p_delete: boolean
          p_remove_empty: boolean
          p_expected_weight: number
          p_expected_count: number
          p_request_id: string
        }
        Returns: Json
      }
      app_mutate: {
        Args: { p_operation: string; p_payload: Json; p_request_id: string }
        Returns: Json
      }
      has_app_access: { Args: Record<PropertyKey, never>; Returns: boolean }
    }
    Enums: {
      [_ in never]: never
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
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {},
  },
} as const
