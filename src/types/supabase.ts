export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          username: string;
          avatar_id: string;
          avatar_color: string;
          created_at: string;
          updated_at: string;
          xp: number;
          level: number;
          unlocked_badges: string[];
        };
        Insert: {
          id?: string;
          username: string;
          avatar_id?: string;
          avatar_color?: string;
          created_at?: string;
          updated_at?: string;
          xp?: number;
          level?: number;
          unlocked_badges?: string[];
        };
        Update: {
          id?: string;
          username?: string;
          avatar_id?: string;
          avatar_color?: string;
          created_at?: string;
          updated_at?: string;
          xp?: number;
          level?: number;
          unlocked_badges?: string[];
        };
      };
      user_records: {
        Row: {
          id: string;
          profile_id: string;
          game_mode: string;
          max_score: number;
          best_time_seconds: number | null;
          games_played: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          profile_id: string;
          game_mode: string;
          max_score?: number;
          best_time_seconds?: number | null;
          games_played?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          profile_id?: string;
          game_mode?: string;
          max_score?: number;
          best_time_seconds?: number | null;
          games_played?: number;
          created_at?: string;
          updated_at?: string;
        };
      };
      leaderboards: {
        Row: {
          id: string;
          profile_id: string;
          game_mode: string;
          score: number;
          time_spent_seconds: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          profile_id: string;
          game_mode: string;
          score: number;
          time_spent_seconds: number;
          created_at?: string;
        };
        Update: {
          id?: string;
          profile_id?: string;
          game_mode?: string;
          score?: number;
          time_spent_seconds?: number;
          created_at?: string;
        };
      };
    };
  };
}
