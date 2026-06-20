import { ref, computed, watch, onUnmounted } from 'vue'
import type { MaterialWeight } from '../types'
import { supabase } from '../lib/supabase'

export function useCalculator(materialWeights: { value: MaterialWeight[] }) {
  const selectedCalcItem = ref<MaterialWeight | null>(null)
  const calcForm = ref({
    code: '',
    pcs: null as number | null,
    kg: null as number | null,
  })
  const displayCalcValues = ref({
    pcs: 0,
    kg: 0,
  })

  let pcsAnimFrame: number | null = null
  let kgAnimFrame: number | null = null

  function animateValue(type: 'pcs' | 'kg', target: number) {
    const start = displayCalcValues.value[type]
    const duration = 250
    const startTime = performance.now()

    const run = (now: number) => {
      const elapsed = now - startTime
      const progress = Math.min(elapsed / duration, 1)
      const value = start + (target - start) * progress

      if (type === 'pcs') {
        displayCalcValues.value.pcs = Math.round(value)
      } else {
        displayCalcValues.value.kg = Number(value.toFixed(4))
      }

      if (progress < 1) {
        if (type === 'pcs') {
          pcsAnimFrame = requestAnimationFrame(run)
        } else {
          kgAnimFrame = requestAnimationFrame(run)
        }
      } else {
        displayCalcValues.value[type] = target
      }
    }

    if (type === 'pcs') {
      if (pcsAnimFrame !== null) cancelAnimationFrame(pcsAnimFrame)
      pcsAnimFrame = requestAnimationFrame(run)
    } else {
      if (kgAnimFrame !== null) cancelAnimationFrame(kgAnimFrame)
      kgAnimFrame = requestAnimationFrame(run)
    }
  }

  const filteredCalcCodes = computed(() => {
    const query = calcForm.value.code.trim().toLowerCase()
    if (query.length < 2) return []
    if (selectedCalcItem.value && selectedCalcItem.value.code.toLowerCase() === query) {
      return []
    }
    return materialWeights.value
      .filter(item => String(item.code || '').toLowerCase().includes(query))
      .slice(0, 5)
  })

  function selectCalcCode(item: MaterialWeight) {
    selectedCalcItem.value = item
    calcForm.value.code = item.code
    calcForm.value.pcs = null
    calcForm.value.kg = null
    animateValue('pcs', 0)
    animateValue('kg', 0)
  }

  function handleCalcCodeEnter() {
    if (filteredCalcCodes.value.length > 0) {
      selectCalcCode(filteredCalcCodes.value[0])
    } else {
      const exactMatch = materialWeights.value.find(
        item => String(item.code || '').trim().toLowerCase() === calcForm.value.code.trim().toLowerCase()
      )
      if (exactMatch) {
        selectCalcCode(exactMatch)
      }
    }
  }

  function onCalcPcsInput() {
    if (!selectedCalcItem.value || calcForm.value.pcs === null || calcForm.value.pcs === ('' as any)) {
      animateValue('pcs', 0)
      animateValue('kg', 0)
      return
    }
    const targetKg = Number((calcForm.value.pcs * Number(selectedCalcItem.value.kg)).toFixed(4))
    animateValue('pcs', calcForm.value.pcs)
    animateValue('kg', targetKg)
  }

  function onCalcKgInput() {
    if (!selectedCalcItem.value || calcForm.value.kg === null || calcForm.value.kg === ('' as any)) {
      animateValue('pcs', 0)
      animateValue('kg', 0)
      return
    }
    const unitWeight = Number(selectedCalcItem.value.kg)
    if (unitWeight === 0) return

    const targetPcs = Math.round(calcForm.value.kg / unitWeight)
    animateValue('kg', calcForm.value.kg)
    animateValue('pcs', targetPcs)
  }

  function resetCalc() {
    calcForm.value.code = ''
    calcForm.value.pcs = null
    calcForm.value.kg = null
    selectedCalcItem.value = null
    animateValue('pcs', 0)
    animateValue('kg', 0)
  }

  async function ensureMaterialWeights() {
    if (!materialWeights.value || materialWeights.value.length === 0) {
      const { data } = await supabase
        .from('material_weights')
        .select('*')
        .order('code', { ascending: true })
      if (data) {
        materialWeights.value = data
      }
    }
  }

  // Auto-match watcher
  watch(() => calcForm.value.code, (newVal) => {
    if (!newVal) {
      selectedCalcItem.value = null
      animateValue('pcs', 0)
      animateValue('kg', 0)
      return
    }
    const query = newVal.trim().toLowerCase()
    const match = materialWeights.value.find(
      item => String(item.code || '').trim().toLowerCase() === query
    )
    if (match) {
      selectedCalcItem.value = match
      if (calcForm.value.pcs !== null && calcForm.value.pcs !== ('' as any)) {
        onCalcPcsInput()
      } else if (calcForm.value.kg !== null && calcForm.value.kg !== ('' as any)) {
        onCalcKgInput()
      }
    } else {
      selectedCalcItem.value = null
    }
  })

  // Cleanup animation frames on unmount
  onUnmounted(() => {
    if (pcsAnimFrame !== null) cancelAnimationFrame(pcsAnimFrame)
    if (kgAnimFrame !== null) cancelAnimationFrame(kgAnimFrame)
  })

  return {
    selectedCalcItem,
    calcForm,
    displayCalcValues,
    filteredCalcCodes,
    selectCalcCode,
    handleCalcCodeEnter,
    onCalcPcsInput,
    onCalcKgInput,
    resetCalc,
    ensureMaterialWeights,
  }
}
