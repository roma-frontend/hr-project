export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  public: {
    Tables: {
      organizations: {
        Row: {
          id: string
          name: string
          slug: string
          plan: 'starter' | 'professional' | 'enterprise'
          is_active: boolean
          created_by_superadmin: boolean
          logo_url: string | null
          primary_color: string | null
          timezone: string | null
          country: string | null
          industry: string | null
          employee_limit: number
          created_at: number
          updated_at: number
        }
        Insert: {
          id?: string
          name: string
          slug: string
          plan?: 'starter' | 'professional' | 'enterprise'
          is_active?: boolean
          created_by_superadmin?: boolean
          logo_url?: string | null
          primary_color?: string | null
          timezone?: string | null
          country?: string | null
          industry?: string | null
          employee_limit?: number
          created_at?: number
          updated_at?: number
        }
        Update: {
          id?: string
          name?: string
          slug?: string
          plan?: 'starter' | 'professional' | 'enterprise'
          is_active?: boolean
          created_by_superadmin?: boolean
          logo_url?: string | null
          primary_color?: string | null
          timezone?: string | null
          country?: string | null
          industry?: string | null
          employee_limit?: number
          created_at?: number
          updated_at?: number
        }
        Relationships: []
      }
      users: {
        Row: {
          id: string
          organization_id: string | null
          name: string
          email: string
          password_hash: string
          googleid: string | null
          clerkid: string | null
          role: 'superadmin' | 'admin' | 'supervisor' | 'employee' | 'driver'
          employee_type: 'staff' | 'contractor'
          department: string | null
          position: string | null
          phone: string | null
          location: string | null
          avatar_url: string | null
          presence_status: 'available' | 'in_meeting' | 'in_call' | 'out_of_office' | 'busy' | null
          supervisorid: string | null
          is_active: boolean
          is_approved: boolean
          approved_by: string | null
          approved_at: number | null
          travel_allowance: number
          paid_leave_balance: number
          sick_leave_balance: number
          family_leave_balance: number
          webauthn_challenge: string | null
          face_descriptor: Json | null
          face_image_url: string | null
          face_registered_at: number | null
          faceid_blocked: boolean | null
          faceid_blocked_at: number | null
          faceid_failed_attempts: number | null
          faceid_last_attempt: number | null
          date_of_birth: string | null
          language: string | null
          timezone: string | null
          date_format: string | null
          time_format: string | null
          first_day_of_week: string | null
          theme: string | null
          notifications_enabled: boolean | null
          email_notifications: boolean | null
          push_notifications: boolean | null
          is_suspended: boolean | null
          suspended_until: number | null
          suspended_reason: string | null
          suspended_by: string | null
          suspended_at: number | null
          totp_secret: string | null
          totp_enabled: boolean | null
          backup_codes: Json | null
          reset_password_token: string | null
          reset_password_expiry: number | null
          session_token: string | null
          session_expiry: number | null
          focus_mode_enabled: boolean | null
          work_hours_start: string | null
          work_hours_end: string | null
          break_reminders_enabled: boolean | null
          break_interval: number | null
          daily_task_goal: number | null
          default_view: string | null
          data_refresh_rate: string | null
          compact_mode: boolean | null
          dashboard_widgets: Json | null
          created_at: number
          updated_at: number | null
          last_login_at: number | null
        }
        Insert: {
          id?: string
          organization_id?: string | null
          name: string
          email: string
          password_hash: string
          googleid?: string | null
          clerkid?: string | null
          role?: 'superadmin' | 'admin' | 'supervisor' | 'employee' | 'driver'
          employee_type?: 'staff' | 'contractor'
          department?: string | null
          position?: string | null
          phone?: string | null
          location?: string | null
          avatar_url?: string | null
          presence_status?: 'available' | 'in_meeting' | 'in_call' | 'out_of_office' | 'busy' | null
          supervisorid?: string | null
          is_active?: boolean
          is_approved?: boolean
          approved_by?: string | null
          approved_at?: number | null
          travel_allowance?: number
          paid_leave_balance?: number
          sick_leave_balance?: number
          family_leave_balance?: number
          webauthn_challenge?: string | null
          face_descriptor?: Json | null
          face_image_url?: string | null
          face_registered_at?: number | null
          faceid_blocked?: boolean | null
          faceid_blocked_at?: number | null
          faceid_failed_attempts?: number | null
          faceid_last_attempt?: number | null
          date_of_birth?: string | null
          language?: string | null
          timezone?: string | null
          date_format?: string | null
          time_format?: string | null
          first_day_of_week?: string | null
          theme?: string | null
          notifications_enabled?: boolean | null
          email_notifications?: boolean | null
          push_notifications?: boolean | null
          is_suspended?: boolean | null
          suspended_until?: number | null
          suspended_reason?: string | null
          suspended_by?: string | null
          suspended_at?: number | null
          totp_secret?: string | null
          totp_enabled?: boolean | null
          backup_codes?: Json | null
          reset_password_token?: string | null
          reset_password_expiry?: number | null
          session_token?: string | null
          session_expiry?: number | null
          focus_mode_enabled?: boolean | null
          work_hours_start?: string | null
          work_hours_end?: string | null
          break_reminders_enabled?: boolean | null
          break_interval?: number | null
          daily_task_goal?: number | null
          default_view?: string | null
          data_refresh_rate?: string | null
          compact_mode?: boolean | null
          dashboard_widgets?: Json | null
          created_at?: number
          updated_at?: number | null
          last_login_at?: number | null
        }
        Update: {
          id?: string
          organization_id?: string | null
          name?: string
          email?: string
          password_hash?: string
          googleid?: string | null
          clerkid?: string | null
          role?: 'superadmin' | 'admin' | 'supervisor' | 'employee' | 'driver'
          employee_type?: 'staff' | 'contractor'
          department?: string | null
          position?: string | null
          phone?: string | null
          location?: string | null
          avatar_url?: string | null
          presence_status?: 'available' | 'in_meeting' | 'in_call' | 'out_of_office' | 'busy' | null
          supervisorid?: string | null
          is_active?: boolean
          is_approved?: boolean
          approved_by?: string | null
          approved_at?: number | null
          travel_allowance?: number
          paid_leave_balance?: number
          sick_leave_balance?: number
          family_leave_balance?: number
          webauthn_challenge?: string | null
          face_descriptor?: Json | null
          face_image_url?: string | null
          face_registered_at?: number | null
          faceid_blocked?: boolean | null
          faceid_blocked_at?: number | null
          faceid_failed_attempts?: number | null
          faceid_last_attempt?: number | null
          date_of_birth?: string | null
          language?: string | null
          timezone?: string | null
          date_format?: string | null
          time_format?: string | null
          first_day_of_week?: string | null
          theme?: string | null
          notifications_enabled?: boolean | null
          email_notifications?: boolean | null
          push_notifications?: boolean | null
          is_suspended?: boolean | null
          suspended_until?: number | null
          suspended_reason?: string | null
          suspended_by?: string | null
          suspended_at?: number | null
          totp_secret?: string | null
          totp_enabled?: boolean | null
          backup_codes?: Json | null
          reset_password_token?: string | null
          reset_password_expiry?: number | null
          session_token?: string | null
          session_expiry?: number | null
          focus_mode_enabled?: boolean | null
          work_hours_start?: string | null
          work_hours_end?: string | null
          break_reminders_enabled?: boolean | null
          break_interval?: number | null
          daily_task_goal?: number | null
          default_view?: string | null
          data_refresh_rate?: string | null
          compact_mode?: boolean | null
          dashboard_widgets?: Json | null
          created_at?: number
          updated_at?: number | null
          last_login_at?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "users_organization_id_fkey"
            columns: ["organization_id"]
            isRelationOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "users_supervisorid_fkey"
            columns: ["supervisorid"]
            isRelationOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          }
        ]
      }
      leave_requests: {
        Row: {
          id: string
          organization_id: string | null
          userid: string
          type: 'paid' | 'unpaid' | 'sick' | 'family' | 'doctor'
          start_date: string
          end_date: string
          days: number
          total_days: number
          reason: string
          comment: string | null
          status: 'pending' | 'approved' | 'rejected'
          reviewed_by: string | null
          review_comment: string | null
          reviewed_at: number | null
          created_at: number
          updated_at: number
        }
        Insert: {
          id?: string
          organization_id?: string | null
          userid: string
          type: 'paid' | 'unpaid' | 'sick' | 'family' | 'doctor'
          start_date: string
          end_date: string
          days?: number
          total_days: number
          reason?: string
          comment?: string | null
          status?: 'pending' | 'approved' | 'rejected'
          reviewed_by?: string | null
          review_comment?: string | null
          reviewed_at?: number | null
          created_at?: number
          updated_at?: number
        }
        Update: {
          id?: string
          organization_id?: string | null
          userid?: string
          type?: 'paid' | 'unpaid' | 'sick' | 'family' | 'doctor'
          start_date?: string
          end_date?: string
          days?: number
          total_days?: number
          reason?: string
          comment?: string | null
          status?: 'pending' | 'approved' | 'rejected'
          reviewed_by?: string | null
          review_comment?: string | null
          reviewed_at?: number | null
          created_at?: number
          updated_at?: number
        }
        Relationships: [
          {
            foreignKeyName: "leave_requests_organization_id_fkey"
            columns: ["organization_id"]
            isRelationOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leave_requests_userid_fkey"
            columns: ["userid"]
            isRelationOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          }
        ]
      }
      notifications: {
        Row: {
          id: string
          organization_id: string | null
          userid: string
          type: 'leave_request' | 'leave_approved' | 'leave_rejected' | 'driver_request' | 'driver_request_approved' | 'driver_request_rejected' | 'employee_added' | 'join_request' | 'join_approved' | 'join_rejected' | 'security_alert' | 'status_change' | 'message_mention' | 'system'
          title: string
          message: string
          is_read: boolean
          relatedid: string | null
          metadata: string | null
          created_at: number
        }
        Insert: {
          id?: string
          organization_id?: string | null
          userid: string
          type: 'leave_request' | 'leave_approved' | 'leave_rejected' | 'driver_request' | 'driver_request_approved' | 'driver_request_rejected' | 'employee_added' | 'join_request' | 'join_approved' | 'join_rejected' | 'security_alert' | 'status_change' | 'message_mention' | 'system'
          title: string
          message: string
          is_read?: boolean
          relatedid?: string | null
          metadata?: string | null
          created_at?: number
        }
        Update: {
          id?: string
          organization_id?: string | null
          userid?: string
          type?: 'leave_request' | 'leave_approved' | 'leave_rejected' | 'driver_request' | 'driver_request_approved' | 'driver_request_rejected' | 'employee_added' | 'join_request' | 'join_approved' | 'join_rejected' | 'security_alert' | 'status_change' | 'message_mention' | 'system'
          title?: string
          message?: string
          is_read?: boolean
          relatedid?: string | null
          metadata?: string | null
          created_at?: number
        }
        Relationships: [
          {
            foreignKeyName: "notifications_organization_id_fkey"
            columns: ["organization_id"]
            isRelationOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_userid_fkey"
            columns: ["userid"]
            isRelationOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          }
        ]
      }
      chat_conversations: {
        Row: {
          id: string
          organization_id: string | null
          type: 'direct' | 'group'
          name: string | null
          description: string | null
          avatar_url: string | null
          created_by: string
          last_message_at: number | null
          last_message_text: string | null
          last_message_senderid: string | null
          dm_key: string | null
          is_pinned: boolean | null
          is_archived: boolean | null
          is_deleted: boolean | null
          deleted_by: string | null
          deleted_at: number | null
          created_at: number
          updated_at: number
        }
        Insert: {
          id?: string
          organization_id?: string | null
          type: 'direct' | 'group'
          name?: string | null
          description?: string | null
          avatar_url?: string | null
          created_by: string
          last_message_at?: number | null
          last_message_text?: string | null
          last_message_senderid?: string | null
          dm_key?: string | null
          is_pinned?: boolean | null
          is_archived?: boolean | null
          is_deleted?: boolean | null
          deleted_by?: string | null
          deleted_at?: number | null
          created_at?: number
          updated_at?: number
        }
        Update: {
          id?: string
          organization_id?: string | null
          type?: 'direct' | 'group'
          name?: string | null
          description?: string | null
          avatar_url?: string | null
          created_by?: string
          last_message_at?: number | null
          last_message_text?: string | null
          last_message_senderid?: string | null
          dm_key?: string | null
          is_pinned?: boolean | null
          is_archived?: boolean | null
          is_deleted?: boolean | null
          deleted_by?: string | null
          deleted_at?: number | null
          created_at?: number
          updated_at?: number
        }
        Relationships: [
          {
            foreignKeyName: "chat_conversations_organization_id_fkey"
            columns: ["organization_id"]
            isRelationOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chat_conversations_created_by_fkey"
            columns: ["created_by"]
            isRelationOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          }
        ]
      }
      chat_messages: {
        Row: {
          id: string
          conversationid: string
          organization_id: string | null
          senderid: string
          type: 'text' | 'image' | 'file' | 'audio' | 'system' | 'call'
          content: string
          attachments: Json | null
          reply_toid: string | null
          reply_to_content: string | null
          reply_to_sender_name: string | null
          reactions: Json | null
          mentioned_userids: string[] | null
          read_by: Json | null
          poll: Json | null
          thread_count: number | null
          thread_last_at: number | null
          scheduled_for: number | null
          is_sent: boolean | null
          link_preview: Json | null
          parent_messageid: string | null
          is_edited: boolean | null
          edited_at: number | null
          is_deleted: boolean | null
          deleted_at: number | null
          deleted_for_users: string[] | null
          is_pinned: boolean | null
          pinned_by: string | null
          pinned_at: number | null
          call_duration: number | null
          call_type: 'audio' | 'video' | null
          call_status: 'ringing' | 'active' | 'ended' | 'missed' | 'declined' | null
          is_service_broadcast: boolean | null
          broadcast_title: string | null
          broadcast_icon: string | null
          created_at: number
        }
        Insert: {
          id?: string
          conversationid: string
          organization_id?: string | null
          senderid: string
          type?: 'text' | 'image' | 'file' | 'audio' | 'system' | 'call'
          content: string
          attachments?: Json | null
          reply_toid?: string | null
          reply_to_content?: string | null
          reply_to_sender_name?: string | null
          reactions?: Json | null
          mentioned_userids?: string[] | null
          read_by?: Json | null
          poll?: Json | null
          thread_count?: number | null
          thread_last_at?: number | null
          scheduled_for?: number | null
          is_sent?: boolean | null
          link_preview?: Json | null
          parent_messageid?: string | null
          is_edited?: boolean | null
          edited_at?: number | null
          is_deleted?: boolean | null
          deleted_at?: number | null
          deleted_for_users?: string[] | null
          is_pinned?: boolean | null
          pinned_by?: string | null
          pinned_at?: number | null
          call_duration?: number | null
          call_type?: 'audio' | 'video' | null
          call_status?: 'ringing' | 'active' | 'ended' | 'missed' | 'declined' | null
          is_service_broadcast?: boolean | null
          broadcast_title?: string | null
          broadcast_icon?: string | null
          created_at?: number
        }
        Update: {
          id?: string
          conversationid?: string
          organization_id?: string | null
          senderid?: string
          type?: 'text' | 'image' | 'file' | 'audio' | 'system' | 'call'
          content?: string
          attachments?: Json | null
          reply_toid?: string | null
          reply_to_content?: string | null
          reply_to_sender_name?: string | null
          reactions?: Json | null
          mentioned_userids?: string[] | null
          read_by?: Json | null
          poll?: Json | null
          thread_count?: number | null
          thread_last_at?: number | null
          scheduled_for?: number | null
          is_sent?: boolean | null
          link_preview?: Json | null
          parent_messageid?: string | null
          is_edited?: boolean | null
          edited_at?: number | null
          is_deleted?: boolean | null
          deleted_at?: number | null
          deleted_for_users?: string[] | null
          is_pinned?: boolean | null
          pinned_by?: string | null
          pinned_at?: number | null
          call_duration?: number | null
          call_type?: 'audio' | 'video' | null
          call_status?: 'ringing' | 'active' | 'ended' | 'missed' | 'declined' | null
          is_service_broadcast?: boolean | null
          broadcast_title?: string | null
          broadcast_icon?: string | null
          created_at?: number
        }
        Relationships: [
          {
            foreignKeyName: "chat_messages_conversationid_fkey"
            columns: ["conversationid"]
            isRelationOneToOne: false
            referencedRelation: "chat_conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chat_messages_organization_id_fkey"
            columns: ["organization_id"]
            isRelationOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chat_messages_senderid_fkey"
            columns: ["senderid"]
            isRelationOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          }
        ]
      }
      tasks: {
        Row: {
          id: string
          organization_id: string | null
          title: string
          description: string | null
          assigned_to: string
          assigned_by: string
          status: 'pending' | 'in_progress' | 'review' | 'completed' | 'cancelled'
          priority: 'low' | 'medium' | 'high' | 'urgent'
          deadline: number | null
          completed_at: number | null
          tags: string[] | null
          attachment_url: string | null
          attachments: Json | null
          created_at: number
          updated_at: number
        }
        Insert: {
          id?: string
          organization_id?: string | null
          title: string
          description?: string | null
          assigned_to: string
          assigned_by: string
          status?: 'pending' | 'in_progress' | 'review' | 'completed' | 'cancelled'
          priority?: 'low' | 'medium' | 'high' | 'urgent'
          deadline?: number | null
          completed_at?: number | null
          tags?: string[] | null
          attachment_url?: string | null
          attachments?: Json | null
          created_at?: number
          updated_at?: number
        }
        Update: {
          id?: string
          organization_id?: string | null
          title?: string
          description?: string | null
          assigned_to?: string
          assigned_by?: string
          status?: 'pending' | 'in_progress' | 'review' | 'completed' | 'cancelled'
          priority?: 'low' | 'medium' | 'high' | 'urgent'
          deadline?: number | null
          completed_at?: number | null
          tags?: string[] | null
          attachment_url?: string | null
          attachments?: Json | null
          created_at?: number
          updated_at?: number
        }
        Relationships: [
          {
            foreignKeyName: "tasks_organization_id_fkey"
            columns: ["organization_id"]
            isRelationOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_assigned_to_fkey"
            columns: ["assigned_to"]
            isRelationOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_assigned_by_fkey"
            columns: ["assigned_by"]
            isRelationOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          }
        ]
      }
      task_comments: {
        Row: {
          id: string
          taskid: string
          authorid: string
          content: string
          created_at: number
        }
        Insert: {
          id?: string
          taskid: string
          authorid: string
          content: string
          created_at?: number
        }
        Update: {
          id?: string
          taskid?: string
          authorid?: string
          content?: string
          created_at?: number
        }
        Relationships: [
          {
            foreignKeyName: "task_comments_taskid_fkey"
            columns: ["taskid"]
            isRelationOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "task_comments_authorid_fkey"
            columns: ["authorid"]
            isRelationOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          }
        ]
      }
      drivers: {
        Row: {
          id: string
          organization_id: string
          userid: string
          vehicle_model: string
          vehicle_plate_number: string
          vehicle_capacity: number
          vehicle_color: string | null
          vehicle_year: number | null
          is_available: boolean
          is_on_shift: boolean | null
          last_status_update_at: number | null
          working_hours_start: string
          working_hours_end: string
          working_days: number[]
          max_trips_per_day: number
          current_trips_today: number
          rating: number
          total_trips: number
          kpi_metrics: Json | null
          current_shift_start: number | null
          current_shift_end: number | null
          overtime_hours: number | null
          last_maintenance_date: number | null
          next_maintenance_due: number | null
          vehicle_mileage: number | null
          inspection_status: 'passed' | 'failed' | 'overdue' | null
          created_at: number
          updated_at: number
        }
        Insert: {
          id?: string
          organization_id: string
          userid: string
          vehicle_model: string
          vehicle_plate_number: string
          vehicle_capacity: number
          vehicle_color?: string | null
          vehicle_year?: number | null
          is_available?: boolean
          is_on_shift?: boolean | null
          last_status_update_at?: number | null
          working_hours_start: string
          working_hours_end: string
          working_days?: number[]
          max_trips_per_day?: number
          current_trips_today?: number
          rating?: number
          total_trips?: number
          kpi_metrics?: Json | null
          current_shift_start?: number | null
          current_shift_end?: number | null
          overtime_hours?: number | null
          last_maintenance_date?: number | null
          next_maintenance_due?: number | null
          vehicle_mileage?: number | null
          inspection_status?: 'passed' | 'failed' | 'overdue' | null
          created_at?: number
          updated_at?: number
        }
        Update: {
          id?: string
          organization_id?: string
          userid?: string
          vehicle_model?: string
          vehicle_plate_number?: string
          vehicle_capacity?: number
          vehicle_color?: string | null
          vehicle_year?: number | null
          is_available?: boolean
          is_on_shift?: boolean | null
          last_status_update_at?: number | null
          working_hours_start?: string
          working_hours_end?: string
          working_days?: number[]
          max_trips_per_day?: number
          current_trips_today?: number
          rating?: number
          total_trips?: number
          kpi_metrics?: Json | null
          current_shift_start?: number | null
          current_shift_end?: number | null
          overtime_hours?: number | null
          last_maintenance_date?: number | null
          next_maintenance_due?: number | null
          vehicle_mileage?: number | null
          inspection_status?: 'passed' | 'failed' | 'overdue' | null
          created_at?: number
          updated_at?: number
        }
        Relationships: [
          {
            foreignKeyName: "drivers_organization_id_fkey"
            columns: ["organization_id"]
            isRelationOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "drivers_userid_fkey"
            columns: ["userid"]
            isRelationOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          }
        ]
      }
      subscriptions: {
        Row: {
          id: string
          organization_id: string | null
          stripe_customerid: string
          stripe_subscriptionid: string
          stripe_sessionid: string | null
          plan: 'starter' | 'professional' | 'enterprise'
          status: 'trialing' | 'active' | 'past_due' | 'canceled' | 'incomplete'
          email: string | null
          userid: string | null
          current_period_start: number | null
          current_period_end: number | null
          cancel_at_period_end: boolean
          trial_end: number | null
          created_at: number
          updated_at: number
        }
        Insert: {
          id?: string
          organization_id?: string | null
          stripe_customerid: string
          stripe_subscriptionid: string
          stripe_sessionid?: string | null
          plan: 'starter' | 'professional' | 'enterprise'
          status?: 'trialing' | 'active' | 'past_due' | 'canceled' | 'incomplete'
          email?: string | null
          userid?: string | null
          current_period_start?: number | null
          current_period_end?: number | null
          cancel_at_period_end?: boolean
          trial_end?: number | null
          created_at?: number
          updated_at?: number
        }
        Update: {
          id?: string
          organization_id?: string | null
          stripe_customerid?: string
          stripe_subscriptionid?: string
          stripe_sessionid?: string | null
          plan?: 'starter' | 'professional' | 'enterprise'
          status?: 'trialing' | 'active' | 'past_due' | 'canceled' | 'incomplete'
          email?: string | null
          userid?: string | null
          current_period_start?: number | null
          current_period_end?: number | null
          cancel_at_period_end?: boolean
          trial_end?: number | null
          created_at?: number
          updated_at?: number
        }
        Relationships: [
          {
            foreignKeyName: "subscriptions_organization_id_fkey"
            columns: ["organization_id"]
            isRelationOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "subscriptions_userid_fkey"
            columns: ["userid"]
            isRelationOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          }
        ]
      }
      login_attempts: {
        Row: {
          id: string
          email: string
          userid: string | null
          organization_id: string | null
          success: boolean
          method: 'password' | 'faceid' | 'webauthn' | 'google'
          ip: string | null
          user_agent: string | null
          device_fingerprint: string | null
          risk_score: number | null
          risk_factors: Json | null
          blocked_reason: string | null
          country: string | null
          city: string | null
          created_at: number
        }
        Insert: {
          id?: string
          email: string
          userid?: string | null
          organization_id?: string | null
          success?: boolean
          method: 'password' | 'faceid' | 'webauthn' | 'google'
          ip?: string | null
          user_agent?: string | null
          device_fingerprint?: string | null
          risk_score?: number | null
          risk_factors?: Json | null
          blocked_reason?: string | null
          country?: string | null
          city?: string | null
          created_at?: number
        }
        Update: {
          id?: string
          email?: string
          userid?: string | null
          organization_id?: string | null
          success?: boolean
          method?: 'password' | 'faceid' | 'webauthn' | 'google'
          ip?: string | null
          user_agent?: string | null
          device_fingerprint?: string | null
          risk_score?: number | null
          risk_factors?: Json | null
          blocked_reason?: string | null
          country?: string | null
          city?: string | null
          created_at?: number
        }
        Relationships: [
          {
            foreignKeyName: "login_attempts_userid_fkey"
            columns: ["userid"]
            isRelationOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "login_attempts_organization_id_fkey"
            columns: ["organization_id"]
            isRelationOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          }
        ]
      }
      impersonation_sessions: {
        Row: {
          id: string
          superadminid: string
          target_userid: string
          organization_id: string
          reason: string
          token: string
          is_active: boolean
          started_at: number
          ended_at: number | null
          expires_at: number
        }
        Insert: {
          id?: string
          superadminid: string
          target_userid: string
          organization_id: string
          reason: string
          token: string
          is_active?: boolean
          started_at?: number
          ended_at?: number | null
          expires_at: number
        }
        Update: {
          id?: string
          superadminid?: string
          target_userid?: string
          organization_id?: string
          reason?: string
          token?: string
          is_active?: boolean
          started_at?: number
          ended_at?: number | null
          expires_at?: number
        }
        Relationships: [
          {
            foreignKeyName: "impersonation_sessions_superadminid_fkey"
            columns: ["superadminid"]
            isRelationOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "impersonation_sessions_target_userid_fkey"
            columns: ["target_userid"]
            isRelationOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "impersonation_sessions_organization_id_fkey"
            columns: ["organization_id"]
            isRelationOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          }
        ]
      }
      maintenance_modes: {
        Row: {
          id: string
          organization_id: string
          is_active: boolean
          title: string
          message: string
          start_time: number
          end_time: number | null
          estimated_duration: string | null
          icon: string | null
          enabled_by: string
          created_at: number
          updated_at: number
        }
        Insert: {
          id?: string
          organization_id: string
          is_active?: boolean
          title: string
          message: string
          start_time: number
          end_time?: number | null
          estimated_duration?: string | null
          icon?: string | null
          enabled_by: string
          created_at?: number
          updated_at?: number
        }
        Update: {
          id?: string
          organization_id?: string
          is_active?: boolean
          title?: string
          message?: string
          start_time?: number
          end_time?: number | null
          estimated_duration?: string | null
          icon?: string | null
          enabled_by?: string
          created_at?: number
          updated_at?: number
        }
        Relationships: [
          {
            foreignKeyName: "maintenance_modes_organization_id_fkey"
            columns: ["organization_id"]
            isRelationOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "maintenance_modes_enabled_by_fkey"
            columns: ["enabled_by"]
            isRelationOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          }
        ]
      }
      company_events: {
        Row: {
          id: string
          organization_id: string
          name: string
          description: string | null
          start_date: number
          end_date: number
          is_all_day: boolean
          required_departments: string[]
          required_employeeids: string[] | null
          event_type: string
          priority: 'high' | 'medium' | 'low' | null
          created_by: string
          notify_days_before: number | null
          notified_at: number | null
          created_at: number
          updated_at: number
        }
        Insert: {
          id?: string
          organization_id: string
          name: string
          description?: string | null
          start_date: number
          end_date: number
          is_all_day?: boolean
          required_departments?: string[]
          required_employeeids?: string[] | null
          event_type: string
          priority?: 'high' | 'medium' | 'low' | null
          created_by: string
          notify_days_before?: number | null
          notified_at?: number | null
          created_at?: number
          updated_at?: number
        }
        Update: {
          id?: string
          organization_id?: string
          name?: string
          description?: string | null
          start_date?: number
          end_date?: number
          is_all_day?: boolean
          required_departments?: string[]
          required_employeeids?: string[] | null
          event_type?: string
          priority?: 'high' | 'medium' | 'low' | null
          created_by?: string
          notify_days_before?: number | null
          notified_at?: number | null
          created_at?: number
          updated_at?: number
        }
        Relationships: [
          {
            foreignKeyName: "company_events_organization_id_fkey"
            columns: ["organization_id"]
            isRelationOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "company_events_created_by_fkey"
            columns: ["created_by"]
            isRelationOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          }
        ]
      }
      organization_join_requests: {
        Row: {
          id: string
          organization_id: string | null
          requester_name: string
          requester_email: string
          requester_phone: string | null
          status: string
          reviewed_by: string | null
          reviewed_at: number | null
          review_notes: string | null
          created_at: number
          updated_at: number | null
        }
        Insert: {
          id?: string
          organization_id?: string | null
          requester_name: string
          requester_email: string
          requester_phone?: string | null
          status?: string
          reviewed_by?: string | null
          reviewed_at?: number | null
          review_notes?: string | null
          created_at?: number
          updated_at?: number | null
        }
        Update: {
          id?: string
          organization_id?: string | null
          requester_name?: string
          requester_email?: string
          requester_phone?: string | null
          status?: string
          reviewed_by?: string | null
          reviewed_at?: number | null
          review_notes?: string | null
          created_at?: number
          updated_at?: number | null
        }
        Relationships: []
      }
      service_broadcasts: {
        Row: {
          id: string
          organization_id: string
          title: string
          content: string
          icon: string | null
          createdBy: string
          createdAt: number
        }
        Insert: {
          id?: string
          organization_id: string
          title: string
          content: string
          icon?: string | null
          createdBy: string
          createdAt?: number
        }
        Update: {
          id?: string
          organization_id?: string
          title?: string
          content?: string
          icon?: string | null
          createdBy?: string
          createdAt?: number
        }
        Relationships: [
          {
            foreignKeyName: "service_broadcasts_organization_id_fkey"
            columns: ["organization_id"]
            isRelationOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_broadcasts_createdBy_fkey"
            columns: ["createdBy"]
            isRelationOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          }
        ]
      }
      sla_config: {
        Row: {
          id: string
          organization_id: string | null
          target_response_time_hours: number
          warning_threshold_percent: number
          critical_threshold_percent: number
          createdAt: number
          updatedAt: number | null
        }
        Insert: {
          id?: string
          organization_id?: string | null
          target_response_time_hours?: number
          warning_threshold_percent?: number
          critical_threshold_percent?: number
          createdAt?: number
          updatedAt?: number | null
        }
        Update: {
          id?: string
          organization_id?: string | null
          target_response_time_hours?: number
          warning_threshold_percent?: number
          critical_threshold_percent?: number
          createdAt?: number
          updatedAt?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "sla_config_organization_id_fkey"
            columns: ["organization_id"]
            isRelationOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          }
        ]
      }
      sla_metrics: {
        Row: {
          id: string
          organization_id: string | null
          ticketId: string
          first_response_time_hours: number | null
          status: 'within_sla' | 'breached' | 'warning'
          breached_at: number | null
          createdAt: number
        }
        Insert: {
          id?: string
          organization_id?: string | null
          ticketId: string
          first_response_time_hours?: number | null
          status?: 'within_sla' | 'breached' | 'warning'
          breached_at?: number | null
          createdAt?: number
        }
        Update: {
          id?: string
          organization_id?: string | null
          ticketId?: string
          first_response_time_hours?: number | null
          status?: 'within_sla' | 'breached' | 'warning'
          breached_at?: number | null
          createdAt?: number
        }
        Relationships: [
          {
            foreignKeyName: "sla_metrics_organization_id_fkey"
            columns: ["organization_id"]
            isRelationOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          }
        ]
      }
      userPreferences: {
        Row: {
          id: string
          userId: string
          key: string
          value: Json
          createdAt: number
          updatedAt: number
        }
        Insert: {
          id?: string
          userId: string
          key: string
          value: Json
          createdAt?: number
          updatedAt?: number
        }
        Update: {
          id?: string
          userId?: string
          key?: string
          value?: Json
          createdAt?: number
          updatedAt?: number
        }
        Relationships: [
          {
            foreignKeyName: "userPreferences_userId_fkey"
            columns: ["userId"]
            isRelationOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          }
        ]
      }
      tickets: {
        Row: {
          id: string
          organization_id: string | null
          title: string
          description: string
          status: 'open' | 'in_progress' | 'waiting_customer' | 'resolved' | 'closed'
          priority: 'low' | 'medium' | 'high' | 'critical'
          category: 'technical' | 'billing' | 'access' | 'feature_request' | 'bug' | 'other'
          createdBy: string
          assignedTo: string | null
          resolvedAt: number | null
          closedAt: number | null
          createdAt: number
          updatedAt: number | null
        }
        Insert: {
          id?: string
          organization_id?: string | null
          title: string
          description: string
          status?: 'open' | 'in_progress' | 'waiting_customer' | 'resolved' | 'closed'
          priority?: 'low' | 'medium' | 'high' | 'critical'
          category?: 'technical' | 'billing' | 'access' | 'feature_request' | 'bug' | 'other'
          createdBy: string
          assignedTo?: string | null
          resolvedAt?: number | null
          closedAt?: number | null
          createdAt?: number
          updatedAt?: number | null
        }
        Update: {
          id?: string
          organization_id?: string | null
          title?: string
          description?: string
          status?: 'open' | 'in_progress' | 'waiting_customer' | 'resolved' | 'closed'
          priority?: 'low' | 'medium' | 'high' | 'critical'
          category?: 'technical' | 'billing' | 'access' | 'feature_request' | 'bug' | 'other'
          createdBy?: string
          assignedTo?: string | null
          resolvedAt?: number | null
          closedAt?: number | null
          createdAt?: number
          updatedAt?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "tickets_organization_id_fkey"
            columns: ["organization_id"]
            isRelationOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tickets_createdBy_fkey"
            columns: ["createdBy"]
            isRelationOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tickets_assignedTo_fkey"
            columns: ["assignedTo"]
            isRelationOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          }
        ]
      }
      ticket_comments: {
        Row: {
          id: string
          ticketId: string
          userId: string
          content: string
          isInternal: boolean | null
          createdAt: number
          updatedAt: number | null
        }
        Insert: {
          id?: string
          ticketId: string
          userId: string
          content: string
          isInternal?: boolean | null
          createdAt?: number
          updatedAt?: number | null
        }
        Update: {
          id?: string
          ticketId?: string
          userId?: string
          content?: string
          isInternal?: boolean | null
          createdAt?: number
          updatedAt?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "ticket_comments_ticketId_fkey"
            columns: ["ticketId"]
            isRelationOneToOne: false
            referencedRelation: "tickets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ticket_comments_userId_fkey"
            columns: ["userId"]
            isRelationOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          }
        ]
      }
      ai_conversations: {
        Row: {
          id: string
          userid: string
          title: string | null
          created_at: number
          updated_at: number | null
        }
        Insert: {
          id?: string
          userid: string
          title?: string | null
          created_at?: number
          updated_at?: number | null
        }
        Update: {
          id?: string
          userid?: string
          title?: string | null
          created_at?: number
          updated_at?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "ai_conversations_userid_fkey"
            columns: ["userid"]
            isRelationOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          }
        ]
      }
      ai_messages: {
        Row: {
          id: string
          conversationid: string
          role: 'user' | 'assistant' | 'system'
          content: string
          created_at: number
        }
        Insert: {
          id?: string
          conversationid: string
          role: 'user' | 'assistant' | 'system'
          content: string
          created_at?: number
        }
        Update: {
          id?: string
          conversationid?: string
          role?: 'user' | 'assistant' | 'system'
          content?: string
          created_at?: number
        }
        Relationships: [
          {
            foreignKeyName: "ai_messages_conversationid_fkey"
            columns: ["conversationid"]
            isRelationOneToOne: false
            referencedRelation: "ai_conversations"
            referencedColumns: ["id"]
          }
        ]
      }
      time_tracking: {
        Row: {
          id: string
          userid: string
          date: string
          check_in_time: number | null
          check_out_time: number | null
          status: 'checked_in' | 'checked_out' | 'absent'
          total_worked_minutes: number | null
          is_late: boolean | null
          late_minutes: number | null
          is_early_leave: boolean | null
          early_leave_minutes: number | null
          overtime_minutes: number | null
          created_at: number
          updated_at: number | null
        }
        Insert: {
          id?: string
          userid: string
          date: string
          check_in_time?: number | null
          check_out_time?: number | null
          status?: 'checked_in' | 'checked_out' | 'absent'
          total_worked_minutes?: number | null
          is_late?: boolean | null
          late_minutes?: number | null
          is_early_leave?: boolean | null
          early_leave_minutes?: number | null
          overtime_minutes?: number | null
          created_at?: number
          updated_at?: number | null
        }
        Update: {
          id?: string
          userid?: string
          date?: string
          check_in_time?: number | null
          check_out_time?: number | null
          status?: 'checked_in' | 'checked_out' | 'absent'
          total_worked_minutes?: number | null
          is_late?: boolean | null
          late_minutes?: number | null
          is_early_leave?: boolean | null
          early_leave_minutes?: number | null
          overtime_minutes?: number | null
          created_at?: number
          updated_at?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "time_tracking_userid_fkey"
            columns: ["userid"]
            isRelationOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          }
        ]
      }
      ai_evaluations: {
        Row: {
          id: string
          userId: string
          overall_score: number
          breakdown: Record<string, unknown> | null
          createdAt: number
          updatedAt: number | null
        }
        Insert: {
          id?: string
          userId: string
          overall_score?: number
          breakdown?: Record<string, unknown> | null
          createdAt?: number
          updatedAt?: number | null
        }
        Update: {
          id?: string
          userId?: string
          overall_score?: number
          breakdown?: Record<string, unknown> | null
          createdAt?: number
          updatedAt?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "ai_evaluations_userId_fkey"
            columns: ["userId"]
            isRelationOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          }
        ]
      }
      ai_site_editor_sessions: {
        Row: {
          id: string
          userId: string
          organization_id: string | null
          user_message: string | null
          edit_type: string | null
          ai_response: string | null
          changes_made: Json | null
          status: string
          created_at: number
          updated_at: number | null
        }
        Insert: {
          id?: string
          userId: string
          organization_id?: string | null
          user_message?: string | null
          edit_type?: string | null
          ai_response?: string | null
          changes_made?: Json | null
          status?: string
          created_at?: number
          updated_at?: number | null
        }
        Update: {
          id?: string
          userId?: string
          organization_id?: string | null
          user_message?: string | null
          edit_type?: string | null
          ai_response?: string | null
          changes_made?: Json | null
          status?: string
          created_at?: number
          updated_at?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "ai_site_editor_sessions_userId_fkey"
            columns: ["userId"]
            isRelationOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          }
        ]
      }
      organization_invites: {
        Row: {
          id: string
          organization_id: string | null
          requested_by_email: string
          requested_by_name: string
          requested_at: number
          status: 'pending' | 'approved' | 'rejected'
          reviewed_by: string | null
          reviewed_at: number | null
          rejection_reason: string | null
          userid: string | null
          invite_token: string | null
          invite_email: string | null
          invite_expiry: number | null
          created_at: number
        }
        Insert: {
          id?: string
          organization_id?: string | null
          requested_by_email: string
          requested_by_name: string
          requested_at?: number
          status?: 'pending' | 'approved' | 'rejected'
          reviewed_by?: string | null
          reviewed_at?: number | null
          rejection_reason?: string | null
          userid?: string | null
          invite_token?: string | null
          invite_email?: string | null
          invite_expiry?: number | null
          created_at?: number
        }
        Update: {
          id?: string
          organization_id?: string | null
          requested_by_email?: string
          requested_by_name?: string
          requested_at?: number
          status?: 'pending' | 'approved' | 'rejected'
          reviewed_by?: string | null
          reviewed_at?: number | null
          rejection_reason?: string | null
          userid?: string | null
          invite_token?: string | null
          invite_email?: string | null
          invite_expiry?: number | null
          created_at?: number
        }
        Relationships: [
          {
            foreignKeyName: "organization_invites_organization_id_fkey"
            columns: ["organization_id"]
            isRelationOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          }
        ]
      }
      organization_requests: {
        Row: {
          id: string
          requested_name: string
          requested_slug: string
          requested_plan: 'professional' | 'enterprise'
          requester_name: string
          requester_email: string
          requester_phone: string | null
          industry: string | null
          team_size: string | null
          country: string | null
          description: string | null
          status: 'pending' | 'approved' | 'rejected'
          reviewed_by: string | null
          reviewed_at: number | null
          rejection_reason: string | null
          created_at: number
        }
        Insert: {
          id?: string
          requested_name: string
          requested_slug: string
          requested_plan: 'professional' | 'enterprise'
          requester_name: string
          requester_email: string
          requester_phone?: string | null
          industry?: string | null
          team_size?: string | null
          country?: string | null
          description?: string | null
          status?: 'pending' | 'approved' | 'rejected'
          reviewed_by?: string | null
          reviewed_at?: number | null
          rejection_reason?: string | null
          created_at?: number
        }
        Update: {
          id?: string
          requested_name?: string
          requested_slug?: string
          requested_plan?: 'professional' | 'enterprise'
          requester_name?: string
          requester_email?: string
          requester_phone?: string | null
          industry?: string | null
          team_size?: string | null
          country?: string | null
          description?: string | null
          status?: 'pending' | 'approved' | 'rejected'
          reviewed_by?: string | null
          reviewed_at?: number | null
          rejection_reason?: string | null
          created_at?: number
        }
        Relationships: []
      }
      chat_typing: {
        Row: {
          id: string
          conversationid: string
          userid: string
          updated_at: number
        }
        Insert: {
          id?: string
          conversationid: string
          userid: string
          updated_at?: number
        }
        Update: {
          id?: string
          conversationid?: string
          userid?: string
          updated_at?: number
        }
        Relationships: [
          {
            foreignKeyName: "chat_typing_conversationid_fkey"
            columns: ["conversationid"]
            isRelationOneToOne: false
            referencedRelation: "chat_conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chat_typing_userid_fkey"
            columns: ["userid"]
            isRelationOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          }
        ]
      }
      presence: {
        Row: {
          id: string
          userid: string
          online_at: number
          status: string | null
        }
        Insert: {
          id?: string
          userid: string
          online_at?: number
          status?: string | null
        }
        Update: {
          id?: string
          userid?: string
          online_at?: number
          status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "presence_userid_fkey"
            columns: ["userid"]
            isRelationOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          }
        ]
      }
      webauthn_credentials: {
        Row: {
          id: string
          userid: string
          credentialid: string
          public_key: string
          counter: number
          device_name: string | null
          created_at: number
          last_used_at: number | null
        }
        Insert: {
          id?: string
          userid: string
          credentialid: string
          public_key: string
          counter?: number
          device_name?: string | null
          created_at?: number
          last_used_at?: number | null
        }
        Update: {
          id?: string
          userid?: string
          credentialid?: string
          public_key?: string
          counter?: number
          device_name?: string | null
          created_at?: number
          last_used_at?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "webauthn_credentials_userid_fkey"
            columns: ["userid"]
            isRelationOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          }
        ]
      }
      supervisor_ratings: {
        Row: {
          id: string
          organization_id: string | null
          employee_id: string
          supervisorid: string
          rated_by: string
          quality_of_work: number | null
          efficiency: number | null
          teamwork: number | null
          initiative: number | null
          communication: number | null
          reliability: number | null
          overall_rating: number | null
          strengths: string | null
          areas_for_improvement: string | null
          general_comments: string | null
          rating: number
          comment: string | null
          rating_period: string
          created_at: number
          updated_at: number | null
        }
        Insert: {
          id?: string
          organization_id?: string | null
          employee_id: string
          supervisorid: string
          rated_by: string
          quality_of_work?: number | null
          efficiency?: number | null
          teamwork?: number | null
          initiative?: number | null
          communication?: number | null
          reliability?: number | null
          overall_rating?: number | null
          strengths?: string | null
          areas_for_improvement?: string | null
          general_comments?: string | null
          rating?: number
          comment?: string | null
          rating_period?: string
          created_at?: number
          updated_at?: number | null
        }
        Update: {
          id?: string
          organization_id?: string | null
          employee_id?: string
          supervisorid?: string
          rated_by?: string
          quality_of_work?: number | null
          efficiency?: number | null
          teamwork?: number | null
          initiative?: number | null
          communication?: number | null
          reliability?: number | null
          overall_rating?: number | null
          strengths?: string | null
          areas_for_improvement?: string | null
          general_comments?: string | null
          rating?: number
          comment?: string | null
          rating_period?: string
          created_at?: number
          updated_at?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "supervisor_ratings_organization_id_fkey"
            columns: ["organization_id"]
            isRelationOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "supervisor_ratings_supervisorid_fkey"
            columns: ["supervisorid"]
            isRelationOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "supervisor_ratings_rated_by_fkey"
            columns: ["rated_by"]
            isRelationOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          }
        ]
      }
      automation_tasks: {
        Row: {
          id: string
          name: string
          status: 'pending' | 'running' | 'completed' | 'failed'
          created_at: number
          updated_at: number
        }
        Insert: {
          id?: string
          name: string
          status?: 'pending' | 'running' | 'completed' | 'failed'
          created_at?: number
          updated_at?: number
        }
        Update: {
          id?: string
          name?: string
          status?: 'pending' | 'running' | 'completed' | 'failed'
          created_at?: number
          updated_at?: number
        }
        Relationships: []
      }
      automation_workflows: {
        Row: {
          id: string
          name: string
          is_active: boolean
          created_at: number
          updated_at: number
        }
        Insert: {
          id?: string
          name: string
          is_active?: boolean
          created_at?: number
          updated_at?: number
        }
        Update: {
          id?: string
          name?: string
          is_active?: boolean
          created_at?: number
          updated_at?: number
        }
        Relationships: []
      }
      leave_conflict_alerts: {
        Row: {
          id: string
          organization_id: string
          employee_id: string
          event_id: string
          leave_request_id: string
          leave_start_date: string
          leave_end_date: string
          leave_type: string
          conflict_type: string
          severity: string
          is_reviewed: boolean
          reviewed_by: string | null
          reviewed_at: number | null
          review_notes: string | null
          created_at: number
        }
        Insert: {
          id?: string
          organization_id: string
          employee_id: string
          event_id: string
          leave_request_id: string
          leave_start_date: string
          leave_end_date: string
          leave_type: string
          conflict_type: string
          severity: string
          is_reviewed?: boolean
          reviewed_by?: string | null
          reviewed_at?: number | null
          review_notes?: string | null
          created_at?: number
        }
        Update: {
          id?: string
          organization_id?: string
          employee_id?: string
          event_id?: string
          leave_request_id?: string
          leave_start_date?: string
          leave_end_date?: string
          leave_type?: string
          conflict_type?: string
          severity?: string
          is_reviewed?: boolean
          reviewed_by?: string | null
          reviewed_at?: number | null
          review_notes?: string | null
          created_at?: number
        }
        Relationships: [
          {
            foreignKeyName: "leave_conflict_alerts_organization_id_fkey"
            columns: ["organization_id"]
            isRelationOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leave_conflict_alerts_employee_id_fkey"
            columns: ["employee_id"]
            isRelationOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leave_conflict_alerts_event_id_fkey"
            columns: ["event_id"]
            isRelationOneToOne: false
            referencedRelation: "company_events"
            referencedColumns: ["id"]
          }
        ]
      }
      driver_schedules: {
        Row: {
          id: string
          driverid: string
          start_time: number
          end_time: number
          status: 'scheduled' | 'in_progress' | 'completed' | 'cancelled'
          schedule_type: 'trip' | 'blocked' | 'maintenance' | 'time_off'
          trip_from: string | null
          trip_to: string | null
          trip_purpose: string | null
          passenger_count: number | null
          notes: string | null
          created_at: number
          updated_at: number
        }
        Insert: {
          id?: string
          driverid: string
          start_time: number
          end_time: number
          status?: 'scheduled' | 'in_progress' | 'completed' | 'cancelled'
          schedule_type?: 'trip' | 'blocked' | 'maintenance' | 'time_off'
          trip_from?: string | null
          trip_to?: string | null
          trip_purpose?: string | null
          passenger_count?: number | null
          notes?: string | null
          created_at?: number
          updated_at?: number
        }
        Update: {
          id?: string
          driverid?: string
          start_time?: number
          end_time?: number
          status?: 'scheduled' | 'in_progress' | 'completed' | 'cancelled'
          schedule_type?: 'trip' | 'blocked' | 'maintenance' | 'time_off'
          trip_from?: string | null
          trip_to?: string | null
          trip_purpose?: string | null
          passenger_count?: number | null
          notes?: string | null
          created_at?: number
          updated_at?: number
        }
        Relationships: [
          {
            foreignKeyName: "driver_schedules_driverid_fkey"
            columns: ["driverid"]
            isRelationOneToOne: false
            referencedRelation: "drivers"
            referencedColumns: ["id"]
          }
        ]
      }
      driver_requests: {
        Row: {
          id: string
          organization_id: string | null
          requesterid: string
          driverid: string
          start_time: number
          end_time: number
          trip_from: string
          trip_to: string
          trip_purpose: string
          passenger_count: number
          trip_notes: string | null
          status: 'pending' | 'approved' | 'declined' | 'cancelled' | 'completed'
          created_at: number
          updated_at: number
        }
        Insert: {
          id?: string
          organization_id?: string | null
          requesterid: string
          driverid: string
          start_time: number
          end_time: number
          trip_from?: string
          trip_to?: string
          trip_purpose?: string
          passenger_count?: number
          trip_notes?: string | null
          status?: 'pending' | 'approved' | 'declined' | 'cancelled' | 'completed'
          created_at?: number
          updated_at?: number
        }
        Update: {
          id?: string
          organization_id?: string | null
          requesterid?: string
          driverid?: string
          start_time?: number
          end_time?: number
          trip_from?: string
          trip_to?: string
          trip_purpose?: string
          passenger_count?: number
          trip_notes?: string | null
          status?: 'pending' | 'approved' | 'declined' | 'cancelled' | 'completed'
          created_at?: number
          updated_at?: number
        }
        Relationships: [
          {
            foreignKeyName: "driver_requests_organization_id_fkey"
            columns: ["organization_id"]
            isRelationOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "driver_requests_requesterid_fkey"
            columns: ["requesterid"]
            isRelationOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "driver_requests_driverid_fkey"
            columns: ["driverid"]
            isRelationOneToOne: false
            referencedRelation: "drivers"
            referencedColumns: ["id"]
          }
        ]
      }
      audit_logs: {
        Row: {
          id: string
          userid: string | null
          action: string
          details: Json | null
          ip: string | null
          created_at: number
        }
        Insert: {
          id?: string
          userid?: string | null
          action: string
          details?: Json | null
          ip?: string | null
          created_at?: number
        }
        Update: {
          id?: string
          userid?: string | null
          action?: string
          details?: Json | null
          ip?: string | null
          created_at?: number
        }
        Relationships: [
          {
            foreignKeyName: "audit_logs_userid_fkey"
            columns: ["userid"]
            isRelationOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          }
        ]
      }
      contact_inquiries: {
        Row: {
          id: string
          name: string
          email: string
          company: string | null
          team_size: number | null
          message: string
          plan: string | null
          created_at: number
        }
        Insert: {
          id?: string
          name: string
          email: string
          company?: string | null
          team_size?: number | null
          message: string
          plan?: string | null
          created_at?: number
        }
        Update: {
          id?: string
          name?: string
          email?: string
          company?: string | null
          team_size?: number | null
          message?: string
          plan?: string | null
          created_at?: number
        }
        Relationships: []
      }
      security_settings: {
        Row: {
          id: string
          key: string
          enabled: boolean
          updated_by: string
          updated_at: number
          description: string | null
        }
        Insert: {
          id?: string
          key: string
          enabled?: boolean
          updated_by: string
          updated_at?: number
          description?: string | null
        }
        Update: {
          id?: string
          key?: string
          enabled?: boolean
          updated_by?: string
          updated_at?: number
          description?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "security_settings_updated_by_fkey"
            columns: ["updated_by"]
            isRelationOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          }
        ]
      }
      sync_logs: {
        Row: {
          id: string
          organization_id: string
          triggered_by: string
          created_count: number
          updated_count: number
          deactivated_count: number
          error_count: number
          created_at: number
        }
        Insert: {
          id?: string
          organization_id: string
          triggered_by: string
          created_count?: number
          updated_count?: number
          deactivated_count?: number
          error_count?: number
          created_at?: number
        }
        Update: {
          id?: string
          organization_id?: string
          triggered_by?: string
          created_count?: number
          updated_count?: number
          deactivated_count?: number
          error_count?: number
          created_at?: number
        }
        Relationships: [
          {
            foreignKeyName: "sync_logs_organization_id_fkey"
            columns: ["organization_id"]
            isRelationOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sync_logs_triggered_by_fkey"
            columns: ["triggered_by"]
            isRelationOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          }
        ]
      }
      recurring_trips: {
        Row: {
          id: string
          organization_id: string | null
          userid: string
          driverid: string
          trip_from: string
          trip_to: string
          trip_purpose: string
          schedule: Json
          is_active: boolean
          created_at: number
          updated_at: number
        }
        Insert: {
          id?: string
          organization_id?: string | null
          userid: string
          driverid: string
          trip_from: string
          trip_to: string
          trip_purpose?: string
          schedule: Json
          is_active?: boolean
          created_at?: number
          updated_at?: number
        }
        Update: {
          id?: string
          organization_id?: string | null
          userid?: string
          driverid?: string
          trip_from?: string
          trip_to?: string
          trip_purpose?: string
          schedule?: Json
          is_active?: boolean
          created_at?: number
          updated_at?: number
        }
        Relationships: [
          {
            foreignKeyName: "recurring_trips_organization_id_fkey"
            columns: ["organization_id"]
            isRelationOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recurring_trips_userid_fkey"
            columns: ["userid"]
            isRelationOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recurring_trips_driverid_fkey"
            columns: ["driverid"]
            isRelationOneToOne: false
            referencedRelation: "drivers"
            referencedColumns: ["id"]
          }
        ]
      }
      passenger_favorites: {
        Row: {
          id: string
          passengerid: string
          driverid: string
          organization_id: string | null
          created_at: number
        }
        Insert: {
          id?: string
          passengerid: string
          driverid: string
          organization_id?: string | null
          created_at?: number
        }
        Update: {
          id?: string
          passengerid?: string
          driverid?: string
          organization_id?: string | null
          created_at?: number
        }
        Relationships: [
          {
            foreignKeyName: "passenger_favorites_passengerid_fkey"
            columns: ["passengerid"]
            isRelationOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "passenger_favorites_driverid_fkey"
            columns: ["driverid"]
            isRelationOneToOne: false
            referencedRelation: "drivers"
            referencedColumns: ["id"]
          }
        ]
      }
      passenger_ratings: {
        Row: {
          id: string
          scheduleid: string | null
          requestid: string | null
          passengerid: string
          driverid: string
          organization_id: string | null
          rating: number
          comment: string | null
          created_at: number
        }
        Insert: {
          id?: string
          scheduleid?: string | null
          requestid?: string | null
          passengerid: string
          driverid: string
          organization_id?: string | null
          rating: number
          comment?: string | null
          created_at?: number
        }
        Update: {
          id?: string
          scheduleid?: string | null
          requestid?: string | null
          passengerid?: string
          driverid?: string
          organization_id?: string | null
          rating?: number
          comment?: string | null
          created_at?: number
        }
        Relationships: [
          {
            foreignKeyName: "passenger_ratings_passengerid_fkey"
            columns: ["passengerid"]
            isRelationOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "passenger_ratings_driverid_fkey"
            columns: ["driverid"]
            isRelationOneToOne: false
            referencedRelation: "drivers"
            referencedColumns: ["id"]
          }
        ]
      }
      driver_shifts: {
        Row: {
          id: string
          organization_id: string | null
          driverid: string
          start_time: number
          end_time: number | null
          status: 'active' | 'completed' | 'paused' | 'overtime'
          created_at: number
          updated_at: number
        }
        Insert: {
          id?: string
          organization_id?: string | null
          driverid: string
          start_time: number
          end_time?: number | null
          status?: 'active' | 'completed' | 'paused' | 'overtime'
          created_at?: number
          updated_at?: number
        }
        Update: {
          id?: string
          organization_id?: string | null
          driverid?: string
          start_time?: number
          end_time?: number | null
          status?: 'active' | 'completed' | 'paused' | 'overtime'
          created_at?: number
          updated_at?: number
        }
        Relationships: [
          {
            foreignKeyName: "driver_shifts_organization_id_fkey"
            columns: ["organization_id"]
            isRelationOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "driver_shifts_driverid_fkey"
            columns: ["driverid"]
            isRelationOneToOne: false
            referencedRelation: "drivers"
            referencedColumns: ["id"]
          }
        ]
      }
      vehicles: {
        Row: {
          id: string
          organization_id: string | null
          driverid: string
          model: string
          year: number | null
          color: string | null
          plate_number: string
          capacity: number
          created_at: number
          updated_at: number
        }
        Insert: {
          id?: string
          organization_id?: string | null
          driverid: string
          model: string
          year?: number | null
          color?: string | null
          plate_number: string
          capacity?: number
          created_at?: number
          updated_at?: number
        }
        Update: {
          id?: string
          organization_id?: string | null
          driverid?: string
          model?: string
          year?: number | null
          color?: string | null
          plate_number?: string
          capacity?: number
          created_at?: number
          updated_at?: number
        }
        Relationships: [
          {
            foreignKeyName: "vehicles_organization_id_fkey"
            columns: ["organization_id"]
            isRelationOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vehicles_driverid_fkey"
            columns: ["driverid"]
            isRelationOneToOne: false
            referencedRelation: "drivers"
            referencedColumns: ["id"]
          }
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      org_plan: 'starter' | 'professional' | 'enterprise'
      user_role: 'superadmin' | 'admin' | 'supervisor' | 'employee' | 'driver'
      employee_type: 'staff' | 'contractor'
      presence_status: 'available' | 'in_meeting' | 'in_call' | 'out_of_office' | 'busy'
      leave_type: 'paid' | 'unpaid' | 'sick' | 'family' | 'doctor'
      leave_status: 'pending' | 'approved' | 'rejected'
      ticket_priority: 'low' | 'medium' | 'high' | 'critical'
      ticket_status: 'open' | 'in_progress' | 'waiting_customer' | 'resolved' | 'closed'
      ticket_category: 'technical' | 'billing' | 'access' | 'feature_request' | 'bug' | 'other'
      chat_type: 'direct' | 'group'
      chat_member_role: 'owner' | 'admin' | 'member'
      message_type: 'text' | 'image' | 'file' | 'audio' | 'system' | 'call'
      call_type: 'audio' | 'video'
      call_status: 'ringing' | 'active' | 'ended' | 'missed' | 'declined'
      task_status: 'pending' | 'in_progress' | 'review' | 'completed' | 'cancelled'
      task_priority: 'low' | 'medium' | 'high' | 'urgent'
      event_type: 'meeting' | 'conference' | 'training' | 'team_building' | 'holiday' | 'deadline' | 'other'
      event_priority: 'high' | 'medium' | 'low'
      driver_shift_status: 'active' | 'completed' | 'paused' | 'overtime'
      driver_schedule_type: 'trip' | 'blocked' | 'maintenance' | 'time_off'
      driver_schedule_status: 'scheduled' | 'in_progress' | 'completed' | 'cancelled'
      trip_priority: 'P0' | 'P1' | 'P2' | 'P3'
      trip_category: 'client_meeting' | 'airport' | 'office_transfer' | 'emergency' | 'team_event' | 'personal'
      driver_request_status: 'pending' | 'approved' | 'declined' | 'cancelled' | 'completed'
      calendar_access_level: 'full' | 'busy_only' | 'none'
      inspection_status: 'passed' | 'failed' | 'overdue'
      document_category: 'resume' | 'contract' | 'certificate' | 'performance_review' | 'id_document' | 'other'
      note_type: 'performance' | 'behavior' | 'achievement' | 'concern' | 'general'
      note_visibility: 'private' | 'hr_only' | 'manager_only' | 'employee_visible'
      sentiment: 'positive' | 'neutral' | 'negative'
      time_status: 'checked_in' | 'checked_out' | 'absent'
      subscription_plan: 'starter' | 'professional' | 'enterprise'
      subscription_status: 'trialing' | 'active' | 'past_due' | 'canceled' | 'incomplete'
      notification_type: 'leave_request' | 'leave_approved' | 'leave_rejected' | 'driver_request' | 'driver_request_approved' | 'driver_request_rejected' | 'employee_added' | 'join_request' | 'join_approved' | 'join_rejected' | 'security_alert' | 'status_change' | 'message_mention' | 'system'
      invite_status: 'pending' | 'approved' | 'rejected'
      request_status: 'pending' | 'approved' | 'rejected'
      automation_trigger: 'leave_created' | 'leave_pending_hours' | 'user_inactive_days' | 'sla_breach' | 'multiple_failed_logins' | 'ticket_created' | 'ticket_priority'
      automation_action: 'auto_approve' | 'auto_reject' | 'send_notification' | 'escalate' | 'create_ticket' | 'block_user' | 'assign_user'
      automation_task_status: 'pending' | 'running' | 'completed' | 'failed'
      incident_severity: 'low' | 'medium' | 'high' | 'critical'
      incident_status: 'investigating' | 'identified' | 'monitoring' | 'resolved'
      login_method: 'password' | 'faceid' | 'webauthn' | 'google'
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

export type Tables<
  PublicTableNameOrOptions extends
    | keyof (Database['public']['Tables'] & Database['public']['Views'])
    | { schema: keyof Database },
  TableName extends PublicTableNameOrOptions extends { schema: keyof Database }
    ? keyof (Database[PublicTableNameOrOptions['schema']]['Tables'] &
        Database[PublicTableNameOrOptions['schema']]['Views'])
    : never = never
> = PublicTableNameOrOptions extends { schema: keyof Database }
  ? (Database[PublicTableNameOrOptions['schema']]['Tables'] &
      Database[PublicTableNameOrOptions['schema']]['Views'])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : PublicTableNameOrOptions extends keyof (Database['public']['Tables'] &
      Database['public']['Views'])
  ? (Database['public']['Tables'] &
      Database['public']['Views'])[PublicTableNameOrOptions] extends {
      Row: infer R
    }
    ? R
    : never
  : never

export type TablesInsert<
  PublicTableNameOrOptions extends
    | keyof Database['public']['Tables']
    | { schema: keyof Database },
  TableName extends PublicTableNameOrOptions extends { schema: keyof Database }
    ? keyof Database[PublicTableNameOrOptions['schema']]['Tables']
    : never = never
> = PublicTableNameOrOptions extends { schema: keyof Database }
  ? Database[PublicTableNameOrOptions['schema']]['Tables'][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : PublicTableNameOrOptions extends keyof Database['public']['Tables']
  ? Database['public']['Tables'][PublicTableNameOrOptions] extends {
      Insert: infer I
    }
    ? I
    : never
  : never

export type TablesUpdate<
  PublicTableNameOrOptions extends
    | keyof Database['public']['Tables']
    | { schema: keyof Database },
  TableName extends PublicTableNameOrOptions extends { schema: keyof Database }
    ? keyof Database[PublicTableNameOrOptions['schema']]['Tables']
    : never = never
> = PublicTableNameOrOptions extends { schema: keyof Database }
  ? Database[PublicTableNameOrOptions['schema']]['Tables'][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : PublicTableNameOrOptions extends keyof Database['public']['Tables']
  ? Database['public']['Tables'][PublicTableNameOrOptions] extends {
      Update: infer U
    }
    ? U
    : never
  : never
