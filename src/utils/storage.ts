/** Safari-safe localStorage/sessionStorage wrappers */
export function getStorageSafe(key: string): string | null {
  try {
    return localStorage.getItem(key) || sessionStorage.getItem(key)
  } catch {
    console.warn('Storage is blocked in Safari private mode')
    return null
  }
}

export function setStorageSafe(key: string, val: string, remember: boolean): void {
  try {
    if (remember) {
      localStorage.setItem(key, val)
    } else {
      sessionStorage.setItem(key, val)
    }
  } catch {
    console.warn('Storage write failed in Safari private mode')
  }
}

export function removeStorageSafe(key: string): void {
  try {
    localStorage.removeItem(key)
    sessionStorage.removeItem(key)
  } catch {
    console.warn('Storage remove failed in Safari private mode')
  }
}
