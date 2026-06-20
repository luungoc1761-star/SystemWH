export interface InventoryItem {
  id: number
  created_at: string
  tag_id: string
  bin: string
  code: string
  wh: string
  quality: number
}

export interface SystemInventoryItem {
  id: number
  created_at: string
  tag_id: string
  bin: string
  code: string
  wh: string
  quality: number
}

export interface ComparisonItem {
  code: string
  actual_qty: number
  system_qty: number
  variance: number
}

export interface LogEntry {
  id: number
  created_at: string
  username: string
  action_type: string
  tag_id: string
  code: string
  bin: string
  wh: string
  quality: number | null
  details: string
}

export interface AppUser {
  id: number
  username: string
  password: string
  display_name: string
  role: 'Admin' | 'Operator' | 'Viewer'
}

export interface MaterialWeight {
  id: number
  code: string
  kg: number
}

export type ModalName = 'inbound' | 'systemCsv' | 'outbound' | 'csvImport' | 'edit' | 'calc'

export type ActionType = 'NHAP_KHO' | 'XUAT_WO' | 'XUAT_YEU_CAU' | 'XUAT_TIEU_HAO' | 'CHINH_SUA' | 'IMPORT_CSV'
