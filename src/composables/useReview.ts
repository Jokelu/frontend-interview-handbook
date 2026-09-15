import { useLocalSet } from './useLocalSet'

/**
 * 复习清单：模拟面试里「没答上来」的题目会自动进这里，
 * 方便集中二刷。和「已掌握」是两个独立的集合，互不干扰。
 */
const REVIEW_KEY = 'fe-interview-hub:review'

export function useReview() {
  const store = useLocalSet(REVIEW_KEY)

  return {
    reviewIds: store.ids,
    reviewCount: store.count,
    isInReview: store.has,
    addToReview: store.add,
    removeFromReview: store.remove,
    toggleReview: store.toggle,
    clearReview: store.clear,
  }
}
