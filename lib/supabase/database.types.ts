
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {
  
  "public": {
          Tables: {
            "campuses": {
                  Row: {
                    "is_online": boolean,"name": string,"region": string,"slug": string,"sort": number
                  }
                  Insert: {
                    "is_online"?: boolean,"name": string,"region": string,"slug": string,"sort": number
                  }
                  Update: {
                    "is_online"?: boolean,"name"?: string,"region"?: string,"slug"?: string,"sort"?: number
                  }
                  Relationships: [
                    
                  ]
                },"categories": {
                  Row: {
                    "name": string,"slug": string,"sort": number
                  }
                  Insert: {
                    "name": string,"slug": string,"sort": number
                  }
                  Update: {
                    "name"?: string,"slug"?: string,"sort"?: number
                  }
                  Relationships: [
                    
                  ]
                },"consents": {
                  Row: {
                    "account_id": string,"agreed_at": string,"id": string,"version": string
                  }
                  Insert: {
                    "account_id": string,"agreed_at"?: string,"id"?: string,"version": string
                  }
                  Update: {
                    "account_id"?: string,"agreed_at"?: string,"id"?: string,"version"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "consents_account_id_fkey"
      columns: ["account_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"conversations": {
                  Row: {
                    "buyer_id": string | null,"completed_at": string | null,"confirmed_at": string | null,"confirmed_by": string | null,"created_at": string,"first_reply_at": string | null,"id": string,"last_message_at": string,"listing_id": string | null,"listing_title": string | null,"seller_gone": boolean,"shop_id": string | null,"status": string
                  }
                  Insert: {
                    "buyer_id"?: string | null,"completed_at"?: string | null,"confirmed_at"?: string | null,"confirmed_by"?: string | null,"created_at"?: string,"first_reply_at"?: string | null,"id"?: string,"last_message_at"?: string,"listing_id"?: string | null,"listing_title"?: string | null,"seller_gone"?: boolean,"shop_id"?: string | null,"status"?: string
                  }
                  Update: {
                    "buyer_id"?: string | null,"completed_at"?: string | null,"confirmed_at"?: string | null,"confirmed_by"?: string | null,"created_at"?: string,"first_reply_at"?: string | null,"id"?: string,"last_message_at"?: string,"listing_id"?: string | null,"listing_title"?: string | null,"seller_gone"?: boolean,"shop_id"?: string | null,"status"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "conversations_buyer_id_fkey"
      columns: ["buyer_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "conversations_listing_id_fkey"
      columns: ["listing_id"]
isOneToOne: false
      referencedRelation: "listings"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "conversations_shop_id_fkey"
      columns: ["shop_id"]
isOneToOne: false
      referencedRelation: "shops"
      referencedColumns: ["id"]
    }
                  ]
                },"form_states": {
                  Row: {
                    "account_id": string,"errors": (string)[],"expires_at": string,"form": string,"notice": string | null,"session_id": string,"values": NonNullable<Json>
                  }
                  Insert: {
                    "account_id": string,"errors"?: (string)[],"expires_at": string,"form": string,"notice"?: string | null,"session_id": string,"values"?: NonNullable<Json>
                  }
                  Update: {
                    "account_id"?: string,"errors"?: (string)[],"expires_at"?: string,"form"?: string,"notice"?: string | null,"session_id"?: string,"values"?: NonNullable<Json>
                  }
                  Relationships: [
                    {
      foreignKeyName: "form_states_account_id_fkey"
      columns: ["account_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"listing_photos": {
                  Row: {
                    "alt": string,"listing_id": string,"photo_id": string | null,"placeholder_src": string | null,"position": number
                  }
                  Insert: {
                    "alt"?: string,"listing_id": string,"photo_id"?: string | null,"placeholder_src"?: string | null,"position": number
                  }
                  Update: {
                    "alt"?: string,"listing_id"?: string,"photo_id"?: string | null,"placeholder_src"?: string | null,"position"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "listing_photos_listing_id_fkey"
      columns: ["listing_id"]
isOneToOne: false
      referencedRelation: "listings"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "listing_photos_photo_id_fkey"
      columns: ["photo_id"]
isOneToOne: false
      referencedRelation: "photos"
      referencedColumns: ["id"]
    }
                  ]
                },"listings": {
                  Row: {
                    "campus_slug": string,"category_slug": string,"condition": string | null,"created_at": string,"description": string,"first_published_at": string | null,"handover": string,"id": string,"kind": string,"pay_mode": string,"pickup_point_id": string | null,"price_is_from": boolean,"price_zar": number | null,"shop_id": string,"state": string,"swap_for": string | null,"title": string,"updated_at": string
                  }
                  Insert: {
                    "campus_slug": string,"category_slug": string,"condition"?: string | null,"created_at"?: string,"description": string,"first_published_at"?: string | null,"handover": string,"id"?: string,"kind": string,"pay_mode": string,"pickup_point_id"?: string | null,"price_is_from"?: boolean,"price_zar"?: number | null,"shop_id": string,"state": string,"swap_for"?: string | null,"title": string,"updated_at"?: string
                  }
                  Update: {
                    "campus_slug"?: string,"category_slug"?: string,"condition"?: string | null,"created_at"?: string,"description"?: string,"first_published_at"?: string | null,"handover"?: string,"id"?: string,"kind"?: string,"pay_mode"?: string,"pickup_point_id"?: string | null,"price_is_from"?: boolean,"price_zar"?: number | null,"shop_id"?: string,"state"?: string,"swap_for"?: string | null,"title"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "listings_campus_slug_fkey"
      columns: ["campus_slug"]
isOneToOne: false
      referencedRelation: "campuses"
      referencedColumns: ["slug"]
    },{
      foreignKeyName: "listings_category_slug_fkey"
      columns: ["category_slug"]
isOneToOne: false
      referencedRelation: "categories"
      referencedColumns: ["slug"]
    },{
      foreignKeyName: "listings_pickup_point_id_fkey"
      columns: ["pickup_point_id"]
isOneToOne: false
      referencedRelation: "pickup_points"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "listings_shop_id_fkey"
      columns: ["shop_id"]
isOneToOne: false
      referencedRelation: "shops"
      referencedColumns: ["id"]
    }
                  ]
                },"messages": {
                  Row: {
                    "body": string,"conversation_id": string,"id": string,"read_at": string | null,"sent_at": string,"side": string,"swap_offer": string | null
                  }
                  Insert: {
                    "body": string,"conversation_id": string,"id"?: string,"read_at"?: string | null,"sent_at"?: string,"side": string,"swap_offer"?: string | null
                  }
                  Update: {
                    "body"?: string,"conversation_id"?: string,"id"?: string,"read_at"?: string | null,"sent_at"?: string,"side"?: string,"swap_offer"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "messages_conversation_id_fkey"
      columns: ["conversation_id"]
isOneToOne: false
      referencedRelation: "conversations"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "messages_conversation_id_fkey"
      columns: ["conversation_id"]
isOneToOne: false
      referencedRelation: "my_conversations"
      referencedColumns: ["id"]
    }
                  ]
                },"notifications": {
                  Row: {
                    "account_id": string,"created_at": string,"href": string,"id": string,"kind": string,"read_at": string | null,"subject_id": string,"text": string
                  }
                  Insert: {
                    "account_id": string,"created_at"?: string,"href": string,"id"?: string,"kind": string,"read_at"?: string | null,"subject_id": string,"text": string
                  }
                  Update: {
                    "account_id"?: string,"created_at"?: string,"href"?: string,"id"?: string,"kind"?: string,"read_at"?: string | null,"subject_id"?: string,"text"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "notifications_account_id_fkey"
      columns: ["account_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"onboarding_drafts": {
                  Row: {
                    "about": string,"account_id": string,"campus_slug": string | null,"category_slug": string | null,"name": string,"photo_id": string | null,"pickup_point_ids": (string)[],"tagline": string,"updated_at": string
                  }
                  Insert: {
                    "about"?: string,"account_id": string,"campus_slug"?: string | null,"category_slug"?: string | null,"name"?: string,"photo_id"?: string | null,"pickup_point_ids"?: (string)[],"tagline"?: string,"updated_at"?: string
                  }
                  Update: {
                    "about"?: string,"account_id"?: string,"campus_slug"?: string | null,"category_slug"?: string | null,"name"?: string,"photo_id"?: string | null,"pickup_point_ids"?: (string)[],"tagline"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "onboarding_drafts_account_id_fkey"
      columns: ["account_id"]
isOneToOne: true
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "onboarding_drafts_campus_slug_fkey"
      columns: ["campus_slug"]
isOneToOne: false
      referencedRelation: "campuses"
      referencedColumns: ["slug"]
    },{
      foreignKeyName: "onboarding_drafts_category_slug_fkey"
      columns: ["category_slug"]
isOneToOne: false
      referencedRelation: "categories"
      referencedColumns: ["slug"]
    },{
      foreignKeyName: "onboarding_drafts_photo_id_fkey"
      columns: ["photo_id"]
isOneToOne: false
      referencedRelation: "photos"
      referencedColumns: ["id"]
    }
                  ]
                },"photos": {
                  Row: {
                    "created_at": string,"id": string,"owner_id": string,"path": string,"type": string,"use": string | null
                  }
                  Insert: {
                    "created_at"?: string,"id"?: string,"owner_id": string,"path": string,"type": string,"use"?: string | null
                  }
                  Update: {
                    "created_at"?: string,"id"?: string,"owner_id"?: string,"path"?: string,"type"?: string,"use"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "photos_owner_id_fkey"
      columns: ["owner_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"pickup_points": {
                  Row: {
                    "campus_slug": string,"created_at": string,"id": string,"name": string,"name_key": string | null,"retired_at": string | null
                  }
                  Insert: {
                    "campus_slug": string,"created_at"?: string,"id"?: string,"name": string,"name_key"?: never,"retired_at"?: string | null
                  }
                  Update: {
                    "campus_slug"?: string,"created_at"?: string,"id"?: string,"name"?: string,"name_key"?: never,"retired_at"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "pickup_points_campus_slug_fkey"
      columns: ["campus_slug"]
isOneToOne: false
      referencedRelation: "campuses"
      referencedColumns: ["slug"]
    }
                  ]
                },"profiles": {
                  Row: {
                    "campus_slug": string,"created_at": string,"first_name": string,"id": string,"roles": (string)[]
                  }
                  Insert: {
                    "campus_slug": string,"created_at"?: string,"first_name": string,"id": string,"roles"?: (string)[]
                  }
                  Update: {
                    "campus_slug"?: string,"created_at"?: string,"first_name"?: string,"id"?: string,"roles"?: (string)[]
                  }
                  Relationships: [
                    {
      foreignKeyName: "profiles_campus_slug_fkey"
      columns: ["campus_slug"]
isOneToOne: false
      referencedRelation: "campuses"
      referencedColumns: ["slug"]
    }
                  ]
                },"reports": {
                  Row: {
                    "created_at": string,"detail": string,"id": string,"reason": string,"reporter_id": string,"status": string,"target_id": string,"target_kind": string,"target_title": string
                  }
                  Insert: {
                    "created_at"?: string,"detail"?: string,"id"?: string,"reason": string,"reporter_id": string,"status"?: string,"target_id": string,"target_kind": string,"target_title": string
                  }
                  Update: {
                    "created_at"?: string,"detail"?: string,"id"?: string,"reason"?: string,"reporter_id"?: string,"status"?: string,"target_id"?: string,"target_kind"?: string,"target_title"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "reports_reporter_id_fkey"
      columns: ["reporter_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"seller_profiles": {
                  Row: {
                    "account_id": string,"applied_at": string,"shop_id": string | null,"status": string
                  }
                  Insert: {
                    "account_id": string,"applied_at"?: string,"shop_id"?: string | null,"status": string
                  }
                  Update: {
                    "account_id"?: string,"applied_at"?: string,"shop_id"?: string | null,"status"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "seller_profiles_account_id_fkey"
      columns: ["account_id"]
isOneToOne: true
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "seller_profiles_shop_id_fkey"
      columns: ["shop_id"]
isOneToOne: true
      referencedRelation: "shops"
      referencedColumns: ["id"]
    }
                  ]
                },"shop_pickup_points": {
                  Row: {
                    "pickup_point_id": string,"shop_id": string
                  }
                  Insert: {
                    "pickup_point_id": string,"shop_id": string
                  }
                  Update: {
                    "pickup_point_id"?: string,"shop_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "shop_pickup_points_pickup_point_id_fkey"
      columns: ["pickup_point_id"]
isOneToOne: false
      referencedRelation: "pickup_points"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "shop_pickup_points_shop_id_fkey"
      columns: ["shop_id"]
isOneToOne: false
      referencedRelation: "shops"
      referencedColumns: ["id"]
    }
                  ]
                },"shops": {
                  Row: {
                    "about": string,"badge": string | null,"campus_slug": string,"category_slug": string,"created_at": string,"id": string,"image_alt": string,"image_photo_id": string | null,"image_placeholder": string | null,"name": string,"name_key": string | null,"owner_id": string | null,"since": string,"slug": string,"slug_changed": boolean,"tagline": string,"updated_at": string,"verified": boolean
                  }
                  Insert: {
                    "about"?: string,"badge"?: string | null,"campus_slug": string,"category_slug": string,"created_at"?: string,"id"?: string,"image_alt"?: string,"image_photo_id"?: string | null,"image_placeholder"?: string | null,"name": string,"name_key"?: never,"owner_id"?: string | null,"since": string,"slug": string,"slug_changed"?: boolean,"tagline"?: string,"updated_at"?: string,"verified"?: boolean
                  }
                  Update: {
                    "about"?: string,"badge"?: string | null,"campus_slug"?: string,"category_slug"?: string,"created_at"?: string,"id"?: string,"image_alt"?: string,"image_photo_id"?: string | null,"image_placeholder"?: string | null,"name"?: string,"name_key"?: never,"owner_id"?: string | null,"since"?: string,"slug"?: string,"slug_changed"?: boolean,"tagline"?: string,"updated_at"?: string,"verified"?: boolean
                  }
                  Relationships: [
                    {
      foreignKeyName: "shops_campus_slug_fkey"
      columns: ["campus_slug"]
isOneToOne: false
      referencedRelation: "campuses"
      referencedColumns: ["slug"]
    },{
      foreignKeyName: "shops_category_slug_fkey"
      columns: ["category_slug"]
isOneToOne: false
      referencedRelation: "categories"
      referencedColumns: ["slug"]
    },{
      foreignKeyName: "shops_image_photo_id_fkey"
      columns: ["image_photo_id"]
isOneToOne: false
      referencedRelation: "photos"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "shops_owner_id_fkey"
      columns: ["owner_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                }
          }
          Views: {
            "my_conversations": {
                  Row: {
                    "completed_at": string | null,"confirmed_at": string | null,"confirmed_by": string | null,"created_at": string | null,"first_reply_at": string | null,"id": string | null,"last_message_at": string | null,"listing_id": string | null,"listing_title": string | null,"seller_gone": boolean | null,"shop_id": string | null,"status": string | null,"viewer_side": string | null
                  }
                  Insert: {
                           "completed_at"?: string | null,"confirmed_at"?: string | null,"confirmed_by"?: string | null,"created_at"?: string | null,"first_reply_at"?: string | null,"id"?: string | null,"last_message_at"?: string | null,"listing_id"?: string | null,"listing_title"?: string | null,"seller_gone"?: boolean | null,"shop_id"?: string | null,"status"?: string | null,"viewer_side"?: never
                         }
                        Update: {
                           "completed_at"?: string | null,"confirmed_at"?: string | null,"confirmed_by"?: string | null,"created_at"?: string | null,"first_reply_at"?: string | null,"id"?: string | null,"last_message_at"?: string | null,"listing_id"?: string | null,"listing_title"?: string | null,"seller_gone"?: boolean | null,"shop_id"?: string | null,"status"?: string | null,"viewer_side"?: never
                         }
                        Relationships: [
                    {
      foreignKeyName: "conversations_listing_id_fkey"
      columns: ["listing_id"]
isOneToOne: false
      referencedRelation: "listings"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "conversations_shop_id_fkey"
      columns: ["shop_id"]
isOneToOne: false
      referencedRelation: "shops"
      referencedColumns: ["id"]
    }
                  ]
                }
          }
          Functions: {
            "add_photos":
{ Args: { "p_types": (string)[] }; Returns: Json
                           },
"change_shop_slug":
{ Args: { "p_slug": string }; Returns: string
                           },
"complete_profile":
{ Args: { "p_campus_slug": string,"p_first_name": string,"p_policy_version": string }; Returns: boolean
                           },
"confirm_sale":
{ Args: { "p_conversation_id": string }; Returns: string
                           },
"create_report":
{ Args: { "p_detail"?: string,"p_reason": string,"p_target_id": string,"p_target_kind": string,"p_target_title": string }; Returns: string
                           },
"create_shop":
{ Args: { "p_about": string,"p_campus_slug": string,"p_category_slug": string,"p_name": string,"p_photo_id": string,"p_pickup_point_ids": (string)[],"p_tagline": string }; Returns: Json
                           },
"delete_listing":
{ Args: { "p_listing_id": string }; Returns: Json
                           },
"forget_account":
{ Args: { "p_account_id": string }; Returns: (string)[]
                           },
"mark_completed":
{ Args: { "p_conversation_id": string }; Returns: string
                           },
"mark_notifications_read":
{ Args: Record<PropertyKey, never>; Returns: number
                           },
"mark_thread_read":
{ Args: { "p_conversation_id": string }; Returns: boolean
                           },
"record_consent":
{ Args: { "p_policy_version": string }; Returns: boolean
                           },
"record_wrong_try":
{ Args: { "p_attempt_key": string }; Returns: number
                           },
"reject_sale":
{ Args: { "p_conversation_id": string }; Returns: string
                           },
"reserve_code_send":
{ Args: { "p_email": string,"p_max_sends"?: number }; Returns: boolean
                           },
"save_listing":
{ Args: { "p_category_slug": string,"p_condition": string,"p_description": string,"p_handover": string,"p_kind": string,"p_listing_id": string,"p_pay_mode": string,"p_photos": Json,"p_pickup_point_id": string,"p_price_is_from": boolean,"p_price_zar": number,"p_publish": boolean,"p_swap_for": string,"p_title": string }; Returns: Json
                           },
"save_onboarding_draft":
{ Args: { "p_about": string,"p_campus_slug": string,"p_category_slug": string,"p_name": string,"p_photo_id": string,"p_pickup_point_ids": (string)[],"p_tagline": string }; Returns: Json
                           },
"send_message":
{ Args: { "p_body": string,"p_conversation_id": string }; Returns: string
                           },
"set_listing_state":
{ Args: { "p_listing_id": string,"p_to": string }; Returns: string
                           },
"set_shop_paused":
{ Args: { "p_paused": boolean }; Returns: string
                           },
"settle_auto_confirm":
{ Args: { "p_now"?: string }; Returns: number
                           },
"settle_sales":
{ Args: Record<PropertyKey, never>; Returns: number
                           },
"start_conversation":
{ Args: { "p_body": string,"p_listing_id": string,"p_shop_slug": string,"p_swap_offer": string }; Returns: Json
                           },
"update_profile":
{ Args: { "p_campus_slug": string,"p_first_name": string }; Returns: boolean
                           },
"update_shop":
{ Args: { "p_about": string,"p_campus_slug": string,"p_category_slug": string,"p_name": string,"p_photo_id"?: string,"p_pickup_point_ids": (string)[],"p_remove_photo"?: boolean,"p_slug"?: string,"p_tagline": string }; Returns: Json
                           }
          }
          Enums: {
            [_ in never]: never
          }
          CompositeTypes: {
            [_ in never]: never
          }
        }
}

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>

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
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
  ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
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
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
    : never = never
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
    : never = never
> = PublicCompositeTypeNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
  ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
  : never

export const Constants = {
  "public": {
          Enums: {
            
          }
        }
} as const

