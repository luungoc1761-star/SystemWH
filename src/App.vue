<script setup lang="ts">
import { ref, watch, onMounted, nextTick, shallowRef } from 'vue'
import { supabase } from './lib/supabase'
import { useAuth } from './composables/useAuth'
import { useInventory } from './composables/useInventory'
import { useLogs } from './composables/useLogs'
import { useCalculator } from './composables/useCalculator'
import { useExport } from './composables/useExport'
import { formatDate } from './utils/formatters'
import type { InventoryItem } from './types'

// FontAwesome
import { library } from '@fortawesome/fontawesome-svg-core'
import {
  faWarehouse, faArrowUpRightFromSquare, faCalculator, faRightFromBracket,
  faPlus, faFileImport, faMinus, faListCheck, faCubes, faNetworkWired,
  faServer, faScaleUnbalanced, faChartColumn, faArrowsRotate, faArrowsToDot,
  faFilter, faMagnifyingGlass, faTable, faFileCsv, faFileExcel,
  faClockRotateLeft, faArrowDown, faArrowDownLong, faIndustry, faFileSignature,
  faWrench, faPenToSquare, faCircleInfo, faBoxOpen, faXmark, faSpinner,
  faFileInvoice, faFileArrowUp, faTruckRampBox, faBarcode, faTriangleExclamation,
  faUser, faLock, faRightToBracket, faPen, faMicrochip, faGears,
  faArrowsSpin, faEye, faEyeSlash
} from '@fortawesome/free-solid-svg-icons'

library.add(
  faWarehouse, faArrowUpRightFromSquare, faCalculator, faRightFromBracket,
  faPlus, faFileImport, faMinus, faListCheck, faCubes, faNetworkWired,
  faServer, faScaleUnbalanced, faChartColumn, faArrowsRotate, faArrowsToDot,
  faFilter, faMagnifyingGlass, faTable, faFileCsv, faFileExcel,
  faClockRotateLeft, faArrowDown, faArrowDownLong, faIndustry, faFileSignature,
  faWrench, faPenToSquare, faCircleInfo, faBoxOpen, faXmark, faSpinner,
  faFileInvoice, faFileArrowUp, faTruckRampBox, faBarcode, faTriangleExclamation,
  faUser, faLock, faRightToBracket, faPen, faMicrochip, faGears,
  faArrowsSpin, faEye, faEyeSlash
)

// Composables
const auth = useAuth()
const inventory = useInventory()
const logs = useLogs()
const calculator = useCalculator(inventory.materialWeights)
const { exportToExcel } = useExport()

// System inventory data (for export)
const systemInventoryData = shallowRef<any[]>([])

// Modals
const modals = ref({
  inbound: false,
  systemCsv: false,
  outbound: false,
  csvImport: false,
  edit: false,
  calc: false,
})

// Action state loaders
const isSavingInbound = ref(false)
const isSavingOutbound = ref(false)
const isSavingEdit = ref(false)
const isSavingSystem = ref(false)
const isSavingCsv = ref(false)

// Inbound Form
const inboundForm = ref({
  tag_id: '', bin: '', code: '', wh: '', quality: '' as string | number
})
const inboundStatus = ref({ message: '', isError: false, visible: false })

// Outbound Form
const outboundForm = ref({
  mode: 'WO', woValue: '', tag_id: '', quality: '' as string | number
})
const outboundDuplicates = ref<InventoryItem[]>([])
const outboundSelectedRowId = ref<number | null>(null)

// CSV inputs
const systemCsvText = ref('')
const csvImportText = ref('')

// Edit Row Form
const editForm = ref({
  id: null as number | null, tag_id: '', bin: '', code: '', wh: '', quality: 0
})

// Chart ref
let chartInstance: any = null

// Modal operations
function openModal(name: keyof typeof modals.value) {
  modals.value[name] = true
  if (name === 'inbound') {
    nextTick(() => {
      const input = document.getElementById('inboundTagId')
      if (input) input.focus()
    })
  }
  if (name === 'calc') {
    calculator.ensureMaterialWeights()
  }
}

function closeModal(name: keyof typeof modals.value) {
  modals.value[name] = false
  if (name === 'outbound') {
    outboundDuplicates.value = []
    outboundSelectedRowId.value = null
  }
}

// Watch outbound tag_id to reset duplicates
watch(() => outboundForm.value.tag_id, () => {
  outboundDuplicates.value = []
  outboundSelectedRowId.value = null
})

// Watch smartFilter to reset limit
watch(() => inventory.smartFilter.value, () => {
  inventory.inventoryLimit.value = 50
})

