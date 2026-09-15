<script setup lang="ts">
/**
 * 应用外壳：左侧固定菜单 + 右侧内容区
 * 移动端（<900px）侧边栏变成抽屉，由 drawerOpen 控制。
 */
import { ref } from 'vue'
import { Menu, Moon, Sun, Github } from 'lucide-vue-next'
import AppSidebar from '@/components/AppSidebar.vue'
import { totalQuestions } from '@/data'
import { useProgress } from '@/composables/useProgress'
import { useTheme } from '@/composables/useTheme'

const drawerOpen = ref(false)
const { masteredCount } = useProgress()
const { isDark, toggleTheme } = useTheme()
</script>

<template>
  <div class="app">
    <AppSidebar :open="drawerOpen" @close="drawerOpen = false" />

    <!-- 移动端遮罩 -->
    <div v-if="drawerOpen" class="app__mask" @click="drawerOpen = false" />

    <div class="app__main">
      <header class="topbar">
        <button class="icon-btn topbar__menu" type="button" @click="drawerOpen = true">
          <Menu :size="18" />
        </button>

        <RouterLink to="/" class="topbar__crumb">题库首页</RouterLink>
        <span class="topbar__sep">/</span>
        <span class="topbar__crumb topbar__crumb--muted">
          {{ masteredCount }} / {{ totalQuestions }} 已掌握
        </span>

        <div class="topbar__spacer" />

        <button class="icon-btn" type="button" :title="isDark ? '切换到浅色' : '切换到深色'" @click="toggleTheme">
          <Sun v-if="isDark" :size="17" />
          <Moon v-else :size="17" />
        </button>
        <a class="icon-btn" href="https://github.com" target="_blank" rel="noreferrer" title="GitHub">
          <Github :size="17" />
        </a>
      </header>

      <main class="app__content">
        <RouterView v-slot="{ Component }">
          <component :is="Component" :key="$route.fullPath" />
        </RouterView>
      </main>
    </div>
  </div>
</template>

<style scoped>
.app {
  min-height: 100%;
}

.app__mask {
  position: fixed;
  inset: 0;
  z-index: 25;
  background: rgba(16, 24, 40, 0.4);
  backdrop-filter: blur(2px);
}

.app__main {
  margin-left: var(--sidebar-w);
  min-height: 100vh;
  display: flex;
  flex-direction: column;
}

/* ---- 顶栏 ---- */
.topbar {
  position: sticky;
  top: 0;
  z-index: 20;
  display: flex;
  align-items: center;
  gap: 6px;
  height: var(--topbar-h);
  padding: 0 20px;
  background: color-mix(in srgb, var(--bg) 88%, transparent);
  backdrop-filter: blur(10px);
  border-bottom: 1px solid var(--border);
}
.topbar__menu {
  display: none;
}
.topbar__crumb {
  font-size: 13px;
  color: var(--text-secondary);
}
.topbar__crumb:hover {
  color: var(--brand);
}
.topbar__crumb--muted {
  color: var(--text-muted);
}
.topbar__crumb--muted:hover {
  color: var(--text-muted);
}
.topbar__sep {
  color: var(--border-strong);
  font-size: 12px;
}
.topbar__spacer {
  flex: 1;
}

.app__content {
  flex: 1;
  width: 100%;
  max-width: 980px;
  margin: 0 auto;
  padding: 24px 20px 64px;
}

@media (max-width: 900px) {
  .app__main {
    margin-left: 0;
  }
  .topbar__menu {
    display: inline-flex;
  }
  .topbar {
    padding: 0 12px;
  }
  .app__content {
    padding: 16px 14px 56px;
  }
}
</style>
