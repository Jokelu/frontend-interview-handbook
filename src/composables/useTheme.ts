import { computed, ref } from 'vue'

/**
 * 主题切换：light / dark
 * 通过给 <html> 打 data-theme 属性 + CSS 变量实现，组件本身不用写两套样式。
 */
type Theme = 'light' | 'dark'

const STORAGE_KEY = 'fe-interview-hub:theme'

function resolveInitialTheme(): Theme {
  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (saved === 'light' || saved === 'dark') return saved
  } catch {
    /* ignore */
  }
  return 'light'
}

const theme = ref<Theme>(resolveInitialTheme())

function apply(next: Theme): void {
  document.documentElement.setAttribute('data-theme', next)
  try {
    localStorage.setItem(STORAGE_KEY, next)
  } catch {
    /* ignore */
  }
}

apply(theme.value)

export function useTheme() {
  const toggleTheme = () => {
    theme.value = theme.value === 'light' ? 'dark' : 'light'
    apply(theme.value)
  }
  return {
    theme: computed(() => theme.value),
    isDark: computed(() => theme.value === 'dark'),
    toggleTheme,
  }
}
