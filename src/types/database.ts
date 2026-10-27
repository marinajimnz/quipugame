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
      elo_history: {
        Row: {
          created_at: string
          delta: number
          elo_after: number
          elo_before: number
          game_id: string
          id: string
          k_factor: number
          profile_id: string
        }
        Insert: {
          created_at?: string
          delta: number
          elo_after: number
          elo_before: number
          game_id: string
          id?: string
          k_factor: number
          profile_id: string
        }
        Update: {
          created_at?: string
          delta?: number
          elo_after?: number
          elo_before?: number
          game_id?: string
          id?: string
          k_factor?: number
          profile_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "elo_history_game_id_fkey"
            columns: ["game_id"]
            isOneToOne: false
            referencedRelation: "games"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "elo_history_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      game_clues: {
        Row: {
          answer_position: number | null
          answer_same: boolean | null
          asker_id: string
          created_at: string
          game_id: string
          id: string
          kind: Database["public"]["Enums"]["clue_kind"]
          target_slot: number | null
          tile_number: number
        }
        Insert: {
          answer_position?: number | null
          answer_same?: boolean | null
          asker_id: string
          created_at?: string
          game_id: string
          id?: string
          kind: Database["public"]["Enums"]["clue_kind"]
          target_slot?: number | null
          tile_number: number
        }
        Update: {
          answer_position?: number | null
          answer_same?: boolean | null
          asker_id?: string
          created_at?: string
          game_id?: string
          id?: string
          kind?: Database["public"]["Enums"]["clue_kind"]
          target_slot?: number | null
          tile_number?: number
        }
        Relationships: [
          {
            foreignKeyName: "game_clues_asker_id_fkey"
            columns: ["asker_id"]
            isOneToOne: false
            referencedRelation: "game_players"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "game_clues_game_id_fkey"
            columns: ["game_id"]
            isOneToOne: false
            referencedRelation: "games"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "game_clues_tile_number_fkey"
            columns: ["tile_number"]
            isOneToOne: false
            referencedRelation: "tile_definitions"
            referencedColumns: ["number"]
          },
        ]
      }
      game_events: {
        Row: {
          actor_id: string | null
          created_at: string
          game_id: string
          id: number
          kind: string
          payload: Json
          seq: number
        }
        Insert: {
          actor_id?: string | null
          created_at?: string
          game_id: string
          id?: never
          kind: string
          payload?: Json
          seq: number
        }
        Update: {
          actor_id?: string | null
          created_at?: string
          game_id?: string
          id?: never
          kind?: string
          payload?: Json
          seq?: number
        }
        Relationships: [
          {
            foreignKeyName: "game_events_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "game_players"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "game_events_game_id_fkey"
            columns: ["game_id"]
            isOneToOne: false
            referencedRelation: "games"
            referencedColumns: ["id"]
          },
        ]
      }
      game_players: {
        Row: {
          bot_difficulty: string | null
          game_id: string
          has_declared: boolean
          id: string
          is_bot: boolean
          last_seen_at: string
          profile_id: string | null
          seat: number
          state: Database["public"]["Enums"]["player_state"]
          timeouts: number
        }
        Insert: {
          bot_difficulty?: string | null
          game_id: string
          has_declared?: boolean
          id?: string
          is_bot?: boolean
          last_seen_at?: string
          profile_id?: string | null
          seat: number
          state?: Database["public"]["Enums"]["player_state"]
          timeouts?: number
        }
        Update: {
          bot_difficulty?: string | null
          game_id?: string
          has_declared?: boolean
          id?: string
          is_bot?: boolean
          last_seen_at?: string
          profile_id?: string | null
          seat?: number
          state?: Database["public"]["Enums"]["player_state"]
          timeouts?: number
        }
        Relationships: [
          {
            foreignKeyName: "game_players_game_id_fkey"
            columns: ["game_id"]
            isOneToOne: false
            referencedRelation: "games"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "game_players_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      game_tiles: {
        Row: {
          game_id: string
          id: string
          number: number
          owner_id: string | null
          place: Database["public"]["Enums"]["tile_place"]
          slot: number | null
        }
        Insert: {
          game_id: string
          id?: string
          number: number
          owner_id?: string | null
          place?: Database["public"]["Enums"]["tile_place"]
          slot?: number | null
        }
        Update: {
          game_id?: string
          id?: string
          number?: number
          owner_id?: string | null
          place?: Database["public"]["Enums"]["tile_place"]
          slot?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "game_tiles_game_id_fkey"
            columns: ["game_id"]
            isOneToOne: false
            referencedRelation: "games"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "game_tiles_number_fkey"
            columns: ["number"]
            isOneToOne: false
            referencedRelation: "tile_definitions"
            referencedColumns: ["number"]
          },
          {
            foreignKeyName: "game_tiles_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "game_players"
            referencedColumns: ["id"]
          },
        ]
      }
      games: {
        Row: {
          created_at: string
          current_seat: number | null
          elo_applied_at: string | null
          event_seq: number
          final_round_until_seat: number | null
          finished_at: string | null
          id: string
          mode: Database["public"]["Enums"]["game_mode"]
          phase: Database["public"]["Enums"]["turn_phase"]
          revealed_tile: number | null
          started_at: string | null
          status: Database["public"]["Enums"]["game_status"]
          turn_deadline: string | null
          winner_player_id: string | null
        }
        Insert: {
          created_at?: string
          current_seat?: number | null
          elo_applied_at?: string | null
          event_seq?: number
          final_round_until_seat?: number | null
          finished_at?: string | null
          id?: string
          mode: Database["public"]["Enums"]["game_mode"]
          phase?: Database["public"]["Enums"]["turn_phase"]
          revealed_tile?: number | null
          started_at?: string | null
          status?: Database["public"]["Enums"]["game_status"]
          turn_deadline?: string | null
          winner_player_id?: string | null
        }
        Update: {
          created_at?: string
          current_seat?: number | null
          elo_applied_at?: string | null
          event_seq?: number
          final_round_until_seat?: number | null
          finished_at?: string | null
          id?: string
          mode?: Database["public"]["Enums"]["game_mode"]
          phase?: Database["public"]["Enums"]["turn_phase"]
          revealed_tile?: number | null
          started_at?: string | null
          status?: Database["public"]["Enums"]["game_status"]
          turn_deadline?: string | null
          winner_player_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "games_revealed_tile_fkey"
            columns: ["revealed_tile"]
            isOneToOne: false
            referencedRelation: "tile_definitions"
            referencedColumns: ["number"]
          },
          {
            foreignKeyName: "games_winner_fk"
            columns: ["winner_player_id"]
            isOneToOne: false
            referencedRelation: "game_players"
            referencedColumns: ["id"]
          },
        ]
      }
      matchmaking_queue: {
        Row: {
          elo: number
          joined_at: string
          profile_id: string
        }
        Insert: {
          elo: number
          joined_at?: string
          profile_id: string
        }
        Update: {
          elo?: number
          joined_at?: string
          profile_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "matchmaking_queue_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_key: string
          created_at: string
          display_name: string
          elo: number
          games_played: number
          games_won: number
          id: string
          is_guest: boolean
          ranked_games: number
          ranked_wins: number
        }
        Insert: {
          avatar_key?: string
          created_at?: string
          display_name: string
          elo?: number
          games_played?: number
          games_won?: number
          id: string
          is_guest?: boolean
          ranked_games?: number
          ranked_wins?: number
        }
        Update: {
          avatar_key?: string
          created_at?: string
          display_name?: string
          elo?: number
          games_played?: number
          games_won?: number
          id?: string
          is_guest?: boolean
          ranked_games?: number
          ranked_wins?: number
        }
        Relationships: []
      }
      room_members: {
        Row: {
          joined_at: string
          profile_id: string
          room_id: string
        }
        Insert: {
          joined_at?: string
          profile_id: string
          room_id: string
        }
        Update: {
          joined_at?: string
          profile_id?: string
          room_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "room_members_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "room_members_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "rooms"
            referencedColumns: ["id"]
          },
        ]
      }
      rooms: {
        Row: {
          code: string
          created_at: string
          expires_at: string
          fill_with_bots: boolean
          game_id: string | null
          host_id: string
          id: string
          seats: number
          status: string
        }
        Insert: {
          code: string
          created_at?: string
          expires_at?: string
          fill_with_bots?: boolean
          game_id?: string | null
          host_id: string
          id?: string
          seats: number
          status?: string
        }
        Update: {
          code?: string
          created_at?: string
          expires_at?: string
          fill_with_bots?: boolean
          game_id?: string | null
          host_id?: string
          id?: string
          seats?: number
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "rooms_game_id_fkey"
            columns: ["game_id"]
            isOneToOne: false
            referencedRelation: "games"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rooms_host_id_fkey"
            columns: ["host_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      tile_definitions: {
        Row: {
          color_index: number
          number: number
          points: number
        }
        Insert: {
          color_index: number
          number: number
          points: number
        }
        Update: {
          color_index?: number
          number?: number
          points?: number
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      abandon_game: { Args: { p_game_id: string }; Returns: undefined }
      ask_clue: {
        Args: {
          p_game_id: string
          p_kind: Database["public"]["Enums"]["clue_kind"]
          p_slot?: number
          p_tile: number
        }
        Returns: undefined
      }
      create_room: {
        Args: { p_fill_bots?: boolean; p_seats: number }
        Returns: string
      }
      declare_code: {
        Args: { p_game_id: string; p_numbers: number[] }
        Returns: Json
      }
      get_game_state: { Args: { p_game_id: string }; Returns: Json }
      get_leaderboard: { Args: never; Returns: Json }
      get_my_active_game: { Args: never; Returns: string }
      get_queue_status: { Args: never; Returns: Json }
      get_room_rematch: { Args: { p_game_id: string }; Returns: Json }
      get_room_by_code: {
        Args: { p_code: string }
        Returns: {
          code: string
          expires_at: string
          host_id: string
          id: string
          members: number
          seats: number
          status: string
        }[]
      }
      is_participant: { Args: { p_game_id: string }; Returns: boolean }
      is_room_member: { Args: { p_room_id: string }; Returns: boolean }
      join_queue: { Args: never; Returns: undefined }
      join_room: { Args: { p_code: string }; Returns: string }
      leave_queue: { Args: never; Returns: undefined }
      leave_room: { Args: { p_room_id: string }; Returns: undefined }
      leave_room_game: { Args: { p_game_id: string }; Returns: undefined }
      rematch_room: { Args: { p_game_id: string }; Returns: string }
      reveal_tile: {
        Args: { p_color: number; p_game_id: string }
        Returns: undefined
      }
      start_game: { Args: { p_room_id: string }; Returns: string }
      start_practice_game: {
        Args: { p_bots: number; p_difficulty: string }
        Returns: string
      }
      touch_presence: { Args: { p_game_id: string }; Returns: undefined }
    }
    Enums: {
      clue_kind: "classify" | "compare"
      game_mode: "ranked" | "private" | "practice"
      game_status: "waiting" | "dealing" | "active" | "finished" | "cancelled"
      player_state: "active" | "eliminated" | "abandoned"
      tile_place: "reserve" | "support" | "pool" | "spent"
      turn_phase: "reveal" | "clue"
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
      clue_kind: ["classify", "compare"],
      game_mode: ["ranked", "private", "practice"],
      game_status: ["waiting", "dealing", "active", "finished", "cancelled"],
      player_state: ["active", "eliminated", "abandoned"],
      tile_place: ["reserve", "support", "pool", "spent"],
      turn_phase: ["reveal", "clue"],
    },
  },
} as const
