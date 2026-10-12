// Generated from the Supabase project schema (Supabase MCP generate_typescript_types).
// Regenerate after schema changes rather than editing by hand.

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5";
  };
  public: {
    Tables: {
      canned_responses: {
        Row: {
          agent_id: string;
          body: string;
          created_at: string;
          id: number;
          title: string;
        };
        Insert: {
          agent_id: string;
          body: string;
          created_at?: string;
          id?: never;
          title: string;
        };
        Update: {
          agent_id?: string;
          body?: string;
          created_at?: string;
          id?: never;
          title?: string;
        };
        Relationships: [
          {
            foreignKeyName: "canned_responses_agent_id_fkey";
            columns: ["agent_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      knowledge_chunks: {
        Row: {
          category: Database["public"]["Enums"]["ticket_category"] | null;
          content: string;
          created_at: string;
          embedding: string;
          id: number;
          source_id: number;
          source_type: string;
        };
        Insert: {
          category?: Database["public"]["Enums"]["ticket_category"] | null;
          content: string;
          created_at?: string;
          embedding: string;
          id?: never;
          source_id: number;
          source_type: string;
        };
        Update: {
          category?: Database["public"]["Enums"]["ticket_category"] | null;
          content?: string;
          created_at?: string;
          embedding?: string;
          id?: never;
          source_id?: number;
          source_type?: string;
        };
        Relationships: [];
      };
      profiles: {
        Row: {
          created_at: string;
          full_name: string;
          id: string;
          role: Database["public"]["Enums"]["user_role"];
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          full_name: string;
          id: string;
          role?: Database["public"]["Enums"]["user_role"];
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          full_name?: string;
          id?: string;
          role?: Database["public"]["Enums"]["user_role"];
          updated_at?: string;
        };
        Relationships: [];
      };
      sla_policies: {
        Row: {
          first_response_minutes: number;
          id: number;
          priority: Database["public"]["Enums"]["ticket_priority"];
        };
        Insert: {
          first_response_minutes: number;
          id?: never;
          priority: Database["public"]["Enums"]["ticket_priority"];
        };
        Update: {
          first_response_minutes?: number;
          id?: never;
          priority?: Database["public"]["Enums"]["ticket_priority"];
        };
        Relationships: [];
      };
      ticket_attachments: {
        Row: {
          created_at: string;
          file_name: string;
          id: number;
          message_id: number | null;
          mime_type: string | null;
          size_bytes: number | null;
          storage_path: string;
          ticket_id: number;
          uploaded_by: string | null;
        };
        Insert: {
          created_at?: string;
          file_name: string;
          id?: never;
          message_id?: number | null;
          mime_type?: string | null;
          size_bytes?: number | null;
          storage_path: string;
          ticket_id: number;
          uploaded_by?: string | null;
        };
        Update: {
          created_at?: string;
          file_name?: string;
          id?: never;
          message_id?: number | null;
          mime_type?: string | null;
          size_bytes?: number | null;
          storage_path?: string;
          ticket_id?: number;
          uploaded_by?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "ticket_attachments_message_id_fkey";
            columns: ["message_id"];
            isOneToOne: false;
            referencedRelation: "ticket_messages";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "ticket_attachments_ticket_id_fkey";
            columns: ["ticket_id"];
            isOneToOne: false;
            referencedRelation: "tickets";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "ticket_attachments_uploaded_by_fkey";
            columns: ["uploaded_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      ticket_messages: {
        Row: {
          author_id: string | null;
          body: string;
          created_at: string;
          id: number;
          is_internal_note: boolean;
          ticket_id: number;
        };
        Insert: {
          author_id?: string | null;
          body: string;
          created_at?: string;
          id?: never;
          is_internal_note?: boolean;
          ticket_id: number;
        };
        Update: {
          author_id?: string | null;
          body?: string;
          created_at?: string;
          id?: never;
          is_internal_note?: boolean;
          ticket_id?: number;
        };
        Relationships: [
          {
            foreignKeyName: "ticket_messages_author_id_fkey";
            columns: ["author_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "ticket_messages_ticket_id_fkey";
            columns: ["ticket_id"];
            isOneToOne: false;
            referencedRelation: "tickets";
            referencedColumns: ["id"];
          },
        ];
      };
      ticket_status_events: {
        Row: {
          changed_by: string | null;
          created_at: string;
          from_status: Database["public"]["Enums"]["ticket_status"] | null;
          id: number;
          ticket_id: number;
          to_status: Database["public"]["Enums"]["ticket_status"];
        };
        Insert: {
          changed_by?: string | null;
          created_at?: string;
          from_status?: Database["public"]["Enums"]["ticket_status"] | null;
          id?: never;
          ticket_id: number;
          to_status: Database["public"]["Enums"]["ticket_status"];
        };
        Update: {
          changed_by?: string | null;
          created_at?: string;
          from_status?: Database["public"]["Enums"]["ticket_status"] | null;
          id?: never;
          ticket_id?: number;
          to_status?: Database["public"]["Enums"]["ticket_status"];
        };
        Relationships: [
          {
            foreignKeyName: "ticket_status_events_changed_by_fkey";
            columns: ["changed_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "ticket_status_events_ticket_id_fkey";
            columns: ["ticket_id"];
            isOneToOne: false;
            referencedRelation: "tickets";
            referencedColumns: ["id"];
          },
        ];
      };
      tickets: {
        Row: {
          assigned_agent_id: string | null;
          category: Database["public"]["Enums"]["ticket_category"];
          created_at: string;
          customer_id: string;
          first_response_at: string | null;
          id: number;
          order_reference: string | null;
          priority: Database["public"]["Enums"]["ticket_priority"];
          resolved_at: string | null;
          status: Database["public"]["Enums"]["ticket_status"];
          subject: string;
          triaged_at: string | null;
          updated_at: string;
        };
        Insert: {
          assigned_agent_id?: string | null;
          category: Database["public"]["Enums"]["ticket_category"];
          created_at?: string;
          customer_id: string;
          first_response_at?: string | null;
          id?: never;
          order_reference?: string | null;
          priority?: Database["public"]["Enums"]["ticket_priority"];
          resolved_at?: string | null;
          status?: Database["public"]["Enums"]["ticket_status"];
          subject: string;
          triaged_at?: string | null;
          updated_at?: string;
        };
        Update: {
          assigned_agent_id?: string | null;
          category?: Database["public"]["Enums"]["ticket_category"];
          created_at?: string;
          customer_id?: string;
          first_response_at?: string | null;
          id?: never;
          order_reference?: string | null;
          priority?: Database["public"]["Enums"]["ticket_priority"];
          resolved_at?: string | null;
          status?: Database["public"]["Enums"]["ticket_status"];
          subject?: string;
          triaged_at?: string | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "tickets_assigned_agent_id_fkey";
            columns: ["assigned_agent_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "tickets_customer_id_fkey";
            columns: ["customer_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      admin_analytics: {
        Args: { p_days?: number };
        Returns: Json;
      };
      match_knowledge_chunks: {
        Args: {
          match_category?: Database["public"]["Enums"]["ticket_category"];
          match_count?: number;
          min_similarity?: number;
          query_embedding: string;
        };
        Returns: {
          canned_title: string;
          category: Database["public"]["Enums"]["ticket_category"];
          content: string;
          id: number;
          similarity: number;
          source_id: number;
          source_type: string;
          ticket_id: number;
        }[];
      };
    };
    Enums: {
      ticket_category:
        | "order_delivery"
        | "returns_refunds"
        | "payments"
        | "account"
        | "product_question";
      ticket_priority: "low" | "normal" | "high" | "urgent";
      ticket_status: "new" | "in_progress" | "waiting_on_customer" | "resolved";
      user_role: "customer" | "agent" | "admin";
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type PublicSchema = Database["public"];

export type Tables<T extends keyof PublicSchema["Tables"]> =
  PublicSchema["Tables"][T]["Row"];
export type TablesInsert<T extends keyof PublicSchema["Tables"]> =
  PublicSchema["Tables"][T]["Insert"];
export type TablesUpdate<T extends keyof PublicSchema["Tables"]> =
  PublicSchema["Tables"][T]["Update"];
export type Enums<T extends keyof PublicSchema["Enums"]> =
  PublicSchema["Enums"][T];

export const Constants = {
  public: {
    Enums: {
      ticket_category: [
        "order_delivery",
        "returns_refunds",
        "payments",
        "account",
        "product_question",
      ],
      ticket_priority: ["low", "normal", "high", "urgent"],
      ticket_status: ["new", "in_progress", "waiting_on_customer", "resolved"],
      user_role: ["customer", "agent", "admin"],
    },
  },
} as const;
