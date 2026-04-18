const { z } = require('zod')

const TrimmedString = z.string().trim()
const NonEmptyString = z.string().trim().min(1)
const NullableString = z.union([z.string().trim(), z.null()]).optional()
const NumericLike = z.union([z.number(), z.string()]).pipe(z.coerce.number())
const ArrayOf = (schema) =>
  z
    .union([z.array(schema), z.null(), z.undefined()])
    .transform((value) => (Array.isArray(value) ? value : []))

const ThesisPillarSchema = z
  .object({
    id: NullableString,
    name: NullableString,
    text: NullableString,
    evidence: ArrayOf(z.unknown()).optional(),
    status: NullableString,
    trend: NullableString,
    lastChecked: NullableString,
  })
  .passthrough()

const ThesisRiskSchema = z
  .object({
    id: NullableString,
    trigger: NullableString,
    mitigation: NullableString,
    watchedAt: NullableString,
    text: NullableString,
    triggered: z.boolean().optional(),
  })
  .passthrough()

const ThesisUpdateLogSchema = z
  .object({
    date: NullableString,
    event: NullableString,
    pillarImpact: z.unknown().optional(),
    action: NullableString,
  })
  .passthrough()

const ThesisScorecardSchema = z
  .object({
    statement: NullableString,
    reason: NullableString,
    direction: NullableString,
    conviction: z.union([z.number(), z.string()]).optional(),
    pillars: ArrayOf(ThesisPillarSchema),
    risks: ArrayOf(ThesisRiskSchema),
    updateLog: ArrayOf(ThesisUpdateLogSchema),
    targetPrice: z.union([NumericLike, z.null()]).optional(),
    stopLoss: z.union([NumericLike, z.null()]).optional(),
    stopLossPercent: z.union([NumericLike, z.null()]).optional(),
    invalidation: NullableString,
    expectation: NullableString,
    status: NullableString,
  })
  .passthrough()

const CatalystPillarImpactSchema = z
  .object({
    pillar: NullableString,
    direction: NullableString,
  })
  .passthrough()

const CatalystEventSchema = z
  .object({
    id: z.union([NonEmptyString, NumericLike]).transform((value) => String(value).trim()),
    ticker: NullableString,
    code: NullableString,
    date: NullableString,
    title: NonEmptyString,
    catalystType: NullableString,
    impact: NullableString,
    relatedThesisIds: ArrayOf(TrimmedString),
    pillarImpact: ArrayOf(CatalystPillarImpactSchema),
    source: NullableString,
    confidence: z.union([NumericLike, z.string(), z.null()]).optional(),
    reviewWindow: z.unknown().optional(),
    reviewResult: z.unknown().optional(),
  })
  .passthrough()

const HoldingPositionSchema = z
  .object({
    code: NullableString,
    name: NullableString,
    qty: z.union([NumericLike, z.null()]).optional(),
    cost: z.union([NumericLike, z.null()]).optional(),
    price: z.union([NumericLike, z.null()]).optional(),
    pnl: z.union([NumericLike, z.null()]).optional(),
    pct: z.union([NumericLike, z.null()]).optional(),
    value: z.union([NumericLike, z.null()]).optional(),
    type: NullableString,
    note: NullableString,
  })
  .passthrough()

const TargetReportSchema = z
  .object({
    firm: NullableString,
    target: z.union([NumericLike, z.null()]).optional(),
    date: NullableString,
    stance: NullableString,
    source_url: NullableString,
    evidence: NullableString,
  })
  .passthrough()

const FundamentalsEntrySchema = z
  .object({
    code: NullableString,
    revenueMonth: NullableString,
    revenueYoY: z.union([NumericLike, z.null()]).optional(),
    revenueMoM: z.union([NumericLike, z.null()]).optional(),
    quarter: NullableString,
    eps: z.union([NumericLike, z.null()]).optional(),
    grossMargin: z.union([NumericLike, z.null()]).optional(),
    roe: z.union([NumericLike, z.null()]).optional(),
    source: NullableString,
    updatedAt: NullableString,
    note: NullableString,
  })
  .passthrough()

const FreshnessSchema = z
  .object({
    targets: NullableString,
    fundamentals: NullableString,
    events: NullableString,
    research: NullableString,
    fetchedAt: z.record(z.string(), z.unknown()).optional(),
    staleness: NullableString,
    fallback: NullableString,
  })
  .passthrough()

const HoldingDossierSchema = z
  .object({
    code: NonEmptyString,
    name: NonEmptyString,
    position: z.union([HoldingPositionSchema, z.null()]).default(null),
    thesis: z.union([ThesisScorecardSchema, z.null()]).default(null),
    targets: ArrayOf(TargetReportSchema),
    fundamentals: z.union([FundamentalsEntrySchema, z.null()]).default(null),
    analystReports: ArrayOf(z.unknown()),
    events: ArrayOf(CatalystEventSchema),
    research: ArrayOf(z.unknown()),
    brainContext: z.union([z.string(), z.null()]).default(null),
    freshness: z.union([FreshnessSchema, z.null()]).default(null),
    validationSignals: z.unknown().optional(),
    stockMeta: z.unknown().optional(),
    finmind: z.unknown().optional(),
  })
  .passthrough()

const OperatingContextSchema = z
  .object({
    currentSessionMode: NullableString,
    refreshBacklog: z
      .union([
        z
          .object({
            tickers: z.array(TrimmedString).default([]),
            reason: NullableString,
            staleMin: z.union([NumericLike, z.null()]).optional(),
          })
          .passthrough(),
        z.null(),
        z.undefined(),
      ])
      .transform((value) => (Array.isArray(value) ? value : [])),
    activeEvents: z
      .object({
        count: z.union([NumericLike, z.null()]).optional(),
        needsReview: z.union([NumericLike, z.null()]).optional(),
        upcoming3Days: z.union([NumericLike, z.null()]).optional(),
      })
      .passthrough()
      .default({}),
    latestInsight: z
      .object({
        source: NullableString,
        title: NullableString,
        linkToTab: NullableString,
        at: NullableString,
      })
      .passthrough()
      .default({}),
    nextActionLabel: NullableString,
    nextActionReason: NullableString,
    portfolioContext: z.unknown().optional(),
    ritualTiming: z.unknown().optional(),
    topWarnings: ArrayOf(z.unknown()),
    evaluatedAt: NullableString,
  })
  .passthrough()

const TradeParseRequestSchema = z.object({
  systemPrompt: z.string().optional(),
  base64: NonEmptyString,
  mediaType: z.string().optional(),
})

exports.CatalystEventSchema = CatalystEventSchema
exports.FundamentalsEntrySchema = FundamentalsEntrySchema
exports.HoldingDossierSchema = HoldingDossierSchema
exports.OperatingContextSchema = OperatingContextSchema
exports.TargetReportSchema = TargetReportSchema
exports.ThesisScorecardSchema = ThesisScorecardSchema
exports.TradeParseRequestSchema = TradeParseRequestSchema
exports.ThesisPillarSchema = ThesisPillarSchema
exports.ThesisRiskSchema = ThesisRiskSchema
