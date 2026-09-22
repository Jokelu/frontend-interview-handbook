<script setup lang="ts">
/**
 * 分类图标：把数据里的 icon 字符串映射到 lucide 图标组件
 * 这样数据层只存字符串，不依赖具体的 UI 实现。
 */
import {
  Atom,
  Binary,
  Braces,
  Component,
  FileCode2,
  FileType2,
  Gauge,
  GitBranch,
  Globe,
  Package,
  Palette,
  Server,
  Smartphone,
  Sparkles,
  Zap,
  type LucideIcon,
} from 'lucide-vue-next'

const props = withDefaults(
  defineProps<{
    name: string
    size?: number
    color?: string
  }>(),
  { size: 16, color: 'currentColor' },
)

const ICONS: Record<string, LucideIcon> = {
  'file-code': FileCode2,
  palette: Palette,
  braces: Braces,
  'file-type': FileType2,
  component: Component,
  atom: Atom,
  server: Server,
  package: Package,
  zap: Zap,
  globe: Globe,
  gauge: Gauge,
  'git-branch': GitBranch,
  sparkles: Sparkles,
  binary: Binary,
  smartphone: Smartphone,
}

const icon = ICONS[props.name] ?? FileCode2
</script>

<template>
  <component :is="icon" :size="size" :color="color" :stroke-width="1.9" />
</template>
