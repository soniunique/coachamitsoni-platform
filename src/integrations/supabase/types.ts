export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

type Row = Record<string, any>;
type Table = { Row: Row; Insert: Row; Update: Row; Relationships: any[] };

export type Database = {
  __InternalSupabase: { PostgrestVersion: "14.15" };
  public: {
    Tables: {
      profiles: Table & { Row: { id: string; full_name: string | null; avatar_url: string | null; bio: string | null; role: string; created_at: string; updated_at: string }; Insert: { id: string; full_name?: string | null; avatar_url?: string | null; bio?: string | null; role?: string; created_at?: string; updated_at?: string }; Update: { id?: string; full_name?: string | null; avatar_url?: string | null; bio?: string | null; role?: string; created_at?: string; updated_at?: string } };
      courses: Table & { Row: { id: string; slug: string; title: string; description: string | null; thumbnail_url: string | null; status: string; created_at: string; updated_at: string }; Insert: { id?: string; slug: string; title: string; description?: string | null; thumbnail_url?: string | null; status?: string; created_at?: string; updated_at?: string }; Update: { id?: string; slug?: string; title?: string; description?: string | null; thumbnail_url?: string | null; status?: string; updated_at?: string } };
      course_modules: Table;
      course_lessons: Table;
      enrollments: Table;
      lesson_progress: Table;
      workshops: Table;
      workshop_registrations: Table;
      feed_posts: Table;
      notifications: Table;
      conversations: Table;
      conversation_members: Table;
      messages: Table;
    };
    Views: { [_ in never]: never };
    Functions: {
      admin_list_students: { Args: Record<PropertyKey, never>; Returns: { id: string; email: string; full_name: string }[] };
      admin_get_course_roster: { Args: { p_course_id: string }; Returns: { student_id: string; email: string; full_name: string; enrollment_id: string | null; enrollment_status: string | null; progress_percent: number | null; enrolled_at: string | null; completed_at: string | null }[] };
      admin_enroll_student: { Args: { p_course_id: string; p_user_id: string }; Returns: Tables<"enrollments"> };
      admin_unenroll_student: { Args: { p_course_id: string; p_user_id: string }; Returns: Tables<"enrollments"> };
      admin_set_course_enrollment: { Args: { p_course_id: string; p_user_id: string; p_enrolled: boolean }; Returns: Tables<"enrollments"> };
    };
    Enums: { [_ in never]: never };
    CompositeTypes: { [_ in never]: never };
  };
};

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">;
type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">];
export type Tables<N extends keyof DefaultSchema["Tables"]> = DefaultSchema["Tables"][N] extends { Row: infer R } ? R : never;
export type TablesInsert<N extends keyof DefaultSchema["Tables"]> = DefaultSchema["Tables"][N] extends { Insert: infer I } ? I : never;
export type TablesUpdate<N extends keyof DefaultSchema["Tables"]> = DefaultSchema["Tables"][N] extends { Update: infer U } ? U : never;
export type Enums<N extends keyof DefaultSchema["Enums"]> = DefaultSchema["Enums"][N];
export type CompositeTypes<N extends keyof DefaultSchema["CompositeTypes"]> = DefaultSchema["CompositeTypes"][N];
export const Constants = { public: { Enums: {} } } as const;
