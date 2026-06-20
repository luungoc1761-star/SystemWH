import type { InventoryItem, LogEntry } from '../types'

export function useExport() {
  async function exportToExcel(
    inventoryData: InventoryItem[],
    systemInventoryData: any[],
    logData: LogEntry[]
  ) {
    if (inventoryData.length === 0) {
      alert('Không có dữ liệu tồn kho thực tế để xuất!')
      return
    }

    // Dynamic import — only load xlsx when user clicks export
    const XLSX = await import('xlsx')

    const workbook = XLSX.utils.book_new()

    const inventoryRows = inventoryData.map(item => ({
      'ID': item.id,
      'Ngày Tạo': item.created_at,
      'Tag ID': item.tag_id,
      'Vị trí (Bin)': item.bin,
      'Mã hàng (Code)': item.code,
      'Kho (WH)': item.wh,
      'Sản lượng thực tế (Quality)': Number(item.quality || 0)
    }))
    const wsInventory = XLSX.utils.json_to_sheet(inventoryRows)
    XLSX.utils.book_append_sheet(workbook, wsInventory, 'Thực tế')

    const systemRows = systemInventoryData.map((item: any) => ({
      'ID': item.id,
      'Ngày tạo': item.created_at,
      'BATCH (Tag ID)': item.tag_id,
      'BIN (Vị trí)': item.bin,
      'Stock Code (Mã hàng)': item.code,
      'Warehouse (Kho)': item.wh,
      'Qty (Số lượng)': Number(item.quality || 0)
    }))
    const wsSystem = XLSX.utils.json_to_sheet(systemRows)
    XLSX.utils.book_append_sheet(workbook, wsSystem, 'Hệ thống')

    const logRows = logData.map(log => ({
      'Log ID': log.id,
      'Thời gian tạo': log.created_at,
      'Người thực hiện': log.username || 'System',
      'Loại hoạt động': log.action_type,
      'Tag ID': log.tag_id,
      'Mã hàng (Code)': log.code,
      'Vị trí (Bin)': log.bin,
      'Kho (WH)': log.wh,
      'Số lượng': log.quality ? Number(log.quality) : '',
      'Chi tiết / Ghi chú': log.details || ''
    }))
    const wsLogs = XLSX.utils.json_to_sheet(logRows)
    XLSX.utils.book_append_sheet(workbook, wsLogs, 'Nhật ký hoạt động')

    const dateStr = new Date().toISOString().slice(0, 10)
    XLSX.writeFile(workbook, `BaoCao_TongHop_${dateStr}.xlsx`)
  }

  return { exportToExcel }
}
