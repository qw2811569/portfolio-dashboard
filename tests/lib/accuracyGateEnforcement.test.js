import { readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

const ROOT = process.cwd()

const REQUIRED_BUILDERS = [
  { file: 'api/parse.js', builders: ['buildParsePrompt'] },
  { file: 'api/research-extract.js', builders: ['buildResearchExtractPromptPayload'] },
  { file: 'api/research.js', builders: ['callClaude'] },
  {
    file: 'api/analyst-reports.js',
    builders: ['buildGeminiGroundingPrompt', 'buildInsightExtractionPromptPayload'],
  },
  {
    file: 'src/lib/dailyAnalysisRuntime.js',
    builders: [
      'buildBlindPredictionRequest',
      'buildDailyAnalysisRequest',
      'buildFallbackBrainUpdateRequest',
    ],
  },
  {
    file: 'src/lib/promptTemplateCatalog.js',
    builders: [
      'buildEventReviewBrainSystemPrompt',
      'buildStressTestSystemPrompt',
      'buildStressTestUserPrompt',
      'buildEventReviewBrainUserPrompt',
    ],
  },
]

function readSource(relPath) {
  return readFileSync(path.join(ROOT, relPath), 'utf-8')
}

function findBuilderLine(source, builderName) {
  const lines = source.split('\n')
  const lineIndex = lines.findIndex((line) => {
    const trimmed = line.trim()
    return (
      trimmed.startsWith(`function ${builderName}`) ||
      trimmed.startsWith(`async function ${builderName}`) ||
      trimmed.startsWith(`export function ${builderName}`) ||
      trimmed.startsWith(`export async function ${builderName}`) ||
      trimmed.startsWith(`const ${builderName} =`) ||
      trimmed.startsWith(`export const ${builderName} =`)
    )
  })

  return lineIndex >= 0 ? lineIndex + 1 : null
}

function extractTopLevelBuilderBlock(source, builderName) {
  const lines = source.split('\n')
  const startLineIndex = lines.findIndex((line) => {
    const trimmed = line.trim()
    return (
      trimmed.startsWith(`function ${builderName}`) ||
      trimmed.startsWith(`async function ${builderName}`) ||
      trimmed.startsWith(`export function ${builderName}`) ||
      trimmed.startsWith(`export async function ${builderName}`) ||
      trimmed.startsWith(`const ${builderName} =`) ||
      trimmed.startsWith(`export const ${builderName} =`)
    )
  })

  if (startLineIndex === -1) {
    return null
  }

  let endLineIndex = lines.length
  for (let index = startLineIndex + 1; index < lines.length; index += 1) {
    const line = lines[index]
    if (!line.startsWith(' ') && !line.startsWith('\t')) {
      const trimmed = line.trim()
      if (
        trimmed.startsWith('function ') ||
        trimmed.startsWith('async function ') ||
        trimmed.startsWith('export function ') ||
        trimmed.startsWith('export async function ') ||
        trimmed.startsWith('const ') ||
        trimmed.startsWith('export const ')
      ) {
        endLineIndex = index
        break
      }
    }
  }

  return lines.slice(startLineIndex, endLineIndex).join('\n')
}

describe('lib/accuracyGateEnforcement', () => {
  it('requires every tracked prompt builder to append Accuracy Gate', () => {
    const missing = []

    REQUIRED_BUILDERS.forEach(({ file, builders }) => {
      const source = readSource(file)

      builders.forEach((builderName) => {
        const block = extractTopLevelBuilderBlock(source, builderName)
        const line = findBuilderLine(source, builderName)

        if (!block || !line) {
          missing.push(`${file}:1 missing builder ${builderName}`)
          return
        }

        if (!/applyAccuracyGatePrompt|ACCURACY_GATE_MARKER/.test(block)) {
          missing.push(`${file}:${line} ${builderName} is missing Accuracy Gate`)
        }
      })
    })

    expect(
      missing,
      missing.length > 0
        ? `Accuracy Gate missing in:\n${missing.map((entry) => `- ${entry}`).join('\n')}`
        : 'all tracked prompt builders are gated'
    ).toEqual([])
  })
})
