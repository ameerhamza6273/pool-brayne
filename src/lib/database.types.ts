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
      automations: {
        Row: {
          active: boolean
          channel: string | null
          conversion_rate: string | null
          description: string | null
          enrolled_count: number
          icon: string | null
          id: string
          name: string
          tenant_id: string
          trigger_label: string | null
        }
        Insert: {
          active?: boolean
          channel?: string | null
          conversion_rate?: string | null
          description?: string | null
          enrolled_count?: number
          icon?: string | null
          id?: string
          name: string
          tenant_id: string
          trigger_label?: string | null
        }
        Update: {
          active?: boolean
          channel?: string | null
          conversion_rate?: string | null
          description?: string | null
          enrolled_count?: number
          icon?: string | null
          id?: string
          name?: string
          tenant_id?: string
          trigger_label?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "automations_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      billing_history: {
        Row: {
          amount: number
          billed_date: string
          description: string
          id: string
          status: string
          tenant_id: string
        }
        Insert: {
          amount?: number
          billed_date?: string
          description: string
          id?: string
          status?: string
          tenant_id: string
        }
        Update: {
          amount?: number
          billed_date?: string
          description?: string
          id?: string
          status?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "billing_history_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      customer_attachments: {
        Row: {
          created_at: string
          customer_id: string
          id: string
          tenant_id: string
          url: string
        }
        Insert: {
          created_at?: string
          customer_id: string
          id?: string
          tenant_id: string
          url: string
        }
        Update: {
          created_at?: string
          customer_id?: string
          id?: string
          tenant_id?: string
          url?: string
        }
        Relationships: [
          {
            foreignKeyName: "customer_attachments_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_attachments_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      customer_notes: {
        Row: {
          author: string | null
          created_at: string
          customer_id: string
          id: string
          tenant_id: string
          text: string
        }
        Insert: {
          author?: string | null
          created_at?: string
          customer_id: string
          id?: string
          tenant_id: string
          text: string
        }
        Update: {
          author?: string | null
          created_at?: string
          customer_id?: string
          id?: string
          tenant_id?: string
          text?: string
        }
        Relationships: [
          {
            foreignKeyName: "customer_notes_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_notes_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      customers: {
        Row: {
          address: string | null
          created_at: string
          customer_since: string | null
          email: string | null
          equipment: Json
          gate_codes: Json
          household_id: string | null
          id: string
          last_contact: string | null
          last_service: string | null
          lat: number | null
          lifetime_value: number
          lng: number | null
          name: string
          phone: string | null
          qbo_customer_id: string | null
          tags: string[]
          tenant_id: string
          type: string
        }
        Insert: {
          address?: string | null
          created_at?: string
          customer_since?: string | null
          email?: string | null
          equipment?: Json
          gate_codes?: Json
          household_id?: string | null
          id?: string
          last_contact?: string | null
          last_service?: string | null
          lat?: number | null
          lifetime_value?: number
          lng?: number | null
          name: string
          phone?: string | null
          qbo_customer_id?: string | null
          tags?: string[]
          tenant_id: string
          type?: string
        }
        Update: {
          address?: string | null
          created_at?: string
          customer_since?: string | null
          email?: string | null
          equipment?: Json
          gate_codes?: Json
          household_id?: string | null
          id?: string
          last_contact?: string | null
          last_service?: string | null
          lat?: number | null
          lifetime_value?: number
          lng?: number | null
          name?: string
          phone?: string | null
          qbo_customer_id?: string | null
          tags?: string[]
          tenant_id?: string
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "customers_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      geofence_alerts: {
        Row: {
          id: string
          message: string
          occurred_at: string
          severity: string
          tenant_id: string
          vehicle_id: string
        }
        Insert: {
          id?: string
          message: string
          occurred_at?: string
          severity?: string
          tenant_id: string
          vehicle_id: string
        }
        Update: {
          id?: string
          message?: string
          occurred_at?: string
          severity?: string
          tenant_id?: string
          vehicle_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "geofence_alerts_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "geofence_alerts_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles"
            referencedColumns: ["id"]
          },
        ]
      }
      integrations: {
        Row: {
          description: string | null
          icon: string | null
          id: string
          name: string
          provider: string | null
          status: string
          tenant_id: string
        }
        Insert: {
          description?: string | null
          icon?: string | null
          id?: string
          name: string
          provider?: string | null
          status?: string
          tenant_id: string
        }
        Update: {
          description?: string | null
          icon?: string | null
          id?: string
          name?: string
          provider?: string | null
          status?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "integrations_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      inventory_items: {
        Row: {
          category: string
          created_at: string
          department: string | null
          id: string
          long_description: string | null
          manufacturer: string | null
          name: string
          pos_enabled: boolean
          price: number | null
          qbo_accounts: Json
          reorder_threshold: number
          short_description: string | null
          sku: string
          sub_department: string | null
          taxable: boolean
          tenant_id: string
          unit: string | null
          unit_cost: number
        }
        Insert: {
          category: string
          created_at?: string
          department?: string | null
          id?: string
          long_description?: string | null
          manufacturer?: string | null
          name: string
          pos_enabled?: boolean
          price?: number | null
          qbo_accounts?: Json
          reorder_threshold?: number
          short_description?: string | null
          sku: string
          sub_department?: string | null
          taxable?: boolean
          tenant_id: string
          unit?: string | null
          unit_cost?: number
        }
        Update: {
          category?: string
          created_at?: string
          department?: string | null
          id?: string
          long_description?: string | null
          manufacturer?: string | null
          name?: string
          pos_enabled?: boolean
          price?: number | null
          qbo_accounts?: Json
          reorder_threshold?: number
          short_description?: string | null
          sku?: string
          sub_department?: string | null
          taxable?: boolean
          tenant_id?: string
          unit?: string | null
          unit_cost?: number
        }
        Relationships: [
          {
            foreignKeyName: "inventory_items_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      inventory_locations: {
        Row: {
          id: string
          name: string
          tenant_id: string
          type: string
        }
        Insert: {
          id?: string
          name: string
          tenant_id: string
          type?: string
        }
        Update: {
          id?: string
          name?: string
          tenant_id?: string
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "inventory_locations_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      inventory_stock: {
        Row: {
          id: string
          item_id: string
          location_id: string
          quantity: number
          tenant_id: string
        }
        Insert: {
          id?: string
          item_id: string
          location_id: string
          quantity?: number
          tenant_id: string
        }
        Update: {
          id?: string
          item_id?: string
          location_id?: string
          quantity?: number
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "inventory_stock_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "inventory_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_stock_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "inventory_locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_stock_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      inventory_variance: {
        Row: {
          actual: number
          expected: number
          flagged: boolean
          id: string
          item_id: string
          recorded_at: string
          tenant_id: string
          variance_pct: number
        }
        Insert: {
          actual?: number
          expected?: number
          flagged?: boolean
          id?: string
          item_id: string
          recorded_at?: string
          tenant_id: string
          variance_pct?: number
        }
        Update: {
          actual?: number
          expected?: number
          flagged?: boolean
          id?: string
          item_id?: string
          recorded_at?: string
          tenant_id?: string
          variance_pct?: number
        }
        Relationships: [
          {
            foreignKeyName: "inventory_variance_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "inventory_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_variance_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      invoice_line_items: {
        Row: {
          amount: number
          description: string
          id: string
          invoice_id: string
          quantity: number
          rate: number
          tenant_id: string
        }
        Insert: {
          amount?: number
          description: string
          id?: string
          invoice_id: string
          quantity?: number
          rate?: number
          tenant_id: string
        }
        Update: {
          amount?: number
          description?: string
          id?: string
          invoice_id?: string
          quantity?: number
          rate?: number
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "invoice_line_items_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoice_line_items_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      invoices: {
        Row: {
          amount: number
          created_at: string
          customer_id: string
          due_date: string | null
          id: string
          issue_date: string
          job_id: string | null
          number: string
          paid_date: string | null
          payment_method: string | null
          qbo_invoice_id: string | null
          status: string
          tenant_id: string
        }
        Insert: {
          amount?: number
          created_at?: string
          customer_id: string
          due_date?: string | null
          id?: string
          issue_date?: string
          job_id?: string | null
          number: string
          paid_date?: string | null
          payment_method?: string | null
          qbo_invoice_id?: string | null
          status?: string
          tenant_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          customer_id?: string
          due_date?: string | null
          id?: string
          issue_date?: string
          job_id?: string | null
          number?: string
          paid_date?: string | null
          payment_method?: string | null
          qbo_invoice_id?: string | null
          status?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "invoices_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      job_costing: {
        Row: {
          cost_date: string
          hours: number
          id: string
          job_id: string | null
          job_label: string
          labor_cost: number
          tech_id: string | null
          tenant_id: string
        }
        Insert: {
          cost_date?: string
          hours?: number
          id?: string
          job_id?: string | null
          job_label: string
          labor_cost?: number
          tech_id?: string | null
          tenant_id: string
        }
        Update: {
          cost_date?: string
          hours?: number
          id?: string
          job_id?: string | null
          job_label?: string
          labor_cost?: number
          tech_id?: string | null
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "job_costing_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "job_costing_tech_id_fkey"
            columns: ["tech_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "job_costing_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      job_attachments: {
        Row: {
          created_at: string
          id: string
          job_id: string
          tenant_id: string
          type: string
          url: string
        }
        Insert: {
          created_at?: string
          id?: string
          job_id: string
          tenant_id: string
          type: string
          url: string
        }
        Update: {
          created_at?: string
          id?: string
          job_id?: string
          tenant_id?: string
          type?: string
          url?: string
        }
        Relationships: [
          {
            foreignKeyName: "job_attachments_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "job_attachments_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      job_parts_used: {
        Row: {
          created_at: string
          id: string
          item_id: string
          job_id: string
          quantity: number
          tenant_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          item_id: string
          job_id: string
          quantity?: number
          tenant_id: string
        }
        Update: {
          created_at?: string
          id?: string
          item_id?: string
          job_id?: string
          quantity?: number
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "job_parts_used_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "inventory_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "job_parts_used_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "job_parts_used_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      job_service_history: {
        Row: {
          amount: number
          customer_id: string
          id: string
          job_id: string | null
          service_date: string
          status: string
          tech: string | null
          tenant_id: string
          type: string
        }
        Insert: {
          amount?: number
          customer_id: string
          id?: string
          job_id?: string | null
          service_date: string
          status?: string
          tech?: string | null
          tenant_id: string
          type: string
        }
        Update: {
          amount?: number
          customer_id?: string
          id?: string
          job_id?: string | null
          service_date?: string
          status?: string
          tech?: string | null
          tenant_id?: string
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "job_service_history_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "job_service_history_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "job_service_history_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      jobs: {
        Row: {
          address: string | null
          amount: number
          arrived_at: string | null
          completed_at: string | null
          created_at: string
          customer_id: string
          description: string | null
          en_route_at: string | null
          id: string
          scheduled_date: string | null
          scheduled_time: string | null
          stage: Database["public"]["Enums"]["job_stage"]
          status: string
          tech_id: string | null
          tenant_id: string
          type: string
        }
        Insert: {
          address?: string | null
          amount?: number
          arrived_at?: string | null
          completed_at?: string | null
          created_at?: string
          customer_id: string
          description?: string | null
          en_route_at?: string | null
          id?: string
          scheduled_date?: string | null
          scheduled_time?: string | null
          stage?: Database["public"]["Enums"]["job_stage"]
          status?: string
          tech_id?: string | null
          tenant_id: string
          type: string
        }
        Update: {
          address?: string | null
          amount?: number
          arrived_at?: string | null
          completed_at?: string | null
          created_at?: string
          customer_id?: string
          description?: string | null
          en_route_at?: string | null
          id?: string
          scheduled_date?: string | null
          scheduled_time?: string | null
          stage?: Database["public"]["Enums"]["job_stage"]
          status?: string
          tech_id?: string | null
          tenant_id?: string
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "jobs_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "jobs_tech_id_fkey"
            columns: ["tech_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "jobs_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      payments: {
        Row: {
          amount: number
          customer_id: string | null
          id: string
          invoice_id: string | null
          method: string | null
          paid_at: string
          status: string
          tenant_id: string
        }
        Insert: {
          amount?: number
          customer_id?: string | null
          id?: string
          invoice_id?: string | null
          method?: string | null
          paid_at?: string
          status?: string
          tenant_id: string
        }
        Update: {
          amount?: number
          customer_id?: string | null
          id?: string
          invoice_id?: string | null
          method?: string | null
          paid_at?: string
          status?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "payments_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      pos_order_items: {
        Row: {
          amount: number
          description: string
          id: string
          item_id: string | null
          order_id: string
          quantity: number
          tenant_id: string
          unit_price: number
        }
        Insert: {
          amount?: number
          description: string
          id?: string
          item_id?: string | null
          order_id: string
          quantity?: number
          tenant_id: string
          unit_price?: number
        }
        Update: {
          amount?: number
          description?: string
          id?: string
          item_id?: string | null
          order_id?: string
          quantity?: number
          tenant_id?: string
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "pos_order_items_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "inventory_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pos_order_items_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "pos_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pos_order_items_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      pos_orders: {
        Row: {
          cashier_id: string | null
          created_at: string
          customer_id: string | null
          id: string
          payment_method: string | null
          subtotal: number
          tax: number
          tenant_id: string
          total: number
        }
        Insert: {
          cashier_id?: string | null
          created_at?: string
          customer_id?: string | null
          id?: string
          payment_method?: string | null
          subtotal?: number
          tax?: number
          tenant_id: string
          total?: number
        }
        Update: {
          cashier_id?: string | null
          created_at?: string
          customer_id?: string | null
          id?: string
          payment_method?: string | null
          subtotal?: number
          tax?: number
          tenant_id?: string
          total?: number
        }
        Relationships: [
          {
            foreignKeyName: "pos_orders_cashier_id_fkey"
            columns: ["cashier_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pos_orders_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pos_orders_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar: string | null
          created_at: string
          current_job_id: string | null
          email: string
          employment_type: string
          hourly_rate: number | null
          id: string
          name: string
          phone: string | null
          role: Database["public"]["Enums"]["staff_role"]
          salary: number | null
          status: string
          tenant_id: string
        }
        Insert: {
          avatar?: string | null
          created_at?: string
          current_job_id?: string | null
          email: string
          employment_type?: string
          hourly_rate?: number | null
          id: string
          name: string
          phone?: string | null
          role?: Database["public"]["Enums"]["staff_role"]
          salary?: number | null
          status?: string
          tenant_id: string
        }
        Update: {
          avatar?: string | null
          created_at?: string
          current_job_id?: string | null
          email?: string
          employment_type?: string
          hourly_rate?: number | null
          id?: string
          name?: string
          phone?: string | null
          role?: Database["public"]["Enums"]["staff_role"]
          salary?: number | null
          status?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_current_job_id_fkey"
            columns: ["current_job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profiles_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      purchase_orders: {
        Row: {
          id: string
          item_count: number
          number: string
          order_date: string
          received_date: string | null
          status: string
          supplier_id: string | null
          tenant_id: string
          total: number
        }
        Insert: {
          id?: string
          item_count?: number
          number: string
          order_date?: string
          received_date?: string | null
          status?: string
          supplier_id?: string | null
          tenant_id: string
          total?: number
        }
        Update: {
          id?: string
          item_count?: number
          number?: string
          order_date?: string
          received_date?: string | null
          status?: string
          supplier_id?: string | null
          tenant_id?: string
          total?: number
        }
        Relationships: [
          {
            foreignKeyName: "purchase_orders_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_orders_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      recurring_billing: {
        Row: {
          amount: number
          customer_id: string
          frequency: string
          id: string
          next_charge: string | null
          status: string
          tenant_id: string
        }
        Insert: {
          amount?: number
          customer_id: string
          frequency: string
          id?: string
          next_charge?: string | null
          status?: string
          tenant_id: string
        }
        Update: {
          amount?: number
          customer_id?: string
          frequency?: string
          id?: string
          next_charge?: string | null
          status?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "recurring_billing_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recurring_billing_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      recurring_routes: {
        Row: {
          avg_time: string | null
          customer_count: number
          day: string | null
          frequency: string
          id: string
          name: string
          tech_id: string | null
          tenant_id: string
        }
        Insert: {
          avg_time?: string | null
          customer_count?: number
          day?: string | null
          frequency: string
          id?: string
          name: string
          tech_id?: string | null
          tenant_id: string
        }
        Update: {
          avg_time?: string | null
          customer_count?: number
          day?: string | null
          frequency?: string
          id?: string
          name?: string
          tech_id?: string | null
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "recurring_routes_tech_id_fkey"
            columns: ["tech_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recurring_routes_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      reviews: {
        Row: {
          body: string | null
          customer_id: string | null
          id: string
          platform: string
          rating: number
          response: string | null
          review_date: string
          tenant_id: string
        }
        Insert: {
          body?: string | null
          customer_id?: string | null
          id?: string
          platform: string
          rating: number
          response?: string | null
          review_date?: string
          tenant_id: string
        }
        Update: {
          body?: string | null
          customer_id?: string | null
          id?: string
          platform?: string
          rating?: number
          response?: string | null
          review_date?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "reviews_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reviews_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      seasonal_campaigns: {
        Row: {
          audience_size: number
          bookings: number | null
          id: string
          name: string
          open_rate: string | null
          reply_rate: string | null
          revenue: number | null
          scheduled_date: string | null
          sent_date: string | null
          status: string
          tenant_id: string
        }
        Insert: {
          audience_size?: number
          bookings?: number | null
          id?: string
          name: string
          open_rate?: string | null
          reply_rate?: string | null
          revenue?: number | null
          scheduled_date?: string | null
          sent_date?: string | null
          status?: string
          tenant_id: string
        }
        Update: {
          audience_size?: number
          bookings?: number | null
          id?: string
          name?: string
          open_rate?: string | null
          reply_rate?: string | null
          revenue?: number | null
          scheduled_date?: string | null
          sent_date?: string | null
          status?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "seasonal_campaigns_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      sms_conversations: {
        Row: {
          customer_id: string
          id: string
          tenant_id: string
          unread_count: number
          updated_at: string
        }
        Insert: {
          customer_id: string
          id?: string
          tenant_id: string
          unread_count?: number
          updated_at?: string
        }
        Update: {
          customer_id?: string
          id?: string
          tenant_id?: string
          unread_count?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "sms_conversations_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sms_conversations_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      sms_messages: {
        Row: {
          body: string
          conversation_id: string
          id: string
          sender: string
          sent_at: string
          tenant_id: string
        }
        Insert: {
          body: string
          conversation_id: string
          id?: string
          sender: string
          sent_at?: string
          tenant_id: string
        }
        Update: {
          body?: string
          conversation_id?: string
          id?: string
          sender?: string
          sent_at?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "sms_messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "sms_conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sms_messages_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      subscription_plans: {
        Row: {
          description: string | null
          features: string[]
          id: string
          name: string
          price: number
          recommended: boolean
        }
        Insert: {
          description?: string | null
          features?: string[]
          id?: string
          name: string
          price: number
          recommended?: boolean
        }
        Update: {
          description?: string | null
          features?: string[]
          id?: string
          name?: string
          price?: number
          recommended?: boolean
        }
        Relationships: []
      }
      suppliers: {
        Row: {
          contact: string | null
          id: string
          lead_time: string | null
          name: string
          phone: string | null
          tenant_id: string
        }
        Insert: {
          contact?: string | null
          id?: string
          lead_time?: string | null
          name: string
          phone?: string | null
          tenant_id: string
        }
        Update: {
          contact?: string | null
          id?: string
          lead_time?: string | null
          name?: string
          phone?: string | null
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "suppliers_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      tenants: {
        Row: {
          created_at: string
          id: string
          name: string
          plan_id: string | null
          subscription_status: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          plan_id?: string | null
          subscription_status?: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          plan_id?: string | null
          subscription_status?: string
        }
        Relationships: [
          {
            foreignKeyName: "tenants_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "subscription_plans"
            referencedColumns: ["id"]
          },
        ]
      }
      timesheets: {
        Row: {
          employee_id: string
          fri: number
          id: string
          mon: number
          overtime_hours: number
          sat: number
          status: string
          sun: number
          tenant_id: string
          thu: number
          tue: number
          wed: number
          week_start: string
        }
        Insert: {
          employee_id: string
          fri?: number
          id?: string
          mon?: number
          overtime_hours?: number
          sat?: number
          status?: string
          sun?: number
          tenant_id: string
          thu?: number
          tue?: number
          wed?: number
          week_start: string
        }
        Update: {
          employee_id?: string
          fri?: number
          id?: string
          mon?: number
          overtime_hours?: number
          sat?: number
          status?: string
          sun?: number
          tenant_id?: string
          thu?: number
          tue?: number
          wed?: number
          week_start?: string
        }
        Relationships: [
          {
            foreignKeyName: "timesheets_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "timesheets_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      trip_history: {
        Row: {
          distance_miles: number | null
          duration_minutes: number | null
          end_location: string | null
          end_time: string | null
          id: string
          start_location: string | null
          start_time: string
          tenant_id: string
          vehicle_id: string
        }
        Insert: {
          distance_miles?: number | null
          duration_minutes?: number | null
          end_location?: string | null
          end_time?: string | null
          id?: string
          start_location?: string | null
          start_time: string
          tenant_id: string
          vehicle_id: string
        }
        Update: {
          distance_miles?: number | null
          duration_minutes?: number | null
          end_location?: string | null
          end_time?: string | null
          id?: string
          start_location?: string | null
          start_time?: string
          tenant_id?: string
          vehicle_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "trip_history_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trip_history_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles"
            referencedColumns: ["id"]
          },
        ]
      }
      vehicles: {
        Row: {
          id: string
          last_update: string
          location_label: string | null
          mileage_today: number
          name: string
          number: string
          speed: number
          status: string
          tech_id: string | null
          tenant_id: string
        }
        Insert: {
          id?: string
          last_update?: string
          location_label?: string | null
          mileage_today?: number
          name: string
          number: string
          speed?: number
          status?: string
          tech_id?: string | null
          tenant_id: string
        }
        Update: {
          id?: string
          last_update?: string
          location_label?: string | null
          mileage_today?: number
          name?: string
          number?: string
          speed?: number
          status?: string
          tech_id?: string | null
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "vehicles_tech_id_fkey"
            columns: ["tech_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vehicles_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      current_tenant_id: { Args: never; Returns: string }
    }
    Enums: {
      job_stage: "lead" | "booked" | "dispatched" | "in_progress" | "completed"
      staff_role:
        | "owner"
        | "manager"
        | "technician"
        | "contractor"
        | "office_manager"
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
      job_stage: ["lead", "booked", "dispatched", "in_progress", "completed"],
      staff_role: [
        "owner",
        "manager",
        "technician",
        "contractor",
        "office_manager",
      ],
    },
  },
} as const
