import { ref, computed } from 'vue'
import { supabase } from '../lib/supabase'
import { getStorageSafe, setStorageSafe, removeStorageSafe } from '../utils/storage'
import type { AppUser } from '../types'

const currentUser = ref<AppUser | null>(null)
const loginUsername = ref('')
const loginPassword = ref('')
const rememberMe = ref(false)
const loginErrorMessage = ref('')
const isLoading = ref(false)

export function useAuth() {
  const currentRole = computed(() => currentUser.value?.role ?? 'Viewer')
  const currentDisplayName = computed(() => currentUser.value?.display_name ?? 'Guest')

  async function checkLoginState(): Promise<boolean> {
    const savedUser = getStorageSafe('loggedInUser')
    if (savedUser) {
      try {
        currentUser.value = JSON.parse(savedUser)
        return true
      } catch {
        handleLogout()
        return false
      }
    }
    return false
  }

  async function handleLoginSubmit(): Promise<boolean> {
    loginErrorMessage.value = ''
    isLoading.value = true

    try {
      const { data, error } = await supabase
        .from('app_users')
        .select('*')
        .ilike('username', loginUsername.value.trim())
        .eq('password', loginPassword.value)
        .maybeSingle()

      if (error) throw error

      if (!data) {
        loginErrorMessage.value = 'Tên đăng nhập hoặc mật khẩu không chính xác.'
        return false
      }

      currentUser.value = data as AppUser
      const userString = JSON.stringify(currentUser.value)
      setStorageSafe('loggedInUser', userString, rememberMe.value)
      return true
    } catch (err: any) {
      console.error('Lỗi xác thực: ', err)
      loginErrorMessage.value = 'Lỗi hệ thống: ' + err.message
      return false
    } finally {
      isLoading.value = false
    }
  }

  function handleLogout() {
    removeStorageSafe('loggedInUser')
    currentUser.value = null
  }

  return {
    currentUser,
    currentRole,
    currentDisplayName,
    loginUsername,
    loginPassword,
    rememberMe,
    loginErrorMessage,
    isLoading,
    checkLoginState,
    handleLoginSubmit,
    handleLogout,
  }
}
