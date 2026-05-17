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
      admin_activity_log: {
        Row: {
          action_type: string
          created_at: string | null
          id: string
          metadata: Json | null
          performed_by: string
          teacher_id: string | null
        }
        Insert: {
          action_type: string
          created_at?: string | null
          id?: string
          metadata?: Json | null
          performed_by: string
          teacher_id?: string | null
        }
        Update: {
          action_type?: string
          created_at?: string | null
          id?: string
          metadata?: Json | null
          performed_by?: string
          teacher_id?: string | null
        }
        Relationships: []
      }
      announcement_comments: {
        Row: {
          announcement_id: string
          author_id: string
          author_type: string
          body: string
          created_at: string | null
          deleted_at: string | null
          id: string
        }
        Insert: {
          announcement_id: string
          author_id: string
          author_type: string
          body: string
          created_at?: string | null
          deleted_at?: string | null
          id?: string
        }
        Update: {
          announcement_id?: string
          author_id?: string
          author_type?: string
          body?: string
          created_at?: string | null
          deleted_at?: string | null
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "announcement_comments_announcement_id_fkey"
            columns: ["announcement_id"]
            isOneToOne: false
            referencedRelation: "announcements"
            referencedColumns: ["id"]
          },
        ]
      }
      announcement_reads: {
        Row: {
          announcement_id: string
          id: string
          read_at: string | null
          student_id: string
        }
        Insert: {
          announcement_id: string
          id?: string
          read_at?: string | null
          student_id: string
        }
        Update: {
          announcement_id?: string
          id?: string
          read_at?: string | null
          student_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "announcement_reads_announcement_id_fkey"
            columns: ["announcement_id"]
            isOneToOne: false
            referencedRelation: "announcements"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "announcement_reads_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      announcements: {
        Row: {
          body: string
          cohort_id: string
          created_at: string | null
          deleted_at: string | null
          file_url: string | null
          id: string
          pinned: boolean | null
          pinned_at: string | null
          teacher_id: string
          updated_at: string | null
        }
        Insert: {
          body: string
          cohort_id: string
          created_at?: string | null
          deleted_at?: string | null
          file_url?: string | null
          id?: string
          pinned?: boolean | null
          pinned_at?: string | null
          teacher_id: string
          updated_at?: string | null
        }
        Update: {
          body?: string
          cohort_id?: string
          created_at?: string | null
          deleted_at?: string | null
          file_url?: string | null
          id?: string
          pinned?: boolean | null
          pinned_at?: string | null
          teacher_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "announcements_cohort_id_fkey"
            columns: ["cohort_id"]
            isOneToOne: false
            referencedRelation: "cohorts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "announcements_teacher_id_fkey"
            columns: ["teacher_id"]
            isOneToOne: false
            referencedRelation: "teachers"
            referencedColumns: ["id"]
          },
        ]
      }
      assignment_submissions: {
        Row: {
          assignment_id: string
          file_url: string | null
          id: string
          reviewed_at: string | null
          status: string
          student_id: string
          submitted_at: string | null
          text_answer: string | null
        }
        Insert: {
          assignment_id: string
          file_url?: string | null
          id?: string
          reviewed_at?: string | null
          status: string
          student_id: string
          submitted_at?: string | null
          text_answer?: string | null
        }
        Update: {
          assignment_id?: string
          file_url?: string | null
          id?: string
          reviewed_at?: string | null
          status?: string
          student_id?: string
          submitted_at?: string | null
          text_answer?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "assignment_submissions_assignment_id_fkey"
            columns: ["assignment_id"]
            isOneToOne: false
            referencedRelation: "assignments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assignment_submissions_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      assignments: {
        Row: {
          cohort_id: string
          created_at: string | null
          deleted_at: string | null
          description: string
          due_date: string
          file_url: string | null
          id: string
          teacher_id: string
          title: string
        }
        Insert: {
          cohort_id: string
          created_at?: string | null
          deleted_at?: string | null
          description: string
          due_date: string
          file_url?: string | null
          id?: string
          teacher_id: string
          title: string
        }
        Update: {
          cohort_id?: string
          created_at?: string | null
          deleted_at?: string | null
          description?: string
          due_date?: string
          file_url?: string | null
          id?: string
          teacher_id?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "assignments_cohort_id_fkey"
            columns: ["cohort_id"]
            isOneToOne: false
            referencedRelation: "cohorts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assignments_teacher_id_fkey"
            columns: ["teacher_id"]
            isOneToOne: false
            referencedRelation: "teachers"
            referencedColumns: ["id"]
          },
        ]
      }
      attendance: {
        Row: {
          class_session_id: string
          id: string
          marked_at: string | null
          present: boolean
          student_id: string
        }
        Insert: {
          class_session_id: string
          id?: string
          marked_at?: string | null
          present: boolean
          student_id: string
        }
        Update: {
          class_session_id?: string
          id?: string
          marked_at?: string | null
          present?: boolean
          student_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "attendance_class_session_id_fkey"
            columns: ["class_session_id"]
            isOneToOne: false
            referencedRelation: "class_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      attendance_edits: {
        Row: {
          attendance_id: string
          edited_at: string
          id: string
          new_present: boolean
          previous_present: boolean
          reason: string
          teacher_id: string
        }
        Insert: {
          attendance_id: string
          edited_at?: string
          id?: string
          new_present: boolean
          previous_present: boolean
          reason: string
          teacher_id: string
        }
        Update: {
          attendance_id?: string
          edited_at?: string
          id?: string
          new_present?: boolean
          previous_present?: boolean
          reason?: string
          teacher_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "attendance_edits_attendance_id_fkey"
            columns: ["attendance_id"]
            isOneToOne: false
            referencedRelation: "attendance"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_edits_teacher_id_fkey"
            columns: ["teacher_id"]
            isOneToOne: false
            referencedRelation: "teachers"
            referencedColumns: ["id"]
          },
        ]
      }
      certificates: {
        Row: {
          certificate_number: string
          created_at: string
          enrollment_id: string
          id: string
          issued_at: string
          issued_by_teacher_id: string | null
          revoke_reason: string | null
          revoked_at: string | null
        }
        Insert: {
          certificate_number: string
          created_at?: string
          enrollment_id: string
          id?: string
          issued_at?: string
          issued_by_teacher_id?: string | null
          revoke_reason?: string | null
          revoked_at?: string | null
        }
        Update: {
          certificate_number?: string
          created_at?: string
          enrollment_id?: string
          id?: string
          issued_at?: string
          issued_by_teacher_id?: string | null
          revoke_reason?: string | null
          revoked_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "certificates_enrollment_id_fkey"
            columns: ["enrollment_id"]
            isOneToOne: false
            referencedRelation: "enrollments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "certificates_issued_by_teacher_id_fkey"
            columns: ["issued_by_teacher_id"]
            isOneToOne: false
            referencedRelation: "teachers"
            referencedColumns: ["id"]
          },
        ]
      }
      class_sessions: {
        Row: {
          cancelled_at: string | null
          cohort_id: string
          created_at: string | null
          deleted_at: string | null
          duration_minutes: number | null
          id: string
          is_recurring: boolean | null
          meet_link: string
          recurrence_rule: string | null
          rescheduled_to_id: string | null
          scheduled_at: string
          updated_at: string | null
        }
        Insert: {
          cancelled_at?: string | null
          cohort_id: string
          created_at?: string | null
          deleted_at?: string | null
          duration_minutes?: number | null
          id?: string
          is_recurring?: boolean | null
          meet_link: string
          recurrence_rule?: string | null
          rescheduled_to_id?: string | null
          scheduled_at: string
          updated_at?: string | null
        }
        Update: {
          cancelled_at?: string | null
          cohort_id?: string
          created_at?: string | null
          deleted_at?: string | null
          duration_minutes?: number | null
          id?: string
          is_recurring?: boolean | null
          meet_link?: string
          recurrence_rule?: string | null
          rescheduled_to_id?: string | null
          scheduled_at?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "class_sessions_cohort_id_fkey"
            columns: ["cohort_id"]
            isOneToOne: false
            referencedRelation: "cohorts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "class_sessions_rescheduled_to_id_fkey"
            columns: ["rescheduled_to_id"]
            isOneToOne: false
            referencedRelation: "class_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      cohort_feedback: {
        Row: {
          cohort_id: string
          comment: string | null
          created_at: string | null
          id: string
          rating: number
          student_id: string
        }
        Insert: {
          cohort_id: string
          comment?: string | null
          created_at?: string | null
          id?: string
          rating: number
          student_id: string
        }
        Update: {
          cohort_id?: string
          comment?: string | null
          created_at?: string | null
          id?: string
          rating?: number
          student_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "cohort_feedback_cohort_id_fkey"
            columns: ["cohort_id"]
            isOneToOne: false
            referencedRelation: "cohorts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cohort_feedback_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      cohort_waitlist: {
        Row: {
          cohort_id: string
          id: string
          joined_at: string | null
          status: string
          student_email: string
          student_id: string | null
          student_name: string
          student_phone: string
          teacher_note: string | null
        }
        Insert: {
          cohort_id: string
          id?: string
          joined_at?: string | null
          status: string
          student_email: string
          student_id?: string | null
          student_name: string
          student_phone: string
          teacher_note?: string | null
        }
        Update: {
          cohort_id?: string
          id?: string
          joined_at?: string | null
          status?: string
          student_email?: string
          student_id?: string | null
          student_name?: string
          student_phone?: string
          teacher_note?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "cohort_waitlist_cohort_id_fkey"
            columns: ["cohort_id"]
            isOneToOne: false
            referencedRelation: "cohorts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cohort_waitlist_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      cohorts: {
        Row: {
          archived_at: string | null
          billing_day: number | null
          course_id: string
          created_at: string | null
          deleted_at: string | null
          end_date: string
          fee_pkr: number
          fee_type: string
          id: string
          invite_token: string
          is_registration_open: boolean | null
          max_students: number | null
          name: string
          pending_can_see_announcements: boolean | null
          pending_can_see_schedule: boolean | null
          session_type: string | null
          start_date: string
          status: string
          teacher_id: string
          updated_at: string | null
          waitlist_enabled: boolean | null
        }
        Insert: {
          archived_at?: string | null
          billing_day?: number | null
          course_id: string
          created_at?: string | null
          deleted_at?: string | null
          end_date: string
          fee_pkr: number
          fee_type: string
          id?: string
          invite_token: string
          is_registration_open?: boolean | null
          max_students?: number | null
          name: string
          pending_can_see_announcements?: boolean | null
          pending_can_see_schedule?: boolean | null
          session_type?: string | null
          start_date: string
          status?: string
          teacher_id: string
          updated_at?: string | null
          waitlist_enabled?: boolean | null
        }
        Update: {
          archived_at?: string | null
          billing_day?: number | null
          course_id?: string
          created_at?: string | null
          deleted_at?: string | null
          end_date?: string
          fee_pkr?: number
          fee_type?: string
          id?: string
          invite_token?: string
          is_registration_open?: boolean | null
          max_students?: number | null
          name?: string
          pending_can_see_announcements?: boolean | null
          pending_can_see_schedule?: boolean | null
          session_type?: string | null
          start_date?: string
          status?: string
          teacher_id?: string
          updated_at?: string | null
          waitlist_enabled?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "cohorts_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cohorts_teacher_id_fkey"
            columns: ["teacher_id"]
            isOneToOne: false
            referencedRelation: "teachers"
            referencedColumns: ["id"]
          },
        ]
      }
      course_curriculum_items: {
        Row: {
          course_id: string
          created_at: string | null
          description: string | null
          display_order: number
          id: string
          title: string
          updated_at: string | null
          week_number: number
        }
        Insert: {
          course_id: string
          created_at?: string | null
          description?: string | null
          display_order?: number
          id?: string
          title: string
          updated_at?: string | null
          week_number: number
        }
        Update: {
          course_id?: string
          created_at?: string | null
          description?: string | null
          display_order?: number
          id?: string
          title?: string
          updated_at?: string | null
          week_number?: number
        }
        Relationships: [
          {
            foreignKeyName: "course_curriculum_items_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
        ]
      }
      courses: {
        Row: {
          category: string | null
          created_at: string | null
          deleted_at: string | null
          description: string | null
          id: string
          status: string
          tags: string[] | null
          teacher_id: string
          thumbnail_url: string | null
          title: string
          updated_at: string | null
        }
        Insert: {
          category?: string | null
          created_at?: string | null
          deleted_at?: string | null
          description?: string | null
          id?: string
          status?: string
          tags?: string[] | null
          teacher_id: string
          thumbnail_url?: string | null
          title: string
          updated_at?: string | null
        }
        Update: {
          category?: string | null
          created_at?: string | null
          deleted_at?: string | null
          description?: string | null
          id?: string
          status?: string
          tags?: string[] | null
          teacher_id?: string
          thumbnail_url?: string | null
          title?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "courses_teacher_id_fkey"
            columns: ["teacher_id"]
            isOneToOne: false
            referencedRelation: "teachers"
            referencedColumns: ["id"]
          },
        ]
      }
      direct_messages: {
        Row: {
          attachment_url: string | null
          body: string
          created_at: string | null
          id: string
          read_at: string | null
          recipient_id: string
          recipient_type: string
          sender_id: string
          sender_type: string
          thread_id: string
        }
        Insert: {
          attachment_url?: string | null
          body: string
          created_at?: string | null
          id?: string
          read_at?: string | null
          recipient_id: string
          recipient_type: string
          sender_id: string
          sender_type: string
          thread_id: string
        }
        Update: {
          attachment_url?: string | null
          body?: string
          created_at?: string | null
          id?: string
          read_at?: string | null
          recipient_id?: string
          recipient_type?: string
          sender_id?: string
          sender_type?: string
          thread_id?: string
        }
        Relationships: []
      }
      discount_codes: {
        Row: {
          code: string
          cohort_id: string
          created_at: string | null
          discount_type: string
          discount_value: number
          expires_at: string | null
          id: string
          max_uses: number | null
          teacher_id: string
          use_count: number | null
        }
        Insert: {
          code: string
          cohort_id: string
          created_at?: string | null
          discount_type: string
          discount_value: number
          expires_at?: string | null
          id?: string
          max_uses?: number | null
          teacher_id: string
          use_count?: number | null
        }
        Update: {
          code?: string
          cohort_id?: string
          created_at?: string | null
          discount_type?: string
          discount_value?: number
          expires_at?: string | null
          id?: string
          max_uses?: number | null
          teacher_id?: string
          use_count?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "discount_codes_cohort_id_fkey"
            columns: ["cohort_id"]
            isOneToOne: false
            referencedRelation: "cohorts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "discount_codes_teacher_id_fkey"
            columns: ["teacher_id"]
            isOneToOne: false
            referencedRelation: "teachers"
            referencedColumns: ["id"]
          },
        ]
      }
      email_delivery_log: {
        Row: {
          created_at: string | null
          error_message: string | null
          id: string
          notification_log_id: string | null
          provider_message_id: string | null
          recipient_email: string
          status: string
          type: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          error_message?: string | null
          id?: string
          notification_log_id?: string | null
          provider_message_id?: string | null
          recipient_email: string
          status: string
          type: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          error_message?: string | null
          id?: string
          notification_log_id?: string | null
          provider_message_id?: string | null
          recipient_email?: string
          status?: string
          type?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "email_delivery_log_notification_log_id_fkey"
            columns: ["notification_log_id"]
            isOneToOne: false
            referencedRelation: "notifications_log"
            referencedColumns: ["id"]
          },
        ]
      }
      enrollments: {
        Row: {
          cohort_id: string
          created_at: string | null
          id: string
          reference_code: string
          revoke_reason: string | null
          revoked_at: string | null
          status: string
          student_id: string
          updated_at: string | null
          withdrawal_reason: string | null
          withdrawal_requested_at: string | null
        }
        Insert: {
          cohort_id: string
          created_at?: string | null
          id?: string
          reference_code: string
          revoke_reason?: string | null
          revoked_at?: string | null
          status?: string
          student_id: string
          updated_at?: string | null
          withdrawal_reason?: string | null
          withdrawal_requested_at?: string | null
        }
        Update: {
          cohort_id?: string
          created_at?: string | null
          id?: string
          reference_code?: string
          revoke_reason?: string | null
          revoked_at?: string | null
          status?: string
          student_id?: string
          updated_at?: string | null
          withdrawal_reason?: string | null
          withdrawal_requested_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "enrollments_cohort_id_fkey"
            columns: ["cohort_id"]
            isOneToOne: false
            referencedRelation: "cohorts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "enrollments_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      explore_page_views: {
        Row: {
          created_at: string | null
          id: string
          source: string
          teacher_id: string
          viewer_ip_hash: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          source: string
          teacher_id: string
          viewer_ip_hash: string
        }
        Update: {
          created_at?: string | null
          id?: string
          source?: string
          teacher_id?: string
          viewer_ip_hash?: string
        }
        Relationships: [
          {
            foreignKeyName: "explore_page_views_teacher_id_fkey"
            columns: ["teacher_id"]
            isOneToOne: false
            referencedRelation: "teachers"
            referencedColumns: ["id"]
          },
        ]
      }
      feature_registry: {
        Row: {
          category: string
          created_at: string | null
          description: string
          display_name: string
          feature_key: string
          id: string
          is_limit_based: boolean | null
        }
        Insert: {
          category: string
          created_at?: string | null
          description: string
          display_name: string
          feature_key: string
          id?: string
          is_limit_based?: boolean | null
        }
        Update: {
          category?: string
          created_at?: string | null
          description?: string
          display_name?: string
          feature_key?: string
          id?: string
          is_limit_based?: boolean | null
        }
        Relationships: []
      }
      lesson_plan_usage: {
        Row: {
          created_at: string
          event: string
          id: string
          input_tokens: number | null
          lesson_plan_id: string | null
          model: string
          output_tokens: number | null
          teacher_id: string
        }
        Insert: {
          created_at?: string
          event: string
          id?: string
          input_tokens?: number | null
          lesson_plan_id?: string | null
          model: string
          output_tokens?: number | null
          teacher_id: string
        }
        Update: {
          created_at?: string
          event?: string
          id?: string
          input_tokens?: number | null
          lesson_plan_id?: string | null
          model?: string
          output_tokens?: number | null
          teacher_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "lesson_plan_usage_lesson_plan_id_fkey"
            columns: ["lesson_plan_id"]
            isOneToOne: false
            referencedRelation: "lesson_plans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lesson_plan_usage_teacher_id_fkey"
            columns: ["teacher_id"]
            isOneToOne: false
            referencedRelation: "teachers"
            referencedColumns: ["id"]
          },
        ]
      }
      lesson_plans: {
        Row: {
          body_markdown: string
          chat_history: Json
          course_id: string
          created_at: string
          id: string
          inputs: Json
          model: string
          scope: string
          teacher_id: string
          theme_slug: string
          title: string
          updated_at: string
        }
        Insert: {
          body_markdown: string
          chat_history?: Json
          course_id: string
          created_at?: string
          id?: string
          inputs: Json
          model: string
          scope: string
          teacher_id: string
          theme_slug?: string
          title: string
          updated_at?: string
        }
        Update: {
          body_markdown?: string
          chat_history?: Json
          course_id?: string
          created_at?: string
          id?: string
          inputs?: Json
          model?: string
          scope?: string
          teacher_id?: string
          theme_slug?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "lesson_plans_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lesson_plans_teacher_id_fkey"
            columns: ["teacher_id"]
            isOneToOne: false
            referencedRelation: "teachers"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          body: string
          created_at: string | null
          id: string
          kind: string
          link_url: string | null
          read_at: string | null
          title: string
          user_id: string
          user_type: string
        }
        Insert: {
          body: string
          created_at?: string | null
          id?: string
          kind: string
          link_url?: string | null
          read_at?: string | null
          title: string
          user_id: string
          user_type: string
        }
        Update: {
          body?: string
          created_at?: string | null
          id?: string
          kind?: string
          link_url?: string | null
          read_at?: string | null
          title?: string
          user_id?: string
          user_type?: string
        }
        Relationships: []
      }
      notifications_log: {
        Row: {
          channel: string
          id: string
          metadata: Json | null
          recipient_id: string
          recipient_type: string
          sent_at: string | null
          status: string
          type: string
        }
        Insert: {
          channel: string
          id?: string
          metadata?: Json | null
          recipient_id: string
          recipient_type: string
          sent_at?: string | null
          status?: string
          type: string
        }
        Update: {
          channel?: string
          id?: string
          metadata?: Json | null
          recipient_id?: string
          recipient_type?: string
          sent_at?: string | null
          status?: string
          type?: string
        }
        Relationships: []
      }
      plan_features: {
        Row: {
          feature_key: string
          id: string
          is_enabled: boolean
          plan_id: string
          updated_at: string | null
        }
        Insert: {
          feature_key: string
          id?: string
          is_enabled: boolean
          plan_id: string
          updated_at?: string | null
        }
        Update: {
          feature_key?: string
          id?: string
          is_enabled?: boolean
          plan_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "plan_features_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "plans"
            referencedColumns: ["id"]
          },
        ]
      }
      plans: {
        Row: {
          created_at: string | null
          display_order: number
          grandfathered_at: string | null
          id: string
          is_active: boolean | null
          is_featured: boolean | null
          is_visible: boolean | null
          lesson_plans_per_month: number
          max_cohorts_active: number
          max_courses: number
          max_storage_mb: number
          max_students: number
          max_teachers: number | null
          name: string
          price_pkr: number
          slug: string
          transaction_cut_percent: number
          trial_days: number | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          display_order: number
          grandfathered_at?: string | null
          id?: string
          is_active?: boolean | null
          is_featured?: boolean | null
          is_visible?: boolean | null
          lesson_plans_per_month?: number
          max_cohorts_active: number
          max_courses: number
          max_storage_mb: number
          max_students: number
          max_teachers?: number | null
          name: string
          price_pkr: number
          slug: string
          transaction_cut_percent: number
          trial_days?: number | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          display_order?: number
          grandfathered_at?: string | null
          id?: string
          is_active?: boolean | null
          is_featured?: boolean | null
          is_visible?: boolean | null
          lesson_plans_per_month?: number
          max_cohorts_active?: number
          max_courses?: number
          max_storage_mb?: number
          max_students?: number
          max_teachers?: number | null
          name?: string
          price_pkr?: number
          slug?: string
          transaction_cut_percent?: number
          trial_days?: number | null
          updated_at?: string | null
        }
        Relationships: []
      }
      platform_settings: {
        Row: {
          description: string
          id: string
          is_encrypted: boolean
          key: string
          updated_at: string | null
          value: string
        }
        Insert: {
          description: string
          id?: string
          is_encrypted?: boolean
          key: string
          updated_at?: string | null
          value: string
        }
        Update: {
          description?: string
          id?: string
          is_encrypted?: boolean
          key?: string
          updated_at?: string | null
          value?: string
        }
        Relationships: []
      }
      referrals: {
        Row: {
          created_at: string | null
          credit_applied_at: string | null
          id: string
          referral_code: string
          referred_teacher_id: string
          referrer_teacher_id: string
          status: string
        }
        Insert: {
          created_at?: string | null
          credit_applied_at?: string | null
          id?: string
          referral_code: string
          referred_teacher_id: string
          referrer_teacher_id: string
          status?: string
        }
        Update: {
          created_at?: string | null
          credit_applied_at?: string | null
          id?: string
          referral_code?: string
          referred_teacher_id?: string
          referrer_teacher_id?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "referrals_referred_teacher_id_fkey"
            columns: ["referred_teacher_id"]
            isOneToOne: true
            referencedRelation: "teachers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "referrals_referrer_teacher_id_fkey"
            columns: ["referrer_teacher_id"]
            isOneToOne: false
            referencedRelation: "teachers"
            referencedColumns: ["id"]
          },
        ]
      }
      student_payments: {
        Row: {
          amount_pkr: number
          created_at: string | null
          discount_code_id: string | null
          discounted_amount_pkr: number
          enrollment_id: string
          gateway_transaction_id: string | null
          id: string
          idempotency_key: string | null
          payment_method: string
          payment_month: string | null
          platform_absorbed_refund: boolean | null
          platform_cut_pkr: number
          reference_code: string
          refund_note: string | null
          refunded_at: string | null
          rejection_reason: string | null
          screenshot_url: string | null
          status: string
          teacher_payout_amount_pkr: number
          transaction_id: string | null
          updated_at: string | null
          verified_at: string | null
        }
        Insert: {
          amount_pkr: number
          created_at?: string | null
          discount_code_id?: string | null
          discounted_amount_pkr: number
          enrollment_id: string
          gateway_transaction_id?: string | null
          id?: string
          idempotency_key?: string | null
          payment_method: string
          payment_month?: string | null
          platform_absorbed_refund?: boolean | null
          platform_cut_pkr: number
          reference_code: string
          refund_note?: string | null
          refunded_at?: string | null
          rejection_reason?: string | null
          screenshot_url?: string | null
          status: string
          teacher_payout_amount_pkr: number
          transaction_id?: string | null
          updated_at?: string | null
          verified_at?: string | null
        }
        Update: {
          amount_pkr?: number
          created_at?: string | null
          discount_code_id?: string | null
          discounted_amount_pkr?: number
          enrollment_id?: string
          gateway_transaction_id?: string | null
          id?: string
          idempotency_key?: string | null
          payment_method?: string
          payment_month?: string | null
          platform_absorbed_refund?: boolean | null
          platform_cut_pkr?: number
          reference_code?: string
          refund_note?: string | null
          refunded_at?: string | null
          rejection_reason?: string | null
          screenshot_url?: string | null
          status?: string
          teacher_payout_amount_pkr?: number
          transaction_id?: string | null
          updated_at?: string | null
          verified_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "student_payments_enrollment_id_fkey"
            columns: ["enrollment_id"]
            isOneToOne: false
            referencedRelation: "enrollments"
            referencedColumns: ["id"]
          },
        ]
      }
      students: {
        Row: {
          created_at: string | null
          email: string
          id: string
          last_login_at: string | null
          name: string
          parent_email: string | null
          parent_name: string | null
          parent_phone: string | null
          pending_email: string | null
          phone: string
          supabase_auth_id: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          email: string
          id?: string
          last_login_at?: string | null
          name: string
          parent_email?: string | null
          parent_name?: string | null
          parent_phone?: string | null
          pending_email?: string | null
          phone: string
          supabase_auth_id?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          email?: string
          id?: string
          last_login_at?: string | null
          name?: string
          parent_email?: string | null
          parent_name?: string | null
          parent_phone?: string | null
          pending_email?: string | null
          phone?: string
          supabase_auth_id?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      teacher_balances: {
        Row: {
          available_balance_pkr: number | null
          id: string
          outstanding_debit_pkr: number | null
          pending_balance_pkr: number | null
          teacher_id: string
          total_earned_pkr: number | null
          total_paid_out_pkr: number | null
          updated_at: string | null
        }
        Insert: {
          available_balance_pkr?: number | null
          id?: string
          outstanding_debit_pkr?: number | null
          pending_balance_pkr?: number | null
          teacher_id: string
          total_earned_pkr?: number | null
          total_paid_out_pkr?: number | null
          updated_at?: string | null
        }
        Update: {
          available_balance_pkr?: number | null
          id?: string
          outstanding_debit_pkr?: number | null
          pending_balance_pkr?: number | null
          teacher_id?: string
          total_earned_pkr?: number | null
          total_paid_out_pkr?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "teacher_balances_teacher_id_fkey"
            columns: ["teacher_id"]
            isOneToOne: true
            referencedRelation: "teachers"
            referencedColumns: ["id"]
          },
        ]
      }
      teacher_payment_settings: {
        Row: {
          easypaisa_number: string | null
          id: string
          instructions: string | null
          jazzcash_number: string | null
          payout_account_title: string | null
          payout_bank_name: string | null
          payout_iban: string | null
          qr_code_url: string | null
          teacher_id: string
          updated_at: string | null
        }
        Insert: {
          easypaisa_number?: string | null
          id?: string
          instructions?: string | null
          jazzcash_number?: string | null
          payout_account_title?: string | null
          payout_bank_name?: string | null
          payout_iban?: string | null
          qr_code_url?: string | null
          teacher_id: string
          updated_at?: string | null
        }
        Update: {
          easypaisa_number?: string | null
          id?: string
          instructions?: string | null
          jazzcash_number?: string | null
          payout_account_title?: string | null
          payout_bank_name?: string | null
          payout_iban?: string | null
          qr_code_url?: string | null
          teacher_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "teacher_payment_settings_teacher_id_fkey"
            columns: ["teacher_id"]
            isOneToOne: true
            referencedRelation: "teachers"
            referencedColumns: ["id"]
          },
        ]
      }
      teacher_payouts: {
        Row: {
          admin_note: string | null
          amount_pkr: number
          bank_details_snapshot_json: Json | null
          created_at: string | null
          id: string
          processed_at: string | null
          requested_at: string | null
          status: string
          teacher_id: string
        }
        Insert: {
          admin_note?: string | null
          amount_pkr: number
          bank_details_snapshot_json?: Json | null
          created_at?: string | null
          id?: string
          processed_at?: string | null
          requested_at?: string | null
          status: string
          teacher_id: string
        }
        Update: {
          admin_note?: string | null
          amount_pkr?: number
          bank_details_snapshot_json?: Json | null
          created_at?: string | null
          id?: string
          processed_at?: string | null
          requested_at?: string | null
          status?: string
          teacher_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "teacher_payouts_teacher_id_fkey"
            columns: ["teacher_id"]
            isOneToOne: false
            referencedRelation: "teachers"
            referencedColumns: ["id"]
          },
        ]
      }
      teacher_plan_snapshot: {
        Row: {
          captured_at: string | null
          id: string
          plan_id: string
          snapshot_json: Json
          teacher_id: string
        }
        Insert: {
          captured_at?: string | null
          id?: string
          plan_id: string
          snapshot_json: Json
          teacher_id: string
        }
        Update: {
          captured_at?: string | null
          id?: string
          plan_id?: string
          snapshot_json?: Json
          teacher_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "teacher_plan_snapshot_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "plans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "teacher_plan_snapshot_teacher_id_fkey"
            columns: ["teacher_id"]
            isOneToOne: false
            referencedRelation: "teachers"
            referencedColumns: ["id"]
          },
        ]
      }
      teacher_student_notes: {
        Row: {
          body: string
          cohort_id: string | null
          created_at: string
          id: string
          student_id: string
          teacher_id: string
          updated_at: string
        }
        Insert: {
          body: string
          cohort_id?: string | null
          created_at?: string
          id?: string
          student_id: string
          teacher_id: string
          updated_at?: string
        }
        Update: {
          body?: string
          cohort_id?: string | null
          created_at?: string
          id?: string
          student_id?: string
          teacher_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "teacher_student_notes_cohort_id_fkey"
            columns: ["cohort_id"]
            isOneToOne: false
            referencedRelation: "cohorts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "teacher_student_notes_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "teacher_student_notes_teacher_id_fkey"
            columns: ["teacher_id"]
            isOneToOne: false
            referencedRelation: "teachers"
            referencedColumns: ["id"]
          },
        ]
      }
      teacher_subscriptions: {
        Row: {
          amount_pkr: number
          approved_at: string | null
          created_at: string | null
          gateway_transaction_id: string | null
          id: string
          payment_method: string
          period_end: string
          period_start: string
          plan: string
          rejection_reason: string | null
          screenshot_url: string | null
          status: string
          teacher_id: string
        }
        Insert: {
          amount_pkr: number
          approved_at?: string | null
          created_at?: string | null
          gateway_transaction_id?: string | null
          id?: string
          payment_method: string
          period_end: string
          period_start: string
          plan: string
          rejection_reason?: string | null
          screenshot_url?: string | null
          status: string
          teacher_id: string
        }
        Update: {
          amount_pkr?: number
          approved_at?: string | null
          created_at?: string | null
          gateway_transaction_id?: string | null
          id?: string
          payment_method?: string
          period_end?: string
          period_start?: string
          plan?: string
          rejection_reason?: string | null
          screenshot_url?: string | null
          status?: string
          teacher_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "teacher_subscriptions_teacher_id_fkey"
            columns: ["teacher_id"]
            isOneToOne: false
            referencedRelation: "teachers"
            referencedColumns: ["id"]
          },
        ]
      }
      teacher_testimonials: {
        Row: {
          author_name: string
          author_role: string | null
          created_at: string | null
          display_order: number
          id: string
          is_published: boolean
          quote: string
          teacher_id: string
          updated_at: string | null
        }
        Insert: {
          author_name: string
          author_role?: string | null
          created_at?: string | null
          display_order?: number
          id?: string
          is_published?: boolean
          quote: string
          teacher_id: string
          updated_at?: string | null
        }
        Update: {
          author_name?: string
          author_role?: string | null
          created_at?: string | null
          display_order?: number
          id?: string
          is_published?: boolean
          quote?: string
          teacher_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "teacher_testimonials_teacher_id_fkey"
            columns: ["teacher_id"]
            isOneToOne: false
            referencedRelation: "teachers"
            referencedColumns: ["id"]
          },
        ]
      }
      teachers: {
        Row: {
          bio: string | null
          city: string | null
          created_at: string | null
          downgraded_at: string | null
          email: string
          email_verified_at: string | null
          grace_until: string | null
          id: string
          is_publicly_listed: boolean | null
          is_suspended: boolean | null
          name: string
          notification_preferences_json: Json | null
          onboarding_completed: boolean | null
          onboarding_steps_json: Json | null
          pending_email: string | null
          plan: string
          plan_expires_at: string | null
          profile_photo_url: string | null
          referral_code: string | null
          subdomain: string
          subdomain_changed_at: string | null
          subject_tags: string[] | null
          supabase_auth_id: string | null
          suspended_at: string | null
          teaching_levels: string[] | null
          trial_ends_at: string | null
          trial_started_at: string | null
          updated_at: string | null
        }
        Insert: {
          bio?: string | null
          city?: string | null
          created_at?: string | null
          downgraded_at?: string | null
          email: string
          email_verified_at?: string | null
          grace_until?: string | null
          id?: string
          is_publicly_listed?: boolean | null
          is_suspended?: boolean | null
          name: string
          notification_preferences_json?: Json | null
          onboarding_completed?: boolean | null
          onboarding_steps_json?: Json | null
          pending_email?: string | null
          plan?: string
          plan_expires_at?: string | null
          profile_photo_url?: string | null
          referral_code?: string | null
          subdomain: string
          subdomain_changed_at?: string | null
          subject_tags?: string[] | null
          supabase_auth_id?: string | null
          suspended_at?: string | null
          teaching_levels?: string[] | null
          trial_ends_at?: string | null
          trial_started_at?: string | null
          updated_at?: string | null
        }
        Update: {
          bio?: string | null
          city?: string | null
          created_at?: string | null
          downgraded_at?: string | null
          email?: string
          email_verified_at?: string | null
          grace_until?: string | null
          id?: string
          is_publicly_listed?: boolean | null
          is_suspended?: boolean | null
          name?: string
          notification_preferences_json?: Json | null
          onboarding_completed?: boolean | null
          onboarding_steps_json?: Json | null
          pending_email?: string | null
          plan?: string
          plan_expires_at?: string | null
          profile_photo_url?: string | null
          referral_code?: string | null
          subdomain?: string
          subdomain_changed_at?: string | null
          subject_tags?: string[] | null
          supabase_auth_id?: string | null
          suspended_at?: string | null
          teaching_levels?: string[] | null
          trial_ends_at?: string | null
          trial_started_at?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "teachers_plan_fkey"
            columns: ["plan"]
            isOneToOne: false
            referencedRelation: "plans"
            referencedColumns: ["slug"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      apply_soft_downgrade: {
        Args: { p_teacher_id: string }
        Returns: undefined
      }
      credit_teacher_balance: {
        Args: {
          p_amount: number
          p_deduct_outstanding?: boolean
          p_teacher_id: string
        }
        Returns: undefined
      }
      enroll_student_atomic: {
        Args: { p_cohort_id: string; p_student_id: string }
        Returns: string
      }
      get_decrypted_setting: {
        Args: { p_encryption_key: string; p_key: string }
        Returns: string
      }
      increment_discount_use: { Args: { p_code_id: string }; Returns: boolean }
      insert_lesson_plan_atomic: {
        Args: {
          p_body_markdown: string
          p_course_id: string
          p_inputs: Json
          p_limit: number
          p_model: string
          p_scope: string
          p_teacher_id: string
          p_theme_slug?: string
          p_title: string
        }
        Returns: {
          plan_id: string
          status: string
        }[]
      }
      set_encrypted_setting: {
        Args: { p_encryption_key: string; p_key: string; p_value: string }
        Returns: undefined
      }
      set_grace_period: { Args: { p_teacher_id: string }; Returns: undefined }
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
    Enums: {},
  },
} as const
