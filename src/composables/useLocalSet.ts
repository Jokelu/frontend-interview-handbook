import { computed, ref, type Ref } from 'vue'

/**
 * localStorage 持久化的字符串集合
 * ------------------------------------------------------------------
 * 用 Map 做模块级缓存，保证**同一个 key 在任何组件里拿到的是同一个 ref**，
 * 这样侧边栏改了数据，首页 / 详情页会自动跟着更新。
 * （如果每次调用都 new 一个 ref，各处状态就各算各的了。）
 */
const registry = new Map<string, Ref<string[]>>()

function read(key: string): string[] {
  try {
    const raw = localStorage.getItem(key)
    const parsed: unknown = raw ? JSON.parse(raw) : []
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === 'string') : []
  } catch {
    // 隐私模式 / 存储被禁用时静默降级为内存态
    return []
  }
}

function write(key: string, ids: string[]): void {
  try {
    localStorage.setItem(key, JSON.stringify(ids))
  } catch {
    /* ignore */
  }
}

export function useLocalSet(key: string) {
  let ids = registry.get(key)
  if (!ids) {
    ids = ref<string[]>(read(key))
    registry.set(key, ids)
  }

  const set = ids

  const has = (id: string) => set.value.includes(id)

  const add = (id: string) => {
    if (has(id)) return
    set.value = [...set.value, id]
    write(key, set.value)
  }

  const remove = (id: string) => {
    if (!has(id)) return
    set.value = set.value.filter((item) => item !== id)
    write(key, set.value)
  }

  const toggle = (id: string) => (has(id) ? remove(id) : add(id))

  const clear = () => {
    set.value = []
    write(key, set.value)
  }

  return {
    ids: computed(() => set.value),
    count: computed(() => set.value.length),
    has,
    add,
    remove,
    toggle,
    clear,
  }
}
