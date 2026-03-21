export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
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
      badges: {
        Row: {
          badge_key: string
          id: string
          unlocked_at: string
          user_id: string
        }
        Insert: {
          badge_key: string
          id?: string
          unlocked_at?: string
          user_id: string
        }
        Update: {
          badge_key?: string
          id?: string
          unlocked_at?: string
          user_id?: string
        }
        Relationships: []
      }
      bet_proposals: {
        Row: {
          bet_type: string
          category_id: string | null
          created_at: string
          ends_at: string | null
          id: string
          options: Json
          status: string
          title: string
          user_id: string
        }
        Insert: {
          bet_type: string
          category_id?: string | null
          created_at?: string
          ends_at?: string | null
          id?: string
          options?: Json
          status?: string
          title: string
          user_id: string
        }
        Update: {
          bet_type?: string
          category_id?: string | null
          created_at?: string
          ends_at?: string | null
          id?: string
          options?: Json
          status?: string
          title?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "bet_proposals_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
        ]
      }
      bets: {
        Row: {
          bet_count: number
          bet_type: string
          category_id: string | null
          created_at: string
          ends_at: string
          id: string
          is_active: boolean
          is_live: boolean
          options: Json
          title: string
          winning_option: string | null
        }
        Insert: {
          bet_count?: number
          bet_type: string
          category_id?: string | null
          created_at?: string
          ends_at: string
          id?: string
          is_active?: boolean
          is_live?: boolean
          options?: Json
          title: string
          winning_option?: string | null
        }
        Update: {
          bet_count?: number
          bet_type?: string
          category_id?: string | null
          created_at?: string
          ends_at?: string
          id?: string
          is_active?: boolean
          is_live?: boolean
          options?: Json
          title?: string
          winning_option?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "bets_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
        ]
      }
      categories: {
        Row: {
          color: string
          created_at: string
          emoji: string
          id: string
          name: string
          sort_order: number
        }
        Insert: {
          color?: string
          created_at?: string
          emoji?: string
          id?: string
          name: string
          sort_order?: number
        }
        Update: {
          color?: string
          created_at?: string
          emoji?: string
          id?: string
          name?: string
          sort_order?: number
        }
        Relationships: []
      }
      coupons: {
        Row: {
          created_at: string
          id: string
          payout: number | null
          stake: number
          stake_asset_fx_rate_to_pln: number | null
          stake_asset_id: string | null
          stake_asset_quantity: number | null
          stake_asset_symbol: string | null
          stake_asset_type:
            | Database["public"]["Enums"]["market_asset_type"]
            | null
          stake_asset_unit_price_pln: number | null
          status: string
          total_odds: number
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          payout?: number | null
          stake: number
          stake_asset_fx_rate_to_pln?: number | null
          stake_asset_id?: string | null
          stake_asset_quantity?: number | null
          stake_asset_symbol?: string | null
          stake_asset_type?:
            | Database["public"]["Enums"]["market_asset_type"]
            | null
          stake_asset_unit_price_pln?: number | null
          status?: string
          total_odds?: number
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          payout?: number | null
          stake?: number
          stake_asset_fx_rate_to_pln?: number | null
          stake_asset_id?: string | null
          stake_asset_quantity?: number | null
          stake_asset_symbol?: string | null
          stake_asset_type?:
            | Database["public"]["Enums"]["market_asset_type"]
            | null
          stake_asset_unit_price_pln?: number | null
          status?: string
          total_odds?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "coupons_stake_asset_id_fkey"
            columns: ["stake_asset_id"]
            isOneToOne: false
            referencedRelation: "market_assets"
            referencedColumns: ["id"]
          },
        ]
      }
      market_assets: {
        Row: {
          created_at: string
          display_name: string
          id: string
          is_active: boolean
          min_bet_pln: number
          quote_currency: string
          sort_order: number
          symbol: string
          type: Database["public"]["Enums"]["market_asset_type"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          display_name: string
          id?: string
          is_active?: boolean
          min_bet_pln?: number
          quote_currency: string
          sort_order?: number
          symbol: string
          type: Database["public"]["Enums"]["market_asset_type"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          display_name?: string
          id?: string
          is_active?: boolean
          min_bet_pln?: number
          quote_currency?: string
          sort_order?: number
          symbol?: string
          type?: Database["public"]["Enums"]["market_asset_type"]
          updated_at?: string
        }
        Relationships: []
      }
      market_quotes: {
        Row: {
          as_of: string
          asset_id: string
          high: number | null
          low: number | null
          open: number | null
          price: number
          provider: string
          quote_currency: string
          symbol: string
          updated_at: string
          volume: number | null
        }
        Insert: {
          as_of: string
          asset_id: string
          high?: number | null
          low?: number | null
          open?: number | null
          price: number
          provider?: string
          quote_currency: string
          symbol: string
          updated_at?: string
          volume?: number | null
        }
        Update: {
          as_of?: string
          asset_id?: string
          high?: number | null
          low?: number | null
          open?: number | null
          price?: number
          provider?: string
          quote_currency?: string
          symbol?: string
          updated_at?: string
          volume?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "market_quotes_asset_id_fkey"
            columns: ["asset_id"]
            isOneToOne: true
            referencedRelation: "market_assets"
            referencedColumns: ["id"]
          },
        ]
      }
      market_transactions: {
        Row: {
          asset_id: string
          created_at: string
          fee_pln: number
          fx_rate_to_pln: number
          gross_value_pln: number
          id: string
          net_value_pln: number
          quantity: number
          quote_currency: string
          side: Database["public"]["Enums"]["market_tx_side"]
          unit_price_pln: number
          user_id: string
        }
        Insert: {
          asset_id: string
          created_at?: string
          fee_pln?: number
          fx_rate_to_pln: number
          gross_value_pln: number
          id?: string
          net_value_pln: number
          quantity: number
          quote_currency: string
          side: Database["public"]["Enums"]["market_tx_side"]
          unit_price_pln: number
          user_id: string
        }
        Update: {
          asset_id?: string
          created_at?: string
          fee_pln?: number
          fx_rate_to_pln?: number
          gross_value_pln?: number
          id?: string
          net_value_pln?: number
          quantity?: number
          quote_currency?: string
          side?: Database["public"]["Enums"]["market_tx_side"]
          unit_price_pln?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "market_transactions_asset_id_fkey"
            columns: ["asset_id"]
            isOneToOne: false
            referencedRelation: "market_assets"
            referencedColumns: ["id"]
          },
        ]
      }
      placed_bets: {
        Row: {
          bet_id: string
          coupon_id: string | null
          created_at: string
          id: string
          odds_at_time: number
          payout: number | null
          result: string
          selected_option: string
          stake: number
          user_id: string
        }
        Insert: {
          bet_id: string
          coupon_id?: string | null
          created_at?: string
          id?: string
          odds_at_time: number
          payout?: number | null
          result?: string
          selected_option: string
          stake: number
          user_id: string
        }
        Update: {
          bet_id?: string
          coupon_id?: string | null
          created_at?: string
          id?: string
          odds_at_time?: number
          payout?: number | null
          result?: string
          selected_option?: string
          stake?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "placed_bets_bet_id_fkey"
            columns: ["bet_id"]
            isOneToOne: false
            referencedRelation: "bets"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          balance: number
          created_at: string
          current_streak: number
          id: string
          last_bet_date: string | null
          last_topup_at: string | null
          longest_streak: number
          username: string
        }
        Insert: {
          avatar_url?: string | null
          balance?: number
          created_at?: string
          current_streak?: number
          id: string
          last_bet_date?: string | null
          last_topup_at?: string | null
          longest_streak?: number
          username: string
        }
        Update: {
          avatar_url?: string | null
          balance?: number
          created_at?: string
          current_streak?: number
          id?: string
          last_bet_date?: string | null
          last_topup_at?: string | null
          longest_streak?: number
          username?: string
        }
        Relationships: []
      }
      social_comments: {
        Row: {
          content: string
          coupon_id: string | null
          created_at: string
          id: string
          parent_id: string | null
          post_id: string | null
          user_id: string
        }
        Insert: {
          content: string
          coupon_id?: string | null
          created_at?: string
          id?: string
          parent_id?: string | null
          post_id?: string | null
          user_id: string
        }
        Update: {
          content?: string
          coupon_id?: string | null
          created_at?: string
          id?: string
          parent_id?: string | null
          post_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "social_comments_coupon_id_fkey"
            columns: ["coupon_id"]
            isOneToOne: false
            referencedRelation: "coupons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "social_comments_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "social_comments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "social_comments_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "social_posts"
            referencedColumns: ["id"]
          },
        ]
      }
      social_posts: {
        Row: {
          content: string
          created_at: string
          id: string
          user_id: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          user_id?: string
        }
        Relationships: []
      }
      social_reactions: {
        Row: {
          comment_id: string | null
          coupon_id: string | null
          created_at: string
          emoji: Database["public"]["Enums"]["reaction_emoji"]
          id: string
          post_id: string | null
          user_id: string
        }
        Insert: {
          comment_id?: string | null
          coupon_id?: string | null
          created_at?: string
          emoji: Database["public"]["Enums"]["reaction_emoji"]
          id?: string
          post_id?: string | null
          user_id: string
        }
        Update: {
          comment_id?: string | null
          coupon_id?: string | null
          created_at?: string
          emoji?: Database["public"]["Enums"]["reaction_emoji"]
          id?: string
          post_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "social_reactions_comment_id_fkey"
            columns: ["comment_id"]
            isOneToOne: false
            referencedRelation: "social_comments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "social_reactions_coupon_id_fkey"
            columns: ["coupon_id"]
            isOneToOne: false
            referencedRelation: "coupons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "social_reactions_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "social_posts"
            referencedColumns: ["id"]
          },
        ]
      }
      user_notifications: {
        Row: {
          actor_user_id: string | null
          body: string | null
          created_at: string
          id: string
          is_read: boolean
          link_path: string | null
          metadata: Json
          read_at: string | null
          title: string
          type: Database["public"]["Enums"]["notification_type"]
          user_id: string
        }
        Insert: {
          actor_user_id?: string | null
          body?: string | null
          created_at?: string
          id?: string
          is_read?: boolean
          link_path?: string | null
          metadata?: Json
          read_at?: string | null
          title: string
          type: Database["public"]["Enums"]["notification_type"]
          user_id: string
        }
        Update: {
          actor_user_id?: string | null
          body?: string | null
          created_at?: string
          id?: string
          is_read?: boolean
          link_path?: string | null
          metadata?: Json
          read_at?: string | null
          title?: string
          type?: Database["public"]["Enums"]["notification_type"]
          user_id?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
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
      add_social_comment: {
        Args: {
          p_content: string
          p_coupon_id?: string
          p_parent_id?: string
          p_post_id?: string
          p_user_id: string
        }
        Returns: string
      }
      admin_credit_balance: {
        Args: { p_amount: number; p_user_id: string }
        Returns: number
      }
      admin_credit_market_asset: {
        Args: {
          p_asset_id: string
          p_quantity: number
          p_unit_price_pln: number
          p_user_id: string
        }
        Returns: number
      }
      award_badge: {
        Args: { p_badge_key: string; p_user_id: string }
        Returns: undefined
      }
      backfill_streaks_and_badges: { Args: never; Returns: undefined }
      create_social_post: {
        Args: { p_content: string; p_user_id: string }
        Returns: string
      }
      create_user_notification: {
        Args: {
          p_actor_user_id?: string
          p_body?: string
          p_link_path?: string
          p_metadata?: Json
          p_title: string
          p_type: Database["public"]["Enums"]["notification_type"]
          p_user_id: string
        }
        Returns: string
      }
      disable_market_data_refresh_cron: { Args: never; Returns: undefined }
      extract_mentioned_usernames: {
        Args: { p_content: string }
        Returns: string[]
      }
      get_comments_for_target: {
        Args: { p_coupon_id?: string; p_post_id?: string; p_user_id?: string }
        Returns: Json
      }
      get_market_asset_position_qty: {
        Args: { p_asset_id: string; p_user_id: string }
        Returns: number
      }
      get_public_profile: { Args: { p_user_id: string }; Returns: Json }
      get_rankings_asset_coupon_exposure: {
        Args: never
        Returns: {
          is_won: boolean
          odds: number
          quantity: number
          quote_currency: string
          symbol: string
          user_id: string
        }[]
      }
      get_reactors_for_target: {
        Args: {
          p_comment_id?: string
          p_coupon_id?: string
          p_emoji?: Database["public"]["Enums"]["reaction_emoji"]
          p_post_id?: string
        }
        Returns: Json
      }
      get_social_coupon_feed: {
        Args: { p_limit?: number; p_offset?: number }
        Returns: Json
      }
      get_social_feed: {
        Args: { p_limit?: number; p_offset?: number; p_user_id?: string }
        Returns: Json
      }
      get_social_feed_item: {
        Args: { p_item_id: string; p_item_type: string; p_user_id?: string }
        Returns: Json
      }
      get_unread_notifications_count: {
        Args: { p_user_id: string }
        Returns: number
      }
      get_user_coupon_history: {
        Args: { p_limit?: number; p_offset?: number; p_user_id: string }
        Returns: Json
      }
      get_user_notifications: {
        Args: { p_limit?: number; p_offset?: number; p_user_id: string }
        Returns: Json
      }
      get_user_rankings: {
        Args: never
        Returns: {
          balance: number
          id: string
          lost_bets: number
          total_bets: number
          total_profit: number
          username: string
          win_rate: number
          won_bets: number
        }[]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      mark_all_notifications_read: {
        Args: { p_user_id: string }
        Returns: number
      }
      mark_notification_read: {
        Args: { p_notification_id: string; p_user_id: string }
        Returns: boolean
      }
      place_bet_secure:
        | {
            Args: {
              p_items: Json
              p_stake: number
              p_total_odds: number
              p_user_id: string
            }
            Returns: string
          }
        | {
            Args: {
              p_items: Json
              p_stake: number
              p_stake_asset?: Json
              p_total_odds: number
              p_user_id: string
            }
            Returns: string
          }
      place_market_order_secure: {
        Args: {
          p_asset_id: string
          p_fx_rate_to_pln: number
          p_quantity: number
          p_quote_currency: string
          p_side: Database["public"]["Enums"]["market_tx_side"]
          p_unit_price: number
          p_user_id: string
        }
        Returns: number
      }
      search_market_assets: {
        Args: { p_limit?: number; p_query: string }
        Returns: {
          created_at: string
          display_name: string
          id: string
          is_active: boolean
          min_bet_pln: number
          quote_currency: string
          sort_order: number
          symbol: string
          type: Database["public"]["Enums"]["market_asset_type"]
          updated_at: string
        }[]
      }
      search_mention_users: {
        Args: { p_current_user_id?: string; p_limit?: number; p_query: string }
        Returns: Json
      }
      secure_daily_topup: { Args: { p_user_id: string }; Returns: number }
      setup_market_data_refresh_cron: {
        Args: { p_anon_key: string; p_project_url: string; p_schedule?: string }
        Returns: undefined
      }
      setup_market_data_refresh_cron_profile: {
        Args: {
          p_anon_key: string
          p_offpeak_step_hours?: number
          p_peak_end_hour?: number
          p_peak_start_hour?: number
          p_project_url: string
        }
        Returns: {
          estimated_runs_per_day: number
          offpeak_schedule: string
          peak_schedule: string
        }[]
      }
      toggle_reaction: {
        Args: {
          p_comment_id?: string
          p_coupon_id?: string
          p_emoji: Database["public"]["Enums"]["reaction_emoji"]
          p_post_id?: string
          p_user_id: string
        }
        Returns: string
      }
    }
    Enums: {
      app_role: "admin" | "user"
      market_asset_type: "stock" | "etf" | "crypto" | "forex" | "commodity"
      market_tx_side: "buy" | "sell" | "bet_stake"
      notification_type:
        | "mention_post"
        | "mention_comment"
        | "coupon_won"
        | "comment_post"
      reaction_emoji:
        | "like"
        | "heart"
        | "laugh"
        | "wow"
        | "sad"
        | "angry"
        | "fire"
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
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {
      app_role: ["admin", "user"],
      market_asset_type: ["stock", "etf", "crypto", "forex", "commodity"],
      market_tx_side: ["buy", "sell", "bet_stake"],
      notification_type: [
        "mention_post",
        "mention_comment",
        "coupon_won",
        "comment_post",
      ],
      reaction_emoji: ["like", "heart", "laugh", "wow", "sad", "angry", "fire"],
    },
  },
} as const

