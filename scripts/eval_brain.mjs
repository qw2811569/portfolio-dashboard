import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const CASES_DIR = path.join(ROOT, "evals", "cases");
const RESULTS_DIR = path.join(ROOT, "evals", "results");

function walk(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return walk(full);
    return entry.name.endsWith(".json") ? [full] : [];
  });
}

function normalizeStatus(value) {
  const normalized = String(value || "").trim().toLowerCase();
  return ["fresh", "watch", "stale", "missing"].includes(normalized) ? normalized : "missing";
}

function signalLabel(key) {
  return ({
    monthlyRevenueGate: "月營收",
    conferenceGate: "法說",
    earningsGate: "財報",
    targetFreshnessGate: "目標價/報告",
    researchGate: "研究",
  })[key] || key;
}

function evaluateFreshnessGateCase(input) {
  const signals = input?.signals || {};
  const issues = Object.entries(signals)
    .filter(([key]) => ["monthlyRevenueGate", "conferenceGate", "earningsGate", "targetFreshnessGate", "researchGate"].includes(key))
    .map(([key, value]) => ({ key, status: normalizeStatus(value) }))
    .filter(item => ["stale", "missing"].includes(item.status));
  const bucket = issues.length > 0 ? "stale" : String(input?.incomingBucket || "validated");
  return {
    bucket,
    issues: issues.map(item => signalLabel(item.key)),
  };
}

function inferActual(entry, exit) {
  if (!Number.isFinite(entry) || !Number.isFinite(exit) || entry <= 0 || exit <= 0) return null;
  const pct = ((exit / entry) - 1) * 100;
  if (Math.abs(pct) <= 1) return "neutral";
  return pct > 0 ? "up" : "down";
}

function normalizeOutcomeLabel(value) {
  const normalized = String(value || "").trim().toLowerCase();
  return ["supported", "contradicted", "mixed", "inconclusive"].includes(normalized) ? normalized : "inconclusive";
}

function evaluatePerStockReviewCase(input) {
  const pred = ["up", "down", "neutral"].includes(input?.pred) ? input.pred : null;
  const stocks = Array.isArray(input?.stocks) ? input.stocks : [];
  return stocks.map((stock) => {
    const code = String(stock?.code || "").trim();
    const name = String(stock?.name || code).trim() || code;
    const entry = Number(input?.priceAtEvent?.[code]);
    const exit = Number(input?.priceAtExit?.[code]);
    const actual = inferActual(entry, exit);
    const changePct = Number.isFinite(entry) && Number.isFinite(exit) && entry > 0 && exit > 0
      ? Math.round((((exit / entry) - 1) * 100) * 100) / 100
      : null;
    let outcomeLabel = "inconclusive";
    if (pred && actual) {
      if (pred === actual) outcomeLabel = "supported";
      else if (pred === "neutral" || actual === "neutral") outcomeLabel = "mixed";
      else outcomeLabel = "contradicted";
    }
    return {
      code,
      name,
      actual,
      changePct,
      outcomeLabel,
    };
  });
}

function ratioOverlap(a, b) {
  const left = Array.isArray(a) ? a : [];
  const right = Array.isArray(b) ? b : [];
  if (left.length === 0 || right.length === 0) return 0;
  const rightSet = new Set(right);
  const matched = left.filter(item => rightSet.has(item)).length;
  return matched / Math.max(left.length, right.length, 1);
}

function scoreAnalog(left, right) {
  const matchedDimensions = [];
  const mismatchedDimensions = [];
  if (left?.positionType === right?.positionType) matchedDimensions.push("positionType");
  else mismatchedDimensions.push("positionType");
  if (left?.strategyClass && left.strategyClass === right?.strategyClass) matchedDimensions.push("strategyClass");
  else mismatchedDimensions.push("strategyClass");
  if (left?.eventPhase === right?.eventPhase || (left?.eventPhase === "pre_event" && right?.eventPhase === "tracking") || (left?.eventPhase === "tracking" && right?.eventPhase === "pre_event")) matchedDimensions.push("eventPhase");
  else mismatchedDimensions.push("eventPhase");
  if (ratioOverlap(left?.catalystTags, right?.catalystTags) > 0) matchedDimensions.push("catalystTags");
  else mismatchedDimensions.push("catalystTags");
  if (left?.industryTheme && left.industryTheme === right?.industryTheme) matchedDimensions.push("industryTheme");
  else mismatchedDimensions.push("industryTheme");
  if (left?.holdingPeriod && left.holdingPeriod === right?.holdingPeriod) matchedDimensions.push("holdingPeriod");
  else mismatchedDimensions.push("holdingPeriod");

  const fundamentalsMatch = ["revenueYoYBand", "epsState", "grossMarginTrend"].every(key => left?.fundamentalState?.[key] === right?.fundamentalState?.[key]);
  if (fundamentalsMatch) matchedDimensions.push("fundamentalState");
  else mismatchedDimensions.push("fundamentalState");

  const priceMatch = ["pnlBand", "targetGapBand"].every(key => left?.priceState?.[key] === right?.priceState?.[key]);
  if (priceMatch) matchedDimensions.push("priceState");
  else mismatchedDimensions.push("priceState");

  return { matchedDimensions, mismatchedDimensions };
}

