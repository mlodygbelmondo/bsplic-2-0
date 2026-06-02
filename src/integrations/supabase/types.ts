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
    PostgrestVersion: "14.4"
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
          agent_duplicate_key: string | null
          agent_metadata: Json
          proposal_source: string
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
          agent_duplicate_key?: string | null
          agent_metadata?: Json
          proposal_source?: string
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
          agent_duplicate_key?: string | null
          agent_metadata?: Json
          proposal_source?: string
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
          is_bsplicboost: boolean
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
          is_bsplicboost?: boolean
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
          is_bsplicboost?: boolean
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
      bonus_campaign_claims: {
        Row: {
          amount: number
          balance_after: number
          campaign_id: string
          claimed_at: string
          id: string
          user_id: string
        }
        Insert: {
          amount: number
          balance_after: number
          campaign_id: string
          claimed_at?: string
          id?: string
          user_id: string
        }
        Update: {
          amount?: number
          balance_after?: number
          campaign_id?: string
          claimed_at?: string
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "bonus_campaign_claims_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "bonus_campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bonus_campaign_claims_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      bonus_campaigns: {
        Row: {
          amount: number
          created_at: string
          description: string
          expires_at: string
          id: string
          is_active: boolean
          starts_at: string
          title: string
          updated_at: string
        }
        Insert: {
          amount: number
          created_at?: string
          description: string
          expires_at: string
          id?: string
          is_active?: boolean
          starts_at: string
          title: string
          updated_at?: string
        }
        Update: {
          amount?: number
          created_at?: string
          description?: string
          expires_at?: string
          id?: string
          is_active?: boolean
          starts_at?: string
          title?: string
          updated_at?: string
        }
        Relationships: []
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
          status: string
          total_odds: number
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          payout?: number | null
          stake: number
          status?: string
          total_odds?: number
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          payout?: number | null
          stake?: number
          status?: string
          total_odds?: number
          user_id?: string
        }
        Relationships: []
      }
      casino_rounds: {
        Row: {
          balance_after: number
          bet_type: string
          bet_value: string
          created_at: string
          game_key: string
          id: string
          payout: number
          stake: number
          user_id: string
          winning_color: string
          winning_number: number
        }
        Insert: {
          balance_after: number
          bet_type: string
          bet_value: string
          created_at?: string
          game_key?: string
          id?: string
          payout?: number
          stake: number
          user_id: string
          winning_color: string
          winning_number: number
        }
        Update: {
          balance_after?: number
          bet_type?: string
          bet_value?: string
          created_at?: string
          game_key?: string
          id?: string
          payout?: number
          stake?: number
          user_id?: string
          winning_color?: string
          winning_number?: number
        }
        Relationships: []
      }
      casino_blackjack_games: {
        Row: {
          active_hand_index: number
          created_at: string
          deck: Json
          dealer_hand: Json
          double_down_used: boolean
          hand_number: number | null
          id: string
          initial_stake: number
          insurance_payout: number
          insurance_stake: number
          insurance_status: string
          payout: number
          player_hand: Json
          player_hands: Json
          settled_at: string | null
          shoe_number: number | null
          stake: number
          status: string
          table_id: string | null
          user_id: string
        }
        Insert: {
          active_hand_index?: number
          created_at?: string
          deck?: Json
          dealer_hand?: Json
          double_down_used?: boolean
          hand_number?: number | null
          id?: string
          initial_stake: number
          insurance_payout?: number
          insurance_stake?: number
          insurance_status?: string
          payout?: number
          player_hand?: Json
          player_hands?: Json
          settled_at?: string | null
          shoe_number?: number | null
          stake: number
          status: string
          table_id?: string | null
          user_id: string
        }
        Update: {
          active_hand_index?: number
          created_at?: string
          deck?: Json
          dealer_hand?: Json
          double_down_used?: boolean
          hand_number?: number | null
          id?: string
          initial_stake?: number
          insurance_payout?: number
          insurance_stake?: number
          insurance_status?: string
          payout?: number
          player_hand?: Json
          player_hands?: Json
          settled_at?: string | null
          shoe_number?: number | null
          stake?: number
          status?: string
          table_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "casino_blackjack_games_table_id_fkey"
            columns: ["table_id"]
            isOneToOne: false
            referencedRelation: "casino_blackjack_tables"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "casino_blackjack_games_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      casino_blackjack_tables: {
        Row: {
          created_at: string
          deck_count: number
          hands_played: number
          id: string
          last_shuffled_at: string | null
          shoe: Json
          shoe_number: number
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          deck_count?: number
          hands_played?: number
          id?: string
          last_shuffled_at?: string | null
          shoe?: Json
          shoe_number?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          deck_count?: number
          hands_played?: number
          id?: string
          last_shuffled_at?: string | null
          shoe?: Json
          shoe_number?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "casino_blackjack_tables_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      casino_roulette_bets: {
        Row: {
          bet_type: string
          bet_value: string
          created_at: string
          id: string
          is_win: boolean | null
          payout: number
          round_id: string
          settled_at: string | null
          stake: number
          user_id: string
        }
        Insert: {
          bet_type: string
          bet_value: string
          created_at?: string
          id?: string
          is_win?: boolean | null
          payout?: number
          round_id: string
          settled_at?: string | null
          stake: number
          user_id: string
        }
        Update: {
          bet_type?: string
          bet_value?: string
          created_at?: string
          id?: string
          is_win?: boolean | null
          payout?: number
          round_id?: string
          settled_at?: string | null
          stake?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "casino_roulette_bets_round_id_fkey"
            columns: ["round_id"]
            isOneToOne: false
            referencedRelation: "casino_roulette_rounds"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "casino_roulette_bets_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      casino_roulette_rounds: {
        Row: {
          betting_closes_at: string
          betting_opens_at: string
          created_at: string
          id: string
          phase: string
          round_number: number
          settled_at: string | null
          spin_started_at: string | null
          table_key: string
          winning_color: string | null
          winning_number: number | null
        }
        Insert: {
          betting_closes_at: string
          betting_opens_at: string
          created_at?: string
          id?: string
          phase: string
          round_number: number
          settled_at?: string | null
          spin_started_at?: string | null
          table_key?: string
          winning_color?: string | null
          winning_number?: number | null
        }
        Update: {
          betting_closes_at?: string
          betting_opens_at?: string
          created_at?: string
          id?: string
          phase?: string
          round_number?: number
          settled_at?: string | null
          spin_started_at?: string | null
          table_key?: string
          winning_color?: string | null
          winning_number?: number | null
        }
        Relationships: []
      }
      casino_social_shares: {
        Row: {
          casino_bet_type: string
          casino_bet_value: string
          casino_payout: number
          casino_round_number: number | null
          casino_stake: number
          casino_winning_color: string | null
          casino_winning_number: number | null
          content: string
          created_at: string
          id: string
          roulette_bet_id: string | null
          user_id: string
        }
        Insert: {
          casino_bet_type: string
          casino_bet_value: string
          casino_payout: number
          casino_round_number?: number | null
          casino_stake: number
          casino_winning_color?: string | null
          casino_winning_number?: number | null
          content: string
          created_at?: string
          id?: string
          roulette_bet_id?: string | null
          user_id: string
        }
        Update: {
          casino_bet_type?: string
          casino_bet_value?: string
          casino_payout?: number
          casino_round_number?: number | null
          casino_stake?: number
          casino_winning_color?: string | null
          casino_winning_number?: number | null
          content?: string
          created_at?: string
          id?: string
          roulette_bet_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "casino_social_shares_roulette_bet_id_fkey"
            columns: ["roulette_bet_id"]
            isOneToOne: false
            referencedRelation: "casino_roulette_bets"
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
      admin_credit_balance: {
        Args: { p_amount: number; p_user_id: string }
        Returns: number
      }
      admin_settle_bet: {
        Args: {
          p_bet_id: string
          p_mode?: string
          p_scope?: string
          p_winning_options?: string[]
        }
        Returns: Json
      }
      agent_create_bet_proposals: {
        Args: { p_proposals: Json; p_token: string }
        Returns: Json
      }
      agent_get_bet_context: {
        Args: {
          p_history_limit?: number
          p_recent_bet_limit?: number
          p_token: string
        }
        Returns: Json
      }
      agent_get_pending_settlement_context: {
        Args: { p_limit?: number; p_token: string }
        Returns: Json
      }
      agent_settle_bet: {
        Args: {
          p_bet_id: string
          p_mode?: string
          p_scope?: string
          p_token: string
          p_winning_options?: string[]
        }
        Returns: Json
      }
      award_badge: {
        Args: { p_badge_key: string; p_user_id: string }
        Returns: undefined
      }
      backfill_streaks_and_badges: { Args: never; Returns: undefined }
      get_public_profile: {
        Args: { p_user_id: string }
        Returns: Json
      }
      get_public_badges: {
        Args: { p_user_id: string }
        Returns: Json
      }
      get_social_coupon_feed: {
        Args: { p_limit?: number; p_offset?: number }
        Returns: Json
      }
      get_user_coupon_history: {
        Args: { p_user_id: string; p_limit?: number; p_offset?: number }
        Returns: Json
      }
      get_user_casino_history: {
        Args: { p_user_id: string; p_limit?: number; p_offset?: number }
        Returns: {
          bet_label: string
          created_at: string
          game_type: string
          id: string
          payout: number
          round_label: string | null
          stake: number
          status: string
        }[]
      }
      get_casino_rankings: {
        Args: Record<PropertyKey, never>
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
      create_casino_social_share: {
        Args: {
          p_casino_bet_type: string
          p_casino_bet_value: string
          p_casino_payout: number
          p_casino_round_number?: number | null
          p_casino_stake: number
          p_casino_winning_color?: string | null
          p_casino_winning_number?: number | null
          p_content: string
          p_roulette_bet_id: string
          p_user_id: string
        }
        Returns: string
      }
      get_user_rankings: {
        Args: Record<PropertyKey, never>
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
      place_bet_secure: {
        Args: {
          p_items: Json
          p_stake: number
          p_total_odds: number
          p_user_id: string
        }
        Returns: string
      }
      play_roulette_round: {
        Args: {
          p_bet_type: string
          p_bet_value: string
          p_stake: number
          p_user_id: string
        }
        Returns: {
          balance_after: number
          bet_type: string
          bet_value: string
          created_at: string
          id: string
          is_win: boolean
          net_change: number
          payout: number
          stake: number
          winning_color: string
          winning_number: number
        }[]
      }
      advance_roulette_round_if_due: {
        Args: { p_table_key?: string }
        Returns: undefined
      }
      get_current_roulette_round: {
        Args: { p_table_key?: string }
        Returns: {
          betting_closes_at: string
          betting_opens_at: string
          created_at: string
          id: string
          phase: string
          round_number: number
          settled_at: string | null
          spin_started_at: string | null
          table_key: string
          winning_color: string | null
          winning_number: number | null
        }[]
      }
      get_my_current_roulette_bets: {
        Args: { p_round_id: string }
        Returns: {
          bet_type: string
          bet_value: string
          created_at: string
          id: string
          is_win: boolean | null
          payout: number
          round_id: string
          settled_at: string | null
          stake: number
          user_id: string
        }[]
      }
      get_roulette_round_participants: {
        Args: { p_round_id: string }
        Returns: {
          avatar_url: string | null
          bet_count: number
          bets: Json
          total_stake: number
          user_id: string
          username: string
        }[]
      }
      get_recent_roulette_spins: {
        Args: { p_limit?: number; p_table_key?: string }
        Returns: {
          betting_closes_at: string
          betting_opens_at: string
          created_at: string
          id: string
          phase: string
          round_number: number
          settled_at: string | null
          spin_started_at: string | null
          table_key: string
          winning_color: string | null
          winning_number: number | null
        }[]
      }
      get_recent_roulette_wins: {
        Args: { p_limit?: number; p_table_key?: string }
        Returns: {
          avatar_url: string | null
          bet_type: string
          bet_value: string
          created_at: string
          id: string
          is_win: boolean | null
          payout: number
          round_id: string
          round_number: number
          settled_at: string | null
          stake: number
          user_id: string
          username: string
        }[]
      }
      place_roulette_bet: {
        Args: {
          p_bet_type: string
          p_bet_value: string
          p_round_id: string
          p_stake: number
          p_user_id: string
        }
        Returns: {
          bet_type: string
          bet_value: string
          created_at: string
          id: string
          is_win: boolean | null
          payout: number
          round_id: string
          settled_at: string | null
          stake: number
          user_id: string
        }[]
      }
      claim_bonus_campaign: {
        Args: { p_campaign_id: string }
        Returns: {
          amount: number
          balance_after: number
          campaign_id: string
          claimed_at: string
        }[]
      }
      get_available_bonus_campaigns: {
        Args: Record<PropertyKey, never>
        Returns: {
          amount: number
          description: string
          expires_at: string
          id: string
          starts_at: string
          title: string
        }[]
      }
      secure_daily_topup: {
        Args: { p_user_id: string }
        Returns: number
      }
      place_blackjack_bet: {
        Args: { p_stake: number; p_user_id: string }
        Returns: {
          id: string
          stake: number
          initial_stake: number
          status: string
          player_hand: Json
          player_hands: Json
          active_hand_index: number
          dealer_hand: Json
          payout: number
          double_down_used: boolean
          deck_count: number
          cards_remaining: number
          shoe_number: number
          dealer_hidden_count: number
          created_at: string
          insurance_status: string
          insurance_stake: number
          insurance_payout: number
        }[]
      }
      blackjack_hit: {
        Args: { p_game_id: string; p_user_id: string }
        Returns: {
          id: string
          stake: number
          initial_stake: number
          status: string
          player_hand: Json
          player_hands: Json
          active_hand_index: number
          dealer_hand: Json
          payout: number
          double_down_used: boolean
          deck_count: number
          cards_remaining: number
          shoe_number: number
          dealer_hidden_count: number
          created_at: string
          insurance_status: string
          insurance_stake: number
          insurance_payout: number
        }[]
      }
      blackjack_stand: {
        Args: { p_game_id: string; p_user_id: string }
        Returns: {
          id: string
          stake: number
          initial_stake: number
          status: string
          player_hand: Json
          player_hands: Json
          active_hand_index: number
          dealer_hand: Json
          payout: number
          double_down_used: boolean
          deck_count: number
          cards_remaining: number
          shoe_number: number
          dealer_hidden_count: number
          created_at: string
          insurance_status: string
          insurance_stake: number
          insurance_payout: number
        }[]
      }
      blackjack_double_down: {
        Args: { p_game_id: string; p_user_id: string }
        Returns: {
          id: string
          stake: number
          initial_stake: number
          status: string
          player_hand: Json
          player_hands: Json
          active_hand_index: number
          dealer_hand: Json
          payout: number
          double_down_used: boolean
          deck_count: number
          cards_remaining: number
          shoe_number: number
          dealer_hidden_count: number
          created_at: string
          insurance_status: string
          insurance_stake: number
          insurance_payout: number
        }[]
      }
      blackjack_split: {
        Args: { p_game_id: string; p_user_id: string }
        Returns: {
          id: string
          stake: number
          initial_stake: number
          status: string
          player_hand: Json
          player_hands: Json
          active_hand_index: number
          dealer_hand: Json
          payout: number
          double_down_used: boolean
          deck_count: number
          cards_remaining: number
          shoe_number: number
          dealer_hidden_count: number
          created_at: string
          insurance_status: string
          insurance_stake: number
          insurance_payout: number
        }[]
      }
      blackjack_take_insurance: {
        Args: { p_game_id: string; p_user_id: string }
        Returns: {
          id: string
          stake: number
          initial_stake: number
          status: string
          player_hand: Json
          player_hands: Json
          active_hand_index: number
          dealer_hand: Json
          payout: number
          double_down_used: boolean
          deck_count: number
          cards_remaining: number
          shoe_number: number
          dealer_hidden_count: number
          created_at: string
          insurance_status: string
          insurance_stake: number
          insurance_payout: number
        }[]
      }
      blackjack_decline_insurance: {
        Args: { p_game_id: string; p_user_id: string }
        Returns: {
          id: string
          stake: number
          initial_stake: number
          status: string
          player_hand: Json
          player_hands: Json
          active_hand_index: number
          dealer_hand: Json
          payout: number
          double_down_used: boolean
          deck_count: number
          cards_remaining: number
          shoe_number: number
          dealer_hidden_count: number
          created_at: string
          insurance_status: string
          insurance_stake: number
          insurance_payout: number
        }[]
      }
      get_blackjack_table_info: {
        Args: { p_user_id: string }
        Returns: {
          deck_count: number
          cards_remaining: number
          shoe_number: number
          hands_played: number
          needs_shuffle: boolean
        }[]
      }
      get_current_blackjack_game: {
        Args: { p_user_id: string }
        Returns: {
          id: string
          stake: number
          initial_stake: number
          status: string
          player_hand: Json
          player_hands: Json
          active_hand_index: number
          dealer_hand: Json
          payout: number
          double_down_used: boolean
          deck_count: number
          cards_remaining: number
          shoe_number: number
          dealer_hidden_count: number
          created_at: string
          insurance_status: string
          insurance_stake: number
          insurance_payout: number
        }[]
      }
    }
    Enums: {
      app_role: "admin" | "user"
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
    },
  },
} as const
