/**
 * 代码块一键复制
 * ------------------------------------------------------------------
 * 实现方式：事件委托。
 * 为什么不用给每个按钮单独绑事件？因为代码块是 v-html 渲染出来的，
 * 数量多且随时会被替换，逐个绑定既麻烦又要处理销毁；
 * 在 document 上挂一个监听，通过 closest() 判断点击目标即可，
 * 无论内容怎么变都不用重新绑定。
 */
export function installCodeCopy(): void {
  document.addEventListener('click', (event) => {
    const target = event.target as HTMLElement | null
    if (!target) return

    const btn = target.closest<HTMLButtonElement>('.code-block__copy')
    if (!btn) return

    const code = btn.dataset.code ?? ''
    if (!code) return

    void copyText(code, btn)
  })
}

/** 复制文本，并给出「已复制」的视觉反馈 */
async function copyText(text: string, btn: HTMLButtonElement): Promise<void> {
  const original = btn.textContent ?? '复制'
  try {
    if (navigator.clipboard?.writeText) {
      // 现代浏览器：优先用异步剪贴板 API
      await navigator.clipboard.writeText(text)
    } else {
      // 兜底：老浏览器 / 非 https 环境用 execCommand
      const textarea = document.createElement('textarea')
      textarea.value = text
      textarea.style.position = 'fixed'
      textarea.style.opacity = '0'
      document.body.appendChild(textarea)
      textarea.select()
      document.execCommand('copy')
      document.body.removeChild(textarea)
    }
    btn.textContent = '已复制'
    btn.classList.add('is-done')
  } catch {
    btn.textContent = '复制失败'
  }
  window.setTimeout(() => {
    btn.textContent = original
    btn.classList.remove('is-done')
  }, 1600)
}
