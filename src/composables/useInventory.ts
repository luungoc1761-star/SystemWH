import { shallowRef, computed, ref } from 'vue'
import { supabase } from '../lib/supabase'
import type { InventoryItem, ComparisonItem, MaterialWeight } from '../types'

const inventoryData = shallowRef<InventoryItem[]>([])
const comparisonData = shallowRef<ComparisonItem[]>([])
const materialWeights = shallowRef<MaterialWeight[]>([])
const smartFilter = ref('')
const inventoryLimit = ref(50)

export function useInventory() {
  // Phân trang server-side cho inventory
  async function fetchAllRows(tableName: string): Promise<any[]> {
    let allData: any[] = []
    let page = 0
    const pageSize = 1000
    let hasMore = true

    while (hasMore) {
      const { data, error } = await supabase
        .from(tableName)
        .select('*')
        .range(page * pageSize, (page + 1) * pageSize - 1)
        .order('id', { ascending: false })

      if (error) throw error
      if (data && data.length > 0) {
        allData = allData.concat(data)
        if (data.length < pageSize) {
          hasMore = false
        } else {
          page++
        }
      } else {
        hasMore = false
      }
    }
    return allData
  }

  async function fetchAllComparison(): Promise<ComparisonItem[]> {
    let allData: any[] = []
    let page = 0
    const pageSize = 1000
    let hasMore = true

    while (hasMore) {
      const { data, error } = await supabase
        .from('v_inventory_comparison')
        .select('*')
        .range(page * pageSize, (page + 1) * pageSize - 1)

      if (error) throw error
      if (data && data.length > 0) {
        allData = allData.concat(data)
        if (data.length < pageSize) {
          hasMore = false
        } else {
          page++
        }
      } else {
        hasMore = false
      }
    }
    return allData
  }

  async function fetchFromSupabase() {
    try {
      const [invData, compData] = await Promise.all([
        fetchAllRows('inventory'),
        fetchAllComparison()
      ])

      inventoryData.value = invData || []
      comparisonData.value = (compData || []).filter(
        (item: any) => Number(item.actual_qty || 0) > 0
      )

      // Material weights
      const { data: weightData, error: weightError } = await supabase
        .from('material_weights')
        .select('*')
        .order('code', { ascending: true })

      if (weightError) throw weightError
      materialWeights.value = weightData || []
    } catch (err) {
      console.error('Lỗi đồng bộ Supabase: ', err)
    }
  }

  const filteredInventory = computed(() => {
    if (!smartFilter.value) return inventoryData.value
    const query = smartFilter.value.toLowerCase().trim()
    return inventoryData.value.filter(item => {
      return String(item.code || '').toLowerCase().includes(query) ||
        String(item.bin || '').toLowerCase().includes(query) ||
        String(item.wh || '').toLowerCase().includes(query) ||
        String(item.tag_id || '').toLowerCase().includes(query)
    })
  })

  const renderedInventory = computed(() => {
    return filteredInventory.value.slice(0, inventoryLimit.value)
  })

  const totalQuality = computed(() => {
    return filteredInventory.value.reduce((acc, curr) => acc + Number(curr.quality || 0), 0)
  })

  const totalSystemQuality = computed(() => {
    return comparisonData.value.reduce((acc, curr) => acc + Number(curr.system_qty || 0), 0)
  })

  const uniqueCodesCount = computed(() => {
    return [...new Set(filteredInventory.value.map(item => item.code))].length
  })

  const totalVarianceQty = computed(() => {
    return totalQuality.value - totalSystemQuality.value
  })

  const uniqueCodes = computed(() => {
    return [...new Set(inventoryData.value.map(item => item.code).filter(c => c))]
  })

  const uniqueBins = computed(() => {
    return [...new Set(inventoryData.value.map(item => item.bin).filter(b => b))]
  })

  const uniqueWHs = computed(() => {
    return [...new Set(inventoryData.value.map(item => item.wh).filter(w => w))]
  })

  function resetFilter() {
    smartFilter.value = ''
    inventoryLimit.value = 50
  }

  function loadMore() {
    inventoryLimit.value += 50
  }

  return {
    inventoryData,
    comparisonData,
    materialWeights,
    smartFilter,
    inventoryLimit,
    filteredInventory,
    renderedInventory,
    totalQuality,
    totalSystemQuality,
    uniqueCodesCount,
    totalVarianceQty,
    uniqueCodes,
    uniqueBins,
    uniqueWHs,
    fetchAllRows,
    fetchFromSupabase,
    resetFilter,
    loadMore,
  }
}
