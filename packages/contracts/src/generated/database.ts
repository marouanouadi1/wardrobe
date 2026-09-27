// GENERATO da `supabase gen types typescript --local`: npm run supabase:tipi.
// Non si modifica a mano. La fonte è lo schema in supabase/migrations/ (ADR 0010).

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
      analisi_esiti: {
        Row: {
          aggiornato_il: string
          capo_id: string | null
          creato_il: string
          errore: string | null
          id: string
          stato: Database["public"]["Enums"]["stato_analisi"]
          utente_id: string
        }
        Insert: {
          aggiornato_il?: string
          capo_id?: string | null
          creato_il?: string
          errore?: string | null
          id?: string
          stato?: Database["public"]["Enums"]["stato_analisi"]
          utente_id?: string
        }
        Update: {
          aggiornato_il?: string
          capo_id?: string | null
          creato_il?: string
          errore?: string | null
          id?: string
          stato?: Database["public"]["Enums"]["stato_analisi"]
          utente_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "analisi_esiti_utente_id_capo_id_fkey"
            columns: ["utente_id", "capo_id"]
            isOneToOne: false
            referencedRelation: "capi"
            referencedColumns: ["utente_id", "id"]
          },
        ]
      }
      capi: {
        Row: {
          aggiornato_il: string
          analisi_eseguita_il: string | null
          analisi_modello: string | null
          analisi_note: string | null
          analisi_provider: string | null
          appunti: string | null
          brand: string | null
          colore_hex: string
          colore_nome: string
          confidenze: Json
          corretti_a_mano: Database["public"]["Enums"]["attributo_capo"][]
          creato_il: string
          etichette: string[]
          fantasia: string | null
          foto_altezza: number | null
          foto_larghezza: number | null
          foto_percorso: string
          foto_scontornata_percorso: string | null
          id: string
          lavaggio: string | null
          materiale: string | null
          nome: string
          preferito: boolean
          slot: Database["public"]["Enums"]["slot_avatar"]
          sottotipo: string | null
          stagione: Database["public"]["Enums"]["stagione"] | null
          stato: Database["public"]["Enums"]["stato_capo"]
          tipo: Database["public"]["Enums"]["tipo_capo"]
          ultimo_uso: string | null
          utente_id: string
          vestibilita: string | null
          volte_indossato: number
        }
        Insert: {
          aggiornato_il?: string
          analisi_eseguita_il?: string | null
          analisi_modello?: string | null
          analisi_note?: string | null
          analisi_provider?: string | null
          appunti?: string | null
          brand?: string | null
          colore_hex: string
          colore_nome: string
          confidenze?: Json
          corretti_a_mano?: Database["public"]["Enums"]["attributo_capo"][]
          creato_il?: string
          etichette?: string[]
          fantasia?: string | null
          foto_altezza?: number | null
          foto_larghezza?: number | null
          foto_percorso: string
          foto_scontornata_percorso?: string | null
          id?: string
          lavaggio?: string | null
          materiale?: string | null
          nome: string
          preferito?: boolean
          slot?: Database["public"]["Enums"]["slot_avatar"]
          sottotipo?: string | null
          stagione?: Database["public"]["Enums"]["stagione"] | null
          stato?: Database["public"]["Enums"]["stato_capo"]
          tipo: Database["public"]["Enums"]["tipo_capo"]
          ultimo_uso?: string | null
          utente_id?: string
          vestibilita?: string | null
          volte_indossato?: number
        }
        Update: {
          aggiornato_il?: string
          analisi_eseguita_il?: string | null
          analisi_modello?: string | null
          analisi_note?: string | null
          analisi_provider?: string | null
          appunti?: string | null
          brand?: string | null
          colore_hex?: string
          colore_nome?: string
          confidenze?: Json
          corretti_a_mano?: Database["public"]["Enums"]["attributo_capo"][]
          creato_il?: string
          etichette?: string[]
          fantasia?: string | null
          foto_altezza?: number | null
          foto_larghezza?: number | null
          foto_percorso?: string
          foto_scontornata_percorso?: string | null
          id?: string
          lavaggio?: string | null
          materiale?: string | null
          nome?: string
          preferito?: boolean
          slot?: Database["public"]["Enums"]["slot_avatar"]
          sottotipo?: string | null
          stagione?: Database["public"]["Enums"]["stagione"] | null
          stato?: Database["public"]["Enums"]["stato_capo"]
          tipo?: Database["public"]["Enums"]["tipo_capo"]
          ultimo_uso?: string | null
          utente_id?: string
          vestibilita?: string | null
          volte_indossato?: number
        }
        Relationships: []
      }
      conversazioni_chat: {
        Row: {
          creata_il: string
          id: string
          titolo: string
          ultimo_turno_il: string
          utente_id: string
        }
        Insert: {
          creata_il?: string
          id?: string
          titolo: string
          ultimo_turno_il?: string
          utente_id?: string
        }
        Update: {
          creata_il?: string
          id?: string
          titolo?: string
          ultimo_turno_il?: string
          utente_id?: string
        }
        Relationships: []
      }
      messaggi_chat: {
        Row: {
          conversazione_id: string
          creato_il: string
          id: string
          ruolo: Database["public"]["Enums"]["ruolo_chat"]
          suggerimenti: Json
          testo: string
          utente_id: string
        }
        Insert: {
          conversazione_id: string
          creato_il?: string
          id?: string
          ruolo: Database["public"]["Enums"]["ruolo_chat"]
          suggerimenti?: Json
          testo: string
          utente_id?: string
        }
        Update: {
          conversazione_id?: string
          creato_il?: string
          id?: string
          ruolo?: Database["public"]["Enums"]["ruolo_chat"]
          suggerimenti?: Json
          testo?: string
          utente_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "messaggi_chat_utente_id_conversazione_id_fkey"
            columns: ["utente_id", "conversazione_id"]
            isOneToOne: false
            referencedRelation: "conversazioni_chat"
            referencedColumns: ["utente_id", "id"]
          },
          {
            foreignKeyName: "messaggi_chat_utente_id_conversazione_id_fkey"
            columns: ["utente_id", "conversazione_id"]
            isOneToOne: false
            referencedRelation: "conversazioni_elenco"
            referencedColumns: ["utente_id", "id"]
          },
        ]
      }
      outfit: {
        Row: {
          capo_bottom: string | null
          capo_dress: string | null
          capo_outer: string | null
          capo_shoes: string | null
          capo_top: string | null
          creato_il: string
          id: string
          nome: string
          occasione: string | null
          origine: Database["public"]["Enums"]["origine_outfit"]
          ultimo_uso: string | null
          utente_id: string
          volte_indossato: number
        }
        Insert: {
          capo_bottom?: string | null
          capo_dress?: string | null
          capo_outer?: string | null
          capo_shoes?: string | null
          capo_top?: string | null
          creato_il?: string
          id?: string
          nome: string
          occasione?: string | null
          origine?: Database["public"]["Enums"]["origine_outfit"]
          ultimo_uso?: string | null
          utente_id?: string
          volte_indossato?: number
        }
        Update: {
          capo_bottom?: string | null
          capo_dress?: string | null
          capo_outer?: string | null
          capo_shoes?: string | null
          capo_top?: string | null
          creato_il?: string
          id?: string
          nome?: string
          occasione?: string | null
          origine?: Database["public"]["Enums"]["origine_outfit"]
          ultimo_uso?: string | null
          utente_id?: string
          volte_indossato?: number
        }
        Relationships: [
          {
            foreignKeyName: "outfit_utente_id_capo_bottom_fkey"
            columns: ["utente_id", "capo_bottom"]
            isOneToOne: false
            referencedRelation: "capi"
            referencedColumns: ["utente_id", "id"]
          },
          {
            foreignKeyName: "outfit_utente_id_capo_dress_fkey"
            columns: ["utente_id", "capo_dress"]
            isOneToOne: false
            referencedRelation: "capi"
            referencedColumns: ["utente_id", "id"]
          },
          {
            foreignKeyName: "outfit_utente_id_capo_outer_fkey"
            columns: ["utente_id", "capo_outer"]
            isOneToOne: false
            referencedRelation: "capi"
            referencedColumns: ["utente_id", "id"]
          },
          {
            foreignKeyName: "outfit_utente_id_capo_shoes_fkey"
            columns: ["utente_id", "capo_shoes"]
            isOneToOne: false
            referencedRelation: "capi"
            referencedColumns: ["utente_id", "id"]
          },
          {
            foreignKeyName: "outfit_utente_id_capo_top_fkey"
            columns: ["utente_id", "capo_top"]
            isOneToOne: false
            referencedRelation: "capi"
            referencedColumns: ["utente_id", "id"]
          },
        ]
      }
      profili: {
        Row: {
          altezza_cm: number | null
          avatar_foto_percorso: string | null
          citta: string | null
          corporatura: Database["public"]["Enums"]["corporatura"] | null
          creato_il: string
          evita: string[]
          id: string
          lunghezza_gamba_cm: number | null
          nome: string
          palette: string[]
          sistema_taglie: Database["public"]["Enums"]["sistema_taglie"] | null
          spalle_cm: number | null
          stili: string[]
          taglia: Database["public"]["Enums"]["taglia"] | null
          unita_lunghezza: Database["public"]["Enums"]["unita_lunghezza"]
        }
        Insert: {
          altezza_cm?: number | null
          avatar_foto_percorso?: string | null
          citta?: string | null
          corporatura?: Database["public"]["Enums"]["corporatura"] | null
          creato_il?: string
          evita?: string[]
          id: string
          lunghezza_gamba_cm?: number | null
          nome?: string
          palette?: string[]
          sistema_taglie?: Database["public"]["Enums"]["sistema_taglie"] | null
          spalle_cm?: number | null
          stili?: string[]
          taglia?: Database["public"]["Enums"]["taglia"] | null
          unita_lunghezza?: Database["public"]["Enums"]["unita_lunghezza"]
        }
        Update: {
          altezza_cm?: number | null
          avatar_foto_percorso?: string | null
          citta?: string | null
          corporatura?: Database["public"]["Enums"]["corporatura"] | null
          creato_il?: string
          evita?: string[]
          id?: string
          lunghezza_gamba_cm?: number | null
          nome?: string
          palette?: string[]
          sistema_taglie?: Database["public"]["Enums"]["sistema_taglie"] | null
          spalle_cm?: number | null
          stili?: string[]
          taglia?: Database["public"]["Enums"]["taglia"] | null
          unita_lunghezza?: Database["public"]["Enums"]["unita_lunghezza"]
        }
        Relationships: []
      }
      segnalazioni: {
        Row: {
          aggiornata_il: string
          creata_il: string
          id: string
          stato: Database["public"]["Enums"]["stato_segnalazione"]
          testo: string
          utente_id: string
        }
        Insert: {
          aggiornata_il?: string
          creata_il?: string
          id?: string
          stato?: Database["public"]["Enums"]["stato_segnalazione"]
          testo: string
          utente_id?: string
        }
        Update: {
          aggiornata_il?: string
          creata_il?: string
          id?: string
          stato?: Database["public"]["Enums"]["stato_segnalazione"]
          testo?: string
          utente_id?: string
        }
        Relationships: []
      }
      usi: {
        Row: {
          capo_id: string
          giorno: string
          utente_id: string
        }
        Insert: {
          capo_id: string
          giorno: string
          utente_id?: string
        }
        Update: {
          capo_id?: string
          giorno?: string
          utente_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "usi_utente_id_capo_id_fkey"
            columns: ["utente_id", "capo_id"]
            isOneToOne: false
            referencedRelation: "capi"
            referencedColumns: ["utente_id", "id"]
          },
        ]
      }
    }
    Views: {
      conversazioni_elenco: {
        Row: {
          anteprima: string | null
          creata_il: string | null
          id: string | null
          titolo: string | null
          turni: number | null
          ultimo_turno_il: string | null
          utente_id: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      segna_indossato: {
        Args: { capo: string; giorno: string }
        Returns: {
          aggiornato_il: string
          analisi_eseguita_il: string | null
          analisi_modello: string | null
          analisi_note: string | null
          analisi_provider: string | null
          appunti: string | null
          brand: string | null
          colore_hex: string
          colore_nome: string
          confidenze: Json
          corretti_a_mano: Database["public"]["Enums"]["attributo_capo"][]
          creato_il: string
          etichette: string[]
          fantasia: string | null
          foto_altezza: number | null
          foto_larghezza: number | null
          foto_percorso: string
          foto_scontornata_percorso: string | null
          id: string
          lavaggio: string | null
          materiale: string | null
          nome: string
          preferito: boolean
          slot: Database["public"]["Enums"]["slot_avatar"]
          sottotipo: string | null
          stagione: Database["public"]["Enums"]["stagione"] | null
          stato: Database["public"]["Enums"]["stato_capo"]
          tipo: Database["public"]["Enums"]["tipo_capo"]
          ultimo_uso: string | null
          utente_id: string
          vestibilita: string | null
          volte_indossato: number
        }
        SetofOptions: {
          from: "*"
          to: "capi"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      svuota_armadio: { Args: { conferma: string }; Returns: Json }
    }
    Enums: {
      attributo_capo:
        | "tipo"
        | "colore"
        | "materiale"
        | "fantasia"
        | "stagione"
        | "vestibilita"
        | "lavaggio"
      corporatura: "minuta" | "media" | "robusta"
      origine_outfit: "manuale" | "ia" | "suggerito_modificato"
      ruolo_chat: "utente" | "wardrobe"
      sistema_taglie: "donna" | "uomo" | "unisex"
      slot_avatar: "top" | "bottom" | "outer" | "shoes" | "dress"
      stagione:
        | "primavera"
        | "estate"
        | "autunno"
        | "inverno"
        | "mezza_stagione"
        | "tutto_lanno"
      stato_analisi: "in_corso" | "completata" | "fallita"
      stato_capo: "pulito" | "da_lavare" | "in_lavaggio"
      stato_segnalazione: "ricevuta" | "in_lavorazione" | "risolta"
      taglia: "xs" | "s" | "m" | "l" | "xl"
      tipo_capo:
        | "top"
        | "pantaloni"
        | "scarpe"
        | "capospalla"
        | "abito"
        | "accessorio"
      unita_lunghezza: "cm" | "pollici"
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
      attributo_capo: [
        "tipo",
        "colore",
        "materiale",
        "fantasia",
        "stagione",
        "vestibilita",
        "lavaggio",
      ],
      corporatura: ["minuta", "media", "robusta"],
      origine_outfit: ["manuale", "ia", "suggerito_modificato"],
      ruolo_chat: ["utente", "wardrobe"],
      sistema_taglie: ["donna", "uomo", "unisex"],
      slot_avatar: ["top", "bottom", "outer", "shoes", "dress"],
      stagione: [
        "primavera",
        "estate",
        "autunno",
        "inverno",
        "mezza_stagione",
        "tutto_lanno",
      ],
      stato_analisi: ["in_corso", "completata", "fallita"],
      stato_capo: ["pulito", "da_lavare", "in_lavaggio"],
      stato_segnalazione: ["ricevuta", "in_lavorazione", "risolta"],
      taglia: ["xs", "s", "m", "l", "xl"],
      tipo_capo: [
        "top",
        "pantaloni",
        "scarpe",
        "capospalla",
        "abito",
        "accessorio",
      ],
      unita_lunghezza: ["cm", "pollici"],
    },
  },
} as const

