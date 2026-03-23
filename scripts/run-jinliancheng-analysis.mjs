#!/usr/bin/env node
// 一次性腳本：為金聯成組合跑收盤分析 + 深度研究
// 直接呼叫 Anthropic API，不需要 vercel dev
import { readFileSync } from "fs";
import { resolve } from "path";

// ── 讀取 env ──
const envPath = resolve(process.cwd(), ".env.local");
const envContent = readFileSync(envPath, "utf-8");
const envVars = {};
envContent.split("\n").forEach(line => {
  const m = line.match(/^([^#=]+)=(.*)$/);
  if (m) envVars[m[1].trim()] = m[2].trim().replace(/^["']|["']$/g, "");
});

const API_KEY = envVars.AI_API_KEY || envVars.ANTHROPIC_API_KEY;
const MODEL = envVars.AI_MODE || "claude-sonnet-4-20250514";
if (!API_KEY) { console.error("找不到 API key"); process.exit(1); }

// ── 金聯成持倉資料 ──
const holdings = [
  { code:"0050",   name:"元大台灣50",       qty:52,     price:75.90,   cost:73.54,   type:"ETF",  industry:"台股ETF",     strategy:"ETF/指數",  position:"衛星" },
  { code:"00635U", name:"期元大S&P黃金",     qty:36,     price:50.05,   cost:53.97,   type:"ETF",  industry:"商品ETF",     strategy:"ETF/指數",  position:"戰術" },
  { code:"00918",  name:"大華優利高填息30",   qty:169,    price:22.58,   cost:23.34,   type:"ETF",  industry:"高股息ETF",   strategy:"ETF/指數",  position:"衛星" },
  { code:"00981A", name:"主動統一台股增長",   qty:309,    price:21.02,   cost:19.22,   type:"ETF",  industry:"主動型ETF",   strategy:"ETF/指數",  position:"衛星" },
  { code:"2489",   name:"瑞軒",             qty:56000,  price:38.65,   cost:42.27,   type:"股票", industry:"顯示器/光電", strategy:"轉型股",    position:"核心" },
  { code:"3167",   name:"大量",             qty:1000,   price:345.00,  cost:350.50,  type:"股票", industry:"精密機械",    strategy:"成長股",    position:"衛星" },
  { code:"4562",   name:"穎漢",             qty:7000,   price:32.60,   cost:33.33,   type:"股票", industry:"精密機械",    strategy:"景氣循環",  position:"衛星" },
  { code:"6446",   name:"藥華藥",           qty:4100,   price:640.00,  cost:708.32,  type:"股票", industry:"生技醫療",    strategy:"成長股",    position:"核心" },
  { code:"7799",   name:"禾榮科",           qty:2951,   price:410.50,  cost:867.69,  type:"股票", industry:"生技醫療",    strategy:"成長股",    position:"核心" },
  { code:"1799",   name:"易威",             qty:59000,  price:37.80,   cost:79.53,   type:"股票", industry:"生技醫療",    strategy:"轉型股",    position:"核心" },
  { code:"1815",   name:"富喬",             qty:6000,   price:102.00,  cost:108.74,  type:"股票", industry:"PCB/材料",    strategy:"景氣循環",  position:"衛星" },
  { code:"3491",   name:"昇達科",           qty:140,    price:1450.00, cost:1442.76, type:"股票", industry:"光通訊",      strategy:"成長股",    position:"衛星" },
  { code:"8074",   name:"鉅橡",             qty:4000,   price:61.10,   cost:66.19,   type:"股票", industry:"PCB/材料",    strategy:"景氣循環",  position:"衛星" },
  { code:"8096",   name:"擎亞",             qty:5500,   price:87.10,   cost:74.80,   type:"股票", industry:"電子通路",    strategy:"成長股",    position:"衛星" },
  { code:"7865",   name:"金聯成",           qty:106543, price:49.50,   cost:8.25,    type:"股票", industry:"環保/循環",   strategy:"價值股",    position:"核心" },
];

// ── 計算損益 ──
holdings.forEach(h => {
  h.value = Math.round(h.qty * h.price);
  h.pnl = Math.round((h.price - h.cost) * h.qty);
  h.pct = Math.round(((h.price / h.cost) - 1) * 10000) / 100;
});

const totalValue = holdings.reduce((s, h) => s + h.value, 0);
const totalPnl = holdings.reduce((s, h) => s + h.pnl, 0);

// ── 呼叫 API ──
async function callClaude(system, user, maxTokens = 4000) {
  console.log(`\n⏳ 呼叫 AI (${MODEL})，最多 ${maxTokens} tokens...`);
  const start = Date.now();
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": API_KEY,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: maxTokens,
      system,
      messages: [{ role: "user", content: user }],
    }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data?.error?.message || JSON.stringify(data));
  const text = data.content?.filter(c => c.type === "text").map(c => c.text).join("\n\n");
  console.log(`✅ 完成 (${((Date.now() - start) / 1000).toFixed(1)}s, ${data.usage?.output_tokens || "?"} tokens)`);
  return text;
}

// ══════════════════════════════════════════
// Part 1: 收盤分析
// ══════════════════════════════════════════
async function runClosingAnalysis() {
  console.log("\n" + "═".repeat(60));
  console.log("📊 開始金聯成收盤分析");
  console.log("═".repeat(60));

  const holdingSummary = holdings.map(h => {
    const typeTag = h.type === "ETF" ? "[ETF]" : "[股票]";
    const indTag = `[${h.industry}/${h.strategy}/${h.position}]`;
    return `${typeTag}${indTag} ${h.name}(${h.code}) 累計${h.pct >= 0 ? "+" : ""}${h.pct}% 成本${h.cost} 現價${h.price} 市值${h.value.toLocaleString()}`;
  }).join("\n");

  const systemPrompt = `你是一位專業的台股策略分析師。
用戶委託你管理一個名為「金聯成」的投資組合，持有 15 檔標的（4 檔 ETF + 11 檔股票）。
這個組合的特徵：
- 核心持倉集中在生技醫療（藥華藥/禾榮科/易威）和環保循環（金聯成）
- 有大量虧損部位（禾榮科 -52.9%、易威 -52.7%）
- 金聯成是主力獲利來源（+497%）
- ETF 部位很小，屬於配置型

⚠️ 核心原則：不同類型持股必須用不同策略框架分析。

【生技醫療股策略框架】（藥華藥/禾榮科/易威）
- 新藥股：臨床進度、FDA/EMA 審核時程、專利佈局、營收拐點
- 醫材股：產品認證、市場滲透率、毛利率趨勢
- 轉型股：轉型進度、新舊業務佔比、現金流壓力

【成長股策略框架】（大量/昇達科/擎亞）
- 營收成長動能、法人持股變化、產業趨勢
- 大量：PCB/AOI/半導體設備需求
- 昇達科：光通訊基地台需求
- 擎亞：三星HBM/AI記憶體通路

【景氣循環股策略框架】（穎漢/富喬/鉅橡）
- 產業循環位置、庫存水位、ASP 趨勢
- 富喬：AI伺服器 Low DK 玻纖布需求
- 穎漢：自動化設備景氣
- 鉅橡：PCB 耗材需求

【價值股策略框架】（金聯成）
- 循環經濟政策支持度、鉛價走勢、廢電池回收量
- 興櫃股流動性風險

【ETF 策略框架】
- 台股大盤方向、商品趨勢、高股息填息率

請用繁體中文分析。格式：
## 📊 投組總覽
（整體配置、風險分布、資金權重）

## 📈 個股策略分析
（逐一分析每檔，標注策略狀態和建議動作）

## ⚠️ 風險與停損追蹤
（虧損部位評估、集中度風險）

## 🎯 操作建議與觀察重點
（具體買賣建議或等待條件）

## 🧠 策略建議
（這個組合的整體策略方向建議）`;

  const userPrompt = `日期：2026/03/23（週日，非交易日）
組合名稱：金聯成
總市值：${totalValue.toLocaleString()} 元
總損益：${totalPnl >= 0 ? "+" : ""}${totalPnl.toLocaleString()} 元

持倉明細：
${holdingSummary}

市值排名（由大到小）：
${[...holdings].sort((a, b) => b.value - a.value).map((h, i) => `${i + 1}. ${h.name}(${h.code}) ${h.value.toLocaleString()}元 佔比${(h.value / totalValue * 100).toFixed(1)}%`).join("\n")}

備註：
- 金聯成(7865)是興櫃股票，2026年初才登錄，流動性較差
- 禾榮科(7799)是全球僅2家取得BNCT硼中子捕獲治療核准的公司
- 藥華藥(6446)的Ropeg藥物已在美/歐/日/台上市，目標價有分析師估1060元
- 瑞軒(2489)從顯示器代工轉型光通訊，2025年EPS 1.22元
- 大量(3167)2025年營收年增95.35%，法人估2026年營收挑戰75億
- 擎亞(8096)是三星核心通路夥伴，受惠HBM需求
- 易威(1799)從體溫計轉型新劑型藥物，仍在燒錢期

請全面分析此組合並給出策略建議。`;

  return callClaude(systemPrompt, userPrompt, 4000);
}

// ══════════════════════════════════════════
// Part 2: 深度研究（全組合 + 系統進化）
// ══════════════════════════════════════════
async function runDeepResearch() {
  console.log("\n" + "═".repeat(60));
  console.log("🧬 開始金聯成深度研究");
  console.log("═".repeat(60));

  // Round 1: 個股掃描
  console.log("\n── Round 1: 個股快掃 ──");
  const stockList = holdings.filter(h => h.type === "股票").map(h =>
    `${h.name}(${h.code}) 產業:${h.industry} 成本:${h.cost} 現價:${h.price} 損益:${h.pct}% 市值:${h.value.toLocaleString()}`
  ).join("\n");

  const round1 = await callClaude(
    "你是台股研究分析師。針對每檔股票給出 100 字以內的快速掃描，包含：目前基本面狀態、近期催化劑、主要風險。用繁體中文。",
    `以下是「金聯成」組合的個股持倉，請逐一快速掃描：\n${stockList}`,
    3000
  );

  // Round 2: 系統診斷
  console.log("\n── Round 2: 系統診斷 ──");
  const round2 = await callClaude(
    `你是投資系統架構師。根據個股掃描結果，診斷這個投資組合的系統性問題。
分析維度：
1. 產業集中度風險
2. 虧損管理紀律
3. 資金配置效率
4. 策略一致性（每檔的持有邏輯是否清晰）
5. 認知盲點（持有人可能忽略的風險）
用繁體中文，直接指出問題不要客氣。`,
    `組合名稱：金聯成
總市值：${totalValue.toLocaleString()}
總損益：${totalPnl >= 0 ? "+" : ""}${totalPnl.toLocaleString()}

個股掃描結果：
${round1}

持倉市值佔比：
${[...holdings].sort((a, b) => b.value - a.value).map(h => `${h.name}(${h.code}) ${(h.value / totalValue * 100).toFixed(1)}% [${h.industry}/${h.strategy}] 損益${h.pct}%`).join("\n")}`,
    3000
  );

  // Round 3: 進化建議 + 組合調整
  console.log("\n── Round 3: 進化建議 + 組合調整 ──");
  const round3 = await callClaude(
    `你是投資策略顧問。根據個股掃描和系統診斷，給出具體的組合調整建議。
格式：
## 🔄 建議調整
（具體的加碼/減碼/停損/換股建議，附理由）

## 📋 觀察清單
（建議加入觀察但暫不行動的標的）

## 🧠 策略規則建議
（這個組合應該遵守的核心規則，最多 10 條）

## 📅 近期催化劑時程
（未來 1-3 個月的重要事件時程表）

用繁體中文，具體務實不空泛。`,
    `個股掃描：
${round1}

系統診斷：
${round2}

目前組合配置：
${holdings.map(h => `${h.name}(${h.code}) ${h.type} ${h.industry} 佔比${(h.value / totalValue * 100).toFixed(1)}% 損益${h.pct}%`).join("\n")}`,
    4000
  );

  return { round1, round2, round3 };
}

// ══════════════════════════════════════════
// Main
// ══════════════════════════════════════════
async function main() {
  console.log("🚀 金聯成組合分析腳本啟動");
  console.log(`📋 持股 ${holdings.length} 檔 | 總市值 ${totalValue.toLocaleString()} | 總損益 ${totalPnl >= 0 ? "+" : ""}${totalPnl.toLocaleString()}`);

  // Part 1: 收盤分析
  const closingAnalysis = await runClosingAnalysis();

  // Part 2: 深度研究
  const research = await runDeepResearch();

  // 輸出結果到檔案
  const output = `# 金聯成組合分析報告
日期：2026/03/23

---

# Part 1: 收盤分析

${closingAnalysis}

---

# Part 2: 深度研究

## Round 1: 個股快掃

${research.round1}

## Round 2: 系統診斷

${research.round2}

## Round 3: 進化建議 + 組合調整

${research.round3}
`;

  const outPath = resolve(process.cwd(), "data", "jinliancheng-analysis.md");
  const { mkdirSync, writeFileSync } = await import("fs");
  mkdirSync(resolve(process.cwd(), "data"), { recursive: true });
  writeFileSync(outPath, output, "utf-8");
  console.log(`\n📄 報告已儲存至: ${outPath}`);
  console.log("\n" + "═".repeat(60));
  console.log("✅ 全部完成");
  console.log("═".repeat(60));
}

main().catch(err => {
  console.error("❌ 錯誤:", err.message);
  process.exit(1);
});
