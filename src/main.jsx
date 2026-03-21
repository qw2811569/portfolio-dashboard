import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import { applyThemeVars } from './theme.js'

applyThemeVars()

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)
