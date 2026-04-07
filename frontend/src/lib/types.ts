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
  owner_id: string
  member_count: number
  item_count: number
  created_at: string
}

export interface SiteMemberOut {
  id: string
  user_id: string
  site_id: string
  role: 'owner' | 'admin' | 'member' | 'viewer'
  user: UserOut
  joined_at: string
}

// ── Locations ─────────────────────────────────────────────────────────────────
export interface LocationOut {
  id: string
  site_id: string
  parent_id: string | null
  name: string
  description: string | null
  floor_level: number | null
  path: string
  item_count: number
  children?: LocationOut[]
}

// ── Items ─────────────────────────────────────────────────────────────────────
export type ItemCondition = 'excellent' | 'good' | 'fair' | 'poor' | 'damaged'
export type ItemStatus = 'active' | 'archived' | 'missing' | 'disposed'

export interface ItemOut {
  id: string
  site_id: string
  location_id: string | null
  location?: LocationOut | null
  name: string
  description: string | null
  category: string | null
  subcategory: string | null
  brand: string | null
  model: string | null
  serial_number: string | null
  asset_tag: string | null
  condition: ItemCondition
  status: ItemStatus
  quantity: number
  unit: string | null
  purchase_date: string | null
  purchase_price: number | null
  currency: string | null
  notes: string | null
  custom_fields: Record<string, unknown> | null
  verification_count: number
  primary_photo_url: string | null
  created_at: string
  updated_at: string
}

export interface ItemMovement {
  id: string
  item_id: string
  from_location_id: string | null
  to_location_id: string | null
  from_location?: LocationOut | null
  to_location?: LocationOut | null
  moved_by: UserOut
  notes: string | null
  moved_at: string
}

// ── Photos ─────────────────────────────────────────────────────────────────────
export type PhotoStatus = 'processing' | 'reviewed' | 'approved' | 'rejected'

export interface PhotoOut {
  id: string
  site_id: string
  location_id: string | null
  location?: LocationOut | null
  url: string
  thumbnail_url: string | null
  status: PhotoStatus
  captured_at: string
  uploaded_by: UserOut
  proposal_count: number
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
  item_id: string | null
  status: ProposalStatus
  ai_label: string
  ai_confidence: number
  ai_category: string | null
  detected_objects: DetectedObject[]
  proposed_fields: Partial<ItemOut>
  duplicate_of_id: string | null
  reviewed_by: UserOut | null
  reviewed_at: string | null
  created_at: string
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
  condition?: ItemCondition
  status?: ItemStatus
  is_verified?: boolean
  page?: number
  size?: number
}
