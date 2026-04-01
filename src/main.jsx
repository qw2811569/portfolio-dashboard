import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import { BrowserRouter } from 'react-router-dom'
import App from './App.routes.jsx'
import { bootstrapRuntimeDiagnostics } from './lib/runtimeLogger.js'
import { applyThemeVars } from './theme.js'

applyThemeVars()
bootstrapRuntimeDiagnostics()

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
  <React.StrictMode>,
    <BrowserRouter>
      <App />
    </BrowserRouter>,
  </React.StrictMode>,
)
