
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {
  
  "public": {
          Tables: {
            "audit_log": {
                  Row: {
                    "action": string,"at": string,"detail": string,"id": string,"related_id": string | null,"staff_id": string | null,"staff_name": string,"subject_id": string | null,"target_id": string,"target_kind": string,"target_name": string
                  }
                  Insert: {
                    "action": string,"at"?: string,"detail"?: string,"id"?: string,"related_id"?: string | null,"staff_id"?: string | null,"staff_name": string,"subject_id"?: string | null,"target_id": string,"target_kind": string,"target_name": string
                  }
                  Update: {
                    "action"?: string,"at"?: string,"detail"?: string,"id"?: string,"related_id"?: string | null,"staff_id"?: string | null,"staff_name"?: string,"subject_id"?: string | null,"target_id"?: string,"target_kind"?: string,"target_name"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "audit_log_related_id_fkey"
      columns: ["related_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "audit_log_staff_id_fkey"
      columns: ["staff_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "audit_log_subject_id_fkey"
      columns: ["subject_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"campuses": {
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
                    "buyer_gone": boolean | null,"buyer_id": string | null,"completed_at": string | null,"confirmed_at": string | null,"confirmed_by": string | null,"created_at": string,"first_reply_at": string | null,"id": string,"is_offer": boolean,"last_message_at": string,"listing_id": string | null,"listing_title": string | null,"request_id": string | null,"request_title": string | null,"seller_gone": boolean,"shop_id": string | null,"status": string
                  }
                  Insert: {
                    "buyer_gone"?: never,"buyer_id"?: string | null,"completed_at"?: string | null,"confirmed_at"?: string | null,"confirmed_by"?: string | null,"created_at"?: string,"first_reply_at"?: string | null,"id"?: string,"is_offer"?: boolean,"last_message_at"?: string,"listing_id"?: string | null,"listing_title"?: string | null,"request_id"?: string | null,"request_title"?: string | null,"seller_gone"?: boolean,"shop_id"?: string | null,"status"?: string
                  }
                  Update: {
                    "buyer_gone"?: never,"buyer_id"?: string | null,"completed_at"?: string | null,"confirmed_at"?: string | null,"confirmed_by"?: string | null,"created_at"?: string,"first_reply_at"?: string | null,"id"?: string,"is_offer"?: boolean,"last_message_at"?: string,"listing_id"?: string | null,"listing_title"?: string | null,"request_id"?: string | null,"request_title"?: string | null,"seller_gone"?: boolean,"shop_id"?: string | null,"status"?: string
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
      foreignKeyName: "conversations_request_id_fkey"
      columns: ["request_id"]
isOneToOne: false
      referencedRelation: "my_requests"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "conversations_request_id_fkey"
      columns: ["request_id"]
isOneToOne: false
      referencedRelation: "request_cards"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "conversations_request_id_fkey"
      columns: ["request_id"]
isOneToOne: false
      referencedRelation: "requests"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "conversations_shop_id_fkey"
      columns: ["shop_id"]
isOneToOne: false
      referencedRelation: "shops"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "conversations_shop_id_fkey"
      columns: ["shop_id"]
isOneToOne: false
      referencedRelation: "storefronts"
      referencedColumns: ["shop_id"]
    }
                  ]
                },"featured_draws": {
                  Row: {
                    "campus_slug": string | null,"day": string,"id": string,"shop_ids": (string)[]
                  }
                  Insert: {
                    "campus_slug"?: string | null,"day": string,"id"?: string,"shop_ids": (string)[]
                  }
                  Update: {
                    "campus_slug"?: string | null,"day"?: string,"id"?: string,"shop_ids"?: (string)[]
                  }
                  Relationships: [
                    {
      foreignKeyName: "featured_draws_campus_slug_fkey"
      columns: ["campus_slug"]
isOneToOne: false
      referencedRelation: "campuses"
      referencedColumns: ["slug"]
    }
                  ]
                },"featured_pins": {
                  Row: {
                    "campus_slug": string | null,"created_at": string,"day": string,"id": string,"pinned_by": string | null,"shop_id": string
                  }
                  Insert: {
                    "campus_slug"?: string | null,"created_at"?: string,"day": string,"id"?: string,"pinned_by"?: string | null,"shop_id": string
                  }
                  Update: {
                    "campus_slug"?: string | null,"created_at"?: string,"day"?: string,"id"?: string,"pinned_by"?: string | null,"shop_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "featured_pins_campus_slug_fkey"
      columns: ["campus_slug"]
isOneToOne: false
      referencedRelation: "campuses"
      referencedColumns: ["slug"]
    },{
      foreignKeyName: "featured_pins_pinned_by_fkey"
      columns: ["pinned_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "featured_pins_shop_id_fkey"
      columns: ["shop_id"]
isOneToOne: false
      referencedRelation: "shops"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "featured_pins_shop_id_fkey"
      columns: ["shop_id"]
isOneToOne: false
      referencedRelation: "storefronts"
      referencedColumns: ["shop_id"]
    }
                  ]
                },"follows": {
                  Row: {
                    "account_id": string,"created_at": string,"id": string,"shop_id": string
                  }
                  Insert: {
                    "account_id": string,"created_at"?: string,"id"?: string,"shop_id": string
                  }
                  Update: {
                    "account_id"?: string,"created_at"?: string,"id"?: string,"shop_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "follows_account_id_fkey"
      columns: ["account_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "follows_shop_id_fkey"
      columns: ["shop_id"]
isOneToOne: false
      referencedRelation: "shops"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "follows_shop_id_fkey"
      columns: ["shop_id"]
isOneToOne: false
      referencedRelation: "storefronts"
      referencedColumns: ["shop_id"]
    }
                  ]
                },"form_states": {
                  Row: {
                    "account_id": string,"errors": (string)[],"expires_at": string,"form": string,"notice": string | null,"session_id": string,"taken": boolean,"values": NonNullable<Json>
                  }
                  Insert: {
                    "account_id": string,"errors"?: (string)[],"expires_at": string,"form": string,"notice"?: string | null,"session_id": string,"taken"?: boolean,"values"?: NonNullable<Json>
                  }
                  Update: {
                    "account_id"?: string,"errors"?: (string)[],"expires_at"?: string,"form"?: string,"notice"?: string | null,"session_id"?: string,"taken"?: boolean,"values"?: NonNullable<Json>
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
                },"hub_bookings": {
                  Row: {
                    "account_id": string,"answered_at": string | null,"answered_by": string | null,"created_at": string,"help": string,"id": string,"post_id": string,"status": string,"time": string
                  }
                  Insert: {
                    "account_id": string,"answered_at"?: string | null,"answered_by"?: string | null,"created_at"?: string,"help": string,"id"?: string,"post_id": string,"status"?: string,"time"?: string
                  }
                  Update: {
                    "account_id"?: string,"answered_at"?: string | null,"answered_by"?: string | null,"created_at"?: string,"help"?: string,"id"?: string,"post_id"?: string,"status"?: string,"time"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "hub_bookings_account_id_fkey"
      columns: ["account_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "hub_bookings_answered_by_fkey"
      columns: ["answered_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "hub_bookings_post_id_fkey"
      columns: ["post_id"]
isOneToOne: false
      referencedRelation: "hub_cards"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "hub_bookings_post_id_fkey"
      columns: ["post_id"]
isOneToOne: false
      referencedRelation: "hub_posts"
      referencedColumns: ["id"]
    }
                  ]
                },"hub_posts": {
                  Row: {
                    "author_id": string | null,"body": string,"campus_slug": string | null,"capacity": number | null,"cover_photo_id": string | null,"created_at": string,"going": number | null,"id": string,"image_alt": string,"image_src": string | null,"kind": string,"place": string | null,"published": boolean,"published_at": string | null,"starts_at": string | null,"summary": string,"title": string,"updated_at": string
                  }
                  Insert: {
                    "author_id"?: string | null,"body": string,"campus_slug"?: string | null,"capacity"?: number | null,"cover_photo_id"?: string | null,"created_at"?: string,"going"?: number | null,"id"?: string,"image_alt"?: string,"image_src"?: string | null,"kind": string,"place"?: string | null,"published"?: boolean,"published_at"?: string | null,"starts_at"?: string | null,"summary": string,"title": string,"updated_at"?: string
                  }
                  Update: {
                    "author_id"?: string | null,"body"?: string,"campus_slug"?: string | null,"capacity"?: number | null,"cover_photo_id"?: string | null,"created_at"?: string,"going"?: number | null,"id"?: string,"image_alt"?: string,"image_src"?: string | null,"kind"?: string,"place"?: string | null,"published"?: boolean,"published_at"?: string | null,"starts_at"?: string | null,"summary"?: string,"title"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "hub_posts_author_id_fkey"
      columns: ["author_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "hub_posts_campus_slug_fkey"
      columns: ["campus_slug"]
isOneToOne: false
      referencedRelation: "campuses"
      referencedColumns: ["slug"]
    },{
      foreignKeyName: "hub_posts_cover_photo_id_fkey"
      columns: ["cover_photo_id"]
isOneToOne: false
      referencedRelation: "photos"
      referencedColumns: ["id"]
    }
                  ]
                },"hub_rsvps": {
                  Row: {
                    "account_id": string,"created_at": string,"post_id": string
                  }
                  Insert: {
                    "account_id": string,"created_at"?: string,"post_id": string
                  }
                  Update: {
                    "account_id"?: string,"created_at"?: string,"post_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "hub_rsvps_account_id_fkey"
      columns: ["account_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "hub_rsvps_post_id_fkey"
      columns: ["post_id"]
isOneToOne: false
      referencedRelation: "hub_cards"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "hub_rsvps_post_id_fkey"
      columns: ["post_id"]
isOneToOne: false
      referencedRelation: "hub_posts"
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
                    "campus_slug": string,"category_slug": string,"condition": string | null,"created_at": string,"description": string,"first_published_at": string | null,"handover": string,"hidden_at": string | null,"hidden_reason": string | null,"id": string,"kind": string,"pay_mode": string,"pickup_point_id": string | null,"price_is_from": boolean,"price_zar": number | null,"shop_id": string,"state": string,"swap_for": string | null,"title": string,"updated_at": string
                  }
                  Insert: {
                    "campus_slug": string,"category_slug": string,"condition"?: string | null,"created_at"?: string,"description": string,"first_published_at"?: string | null,"handover": string,"hidden_at"?: string | null,"hidden_reason"?: string | null,"id"?: string,"kind": string,"pay_mode": string,"pickup_point_id"?: string | null,"price_is_from"?: boolean,"price_zar"?: number | null,"shop_id": string,"state": string,"swap_for"?: string | null,"title": string,"updated_at"?: string
                  }
                  Update: {
                    "campus_slug"?: string,"category_slug"?: string,"condition"?: string | null,"created_at"?: string,"description"?: string,"first_published_at"?: string | null,"handover"?: string,"hidden_at"?: string | null,"hidden_reason"?: string | null,"id"?: string,"kind"?: string,"pay_mode"?: string,"pickup_point_id"?: string | null,"price_is_from"?: boolean,"price_zar"?: number | null,"shop_id"?: string,"state"?: string,"swap_for"?: string | null,"title"?: string,"updated_at"?: string
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
    },{
      foreignKeyName: "listings_shop_id_fkey"
      columns: ["shop_id"]
isOneToOne: false
      referencedRelation: "storefronts"
      referencedColumns: ["shop_id"]
    }
                  ]
                },"mentor_notes": {
                  Row: {
                    "author_id": string | null,"author_name": string,"check_in_on": string | null,"created_at": string,"id": string,"kind": string,"owner_id": string,"text": string
                  }
                  Insert: {
                    "author_id"?: string | null,"author_name": string,"check_in_on"?: string | null,"created_at"?: string,"id"?: string,"kind": string,"owner_id": string,"text": string
                  }
                  Update: {
                    "author_id"?: string | null,"author_name"?: string,"check_in_on"?: string | null,"created_at"?: string,"id"?: string,"kind"?: string,"owner_id"?: string,"text"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "mentor_notes_author_id_fkey"
      columns: ["author_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "mentor_notes_owner_id_fkey"
      columns: ["owner_id"]
isOneToOne: false
      referencedRelation: "profiles"
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
      referencedRelation: "my_conversation_tails"
      referencedColumns: ["conversation_id"]
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
                    "account_id": string,"count": number | null,"created_at": string,"href": string,"id": string,"kind": string,"read_at": string | null,"subject_id": string,"text": string
                  }
                  Insert: {
                    "account_id": string,"count"?: number | null,"created_at"?: string,"href": string,"id"?: string,"kind": string,"read_at"?: string | null,"subject_id": string,"text": string
                  }
                  Update: {
                    "account_id"?: string,"count"?: number | null,"created_at"?: string,"href"?: string,"id"?: string,"kind"?: string,"read_at"?: string | null,"subject_id"?: string,"text"?: string
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
                    "created_at": string,"id": string,"owner_id": string | null,"path": string,"type": string,"use": string | null
                  }
                  Insert: {
                    "created_at"?: string,"id"?: string,"owner_id"?: string | null,"path": string,"type": string,"use"?: string | null
                  }
                  Update: {
                    "created_at"?: string,"id"?: string,"owner_id"?: string | null,"path"?: string,"type"?: string,"use"?: string | null
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
                    "closed_at": string | null,"closed_by": string | null,"created_at": string,"detail": string,"id": string,"note": string | null,"outcome": string | null,"reason": string,"reporter_id": string,"status": string,"target_gone": boolean,"target_id": string,"target_kind": string,"target_owner_id": string | null,"target_title": string
                  }
                  Insert: {
                    "closed_at"?: string | null,"closed_by"?: string | null,"created_at"?: string,"detail"?: string,"id"?: string,"note"?: string | null,"outcome"?: string | null,"reason": string,"reporter_id": string,"status"?: string,"target_gone"?: boolean,"target_id": string,"target_kind": string,"target_owner_id"?: string | null,"target_title": string
                  }
                  Update: {
                    "closed_at"?: string | null,"closed_by"?: string | null,"created_at"?: string,"detail"?: string,"id"?: string,"note"?: string | null,"outcome"?: string | null,"reason"?: string,"reporter_id"?: string,"status"?: string,"target_gone"?: boolean,"target_id"?: string,"target_kind"?: string,"target_owner_id"?: string | null,"target_title"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "reports_closed_by_fkey"
      columns: ["closed_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "reports_reporter_id_fkey"
      columns: ["reporter_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "reports_target_owner_id_fkey"
      columns: ["target_owner_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"requests": {
                  Row: {
                    "asker_id": string | null,"budget_zar": number | null,"campus_slug": string,"category_slug": string,"closed_at": string | null,"closed_by": string | null,"closes_on": string | null,"created_at": string,"details": string,"hidden_at": string | null,"hidden_reason": string | null,"id": string,"needed_by": string | null,"reminded_for": string | null,"seed_offers": number,"status": string,"swap_welcome": boolean,"title": string,"updated_at": string
                  }
                  Insert: {
                    "asker_id"?: string | null,"budget_zar"?: number | null,"campus_slug": string,"category_slug": string,"closed_at"?: string | null,"closed_by"?: string | null,"closes_on"?: never,"created_at"?: string,"details": string,"hidden_at"?: string | null,"hidden_reason"?: string | null,"id"?: string,"needed_by"?: string | null,"reminded_for"?: string | null,"seed_offers"?: number,"status"?: string,"swap_welcome"?: boolean,"title": string,"updated_at"?: string
                  }
                  Update: {
                    "asker_id"?: string | null,"budget_zar"?: number | null,"campus_slug"?: string,"category_slug"?: string,"closed_at"?: string | null,"closed_by"?: string | null,"closes_on"?: never,"created_at"?: string,"details"?: string,"hidden_at"?: string | null,"hidden_reason"?: string | null,"id"?: string,"needed_by"?: string | null,"reminded_for"?: string | null,"seed_offers"?: number,"status"?: string,"swap_welcome"?: boolean,"title"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "requests_asker_id_fkey"
      columns: ["asker_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "requests_campus_slug_fkey"
      columns: ["campus_slug"]
isOneToOne: false
      referencedRelation: "campuses"
      referencedColumns: ["slug"]
    },{
      foreignKeyName: "requests_category_slug_fkey"
      columns: ["category_slug"]
isOneToOne: false
      referencedRelation: "categories"
      referencedColumns: ["slug"]
    }
                  ]
                },"saved_searches": {
                  Row: {
                    "account_id": string,"campus_slug": string | null,"category": string | null,"created_at": string,"deals": string | null,"id": string,"paused_at": string | null,"pay": string | null,"price": string | null,"q": string | null,"search_key": string
                  }
                  Insert: {
                    "account_id": string,"campus_slug"?: string | null,"category"?: string | null,"created_at"?: string,"deals"?: string | null,"id"?: string,"paused_at"?: string | null,"pay"?: string | null,"price"?: string | null,"q"?: string | null,"search_key": string
                  }
                  Update: {
                    "account_id"?: string,"campus_slug"?: string | null,"category"?: string | null,"created_at"?: string,"deals"?: string | null,"id"?: string,"paused_at"?: string | null,"pay"?: string | null,"price"?: string | null,"q"?: string | null,"search_key"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "saved_searches_account_id_fkey"
      columns: ["account_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "saved_searches_campus_slug_fkey"
      columns: ["campus_slug"]
isOneToOne: false
      referencedRelation: "campuses"
      referencedColumns: ["slug"]
    },{
      foreignKeyName: "saved_searches_category_fkey"
      columns: ["category"]
isOneToOne: false
      referencedRelation: "categories"
      referencedColumns: ["slug"]
    }
                  ]
                },"seller_profiles": {
                  Row: {
                    "account_id": string,"applied_at": string,"approved_at": string | null,"declined_at": string | null,"mentor_id": string | null,"paused_by": string | null,"seller_paused_too": boolean,"shop_id": string | null,"staff_reason": string | null,"status": string
                  }
                  Insert: {
                    "account_id": string,"applied_at"?: string,"approved_at"?: string | null,"declined_at"?: string | null,"mentor_id"?: string | null,"paused_by"?: string | null,"seller_paused_too"?: boolean,"shop_id"?: string | null,"staff_reason"?: string | null,"status": string
                  }
                  Update: {
                    "account_id"?: string,"applied_at"?: string,"approved_at"?: string | null,"declined_at"?: string | null,"mentor_id"?: string | null,"paused_by"?: string | null,"seller_paused_too"?: boolean,"shop_id"?: string | null,"staff_reason"?: string | null,"status"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "seller_profiles_account_id_fkey"
      columns: ["account_id"]
isOneToOne: true
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "seller_profiles_mentor_id_fkey"
      columns: ["mentor_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "seller_profiles_shop_id_fkey"
      columns: ["shop_id"]
isOneToOne: true
      referencedRelation: "shops"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "seller_profiles_shop_id_fkey"
      columns: ["shop_id"]
isOneToOne: true
      referencedRelation: "storefronts"
      referencedColumns: ["shop_id"]
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
    },{
      foreignKeyName: "shop_pickup_points_shop_id_fkey"
      columns: ["shop_id"]
isOneToOne: false
      referencedRelation: "storefronts"
      referencedColumns: ["shop_id"]
    }
                  ]
                },"shop_previous_slugs": {
                  Row: {
                    "created_at": string,"shop_id": string,"slug": string
                  }
                  Insert: {
                    "created_at"?: string,"shop_id": string,"slug": string
                  }
                  Update: {
                    "created_at"?: string,"shop_id"?: string,"slug"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "shop_previous_slugs_shop_id_fkey"
      columns: ["shop_id"]
isOneToOne: false
      referencedRelation: "shops"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "shop_previous_slugs_shop_id_fkey"
      columns: ["shop_id"]
isOneToOne: false
      referencedRelation: "storefronts"
      referencedColumns: ["shop_id"]
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
            "hub_cards": {
                  Row: {
                    "body": string | null,"campus_slug": string | null,"capacity": number | null,"cover_photo_id": string | null,"created_at": string | null,"going": number | null,"going_now": number | null,"id": string | null,"image_alt": string | null,"image_src": string | null,"kind": string | null,"place": string | null,"published_at": string | null,"starts_at": string | null,"summary": string | null,"title": string | null
                  }
                  Insert: {
                           "body"?: string | null,"campus_slug"?: string | null,"capacity"?: number | null,"cover_photo_id"?: string | null,"created_at"?: string | null,"going"?: number | null,"going_now"?: never,"id"?: string | null,"image_alt"?: string | null,"image_src"?: string | null,"kind"?: string | null,"place"?: string | null,"published_at"?: string | null,"starts_at"?: string | null,"summary"?: string | null,"title"?: string | null
                         }
                        Update: {
                           "body"?: string | null,"campus_slug"?: string | null,"capacity"?: number | null,"cover_photo_id"?: string | null,"created_at"?: string | null,"going"?: number | null,"going_now"?: never,"id"?: string | null,"image_alt"?: string | null,"image_src"?: string | null,"kind"?: string | null,"place"?: string | null,"published_at"?: string | null,"starts_at"?: string | null,"summary"?: string | null,"title"?: string | null
                         }
                        Relationships: [
                    {
      foreignKeyName: "hub_posts_campus_slug_fkey"
      columns: ["campus_slug"]
isOneToOne: false
      referencedRelation: "campuses"
      referencedColumns: ["slug"]
    },{
      foreignKeyName: "hub_posts_cover_photo_id_fkey"
      columns: ["cover_photo_id"]
isOneToOne: false
      referencedRelation: "photos"
      referencedColumns: ["id"]
    }
                  ]
                },"my_conversation_tails": {
                  Row: {
                    "conversation_id": string | null,"last_body": string | null,"last_sent_at": string | null,"last_side": string | null,"unread": number | null
                  }
                  Relationships: [
                    
                  ]
                },"my_conversations": {
                  Row: {
                    "buyer_gone": boolean | null,"buyer_name": string | null,"completed_at": string | null,"confirmed_at": string | null,"confirmed_by": string | null,"created_at": string | null,"first_reply_at": string | null,"id": string | null,"is_offer": boolean | null,"last_message_at": string | null,"listing_id": string | null,"listing_title": string | null,"request_id": string | null,"request_state": string | null,"request_title": string | null,"seller_gone": boolean | null,"shop_id": string | null,"status": string | null,"viewer_side": string | null
                  }
                  Insert: {
                           "buyer_gone"?: boolean | null,"buyer_name"?: never,"completed_at"?: string | null,"confirmed_at"?: string | null,"confirmed_by"?: string | null,"created_at"?: string | null,"first_reply_at"?: string | null,"id"?: string | null,"is_offer"?: boolean | null,"last_message_at"?: string | null,"listing_id"?: string | null,"listing_title"?: string | null,"request_id"?: string | null,"request_state"?: never,"request_title"?: string | null,"seller_gone"?: boolean | null,"shop_id"?: string | null,"status"?: string | null,"viewer_side"?: never
                         }
                        Update: {
                           "buyer_gone"?: boolean | null,"buyer_name"?: never,"completed_at"?: string | null,"confirmed_at"?: string | null,"confirmed_by"?: string | null,"created_at"?: string | null,"first_reply_at"?: string | null,"id"?: string | null,"is_offer"?: boolean | null,"last_message_at"?: string | null,"listing_id"?: string | null,"listing_title"?: string | null,"request_id"?: string | null,"request_state"?: never,"request_title"?: string | null,"seller_gone"?: boolean | null,"shop_id"?: string | null,"status"?: string | null,"viewer_side"?: never
                         }
                        Relationships: [
                    {
      foreignKeyName: "conversations_listing_id_fkey"
      columns: ["listing_id"]
isOneToOne: false
      referencedRelation: "listings"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "conversations_request_id_fkey"
      columns: ["request_id"]
isOneToOne: false
      referencedRelation: "my_requests"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "conversations_request_id_fkey"
      columns: ["request_id"]
isOneToOne: false
      referencedRelation: "request_cards"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "conversations_request_id_fkey"
      columns: ["request_id"]
isOneToOne: false
      referencedRelation: "requests"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "conversations_shop_id_fkey"
      columns: ["shop_id"]
isOneToOne: false
      referencedRelation: "shops"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "conversations_shop_id_fkey"
      columns: ["shop_id"]
isOneToOne: false
      referencedRelation: "storefronts"
      referencedColumns: ["shop_id"]
    }
                  ]
                },"my_requests": {
                  Row: {
                    "budget_zar": number | null,"campus_slug": string | null,"category_slug": string | null,"closed_at": string | null,"closed_by": string | null,"closes_on": string | null,"created_at": string | null,"details": string | null,"hidden_at": string | null,"hidden_reason": string | null,"id": string | null,"needed_by": string | null,"offers": number | null,"state": string | null,"status": string | null,"swap_welcome": boolean | null,"title": string | null,"updated_at": string | null
                  }
                  Insert: {
                           "budget_zar"?: number | null,"campus_slug"?: string | null,"category_slug"?: string | null,"closed_at"?: string | null,"closed_by"?: string | null,"closes_on"?: string | null,"created_at"?: string | null,"details"?: string | null,"hidden_at"?: string | null,"hidden_reason"?: string | null,"id"?: string | null,"needed_by"?: string | null,"offers"?: never,"state"?: never,"status"?: string | null,"swap_welcome"?: boolean | null,"title"?: string | null,"updated_at"?: string | null
                         }
                        Update: {
                           "budget_zar"?: number | null,"campus_slug"?: string | null,"category_slug"?: string | null,"closed_at"?: string | null,"closed_by"?: string | null,"closes_on"?: string | null,"created_at"?: string | null,"details"?: string | null,"hidden_at"?: string | null,"hidden_reason"?: string | null,"id"?: string | null,"needed_by"?: string | null,"offers"?: never,"state"?: never,"status"?: string | null,"swap_welcome"?: boolean | null,"title"?: string | null,"updated_at"?: string | null
                         }
                        Relationships: [
                    {
      foreignKeyName: "requests_campus_slug_fkey"
      columns: ["campus_slug"]
isOneToOne: false
      referencedRelation: "campuses"
      referencedColumns: ["slug"]
    },{
      foreignKeyName: "requests_category_slug_fkey"
      columns: ["category_slug"]
isOneToOne: false
      referencedRelation: "categories"
      referencedColumns: ["slug"]
    }
                  ]
                },"request_cards": {
                  Row: {
                    "budget_zar": number | null,"campus_slug": string | null,"category_slug": string | null,"closed_at": string | null,"closes_on": string | null,"created_at": string | null,"details": string | null,"id": string | null,"needed_by": string | null,"offers": number | null,"status": string | null,"swap_welcome": boolean | null,"title": string | null,"updated_at": string | null
                  }
                  Insert: {
                           "budget_zar"?: number | null,"campus_slug"?: string | null,"category_slug"?: string | null,"closed_at"?: string | null,"closes_on"?: string | null,"created_at"?: string | null,"details"?: string | null,"id"?: string | null,"needed_by"?: string | null,"offers"?: never,"status"?: string | null,"swap_welcome"?: boolean | null,"title"?: string | null,"updated_at"?: string | null
                         }
                        Update: {
                           "budget_zar"?: number | null,"campus_slug"?: string | null,"category_slug"?: string | null,"closed_at"?: string | null,"closes_on"?: string | null,"created_at"?: string | null,"details"?: string | null,"id"?: string | null,"needed_by"?: string | null,"offers"?: never,"status"?: string | null,"swap_welcome"?: boolean | null,"title"?: string | null,"updated_at"?: string | null
                         }
                        Relationships: [
                    {
      foreignKeyName: "requests_campus_slug_fkey"
      columns: ["campus_slug"]
isOneToOne: false
      referencedRelation: "campuses"
      referencedColumns: ["slug"]
    },{
      foreignKeyName: "requests_category_slug_fkey"
      columns: ["category_slug"]
isOneToOne: false
      referencedRelation: "categories"
      referencedColumns: ["slug"]
    }
                  ]
                },"staff_accounts": {
                  Row: {
                    "campus_slug": string | null,"email": string | null,"first_name": string | null,"id": string | null,"roles": (string)[] | null
                  }
                  Relationships: [
                    
                  ]
                },"staff_hub_posts": {
                  Row: {
                    "author_id": string | null,"body": string | null,"campus_slug": string | null,"capacity": number | null,"cover_photo_id": string | null,"created_at": string | null,"going": number | null,"id": string | null,"image_alt": string | null,"image_src": string | null,"kind": string | null,"place": string | null,"published": boolean | null,"published_at": string | null,"starts_at": string | null,"summary": string | null,"title": string | null,"updated_at": string | null
                  }
                  Relationships: [
                    
                  ]
                },"staff_reports": {
                  Row: {
                    "closed_at": string | null,"closed_by": string | null,"created_at": string | null,"detail": string | null,"id": string | null,"note": string | null,"outcome": string | null,"own": string | null,"reason": string | null,"reporter_id": string | null,"status": string | null,"target_gone": boolean | null,"target_id": string | null,"target_kind": string | null,"target_title": string | null
                  }
                  Relationships: [
                    
                  ]
                },"staff_seller_profiles": {
                  Row: {
                    "account_id": string | null,"applied_at": string | null,"approved_at": string | null,"declined_at": string | null,"mentor_id": string | null,"paused_by": string | null,"seller_paused_too": boolean | null,"shop_id": string | null,"staff_reason": string | null,"status": string | null
                  }
                  Relationships: [
                    
                  ]
                },"storefronts": {
                  Row: {
                    "shop_id": string | null,"slug": string | null,"status": string | null
                  }
                  Insert: {
                           "shop_id"?: string | null,"slug"?: string | null,"status"?: never
                         }
                        Update: {
                           "shop_id"?: string | null,"slug"?: string | null,"status"?: never
                         }
                        Relationships: [
                    
                  ]
                }
          }
          Functions: {
            "account_sessions":
{ Args: { "p_account": string }; Returns: {
              "expires_at": string,"signed_in_at": string
            }[]
                           },
"add_check_in":
{ Args: { "p_day": string,"p_once_token": string,"p_owner": string,"p_text": string }; Returns: string
                           },
"add_hub_photo":
{ Args: { "p_type": string }; Returns: Json
                           },
"add_mentor_note":
{ Args: { "p_once_token": string,"p_owner": string,"p_text": string }; Returns: string
                           },
"add_photos":
{ Args: { "p_types": (string)[] }; Returns: Json
                           },
"add_pickup_point":
{ Args: { "p_campus": string,"p_name": string }; Returns: string
                           },
"admin_weekly_counts":
{ Args: { "p_now"?: string }; Returns: {
              "campus_slug": string,"count": number,"measure": string,"period": string
            }[]
                           },
"answer_booking":
{ Args: { "p_accept": boolean,"p_booking": string }; Returns: string
                           },
"approve_shop":
{ Args: { "p_account": string }; Returns: string
                           },
"cancel_rsvp":
{ Args: { "p_post": string }; Returns: string
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
"decline_shop":
{ Args: { "p_account": string,"p_reason": string }; Returns: string
                           },
"delete_listing":
{ Args: { "p_listing_id": string }; Returns: Json
                           },
"delete_request":
{ Args: { "p_id": string }; Returns: string
                           },
"delete_search":
{ Args: { "p_id": string }; Returns: string
                           },
"delete_sign_in_attempt":
{ Args: { "p_key": string }; Returns: undefined
                           },
"dismiss_report":
{ Args: { "p_note": string,"p_report": string }; Returns: string
                           },
"follow_shop":
{ Args: { "p_shop": string }; Returns: string
                           },
"follower_count":
{ Args: { "p_shop": string }; Returns: number
                           },
"forget_account":
{ Args: { "p_account_id": string }; Returns: (string)[]
                           },
"get_sign_in_attempt":
{ Args: { "p_key": string }; Returns: Json
                           },
"give_role":
{ Args: { "p_email": string,"p_once_token": string,"p_role": string }; Returns: string
                           },
"hide_listing":
{ Args: { "p_listing": string,"p_reason": string }; Returns: string
                           },
"hide_request":
{ Args: { "p_reason": string,"p_request": string }; Returns: string
                           },
"hub_going":
{ Args: { "p_post": string }; Returns: number
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
"mentor_shop_numbers":
{ Args: { "p_now"?: string,"p_shop": string }; Returns: {
              "due": number,"enquiries": number,"replied_in_time": number,"sales_confirmed": number
            }[]
                           },
"my_conversations_started_since":
{ Args: { "p_since": string }; Returns: number
                           },
"my_messages_sent_since":
{ Args: { "p_since": string }; Returns: number
                           },
"my_previous_shop_slugs":
{ Args: Record<PropertyKey, never>; Returns: (string)[]
                           },
"my_unread_counts":
{ Args: Record<PropertyKey, never>; Returns: Json
                           },
"orphan_photo_paths":
{ Args: { "p_limit"?: number }; Returns: (string)[]
                           },
"photo_file":
{ Args: { "p_photo": string }; Returns: {
              "hub_only": boolean,"owner_only": string,"path": string,"type": string
            }[]
                           },
"pin_shop":
{ Args: { "p_campus": string,"p_day": string,"p_shop": string }; Returns: string
                           },
"record_consent":
{ Args: { "p_policy_version": string }; Returns: boolean
                           },
"record_search_matches":
{ Args: { "p_listing_id": string,"p_search_ids": (string)[],"p_texts": Json }; Returns: number
                           },
"record_wrong_try":
{ Args: { "p_attempt_key": string }; Returns: number
                           },
"reject_sale":
{ Args: { "p_conversation_id": string }; Returns: string
                           },
"remove_role":
{ Args: { "p_account": string,"p_role": string }; Returns: string
                           },
"rename_pickup_point":
{ Args: { "p_name": string,"p_point": string }; Returns: string
                           },
"request_offer_count":
{ Args: { "p_request": string }; Returns: number
                           },
"request_slot":
{ Args: { "p_help": string,"p_post": string,"p_time"?: string }; Returns: string
                           },
"resend_for_approval":
{ Args: Record<PropertyKey, never>; Returns: string
                           },
"reserve_code_send":
{ Args: { "p_email": string,"p_max_sends"?: number }; Returns: boolean
                           },
"reserve_ip_code_send":
{ Args: { "p_ip_key": string,"p_max_sends"?: number }; Returns: boolean
                           },
"restore_pickup_point":
{ Args: { "p_point": string }; Returns: string
                           },
"retire_pickup_point":
{ Args: { "p_point": string }; Returns: string
                           },
"rsvp":
{ Args: { "p_post": string }; Returns: string
                           },
"save_hub_post":
{ Args: { "p_body": string,"p_campus": string,"p_capacity": number,"p_cover_photo_id"?: string,"p_id": string,"p_kind": string,"p_once_token"?: string,"p_place": string,"p_published": boolean,"p_starts_at": string,"p_summary": string,"p_title": string }; Returns: Json
                           },
"save_listing":
{ Args: { "p_category_slug": string,"p_condition": string,"p_description": string,"p_handover": string,"p_kind": string,"p_listing_id": string,"p_pay_mode": string,"p_photos": Json,"p_pickup_point_id": string,"p_price_is_from": boolean,"p_price_zar": number,"p_publish": boolean,"p_swap_for": string,"p_title": string }; Returns: Json
                           },
"save_onboarding_draft":
{ Args: { "p_about": string,"p_campus_slug": string,"p_category_slug": string,"p_name": string,"p_photo_id": string,"p_pickup_point_ids": (string)[],"p_tagline": string }; Returns: Json
                           },
"save_request":
{ Args: { "p_budget_zar": number,"p_campus_slug": string,"p_category_slug": string,"p_details": string,"p_id": string,"p_needed_by": string,"p_once_token"?: string,"p_swap_welcome": boolean,"p_title": string }; Returns: Json
                           },
"save_search":
{ Args: { "p_campus_slug": string,"p_category": string,"p_deals": string,"p_pay": string,"p_price": string,"p_q": string,"p_search_key": string }; Returns: string
                           },
"save_sign_in_attempt":
{ Args: { "p_attempt": Json }; Returns: undefined
                           },
"send_message":
{ Args: { "p_body": string,"p_conversation_id": string }; Returns: string
                           },
"set_listing_state":
{ Args: { "p_listing_id": string,"p_to": string }; Returns: string
                           },
"set_request_open":
{ Args: { "p_id": string,"p_open": boolean }; Returns: string
                           },
"set_search_paused":
{ Args: { "p_id": string,"p_paused": boolean }; Returns: string
                           },
"set_shop_mentor":
{ Args: { "p_mentor": string,"p_shop": string }; Returns: string
                           },
"set_shop_paused":
{ Args: { "p_paused": boolean }; Returns: string
                           },
"set_shop_verified":
{ Args: { "p_shop": string,"p_verified": boolean }; Returns: string
                           },
"settle_auto_confirm":
{ Args: { "p_now"?: string }; Returns: number
                           },
"settle_requests":
{ Args: { "p_now"?: string }; Returns: number
                           },
"settle_sales":
{ Args: Record<PropertyKey, never>; Returns: number
                           },
"shop_name_taken":
{ Args: { "p_campus_slug": string,"p_except_slug"?: string,"p_name": string }; Returns: boolean
                           },
"shop_slug_taken":
{ Args: { "p_slug": string }; Returns: boolean
                           },
"show_listing":
{ Args: { "p_listing": string }; Returns: string
                           },
"show_request":
{ Args: { "p_request": string }; Returns: string
                           },
"staff_find_account":
{ Args: { "p_email": string }; Returns: {
              "first_name": string,"id": string,"roles": (string)[]
            }[]
                           },
"staff_pause_shop":
{ Args: { "p_reason": string,"p_shop": string }; Returns: string
                           },
"staff_resume_shop":
{ Args: { "p_shop": string }; Returns: string
                           },
"start_conversation":
{ Args: { "p_body": string,"p_listing_id": string,"p_shop_slug": string,"p_swap_offer": string }; Returns: Json
                           },
"start_offer":
{ Args: { "p_body": string,"p_listing_id": string,"p_request_id": string }; Returns: Json
                           },
"sweep_waiting_photos":
{ Args: Record<PropertyKey, never>; Returns: (string)[]
                           },
"take_form_state":
{ Args: { "p_key": string }; Returns: string
                           },
"unfollow_shop":
{ Args: { "p_shop": string }; Returns: string
                           },
"unpin_shop":
{ Args: { "p_pin": string }; Returns: string
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

