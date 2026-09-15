import { createApp } from 'vue'
import App from './App.vue'
import router from './router'
import { installCodeCopy } from './utils/codeCopy'
import './styles/index.css'

// 代码块复制用事件委托实现，全局装一次即可
installCodeCopy()

createApp(App).use(router).mount('#app')