function scoreCase(testCase) {
  if (testCase.type === "daily-analysis") {
    const result = evaluateFreshnessGateCase(testCase.input);
    const bucketPass = result.bucket === testCase.expect.bucket;
    const missingMentions = (testCase.expect.mustMentionIssues || []).filter(label => !result.issues.includes(label));
    return {
      pass: bucketPass && missingMentions.length === 0,
      score: bucketPass ? (missingMentions.length === 0 ? 100 : 70) : 0,
      result,
      failures: [
        ...(bucketPass ? [] : [`bucket mismatch: expected ${testCase.expect.bucket}, got ${result.bucket}`]),
        ...missingMentions.map(label => `missing issue mention: ${label}`),
      ],
    };
  }

  if (testCase.type === "event-review") {
    const result = evaluatePerStockReviewCase(testCase.input);
    const required = Array.isArray(testCase.expect?.required) ? testCase.expect.required : [];
    const failures = [];
    if (result.length < Number(testCase.expect?.minimumOutcomes || 0)) {
      failures.push(`outcome count too small: got ${result.length}`);
    }
    required.forEach((expected) => {
      const found = result.find(item => item.code === expected.code);
      if (!found) {
        failures.push(`missing stock outcome: ${expected.code}`);
        return;
      }
      if (expected.outcomeLabel && normalizeOutcomeLabel(found.outcomeLabel) !== normalizeOutcomeLabel(expected.outcomeLabel)) {
        failures.push(`${expected.code} outcomeLabel mismatch: expected ${expected.outcomeLabel}, got ${found.outcomeLabel}`);
      }
      if (expected.actual && found.actual !== expected.actual) {
        failures.push(`${expected.code} actual mismatch: expected ${expected.actual}, got ${found.actual}`);
      }
    });
    return {
      pass: failures.length === 0,
      score: failures.length === 0 ? 100 : Math.max(0, 100 - failures.length * 25),
      result,
      failures,
    };
  }

  if (testCase.type === "brain-validation") {
    const result = scoreAnalog(testCase.input?.left, testCase.input?.right);
    const missingMatched = (testCase.expect?.matchedDimensions || []).filter(key => !result.matchedDimensions.includes(key));
    const missingMismatched = (testCase.expect?.mismatchedDimensions || []).filter(key => !result.mismatchedDimensions.includes(key));
    const failures = [
      ...missingMatched.map(key => `missing matchedDimension: ${key}`),
      ...missingMismatched.map(key => `missing mismatchedDimension: ${key}`),
    ];
    return {
      pass: failures.length === 0,
      score: failures.length === 0 ? 100 : Math.max(0, 100 - failures.length * 20),
      result,
      failures,
    };
  }

  return {
    pass: false,
    score: 0,
    result: null,
    failures: [`unknown case type: ${testCase.type}`],
  };
}

function main() {
  const files = walk(CASES_DIR);
  const cases = files.map(file => ({ file, data: JSON.parse(fs.readFileSync(file, "utf8")) }));
  const results = cases.map(({ file, data }) => {
    const evaluation = scoreCase(data);
    return {
      id: data.id,
      type: data.type,
      file: path.relative(ROOT, file),
      ...evaluation,
    };
  });
  const total = results.length;
  const passed = results.filter(item => item.pass).length;
  const avgScore = total > 0 ? Math.round((results.reduce((sum, item) => sum + item.score, 0) / total) * 100) / 100 : 0;
  const report = {
    generatedAt: new Date().toISOString(),
    summary: {
      total,
      passed,
      failed: total - passed,
      avgScore,
    },
    results,
  };

  fs.mkdirSync(RESULTS_DIR, { recursive: true });
  fs.writeFileSync(path.join(RESULTS_DIR, "latest.json"), JSON.stringify(report, null, 2));

  console.log(`eval_brain: ${passed}/${total} passed · avg ${avgScore}`);
  results.forEach((item) => {
    console.log(`${item.pass ? "PASS" : "FAIL"} ${item.id} (${item.type}) score=${item.score}`);
    if (item.failures.length > 0) {
      item.failures.forEach((failure) => console.log(`  - ${failure}`));
    }
  });

  if (passed !== total) {
    process.exitCode = 1;
  }
}

main();
