// ── Auth ─────────────────────────────────────────────────────────────────────
export interface UserOut {
  id: string
  email: string
  full_name: string | null
  is_active: boolean
  created_at: string
}

export interface TokenResponse {
  access_token: string
  refresh_token: string
  token_type: string
}

// ── Sites ─────────────────────────────────────────────────────────────────────
export interface SiteOut {
  id: string
  name: string
  description: string | null
  address: string | null
  owner_id?: string
  created_by: string | null
  role: string | null
  item_count: number
  member_count: number
  created_at: string
}

export interface SiteMemberOut {
  id: string
  user_id: string
  site_id: string
  role: 'owner' | 'admin' | 'editor' | 'viewer'
  user_email: string | null
  user_display_name: string | null
  accepted_at: string | null
  created_at: string
}

// ── Locations ─────────────────────────────────────────────────────────────────
export interface LocationOut {
  id: string
  site_id: string
  parent_id: string | null
  name: string
  level?: string
  description: string | null
  floor_level?: number | null
  floor_plan_x?: number | null
  floor_plan_y?: number | null
  path?: string
  item_count?: number
  children?: LocationOut[]
}

export interface FloorMapOut {
  id: string
  location_id: string
  site_id: string
  image_url: string | null
  vector_data: {
    shapes?: Array<{
      id: string
      type: 'rect'
      x: number
      y: number
      width: number
      height: number
      label: string
      location_id?: string
    }>
  } | null
  width: number | null
  height: number | null
  created_at: string
  updated_at: string | null
}

export interface ItemFloorPlanPinOut {
  id: string
  pin_index: number
  x: number
  y: number
}

// Aliases for backwards compat
export type Location = LocationOut
export type Item = ItemOut
export type Site = SiteOut
export type Member = SiteMemberOut

// ── Items ─────────────────────────────────────────────────────────────────────
export type ItemCondition = 'excellent' | 'good' | 'fair' | 'poor' | 'damaged' | 'new' | 'unknown'
export type ItemStatus = 'active' | 'archived' | 'missing' | 'disposed'

export interface ItemOut {
  id: string
  site_id: string
  location_id: string | null
  item_type: string
  name: string
  description: string | null
  category: string | null
  brand: string | null
  model: string | null
  condition: string
  owner_user_id: string | null
  owner_contact_name: string | null
  quantity: number
  serial_numbers: string[] | null
  barcodes: string[] | null
  purchase_date: string | null
  purchase_location: string | null
  purchase_price_cents: number | null
  estimated_value_cents: number | null
  currency_code: string
  warranty_expires_at: string | null
  warranty_notes: string | null
  notes: string | null
  custom_tags: string[] | null
  primary_photo_id: string | null
  gps_latitude: number | null
  gps_longitude: number | null
  floor_plan_x: number | null
  floor_plan_y: number | null
  pins: ItemFloorPlanPinOut[]
  confidence_score: number | null
  verification_count: number
  is_verified: boolean
  created_by: string | null
  created_at: string
  updated_at: string | null
  // Computed by backend
  primary_photo_url: string | null
  location_path: string | null
}

export interface ItemMovement {
  id: string
  item_id: string
  from_location_id: string | null
  to_location_id: string
  moved_by: string | null
  moved_at: string
  reason: string | null
  notes: string | null
  // Joined flat fields
  from_location_name: string | null
  to_location_name: string | null
  moved_by_display_name: string | null
  photo_thumbnail_url: string | null
}

// ── Photos ─────────────────────────────────────────────────────────────────────
export type PhotoAiStatus = 'pending' | 'processing' | 'completed' | 'failed'

export interface PhotoOut {
  id: string
  site_id: string
  location_id: string | null
  url: string
  thumbnail_url: string | null
  ai_status: PhotoAiStatus
  captured_at: string | null
  location?: { id: string; name: string; path?: string } | null
}

// ── Review / Proposals ────────────────────────────────────────────────────────
export type ProposalStatus = 'pending' | 'approved' | 'rejected' | 'merged'

export interface DetectedObject {
  id: string
  label: string
  confidence: number
  bbox: { x: number; y: number; width: number; height: number }
}

export interface ProposalOut {
  id: string
  photo_id: string
  review_status: string
  // Frontend-friendly aliases (populated by backend model_validator)
  status: ProposalStatus
  ai_label: string | null
  ai_confidence: number
  ai_category: string | null
  duplicate_of_id: string | null
  detected_objects: DetectedObject[]
  proposed_fields: Partial<{ name: string; description: string; category: string; brand: string; model: string }>
  // Raw fields
  object_name: string | null
  confidence_score: number | null
  bounding_box: Record<string, number> | null
  category: string | null
  brand: string | null
  model: string | null
  created_at: string
  reviewed_at: string | null
}

export interface ReviewQueueItem {
  photo: PhotoOut
  proposals: ProposalOut[]
  pending_count: number
}

export interface ReviewQueueResponse {
  items: ReviewQueueItem[]
  total: number
  pending_count: number
}

// ── Pagination ─────────────────────────────────────────────────────────────────
export interface PaginatedResponse<T> {
  items: T[]
  total: number
  page: number
  size: number
  pages: number
}

// ── Filters ───────────────────────────────────────────────────────────────────
export interface ItemFilters {
  search?: string
  category?: string
  location_id?: string
  condition?: string
  is_verified?: boolean
  sort?: string
  page?: number
  size?: number
}
