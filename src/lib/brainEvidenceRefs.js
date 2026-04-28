export function normalizeBrainEvidenceType(value) {
  const normalized = String(value || '')
    .trim()
    .toLowerCase()
  return [
    'analysis',
    'research',
    'review',
    'event',
    'fundamental',
    'target',
    'report',
    'dossier',
    'note',
  ].includes(normalized)
    ? normalized
    : 'note'
}

export function normalizeBrainEvidenceRef(value) {
  if (typeof value === 'string') {
    const label = value.trim()
    return label ? { type: 'note', refId: null, code: null, label, date: null } : null
  }
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  const label = String(value.label || value.text || value.title || '').trim()
  if (!label) return null
  return {
    type: normalizeBrainEvidenceType(value.type),
    refId: String(value.refId || value.id || '').trim() || null,
    code: String(value.code || '').trim() || null,
    label,
    date: String(value.date || value.updatedAt || '').trim() || null,
  }
}

export function normalizeBrainEvidenceRefs(value) {
  return Array.isArray(value)
    ? value.map(normalizeBrainEvidenceRef).filter(Boolean).slice(0, 8)
    : []
}
