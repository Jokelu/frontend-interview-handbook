<script setup lang="ts">
/**
 * 出现频率指示器：3 个点，按 freq 点亮
 * 3 星（必问）用红色，2 星用橙色，1 星用灰色 —— 一眼看出轻重。
 */
defineProps<{ freq: number; showText?: boolean }>()
</script>

<template>
  <span class="freq" :title="`面试出现频率：${freq}/3`">
    <i
      v-for="n in 3"
      :key="n"
      class="freq__dot"
      :class="{ 'freq__dot--on': n <= freq, warm: freq < 3 }"
    />
    <em v-if="showText" class="freq__text">{{ freq === 3 ? '必问' : freq === 2 ? '常问' : '偶尔' }}</em>
  </span>
</template>

<style scoped>
.freq__text {
  margin-left: 2px;
  font-size: 11px;
  font-style: normal;
  color: var(--text-muted);
}
</style>
