import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

// 版本更新后，旧的 index.html 仍引用的懒加载 chunk 会 404（白屏）。
// 捕获 vite 的 preload 失败事件，自动刷新一次以拉到新版本（用 sessionStorage 防死循环）。
window.addEventListener('vite:preloadError', () => {
  const KEY = 'travian-chunk-reload'
  if (!sessionStorage.getItem(KEY)) {
    sessionStorage.setItem(KEY, '1')
    window.location.reload()
  }
})

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
