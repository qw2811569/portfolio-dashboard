import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import { applyThemeVars } from './theme.js'

applyThemeVars()

// 錯誤邊界 - 避免整個應用崩潰
window.addEventListener('error', (event) => {
  console.error('全局錯誤:', event.error)
  event.preventDefault()
})

window.addEventListener('unhandledrejection', (event) => {
  console.error('未處理的 Promise 拒絕:', event.reason)
  event.preventDefault()
})

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)