// Chart functions
async function initChart() {
  const canvas = document.getElementById('comparisonChart') as HTMLCanvasElement
  if (!canvas) return
  const { Chart, registerables } = await import('chart.js')
  const { default: zoomPlugin } = await import('chartjs-plugin-zoom')
  Chart.register(...registerables, zoomPlugin)

  chartInstance = new Chart(canvas, {
    type: 'bar',
    data: {
      labels: [],
      datasets: [
        {
          label: 'Thực Tế (Actual)',
          data: [],
          backgroundColor: '#10b981',
          borderWidth: 0,
          borderRadius: 4
        },
        {
          label: 'Hệ Thống (System)',
          data: [],
          backgroundColor: '#ef4444',
          borderWidth: 0,
          borderRadius: 4
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { position: 'top', labels: { boxWidth: 12, font: { size: 9 } } },
        zoom: {
          pan: { enabled: true, mode: 'x' },
          zoom: { wheel: { enabled: true }, pinch: { enabled: true }, mode: 'x' }
        }
      },
      scales: {
        x: { ticks: { maxRotation: 90, minRotation: 45, font: { size: 9 } } },
        y: { grid: { color: 'rgba(226, 232, 240, 0.5)' } }
      }
    }
  })
}

function updateChart() {
  if (!chartInstance) return
  const labels = inventory.comparisonData.value.map(item => item.code)
  const actualDataset = inventory.comparisonData.value.map(item => Number(item.actual_qty || 0))
  const systemDataset = inventory.comparisonData.value.map(item => Number(item.system_qty || 0))

  chartInstance.data.labels = labels
  chartInstance.data.datasets[0].data = actualDataset
  chartInstance.data.datasets[1].data = systemDataset
  chartInstance.update()
}

function resetZoomAndPan() {
  if (chartInstance) chartInstance.resetZoom()
}

watch(() => inventory.comparisonData.value, () => {
  updateChart()
}, { deep: true })

// Inbound
function showInboundStatus(msg: string, isErr: boolean) {
  inboundStatus.value.message = msg
  inboundStatus.value.isError = isErr
  inboundStatus.value.visible = true
  setTimeout(() => { inboundStatus.value.visible = false }, 2500)
}

async function handleInboundSubmit() {
  if (isSavingInbound.value) return
  isSavingInbound.value = true
  const tagId = String(inboundForm.value.tag_id).trim()
  const bin = String(inboundForm.value.bin).trim()
  const code = String(inboundForm.value.code).trim()
  const wh = String(inboundForm.value.wh).trim()
  const quality = Number(inboundForm.value.quality)

  try {
    const { error } = await supabase.from('inventory').insert([{ tag_id: tagId, bin, code, wh, quality }])
    if (error) throw error
    await logs.logActivity('NHAP_KHO', tagId, code, bin, wh, quality, 'Nhập dữ liệu tồn kho mới', auth.currentDisplayName.value)
    inboundForm.value = { tag_id: '', bin: '', code: '', wh: '', quality: '' }
    showInboundStatus(`Đã lưu thành công mã hàng: ${code}`, false)
    await inventory.fetchFromSupabase()
    nextTick(() => { document.getElementById('inboundTagId')?.focus() })
  } catch (err: any) {
    showInboundStatus('Lỗi nhập dữ liệu: ' + err.message, true)
  } finally {
    isSavingInbound.value = false
  }
}

// Outbound
async function handleOutboundSubmit() {
  if (isSavingOutbound.value) return
  const mode = outboundForm.value.mode
  const woValue = String(outboundForm.value.woValue).trim()
  const tagId = String(outboundForm.value.tag_id).trim()
  const qtyToReduce = outboundForm.value.quality ? Number(outboundForm.value.quality) : null
  let currentItem: InventoryItem | undefined

  if (outboundSelectedRowId.value === null) {
    const matches = inventory.inventoryData.value.filter(item => String(item.tag_id || '').trim() === tagId)
    if (matches.length === 0) { alert('Không tìm thấy mã Tag ID này trong hệ thống kho thực tế!'); return }
    if (matches.length > 1) {
      outboundDuplicates.value = matches
      outboundSelectedRowId.value = matches[0].id
      return
    }
    currentItem = matches[0]
    outboundSelectedRowId.value = currentItem.id
  } else {
    currentItem = inventory.inventoryData.value.find(item => item.id === outboundSelectedRowId.value)
  }

  if (!currentItem) { alert('Không thể định vị được dòng dữ liệu cần xuất!'); return }

  isSavingOutbound.value = true
  const currentQty = Number(currentItem.quality || 0)
  let logActionType = ''
  let logDetails = ''

  if (mode === 'WO') {
    if (!woValue) { alert('Vui lòng nhập mã lệnh WO!'); isSavingOutbound.value = false; return }
    logActionType = 'XUAT_WO'; logDetails = `Số WO: ${woValue}`
  } else if (mode === 'YEU_CAU') {
    logActionType = 'XUAT_YEU_CAU'; logDetails = 'Hoạt động phát yêu cầu phòng sản xuất'
  } else {
    logActionType = 'XUAT_TIEU_HAO'; logDetails = 'Phát vật liệu tiêu hao'
  }

  try {
    if (qtyToReduce === null || qtyToReduce >= currentQty) {
      const { error } = await supabase.from('inventory').delete().eq('id', currentItem.id)
      if (error) throw error
      await logs.logActivity(logActionType, currentItem.tag_id, currentItem.code, currentItem.bin, currentItem.wh, currentQty, logDetails + ` (Xuất hết dòng ID: #${currentItem.id})`, auth.currentDisplayName.value)
      alert(`Đã xuất toàn bộ dữ liệu dòng ID #${currentItem.id} (Tag: ${currentItem.tag_id}) ra khỏi kho.`)
    } else {
      const { error } = await supabase.from('inventory').update({ quality: currentQty - qtyToReduce }).eq('id', currentItem.id)
      if (error) throw error
      await logs.logActivity(logActionType, currentItem.tag_id, currentItem.code, currentItem.bin, currentItem.wh, qtyToReduce, logDetails + ` (Xuất 1 phần dòng ID: #${currentItem.id} - giảm ${qtyToReduce})`, auth.currentDisplayName.value)
      alert(`Đã xuất và trừ đi ${qtyToReduce} sản phẩm thuộc dòng ID #${currentItem.id} (Tag: ${currentItem.tag_id}).`)
    }
    closeModal('outbound')
    outboundForm.value = { mode: 'WO', woValue: '', tag_id: '', quality: '' }
    outboundDuplicates.value = []
    outboundSelectedRowId.value = null
    await inventory.fetchFromSupabase()
  } catch (err: any) {
    alert('Xuất kho thất bại: ' + err.message)
  } finally {
    isSavingOutbound.value = false
  }
}

// Edit
function startRowEdit(item: InventoryItem) {
  editForm.value = { id: item.id, tag_id: item.tag_id || '', bin: item.bin || '', code: item.code || '', wh: item.wh || '', quality: Number(item.quality || 0) }
  openModal('edit')
}

async function handleEditSubmit() {
  if (isSavingEdit.value) return
  isSavingEdit.value = true
  try {
    const { error } = await supabase.from('inventory').update({
      tag_id: editForm.value.tag_id.trim(), bin: editForm.value.bin.trim(),
      code: editForm.value.code.trim(), wh: editForm.value.wh.trim(),
      quality: editForm.value.quality
    }).eq('id', editForm.value.id)
    if (error) throw error
    await logs.logActivity('CHINH_SUA', editForm.value.tag_id, editForm.value.code, editForm.value.bin, editForm.value.wh, editForm.value.quality, `Sửa chi tiết bản ghi qua Bảng nổi. ID: ${editForm.value.id}`, auth.currentDisplayName.value)
    closeModal('edit')
    alert('Đã cập nhật dữ liệu thành công!')
    await inventory.fetchFromSupabase()
  } catch (err: any) {
    alert('Cập nhật thất bại: ' + err.message)
  } finally {
    isSavingEdit.value = false
  }
}

// CSV Import
function handleCSVFile(event: Event) {
  const file = (event.target as HTMLInputElement).files?.[0]
  if (!file) return
  const reader = new FileReader()
  reader.onload = (e) => { csvImportText.value = e.target?.result as string }
  reader.readAsText(file)
}

async function processCSVImport() {
  if (isSavingCsv.value) return
  isSavingCsv.value = true
  const rawText = csvImportText.value.trim()
  if (!rawText) { alert('Vui lòng dán văn bản CSV!'); isSavingCsv.value = false; return }
  const lines = rawText.split('\n').map(l => l.trim()).filter(l => l)
  if (lines.length < 2) { alert('Nội dung CSV không đầy đủ!'); isSavingCsv.value = false; return }
  const headers = lines[0].split(',').map(h => h.trim().toLowerCase())
  const requiredFields = ['tag_id', 'bin', 'code', 'wh', 'quality']
  const missingFields = requiredFields.filter(f => !headers.includes(f))
  if (missingFields.length > 0) { alert(`Dữ liệu CSV thiếu các trường tiêu đề bắt buộc: ${missingFields.join(', ')}`); isSavingCsv.value = false; return }

  const payload: any[] = []
  for (let i = 1; i < lines.length; i++) {
    const values = lines[i].split(',').map(v => v.trim())
    if (values.length !== headers.length) continue
    const rowObj: any = {}
    headers.forEach((header, idx) => { rowObj[header] = values[idx] })
    payload.push({ tag_id: rowObj.tag_id, bin: rowObj.bin, code: rowObj.code, wh: rowObj.wh, quality: Number(rowObj.quality || 0) })
  }

  try {
    const { error } = await supabase.from('inventory').insert(payload)
    if (error) throw error
    await logs.logActivity('IMPORT_CSV', `Số dòng: ${payload.length}`, 'NHIỀU_CODE', 'NHIỀU_BIN', 'NHIỀU_WH', 0, 'Nhập nhanh thực tế từ tệp CSV.', auth.currentDisplayName.value)
    closeModal('csvImport'); csvImportText.value = ''
    alert(`Nhập thành công ${payload.length} dòng dữ liệu CSV thực tế!`)
    await inventory.fetchFromSupabase()
  } catch (err: any) { alert('Nhập thất bại: ' + err.message) }
  finally { isSavingCsv.value = false }
}

// System CSV Import
function triggerSystemCsv() { document.getElementById('systemCsvFileInput')?.click() }
function triggerCsv() { document.getElementById('csvFileInput')?.click() }

function handleSystemCSVFile(event: Event) {
  const file = (event.target as HTMLInputElement).files?.[0]
  if (!file) return
  const reader = new FileReader()
  reader.onload = (e) => { systemCsvText.value = e.target?.result as string }
  reader.readAsText(file)
}

async function processSystemCSVImport() {
  if (isSavingSystem.value) return
  isSavingSystem.value = true
  const rawText = systemCsvText.value.trim()
  if (!rawText) { alert('Vui lòng dán văn bản CSV!'); isSavingSystem.value = false; return }
  const lines = rawText.split('\n').map(l => l.trim()).filter(l => l)
  if (lines.length < 2) { alert('Nội dung CSV hệ thống không đầy đủ!'); isSavingSystem.value = false; return }

  const firstLine = lines[0]
  let delimiter = ','
  if (firstLine.includes(';')) delimiter = ';'
  else if (firstLine.includes('\t')) delimiter = '\t'

  const headers = lines[0].split(delimiter).map(h => h.trim().toLowerCase())
  const stockCodeKeys = ['stock code', 'stock_code', 'code', 'mã hàng']
  const warehouseKeys = ['warehouse', 'wh', 'kho']
  const batchKeys = ['batch', 'tag_id', 'tagid', 'mã tag']
  const binKeys = ['bin', 'vị trí']
  const qtyKeys = ['qty', 'quality', 'số lượng', 'so luong']

  const codeIdx = headers.findIndex(h => stockCodeKeys.includes(h))
  const whIdx = headers.findIndex(h => warehouseKeys.includes(h))
  const tagIdx = headers.findIndex(h => batchKeys.includes(h))
  const binIdx = headers.findIndex(h => binKeys.includes(h))
  const qtyIdx = headers.findIndex(h => qtyKeys.includes(h))

  if (codeIdx === -1 || whIdx === -1 || tagIdx === -1 || qtyIdx === -1) {
    alert('Cấu trúc file hệ thống không khớp! Yêu cầu chứa các cột: Stock Code, Warehouse, BATCH, Qty.')
    isSavingSystem.value = false; return
  }

  const latestRecordsMap: Record<string, any> = {}
  for (let i = 1; i < lines.length; i++) {
    const values = lines[i].split(delimiter).map(v => v.trim())
    if (values.length !== headers.length) continue
    const batchTagId = values[tagIdx]
    latestRecordsMap[batchTagId] = {
      code: values[codeIdx], wh: values[whIdx], tag_id: batchTagId,
      bin: binIdx !== -1 ? values[binIdx] : '', quality: Number(values[qtyIdx] || 0)
    }
  }
  const payload = Object.values(latestRecordsMap)

  try {
    await supabase.from('system_inventory').delete().not('id', 'is', null)
    const { error } = await supabase.from('system_inventory').insert(payload)
    if (error) throw error
    await logs.logActivity('IMPORT_CSV', `Số dòng: ${payload.length}`, 'NHIỀU_CODE', 'NHIỀU_BIN', 'NHIỀU_WH', 0, 'Nạp file nguồn hệ thống (Lấy dòng cuối).', auth.currentDisplayName.value)
    closeModal('systemCsv'); systemCsvText.value = ''
    alert(`Đã nạp thành công ${payload.length} bản ghi nguồn hệ thống sạch (lọc trùng cuối tệp)!`)
    await inventory.fetchFromSupabase()
  } catch (err: any) { alert('Nạp file nguồn thất bại: ' + err.message) }
  finally { isSavingSystem.value = false }
}

// Export Excel
async function handleExportExcel() {
  // Fetch system data for export
  try {
    const { data } = await supabase.from('system_inventory').select('*').order('id', { ascending: false })
    systemInventoryData.value = data || []
  } catch { /* ignore */ }
  await exportToExcel(inventory.inventoryData.value, systemInventoryData.value, logs.logData.value)
}

// Action badge/icon/label helpers
function getActionBadgeClass(action: string) {
  switch (action) {
    case 'NHAP_KHO': return 'bg-emerald-50 text-emerald-700 border border-emerald-200'
    case 'XUAT_WO': return 'bg-rose-50 text-rose-700 border border-rose-200'
    case 'XUAT_YEU_CAU': return 'bg-amber-50 text-amber-700 border border-amber-200'
    case 'XUAT_TIEU_HAO': return 'bg-orange-50 text-orange-700 border border-orange-200'
    case 'CHINH_SUA': return 'bg-blue-50 text-blue-700 border border-blue-200'
    case 'IMPORT_CSV': return 'bg-purple-50 text-purple-700 border border-purple-200'
    default: return 'bg-slate-100 text-slate-700'
  }
}
function getActionIconClass(action: string) {
  switch (action) {
    case 'NHAP_KHO': return 'fa-solid fa-arrow-down-long'
    case 'XUAT_WO': return 'fa-solid fa-industry'
    case 'XUAT_YEU_CAU': return 'fa-solid fa-file-signature'
    case 'XUAT_TIEU_HAO': return 'fa-solid fa-wrench'
    case 'CHINH_SUA': return 'fa-solid fa-pen-to-square'
    case 'IMPORT_CSV': return 'fa-solid fa-file-csv'
    default: return 'fa-solid fa-circle-info'
  }
}
function getActionLabel(action: string) {
  switch (action) {
    case 'NHAP_KHO': return 'Nhập Kho'
    case 'XUAT_WO': return 'Xuất WO'
    case 'XUAT_YEU_CAU': return 'Xuất Phiếu Yêu Cầu'
    case 'XUAT_TIEU_HAO': return 'Vật liệu tiêu hao'
    case 'CHINH_SUA': return 'Chỉnh Sửa'
    case 'IMPORT_CSV': return 'Import CSV'
    default: return action
  }
}

// Setup keyboard navigation for inbound form
function setupInboundKeyNavigation() {
  const inputIds = ['inboundTagId', 'inboundBin', 'inboundCode', 'inboundWH', 'inboundQuality']
  inputIds.forEach((id, index) => {
    const el = document.getElementById(id)
    if (!el) return
    el.addEventListener('keydown', (e: KeyboardEvent) => {
      if (e.key === 'Enter') {
        if (index < inputIds.length - 1) {
          e.preventDefault()
          document.getElementById(inputIds[index + 1])?.focus()
        }
      }
    })
  })
}

// Mounted
onMounted(async () => {
  const loggedIn = await auth.checkLoginState()
  if (loggedIn) {
    await inventory.fetchFromSupabase()
    await logs.fetchLogsFromSupabase()
    await nextTick()
    await initChart()
    updateChart()
  }
  setupInboundKeyNavigation()
})

// Watch login state
watch(() => auth.currentUser.value, async (newUser) => {
  if (newUser) {
    await inventory.fetchFromSupabase()
    await logs.fetchLogsFromSupabase()
    await nextTick()
    if (!chartInstance) await initChart()
    updateChart()
  }
})
</script>

<template>
  <div v-cloak>
    <!-- Header / Navbar Responsive -->
    <header class="bg-slate-900 text-white shadow-md py-4 px-4 sm:px-6 flex flex-col lg:flex-row lg:justify-between lg:items-center gap-4">
      <div class="flex items-center space-x-3 justify-center lg:justify-start">
        <i class="fa-solid fa-warehouse text-2xl text-blue-400"></i>
        <span class="text-lg sm:text-xl font-bold tracking-wider text-center lg:text-left">HỆ THỐNG QUẢN LÝ VỊ TRÍ TỒN KHO</span>
      </div>

      <div class="flex flex-col sm:flex-row items-center gap-3 w-full lg:w-auto justify-center lg:justify-end">
        <div class="flex items-center gap-3 w-full sm:w-auto justify-center sm:justify-start">
          <a href="https://pqvinh99-glory.github.io/Ivenrory-FG/" target="_blank" class="bg-slate-700 hover:bg-slate-600 px-3 py-1.5 sm:px-4 sm:py-2 rounded-lg font-medium text-xs sm:text-sm transition duration-200 shadow-md flex items-center shrink-0 border border-slate-600">
            <i class="fa-solid fa-arrow-up-right-from-square mr-1.5 text-amber-400"></i>Kho Thành Phẩm
          </a>

          <button @click="openModal('calc')" class="bg-indigo-600 hover:bg-indigo-700 px-3 py-1.5 sm:px-4 sm:py-2 rounded-lg font-bold text-xs sm:text-sm transition duration-200 shadow-md flex items-center shrink-0 border border-indigo-500">
            <i class="fa-solid fa-calculator mr-1.5 text-indigo-200 animate-pulse"></i>Tính toán quy đổi
          </button>

          <div id="userMenu" class="flex items-center space-x-3 text-xs sm:text-sm text-slate-300 bg-slate-800 px-3 py-1.5 rounded-lg border border-slate-700 shrink-0 w-full sm:w-auto justify-between sm:justify-start">
            <div class="flex items-center space-x-2">
              <div class="w-6 h-6 sm:w-7 sm:h-7 bg-blue-500 text-white rounded-full flex items-center justify-center font-bold text-xs shrink-0">
                {{ auth.currentDisplayName.value.charAt(0).toUpperCase() }}
              </div>
              <div class="text-left">
                <p class="font-bold text-white text-[11px] sm:text-xs">{{ auth.currentDisplayName.value }}</p>
                <p class="text-[9px] sm:text-[10px] text-slate-400 font-semibold leading-none">{{ auth.currentRole.value }}</p>
              </div>
            </div>
            <button @click="auth.handleLogout()" class="text-slate-400 hover:text-rose-400 p-1 transition duration-150 shrink-0" title="Đăng xuất">
              <i class="fa-solid fa-right-from-bracket text-sm sm:text-base"></i>
            </button>
          </div>
        </div>

        <div class="flex flex-wrap gap-2 w-full sm:w-auto justify-center sm:justify-end">
          <button v-if="auth.currentRole.value === 'Admin' || auth.currentRole.value === 'Operator'" @click="openModal('inbound')" class="bg-emerald-600 hover:bg-emerald-700 px-3 py-2 sm:px-4 rounded-lg font-medium text-xs sm:text-sm transition duration-200 shadow-md flex-1 sm:flex-initial text-center whitespace-nowrap">
            <i class="fa-solid fa-plus mr-1"></i>Nhập Kho
          </button>
          <button v-if="auth.currentRole.value === 'Admin' || auth.currentRole.value === 'Operator'" @click="openModal('systemCsv')" class="bg-indigo-600 hover:bg-indigo-700 px-3 py-2 sm:px-4 rounded-lg font-medium text-xs sm:text-sm transition duration-200 shadow-md flex-1 sm:flex-initial text-center whitespace-nowrap">
            <i class="fa-solid fa-file-import mr-1"></i>Nhập File
          </button>
          <button v-if="auth.currentRole.value === 'Admin' || auth.currentRole.value === 'Operator'" @click="openModal('outbound')" class="bg-rose-600 hover:bg-rose-700 px-3 py-2 sm:px-4 rounded-lg font-medium text-xs sm:text-sm transition duration-200 shadow-md flex-1 sm:flex-initial text-center whitespace-nowrap">
            <i class="fa-solid fa-minus mr-1"></i>Xuất Kho
          </button>
        </div>
      </div>
    </header>

    <main class="p-4 sm:p-6 max-w-7xl mx-auto space-y-6">
      <!-- KPI Summary Cards -->
      <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        <div class="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between">
          <div><p class="text-xs text-slate-500 font-medium">Dòng Thực Tế</p><h3 class="text-lg sm:text-xl font-bold text-slate-800 mt-1">{{ inventory.inventoryData.value.length }}</h3></div>
          <div class="bg-blue-50 p-2.5 rounded-lg text-blue-600 text-sm"><i class="fa-solid fa-list-check"></i></div>
        </div>
        <div class="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between">
          <div><p class="text-xs text-slate-500 font-medium">Lượng Thực Tế</p><h3 class="text-lg sm:text-xl font-bold text-slate-800 mt-1">{{ inventory.totalQuality.value.toLocaleString('vi-VN') }}</h3></div>
          <div class="bg-emerald-50 p-2.5 rounded-lg text-emerald-600 text-sm"><i class="fa-solid fa-cubes"></i></div>
        </div>
        <div class="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between">
          <div><p class="text-xs text-slate-500 font-medium">Mã Hàng Đang Có</p><h3 class="text-lg sm:text-xl font-bold text-slate-800 mt-1">{{ inventory.uniqueCodesCount.value }}</h3></div>
          <div class="bg-slate-100 p-2.5 rounded-lg text-slate-600 text-sm border border-slate-200"><i class="fa-solid fa-network-wired"></i></div>
        </div>
        <div class="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between">
          <div><p class="text-xs text-slate-500 font-medium">Lượng Hệ Thống</p><h3 class="text-lg sm:text-xl font-bold text-slate-800 mt-1">{{ inventory.totalSystemQuality.value.toLocaleString('vi-VN') }}</h3></div>
          <div class="bg-indigo-50 p-2.5 rounded-lg text-indigo-600 text-sm border border-indigo-100"><i class="fa-solid fa-server"></i></div>
        </div>
        <div class="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between">
          <div><p class="text-xs text-slate-500 font-medium font-semibold text-rose-600">Tổng lượng lệch</p>
            <h3 :class="{'text-rose-600': inventory.totalVarianceQty.value < 0, 'text-emerald-600': inventory.totalVarianceQty.value > 0, 'text-slate-600': inventory.totalVarianceQty.value === 0}" class="text-lg sm:text-xl font-bold mt-1">{{ inventory.totalVarianceQty.value.toLocaleString('vi-VN') }}</h3>
          </div>
          <div class="bg-rose-50 p-2.5 rounded-lg text-rose-600 text-sm border border-rose-100"><i class="fa-solid fa-scale-unbalanced"></i></div>
        </div>
      </div>

      <!-- Chart -->
      <div class="bg-white p-4 sm:p-5 rounded-xl border border-slate-200 shadow-sm flex flex-col h-[320px] relative">
        <h4 class="font-bold text-slate-700 mb-2 flex items-center justify-between text-xs sm:text-sm">
          <span class="truncate"><i class="fa-solid fa-chart-column text-blue-500 mr-2"></i>Biểu Đồ Đối Chiếu Thực Tế - Hệ Thống Theo Mã Hàng</span>
          <button @click="resetZoomAndPan" class="text-[10px] sm:text-xs bg-slate-100 hover:bg-slate-200 px-2 py-1 rounded border border-slate-300 transition duration-150 shrink-0">
            <i class="fa-solid fa-arrows-rotate mr-1"></i>Reset Khung
          </button>
        </h4>
        <div class="interactive-card flex-1 border border-slate-100 rounded-lg bg-slate-50/50">
          <div class="h-full w-full p-1 sm:p-2"><canvas id="comparisonChart"></canvas></div>
        </div>
      </div>

      <!-- Pivot Table -->
      <div class="bg-white p-4 sm:p-5 rounded-xl border border-slate-200 shadow-sm">
        <h4 class="font-bold text-slate-700 mb-3 flex items-center text-xs sm:text-sm">
          <i class="fa-solid fa-arrows-to-dot text-indigo-500 mr-2"></i>Bảng Phân Tích Pivot Đối Chiếu Sản Lượng Theo Mã Hàng (Stock Code)
        </h4>
        <div class="overflow-x-auto border border-slate-200 rounded-lg max-h-[300px]">
          <table class="w-full text-left border-collapse text-xs min-w-[650px]">
            <thead class="bg-slate-100 text-slate-600 uppercase font-bold sticky top-0 border-b border-slate-200 z-10">
              <tr>
                <th class="py-3 px-4">STT</th><th class="py-3 px-4">Mã hàng (Stock Code)</th>
                <th class="py-3 px-4 text-right">Tồn Thực tế (Actual Qty)</th>
                <th class="py-3 px-4 text-right">Tồn Hệ thống (System Qty)</th>
                <th class="py-3 px-4 text-right">Chênh lệch (Variance)</th>
                <th class="py-3 px-4 text-center">Trạng thái</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-200 font-medium text-slate-700">
              <tr v-for="(item, idx) in inventory.comparisonData.value" :key="item.code" class="hover:bg-slate-50 transition duration-150">
                <td class="py-2.5 px-4 text-slate-400 font-mono">{{ idx + 1 }}</td>
                <td class="py-2.5 px-4 font-bold text-slate-800">{{ item.code }}</td>
                <td class="py-2.5 px-4 text-right font-semibold">{{ Number(item.actual_qty || 0).toLocaleString('vi-VN') }}</td>
                <td class="py-2.5 px-4 text-right font-semibold text-slate-500">{{ Number(item.system_qty || 0).toLocaleString('vi-VN') }}</td>
                <td class="py-2.5 px-4 text-right font-bold font-mono" :class="{'text-emerald-600': item.variance == 0, 'text-amber-600': item.variance > 0, 'text-rose-600': item.variance < 0}">
                  {{ item.variance > 0 ? '+' : '' }}{{ Number(item.variance || 0).toLocaleString('vi-VN') }}
                </td>
                <td class="py-2.5 px-4 text-center font-semibold">
                  <span v-if="item.variance == 0" class="bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded border border-emerald-200 text-[10px]">Khớp</span>
                  <span v-else-if="item.variance > 0" class="bg-amber-50 text-amber-700 px-2 py-0.5 rounded border border-amber-200 text-[10px]">Dư Thực Tế</span>
                  <span v-else class="bg-rose-50 text-rose-700 px-2 py-0.5 rounded border border-rose-200 text-[10px]">Thiếu hụt</span>
                </td>
              </tr>
              <tr v-if="inventory.comparisonData.value.length === 0">
                <td colspan="6" class="py-4 text-center text-slate-400">Không có dữ liệu đối chiếu Pivot</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <!-- Smart Filter -->
      <div class="bg-white p-4 sm:p-5 rounded-xl border border-slate-200 shadow-sm">
        <h4 class="font-bold text-slate-700 mb-4 flex items-center text-xs sm:text-sm">
          <i class="fa-solid fa-filter text-indigo-500 mr-2"></i> Bộ lọc thông minh cho bảng tồn kho thực tế
        </h4>
        <div class="relative">
          <div class="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400"><i class="fa-solid fa-magnifying-glass"></i></div>
          <input type="text" v-model="inventory.smartFilter.value" placeholder="Tìm kiếm nhanh trên bảng tồn kho thực tế... Nhập mã hàng, vị trí, mã tag hoặc kho..." class="w-full pl-10 pr-4 py-2 sm:py-2.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-xs sm:text-sm shadow-sm">
        </div>
      </div>

      <!-- Data Table -->
      <div class="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div class="px-4 sm:px-6 py-4 border-b border-slate-200 flex flex-wrap justify-between items-center gap-3 bg-slate-50/50">
          <h4 class="font-bold text-slate-700 flex items-center text-xs sm:text-sm">
            <i class="fa-solid fa-table text-slate-500 mr-2"></i> Danh sách chi tiết tồn kho thực tế
          </h4>
          <div class="flex items-center space-x-2 w-full sm:w-auto justify-between sm:justify-end">
            <button v-if="auth.currentRole.value === 'Admin'" @click="openModal('csvImport')" class="bg-indigo-600 hover:bg-indigo-700 text-white px-2.5 py-1.5 sm:px-3 sm:py-2 rounded-lg text-[11px] sm:text-xs font-semibold transition duration-150 shadow-sm flex-1 sm:flex-initial text-center">
              <i class="fa-solid fa-file-csv mr-1"></i> Nhập CSV Thực Tế
            </button>
            <button @click="handleExportExcel" class="bg-blue-600 hover:bg-blue-700 text-white px-2.5 py-1.5 sm:px-3 sm:py-2 rounded-lg text-[11px] sm:text-xs font-semibold transition duration-150 shadow-sm flex-1 sm:flex-initial text-center">
              <i class="fa-solid fa-file-excel mr-1"></i> Xuất Excel (Đa Sheet)
            </button>
          </div>
        </div>
        <div class="overflow-x-auto max-h-[500px] overflow-y-auto">
          <table class="w-full text-left border-collapse min-w-[850px]">
            <thead class="sticky top-0 bg-slate-50 z-10 shadow-sm">
              <tr class="text-slate-500 text-xs font-bold uppercase tracking-wider border-b border-slate-200">
                <th class="py-3.5 px-6">ID</th><th class="py-3.5 px-6">Ngày Tạo (Created At)</th>
                <th class="py-3.5 px-6">Tag ID</th><th class="py-3.5 px-6">Vị trí (Bin)</th>
                <th class="py-3.5 px-6">Mã hàng (Code)</th><th class="py-3.5 px-6">Kho (WH)</th>
                <th class="py-3.5 px-6 text-right">Số lượng (Quality)</th>
                <th v-if="auth.currentRole.value === 'Admin'" class="py-3.5 px-6 text-center">Hành động</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-200 text-sm">
              <tr v-for="item in inventory.renderedInventory.value" :key="item.id" class="hover:bg-slate-50 transition duration-150">
                <td class="py-3.5 px-6 font-semibold font-mono text-slate-500">{{ item.id }}</td>
                <td class="py-3.5 px-6 text-slate-500">{{ formatDate(item.created_at) }}</td>
                <td class="py-3.5 px-6 font-medium text-slate-900">{{ item.tag_id }}</td>
                <td class="py-3.5 px-6"><span class="bg-indigo-50 text-indigo-700 px-2.5 py-1 rounded-md text-xs font-semibold border border-indigo-100">{{ item.bin }}</span></td>
                <td class="py-3.5 px-6 font-medium text-slate-700">{{ item.code }}</td>
                <td class="py-3.5 px-6 text-slate-600">{{ item.wh }}</td>
                <td class="py-3.5 px-6 text-right font-bold text-slate-900">{{ Number(item.quality || 0).toLocaleString('vi-VN') }}</td>
                <td v-if="auth.currentRole.value === 'Admin'" class="py-3.5 px-6 text-center">
                  <button @click="startRowEdit(item)" class="text-blue-600 hover:text-blue-800 font-semibold text-xs inline-flex items-center space-x-1">
                    <i class="fa-solid fa-pen"></i> <span>Sửa dòng</span>
                  </button>
                </td>
              </tr>
              <tr v-if="inventory.renderedInventory.value.length === 0">
                <td colspan="8" class="py-4 text-center text-slate-400">Không tìm thấy dữ liệu phù hợp</td>
              </tr>
            </tbody>
          </table>
        </div>
        <div class="px-4 py-3 border-t border-slate-200 bg-slate-50 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div class="text-xs text-slate-500 text-center sm:text-left">
            Đang hiển thị <span class="font-semibold">{{ inventory.renderedInventory.value.length }}</span> dòng trên tổng số <span class="font-semibold">{{ inventory.filteredInventory.value.length }}</span> dòng dữ liệu đã lọc
          </div>
          <div v-if="inventory.renderedInventory.value.length < inventory.filteredInventory.value.length" class="flex justify-center">
            <button @click="inventory.loadMore()" class="bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold py-1.5 px-4 rounded border border-indigo-200 text-xs transition flex items-center space-x-1">
              <i class="fa-solid fa-arrow-down mr-1"></i><span>Tải thêm 50 dòng</span>
            </button>
          </div>
        </div>
      </div>

      <!-- Activity Log -->
      <div class="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden mt-6">
        <div class="px-4 sm:px-6 py-4 border-b border-slate-200 flex flex-col sm:flex-row justify-between items-center bg-slate-900 text-white gap-3">
          <h4 class="font-bold flex items-center text-xs sm:text-sm tracking-wide">
            <i class="fa-solid fa-clock-rotate-left text-blue-400 mr-2"></i> NHẬT KÝ HOẠT ĐỘNG HỆ THỐNG (TABLE GHILOG)
          </h4>
          <button @click="logs.fetchLogsFromSupabase()" class="text-[10px] sm:text-xs bg-slate-800 hover:bg-slate-700 text-slate-300 px-2.5 py-1.5 rounded-lg font-semibold flex items-center space-x-1 border border-slate-700 transition duration-150 shrink-0">
            <i class="fa-solid fa-arrows-rotate"></i> <span>Làm mới log</span>
          </button>
        </div>
        <div class="p-3 bg-slate-800 border-b border-slate-700 flex flex-col sm:flex-row gap-3 items-center justify-between">
          <div class="relative w-full sm:max-w-md">
            <div class="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400"><i class="fa-solid fa-filter"></i></div>
            <input type="text" v-model="logs.logFilter.value" placeholder="Lọc nhanh nhật ký (loại hoạt động, mã hàng, tag id, vị trí...)" class="w-full pl-10 pr-4 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-blue-500 shadow-inner">
          </div>
          <div class="text-[10px] text-slate-400 font-semibold uppercase tracking-wider">Tìm thấy {{ logs.filteredLogs.value.length }} lịch sử hoạt động</div>
        </div>
        <div class="overflow-x-auto max-h-[350px] overflow-y-auto">
          <table class="w-full text-left border-collapse min-w-[1050px]">
            <thead>
              <tr class="bg-slate-50 border-b border-slate-200 text-slate-500 text-xs font-bold uppercase tracking-wider sticky top-0 z-10 shadow-sm">
                <th class="py-3 px-4">Log ID</th><th class="py-3 px-4">Thời gian tạo</th>
                <th class="py-3 px-4">Người thực hiện</th><th class="py-3 px-4">Loại hoạt động</th>
                <th class="py-3 px-4">Tag ID</th><th class="py-3 px-4">Mã hàng (Code)</th>
                <th class="py-3 px-4">Vị trí (Bin)</th><th class="py-3 px-4">Kho (WH)</th>
                <th class="py-3 px-4 text-right">Số lượng</th><th class="py-3 px-4">Chi tiết / Ghi chú</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-200 text-xs text-slate-700">
              <tr v-for="log in logs.filteredLogs.value" :key="log.id" class="hover:bg-slate-50 transition duration-150">
                <td class="py-3 px-4 font-semibold font-mono text-slate-500">{{ log.id }}</td>
                <td class="py-3 px-4 text-slate-500 whitespace-nowrap">{{ formatDate(log.created_at) }}</td>
                <td class="py-3 px-4 font-bold text-indigo-600">{{ log.username || 'System' }}</td>
                <td class="py-3 px-4 whitespace-nowrap">
                  <span :class="['px-2.5 py-1 rounded-md font-semibold text-xs inline-flex items-center', getActionBadgeClass(log.action_type)]">
                    <i :class="['mr-1', getActionIconClass(log.action_type)]"></i>
                    {{ getActionLabel(log.action_type) }}
                  </span>
                </td>
                <td class="py-3 px-4 font-mono font-semibold text-slate-800">{{ log.tag_id }}</td>
                <td class="py-3 px-4 font-medium text-slate-600">{{ log.code }}</td>
                <td class="py-3 px-4"><span class="bg-slate-100 text-slate-700 px-2 py-0.5 rounded text-xs">{{ log.bin }}</span></td>
                <td class="py-3 px-4 text-slate-500">{{ log.wh }}</td>
                <td class="py-3 px-4 text-right font-bold text-slate-900">{{ log.quality ? Number(log.quality).toLocaleString('vi-VN') : '' }}</td>
                <td class="py-3 px-4 text-slate-500 max-w-xs truncate" :title="log.details">{{ log.details }}</td>
              </tr>
              <tr v-if="logs.filteredLogs.value.length === 0">
                <td colspan="10" class="py-4 text-center text-slate-400">Không tìm thấy nhật ký hoạt động nào</td>
              </tr>
            </tbody>
          </table>
        </div>
        <div class="px-4 py-3 border-t border-slate-200 bg-slate-50 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-600">
          <div class="text-xs text-slate-500 text-center sm:text-left">
            Đang hiển thị <span class="font-semibold">{{ logs.filteredLogs.value.length }}</span> nhật ký hoạt động.
            <span v-if="!logs.showOlderLogs.value" class="text-amber-600 font-medium ml-1">(Chỉ hiển thị log phát sinh trong 24 giờ gần nhất)</span>
          </div>
          <div class="flex items-center space-x-2">
            <button @click="logs.toggleOlderLogs()" :class="[logs.showOlderLogs.value ? 'bg-slate-200 text-slate-800 border-slate-300 hover:bg-slate-300' : 'bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100']" class="font-bold py-1.5 px-3 rounded border text-xs transition">
              <i :class="[logs.showOlderLogs.value ? 'fa-solid fa-eye-slash' : 'fa-solid fa-eye', 'mr-1']"></i>
              <span>{{ logs.showOlderLogs.value ? 'Ẩn log cũ (ngoài 24h)' : 'Hiện log cũ hơn' }}</span>
            </button>
            <button v-if="logs.filteredLogs.value.length >= logs.logLimit.value" @click="logs.loadMoreLogs()" class="bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold py-1.5 px-3 rounded border border-indigo-200 text-xs transition">
              <i class="fa-solid fa-arrow-down mr-1"></i><span>Tải thêm log</span>
            </button>
          </div>
        </div>
      </div>
    </main>

    <!-- ==================== LOGIN SCREEN ==================== -->
    <div v-if="!auth.currentUser.value" class="fixed inset-0 bg-slate-950 z-[100] flex items-center justify-center p-4">
      <div class="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 sm:p-8 space-y-6 border border-slate-100 transform transition-all duration-300">
        <div class="text-center space-y-2">
          <div class="w-16 h-16 bg-blue-100 text-blue-600 rounded-2xl flex items-center justify-center mx-auto text-3xl shadow-sm"><i class="fa-solid fa-warehouse"></i></div>
          <h2 class="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">ĐĂNG NHẬP HỆ THỐNG</h2>
          <p class="text-xs text-slate-500">Vui lòng sử dụng tài khoản nội bộ được cấp phép</p>
        </div>
        <form @submit.prevent="async () => { const ok = await auth.handleLoginSubmit(); if (ok) { await inventory.fetchFromSupabase(); await logs.fetchLogsFromSupabase(); await nextTick(); if (!chartInstance) await initChart(); updateChart(); } }" class="space-y-4">
          <div>
            <label class="block text-xs font-semibold uppercase text-slate-500 mb-1 tracking-wider">Tên tài khoản (Username)</label>
            <div class="relative">
              <input type="text" required v-model="auth.loginUsername.value" placeholder="Ví dụ: luu, vinh, trinh..." class="w-full pl-10 pr-4 py-2.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm shadow-sm transition">
              <div class="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400"><i class="fa-solid fa-user text-sm"></i></div>
            </div>
          </div>
          <div>
            <label class="block text-xs font-semibold uppercase text-slate-500 mb-1 tracking-wider">Mật khẩu (Password)</label>
            <div class="relative">
              <input type="password" required v-model="auth.loginPassword.value" placeholder="Nhập mật khẩu..." class="w-full pl-10 pr-4 py-2.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm shadow-sm transition">
              <div class="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400"><i class="fa-solid fa-lock text-sm"></i></div>
            </div>
          </div>
          <div class="flex items-center justify-between">
            <label class="flex items-center space-x-2 text-xs text-slate-600 cursor-pointer select-none">
              <input type="checkbox" v-model="auth.rememberMe.value" class="rounded border-slate-300 text-blue-600 focus:ring-blue-500 h-4 w-4">
              <span>Ghi nhớ đăng nhập</span>
            </label>
          </div>
          <div v-if="auth.loginErrorMessage.value" class="text-rose-500 text-xs font-medium text-center bg-rose-50 py-2 rounded-lg border border-rose-100">{{ auth.loginErrorMessage.value }}</div>
          <button type="submit" :disabled="auth.isLoading.value" class="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2.5 rounded-lg shadow-md hover:shadow-lg transition duration-150 text-sm flex items-center justify-center space-x-2">
            <i v-if="auth.isLoading.value" class="fa-solid fa-spinner animate-spin"></i>
            <i v-else class="fa-solid fa-right-to-bracket"></i>
            <span>{{ auth.isLoading.value ? 'Đang xác thực...' : 'Đăng Nhập' }}</span>
          </button>
        </form>
      </div>
    </div>

    <!-- ==================== MODALS ==================== -->

    <!-- Calculator Modal -->
    <Teleport to="body">
      <div v-if="modals.calc" class="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
        <div class="bg-gradient-to-tr from-slate-50 via-slate-100 to-indigo-50 text-slate-800 rounded-2xl shadow-2xl w-full max-w-4xl overflow-hidden border border-white/60 flex flex-col transform transition-all duration-300 scale-100">
          <div class="bg-white/80 backdrop-blur px-6 py-4 flex justify-between items-center border-b border-slate-200/80">
            <div class="flex items-center space-x-3">
              <div class="w-8 h-8 bg-indigo-500/10 border border-indigo-500/30 rounded-lg flex items-center justify-center"><i class="fa-solid fa-calculator text-indigo-600 animate-bounce"></i></div>
              <div>
                <h3 class="font-bold text-sm sm:text-base tracking-wider uppercase text-slate-900">CÔNG CỤ QUY ĐỔI ĐỊNH LƯỢNG KHO THỰC TẾ</h3>
                <p class="text-[10px] text-slate-500">Đồng bộ trực tiếp đơn trọng từ cơ sở dữ liệu Supabase</p>
              </div>
            </div>
            <button @click="closeModal('calc')" class="text-slate-400 hover:text-slate-700 text-xl p-1 transition duration-150"><i class="fa-solid fa-xmark"></i></button>
          </div>
          <div class="p-6 grid grid-cols-1 lg:grid-cols-12 gap-6 overflow-y-auto max-h-[85vh]">
            <div class="lg:col-span-5 space-y-5">
              <div class="bg-white/80 backdrop-blur-sm p-4 rounded-xl border border-slate-200/80 shadow-sm space-y-4">
                <h4 class="text-xs font-bold text-slate-500 tracking-wider uppercase flex items-center"><i class="fa-solid fa-gears text-indigo-500 mr-2"></i>Tham số quy đổi</h4>
                <div class="relative">
                  <label class="block text-[11px] font-bold text-slate-500 uppercase mb-1">Mã hàng (Vật liệu)</label>
                  <div class="relative">
                    <input type="text" v-model="calculator.calcForm.value.code" @keydown.enter="calculator.handleCalcCodeEnter()" placeholder="Nhập 2-4 ký tự để tìm kiếm..." class="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:bg-white focus:ring-2 focus:ring-indigo-500 font-semibold uppercase tracking-wider transition">
                    <div class="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 pointer-events-none"><i class="fa-solid fa-magnifying-glass text-xs"></i></div>
                  </div>
                  <div v-if="calculator.filteredCalcCodes.value.length > 0" class="absolute z-50 w-full bg-white border border-slate-200 rounded-lg mt-1 max-h-48 overflow-y-auto shadow-2xl divide-y divide-slate-100">
                    <div v-for="item in calculator.filteredCalcCodes.value" :key="item.code" @click="calculator.selectCalcCode(item)" class="px-3 py-2.5 hover:bg-indigo-50 hover:text-indigo-950 cursor-pointer text-xs text-slate-700 transition duration-150 flex justify-between items-center">
                      <span class="font-bold tracking-wider font-mono text-slate-800">{{ item.code }}</span>
                      <span class="text-indigo-600 font-semibold">{{ Number(item.kg).toFixed(4) }} kg/pcs</span>
                    </div>
                  </div>
                </div>
                <div class="bg-slate-50 p-3 rounded-lg border border-slate-200 text-xs">
                  <div class="flex justify-between text-slate-500 mb-1"><span>Mã đang nạp:</span><span class="font-bold text-indigo-600 font-mono uppercase">{{ calculator.selectedCalcItem.value ? calculator.selectedCalcItem.value.code : 'Chưa chọn' }}</span></div>
                  <div class="flex justify-between text-slate-500"><span>Đơn trọng tiêu chuẩn:</span><span class="font-bold text-emerald-600 font-mono">{{ calculator.selectedCalcItem.value ? Number(calculator.selectedCalcItem.value.kg).toFixed(4) + ' kg/con' : '---' }}</span></div>
                </div>
              </div>
              <div class="bg-white/80 backdrop-blur-sm p-4 rounded-xl border border-slate-200/80 shadow-sm space-y-4">
                <h4 class="text-xs font-bold text-slate-500 tracking-wider uppercase flex items-center"><i class="fa-solid fa-arrows-spin text-cyan-600 mr-2"></i>Quy đổi trực tiếp</h4>
                <div>
                  <label class="block text-[11px] font-bold text-slate-500 uppercase mb-1">Quy đổi PCS -> KG</label>
                  <div class="relative">
                    <input type="number" v-model.number="calculator.calcForm.value.pcs" @input="calculator.onCalcPcsInput()" :disabled="!calculator.selectedCalcItem.value" placeholder="Nhập số lượng Pcs cần quy đổi..." class="w-full bg-slate-50 border border-slate-300 rounded-lg pl-3 pr-10 py-2.5 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:bg-white focus:ring-2 focus:ring-cyan-500 font-bold disabled:opacity-40 disabled:bg-slate-100">
                    <div class="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 pointer-events-none text-[10px] font-bold">PCS</div>
                  </div>
                </div>
                <div>
                  <label class="block text-[11px] font-bold text-slate-500 uppercase mb-1">Quy đổi KG -> PCS</label>
                  <div class="relative">
                    <input type="number" step="any" v-model.number="calculator.calcForm.value.kg" @input="calculator.onCalcKgInput()" :disabled="!calculator.selectedCalcItem.value" placeholder="Nhập trọng lượng Kg cần quy đổi..." class="w-full bg-slate-50 border border-slate-300 rounded-lg pl-3 pr-10 py-2.5 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:bg-white focus:ring-2 focus:ring-amber-500 font-bold disabled:opacity-40 disabled:bg-slate-100">
                    <div class="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 pointer-events-none text-[10px] font-bold">KG</div>
                  </div>
                </div>
              </div>
            </div>
            <div class="lg:col-span-7 flex flex-col justify-between space-y-4">
              <div class="bg-slate-950 p-6 rounded-2xl border-4 border-slate-300 shadow-inner flex-1 flex flex-col justify-center space-y-6 relative overflow-hidden">
                <div class="absolute inset-0 bg-gradient-to-b from-transparent via-white/[0.01] to-black/[0.1] pointer-events-none"></div>
                <div class="flex justify-between items-center text-[10px] text-slate-500 tracking-widest uppercase font-bold border-b border-slate-800/60 pb-2">
                  <span><i class="fa-solid fa-microchip text-indigo-400 mr-1"></i> DIGITAL INTEGRATED TRANSCEIVER</span>
                  <span class="animate-pulse text-emerald-500 font-mono flex items-center"><span class="w-1.5 h-1.5 rounded-full bg-emerald-500 mr-1"></span> ONLINE</span>
                </div>
                <div class="space-y-1">
                  <div class="flex justify-between text-[10px] text-slate-400 tracking-wider font-bold uppercase"><span>TRỌNG LƯỢNG THỰC TẾ (ACTUAL WEIGHT)</span><span class="text-emerald-400/80">UNIT: KG</span></div>
                  <div class="bg-black/40 rounded-xl p-4 border border-slate-800/80 flex items-center justify-between">
                    <div class="digital-font text-3xl sm:text-4xl font-black text-emerald-400 led-glow-green tracking-widest">{{ Number(calculator.displayCalcValues.value.kg || 0).toLocaleString('vi-VN', { minimumFractionDigits: 4, maximumFractionDigits: 4 }) }}</div>
                    <div class="digital-sub text-slate-500 text-lg font-bold">KG</div>
                  </div>
                </div>
                <div class="space-y-1">
                  <div class="flex justify-between text-[10px] text-slate-400 tracking-wider font-bold uppercase"><span>SỐ LƯỢNG QUY ĐỔI (PCS COUNT)</span><span class="text-amber-400/80">UNIT: PCS</span></div>
                  <div class="bg-black/40 rounded-xl p-4 border border-slate-800/80 flex items-center justify-between">
                    <div class="digital-font text-3xl sm:text-4xl font-black text-amber-500 led-glow-amber tracking-widest">{{ Math.round(Number(calculator.displayCalcValues.value.pcs || 0)).toLocaleString('vi-VN') }}</div>
                    <div class="digital-sub text-slate-500 text-lg font-bold">PCS</div>
                  </div>
                </div>
                <div class="grid grid-cols-2 gap-4 text-[10px] text-slate-400 pt-4 border-t border-slate-800/60">
                  <div><span class="block text-slate-500 font-semibold">MÃ THIẾT BỊ:</span><span class="font-mono text-slate-300 uppercase">{{ calculator.selectedCalcItem.value ? calculator.selectedCalcItem.value.code : 'CHƯA CHỌN' }}</span></div>
                  <div class="text-right"><span class="block text-slate-500 font-semibold">TỶ LỆ KHỐI LƯỢNG:</span><span class="font-mono text-emerald-400 font-bold">{{ calculator.selectedCalcItem.value ? Number(calculator.selectedCalcItem.value.kg).toFixed(4) + ' KG/PCS' : 'N/A' }}</span></div>
                </div>
              </div>
              <div class="flex space-x-3">
                <button type="button" @click="calculator.resetCalc()" class="flex-1 bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold py-2.5 rounded-lg text-xs tracking-wider uppercase transition">Reset màn hình</button>
                <button type="button" @click="closeModal('calc')" class="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2.5 rounded-lg text-xs tracking-wider uppercase transition shadow-lg">Hoàn tất</button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Teleport>

    <!-- Inbound Modal -->
    <Teleport to="body">
      <div v-if="modals.inbound" class="fixed inset-0 bg-black/50 z-50 flex items-center justify-center">
        <div class="bg-white rounded-xl shadow-xl w-full max-w-lg mx-4 overflow-hidden max-h-[90vh] flex flex-col">
          <div class="bg-emerald-600 px-6 py-4 text-white flex justify-between items-center shrink-0">
            <h3 class="font-bold text-base sm:text-lg"><i class="fa-solid fa-box-open mr-2"></i>Nhập Kho Thực Tế</h3>
            <button @click="closeModal('inbound')" class="text-white hover:text-slate-200 text-xl"><i class="fa-solid fa-xmark"></i></button>
          </div>
          <form @submit.prevent="handleInboundSubmit" class="p-4 sm:p-6 space-y-4 overflow-y-auto">
            <div v-if="inboundStatus.visible" :class="[inboundStatus.isError ? 'text-rose-700 bg-rose-50 border-rose-200' : 'text-emerald-700 bg-emerald-50 border-emerald-200', 'py-2 px-3 rounded-lg text-xs font-semibold text-center border transition duration-200']">{{ inboundStatus.message }}</div>
            <div class="grid grid-cols-2 gap-4">
              <div class="col-span-2"><label class="block text-sm font-medium text-slate-600 mb-1">Tag ID</label><input type="text" required id="inboundTagId" v-model="inboundForm.tag_id" autocomplete="off" class="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:outline-none text-sm"></div>
              <div><label class="block text-sm font-medium text-slate-600 mb-1">Bin (Vị trí)</label><input type="text" required id="inboundBin" v-model="inboundForm.bin" class="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:outline-none text-sm"></div>
              <div><label class="block text-sm font-medium text-slate-600 mb-1">Code (Mã hàng)</label><input type="text" required id="inboundCode" v-model="inboundForm.code" class="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:outline-none text-sm"></div>
              <div><label class="block text-sm font-medium text-slate-600 mb-1">WH (Kho)</label><input type="text" required id="inboundWH" v-model="inboundForm.wh" class="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:outline-none text-sm"></div>
              <div><label class="block text-sm font-medium text-slate-600 mb-1">Quality (Số lượng)</label><input type="number" required id="inboundQuality" v-model.number="inboundForm.quality" autocomplete="off" class="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:outline-none text-sm"></div>
            </div>
            <div class="flex justify-end space-x-3 pt-4 border-t border-slate-100 shrink-0">
              <button type="button" @click="closeModal('inbound')" class="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg font-medium text-sm" :disabled="isSavingInbound">Hủy</button>
              <button type="submit" class="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-medium shadow-md text-sm flex items-center space-x-1" :disabled="isSavingInbound">
                <i v-if="isSavingInbound" class="fa-solid fa-spinner animate-spin"></i>
                <span>{{ isSavingInbound ? 'Đang lưu...' : 'Xác Nhận Nhập' }}</span>
              </button>
            </div>
          </form>
        </div>
      </div>
    </Teleport>

    <!-- System CSV Modal -->
    <Teleport to="body">
      <div v-if="modals.systemCsv" class="fixed inset-0 bg-black/50 z-50 flex items-center justify-center">
        <div class="bg-white rounded-xl shadow-xl w-full max-w-lg mx-4 overflow-hidden max-h-[90vh] flex flex-col">
          <div class="bg-indigo-600 px-6 py-4 text-white flex justify-between items-center shrink-0">
            <h3 class="font-bold text-base sm:text-lg"><i class="fa-solid fa-file-invoice mr-2"></i>Nhập File Hệ Thống (CSV Nguồn)</h3>
            <button @click="closeModal('systemCsv')" class="text-white hover:text-slate-200 text-xl"><i class="fa-solid fa-xmark"></i></button>
          </div>
          <div class="p-4 sm:p-6 space-y-4 overflow-y-auto">
            <div class="text-xs text-slate-500 bg-slate-50 p-3 rounded-lg border border-slate-200 leading-relaxed">
              <span class="font-bold text-slate-700 block mb-1">Cấu trúc file nguồn hệ thống nhận diện tự động:</span>
              <code class="font-mono bg-white px-1.5 py-0.5 rounded border border-slate-200 break-all block sm:inline">Stock Code, Warehouse, CREATEDATE, BATCH, BIN, Qty</code>
            </div>
            <div>
              <label class="block text-sm font-medium text-slate-700 mb-1">Dán nội dung văn bản CSV từ Excel:</label>
              <textarea v-model="systemCsvText" rows="6" placeholder="Stock Code,Warehouse,CREATEDATE,BATCH,BIN,Qty&#10;1256810001,01,6/2/2026,900002980666,,500" class="w-full px-3 py-2 text-xs font-mono border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none"></textarea>
            </div>
            <div class="border-t border-slate-100 pt-4 flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3 shrink-0">
              <div class="relative">
                <input type="file" id="systemCsvFileInput" accept=".csv" @change="handleSystemCSVFile" class="hidden">
                <button type="button" @click="triggerSystemCsv" class="w-full sm:w-auto bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs px-3 py-2 rounded-lg font-semibold border border-slate-300">
                  <i class="fa-solid fa-file-arrow-up mr-1"></i>Chọn tệp từ máy tính (.csv)
                </button>
              </div>
              <div class="flex space-x-2 justify-end">
                <button type="button" @click="closeModal('systemCsv')" class="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold" :disabled="isSavingSystem">Hủy</button>
                <button type="button" @click="processSystemCSVImport" class="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-semibold shadow-md flex items-center space-x-1" :disabled="isSavingSystem">
                  <i v-if="isSavingSystem" class="fa-solid fa-spinner animate-spin"></i>
                  <span>{{ isSavingSystem ? 'Đang nạp...' : 'Đồng bộ File Nguồn' }}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Teleport>

    <!-- Outbound Modal -->
    <Teleport to="body">
      <div v-if="modals.outbound" class="fixed inset-0 bg-black/50 z-50 flex items-center justify-center">
        <div class="bg-white rounded-xl shadow-xl w-full max-w-md mx-4 overflow-hidden max-h-[90vh] flex flex-col">
          <div class="bg-rose-600 px-6 py-4 text-white flex justify-between items-center shrink-0">
            <h3 class="font-bold text-base sm:text-lg"><i class="fa-solid fa-truck-ramp-box mr-2"></i>Xuất Kho Nâng Cao</h3>
            <button @click="closeModal('outbound')" class="text-white hover:text-slate-200 text-xl"><i class="fa-solid fa-xmark"></i></button>
          </div>
          <form @submit.prevent="handleOutboundSubmit" class="p-4 sm:p-6 space-y-4 overflow-y-auto">
            <div v-if="outboundDuplicates.length > 0" class="bg-amber-50 p-4 rounded-lg border border-amber-200 text-xs space-y-2">
              <p class="font-bold text-amber-800 flex items-center"><i class="fa-solid fa-triangle-exclamation mr-1.5 text-sm"></i> PHÁT HIỆN TRÙNG TAG ID ({{ outboundDuplicates.length }} dòng)!</p>
              <p class="text-slate-600">Vui lòng chọn chính xác ID hàng cần xuất dưới đây để tránh mất dữ liệu:</p>
              <div class="space-y-1.5 max-h-[160px] overflow-y-auto pr-1">
                <label v-for="item in outboundDuplicates" :key="item.id" class="flex items-start space-x-2 bg-white p-2.5 rounded border border-slate-200 cursor-pointer hover:bg-slate-50 transition block">
                  <input type="radio" :value="item.id" v-model="outboundSelectedRowId" class="mt-0.5 text-rose-600 focus:ring-rose-500 h-4 w-4">
                  <div class="text-[11px] text-slate-700 leading-tight">
                    <span class="font-bold text-slate-900">ID: #{{ item.id }}</span>
                    &bull; Vị trí Bin: <span class="font-semibold text-indigo-700">{{ item.bin }}</span>
                    &bull; Mã: <span class="font-semibold text-slate-800">{{ item.code }}</span>
                    &bull; Số lượng: <span class="font-bold text-slate-900">{{ item.quality }}</span>
                    <div class="text-[9px] text-slate-400 mt-0.5">Ngày tạo: {{ formatDate(item.created_at) }}</div>
                  </div>
                </label>
              </div>
            </div>
            <div><label class="block text-sm font-medium text-slate-600 mb-1">Chế độ xuất (Mode)</label>
              <select v-model="outboundForm.mode" class="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-rose-500 focus:outline-none text-sm">
                <option value="WO">Xuất theo lệnh sản xuất (WO)</option>
                <option value="YEU_CAU">Xuất phát theo phiếu yêu cầu</option>
                <option value="TIEU_HAO">Xuất phát vật liệu tiêu hao</option>
              </select>
            </div>
            <div v-if="outboundForm.mode === 'WO'"><label class="block text-sm font-medium text-slate-600 mb-1">Nhập Số Lệnh WO</label><input type="text" required v-model="outboundForm.woValue" placeholder="Nhập mã lệnh sản xuất..." class="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-rose-500 focus:outline-none text-sm"></div>
            <div><label class="block text-sm font-medium text-slate-600 mb-1">Quét hoặc Nhập Tag ID</label>
              <div class="relative">
                <input type="text" required v-model="outboundForm.tag_id" placeholder="VD: 900002950002" class="w-full pl-10 pr-3 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-rose-500 focus:outline-none text-sm">
                <div class="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400"><i class="fa-solid fa-barcode"></i></div>
              </div>
            </div>
            <div><label class="block text-sm font-medium text-slate-600 mb-1">Số lượng xuất bớt (Để trống nếu xuất hết)</label><input type="number" v-model.number="outboundForm.quality" placeholder="Giữ nguyên xuất 1 phần & xuất hết..." class="w-full px-3 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-rose-500 focus:outline-none text-sm"></div>
            <div class="flex justify-end space-x-3 pt-4 border-t border-slate-100 shrink-0">
              <button type="button" @click="closeModal('outbound')" class="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg font-medium text-sm" :disabled="isSavingOutbound">Hủy</button>
              <button type="submit" class="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-lg font-medium shadow-md text-sm flex items-center space-x-1" :disabled="isSavingOutbound">
                <i v-if="isSavingOutbound" class="fa-solid fa-spinner animate-spin"></i>
                <span>{{ isSavingOutbound ? 'Đang thực thi...' : 'Xác Nhận Xuất' }}</span>
              </button>
            </div>
          </form>
        </div>
      </div>
    </Teleport>

    <!-- CSV Import Modal -->
    <Teleport to="body">
      <div v-if="modals.csvImport" class="fixed inset-0 bg-black/50 z-50 flex items-center justify-center">
        <div class="bg-white rounded-xl shadow-xl w-full max-w-lg mx-4 overflow-hidden max-h-[90vh] flex flex-col">
          <div class="bg-indigo-600 px-6 py-4 text-white flex justify-between items-center shrink-0">
            <h3 class="font-bold text-base sm:text-lg"><i class="fa-solid fa-file-import mr-2"></i>Nhập Nhanh Dữ Liệu bằng CSV</h3>
            <button @click="closeModal('csvImport')" class="text-white hover:text-slate-200 text-xl"><i class="fa-solid fa-xmark"></i></button>
          </div>
          <div class="p-4 sm:p-6 space-y-4 overflow-y-auto">
            <div class="text-xs text-slate-500 bg-slate-50 p-3 rounded-lg border border-slate-200 text-[11px] sm:text-xs leading-relaxed">
              <span class="font-bold text-slate-700 block mb-1">Định dạng mẫu dòng tiêu đề CSV bắt buộc:</span>
              <code class="font-mono bg-white px-1.5 py-0.5 rounded border border-slate-200 break-all block sm:inline">tag_id,bin,code,wh,quality</code>
              <p class="mt-2 text-rose-500 font-semibold">* Lưu ý: Hệ thống sẽ phân tách tự động bằng dấu phẩy (,).</p>
            </div>
            <div>
              <label class="block text-sm font-medium text-slate-700 mb-1">Dán nội dung văn bản CSV trực tiếp:</label>
              <textarea v-model="csvImportText" rows="6" placeholder="tag_id,bin,code,wh,quality&#10;900002950009,100602,3430490101,61,500" class="w-full px-3 py-2 text-xs font-mono border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none"></textarea>
            </div>
            <div class="border-t border-slate-100 pt-4 flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3 shrink-0">
              <div class="relative">
                <input type="file" id="csvFileInput" accept=".csv" @change="handleCSVFile" class="hidden">
                <button type="button" @click="triggerCsv" class="w-full sm:w-auto bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs px-3 py-2 rounded-lg font-semibold border border-slate-300">
                  <i class="fa-solid fa-file-arrow-up mr-1"></i>Chọn từ máy tính (.csv)
                </button>
              </div>
              <div class="flex space-x-2 justify-end">
                <button type="button" @click="closeModal('csvImport')" class="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold" :disabled="isSavingCsv">Hủy</button>
                <button type="button" @click="processCSVImport" class="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-semibold shadow-md flex items-center space-x-1" :disabled="isSavingCsv">
                  <i v-if="isSavingCsv" class="fa-solid fa-spinner animate-spin"></i>
                  <span>{{ isSavingCsv ? 'Đang thực thi...' : 'Thực Thi Nhập' }}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Teleport>

    <!-- Edit Row Modal -->
    <Teleport to="body">
      <div v-if="modals.edit" class="fixed inset-0 bg-black/50 z-50 flex items-center justify-center">
        <div class="bg-white rounded-xl shadow-xl w-full max-w-lg mx-4 overflow-hidden max-h-[90vh] flex flex-col transform transition-all duration-300">
          <div class="bg-blue-600 px-6 py-4 text-white flex justify-between items-center shrink-0">
            <h3 class="font-bold text-base sm:text-lg"><i class="fa-solid fa-pen-to-square mr-2"></i>CHỈNH SỬA DỮ LIỆU TỒN KHO THỰC TẾ</h3>
            <button @click="closeModal('edit')" class="text-white hover:text-slate-200 text-xl"><i class="fa-solid fa-xmark"></i></button>
          </div>
          <form @submit.prevent="handleEditSubmit" class="p-4 sm:p-6 space-y-4 overflow-y-auto">
            <div class="grid grid-cols-2 gap-4">
              <div class="col-span-2 bg-slate-50 p-2.5 rounded-lg border border-slate-200 text-xs text-slate-500 font-semibold flex justify-between"><span>Đang chỉnh sửa dòng ID:</span><span class="font-mono text-slate-800">#{{ editForm.id }}</span></div>
              <div class="col-span-2"><label class="block text-xs font-bold uppercase text-slate-500 mb-1">Tag ID</label><input type="text" required v-model="editForm.tag_id" class="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none text-sm font-semibold text-slate-800"></div>
              <div><label class="block text-xs font-bold uppercase text-slate-500 mb-1">Bin (Vị trí)</label><input type="text" required v-model="editForm.bin" class="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none text-sm"></div>
              <div><label class="block text-xs font-bold uppercase text-slate-500 mb-1">Code (Mã hàng)</label><input type="text" required v-model="editForm.code" class="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none text-sm"></div>
              <div><label class="block text-xs font-bold uppercase text-slate-500 mb-1">WH (Kho)</label><input type="text" required v-model="editForm.wh" class="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none text-sm"></div>
              <div><label class="block text-xs font-bold uppercase text-slate-500 mb-1">Quality (Số lượng)</label><input type="number" required v-model.number="editForm.quality" class="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none text-sm font-bold text-blue-600"></div>
            </div>
            <div class="flex justify-end space-x-3 pt-4 border-t border-slate-100 shrink-0">
              <button type="button" @click="closeModal('edit')" class="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold" :disabled="isSavingEdit">Hủy</button>
              <button type="submit" class="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold shadow-md flex items-center space-x-1" :disabled="isSavingEdit">
                <i v-if="isSavingEdit" class="fa-solid fa-spinner animate-spin"></i>
                <span>{{ isSavingEdit ? 'Đang lưu...' : 'Lưu Thay Đổi' }}</span>
              </button>
            </div>
          </form>
        </div>
      </div>
    </Teleport>

  </div>
</template>
