import { createElement as h } from 'react'
import Md from '../Md.jsx'

export function MarkdownText({ text = '', color, style = null, ...rest }) {
  const value = String(text || '').trim()
  if (!value) return null

  return h(
    'div',
    {
      ...rest,
      style,
    },
    h(Md, { text: value, color })
  )
}

export default MarkdownText
