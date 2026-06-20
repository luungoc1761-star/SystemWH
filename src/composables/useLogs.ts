import { shallowRef, computed, ref } from 'vue'
import { supabase } from '../lib/supabase'
import type { LogEntry } from '../types'

const logData = shallowRef<LogEntry[]>([])
const logFilter = ref('')
const logLimit = ref(50)
const showOlderLogs = ref(false)

export function useLogs() {
  async function fetchLogsFromSupabase() {
    try {
      const { data, error } = await supabase
        .from('ghilog')
        .select('*')
        .order('id', { ascending: false })

      if (error) throw error
      logData.value = data || []
    } catch (err) {
      console.error('Lỗi đồng bộ dữ liệu ghilog: ', err)
    }
  }

  async function logActivity(
    actionType: string,
    tagId: string,
    code: string,
    bin: string,
    wh: string,
    quality: number,
    details: string,
    username: string
  ) {
    try {
      const { error } = await supabase
        .from('ghilog')
        .insert([{
          username,
          action_type: actionType,
          tag_id: tagId,
          code,
          bin,
          wh,
          quality,
          details
        }])
        .select()

      if (error) {
        console.error('Lỗi chi tiết khi lưu ghilog:', error)
        alert('Không thể ghi nhận nhật ký hoạt động: ' + error.message)
        throw error
      }

      await fetchLogsFromSupabase()
    } catch (err: any) {
      console.error('Lỗi thực thi quy trình ghi Log: ', err.message)
    }
  }

  const filteredLogs = computed(() => {
    let logs = logData.value

    if (logFilter.value) {
      const query = logFilter.value.toLowerCase().trim()
      logs = logs.filter(log => {
        return String(log.action_type || '').toLowerCase().includes(query) ||
          String(log.code || '').toLowerCase().includes(query) ||
          String(log.tag_id || '').toLowerCase().includes(query) ||
          String(log.bin || '').toLowerCase().includes(query) ||
          String(log.username || '').toLowerCase().includes(query) ||
          String(log.details || '').toLowerCase().includes(query)
      })
    }

    if (!showOlderLogs.value) {
      const oneDayAgo = Date.now() - 24 * 60 * 60 * 1000
      logs = logs.filter(log => {
        const logTime = new Date(log.created_at).getTime()
        if (isNaN(logTime)) return true
        return logTime >= oneDayAgo
      })
    }

    return logs.slice(0, logLimit.value)
  })

  function toggleOlderLogs() {
    showOlderLogs.value = !showOlderLogs.value
    logLimit.value = 50
  }

  function loadMoreLogs() {
    logLimit.value += 50
  }

  return {
    logData,
    logFilter,
    logLimit,
    showOlderLogs,
    filteredLogs,
    fetchLogsFromSupabase,
    logActivity,
    toggleOlderLogs,
    loadMoreLogs,
  }
}
