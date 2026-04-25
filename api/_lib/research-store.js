import path from 'node:path'

import { createFlatDataPathResolver, createHybridStore } from './hybrid-store.js'

export const RESEARCH_INDEX_KEY = 'research-index.json'
export const RESEARCH_PREFIX = 'research/'
export const BRAIN_PROPOSAL_PREFIX = 'brain-proposals/'

function normalizeKey(key) {
  return String(key || '').trim()
}

function resolveDataPath(key = '') {
  return createFlatDataPathResolver(path.join(process.cwd(), 'data'))(key)
}

function normalizeScope(scope) {
  const normalized = String(scope || '').trim().replace(/^\/+|\/+$/g, '')
  if (!normalized) throw new Error('[research-store] scope is required')
  return normalized
}

function normalizeArtifactId(value) {
  const normalized = String(value || '').trim().replace(/\.json$/i, '')
  if (!normalized) throw new Error('[research-store] artifact id is required')
  return normalized
}

function normalizeProposalId(value) {
  const normalized = String(value || '').trim().replace(/\.json$/i, '')
  if (!normalized) throw new Error('[research-store] proposal id is required')
  return normalized
}

export function getResearchPrefix(scope = '') {
  const normalizedScope = String(scope || '').trim()
  return normalizedScope ? `${RESEARCH_PREFIX}${normalizeScope(normalizedScope)}/` : RESEARCH_PREFIX
}

export function getResearchArtifactKey(scope, artifactId) {
  return `${getResearchPrefix(scope)}${normalizeArtifactId(artifactId)}.json`
}

export function getBrainProposalKey(proposalId) {
  return `${BRAIN_PROPOSAL_PREFIX}${normalizeProposalId(proposalId)}.json`
}

export const researchStore = createHybridStore({
  keyspaceId: 'research',
  loggerPrefix: 'research-store',
  envPrefix: 'RESEARCH',
  localPath: (key) => resolveDataPath(normalizeKey(key)),
  vercelKey: (key) => normalizeKey(key),
  gcsKey: (key) => normalizeKey(key),
  bucketClass: 'private',
  authoritySource: 'local',
  promoteOnFallback: true,
})

export async function readResearchIndex(options = {}) {
  return researchStore.read(RESEARCH_INDEX_KEY, options)
}

export async function writeResearchIndex(payload, options = {}) {
  return researchStore.write(RESEARCH_INDEX_KEY, payload, options)
}

export async function readResearchIndexWithVersion(options = {}) {
  return researchStore.readWithVersion(RESEARCH_INDEX_KEY, options)
}

export async function writeResearchIndexIfVersion(payload, versionToken, options = {}) {
  return researchStore.writeIfVersion(RESEARCH_INDEX_KEY, payload, versionToken, options)
}

function mergeResearchIndex(currentPayload, report) {
  const current = Array.isArray(currentPayload) ? currentPayload : []
  return [report, ...current.filter((item) => item.timestamp !== report.timestamp)]
    .sort((a, b) => b.timestamp - a.timestamp)
    .slice(0, 30)
}

export async function upsertResearchIndexReport(report, options = {}) {
  let attempts = 0
  while (attempts++ < 3) {
    const current = await readResearchIndexWithVersion(options)
    const next = mergeResearchIndex(current?.payload, report)
    try {
      await writeResearchIndexIfVersion(next, current?.versionToken || null, options)
      return next
    } catch (error) {
      if (error?.code === 'VERSION_CONFLICT' && attempts < 3) continue
      throw error
    }
  }

  throw new Error('[research-store] failed to update research index after CAS retries')
}

export async function readResearchObject(key, options = {}) {
  return researchStore.read(normalizeKey(key), options)
}

export async function writeResearchObject(key, payload, options = {}) {
  return researchStore.write(normalizeKey(key), payload, options)
}

export async function deleteResearchObject(key, options = {}) {
  return researchStore.delete(normalizeKey(key), options)
}

export async function listResearchObjects(prefix = '', options = {}) {
  return researchStore.list(normalizeKey(prefix), options)
}

export async function readResearchArtifact(scope, artifactId, options = {}) {
  return readResearchObject(getResearchArtifactKey(scope, artifactId), options)
}

export async function writeResearchArtifact(scope, artifactId, payload, options = {}) {
  return writeResearchObject(getResearchArtifactKey(scope, artifactId), payload, options)
}

export async function readBrainProposal(proposalId, options = {}) {
  return readResearchObject(getBrainProposalKey(proposalId), options)
}

export async function writeBrainProposal(proposalId, payload, options = {}) {
  return writeResearchObject(getBrainProposalKey(proposalId), payload, options)
}
