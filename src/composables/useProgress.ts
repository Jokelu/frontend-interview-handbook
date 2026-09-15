import { useLocalSet } from './useLocalSet'

/**
 * 刷题进度：记录「已掌握」的题目 id
 * 底层复用 useLocalSet，所以和「复习清单」是同一套机制。
 */
const MASTERED_KEY = 'fe-interview-hub:mastered'

export function useProgress() {
  const store = useLocalSet(MASTERED_KEY)

  return {
    masteredIds: store.ids,
    masteredCount: store.count,
    isMastered: store.has,
    toggle: store.toggle,
    markMastered: store.add,
    unmarkMastered: store.remove,
    reset: store.clear,
  }
}
