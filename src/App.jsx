import { useState, useEffect, useRef, useDeferredValue, createElement as h } from "react";
import { C, A, alpha } from "./theme.js";

// ── 輕量 Markdown → React 渲染器 ────────────────────────────────
function Md({ text, color }) {
  if (!text) return null;
  const lines = text.split("\n");
  const els = [];
  let listItems = [];
  const textColor = color || C.textSec;
  const flushList = () => {
    if (listItems.length > 0) {
      els.push(h("ul", { key: `ul-${els.length}`, style: { margin: "4px 0 8px 6px", padding: 0, listStyle: "none" } },
        listItems.map((li, j) => h("li", { key: j, style: { fontSize: 11, color: textColor, lineHeight: 1.8, paddingLeft: 12, position: "relative" } },
          h("span", { style: { position: "absolute", left: 0, color: C.textMute } }, "·"), renderInline(li)
        ))
      ));
      listItems = [];
    }
  };
  const renderInline = (s) => {
    // **bold** and *italic*
    const parts = [];
    let rest = s;
    let k = 0;
    const rx = /\*\*(.+?)\*\*|\*(.+?)\*/g;
    let m, last = 0;
    while ((m = rx.exec(rest)) !== null) {
      if (m.index > last) parts.push(h("span", { key: k++ }, rest.slice(last, m.index)));
      if (m[1]) parts.push(h("strong", { key: k++, style: { color: C.text, fontWeight: 600 } }, m[1]));
      else if (m[2]) parts.push(h("em", { key: k++, style: { fontStyle: "italic" } }, m[2]));
      last = m.index + m[0].length;
    }
    if (last < rest.length) parts.push(h("span", { key: k++ }, rest.slice(last)));
    return parts.length > 0 ? parts : rest;
  };
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (/^#{1,3}\s/.test(line)) {
      flushList();
      const lvl = line.match(/^(#+)/)[1].length;
      const txt = line.replace(/^#+\s*/, "");
      const sz = lvl === 1 ? 14 : lvl === 2 ? 12 : 11;
      els.push(h("div", { key: `h-${i}`, style: { fontSize: sz, fontWeight: 600, color: C.text, marginTop: lvl === 1 ? 12 : 8, marginBottom: 4 } }, renderInline(txt)));
    } else if (/^[-*]\s/.test(line.trim())) {
      listItems.push(line.trim().replace(/^[-*]\s*/, ""));
    } else if (/^\d+\.\s/.test(line.trim())) {
      flushList();
      const txt = line.trim().replace(/^\d+\.\s*/, "");
      const num = line.trim().match(/^(\d+)\./)[1];
      els.push(h("div", { key: `ol-${i}`, style: { fontSize: 11, color: textColor, lineHeight: 1.8, paddingLeft: 12, position: "relative", marginBottom: 2 } },
        h("span", { style: { position: "absolute", left: 0, color: C.textMute, fontSize: 10 } }, `${num}.`), renderInline(txt)
      ));
    } else if (line.trim() === "") {
      flushList();
      els.push(h("div", { key: `br-${i}`, style: { height: 4 } }));
    } else {
      flushList();
      els.push(h("div", { key: `p-${i}`, style: { fontSize: 11, color: textColor, lineHeight: 1.8, marginBottom: 2 } }, renderInline(line)));
    }
  }
  flushList();
  return h("div", null, els);
}

// ── 目標價資料庫（分析師共識）─────────────────────────────────────
// reports: [{firm, target, date}]  avg 自動計算
const INIT_TARGETS = {
  "1503": { reports:[{firm:"自行估算",target:260,date:"2026/03"}], updatedAt:"2026/03/17", isNew:false },
  "1717": { reports:[{firm:"自行估算",target:75,date:"2026/03"}], updatedAt:"2026/03/17", isNew:false },
  "2308": { reports:[{firm:"元大",target:1200,date:"2026/01"},{firm:"富邦",target:1150,date:"2026/02"}], updatedAt:"2026/02/10", isNew:false },
  "2313": { reports:[{firm:"凱基",target:280,date:"2026/01"},{firm:"FactSet共識",target:280,date:"2026/01"}], updatedAt:"2026/01/15", isNew:false },
  "2543": { reports:[{firm:"自行估算",target:90,date:"2026/03"}], updatedAt:"2026/03/17", isNew:false },
  "3006": { reports:[{firm:"華南投顧",target:200,date:"2026/03/11"},{firm:"法人A",target:205,date:"2026/03/16"},{firm:"法人B",target:246,date:"2026/03/16"}], updatedAt:"2026/03/16", isNew:true },
  "3013": { reports:[{firm:"自行估算",target:120,date:"2026/03"}], updatedAt:"2026/03/17", isNew:false },
  "3017": { reports:[{firm:"國際共識",target:2037,date:"2026/03"},{firm:"大摩",target:1800,date:"2025/11"},{firm:"大和",target:1840,date:"2025/10"}], updatedAt:"2026/03/17", isNew:true },
  "3231": { reports:[{firm:"中信投顧",target:195,date:"2026/03/16"}], updatedAt:"2026/03/16", isNew:true },
  "3443": { reports:[{firm:"中信投顧",target:3600,date:"2026/02"},{firm:"元大投顧",target:3400,date:"2026/02"},{firm:"大摩",target:3288,date:"2026/02"}], updatedAt:"2026/02/04", isNew:true },
  "3491": { reports:[{firm:"自行估算",target:1600,date:"2026/03"}], updatedAt:"2026/03/17", isNew:false },
  "4583": { reports:[{firm:"自行估算",target:750,date:"2026/03"}], updatedAt:"2026/03/17", isNew:false },
  "6274": { reports:[{firm:"中信投顧",target:710,date:"2026/03/12"}], updatedAt:"2026/03/12", isNew:true },
  "6770": { reports:[{firm:"自行估算",target:100,date:"2026/03"}], updatedAt:"2026/03/17", isNew:false },
  "6862": { reports:[{firm:"自行估算",target:230,date:"2026/03"}], updatedAt:"2026/03/17", isNew:false },
  "8227": { reports:[{firm:"中信投顧",target:190,date:"2026/01/23"}], updatedAt:"2026/01/23", isNew:false },
};

const avgTarget = (code) => {
  const d = INIT_TARGETS[code];
  if (!d || !d.reports.length) return null;
  return Math.round(d.reports.reduce((s,r)=>s+r.target,0) / d.reports.length);
};

// ── 產業/策略 metadata ──────────────────────────────────────────
const STOCK_META = {
  "00637L": { industry:"中國ETF",     strategy:"ETF/指數",  period:"短中", position:"戰術", leader:"N/A" },
  "039108": { industry:"被動元件",    strategy:"權證",      period:"短",   position:"戰術", leader:"N/A", underlying:"禾伸堂" },
  "053848": { industry:"半導體設備",  strategy:"權證",      period:"短",   position:"戰術", leader:"N/A", underlying:"亞翔" },
  "702157": { industry:"光通訊",      strategy:"權證",      period:"短",   position:"戰術", leader:"N/A", underlying:"華星光" },
  "1503":   { industry:"重電",        strategy:"景氣循環",  period:"中",   position:"衛星", leader:"二線" },
  "1717":   { industry:"PCB/材料",    strategy:"景氣循環",  period:"中",   position:"衛星", leader:"龍頭" },
  "2308":   { industry:"AI/伺服器",   strategy:"成長股",    period:"中長", position:"核心", leader:"龍頭" },
  "2313":   { industry:"PCB/材料",    strategy:"景氣循環",  period:"中",   position:"衛星", leader:"二線" },
  "2543":   { industry:"營建",        strategy:"景氣循環",  period:"中",   position:"戰術", leader:"小型" },
  "3006":   { industry:"IC/記憶體",   strategy:"景氣循環",  period:"短中", position:"戰術", leader:"小型" },
  "3013":   { industry:"AI/伺服器",   strategy:"成長股",    period:"中",   position:"衛星", leader:"小型" },
  "3017":   { industry:"AI/伺服器",   strategy:"成長股",    period:"中長", position:"核心", leader:"龍頭" },
  "3231":   { industry:"AI/伺服器",   strategy:"成長股",    period:"中",   position:"衛星", leader:"大型" },
  "3443":   { industry:"AI/伺服器",   strategy:"成長股",    period:"中長", position:"核心", leader:"龍頭" },
  "3491":   { industry:"光通訊",      strategy:"成長股",    period:"中長", position:"核心", leader:"小龍頭" },
  "4583":   { industry:"精密機械",    strategy:"事件驅動",  period:"中",   position:"衛星", leader:"小型" },
  "6274":   { industry:"PCB/材料",    strategy:"景氣循環",  period:"中",   position:"衛星", leader:"二線" },
  "6770":   { industry:"IC/記憶體",   strategy:"景氣循環",  period:"中長", position:"衛星", leader:"二線" },
  "6862":   { industry:"連接器",      strategy:"成長股",    period:"中",   position:"衛星", leader:"小型" },
  "8227":   { industry:"光通訊",      strategy:"成長股",    period:"中長", position:"衛星", leader:"小型" },
};

// 產業色彩映射 — 提亮版（文字用，需在 #283D3B 上可讀）
const IND_COLOR = {
  "AI/伺服器": C.teal,
  "光通訊": C.cyan,
  "PCB/材料": C.amber,
  "IC/記憶體": C.lavender,
  "被動元件": C.orange,
  "重電": C.up,
  "營建": C.olive,
  "精密機械": C.stone,
  "連接器": C.mint,
  "中國ETF": C.rose,
  "半導體設備": C.choco,
};

// ── 初始持倉 ────────────────────────────────────────────────────
const INIT_HOLDINGS = [
  { code:"00637L", name:"滬深300正2",    qty:141,  price:19.96, cost:18.99, value:2814,  pnl:134,   pct:5.01,   type:"ETF"  },
  { code:"039108", name:"禾伸堂元富57購", qty:8000, price:0.79,  cost:0.9925,value:6320,  pnl:-824,  pct:-10.35, type:"權證", expire:"2026/07", targetPrice:1.98 },
  { code:"053848", name:"亞翔凱基5B購",  qty:8000, price:2.23,  cost:1.81,  value:17840, pnl:3234,  pct:22.32,  type:"權證" },
  { code:"702157", name:"華星光元大58購",qty:4000, price:3.35,  cost:1.29,  value:13400, pnl:8167,  pct:157.66, type:"權證" },
  { code:"1503",   name:"士電",          qty:9,    price:205,   cost:229.5,  value:1845,  pnl:-227,  pct:-10.99, type:"股票" },
  { code:"1717",   name:"長興",          qty:43,   price:63.7,  cost:66.1,   value:2737,  pnl:-118,  pct:-4.15,  type:"股票" },
  { code:"2308",   name:"台達電",        qty:2,    price:1440,  cost:1287.5, value:2880,  pnl:293,   pct:11.37,  type:"股票" },
  { code:"2313",   name:"華通",          qty:40,   price:236.5, cost:187.5,  value:9457,  pnl:1920,  pct:25.58,  type:"股票" },
  { code:"2543",   name:"皇昌",          qty:6,    price:71.6,  cost:78.3,   value:429,   pnl:-43,   pct:-9.15,  type:"股票" },
  { code:"3006",   name:"晶豪科",        qty:12,   price:194.5, cost:164,    value:2334,  pnl:357,   pct:18.13,  type:"股票", alert:"⚡出場區間到" },
  { code:"3013",   name:"晟銘電",        qty:29,   price:99,    cost:125.91, value:2871,  pnl:-791,  pct:-21.65, type:"股票" },
  { code:"3017",   name:"奇鋐",          qty:2,    price:1905,  cost:1400,   value:3810,  pnl:997,   pct:35.59,  type:"股票" },
  { code:"3231",   name:"緯創",          qty:11,   price:134,   cost:134.55, value:1474,  pnl:-14,   pct:-0.94,  type:"股票" },
  { code:"3443",   name:"創意",          qty:3,    price:2290,  cost:2566.67,value:6870,  pnl:-854,  pct:-11.09, type:"股票" },
  { code:"3491",   name:"昇達科",        qty:3,    price:1445,  cost:1276.67,value:4335,  pnl:487,   pct:12.71,  type:"股票" },
  { code:"4583",   name:"台灣精銳",      qty:5,    price:629,   cost:734,    value:3145,  pnl:-536,  pct:-14.6,  type:"股票" },
  { code:"6274",   name:"台燿",          qty:3,    price:505,   cost:507,    value:1515,  pnl:-12,   pct:-0.79,  type:"股票", alert:"今日法說" },
  { code:"6770",   name:"力積電",        qty:20,   price:71.7,  cost:68.05,  value:1433,  pnl:63,    pct:4.62,   type:"股票" },
  { code:"6862",   name:"三集瑞-KY",     qty:17,   price:209.5, cost:197.82, value:3560,  pnl:182,   pct:5.41,   type:"股票" },
  { code:"8227",   name:"巨有科技",      qty:21,   price:128,   cost:146.57, value:2688,  pnl:-403,  pct:-13.08, type:"股票" },
];

const INIT_WATCHLIST = [
  { code:"1513", name:"中興電",  price:158.5, target:193,  status:"等Q4財報",  catalyst:"3–4月財報",      scKey:"amber", note:"積極163–165元；保守155–160元；催化：台電GIS+台積電" },
  { code:"4588", name:"玖鼎電力",price:69.1,  target:154,  status:"持有中",    catalyst:"台電電表訂單",    scKey:"olive", note:"訂單排到2028；現價已偏高不追；持有者繼續抱" },
  { code:"6274", name:"台燿",    price:505,   target:710,  status:"⚡今日法說", catalyst:"3/18法說+財報",  scKey:"up", note:"成本507；毛利率回沖→補足2/3；展望差→停損430" },
];

const RELAY_PLAN = {
  title: "2026 三檔接力投資計畫",
  summary: "晶豪科先收割，力積電等月營收確認，台燿走長波段。",
  thesis: [
    "晶豪科是 DDR3 短缺的第一棒，先吃 IC 設計端的漲價爆發。",
    "力積電是第二棒，等 2H26 代工費上漲反映到營收再加碼。",
    "台燿是第三棒，走 AI 伺服器 / ASIC / 產能擴張的中長線故事。",
  ],
  quickStates: [
    { label: "現在", text: "晶豪科 175–185 分批出；台燿 450–470 先進 1/3", tone: "up" },
    { label: "6–7月", text: "力積電等月營收年增顯著加速再加碼", tone: "amber" },
    { label: "全年", text: "台燿法說確認後續抱，主線看向 2027", tone: "blue" },
  ],
  legs: [
    {
      code: "3006",
      name: "晶豪科",
      role: "第一棒",
      tone: "up",
      status: "出場管理",
      window: "現在 - Q2 財報前",
      action: "175–185 元分批出，不等 200 元",
      trigger: "Q2 財報前 1–2 週最遲全部出清",
      stop: "148 元",
      bullets: [
        "DDR3 短缺題材爆發，4Q25 EPS 3.68 元遠超預期。",
        "2026 Q2 可能是獲利高峰，之後毛利率有被代工費擠壓風險。",
        "市場反應前先收割，避免高峰過後回吐。",
      ],
    },
    {
      code: "6770",
      name: "力積電",
      role: "第二棒",
      tone: "amber",
      status: "待命觀察",
      window: "晶豪科出場後 / 約 6–7 月",
      action: "看到月營收年增明顯加速再加碼",
      trigger: "DDR3 漲價開始反映到代工端財報",
      stop: "進場前重設技術停損",
      bullets: [
        "吃的是第二段：晶豪科上游漲價流入力積電營收。",
        "同一題材，但從成本端承壓切換到代工端受益。",
        "沒看到營收轉強前，先不急著加碼。",
      ],
    },
    {
      code: "6274",
      name: "台燿",
      role: "第三棒",
      tone: "blue",
      status: "分批布局",
      window: "現在 - 2027",
      action: "450–470 先進 1/3；法說後再決定是否補齊",
      trigger: "3/18 法說確認毛利率回沖與展望",
      stop: "430 元",
      bullets: [
        "AI 伺服器 CCL、800G 交換器與 ASIC 升級是主線。",
        "Q1→Q4 EPS 預估逐季加速，和晶豪科前高後低互補。",
        "若法說樂觀可補齊，若保守就縮小部位或停損觀望。",
      ],
    },
  ],
  riskMatrix: [
    { scenario: "全部如預期", action: "晶豪科 Q2 前出；力積電 6–7 月加碼；台燿續抱至 2027。" },
    { scenario: "晶豪科跌破 148", action: "立即停損，力積電先不加碼，台燿獨立評估。" },
    { scenario: "台燿法說保守", action: "不影響晶豪科 / 力積電主線，台燿縮小部位或停損 430。" },
    { scenario: "大盤系統性崩跌", action: "晶豪科先砍保現金，力積電零股不動，台燿嚴守 430。" },
  ],
  indicators: [
    { code: "3006", name: "晶豪科", when: "每月 10 日 / 5–6 月", what: "月營收是否維持高檔；市場是否提前反映 Q2 高峰。" },
    { code: "6770", name: "力積電", when: "6–7 月月營收", what: "年增率是否顯著加速（>30% 更有說服力）。" },
    { code: "6274", name: "台燿", when: "3/18 法說 / 每季財報 / 泰國二期", what: "毛利率回沖、EPS 是否逐季加速、產能是否如期達標。" },
  ],
  allocations: [
    { phase: "現在（3月）", target: "晶豪科", plan: "用緯創賣出資金，分批完成約 17 張部位。" },
    { phase: "現在（3月）", target: "台燿", plan: "新資金先進三分之一，法說後再決定補足。" },
    { phase: "6–7月後", target: "力積電 / 台燿", plan: "晶豪科獲利分流，一部分轉力積電，一部分視台燿法說補足。" },
  ],
};
const RELAY_PLAN_CODES = new Set(RELAY_PLAN.legs.map(item => item.code));

const EVENTS = [
  { date:"今日",    label:"台燿 6274 — Q4財報法說會",     sub:"毛利率+展望樂觀→補齊2/3；差→停損430",          urgent:true,  type:"法說" },
  { date:"今日",    label:"晶豪科 194.5元 — 超出場區間",  sub:"目標175–185元已超過，考慮今日分批賣出",         urgent:true,  type:"操作" },
  { date:"每月10日",label:"月營收公布",                   sub:"晶豪科最關鍵——確認DDR3高檔維持",               urgent:false, type:"營收" },
  { date:"3/15前",  label:"大型股全年財報",                sub:"台達電、奇鋐、創意、緯創",                      urgent:false, type:"財報" },
  { date:"4/1前",   label:"中小型股全年財報",              sub:"長興、華通、晟銘電、昇達科、台灣精銳、力積電",   urgent:false, type:"財報" },
  { date:"3–4月",   label:"中興電 Q4財報 + 法說",         sub:"催化劑：台電GIS發包 + 台積電訂單",              urgent:false, type:"催化" },
  { date:"Q2前",    label:"晶豪科 全數出場",               sub:"Q1財報前最遲出清；資金轉台燿/力積電",           urgent:false, type:"操作" },
  { date:"2026/07", label:"禾伸堂元富57購 到期",          sub:"目標獲利100%（約1.98元）；留意時間價值遞減",     urgent:false, type:"權證" },
  { date:"Q2",      label:"台燿 泰國二期產能確認",         sub:"月產能是否達260萬張（目標710元關鍵假設）",       urgent:false, type:"催化" },
  { date:"6–7月",   label:"力積電 加碼評估",               sub:"月營收年增>30%才加碼",                         urgent:false, type:"操作" },
  { date:"Q3起",    label:"緯創 VR爬坡",                  sub:"3Q26帶來4–5個月完整營收貢獻",                   urgent:false, type:"催化" },
  { date:"持續",    label:"美國關稅談判進度",              sub:"15%協議已達成；後續執行細節影響科技出口股",      urgent:false, type:"總經" },
  { date:"持續",    label:"Fed 利率政策",                  sub:"降息預期影響外資流向台股",                       urgent:false, type:"總經" },
];

// ── 事件分析資料庫 ────────────────────────────────────────────────
// status: "past"=已發生 / "pending"=未發生
// pred: "up"=預測漲 / "down"=預測跌 / "neutral"=中性
// actual: "up"/"down"/"neutral"/null（null=尚未驗證）
// correct: true/false/null
const NEWS_EVENTS = [
  // ── 已發生 ──
  {
    id:1, date:"2026/03/13", status:"past",
    title:"三星記憶體工人罷工威脅，DDR3 供給缺口擴大",
    detail:"三星韓國工廠工會威脅全面罷工，市場預期DRAM供給將進一步吃緊，利基型記憶體（DDR3）受矚目。",
    stocks:["晶豪科 3006"],
    pred:"up", predReason:"DDR3供給端收縮，晶豪科作為利基型記憶體IC設計受直接利多。",
    actual:"up", actualNote:"晶豪科連續兩日漲停，從161元急拉至177元，驗證預測正確。",
    correct:true,
  },
  {
    id:2, date:"2026/03/16", status:"past",
    title:"晶豪科 4Q25 EPS 3.68元，遠超市場預期 0.18元",
    detail:"華南投顧發出研究報告，揭露4Q25每股盈餘3.68元，市場預估僅0.18元，超預期約20倍。目標價200元。",
    stocks:["晶豪科 3006"],
    pred:"up", predReason:"財報大幅超預期是最強催化劑，法人勢必上調目標價，資金將快速湧入。",
    actual:"up", actualNote:"報告發出後三日股價從145元漲至194.5元，漲幅約34%。",
    correct:true,
  },
  {
    id:3, date:"2026/03/13", status:"past",
    title:"台燿 財報前外資連續賣超，股價從530跌至450",
    detail:"台燿3月初從高點583元修正，三大法人籌碼持續綠色，財報前賣壓明顯。",
    stocks:["台燿 6274"],
    pred:"down", predReason:"財報前獲利了結賣壓是常見型態，加上毛利率疑慮，短期壓力大。",
    actual:"down", actualNote:"股價從583跌至約450元，修正約25%，符合預測方向。",
    correct:true,
  },
  {
    id:4, date:"2026/03/16", status:"past",
    title:"台燿連兩日籌碼綠色但股價逆勢漲近10%",
    detail:"外資+自營商合計賣超，但散戶財報前卡位情緒推動股價接近漲停。",
    stocks:["台燿 6274"],
    pred:"up", predReason:"財報日前6天，散戶預期法說樂觀，提前卡位效應。",
    actual:"up", actualNote:"單日漲9.94%，收497.5元，驗證財報前卡位邏輯。",
    correct:true,
  },
  {
    id:5, date:"2026/03/16", status:"past",
    title:"緯創 4Q25 法說：毛利率受GB機櫃出貨組合壓縮",
    detail:"4Q25毛利率5.62%，QoQ降177bps，主因GB系列機櫃佔比提升。目標價從217元下調至195元。",
    stocks:["緯創 3231"],
    pred:"down", predReason:"目標價下調，毛利率不如預期，短期壓力。",
    actual:"down", actualNote:"法說後股價維持在134元附近偏弱，中信下調目標價至195元印證。",
    correct:true,
  },

  // ── 未發生 / 進行中 ──
  {
    id:6, date:"2026/03/18", status:"pending",
    title:"台燿 Q4財報法說會",
    detail:"關鍵觀察：毛利率是否確認回沖、AI CCL產品展望、泰國二期產能時程。",
    stocks:["台燿 6274"],
    pred:"up", predReason:"中信預估2026F EPS逐季加速（4.21→5.49→7.37→8.72），若法說確認此路徑，市場將重新定價。",
    actual:null, actualNote:"",
    correct:null,
  },
  {
    id:7, date:"2026/03–04月", status:"pending",
    title:"中興電 Q4全年財報公布",
    detail:"FactSet共識EPS 10.43元，7位分析師全數強力買進，目標價193.4元。台電GIS招標動向是關鍵。",
    stocks:["中興電 1513"],
    pred:"up", predReason:"財報若符合共識，加上台電基礎建設招標持續，股價有望從158.5元向193元靠攏。",
    actual:null, actualNote:"",
    correct:null,
  },
  {
    id:8, date:"2026/Q2", status:"pending",
    title:"晶豪科 Q2 EPS高峰季，毛利率55.7%預估",
    detail:"2026 Q2 EPS預估11.51元，為全年最高峰。力積電代工費2H26漲100%，毛利率將在Q3後回落至32–34%。",
    stocks:["晶豪科 3006"],
    pred:"up", predReason:"市場將在Q1財報後開始定價Q2高峰，股價有望提前反映。出場窗口在財報前1–2週。",
    actual:null, actualNote:"",
    correct:null,
  },
  {
    id:9, date:"2026/Q2", status:"pending",
    title:"台燿 泰國二期產能是否達260萬張月產",
    detail:"台燿目前月產能約178萬張，二期完工後目標260萬張，是2026年EPS加速的核心假設。",
    stocks:["台燿 6274"],
    pred:"up", predReason:"若如期達產，800G交換器與AI伺服器CCL訂單能見度大增，目標價710元更有說服力。",
    actual:null, actualNote:"",
    correct:null,
  },
  {
    id:10, date:"持續", status:"pending",
    title:"美國對台半導體關稅談判（15%協議後續執行）",
    detail:"台美已達成15%關稅協議，但執行細節與豁免清單仍在協商，科技出口股受牽連。",
    stocks:["奇鋐 3017","台達電 2308","緯創 3231","創意 3443"],
    pred:"neutral", predReason:"協議已達成降低最壞情境，但執行不確定性讓外資偏謹慎，短期偏中性到略偏空。",
    actual:null, actualNote:"",
    correct:null,
  },
  {
    id:11, date:"2026/07", status:"pending",
    title:"禾伸堂元富57購 到期",
    detail:"目前持倉8,000股，均成本0.9925元，目標翻倍（約1.98元）。權證無停損設定，時間價值越近到期遞減越快。",
    stocks:["禾伸堂 2481（標的）"],
    pred:"up", predReason:"被動元件族群動能上來，禾伸堂本股動能啟動。但須在Q2前確認趨勢，否則時間成本侵蝕獲利空間。",
    actual:null, actualNote:"",
    correct:null,
  },
  {
    id:12, date:"2026/Q3", status:"pending",
    title:"緯創 VR 系列爬坡（NV Vera Rubin）",
    detail:"VR系列減少線材組裝、組裝性更佳，預計3Q26開始帶來4–5個月完整營收貢獻，ASP將上揚。",
    stocks:["緯創 3231"],
    pred:"up", predReason:"若爬坡如期，3Q26起營收加速，毛利率組合改善，現價134元相對目標195元仍有空間。",
    actual:null, actualNote:"",
    correct:null,
  },
];


// ── 配色系統 ──────────────────────────────────────────────────────
const TYPE_COLOR = {
  法說: C.up,
  財報: C.teal,
  營收: C.olive,
  催化: C.amber,
  操作: C.text,
  總經: C.lavender,
  權證: C.choco,
};

const MEMO_Q = {
  "買進": ["為什麼選這檔？核心邏輯是什麼？", "進場的技術或籌碼依據？", "出場計畫：目標價？停損價？"],
  "賣出": ["為什麼在這個價位賣？", "達成原本預期了嗎？", "這筆資金的下一步？"],
};

const PARSE_PROMPT = `你是台股券商成交回報截圖的解析器。解析截圖中的交易，以JSON格式輸出，不輸出其他文字：
{"trades":[{"action":"買進或賣出","code":"代碼","name":"名稱","qty":股數,"price":成交價,"amount":金額或null}],"targetPriceUpdates":[{"code":"代碼","firm":"券商名稱","target":目標價數字,"date":"日期"}],"note":"有疑問時說明"}
targetPriceUpdates：如果截圖中有提到分析師目標價或研究報告目標價，請一併擷取。否則為空陣列。`;

// ── helpers ─────────────────────────────────────────────────────
// 台股慣例：紅=漲/獲利，綠=跌/虧損（莫蘭迪版）
const pc    = (p) => p==null ? C.textMute : p>=0 ? C.up : C.down;
const pcBg  = (p) => p==null ? "transparent" : p>=0 ? C.upBg : C.downBg;
const fmtN  = (n) => n==null?"—":Math.abs(n)>=10000?(n/10000).toFixed(1)+"萬":n.toLocaleString();
const card  = {
  background:C.card,
  border:`1px solid ${C.border}`,
  borderRadius:10,
  padding:"12px 14px",
  boxShadow:`${C.insetLine}, ${C.shadow}`,
};
const lbl   = { fontSize:10, color:C.textMute, letterSpacing:"0.06em", fontWeight:600, marginBottom:5 };
const ghostBtn = {
  borderRadius:20,
  padding:"4px 11px",
  fontSize:9,
  fontWeight:500,
  cursor:"pointer",
  whiteSpace:"nowrap",
  transition:"all 0.18s ease",
};
const metricCard = {
  background:C.card,
  border:`1px solid ${C.border}`,
  borderRadius:8,
  padding:"8px 11px",
  boxShadow:`${C.insetLine}, ${C.shadow}`,
};
const CLOUD_SYNC_TTL = 1000 * 60 * 30;
const CLOUD_SAVE_DEBOUNCE = 1000 * 20;
const OWNER_PORTFOLIO_ID = "me";
const PORTFOLIO_VIEW_MODE = "portfolio";
const OVERVIEW_VIEW_MODE = "overview";
const CURRENT_SCHEMA_VERSION = 2;
const PORTFOLIOS_KEY = "pf-portfolios-v1";
const ACTIVE_PORTFOLIO_KEY = "pf-active-portfolio-v1";
const VIEW_MODE_KEY = "pf-view-mode-v1";
const SCHEMA_VERSION_KEY = "pf-schema-version";
const GLOBAL_SYNC_KEYS = [
  "pf-cloud-sync-at",
  "pf-analysis-cloud-sync-at",
  "pf-research-cloud-sync-at",
];
const GLOBAL_SYNC_KEY_SET = new Set(GLOBAL_SYNC_KEYS);
const BACKUP_GLOBAL_KEYS = [
  PORTFOLIOS_KEY,
  ACTIVE_PORTFOLIO_KEY,
  VIEW_MODE_KEY,
  SCHEMA_VERSION_KEY,
];
const BACKUP_GLOBAL_KEY_SET = new Set(BACKUP_GLOBAL_KEYS);
const DEFAULT_PORTFOLIO_NOTES = {
  riskProfile: "",
  preferences: "",
  customNotes: "",
};
const EVENT_HISTORY_LIMIT = 90;
const DEFAULT_REVIEW_FORM = {
  actual: "up",
  actualNote: "",
  lessons: "",
  exitDate: null,
  priceAtExit: null,
};
const DEFAULT_NEW_EVENT = {
  date: "",
  title: "",
  detail: "",
  stocks: "",
  pred: "up",
  predReason: "",
};
const PORTFOLIO_STORAGE_FIELDS = [
  { suffix: "holdings-v2", alias: "holdings", ownerFallback: () => INIT_HOLDINGS, emptyFallback: () => [] },
  { suffix: "log-v2", alias: "tradeLog", ownerFallback: () => [], emptyFallback: () => [] },
  { suffix: "targets-v1", alias: "targets", ownerFallback: () => INIT_TARGETS, emptyFallback: () => ({}) },
  { suffix: "watchlist-v1", alias: "watchlist", ownerFallback: () => normalizeWatchlist(INIT_WATCHLIST), emptyFallback: () => [], hasLegacy: false },
  { suffix: "news-events-v1", alias: "newsEvents", ownerFallback: () => NEWS_EVENTS, emptyFallback: () => [] },
  { suffix: "analysis-history-v1", alias: "analysisHistory", ownerFallback: () => [], emptyFallback: () => [] },
  { suffix: "daily-report-v1", alias: "dailyReport", ownerFallback: () => null, emptyFallback: () => null },
  { suffix: "reversal-v1", alias: "reversalConditions", ownerFallback: () => ({}), emptyFallback: () => ({}) },
  { suffix: "brain-v1", alias: "strategyBrain", ownerFallback: () => null, emptyFallback: () => null },
  { suffix: "research-history-v1", alias: "researchHistory", ownerFallback: () => [], emptyFallback: () => [] },
  { suffix: "notes-v1", alias: "portfolioNotes", ownerFallback: () => ({ ...DEFAULT_PORTFOLIO_NOTES }), emptyFallback: () => ({ ...DEFAULT_PORTFOLIO_NOTES }), hasLegacy: false },
];
const PORTFOLIO_SUFFIX_TO_FIELD = Object.fromEntries(PORTFOLIO_STORAGE_FIELDS.map(item => [item.suffix, item]));
const PORTFOLIO_ALIAS_TO_SUFFIX = Object.fromEntries(PORTFOLIO_STORAGE_FIELDS.map(item => [item.alias, item.suffix]));
const LEGACY_STORAGE_KEYS = PORTFOLIO_STORAGE_FIELDS
  .filter(item => item.hasLegacy !== false)
  .map(item => `pf-${item.suffix}`);
const GLOBAL_STORAGE_KEYS = [
  ...BACKUP_GLOBAL_KEYS,
  ...GLOBAL_SYNC_KEYS,
];
const CLOSED_EVENT_STATUSES = new Set(["past", "closed"]);

function todayStorageDate() {
  return new Date().toISOString().slice(0, 10);
}

function createDefaultPortfolios() {
  return [{ id: OWNER_PORTFOLIO_ID, name: "我", isOwner: true, createdAt: todayStorageDate() }];
}

function clonePortfolioNotes() {
  return { ...DEFAULT_PORTFOLIO_NOTES };
}

function createEmptyStrategyBrain() {
  return {
    rules: [],
    lessons: [],
    commonMistakes: [],
    stats: {},
    lastUpdate: null,
    coachLessons: [],
  };
}

function normalizeStrategyBrain(value, { allowEmpty = false } = {}) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return allowEmpty ? createEmptyStrategyBrain() : null;
  }

  const normalized = createEmptyStrategyBrain();
  normalized.rules = Array.isArray(value.rules) ? value.rules.filter(Boolean) : [];
  normalized.lessons = Array.isArray(value.lessons)
    ? value.lessons
      .filter(item => item && typeof item.text === "string" && item.text.trim())
      .map(item => ({ date: item.date || toSlashDate(), text: item.text.trim() }))
    : [];
  normalized.commonMistakes = Array.isArray(value.commonMistakes) ? value.commonMistakes.filter(Boolean) : [];
  normalized.stats = value.stats && typeof value.stats === "object" && !Array.isArray(value.stats) ? { ...value.stats } : {};
  normalized.lastUpdate = typeof value.lastUpdate === "string" ? value.lastUpdate : null;
  normalized.coachLessons = Array.isArray(value.coachLessons)
    ? value.coachLessons
      .filter(item => item && typeof item.text === "string" && item.text.trim())
      .map(item => ({
        date: item.date || toSlashDate(),
        text: item.text.trim(),
        source: item.source || "",
        sourcePortfolioId: item.sourcePortfolioId || "",
        sourceEventId: item.sourceEventId ?? null,
      }))
    : [];

  const hasContent =
    normalized.rules.length > 0 ||
    normalized.lessons.length > 0 ||
    normalized.commonMistakes.length > 0 ||
    normalized.coachLessons.length > 0 ||
    Object.keys(normalized.stats).length > 0 ||
    Boolean(normalized.lastUpdate);

  return hasContent || allowEmpty ? normalized : null;
}

function mergeBrainPreservingCoachLessons(nextBrain, currentBrain) {
  const normalizedNext = normalizeStrategyBrain(nextBrain, { allowEmpty: true });
  const normalizedCurrent = normalizeStrategyBrain(currentBrain, { allowEmpty: true });
  const coachLessons = normalizedNext?.coachLessons?.length
    ? normalizedNext.coachLessons
    : (normalizedCurrent?.coachLessons || []);

  if (!normalizedNext) {
    if (!coachLessons.length) return null;
    return {
      ...createEmptyStrategyBrain(),
      coachLessons,
    };
  }

  return {
    ...normalizedNext,
    coachLessons,
  };
}

function formatPortfolioNotesContext(notes) {
  const normalized = notes && typeof notes === "object" ? { ...DEFAULT_PORTFOLIO_NOTES, ...notes } : DEFAULT_PORTFOLIO_NOTES;
  const lines = [
    normalized.riskProfile ? `風險屬性：${normalized.riskProfile}` : null,
    normalized.preferences ? `操作偏好：${normalized.preferences}` : null,
    normalized.customNotes ? `自訂備註：${normalized.customNotes}` : null,
  ].filter(Boolean);
  return lines.length > 0 ? `個人備註：\n${lines.join("\n")}` : "個人備註：無";
}

function normalizeWatchlist(value) {
  if (!Array.isArray(value)) return [];
  return value
    .map(item => {
      if (!item || typeof item !== "object") return null;
      const code = String(item.code || "").trim();
      const name = String(item.name || "").trim();
      if (!code || !name) return null;
      const price = Number(item.price);
      const target = Number(item.target);
      return {
        code,
        name,
        price: Number.isFinite(price) && price > 0 ? price : 0,
        target: Number.isFinite(target) && target > 0 ? target : 0,
        status: typeof item.status === "string" ? item.status : "",
        catalyst: typeof item.catalyst === "string" ? item.catalyst : "",
        scKey: typeof item.scKey === "string" ? item.scKey : "blue",
        note: typeof item.note === "string" ? item.note : "",
      };
    })
    .filter(Boolean);
}

function createDefaultReviewForm(overrides = {}) {
  return { ...DEFAULT_REVIEW_FORM, ...overrides };
}

function createDefaultEventDraft(overrides = {}) {
  return { ...DEFAULT_NEW_EVENT, ...overrides };
}

function isClosedEvent(event) {
  return CLOSED_EVENT_STATUSES.has(event?.status);
}

function toSlashDate(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}/${month}/${day}`;
}

function parseSlashDate(value) {
  const match = String(value || "").trim().match(/^(\d{4})\/(\d{2})\/(\d{2})$/);
  if (!match) return null;
  const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  if (
    date.getFullYear() !== Number(match[1]) ||
    date.getMonth() !== Number(match[2]) - 1 ||
    date.getDate() !== Number(match[3])
  ) return null;
  date.setHours(0, 0, 0, 0);
  return date;
}

function daysBetween(fromValue, toValue = new Date()) {
  const from = fromValue instanceof Date ? new Date(fromValue) : parseSlashDate(fromValue);
  const to = toValue instanceof Date ? new Date(toValue) : parseSlashDate(toValue);
  if (!from || !to) return null;
  from.setHours(0, 0, 0, 0);
  to.setHours(0, 0, 0, 0);
  return Math.round((to - from) / (1000 * 60 * 60 * 24));
}

function getEventStockCodes(event) {
  return Array.from(new Set(
    (event?.stocks || [])
      .map(stock => String(stock).match(/\d{4,6}[A-Z]?L?/i)?.[0] || null)
      .filter(Boolean)
  ));
}

function normalizePriceRecord(value, event) {
  if (value == null) return null;
  if (typeof value === "number" && Number.isFinite(value)) {
    const codes = getEventStockCodes(event);
    return codes.length === 1 ? { [codes[0]]: value } : null;
  }
  if (typeof value !== "object" || Array.isArray(value)) return null;
  const entries = Object.entries(value)
    .map(([code, price]) => [code, Number(price)])
    .filter(([, price]) => Number.isFinite(price) && price > 0);
  return entries.length > 0 ? Object.fromEntries(entries) : null;
}

function normalizePriceHistory(value, event) {
  if (!Array.isArray(value)) return [];
  return value
    .map(entry => {
      if (!entry || typeof entry !== "object") return null;
      const date = typeof entry.date === "string" ? entry.date : null;
      const prices = normalizePriceRecord(entry.prices, event);
      if (!date || !prices) return null;
      return { date, prices };
    })
    .filter(Boolean)
    .slice(-EVENT_HISTORY_LIMIT);
}

function averagePriceRecord(value) {
  const prices = Object.values(value || {})
    .map(Number)
    .filter(price => Number.isFinite(price) && price > 0);
  if (prices.length === 0) return null;
  return prices.reduce((sum, price) => sum + price, 0) / prices.length;
}

function inferEventActual(priceAtEvent, priceAtExit) {
  const entryAvg = averagePriceRecord(priceAtEvent);
  const exitAvg = averagePriceRecord(priceAtExit);
  if (!entryAvg || !exitAvg) return null;
  const pct = ((exitAvg / entryAvg) - 1) * 100;
  if (Math.abs(pct) <= 1) return "neutral";
  return pct > 0 ? "up" : "down";
}

function appendPriceHistory(history, date, prices) {
  const next = Array.isArray(history) ? [...history] : [];
  const idx = next.findIndex(item => item?.date === date);
  const record = { date, prices };
  if (idx >= 0) next[idx] = record;
  else next.push(record);
  return next.slice(-EVENT_HISTORY_LIMIT);
}

function normalizeEventRecord(event) {
  if (!event || typeof event !== "object") return null;
  const status = event.status === "tracking" ? "tracking" : isClosedEvent(event) ? "closed" : "pending";
  const priceAtEvent = normalizePriceRecord(event.priceAtEvent, event);
  const priceAtExit = normalizePriceRecord(event.priceAtExit, event);
  const reviewDate = event.reviewDate || null;
  const eventDate = event.eventDate || (status === "closed" ? event.date || reviewDate || null : null);
  const trackingStart = event.trackingStart || eventDate || null;
  const exitDate = event.exitDate || (status === "closed" ? reviewDate || null : null);
  const actual = ["up", "down", "neutral"].includes(event.actual) ? event.actual : inferEventActual(priceAtEvent, priceAtExit);

  return {
    ...event,
    status,
    stocks: Array.isArray(event.stocks) ? event.stocks.filter(Boolean) : [],
    eventDate,
    trackingStart,
    exitDate,
    priceAtEvent,
    priceAtExit,
    priceHistory: normalizePriceHistory(event.priceHistory, event),
    actual: actual || null,
    actualNote: event.actualNote || "",
    correct: typeof event.correct === "boolean" ? event.correct : null,
    lessons: event.lessons || "",
    reviewDate,
  };
}

function normalizeNewsEvents(items) {
  return (Array.isArray(items) ? items : [])
    .map(normalizeEventRecord)
    .filter(Boolean);
}

function normalizePortfolios(value) {
  const source = Array.isArray(value) ? value : [];
  const normalized = [];
  const seen = new Set();

  for (const item of source) {
    if (!item || typeof item.id !== "string" || typeof item.name !== "string" || seen.has(item.id)) continue;
    seen.add(item.id);
    normalized.push({
      id: item.id,
      name: item.name,
      isOwner: item.id === OWNER_PORTFOLIO_ID ? true : Boolean(item.isOwner),
      createdAt: item.createdAt || todayStorageDate(),
    });
  }

  if (!seen.has(OWNER_PORTFOLIO_ID)) {
    normalized.unshift(...createDefaultPortfolios());
  }

  return normalized.length > 0 ? normalized : createDefaultPortfolios();
}

function pfKey(pid, suffix) {
  return `pf-${pid}-${suffix}`;
}

function getEmptyFallback(suffix) {
  const field = PORTFOLIO_SUFFIX_TO_FIELD[suffix];
  return field ? field.emptyFallback() : null;
}

function getPortfolioFallback(pid, suffix) {
  const field = PORTFOLIO_SUFFIX_TO_FIELD[suffix];
  if (!field) return null;
  return (pid === OWNER_PORTFOLIO_ID ? field.ownerFallback : field.emptyFallback)();
}

async function load(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch { return fallback; }
}
async function save(key, data) {
  try { localStorage.setItem(key, JSON.stringify(data)); } catch {}
}
const readSyncAt = (key) => {
  try { return Number(localStorage.getItem(key) || 0); } catch { return 0; }
};
const writeSyncAt = (key, value) => {
  try { localStorage.setItem(key, String(value)); } catch {}
};

async function savePortfolioData(pid, suffix, data) {
  return save(pfKey(pid, suffix), data);
}

function removePortfolioData(pid) {
  for (const field of PORTFOLIO_STORAGE_FIELDS) {
    try { localStorage.removeItem(pfKey(pid, field.suffix)); } catch {}
  }
}

async function loadPortfolioData(pid, suffix, fallback) {
  return load(pfKey(pid, suffix), fallback);
}

async function loadForPortfolio(pid, suffix) {
  return loadPortfolioData(pid, suffix, getPortfolioFallback(pid, suffix));
}

function readStorageValue(key) {
  const raw = localStorage.getItem(key);
  if (raw == null) return undefined;
  try { return JSON.parse(raw); } catch { return raw; }
}

function collectPortfolioBackupStorage() {
  const storage = {};
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (!key || !key.startsWith("pf-")) continue;
    if (GLOBAL_SYNC_KEY_SET.has(key)) continue;
    if (
      !BACKUP_GLOBAL_KEY_SET.has(key) &&
      !PORTFOLIO_STORAGE_FIELDS.some(item => key.endsWith(`-${item.suffix}`))
    ) continue;
    storage[key] = readStorageValue(key);
  }
  return storage;
}

function normalizeImportedStorageKey(rawKey) {
  if (GLOBAL_SYNC_KEY_SET.has(rawKey)) return null;
  if (BACKUP_GLOBAL_KEY_SET.has(rawKey)) return rawKey;
  if (PORTFOLIO_ALIAS_TO_SUFFIX[rawKey]) return pfKey(OWNER_PORTFOLIO_ID, PORTFOLIO_ALIAS_TO_SUFFIX[rawKey]);

  const legacyField = PORTFOLIO_STORAGE_FIELDS.find(item => item.hasLegacy !== false && `pf-${item.suffix}` === rawKey);
  if (legacyField) return pfKey(OWNER_PORTFOLIO_ID, legacyField.suffix);

  if (rawKey.startsWith("pf-") && PORTFOLIO_STORAGE_FIELDS.some(item => rawKey.endsWith(`-${item.suffix}`))) {
    return rawKey;
  }

  return null;
}

function downloadJson(filename, payload) {
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

function normalizeBackupStorage(payload) {
  if (!payload) return null;

  if (Array.isArray(payload)) {
    const looksLikeHistory = payload.every(item => item && typeof item === "object" && (item.id != null || item.date || item.aiInsight));
    return looksLikeHistory ? { [pfKey(OWNER_PORTFOLIO_ID, "analysis-history-v1")]: payload } : null;
  }

  if (typeof payload !== "object") return null;

  if (payload.storage && typeof payload.storage === "object" && !Array.isArray(payload.storage)) {
    return normalizeBackupStorage(payload.storage);
  }

  const mapEntries = (source) => {
    const mapped = {};
    for (const [rawKey, value] of Object.entries(source || {})) {
      const key = normalizeImportedStorageKey(rawKey);
      if (key) mapped[key] = value;
    }
    return mapped;
  };

  if (payload.data && typeof payload.data === "object" && !Array.isArray(payload.data)) {
    const mapped = mapEntries(payload.data);
    if (Object.keys(mapped).length > 0) return mapped;
  }

  const directMapped = mapEntries(payload);
  if (Object.keys(directMapped).length > 0) return directMapped;

  const looksLikeBrain = Array.isArray(payload.rules) || Array.isArray(payload.lessons) || Array.isArray(payload.commonMistakes) || Array.isArray(payload.coachLessons) || payload.stats;
  if (looksLikeBrain) return { [pfKey(OWNER_PORTFOLIO_ID, "brain-v1")]: payload };

  const looksLikeDailyReport = payload.totalTodayPnl != null || Array.isArray(payload.changes) || typeof payload.aiInsight === "string";
  if (looksLikeDailyReport) {
    return {
      [pfKey(OWNER_PORTFOLIO_ID, "daily-report-v1")]: payload,
      [pfKey(OWNER_PORTFOLIO_ID, "analysis-history-v1")]: [payload],
    };
  }

  return null;
}

function extractPortfolioIdsFromStorage(storage) {
  const ids = new Set([OWNER_PORTFOLIO_ID]);
  for (const key of Object.keys(storage || {})) {
    for (const field of PORTFOLIO_STORAGE_FIELDS) {
      const suffix = `-${field.suffix}`;
      if (!key.startsWith("pf-") || !key.endsWith(suffix)) continue;
      const pid = key.slice(3, -suffix.length);
      if (pid) ids.add(pid);
      break;
    }
  }
  return Array.from(ids);
}

function buildPortfoliosFromStorage(storage) {
  const existing = normalizePortfolios(storage?.[PORTFOLIOS_KEY]);
  const byId = new Map(existing.map(item => [item.id, item]));
  const ids = extractPortfolioIdsFromStorage(storage);

  return ids.map(id => (
    byId.get(id) || {
      id,
      name: id === OWNER_PORTFOLIO_ID ? "我" : id,
      isOwner: id === OWNER_PORTFOLIO_ID,
      createdAt: todayStorageDate(),
    }
  ));
}

async function migrateLegacyPortfolioStorageIfNeeded() {
  const currentVersion = await load(SCHEMA_VERSION_KEY, null);
  const hasLegacyData = LEGACY_STORAGE_KEYS.some(key => localStorage.getItem(key) != null);
  if (currentVersion === CURRENT_SCHEMA_VERSION || !hasLegacyData) return false;

  await save(PORTFOLIOS_KEY, createDefaultPortfolios());
  await save(ACTIVE_PORTFOLIO_KEY, OWNER_PORTFOLIO_ID);
  await save(VIEW_MODE_KEY, PORTFOLIO_VIEW_MODE);

  for (const field of PORTFOLIO_STORAGE_FIELDS) {
    if (field.hasLegacy === false) continue;
    const legacyKey = `pf-${field.suffix}`;
    const raw = localStorage.getItem(legacyKey);
    if (raw == null) continue;
    await savePortfolioData(OWNER_PORTFOLIO_ID, field.suffix, readStorageValue(legacyKey));
    localStorage.removeItem(legacyKey);
  }

  const migratedEvents = await loadPortfolioData(OWNER_PORTFOLIO_ID, "news-events-v1", []);
  if (Array.isArray(migratedEvents) && migratedEvents.length > 0) {
    await savePortfolioData(OWNER_PORTFOLIO_ID, "news-events-v1", migratedEvents.map(event => ({
      ...event,
      status: event.status === "past" ? "closed" : event.status,
      ...(event.status === "past" ? {
        eventDate: event.date,
        trackingStart: event.reviewDate || event.date,
        exitDate: event.reviewDate || null,
        priceAtEvent: null,
        priceAtExit: null,
        priceHistory: [],
      } : {}),
    })));
  }

  await save(SCHEMA_VERSION_KEY, CURRENT_SCHEMA_VERSION);
  return true;
}

async function ensurePortfolioRegistry() {
  const storedPortfolios = await load(PORTFOLIOS_KEY, null);
  const portfolios = normalizePortfolios(storedPortfolios);
  if (!storedPortfolios || JSON.stringify(storedPortfolios) !== JSON.stringify(portfolios)) {
    await save(PORTFOLIOS_KEY, portfolios);
  }

  let activePortfolioId = await load(ACTIVE_PORTFOLIO_KEY, OWNER_PORTFOLIO_ID);
  if (typeof activePortfolioId !== "string" || !portfolios.some(item => item.id === activePortfolioId)) {
    activePortfolioId = OWNER_PORTFOLIO_ID;
    await save(ACTIVE_PORTFOLIO_KEY, activePortfolioId);
  }

  let viewMode = await load(VIEW_MODE_KEY, PORTFOLIO_VIEW_MODE);
  if (viewMode !== PORTFOLIO_VIEW_MODE && viewMode !== OVERVIEW_VIEW_MODE) {
    viewMode = PORTFOLIO_VIEW_MODE;
  }
  // overview mode UI 還沒落地前，先固定回 portfolio，避免匯入後卡在唯讀模式
  if (viewMode !== PORTFOLIO_VIEW_MODE) {
    viewMode = PORTFOLIO_VIEW_MODE;
  }
  await save(VIEW_MODE_KEY, viewMode);

  const schemaVersion = await load(SCHEMA_VERSION_KEY, null);
  if (schemaVersion !== CURRENT_SCHEMA_VERSION) {
    await save(SCHEMA_VERSION_KEY, CURRENT_SCHEMA_VERSION);
  }

  return { portfolios, activePortfolioId, viewMode };
}

async function loadPortfolioSnapshot(pid) {
  const snapshot = {};
  for (const field of PORTFOLIO_STORAGE_FIELDS) {
    snapshot[field.alias] = await loadForPortfolio(pid, field.suffix);
  }
  return snapshot;
}

// ── Main ─────────────────────────────────────────────────────────
export default function App() {
  const [tab, setTab]     = useState("holdings");
  const [ready, setReady] = useState(false);
  const [portfolios, setPortfolios] = useState(() => createDefaultPortfolios());
  const [activePortfolioId, setActivePortfolioId] = useState(OWNER_PORTFOLIO_ID);
  const [viewMode, setViewMode] = useState(PORTFOLIO_VIEW_MODE);

  // persistent state
  const [holdings,  setHoldings]  = useState(null);
  const [tradeLog,  setTradeLog]  = useState(null);
  const [targets,   setTargets]   = useState(null);
  const [watchlist, setWatchlist] = useState(null);

  // upload / memo
  const [img, setImg]           = useState(null);
  const [b64, setB64]           = useState(null);
  const [parsing, setParsing]   = useState(false);
  const [parsed,  setParsed]    = useState(null);
  const [parseErr,setParseErr]  = useState(null);
  const [dragOver,setDragOver]  = useState(false);
  const [memoStep,setMemoStep]  = useState(0);
  const [memoAns, setMemoAns]   = useState([]);
  const [memoIn,  setMemoIn]    = useState("");
  const [saved,   setSaved]     = useState("");

  // dashboard UI
  const [sortBy,      setSortBy]      = useState("value");
  const [scanQuery,   setScanQuery]   = useState("");
  const [scanFilter,  setScanFilter]  = useState("全部");
  const [filterType,  setFilterType]  = useState("全部");
  const [showAll,     setShowAll]     = useState(false);
  const [showReversal, setShowReversal] = useState(false);
  const [dailyExpanded, setDailyExpanded] = useState(false);
  const [expandedStock, setExpandedStock] = useState(null);
  const [expandedNews, setExpandedNews] = useState(new Set());
  const toggleNews = (id) => setExpandedNews(prev => {
    const s = new Set(prev); s.has(id) ? s.delete(id) : s.add(id); return s;
  });
  const [tpCode, setTpCode] = useState("");
  const [tpFirm, setTpFirm] = useState("");
  const [tpVal,  setTpVal]  = useState("");

  // refresh prices
  const [refreshing, setRefreshing] = useState(false);
  const [lastUpdate, setLastUpdate] = useState(null);

  // daily analysis
  const [analyzing, setAnalyzing]       = useState(false);
  const [analyzeStep, setAnalyzeStep]   = useState("");
  const [dailyReport, setDailyReport]   = useState(null);
  const [analysisHistory, setAnalysisHistory] = useState(null);
  const [newsEvents, setNewsEvents]     = useState(null);
  const [reviewingEvent, setReviewingEvent] = useState(null);
  const [reviewForm, setReviewForm]     = useState(() => createDefaultReviewForm());
  const [showAddEvent, setShowAddEvent] = useState(false);
  const [newEvent, setNewEvent]         = useState(() => createDefaultEventDraft());
  const [calendarMonth, setCalendarMonth] = useState(() => { const d = new Date(); return { year: d.getFullYear(), month: d.getMonth() }; });
  const [showCalendar, setShowCalendar] = useState(false);
  const [reversalConditions, setReversalConditions] = useState(null);
  const [strategyBrain, setStrategyBrain] = useState(null);
  const [portfolioNotes, setPortfolioNotes] = useState(() => clonePortfolioNotes());
  const [cloudSync, setCloudSync]         = useState(false);
  const [portfolioSwitching, setPortfolioSwitching] = useState(false);
  const [showPortfolioManager, setShowPortfolioManager] = useState(false);
  const [relayPlanExpanded, setRelayPlanExpanded] = useState(false);
  // AutoResearch state（必須在 useEffect 之前宣告）
  const [researching, setResearching] = useState(false);
  const [researchTarget, setResearchTarget] = useState(null);
  const [researchResults, setResearchResults] = useState(null);
  const [researchHistory, setResearchHistory] = useState(null);
  const portfolioTransitionRef = useRef({
    isHydrating: false,
    fromPid: OWNER_PORTFOLIO_ID,
    toPid: OWNER_PORTFOLIO_ID,
  });
  const eventLifecycleSyncRef = useRef(false);
  const cloudSaveTimersRef = useRef({});
  const cloudSyncStateRef = useRef({ enabled: false, syncedAt: 0 });
  const backupFileInputRef = useRef(null);
  const deferredQuery = useDeferredValue(scanQuery);
  const isImeComposing = (ev) => ev.nativeEvent?.isComposing || ev.keyCode === 229;
  const canPersistPortfolioData = ready && viewMode === PORTFOLIO_VIEW_MODE && !portfolioTransitionRef.current.isHydrating;
  const canUseCloud = viewMode === PORTFOLIO_VIEW_MODE && activePortfolioId === OWNER_PORTFOLIO_ID;
  const applyPortfolioSnapshot = (snapshot) => {
    setHoldings(snapshot.holdings);
    setTradeLog(snapshot.tradeLog);
    setTargets(snapshot.targets);
    setWatchlist(normalizeWatchlist(snapshot.watchlist));
    setNewsEvents(normalizeNewsEvents(snapshot.newsEvents));
    setAnalysisHistory(snapshot.analysisHistory);
    setReversalConditions(snapshot.reversalConditions);
    setStrategyBrain(normalizeStrategyBrain(snapshot.strategyBrain));
    setResearchHistory(snapshot.researchHistory);
    setPortfolioNotes(snapshot.portfolioNotes || clonePortfolioNotes());
    setDailyReport(snapshot.dailyReport || (snapshot.analysisHistory && snapshot.analysisHistory.length > 0 ? snapshot.analysisHistory[0] : null));
  };
  const setCloudStateForPortfolio = (pid, nextViewMode = PORTFOLIO_VIEW_MODE) => {
    const enabled = nextViewMode === PORTFOLIO_VIEW_MODE && pid === OWNER_PORTFOLIO_ID;
    cloudSyncStateRef.current = {
      enabled,
      syncedAt: enabled ? readSyncAt("pf-cloud-sync-at") : 0,
    };
    setCloudSync(enabled);
  };
  const scheduleCloudSave = (action, data, successMsg) => {
    if (!cloudSyncStateRef.current.enabled) return;
    clearTimeout(cloudSaveTimersRef.current[action]);
    cloudSaveTimersRef.current[action] = setTimeout(async () => {
      try {
        await fetch("/api/brain", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action, data })
        });
        const now = Date.now();
        cloudSyncStateRef.current.syncedAt = now;
        writeSyncAt("pf-cloud-sync-at", now);
        if (successMsg) {
          setSaved(successMsg);
          setTimeout(() => setSaved(""), 2000);
        }
      } catch {}
    }, CLOUD_SAVE_DEBOUNCE);
  };
  const flushCurrentPortfolio = async (pid = activePortfolioId) => {
    if (!ready || viewMode !== PORTFOLIO_VIEW_MODE || !pid) return;
    const liveSnapshot = {
      holdings,
      tradeLog,
      targets,
      watchlist,
      newsEvents,
      analysisHistory,
      dailyReport,
      reversalConditions,
      strategyBrain,
      researchHistory,
      portfolioNotes,
    };
    await Promise.all(
      Object.entries(liveSnapshot)
        .map(([alias, value]) => {
          const suffix = PORTFOLIO_ALIAS_TO_SUFFIX[alias];
          return suffix ? savePortfolioData(pid, suffix, value) : null;
        })
        .filter(Boolean)
    );
    await save(ACTIVE_PORTFOLIO_KEY, pid);
    await save(VIEW_MODE_KEY, PORTFOLIO_VIEW_MODE);
  };
  const resetTransientUiState = () => {
    setImg(null);
    setB64(null);
    setParsing(false);
    setParsed(null);
    setParseErr(null);
    setDragOver(false);
    setMemoStep(0);
    setMemoAns([]);
    setMemoIn("");
    setDailyExpanded(false);
    setExpandedStock(null);
    setExpandedNews(new Set());
    setReviewingEvent(null);
    setReviewForm(createDefaultReviewForm());
    setShowAddEvent(false);
    setNewEvent(createDefaultEventDraft());
    setResearchTarget(null);
    setResearchResults(null);
    setTpCode("");
    setTpFirm("");
    setTpVal("");
    setRelayPlanExpanded(false);
  };
  const loadPortfolio = async (pid, nextViewMode = PORTFOLIO_VIEW_MODE) => {
    const snapshot = await loadPortfolioSnapshot(pid);
    setActivePortfolioId(pid);
    setViewMode(nextViewMode);
    applyPortfolioSnapshot(snapshot);
    setCloudStateForPortfolio(pid, nextViewMode);
    return snapshot;
  };
  const switchPortfolio = async (pid) => {
    if (!pid || portfolioSwitching) return;
    if (pid === activePortfolioId && viewMode === PORTFOLIO_VIEW_MODE) return;

    setPortfolioSwitching(true);
    portfolioTransitionRef.current = {
      isHydrating: true,
      fromPid: activePortfolioId,
      toPid: pid,
    };

    try {
      await flushCurrentPortfolio();
      resetTransientUiState();
      await save(VIEW_MODE_KEY, PORTFOLIO_VIEW_MODE);
      await save(ACTIVE_PORTFOLIO_KEY, pid);
      await loadPortfolio(pid, PORTFOLIO_VIEW_MODE);
    } catch (err) {
      console.error("組合切換失敗:", err);
      setSaved("❌ 組合切換失敗");
      setTimeout(() => setSaved(""), 3000);
    } finally {
      portfolioTransitionRef.current = {
        isHydrating: false,
        fromPid: pid,
        toPid: pid,
      };
      setPortfolioSwitching(false);
    }
  };
  const createPortfolio = async () => {
    const rawName = window.prompt("新組合名稱");
    const name = rawName?.trim();
    if (!name) return;

    const nextPortfolio = {
      id: `p-${Date.now().toString(36)}`,
      name,
      isOwner: false,
      createdAt: todayStorageDate(),
    };
    const nextPortfolios = [...portfolios, nextPortfolio];

    setPortfolios(nextPortfolios);
    await save(PORTFOLIOS_KEY, nextPortfolios);
    await Promise.all(
      PORTFOLIO_STORAGE_FIELDS.map(field => savePortfolioData(nextPortfolio.id, field.suffix, getEmptyFallback(field.suffix)))
    );
    await switchPortfolio(nextPortfolio.id);
    setSaved(`✅ 已新增組合「${name}」`);
    setTimeout(() => setSaved(""), 3000);
  };
  const openOverview = async () => {
    if (portfolioSwitching || viewMode === OVERVIEW_VIEW_MODE) return;

    setPortfolioSwitching(true);
    portfolioTransitionRef.current = {
      isHydrating: true,
      fromPid: activePortfolioId,
      toPid: activePortfolioId,
    };

    try {
      await flushCurrentPortfolio();
      resetTransientUiState();
      setViewMode(OVERVIEW_VIEW_MODE);
      setCloudStateForPortfolio(activePortfolioId, OVERVIEW_VIEW_MODE);
      await save(ACTIVE_PORTFOLIO_KEY, activePortfolioId);
      await save(VIEW_MODE_KEY, OVERVIEW_VIEW_MODE);
    } catch (err) {
      console.error("切換總覽模式失敗:", err);
      setSaved("❌ 無法開啟總覽");
      setTimeout(() => setSaved(""), 3000);
    } finally {
      portfolioTransitionRef.current = {
        isHydrating: false,
        fromPid: activePortfolioId,
        toPid: activePortfolioId,
      };
      setPortfolioSwitching(false);
    }
  };
  const exitOverview = async () => {
    if (portfolioSwitching || viewMode !== OVERVIEW_VIEW_MODE) return;

    setPortfolioSwitching(true);
    portfolioTransitionRef.current = {
      isHydrating: true,
      fromPid: activePortfolioId,
      toPid: activePortfolioId,
    };

    try {
      resetTransientUiState();
      await save(ACTIVE_PORTFOLIO_KEY, activePortfolioId);
      await save(VIEW_MODE_KEY, PORTFOLIO_VIEW_MODE);
      await loadPortfolio(activePortfolioId, PORTFOLIO_VIEW_MODE);
    } catch (err) {
      console.error("離開總覽模式失敗:", err);
      setSaved("❌ 無法返回組合");
      setTimeout(() => setSaved(""), 3000);
    } finally {
      portfolioTransitionRef.current = {
        isHydrating: false,
        fromPid: activePortfolioId,
        toPid: activePortfolioId,
      };
      setPortfolioSwitching(false);
    }
  };
  const renamePortfolio = async (pid) => {
    const current = portfolios.find(item => item.id === pid);
    if (!current) return;
    const rawName = window.prompt("新的組合名稱", current.name);
    const name = rawName?.trim();
    if (!name || name === current.name) return;

    const nextPortfolios = portfolios.map(item => item.id === pid ? { ...item, name } : item);
    setPortfolios(nextPortfolios);
    await save(PORTFOLIOS_KEY, nextPortfolios);
    setSaved(`✅ 已更新組合名稱為「${name}」`);
    setTimeout(() => setSaved(""), 3000);
  };
  const deletePortfolio = async (pid) => {
    const current = portfolios.find(item => item.id === pid);
    if (!current || pid === OWNER_PORTFOLIO_ID) return;
    if (!window.confirm(`確定要刪除組合「${current.name}」？這會清掉該組合的本機資料。`)) return;

    let nextPid = activePortfolioId;
    setPortfolioSwitching(true);
    portfolioTransitionRef.current = {
      isHydrating: true,
      fromPid: activePortfolioId,
      toPid: activePortfolioId,
    };

    try {
      if (viewMode === PORTFOLIO_VIEW_MODE && pid === activePortfolioId) {
        await flushCurrentPortfolio(pid);
      }

      removePortfolioData(pid);
      const nextPortfolios = portfolios.filter(item => item.id !== pid);
      nextPid = nextPortfolios.some(item => item.id === OWNER_PORTFOLIO_ID)
        ? OWNER_PORTFOLIO_ID
        : nextPortfolios[0]?.id || OWNER_PORTFOLIO_ID;

      setPortfolios(nextPortfolios);
      await save(PORTFOLIOS_KEY, nextPortfolios);

      if (pid === activePortfolioId) {
        resetTransientUiState();
        await save(ACTIVE_PORTFOLIO_KEY, nextPid);
        await save(VIEW_MODE_KEY, PORTFOLIO_VIEW_MODE);
        await loadPortfolio(nextPid, PORTFOLIO_VIEW_MODE);
      } else {
        await save(ACTIVE_PORTFOLIO_KEY, activePortfolioId);
        await save(VIEW_MODE_KEY, viewMode);
        setCloudStateForPortfolio(activePortfolioId, viewMode);
      }

      setSaved(`✅ 已刪除組合「${current.name}」`);
      setTimeout(() => setSaved(""), 3000);
    } catch (err) {
      console.error("刪除組合失敗:", err);
      setSaved("❌ 刪除組合失敗");
      setTimeout(() => setSaved(""), 3000);
    } finally {
      portfolioTransitionRef.current = {
        isHydrating: false,
        fromPid: nextPid,
        toPid: nextPid,
      };
      setPortfolioSwitching(false);
    }
  };

  // boot
  useEffect(() => {
    (async () => {
      portfolioTransitionRef.current = {
        isHydrating: true,
        fromPid: activePortfolioId,
        toPid: activePortfolioId,
      };

      await migrateLegacyPortfolioStorageIfNeeded();
      const registry = await ensurePortfolioRegistry();
      const pid = registry.activePortfolioId;
      const snapshot = await loadPortfolioSnapshot(pid);

      setPortfolios(registry.portfolios);
      setActivePortfolioId(pid);
      setViewMode(registry.viewMode);
      applyPortfolioSnapshot(snapshot);
      setReady(true);
      portfolioTransitionRef.current = {
        isHydrating: false,
        fromPid: pid,
        toPid: pid,
      };

      const lastCloudSyncAt = readSyncAt("pf-cloud-sync-at");
      const shouldSyncCloud = pid === OWNER_PORTFOLIO_ID && (!lastCloudSyncAt || (Date.now() - lastCloudSyncAt > CLOUD_SYNC_TTL));
      cloudSyncStateRef.current = { enabled: pid === OWNER_PORTFOLIO_ID, syncedAt: lastCloudSyncAt };

      if (pid !== OWNER_PORTFOLIO_ID) {
        setCloudSync(false);
        return;
      }

      // 冷卻時間內直接用 localStorage，避免每次開頁都打 Blob
      if (!shouldSyncCloud) {
        setCloudSync(true);
        return;
      }

      try {
        const [cloudBrain, cloudEvents, cloudHoldings, cloudHistory, cloudResearch] = await Promise.all([
          fetch("/api/brain?action=brain").then(r=>r.json()).catch(()=>({brain:null})),
          fetch("/api/brain",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({action:"load-events"})}).then(r=>r.json()).catch(()=>({events:null})),
          fetch("/api/brain",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({action:"load-holdings"})}).then(r=>r.json()).catch(()=>({holdings:null})),
          fetch("/api/brain?action=history").then(r=>r.json()).catch(()=>({history:null})),
          fetch("/api/research").then(r=>r.json()).catch(()=>({reports:null})),
        ]);
        // 雲端同步策略：本地優先，雲端只補缺（合併不覆蓋）
        if (cloudBrain.brain && !snapshot.strategyBrain) {
          const normalizedBrain = normalizeStrategyBrain(cloudBrain.brain);
          setStrategyBrain(normalizedBrain);
          savePortfolioData(pid, "brain-v1", normalizedBrain);
        }
        if (cloudEvents.events && (!snapshot.newsEvents || snapshot.newsEvents.length === 0)) {
          const normalizedEvents = normalizeNewsEvents(cloudEvents.events);
          setNewsEvents(normalizedEvents);
          savePortfolioData(pid, "news-events-v1", normalizedEvents);
        }
        const cloudH = cloudHoldings.holdings;
        if (cloudH && Array.isArray(cloudH) && cloudH.length > 0 && (!snapshot.holdings || snapshot.holdings.length === 0)) {
          setHoldings(cloudH); savePortfolioData(pid, "holdings-v2", cloudH);
        }
        // 分析歷史：合併本地+雲端，去重
        if (cloudHistory.history?.length) {
          const merged = [...(snapshot.analysisHistory || []), ...cloudHistory.history];
          const unique = merged.filter((r, i, arr) => arr.findIndex(x => x.id === r.id) === i)
            .sort((a, b) => b.id - a.id).slice(0, 30);
          setAnalysisHistory(unique);
          savePortfolioData(pid, "analysis-history-v1", unique);
          writeSyncAt("pf-analysis-cloud-sync-at", Date.now());
          // 如果本地沒有 dailyReport，從合併結果補上
          if (!snapshot.dailyReport && unique.length > 0) setDailyReport(unique[0]);
        }
        // 研究歷史：合併本地+雲端，去重
        if (cloudResearch.reports?.length) {
          const merged = [...(snapshot.researchHistory || []), ...cloudResearch.reports];
          const unique = merged.filter((r, i, arr) => arr.findIndex(x => x.timestamp === r.timestamp) === i)
            .sort((a, b) => b.timestamp - a.timestamp).slice(0, 30);
          setResearchHistory(unique);
          savePortfolioData(pid, "research-history-v1", unique);
          writeSyncAt("pf-research-cloud-sync-at", Date.now());
        }
        const syncedAt = Date.now();
        cloudSyncStateRef.current.syncedAt = syncedAt;
        writeSyncAt("pf-cloud-sync-at", syncedAt);
        setCloudSync(true);
      } catch(e) { /* 離線也能用 localStorage 版本 */ }
    })();
  }, []);

  // auto-save
  useEffect(() => {
    if (canPersistPortfolioData && holdings) {
      savePortfolioData(activePortfolioId, "holdings-v2", holdings);
      scheduleCloudSave("save-holdings", holdings);
    }
  }, [activePortfolioId, canPersistPortfolioData, holdings]);
  useEffect(() => { if (canPersistPortfolioData && tradeLog) savePortfolioData(activePortfolioId, "log-v2", tradeLog); }, [activePortfolioId, canPersistPortfolioData, tradeLog]);
  useEffect(() => { if (canPersistPortfolioData && targets)  savePortfolioData(activePortfolioId, "targets-v1", targets); }, [activePortfolioId, canPersistPortfolioData, targets]);
  useEffect(() => { if (canPersistPortfolioData && watchlist) savePortfolioData(activePortfolioId, "watchlist-v1", watchlist); }, [activePortfolioId, canPersistPortfolioData, watchlist]);
  useEffect(() => {
    if (canPersistPortfolioData && newsEvents) {
      savePortfolioData(activePortfolioId, "news-events-v1", newsEvents);
      scheduleCloudSave("save-events", newsEvents);
    }
  }, [activePortfolioId, canPersistPortfolioData, newsEvents]);
  useEffect(() => { if (canPersistPortfolioData && analysisHistory) savePortfolioData(activePortfolioId, "analysis-history-v1", analysisHistory); }, [activePortfolioId, analysisHistory, canPersistPortfolioData]);
  useEffect(() => { if (canPersistPortfolioData && dailyReport) savePortfolioData(activePortfolioId, "daily-report-v1", dailyReport); }, [activePortfolioId, canPersistPortfolioData, dailyReport]);
  useEffect(() => { if (canPersistPortfolioData && reversalConditions) savePortfolioData(activePortfolioId, "reversal-v1", reversalConditions); }, [activePortfolioId, canPersistPortfolioData, reversalConditions]);
  useEffect(() => {
    if (canPersistPortfolioData && strategyBrain) {
      savePortfolioData(activePortfolioId, "brain-v1", strategyBrain);
      scheduleCloudSave("save-brain", strategyBrain);
    }
  }, [activePortfolioId, canPersistPortfolioData, strategyBrain]);
  useEffect(() => {
    const lastAnalysisSyncAt = readSyncAt("pf-analysis-cloud-sync-at");
    const shouldFetchAnalysis = canUseCloud && (tab === "daily" || tab === "log") && (!lastAnalysisSyncAt || Date.now() - lastAnalysisSyncAt > CLOUD_SYNC_TTL);
    if (!shouldFetchAnalysis) return;
    fetch("/api/brain?action=history")
      .then(r=>r.json())
      .then(data => {
        if (!data.history?.length) return;
        setAnalysisHistory(prev => {
          const merged = [...(prev || []), ...data.history];
          const unique = merged.filter((r, i, arr) => arr.findIndex(x => x.id === r.id) === i)
            .sort((a, b) => b.id - a.id).slice(0, 30);
          savePortfolioData(activePortfolioId, "analysis-history-v1", unique);
          return unique;
        });
        writeSyncAt("pf-analysis-cloud-sync-at", Date.now());
      })
      .catch(()=>{});
  }, [activePortfolioId, canUseCloud, tab]);
  useEffect(() => {
    const lastResearchSyncAt = readSyncAt("pf-research-cloud-sync-at");
    const shouldFetchResearch = canUseCloud && tab === "research" && (!lastResearchSyncAt || Date.now() - lastResearchSyncAt > CLOUD_SYNC_TTL);
    if (!shouldFetchResearch) return;
    fetch("/api/research")
      .then(r=>r.json())
      .then(data => {
        if (!data.reports?.length) return;
        const merged = [...(researchHistory || []), ...data.reports];
        const unique = merged.filter((r,i,arr) => arr.findIndex(x => x.timestamp === r.timestamp) === i)
          .sort((a,b) => b.timestamp - a.timestamp).slice(0, 30);
        setResearchHistory(unique);
        savePortfolioData(activePortfolioId, "research-history-v1", unique);
        writeSyncAt("pf-research-cloud-sync-at", Date.now());
      })
      .catch(()=>{});
  }, [activePortfolioId, canUseCloud, researchHistory, tab]);
  useEffect(() => () => {
    Object.values(cloudSaveTimersRef.current).forEach(clearTimeout);
  }, []);
  useEffect(() => { if (canPersistPortfolioData && researchHistory) savePortfolioData(activePortfolioId, "research-history-v1", researchHistory); }, [activePortfolioId, canPersistPortfolioData, researchHistory]);
  useEffect(() => { if (canPersistPortfolioData && portfolioNotes) savePortfolioData(activePortfolioId, "notes-v1", portfolioNotes); }, [activePortfolioId, canPersistPortfolioData, portfolioNotes]);
  useEffect(() => {
    const shouldSyncLifecycle =
      ready &&
      viewMode === PORTFOLIO_VIEW_MODE &&
      !portfolioTransitionRef.current.isHydrating &&
      Array.isArray(newsEvents) &&
      newsEvents.length > 0 &&
      ["holdings", "events", "news", "daily"].includes(tab);
    if (!shouldSyncLifecycle || eventLifecycleSyncRef.current) return;

    let cancelled = false;
    eventLifecycleSyncRef.current = true;

    (async () => {
      try {
        const nextEvents = await syncEventLifecycle(newsEvents);
        if (cancelled) return;
        const currentJson = JSON.stringify(normalizeNewsEvents(newsEvents));
        const nextJson = JSON.stringify(nextEvents);
        if (currentJson !== nextJson) {
          setNewsEvents(nextEvents);
        }
      } finally {
        eventLifecycleSyncRef.current = false;
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [activePortfolioId, newsEvents, ready, tab, viewMode]);

  // ── 啟動時自動靜默刷新股價（Phase 1: 不依賴收盤分析） ──
  const autoRefreshDoneRef = useRef({});
  useEffect(() => {
    if (!ready || !Array.isArray(holdings) || holdings.length === 0) return;
    if (viewMode !== PORTFOLIO_VIEW_MODE) return;
    // 每個組合每次 session 只自動刷一次
    const key = activePortfolioId;
    if (autoRefreshDoneRef.current[key]) return;
    autoRefreshDoneRef.current[key] = true;

    // 靜默刷新，不顯示 toast
    (async () => {
      try {
        const codes = holdings.map(h => h.code);
        const queries = codes.flatMap(c => [`tse_${c}.tw`, `otc_${c}.tw`]);
        const exCh = queries.join('|');
        const res = await fetch(`/api/twse?ex_ch=${encodeURIComponent(exCh)}`);
        const data = await res.json();
        if (!data.msgArray || data.msgArray.length === 0) return;

        const priceMap = {};
        data.msgArray.forEach(item => {
          const price = extractBestPrice(item);
          if (price && !priceMap[item.c]) priceMap[item.c] = price;
        });

        if (Object.keys(priceMap).length > 0) {
          setHoldings(prev => (prev || []).map(h => {
            const newPrice = priceMap[h.code];
            if (newPrice == null) return h;
            const newValue = Math.round(newPrice * h.qty);
            const newPnl = Math.round((newPrice - h.cost) * h.qty);
            const newPct = Math.round((newPrice / h.cost - 1) * 10000) / 100;
            return { ...h, price: newPrice, value: newValue, pnl: newPnl, pct: newPct };
          }));
          setLastUpdate(new Date());
        }
      } catch (err) {
        console.warn("自動刷新股價失敗（靜默）:", err);
      }
    })();
  }, [ready, holdings, activePortfolioId, viewMode]);

  // derived
  const H = Array.isArray(holdings) ? holdings : [];
  const W = Array.isArray(watchlist) ? watchlist : [];
  const currentNewsEvents = Array.isArray(newsEvents) ? newsEvents : [];
  const totalVal  = H.reduce((s,h)=>s+h.value,0);
  const totalCost = H.reduce((s,h)=>s+h.cost*h.qty,0);
  const totalPnl  = H.reduce((s,h)=>s+h.pnl,0);
  const retPct    = totalCost>0 ? totalPnl/totalCost*100 : 0;
  const getPortfolioSnapshot = (portfolioId) => {
    const useLiveState = viewMode === PORTFOLIO_VIEW_MODE && portfolioId === activePortfolioId;
    const holdingsValue = useLiveState ? H : readStorageValue(pfKey(portfolioId, "holdings-v2"));
    const eventsValue = useLiveState ? (newsEvents || []) : readStorageValue(pfKey(portfolioId, "news-events-v1"));
    const notesValue = useLiveState ? portfolioNotes : readStorageValue(pfKey(portfolioId, "notes-v1"));
    return {
      holdings: Array.isArray(holdingsValue) ? holdingsValue : getPortfolioFallback(portfolioId, "holdings-v2"),
      newsEvents: normalizeNewsEvents(Array.isArray(eventsValue) ? eventsValue : getPortfolioFallback(portfolioId, "news-events-v1")),
      notes: notesValue && typeof notesValue === "object" ? { ...clonePortfolioNotes(), ...notesValue } : clonePortfolioNotes(),
    };
  };
  const portfolioSummaries = portfolios.map(portfolio => {
    const snapshot = getPortfolioSnapshot(portfolio.id);
    const rows = snapshot.holdings;
    const holdingCount = Array.isArray(rows) ? rows.length : 0;
    const portfolioValue = (rows || []).reduce((sum, item) => sum + (Number(item.value) || 0), 0);
    const portfolioCost = (rows || []).reduce((sum, item) => sum + ((Number(item.cost) || 0) * (Number(item.qty) || 0)), 0);
    const portfolioPnl = (rows || []).reduce((sum, item) => sum + (Number(item.pnl) || 0), 0);
    const portfolioRetPct = portfolioCost > 0 ? (portfolioPnl / portfolioCost) * 100 : 0;
    return {
      ...portfolio,
      holdingCount,
      totalValue: portfolioValue,
      totalPnl: portfolioPnl,
      retPct: portfolioRetPct,
    };
  });
  const activePortfolio = portfolioSummaries.find(item => item.id === activePortfolioId) || portfolioSummaries[0] || null;
  const overviewPortfolios = portfolioSummaries.map(portfolio => {
    const snapshot = getPortfolioSnapshot(portfolio.id);
    const pendingEvents = (snapshot.newsEvents || []).filter(event => !isClosedEvent(event));
    return {
      ...portfolio,
      holdings: snapshot.holdings,
      newsEvents: snapshot.newsEvents,
      notes: snapshot.notes,
      pendingEvents,
    };
  });
  const overviewTotalValue = overviewPortfolios.reduce((sum, portfolio) => sum + portfolio.totalValue, 0);
  const overviewTotalPnl = overviewPortfolios.reduce((sum, portfolio) => sum + portfolio.totalPnl, 0);
  const overviewTotalCost = overviewPortfolios.reduce((sum, portfolio) => sum + (portfolio.totalValue - portfolio.totalPnl), 0);
  const overviewRetPct = overviewTotalCost > 0 ? (overviewTotalPnl / overviewTotalCost) * 100 : 0;
  const displayedTotalPnl = viewMode === OVERVIEW_VIEW_MODE ? overviewTotalPnl : totalPnl;
  const displayedRetPct = viewMode === OVERVIEW_VIEW_MODE ? overviewRetPct : retPct;
  const overviewDuplicateHoldings = (() => {
    const byCode = new Map();
    overviewPortfolios.forEach(portfolio => {
      (portfolio.holdings || []).forEach(item => {
        const existing = byCode.get(item.code) || { code: item.code, name: item.name, totalValue: 0, portfolios: [] };
        existing.totalValue += Number(item.value) || 0;
        existing.portfolios.push({
          id: portfolio.id,
          name: portfolio.name,
          qty: Number(item.qty) || 0,
          value: Number(item.value) || 0,
          pnl: Number(item.pnl) || 0,
        });
        byCode.set(item.code, existing);
      });
    });
    return Array.from(byCode.values())
      .filter(item => item.portfolios.length > 1)
      .sort((a, b) => b.portfolios.length - a.portfolios.length || b.totalValue - a.totalValue);
  })();
  const overviewPendingItems = overviewPortfolios
    .flatMap(portfolio => portfolio.pendingEvents.map(event => ({
      ...event,
      portfolioId: portfolio.id,
      portfolioName: portfolio.name,
    })))
    .sort((a, b) => String(a.date || "").localeCompare(String(b.date || "")));
  const todayAlertItems = H
    .filter(item => typeof item.alert === "string" && item.alert.trim())
    .map(item => {
      const alertText = item.alert.replace(/^⚡\s*/, "").trim();
      if (!alertText) return null;
      if (alertText.startsWith("今日")) return `${item.name}${alertText}`;
      if (alertText.includes("出場區間")) return `${item.name}已到${alertText.replace(/到$/, "")}`;
      return `${item.name} ${alertText}`;
    })
    .filter(Boolean);
  const urgentCount = todayAlertItems.length;
  const todayAlertSummary = urgentCount > 2
    ? `${todayAlertItems.slice(0, 2).join(" · ")} · 另有 ${urgentCount - 2} 項提醒`
    : todayAlertItems.join(" · ");
  const watchlistRows = W.map((item, index) => {
    const relatedEvents = currentNewsEvents.filter(event => event.stocks?.some(stock => stock.includes(item.code)));
    const trackingCount = relatedEvents.filter(event => event.status === "tracking").length;
    const pendingCount = relatedEvents.filter(event => event.status === "pending").length;
    const hits = relatedEvents.filter(event => event.correct === true).length;
    const misses = relatedEvents.filter(event => event.correct === false).length;
    const isUrgent = /⚡|今日/.test(item.status || "");
    const primaryEvent =
      relatedEvents.find(event => event.status === "tracking") ||
      relatedEvents.find(event => event.status === "pending") ||
      relatedEvents[0] ||
      null;
    const upside = item.price > 0 && item.target > 0 ? ((item.target - item.price) / item.price) * 100 : null;
    const summary = primaryEvent?.title || item.catalyst || item.note || "持續觀察";
    const action = isUrgent
      ? "今天先看事件結果，再決定是否加碼、續抱或停損。"
      : trackingCount > 0
        ? "目前已進入追蹤期，優先看價格與事件驗證。"
        : pendingCount > 0
          ? "先保留觀察，等事件落地再加大部位。"
          : item.note || "暫列觀察名單，還不急著動作。";
    const priority = (isUrgent ? 5 : 0) + (trackingCount > 0 ? 3 : 0) + (pendingCount > 0 ? 2 : 0) + (upside != null && upside >= 20 ? 1 : 0);
    return {
      item,
      index,
      relatedEvents,
      trackingCount,
      pendingCount,
      hits,
      misses,
      primaryEvent,
      upside,
      summary,
      action,
      priority,
    };
  });
  const watchlistFocus = watchlistRows.length > 0
    ? [...watchlistRows].sort((a, b) => b.priority - a.priority || (b.upside ?? -999) - (a.upside ?? -999))[0]
    : null;
  const showRelayPlan = activePortfolioId === OWNER_PORTFOLIO_ID || H.some(item => RELAY_PLAN_CODES.has(item.code)) || W.some(item => RELAY_PLAN_CODES.has(item.code));

  const sorted = [...H].sort((a,b)=>{
    if(sortBy==="value") return b.value-a.value;
    if(sortBy==="pnl")   return b.pnl-a.pnl;
    if(sortBy==="pct")   return b.pct-a.pct;
    return 0;
  });
  const scanRows = sorted.map(h => {
    const meta = STOCK_META[h.code];
    const T = targets?.[h.code];
    const relatedEvents = (newsEvents || NEWS_EVENTS).filter(e => e.stocks?.some(s => s.includes(h.code)));
    const hasPending = relatedEvents.some(e => e.correct == null);
    const priority = h.alert || T?.isNew ? "A" : (hasPending || h.pnl < 0 ? "B" : "C");
    const needsAttention = priority !== "C";
    return { h, meta, T, relatedEvents, hasPending, needsAttention, priority };
  });
  const normalizedQuery = deferredQuery.trim().toLowerCase();
  const filteredRows = scanRows.filter(({ h, meta, T, relatedEvents, hasPending, needsAttention }) => {
    const matchQuery = !normalizedQuery || [
      h.name,
      h.code,
      meta?.industry,
      meta?.strategy,
      meta?.position,
    ].filter(Boolean).some(v => String(v).toLowerCase().includes(normalizedQuery));
    if (!matchQuery) return false;
    if (scanFilter === "全部") return true;
    if (scanFilter === "需處理") return needsAttention;
    if (scanFilter === "虧損") return h.pnl < 0;
    if (scanFilter === "待處理") return hasPending;
    if (scanFilter === "目標更新") return Boolean(T?.isNew);
    if (scanFilter === "權證") return h.type === "權證";
    return true;
  });
  const displayed = showAll ? filteredRows : filteredRows.slice(0,12);
  const top5 = [...H].sort((a,b)=>b.value-a.value).slice(0,5);
  const topColors = [C.blue, C.amber, C.lavender, C.olive, C.teal];
  const winners = H.filter(h=>h.pnl>0).sort((a,b)=>b.pct-a.pct);
  const losers  = H.filter(h=>h.pnl<0).sort((a,b)=>a.pct-b.pct);
  const attentionCount = scanRows.filter(r => r.needsAttention).length;
  const pendingCount = scanRows.filter(r => r.hasPending).length;
  const targetUpdateCount = scanRows.filter(r => r.T?.isNew).length;

  const filteredEvents = filterType==="全部" ? EVENTS : EVENTS.filter(e=>e.type===filterType);
  const fetchMarketPriceMap = async (codes) => {
    const normalizedCodes = Array.from(new Set((codes || []).map(code => String(code || "").trim()).filter(Boolean)));
    if (normalizedCodes.length === 0) return {};

    const queries = normalizedCodes.flatMap(code => [`tse_${code}.tw`, `otc_${code}.tw`]);
    const exCh = queries.join("|");
    const res = await fetch(`/api/twse?ex_ch=${encodeURIComponent(exCh)}`);
    const data = await res.json();
    const priceMap = {};

    (data.msgArray || []).forEach(item => {
      const latest = parseFloat(item.z);
      const yClose = parseFloat(item.y);
      const price = (!Number.isNaN(latest) && latest > 0)
        ? latest
        : (!Number.isNaN(yClose) && yClose > 0 ? yClose : null);
      if (price && !priceMap[item.c]) {
        priceMap[item.c] = price;
      }
    });

    return priceMap;
  };
  const buildEventPriceRecord = (event, priceMap) => {
    const codes = getEventStockCodes(event);
    const entries = codes
      .map(code => [code, priceMap?.[code]])
      .filter(([, price]) => Number.isFinite(price) && price > 0);
    return entries.length > 0 ? Object.fromEntries(entries) : null;
  };
  const formatEventPriceRecord = (prices) => {
    if (!prices) return "—";
    return Object.entries(prices)
      .map(([code, price]) => `${code} ${Number(price).toFixed(1)}`)
      .join(" / ");
  };
  const getEventTrackingMetrics = (event) => {
    const latestEntry = Array.isArray(event?.priceHistory) && event.priceHistory.length > 0
      ? event.priceHistory[event.priceHistory.length - 1]
      : null;
    const currentPrices = latestEntry?.prices || event?.priceAtExit || null;
    const entryAvg = averagePriceRecord(event?.priceAtEvent);
    const currentAvg = averagePriceRecord(currentPrices);
    const changePct = entryAvg && currentAvg ? ((currentAvg / entryAvg) - 1) * 100 : null;
    const trackingDays = daysBetween(event?.trackingStart || event?.eventDate);
    return {
      latestDate: latestEntry?.date || event?.exitDate || null,
      currentPrices,
      entryAvg,
      currentAvg,
      changePct,
      trackingDays,
    };
  };
  const syncEventLifecycle = async (events = newsEvents) => {
    const normalizedEvents = normalizeNewsEvents(events);
    if (normalizedEvents.length === 0) return normalizedEvents;

    const today = toSlashDate();
    const duePending = normalizedEvents.filter(event => {
      if (event.status !== "pending") return false;
      const scheduled = parseSlashDate(event.date);
      return scheduled && scheduled.getTime() <= parseSlashDate(today).getTime();
    });
    const trackingEvents = normalizedEvents.filter(event => event.status === "tracking");
    const priceCodes = Array.from(new Set([
      ...duePending.flatMap(getEventStockCodes),
      ...trackingEvents.flatMap(getEventStockCodes),
    ]));

    if (priceCodes.length === 0) return normalizedEvents;

    let priceMap = {};
    try {
      priceMap = await fetchMarketPriceMap(priceCodes);
    } catch (err) {
      console.error("事件追蹤價格抓取失敗:", err);
      return normalizedEvents;
    }

    return normalizedEvents.map(event => {
      if (event.status === "pending") {
        const scheduled = parseSlashDate(event.date);
        if (!scheduled || scheduled.getTime() > parseSlashDate(today).getTime()) return event;
        const priceAtEvent = buildEventPriceRecord(event, priceMap);
        if (!priceAtEvent) return event;
        return {
          ...event,
          status: "tracking",
          eventDate: today,
          trackingStart: today,
          priceAtEvent,
          priceHistory: appendPriceHistory(event.priceHistory, today, priceAtEvent),
        };
      }

      if (event.status === "tracking") {
        const latestPrices = buildEventPriceRecord(event, priceMap);
        if (!latestPrices) return event;
        return {
          ...event,
          priceHistory: appendPriceHistory(event.priceHistory, today, latestPrices),
        };
      }

      return event;
    });
  };
  const openEventReview = async (event, domEvent) => {
    domEvent?.stopPropagation?.();
    if (!event) return;

    if (event.status !== "tracking") {
      setReviewingEvent(event.id);
      setReviewForm(createDefaultReviewForm({ actual: event.actual || "up" }));
      return;
    }

    try {
      const exitPrices = buildEventPriceRecord(event, await fetchMarketPriceMap(getEventStockCodes(event)));
      if (!exitPrices) {
        setSaved("⚠️ 暫時抓不到結案價格，請先手動填寫");
        setTimeout(() => setSaved(""), 3000);
        setReviewingEvent(event.id);
        setReviewForm(createDefaultReviewForm({ actual: event.actual || "up" }));
        return;
      }

      const exitDate = toSlashDate();
      const actual = inferEventActual(event.priceAtEvent, exitPrices) || event.actual || "neutral";
      const entryAvg = averagePriceRecord(event.priceAtEvent);
      const exitAvg = averagePriceRecord(exitPrices);
      const changePct = entryAvg && exitAvg ? ((exitAvg / entryAvg) - 1) * 100 : null;

      setReviewingEvent(event.id);
      setReviewForm(createDefaultReviewForm({
        actual,
        actualNote: changePct == null
          ? ""
          : `事件日均價 ${entryAvg.toFixed(1)} → 結案均價 ${exitAvg.toFixed(1)}（${changePct >= 0 ? "+" : ""}${changePct.toFixed(1)}%）`,
        exitDate,
        priceAtExit: exitPrices,
      }));
    } catch (err) {
      console.error("準備事件復盤失敗:", err);
      setSaved("⚠️ 暫時抓不到結案價格，請先手動填寫");
      setTimeout(() => setSaved(""), 3000);
      setReviewingEvent(event.id);
      setReviewForm(createDefaultReviewForm({ actual: event.actual || "up" }));
    }
  };
  const appendCoachLessonToOwnerBrain = async ({ event, note, lesson }) => {
    if (!event || activePortfolioId === OWNER_PORTFOLIO_ID) return;

    const sourcePortfolio = portfolios.find(item => item.id === activePortfolioId);
    const text = (lesson || note || "").trim();
    if (!text) return;

    const ownerBrain = normalizeStrategyBrain(
      await loadPortfolioData(OWNER_PORTFOLIO_ID, "brain-v1", null),
      { allowEmpty: true }
    );
    const sourceLabel = sourcePortfolio?.name || activePortfolioId;
    const coachLesson = {
      date: toSlashDate(),
      text,
      source: `${sourceLabel}-${event.title}`,
      sourcePortfolioId: activePortfolioId,
      sourceEventId: event.id,
    };
    const existing = (ownerBrain.coachLessons || []).filter(item => !(
      item.sourcePortfolioId === coachLesson.sourcePortfolioId &&
      item.sourceEventId === coachLesson.sourceEventId
    ));
    const nextOwnerBrain = {
      ...ownerBrain,
      coachLessons: [...existing, coachLesson].slice(-100),
    };

    await savePortfolioData(OWNER_PORTFOLIO_ID, "brain-v1", nextOwnerBrain);
  };

  // ── 從 TWSE MIS API 回應中提取最佳股價 ──────────────────────────
  // z=最新成交 h=今高 l=今低 y=昨收 o=今開
  // 收盤後 z 可能是 "-"，需要多層 fallback
  const extractBestPrice = (item) => {
    const tryParse = (v) => { const n = parseFloat(v); return (!isNaN(n) && n > 0) ? n : null; };
    // 優先順序：最新成交 → 今高（代表今天有交易）→ 今開 → 昨收
    return tryParse(item.z) || tryParse(item.h) || tryParse(item.o) || tryParse(item.y) || null;
  };
  const extractYesterday = (item) => {
    const n = parseFloat(item.y); return (!isNaN(n) && n > 0) ? n : null;
  };

  // ── 刷新即時股價（TWSE MIS API）───────────────────────────────
  const refreshPrices = async () => {
    if (refreshing) return;
    setRefreshing(true);
    try {
      const codes = H.map(h => h.code);
      // 分批查詢：避免 URL 過長，每批最多 15 檔（30 queries）
      const batchSize = 15;
      const priceMap = {};
      for (let i = 0; i < codes.length; i += batchSize) {
        const batch = codes.slice(i, i + batchSize);
        const queries = batch.flatMap(c => [`tse_${c}.tw`, `otc_${c}.tw`]);
        const exCh = queries.join('|');
        const url = `/api/twse?ex_ch=${encodeURIComponent(exCh)}`;
        try {
          const res = await fetch(url);
          const data = await res.json();
          if (data.msgArray) {
            data.msgArray.forEach(item => {
              const price = extractBestPrice(item);
              if (price && !priceMap[item.c]) {
                priceMap[item.c] = price;
              }
            });
          }
        } catch (batchErr) {
          console.warn(`批次 ${i / batchSize + 1} 查詢失敗:`, batchErr);
        }
      }

      if (Object.keys(priceMap).length > 0) {
        setHoldings(prev => (prev || []).map(h => {
          const newPrice = priceMap[h.code];
          if (newPrice == null) return h;
          const newValue = Math.round(newPrice * h.qty);
          const newPnl = Math.round((newPrice - h.cost) * h.qty);
          const newPct = Math.round((newPrice / h.cost - 1) * 10000) / 100;
          return { ...h, price: newPrice, value: newValue, pnl: newPnl, pct: newPct };
        }));

        const updated = Object.keys(priceMap).length;
        const total = codes.length;
        const missed = codes.filter(c => !priceMap[c]);
        setLastUpdate(new Date());
        if (missed.length > 0 && missed.length < total) {
          const missedNames = missed.map(c => { const h2 = H.find(x=>x.code===c); return h2 ? `${h2.name}(${h2.type})` : c; }).join("、");
          setSaved(`✅ ${updated}/${total} 檔已更新（${missedNames} 無即時報價）`);
        } else {
          setSaved(`✅ ${updated} 檔股價已更新`);
        }
        setTimeout(() => setSaved(""), 4000);
      } else {
        setSaved("⚠️ 無法取得報價（可能非交易時間）");
        setTimeout(() => setSaved(""), 3000);
      }
    } catch (err) {
      console.error('刷新股價失敗:', err);
      setSaved("❌ 刷新失敗，請稍後再試");
      setTimeout(() => setSaved(""), 3000);
    }
    setRefreshing(false);
  };

  // ── 每日收盤分析 ─────────────────────────────────────────────────
  const runDailyAnalysis = async () => {
    if (analyzing) return;
    setAnalyzing(true);
    setAnalyzeStep("取得即時股價...");
    try {
      // 1. 取得最新股價
      const codes = H.map(h => h.code);
      const queries = codes.flatMap(c => [`tse_${c}.tw`, `otc_${c}.tw`]);
      const exCh = queries.join('|');
      const url = `/api/twse?ex_ch=${encodeURIComponent(exCh)}`;
      const res = await fetch(url);
      const data = await res.json();

      const priceMap = {};
      if (data.msgArray) {
        data.msgArray.forEach(item => {
          const price = extractBestPrice(item);
          const yesterday = extractYesterday(item);
          if (price && !priceMap[item.c]) {
            priceMap[item.c] = { price, yesterday, change: yesterday ? price - yesterday : 0, changePct: yesterday ? ((price / yesterday - 1) * 100) : 0 };
          }
        });
      }

      // 2. 計算每檔今日漲跌
      const changes = H.map(h => {
        const pm = priceMap[h.code];
        return {
          code: h.code, name: h.name, type: h.type,
          price: pm?.price || h.price,
          yesterday: pm?.yesterday || h.price,
          change: pm?.change || 0,
          changePct: pm?.changePct || 0,
          cost: h.cost, qty: h.qty,
          todayPnl: pm ? Math.round(pm.change * h.qty) : 0,
          totalPnl: pm ? Math.round((pm.price - h.cost) * h.qty) : h.pnl,
          totalPct: pm ? Math.round(((pm.price / h.cost) - 1) * 10000) / 100 : h.pct,
        };
      }).sort((a, b) => b.changePct - a.changePct);

      const totalTodayPnl = changes.reduce((s, c) => s + c.todayPnl, 0);

      // 3. 事件連動分析
      const NE = newsEvents || NEWS_EVENTS;
      const today = new Date().toLocaleDateString("zh-TW", { year: "numeric", month: "2-digit", day: "2-digit" }).replace(/\//g, "/");
      const pendingEvents = NE.filter(e => !isClosedEvent(e));
      const eventCorrelations = pendingEvents.map(e => {
        const relatedStocks = e.stocks.map(s => {
          const code = s.match(/\d+/)?.[0];
          const ch = changes.find(c => c.code === code);
          return ch ? { name: ch.name, code: ch.code, changePct: ch.changePct, change: ch.change } : null;
        }).filter(Boolean);
        return { ...e, relatedStocks };
      }).filter(e => e.relatedStocks.length > 0 && e.relatedStocks.some(s => Math.abs(s.changePct) > 1));

      // 4. 異常波動（漲跌幅 > 3%）
      const anomalies = changes.filter(c => Math.abs(c.changePct) > 3);

      // 5. 需要復盤的事件（日期已過但未標記結果）
      const needsReview = pendingEvents.filter(e => {
        if (!e.date.match(/^\d{4}\/\d{2}/)) return false;
        return e.date <= today;
      });

      // 6. 呼叫 Claude API 產生策略分析（含策略大腦上下文）
      setAnalyzeStep("AI 策略分析中（約15-30秒）...");
      let aiInsight = null;
      let aiError = null;
      let eventAssessments = [];
      let brainUpdatedInline = false;
      try {
        const holdingSummary = changes.map(c => {
          const h = (holdings||[]).find(x => x.code === c.code) || {};
          const m = STOCK_META[c.code];
          const typeTag = h.type === "權證" ? `[權證${h.expire ? " 到期:"+h.expire : ""}]` : h.type === "ETF" ? "[ETF槓桿]" : "[股票]";
          const indTag = m ? `[${m.industry}/${m.strategy}/${m.period}期/${m.position}/${m.leader}]` : "";
          const alertTag = h.alert ? ` ⚡${h.alert}` : "";
          return `${typeTag}${indTag} ${c.name}(${c.code}) 今日${c.changePct >= 0 ? "+" : ""}${c.changePct.toFixed(2)}% 累計${c.totalPct >= 0 ? "+" : ""}${c.totalPct}% 市值${h.value||0}${alertTag}`;
        }).join("\n");
        const eventSummary = pendingEvents.map(e =>
          `[eventId:${e.id}] [${e.date}] ${e.title} — 預測:${e.pred==="up"?"看漲":e.pred==="down"?"看跌":"中性"} — 狀態:${e.status}`
        ).join("\n");
        const anomalySummary = anomalies.length > 0
          ? anomalies.map(a => `${a.name} ${a.changePct >= 0 ? "+" : ""}${a.changePct.toFixed(2)}%`).join(", ")
          : "無";

        // 組裝策略大腦上下文
        const brain = strategyBrain;
        const notesContext = formatPortfolioNotesContext(portfolioNotes);
        const coachContext = activePortfolioId === OWNER_PORTFOLIO_ID && (brain?.coachLessons || []).length > 0 ? `
跨組合教練教訓：
${brain.coachLessons.slice(-5).map(item => `- [${item.date}] ${item.source || item.sourcePortfolioId}：${item.text}`).join("\n")}
` : "";
        const brainContext = brain ? `
══ 策略大腦（累積知識庫）══
核心策略規則：
${(brain.rules||[]).map((r,i)=>`${i+1}. ${r}`).join("\n")}

歷史教訓：
${(brain.lessons||[]).slice(-10).map(l=>`- [${l.date}] ${l.text}`).join("\n")}

勝率統計：${brain.stats?.hitRate||"尚無"}
常犯錯誤：${(brain.commonMistakes||[]).join("、")||"尚無"}
${coachContext}
══════════════════════════` : "";

        // 反轉追蹤上下文
        const revContext = losers.length > 0 ? `
反轉追蹤持股：
${losers.map(h=>{
  const rc = (reversalConditions||{})[h.code];
  return `${h.name}(${h.code}) ${h.pct}% | 反轉條件：${rc?.signal||"未設定"} | 停損：${rc?.stopLoss||"未設定"}`;
}).join("\n")}` : "";

        const aiRes = await fetch("/api/analyze", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            systemPrompt: `你是一位專業的台股策略分析師，也是用戶的長期策略顧問。
你擁有用戶過去所有分析的記憶（策略大腦），必須基於累積的教訓和規則來給出建議。
用戶是積極型事件驅動交易者，持有股票+權證+ETF，橫跨多個產業。

⚠️ 核心原則：不同類型持股必須用不同策略框架分析，禁止一套邏輯套用全部。

【權證策略框架】
- Delta 最佳區間 0.4-0.7，低於 0.3 考慮換約至價平附近
- 到期前 30 天 Theta 加速衰減 → 提前 40 天評估滾動換約
- 隱含波動率(IV)偏高時不追買，等 IV 回落再進場
- 出場紀律：到達目標價分批出 1/2 → 1/4，剩餘部位設追蹤停利
- 標的股漲但權證沒跟 → 檢查造市商報價、IV crush

【成長股策略框架】（如：台達電、奇鋐、創意、昇達科）
- PEG < 1.5 為合理，> 2 偏貴需等待回檔
- 營收月增率連續 3 個月正成長為多頭確認
- 三大法人連續買超天數、外資持股比例變化
- 催化劑時程：法說會前 2 週佈局、新品認證消息追蹤
- 技術面：站穩月線+季線多排=持有，跌破季線=減碼警戒

【景氣循環股策略框架】（如：華通PCB、台燿CCL、長興化學、力積電）
- 國發會景氣對策信號：藍燈(谷底佈局)→綠燈(持有)→紅燈(減碼)
- 庫存循環：去庫存末期=買點，補庫存初期=加碼，庫存回升=警戒
- ASP 趨勢：報價連續上漲=正面，跌價收斂=觀望
- 產能利用率 >80% 搭配漲價=景氣好轉訊號
- 股價淨值比(PBR)在歷史低檔區=長線佈局機會

【事件驅動策略框架】（如：法說會、財報、政策）
- 事件前 1-2 週佈局，事件後 1-3 日觀察市場反應
- 預期差分析：市場共識 vs 實際結果，超預期=續抱，低於預期=出場
- 買在謠言/賣在事實：利多兌現後股價不漲=出場訊號
- 政策受惠股注意時效性，通常 1-2 週為反應期

【ETF/指數策略框架】（如：滬深300正2）
- 總經面向：央行政策方向、PMI趨勢、匯率走勢
- 槓桿 ETF 波動耗損：持有超過 2 週需計算實際追蹤偏差
- RSI >70 超買減碼、RSI <30 超賣可佈局
- 停損紀律：正2型 ETF 虧損 >15% 必須檢討是否該停損

【防禦/停損觀察】（虧損>10%的持股）
- 原始進場邏輯是否還成立？基本面有無惡化？
- 季線/半年線是否已跌破？成交量是否萎縮見底？
- 停損原則：跌破進場邏輯=停損，邏輯仍在但技術弱=減碼不清
- 攤平條件：僅限基本面未變+技術面出現止跌訊號

請用繁體中文，以精準簡潔的風格分析今日收盤表現。格式：

## 今日總結
（一句話概括）

## 📊 個股策略分析
（按照上述分類，逐一分析每檔持股的策略狀態。特別標注需要行動的個股）

## 🔥 事件連動分析
（哪些股價變動與待觀察事件有關聯？邏輯是什麼？）

## ⚠️ 風險與停損追蹤
（虧損持股評估、權證時間價值風險、整體投組風險）

## 🎯 明日觀察與操作建議
（明天盤中關注重點 + 具體買賣建議或等待條件）

## 🧠 策略進化建議
（基於今日表現，策略大腦應該新增或修改什麼規則？）

## 📋 EVENT_ASSESSMENTS
最後，針對每一個待觀察事件輸出結構化評估。必須用以下 JSON 格式，用 \`\`\`json 包裹：
\`\`\`json
[{"eventId":"事件ID（原樣回傳）","title":"事件標題","todayImpact":"positive/negative/neutral/none","confidence":0.0到1.0,"note":"一句話說明今日與此事件的關聯","suggestClose":true或false,"suggestCloseReason":"若建議結案，說明原因"}]
\`\`\`
- todayImpact: positive=今日股價走勢符合事件預期, negative=相反, neutral=無明顯影響, none=無關
- confidence: 你對此評估的信心度(0-1)
- suggestClose: 是否建議結案（事件已充分反映或已失效）

## 🧬 BRAIN_UPDATE
最後，根據今日分析結果更新策略大腦。用 \`\`\`json 包裹，結構：
\`\`\`json
{"rules":["規則1","規則2"...],"lessons":[{"date":"日期","text":"教訓"}],"commonMistakes":["錯誤1"...],"stats":{"hitRate":"X/Y","totalAnalyses":N},"lastUpdate":"今日日期"}
\`\`\`
- rules：最多15條，去掉過時的，加入今日新發現的策略
- lessons：保留舊的+加入今日新教訓（只加有意義的）
- commonMistakes：反覆出現的錯誤模式
- stats：更新勝率統計`,
            userPrompt: `今日日期：${today}
今日持倉損益：${totalTodayPnl >= 0 ? "+" : ""}${totalTodayPnl.toLocaleString()} 元
${notesContext}
${brainContext}
${revContext}

持倉明細（含產業/策略分類）：
${holdingSummary}

個股策略定位：
${changes.map(c => {
  const m = STOCK_META[c.code];
  return m ? `${c.name}(${c.code}): 產業=${m.industry} 策略=${m.strategy} 週期=${m.period} 定位=${m.position} 地位=${m.leader}` : "";
}).filter(Boolean).join("\n")}

產業集中度警告：AI/伺服器佔5檔(台達電/奇鋐/緯創/晟銘電/創意)、光通訊3檔、PCB材料3檔 — 需評估集中風險

異常波動（>3%）：${anomalySummary}

待觀察事件：
${eventSummary}

${ (() => {
  // 智慧引用：只引用當前持倉相關的研究，且優先最近的
  const holdingCodes = new Set(H.map(h => h.code));
  const allResearch = researchHistory || [];
  // 先過濾出跟持倉有關的研究
  const relevant = allResearch.filter(r => holdingCodes.has(r.code));
  // 再加上最近 2 份不相關的研究（可能是 watchlist 的）
  const nonRelevant = allResearch.filter(r => !holdingCodes.has(r.code)).slice(0, 2);
  const toShow = [...relevant, ...nonRelevant].slice(0, 8);
  if (toShow.length === 0) return "";
  // 異常波動的股票研究要特別標註
  const anomalyCodes = new Set(anomalies.map(a => a.code));
  return `
══ 深度研究摘要（持倉相關優先）══
${toShow.map(r => {
  const isAnomalyStock = anomalyCodes.has(r.code);
  const lastRound = r.rounds?.[r.rounds.length - 1];
  const conclusion = lastRound?.content?.match(/(?:結論|建議|策略)[：:]\s*(.{0,300})/)?.[1]
    || lastRound?.content?.slice(0, 300) || "";
  const flag = isAnomalyStock ? " ⚡今日異常波動" : "";
  return `[${r.date}] ${r.name}(${r.code})${flag}
結論：${conclusion}${conclusion.length >= 300 ? "..." : ""}`;
}).join("\n\n")}
══════════════════════════
`;
})()}
請分析今日收盤表現，事件連動，並給出策略建議。
特別注意：
1. 每檔股票必須標注適合的持有週期（短/中/長期）和對應策略
2. 指出產業重複風險和建議調整方向
3. 區分龍頭股（核心持有）vs 衛星/戰術配置的不同操作建議
4. 特別注意策略大腦中的歷史教訓
5. 如果有深度研究結果，結合研究結論給出更精準的操作建議。
6. 在 BRAIN_UPDATE 段落中，基於今日分析更新策略大腦的規則和教訓。

預測命中率：${(() => { const NE = newsEvents || NEWS_EVENTS; const pe = NE.filter(isClosedEvent); const h2 = pe.filter(e => e.correct === true).length; const t2 = pe.filter(e => e.correct !== null).length; return `${h2}/${t2}`; })()}`
          })
        });
        const aiData = await aiRes.json();
        if (!aiRes.ok) {
          throw new Error(aiData?.detail || aiData?.error || `AI 分析失敗 (${aiRes.status})`);
        }
        const rawInsight = aiData.content?.[0]?.text || null;
        if (!rawInsight) {
          aiError = "AI 有回應，但沒有產出可顯示的文字內容";
        } else {
          let displayText = rawInsight;

          // 提取結構化事件評估 JSON
          const eventMatch = displayText.match(/## 📋 EVENT_ASSESSMENTS[\s\S]*?```json\s*([\s\S]*?)```/);
          if (eventMatch) {
            try {
              const assessments = JSON.parse(eventMatch[1].trim());
              if (Array.isArray(assessments)) eventAssessments = assessments;
            } catch (parseErr) { console.warn("事件評估 JSON 解析失敗:", parseErr); }
          }

          // 提取策略大腦更新 JSON（合併呼叫：分析+大腦進化一次完成）
          const brainMatch = displayText.match(/## 🧬 BRAIN_UPDATE[\s\S]*?```json\s*([\s\S]*?)```/);
          if (brainMatch) {
            try {
              const brainJson = JSON.parse(brainMatch[1].trim());
              if (brainJson && typeof brainJson === "object" && brainJson.rules) {
                const newBrain = mergeBrainPreservingCoachLessons(brainJson, strategyBrain);
                setStrategyBrain(newBrain);
                brainUpdatedInline = true;
              }
            } catch (parseErr) { console.warn("大腦更新 JSON 解析失敗:", parseErr); }
          }

          // 移除 JSON 段落，只顯示人類可讀的分析
          aiInsight = displayText
            .replace(/## 📋 EVENT_ASSESSMENTS[\s\S]*?(?=## 🧬 BRAIN_UPDATE|$)/, "")
            .replace(/## 🧬 BRAIN_UPDATE[\s\S]*$/, "")
            .trim();
        }
      } catch (e) {
        console.error("AI 分析失敗:", e);
        aiError = e?.message || "AI 分析失敗";
      }

      // 7. 組裝報告
      const report = {
        id: Date.now(),
        date: today,
        time: new Date().toLocaleTimeString("zh-TW", { hour: "2-digit", minute: "2-digit" }),
        totalTodayPnl,
        changes,
        anomalies,
        eventCorrelations,
        needsReview,
        aiInsight,
        aiError,
        eventAssessments,
      };

      setDailyReport(report);
      setAnalysisHistory(prev => [report, ...(prev || []).filter(r => r.date !== today)].slice(0, 30));

      // 同步分析報告到雲端（不管大腦進化成不成功都要存）
      if (canUseCloud) {
        fetch("/api/brain", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "save-analysis", data: report })
        }).catch(() => {});
      }

      // 8. 策略大腦進化 — 已合併到主要 AI 呼叫（BRAIN_UPDATE 段）
      //    如果合併呼叫成功提取了 brain JSON，則跳過額外 API call
      if (aiInsight && !brainUpdatedInline) {
        setAnalyzeStep("策略大腦進化中（fallback）...");
        try {
          const NE2 = newsEvents || NEWS_EVENTS;
          const pastEvents = NE2.filter(isClosedEvent);
          const hits2 = pastEvents.filter(e => e.correct === true).length;
          const total2 = pastEvents.filter(e => e.correct !== null).length;

          const brainRes = await fetch("/api/analyze", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              systemPrompt: `你是策略知識庫管理器。根據今日分析結果，更新策略大腦。
回傳**純JSON**格式（不要markdown code block），結構：
{"rules":["規則1","規則2",...],"lessons":[{"date":"日期","text":"教訓"}],"commonMistakes":["錯誤1",...],"stats":{"hitRate":"X/Y","totalAnalyses":N},"lastUpdate":"日期"}

規則：基於累積經驗的核心交易策略（最多15條，去掉過時的）
教訓：今日新增的具體教訓（只加新的，保留舊的）
常犯錯誤：反覆出現的錯誤模式`,
              userPrompt: `今日分析：
${aiInsight}

現有策略大腦：
${JSON.stringify(strategyBrain || { rules: [], lessons: [], commonMistakes: [], stats: {} })}

預測命中率：${hits2}/${total2}
今日損益：${totalTodayPnl >= 0 ? "+" : ""}${totalTodayPnl.toLocaleString()} 元

請更新策略大腦，保留有效的舊規則，加入今日新教訓。`
            })
          });
          const brainData = await brainRes.json();
          const brainText = brainData.content?.[0]?.text || "";
          const cleanBrain = brainText.replace(/```json|```/g, "").trim();
          const newBrain = mergeBrainPreservingCoachLessons(JSON.parse(cleanBrain), strategyBrain);
          setStrategyBrain(newBrain);
        } catch (e) {
          console.error("策略大腦更新失敗（fallback）:", e);
        }
      }

      // 同步更新持倉價格
      setHoldings(prev => (prev || []).map(h => {
        const pm = priceMap[h.code];
        if (!pm) return h;
        const newValue = Math.round(pm.price * h.qty);
        const newPnl = Math.round((pm.price - h.cost) * h.qty);
        const newPct = Math.round((pm.price / h.cost - 1) * 10000) / 100;
        return { ...h, price: pm.price, value: newValue, pnl: newPnl, pct: newPct };
      }));

      setLastUpdate(new Date());
    } catch (err) {
      console.error("收盤分析失敗:", err);
      setSaved("❌ 分析失敗");
      setTimeout(() => setSaved(""), 3000);
    }
    setAnalyzing(false);
    setAnalyzeStep("");
  };

  // ── 事件復盤 ─────────────────────────────────────────────────────
  const submitReview = async (eventId) => {
    const NE = newsEvents || NEWS_EVENTS;
    const evt = NE.find(e => e.id === eventId);
    const submittedForm = { ...reviewForm };
    const wasCorrect = evt ? evt.pred === submittedForm.actual : null;

    setNewsEvents(prev => {
      const arr = normalizeNewsEvents(prev || NEWS_EVENTS);
      const idx = arr.findIndex(e => e.id === eventId);
      if (idx < 0) return arr;
      arr[idx] = {
        ...arr[idx],
        status: "closed",
        exitDate: submittedForm.exitDate || arr[idx].exitDate || toSlashDate(),
        priceAtExit: submittedForm.priceAtExit || arr[idx].priceAtExit || null,
        actual: submittedForm.actual,
        actualNote: submittedForm.actualNote,
        correct: arr[idx].pred === submittedForm.actual,
        lessons: submittedForm.lessons,
        reviewDate: new Date().toLocaleDateString("zh-TW"),
      };
      return arr;
    });
    setReviewingEvent(null);
    const savedLessons = submittedForm.lessons;
    const savedNote = submittedForm.actualNote;
    setReviewForm(createDefaultReviewForm());
    setSaved("✅ 復盤已儲存，策略整合中...");

    if (evt && (savedLessons || savedNote)) {
      appendCoachLessonToOwnerBrain({ event: evt, note: savedNote, lesson: savedLessons }).catch(err => {
        console.error("同步 coachLessons 失敗:", err);
      });
    }

    // 將復盤心得整合進策略大腦（AI 驗證+歸納）
    if (evt && (savedLessons || savedNote)) {
      try {
        const currentBrain = normalizeStrategyBrain(strategyBrain, { allowEmpty: true });
        const notesContext = formatPortfolioNotesContext(portfolioNotes);
        const brainRes = await fetch("/api/analyze", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            systemPrompt: `你是策略知識庫管理器。用戶剛完成一筆事件復盤，你要：
1. 評估用戶的覆盤心得是否合理（用戶不一定正確，需要糾正偏差）
2. 從這次復盤中提取可學習的策略教訓
3. 更新策略大腦的規則和教訓

回傳**純JSON**格式（不要markdown code block），結構：
{"rules":[...],"lessons":[{"date":"日期","text":"教訓"}],"commonMistakes":[...],"stats":{"hitRate":"X/Y","totalAnalyses":N},"lastUpdate":"日期","reviewFeedback":"給用戶的一句話反饋：覆盤是否合理？有什麼盲點？"}`,
            userPrompt: `事件：${evt.title}
${notesContext}
預測：${evt.pred==="up"?"看漲":evt.pred==="down"?"看跌":"中性"} — ${evt.predReason}
實際走勢：${submittedForm.actual==="up"?"上漲":submittedForm.actual==="down"?"下跌":"中性"} — ${savedNote}
預測${wasCorrect?"正確":"錯誤"}
用戶覆盤心得：${savedLessons || "（未填）"}

現有策略大腦：
${JSON.stringify(currentBrain)}

請更新策略大腦，特別注意：用戶的覆盤不一定客觀，如果有歸因偏差請指出。`
          })
        });
        const brainData = await brainRes.json();
        const brainText = brainData.content?.[0]?.text || "";
        const cleanBrain = brainText.replace(/```json|```/g, "").trim();
        const rawBrain = JSON.parse(cleanBrain);
        const feedback = rawBrain.reviewFeedback;
        delete rawBrain.reviewFeedback;
        const newBrain = mergeBrainPreservingCoachLessons(rawBrain, currentBrain);
        setStrategyBrain(newBrain);
        setSaved(feedback ? `🧠 ${feedback}` : "✅ 策略大腦已更新");
        setTimeout(() => setSaved(""), 6000);
      } catch (e) {
        console.error("復盤整合策略大腦失敗:", e);
        setSaved("✅ 復盤已儲存");
        setTimeout(() => setSaved(""), 2500);
      }
    } else {
      setTimeout(() => setSaved(""), 2500);
    }
  };

  // ── 大腦整理（遺忘/合併/淘汰過時教訓）─────────────────────────
  const [brainCleaning, setBrainCleaning] = useState(false);
  const cleanupBrain = async () => {
    if (brainCleaning || !strategyBrain) return;
    setBrainCleaning(true);
    try {
      const brain = strategyBrain;
      const lessonCount = (brain.lessons || []).length;
      const coachCount = (brain.coachLessons || []).length;
      const ruleCount = (brain.rules || []).length;

      const res = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          systemPrompt: `你是策略知識庫整理器。用戶的策略大腦已累積大量規則和教訓，你要進行一次全面整理。

任務：
1. 規則（rules）：合併重複的規則，刪除矛盾的規則，保留最有效的。最多 12 條。
2. 教訓（lessons）：合併類似的教訓，淘汰超過 90 天且不再適用的教訓。保留最近 30 條。
3. 常犯錯誤（commonMistakes）：去重合併，保留仍然需要警惕的。最多 5 條。
4. 跨組合教練教訓（coachLessons）：超過 180 天的降級，只保留最近 50 條。
5. 產生一份「整理摘要」說明你做了什麼改動。

回傳**純JSON**格式：
{"rules":[...],"lessons":[{"date":"","text":""}],"commonMistakes":[...],"coachLessons":[原始格式保留],"stats":{保持原有},"lastUpdate":"今日日期","cleanupSummary":"整理摘要"}`,
          userPrompt: `今日日期：${toSlashDate()}

目前策略大腦：
${JSON.stringify(brain)}

統計：
- ${ruleCount} 條規則
- ${lessonCount} 條教訓
- ${coachCount} 條跨組合教訓
- ${(brain.commonMistakes || []).length} 條常犯錯誤

請進行全面整理，重點淘汰過時的教訓，合併重複規則。`
        })
      });
      const data = await res.json();
      const text = data.content?.[0]?.text || "";
      const cleanText = text.replace(/```json|```/g, "").trim();
      const newBrain = mergeBrainPreservingCoachLessons(JSON.parse(cleanText), brain);
      const summary = newBrain.cleanupSummary || "整理完成";
      delete newBrain.cleanupSummary;
      setStrategyBrain(newBrain);
      setSaved(`🧹 ${summary}`);
      setTimeout(() => setSaved(""), 6000);
    } catch (err) {
      console.error("大腦整理失敗:", err);
      setSaved("❌ 大腦整理失敗");
      setTimeout(() => setSaved(""), 3000);
    }
    setBrainCleaning(false);
  };

  // ── 新增事件 ─────────────────────────────────────────────────────
  const addEvent = () => {
    if (!newEvent.title.trim() || !newEvent.date.trim()) return;
    const evt = normalizeEventRecord({
      id: Date.now(),
      date: newEvent.date,
      status: "pending",
      title: newEvent.title,
      detail: newEvent.detail,
      stocks: newEvent.stocks.split(/[,，、]/).map(s => s.trim()).filter(Boolean),
      pred: newEvent.pred,
      predReason: newEvent.predReason,
      eventDate: null,
      trackingStart: null,
      exitDate: null,
      priceAtEvent: null,
      priceAtExit: null,
      priceHistory: [],
      actual: null,
      actualNote: "",
      correct: null,
      lessons: "",
      reviewDate: null,
    });
    setNewsEvents(prev => normalizeNewsEvents([...(prev || NEWS_EVENTS), evt]));
    setNewEvent(createDefaultEventDraft());
    setShowAddEvent(false);
    setSaved("✅ 事件已新增");
    setTimeout(() => setSaved(""), 2500);
  };

  // ── 反轉條件更新 ─────────────────────────────────────────────────
  const updateReversal = (code, conditions) => {
    setReversalConditions(prev => ({
      ...(prev || {}),
      [code]: { ...conditions, updatedAt: new Date().toLocaleDateString("zh-TW") },
    }));
    setSaved("✅ 反轉條件已儲存");
    setTimeout(() => setSaved(""), 2500);
  };

  // ── 生成週報素材（供 Podcast / Claude.ai 使用）────────────────
  const generateWeeklyReport = () => {
    const today = new Date().toLocaleDateString("zh-TW");
    const NE = newsEvents || NEWS_EVENTS;
    const pastEvents = NE.filter(isClosedEvent);
    const pendingEvents = NE.filter(e => !isClosedEvent(e));
    const hits = pastEvents.filter(e => e.correct === true).length;
    const total = pastEvents.filter(e => e.correct !== null).length;

    // 持倉摘要
    const holdingLines = H.map(h =>
      `${h.name}(${h.code}) | 現價${h.price} | 成本${h.cost} | 損益${h.pnl>=0?"+":""}${h.pnl}(${h.pct>=0?"+":""}${h.pct}%) | ${h.type}`
    ).join("\n");

    // 近期分析
    const recentAnalyses = (analysisHistory || []).slice(0, 7).map(r =>
      `【${r.date} ${r.time}】損益${r.totalTodayPnl>=0?"+":""}${r.totalTodayPnl}\n${r.aiInsight ? r.aiInsight.slice(0, 500) + (r.aiInsight.length > 500 ? "..." : "") : "（無 AI 分析）"}`
    ).join("\n\n---\n\n");

    // 事件預測紀錄
    const eventLines = pastEvents.map(e =>
      `[${e.correct?"✓準確":"✗失誤"}] ${e.date} ${e.title}\n  預測：${e.pred==="up"?"看漲":e.pred==="down"?"看跌":"中性"} | 結果：${e.actualNote}`
    ).join("\n");

    const pendingLines = pendingEvents.map(e =>
      `[⏳] ${e.date} ${e.title}\n  預測：${e.pred==="up"?"看漲":e.pred==="down"?"看跌":"中性"} | 理由：${e.predReason}`
    ).join("\n");

    // 策略大腦
    const brain = strategyBrain;
    const brainSection = brain ? `
## 策略大腦
核心規則：
${(brain.rules||[]).map((r,i)=>`${i+1}. ${r}`).join("\n")}

常犯錯誤：${(brain.commonMistakes||[]).join("、")||"無"}
命中率：${brain.stats?.hitRate||"計算中"}
累計分析次數：${brain.stats?.totalAnalyses||0}

最近教訓：
${(brain.lessons||[]).slice(-5).map(l=>`- [${l.date}] ${l.text}`).join("\n")}` : "";

    const report = `# 持倉看板週報素材
生成日期：${today}
總成本：${totalCost.toLocaleString()} | 總市值：${totalVal.toLocaleString()} | 損益：${totalPnl>=0?"+":""}${totalPnl.toLocaleString()}（${retPct>=0?"+":""}${retPct.toFixed(2)}%）
持股數：${H.length} 檔 | 事件預測命中率：${total>0?Math.round(hits/total*100)+"%（"+hits+"/"+total+"）":"尚無數據"}

## 持倉明細
${holdingLines}

## 觀察股
${W.length > 0 ? W.map(w=>`${w.name}(${w.code}) | 現價${w.price} | 目標${w.target || "未設定"} | 狀態：${w.status || "觀察中"}`).join("\n") : "無"}

## 事件預測紀錄
已驗證（${pastEvents.length} 筆）：
${eventLines || "無"}

待處理（${pendingEvents.length} 筆）：
${pendingLines || "無"}
${brainSection}

## 近 7 日收盤分析
${recentAnalyses || "尚無分析紀錄"}

---
以上為持倉看板自動生成的週報素材，請根據這些數據撰寫 Podcast 腳本。`;

    return report;
  };

  const copyWeeklyReport = async () => {
    const report = generateWeeklyReport();
    try {
      await navigator.clipboard.writeText(report);
      setSaved("✅ 週報素材已複製到剪貼簿");
    } catch {
      // fallback
      const ta = document.createElement("textarea");
      ta.value = report; document.body.appendChild(ta); ta.select();
      document.execCommand("copy"); document.body.removeChild(ta);
      setSaved("✅ 週報素材已複製");
    }
    setTimeout(() => setSaved(""), 3000);
  };

  const exportLocalBackup = () => {
    try {
      const storage = collectPortfolioBackupStorage();
      storage[PORTFOLIOS_KEY] = portfolios;
      storage[ACTIVE_PORTFOLIO_KEY] = activePortfolioId;
      storage[VIEW_MODE_KEY] = viewMode;
      storage[SCHEMA_VERSION_KEY] = CURRENT_SCHEMA_VERSION;

      const liveSnapshot = {
        holdings,
        tradeLog,
        targets,
        newsEvents,
        analysisHistory,
        dailyReport,
        reversalConditions,
        strategyBrain,
        researchHistory,
        portfolioNotes,
      };

      for (const [alias, value] of Object.entries(liveSnapshot)) {
        const suffix = PORTFOLIO_ALIAS_TO_SUFFIX[alias];
        if (!suffix || value === undefined) continue;
        storage[pfKey(activePortfolioId, suffix)] = value;
      }

      if (Object.keys(storage).length === 0) {
        setSaved("⚠️ 目前沒有可匯出的本機資料");
        setTimeout(() => setSaved(""), 3000);
        return;
      }
      downloadJson(`portfolio-backup-${new Date().toISOString().slice(0, 10)}.json`, {
        version: 1,
        app: "portfolio-dashboard",
        exportedAt: new Date().toISOString(),
        origin: window.location.origin,
        storage,
      });
      setSaved("✅ 本機備份已匯出");
      setTimeout(() => setSaved(""), 3000);
    } catch (err) {
      console.error("匯出備份失敗:", err);
      setSaved("❌ 匯出失敗");
      setTimeout(() => setSaved(""), 3000);
    }
  };

  const importLocalBackup = async (ev) => {
    const file = ev.target.files?.[0];
    ev.target.value = "";
    if (!file) return;
    if (!confirm("匯入會覆蓋這個瀏覽器目前的本機資料；未包含在備份檔內的項目不會被改動。確定繼續？")) return;

    let nextPid = activePortfolioId;
    try {
      const text = await file.text();
      const parsed = JSON.parse(text);
      const storage = normalizeBackupStorage(parsed);

      if (!storage || Object.keys(storage).length === 0) {
        throw new Error("備份檔內沒有可識別的資料");
      }

      const normalizedStorage = { ...storage };
      const importedPortfolios = buildPortfoliosFromStorage(normalizedStorage);
      normalizedStorage[PORTFOLIOS_KEY] = importedPortfolios;
      normalizedStorage[ACTIVE_PORTFOLIO_KEY] =
        typeof normalizedStorage[ACTIVE_PORTFOLIO_KEY] === "string" &&
        importedPortfolios.some(item => item.id === normalizedStorage[ACTIVE_PORTFOLIO_KEY])
          ? normalizedStorage[ACTIVE_PORTFOLIO_KEY]
          : OWNER_PORTFOLIO_ID;
      normalizedStorage[VIEW_MODE_KEY] = PORTFOLIO_VIEW_MODE;
      normalizedStorage[SCHEMA_VERSION_KEY] = CURRENT_SCHEMA_VERSION;

      portfolioTransitionRef.current = {
        isHydrating: true,
        fromPid: activePortfolioId,
        toPid: normalizedStorage[ACTIVE_PORTFOLIO_KEY],
      };

      for (const [key, value] of Object.entries(normalizedStorage)) {
        await save(key, value);
      }

      const registry = await ensurePortfolioRegistry();
      nextPid = registry.activePortfolioId;
      const snapshot = await loadPortfolioSnapshot(nextPid);

      setPortfolios(registry.portfolios);
      setActivePortfolioId(nextPid);
      setViewMode(registry.viewMode);
      applyPortfolioSnapshot(snapshot);

      const cloudEnabled = registry.viewMode === PORTFOLIO_VIEW_MODE && nextPid === OWNER_PORTFOLIO_ID;
      cloudSyncStateRef.current = {
        enabled: cloudEnabled,
        syncedAt: cloudEnabled ? readSyncAt("pf-cloud-sync-at") : 0,
      };
      setCloudSync(cloudEnabled);

      setSaved(`✅ 已匯入 ${Object.keys(normalizedStorage).length} 項本機資料`);
      setTimeout(() => setSaved(""), 4000);
    } catch (err) {
      console.error("匯入備份失敗:", err);
      alert(`匯入失敗：${err.message || "JSON 格式不正確"}`);
    } finally {
      portfolioTransitionRef.current = {
        isHydrating: false,
        fromPid: nextPid,
        toPid: nextPid,
      };
    }
  };

  // 收盤分析完全手動觸發，不自動執行

  // file
  const processFile = (file) => {
    if (!file?.type.startsWith("image/")) return;
    setImg(URL.createObjectURL(file));
    setParsed(null); setParseErr(null);
    setMemoStep(0); setMemoAns([]); setMemoIn("");
    const r = new FileReader();
    r.onload = e => setB64(e.target.result.split(",")[1]);
    r.readAsDataURL(file);
  };

  const parseShot = async () => {
    if (!b64) return;
    setParsing(true); setParseErr(null);
    try {
      const res = await fetch("/api/parse", {
        method:"POST",
        headers:{"Content-Type":"application/json"},
        body: JSON.stringify({
          systemPrompt: PARSE_PROMPT,
          base64: b64,
          mediaType: "image/jpeg",
        })
      });
      const data = await res.json();
      const clean = (data.content?.[0]?.text||"").replace(/```json|```/g,"").trim();
      setParsed(JSON.parse(clean));
    } catch { setParseErr("解析失敗，請確認截圖清晰"); }
    finally  { setParsing(false); }
  };

  const submitMemo = () => {
    if (!parsed?.trades?.length) return;
    const t = parsed.trades[0];
    const qs = MEMO_Q[t.action]||MEMO_Q["買進"];
    const ans = [...memoAns, memoIn];
    setMemoIn("");
    if (memoStep < qs.length-1) { setMemoAns(ans); setMemoStep(memoStep+1); return; }

    const entry = {
      id:Date.now(),
      date:new Date().toLocaleDateString("zh-TW"),
      time:new Date().toLocaleTimeString("zh-TW",{hour:"2-digit",minute:"2-digit"}),
      action:t.action, code:t.code, name:t.name, qty:t.qty, price:t.price,
      qa: qs.map((q,i)=>({q, a:ans[i]||""})),
    };
    setTradeLog(prev=>[entry,...(prev||[])]);

    setHoldings(prev=>{
      const arr=[...(prev||[])];
      const idx=arr.findIndex(h=>h.code===t.code);
      if (t.action==="買進") {
        if (idx>=0) {
          const h=arr[idx];
          const nq=h.qty+t.qty;
          const nc=(h.cost*h.qty+t.price*t.qty)/nq;
          arr[idx]={...h, qty:nq, price:t.price, cost:Math.round(nc*100)/100,
            value:t.price*nq, pnl:Math.round((t.price-nc)*nq),
            pct:Math.round((t.price/nc-1)*10000)/100};
        } else {
          arr.push({code:t.code,name:t.name,qty:t.qty,price:t.price,cost:t.price,
            value:t.price*t.qty,pnl:0,pct:0,type:"股票"});
        }
      } else {
        if (idx>=0) {
          const h=arr[idx]; const nq=Math.max(0,h.qty-t.qty);
          if(nq===0){arr.splice(idx,1);}
          else{arr[idx]={...h,qty:nq,price:t.price,value:t.price*nq,
            pnl:Math.round((t.price-h.cost)*nq),pct:Math.round((t.price/h.cost-1)*10000)/100};}
        }
      }
      return arr;
    });

    setSaved("✅ 已儲存");
    setTimeout(()=>setSaved(""),2500);

    // 若截圖含目標價更新
    if (parsed.targetPriceUpdates?.length) {
      setTargets(prev => {
        const updated = {...(prev||{})};
        parsed.targetPriceUpdates.forEach(u => {
          const existing = updated[u.code] || {reports:[]};
          const already  = existing.reports.find(r=>r.firm===u.firm);
          const newReport = {firm:u.firm, target:u.target, date:u.date||new Date().toLocaleDateString("zh-TW")};
          const newReports = already
            ? existing.reports.map(r=>r.firm===u.firm ? newReport : r)
            : [...existing.reports, newReport];
          updated[u.code] = { reports:newReports, updatedAt:new Date().toLocaleDateString("zh-TW"), isNew:true };
        });
        return updated;
      });
    }

    setImg(null); setB64(null); setParsed(null);
    setMemoStep(0); setMemoAns([]); setMemoIn("");
    setTab("holdings");
  };

  const qs = parsed?.trades?.[0] ? (MEMO_Q[parsed.trades[0].action]||MEMO_Q["買進"]) : [];

  if (!ready) return (
    <div style={{background:C.bg,minHeight:"100vh",display:"flex",
      alignItems:"center",justifyContent:"center",color:C.textMute,
      fontFamily:"sans-serif",fontSize:13}}>載入中...</div>
  );

  const runResearch = async (mode, targetStock) => {
    if (researching) return;
    setResearching(true);
    setResearchTarget(mode === "evolve" ? "EVOLVE" : mode === "single" ? targetStock?.code : "PORTFOLIO");
    try {
      const stocks = mode === "single" && targetStock
        ? [targetStock]
        : H.map(h => ({ code:h.code, name:h.name, price:h.price, cost:h.cost, pnl:h.pnl, pct:h.pct, type:h.type }));
      const body = {
        stocks,
        holdings: H,
        meta: STOCK_META,
        brain: strategyBrain,
        mode,
        persist: canUseCloud,
      };
      // evolve 模式需要事件紀錄和分析歷史
      if (mode === "evolve") {
        body.events = (newsEvents || []).slice(0, 20);
        body.analysisHistory = (analysisHistory || []).slice(0, 10);
      }
      const res = await fetch("/api/research", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (data.results?.length > 0) {
        const result = data.results[0];
        setResearchResults(result);
        setResearchHistory(prev => [result, ...(prev||[])].slice(0, 30));
        // evolve 模式：自動更新策略大腦
        if (mode === "evolve" && result.newBrain) {
          setStrategyBrain(mergeBrainPreservingCoachLessons(result.newBrain, strategyBrain));
          setSaved("✅ 系統進化完成 · 策略大腦已更新");
        } else {
          setSaved("✅ 研究完成");
        }
      } else {
        setSaved("⚠️ 研究無結果");
      }
    } catch (e) {
      console.error("AutoResearch failed:", e);
      setSaved("❌ 研究失敗");
    }
    setResearching(false);
    setTimeout(() => setSaved(""), 3000);
  };

  const TABS = [
    {k:"holdings", label:"持倉"},
    {k:"watchlist",label:"觀察股"},
    {k:"events",   label:`行事曆${urgentCount>0?" ·":""}`},
    {k:"news",     label:"事件分析"},
    {k:"daily",    label:analyzing?"分析中...":"收盤分析"},
    {k:"research", label:researching?"研究中...":"深度研究"},
    {k:"trade",    label:"上傳成交"},
    {k:"log",      label:"交易日誌"},
  ];

  return (
    <div style={{background:C.bg,minHeight:"100vh",color:C.text,
      fontFamily:"'Inter','Noto Sans TC',system-ui,sans-serif",paddingBottom:40}}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap');
        *{box-sizing:border-box}
        html{-webkit-text-size-adjust:100%}
        body{-webkit-tap-highlight-color:transparent;overscroll-behavior:none;background:${C.bg}}
        textarea::placeholder,input::placeholder{color:${C.textMute}}
        input,textarea,button{font-family:inherit;-webkit-appearance:none}
        /* tabular numbers for financial data */
        .tn{font-variant-numeric:tabular-nums}
        @keyframes pulse{0%,100%{opacity:1}50%{opacity:0.5}}
        @keyframes progress{0%{width:5%}50%{width:70%}100%{width:95%}}
        @keyframes shimmer{0%{background-position:-200% 0}100%{background-position:200% 0}}
        /* subtle card hover */
        .card-h:hover{border-color:${C.borderStrong}!important;background:${C.cardHover}!important}
        .card-h{transition:all 0.15s ease}
        /* smooth chip buttons */
        button{-webkit-tap-highlight-color:transparent}
        .ui-btn{transition:transform 0.18s ease, background-color 0.18s ease, border-color 0.18s ease, color 0.18s ease, box-shadow 0.18s ease}
        .ui-btn:hover:not(:disabled){transform:translateY(-1px);box-shadow:${C.focusRing}}
        .ui-card{transition:transform 0.18s ease, border-color 0.18s ease, background-color 0.18s ease, box-shadow 0.18s ease}
        .ui-card:hover{transform:translateY(-1px);border-color:${C.borderStrong};background:${C.cardHover}}
        .seg{scrollbar-width:none}
        .seg::-webkit-scrollbar{display:none}
        /* scroll smooth */
        html{scroll-behavior:smooth}
        /* prettier scrollbar */
        ::-webkit-scrollbar{width:4px;height:4px}
        ::-webkit-scrollbar-track{background:transparent}
        ::-webkit-scrollbar-thumb{background:${C.borderStrong};border-radius:4px}
        @media(max-width:480px){
          body{font-size:14px}
        }
        @media(min-width:768px){
          body{font-size:16px}
          .app-shell{max-width:720px;margin:0 auto;zoom:1.15}
        }
        @media(min-width:1200px){
          .app-shell{max-width:800px;zoom:1.25}
        }
      `}</style>

      {/* ── HEADER ── */}
      <div className="app-shell" style={{background:`${C.shell}f0`,borderBottom:`1px solid ${C.borderSoft}`,
        padding:"10px 14px 0",position:"sticky",top:0,zIndex:10,
        boxShadow:C.shellShadow,
        backdropFilter:"blur(16px) saturate(160%)",WebkitBackdropFilter:"blur(16px) saturate(160%)"}}>

        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}>
          <div style={{display:"flex",alignItems:"center",gap:8,flex:1,minWidth:0}}>
            <span style={{color:cloudSync?C.olive:C.textMute,fontSize:9}}>{cloudSync?"☁":"⚡"}</span>
            <span style={{fontSize:19,fontWeight:600,color:C.text,letterSpacing:"-0.01em"}}>持倉看板</span>
            {saved && <span style={{color:C.olive,fontSize:9,fontWeight:600}}>{saved}</span>}
            <button className="ui-btn" onClick={refreshPrices} disabled={refreshing} style={{
              background: refreshing ? C.subtle : alpha(C.blue, A.faint),
              color: refreshing ? C.textMute : C.blue,
              border:`1px solid ${refreshing ? C.border : alpha(C.blue, A.strongLine)}`,
              ...ghostBtn,
              cursor: refreshing ? "not-allowed" : "pointer",
            }}>
              {refreshing ? "更新中..." : "⟳ 刷新"}
            </button>
            <button className="ui-btn" onClick={copyWeeklyReport} style={{
              background: C.lavBg, color: C.lavender,
              border:`1px solid ${alpha(C.lavender, A.strongLine)}`,
              ...ghostBtn,
            }}>
              📋 週報
            </button>
            <button className="ui-btn" onClick={exportLocalBackup} style={{
              background: C.oliveBg, color: C.olive,
              border:`1px solid ${alpha(C.olive, A.strongLine)}`,
              ...ghostBtn,
            }}>
              備份
            </button>
            <button className="ui-btn" onClick={() => backupFileInputRef.current?.click()} style={{
              background: C.subtle, color: C.textSec,
              border:`1px solid ${C.border}`,
              ...ghostBtn,
            }}>
              匯入
            </button>
            <input
              ref={backupFileInputRef}
              type="file"
              accept="application/json,.json"
              onChange={importLocalBackup}
              style={{ display: "none" }}
            />
            {lastUpdate && !refreshing && (
              <span style={{fontSize:9,color:C.textMute}}>
                {lastUpdate.toLocaleTimeString("zh-TW",{hour:"2-digit",minute:"2-digit"})}
              </span>
            )}
          </div>
          <div className="tn" style={{textAlign:"right",flexShrink:0,paddingLeft:8}}>
            <div style={{fontSize:20,fontWeight:700,color:pc(displayedTotalPnl),letterSpacing:"-0.02em",lineHeight:1.1}}>
              {displayedTotalPnl>=0?"+":""}{Math.round(displayedTotalPnl).toLocaleString()}
            </div>
            <div style={{fontSize:10,fontWeight:600,color:pc(displayedRetPct)}}>
              {displayedRetPct>=0?"+":""}{displayedRetPct.toFixed(2)}%
            </div>
          </div>
        </div>

        <div style={{display:"flex",alignItems:"center",gap:8,flexWrap:"wrap",marginBottom:8}}>
          <span style={{fontSize:9,color:C.textMute,fontWeight:600,letterSpacing:"0.05em"}}>目前組合</span>
          <select
            value={activePortfolioId}
            onChange={e => switchPortfolio(e.target.value)}
            disabled={!ready || portfolioSwitching}
            style={{
              minWidth:190,
              background:C.subtle,
              color:C.text,
              border:`1px solid ${C.border}`,
              borderRadius:8,
              padding:"7px 10px",
              fontSize:11,
              outline:"none",
              cursor: portfolioSwitching ? "progress" : "pointer",
            }}
          >
            {portfolioSummaries.map(portfolio => (
              <option key={portfolio.id} value={portfolio.id}>
                {portfolio.name} · {portfolio.holdingCount}檔 · {portfolio.retPct >= 0 ? "+" : ""}{portfolio.retPct.toFixed(1)}%
              </option>
            ))}
          </select>
          <button
            className="ui-btn"
            onClick={createPortfolio}
            disabled={!ready || portfolioSwitching}
            style={{
              background:C.cardBlue,
              color:C.blue,
              border:`1px solid ${alpha(C.blue, A.strongLine)}`,
              ...ghostBtn,
              cursor: !ready || portfolioSwitching ? "not-allowed" : "pointer",
            }}
          >
            {portfolioSwitching ? "切換中..." : "＋ 新組合"}
          </button>
          <button
            className="ui-btn"
            onClick={viewMode === OVERVIEW_VIEW_MODE ? exitOverview : openOverview}
            disabled={!ready || portfolioSwitching}
            style={{
              background:viewMode === OVERVIEW_VIEW_MODE ? C.cardAmber : C.cardRose,
              color:viewMode === OVERVIEW_VIEW_MODE ? C.amber : C.text,
              border:`1px solid ${viewMode === OVERVIEW_VIEW_MODE ? alpha(C.amber, A.strongLine) : C.border}`,
              ...ghostBtn,
              cursor: !ready || portfolioSwitching ? "not-allowed" : "pointer",
            }}
          >
            {viewMode === OVERVIEW_VIEW_MODE ? "返回組合" : "全部總覽"}
          </button>
          <button
            className="ui-btn"
            onClick={() => setShowPortfolioManager(prev => !prev)}
            style={{
              background:showPortfolioManager ? C.subtleElev : C.subtle,
              color:C.textSec,
              border:`1px solid ${showPortfolioManager ? C.borderStrong : C.border}`,
              ...ghostBtn,
            }}
          >
            {showPortfolioManager ? "收合管理" : "管理組合"}
          </button>
          {activePortfolio && (
            <span style={{fontSize:10,color:C.textSec}}>
              {viewMode === OVERVIEW_VIEW_MODE
                ? `全部總覽 · ${portfolios.length} 組合 · 總市值 ${Math.round(overviewTotalValue).toLocaleString()}`
                : `${activePortfolio.name} · ${activePortfolio.holdingCount} 檔 · 損益 ${activePortfolio.totalPnl >= 0 ? "+" : ""}${Math.round(activePortfolio.totalPnl).toLocaleString()}`}
            </span>
          )}
        </div>

        {showPortfolioManager && (
          <div style={{...card,marginBottom:8,borderLeft:`2px solid ${alpha(C.teal, A.glow)}`}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",gap:8,marginBottom:10,flexWrap:"wrap"}}>
              <div>
                <div style={{...lbl,color:C.teal,marginBottom:3}}>組合管理</div>
                <div style={{fontSize:11,color:C.textSec}}>可以改名、刪除組合，並編輯目前組合的偏好備註。</div>
              </div>
              <span style={{fontSize:9,color:C.textMute}}>總覽模式唯讀；切回單一組合才會寫入 notes。</span>
            </div>

            <div style={{display:"grid",gap:7}}>
              {portfolioSummaries.map(portfolio => (
                <div key={portfolio.id} style={{
                  background: portfolio.id === activePortfolioId ? C.subtleElev : C.subtle,
                  border:`1px solid ${portfolio.id === activePortfolioId ? C.borderStrong : C.border}`,
                  borderRadius:8,
                  padding:"10px 12px",
                }}>
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",gap:10,flexWrap:"wrap"}}>
                    <div>
                      <div style={{fontSize:12,color:C.text,fontWeight:600}}>
                        {portfolio.name}
                        {portfolio.id === OWNER_PORTFOLIO_ID && <span style={{fontSize:9,color:C.textMute,marginLeft:6}}>owner</span>}
                        {portfolio.id === activePortfolioId && <span style={{fontSize:9,color:C.teal,marginLeft:6}}>目前</span>}
                      </div>
                      <div style={{fontSize:10,color:C.textMute,marginTop:3}}>
                        {portfolio.holdingCount} 檔 · 損益 {portfolio.totalPnl >= 0 ? "+" : ""}{Math.round(portfolio.totalPnl).toLocaleString()} · 報酬 {portfolio.retPct >= 0 ? "+" : ""}{portfolio.retPct.toFixed(1)}%
                      </div>
                    </div>
                    <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
                      {(portfolio.id !== activePortfolioId || viewMode === OVERVIEW_VIEW_MODE) && (
                        <button className="ui-btn" onClick={() => switchPortfolio(portfolio.id)} style={{
                          background:C.cardBlue,color:C.blue,border:`1px solid ${alpha(C.blue, A.strongLine)}`,
                          ...ghostBtn,
                        }}>
                          打開
                        </button>
                      )}
                      <button className="ui-btn" onClick={() => renamePortfolio(portfolio.id)} style={{
                        background:C.cardAmber,color:C.amber,border:`1px solid ${alpha(C.amber, A.strongLine)}`,
                        ...ghostBtn,
                      }}>
                        改名
                      </button>
                      {portfolio.id !== OWNER_PORTFOLIO_ID && (
                        <button className="ui-btn" onClick={() => deletePortfolio(portfolio.id)} style={{
                          background:C.upBg,color:C.up,border:`1px solid ${alpha(C.up, A.strongLine)}`,
                          ...ghostBtn,
                        }}>
                          刪除
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {viewMode === PORTFOLIO_VIEW_MODE ? (
              <div style={{marginTop:12,paddingTop:12,borderTop:`1px solid ${C.borderSub}`}}>
                <div style={{...lbl,marginBottom:8}}>目前組合備註</div>
                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:8}}>
                  <div>
                    <div style={{fontSize:9,color:C.textMute,marginBottom:3}}>風險屬性</div>
                    <input
                      value={portfolioNotes.riskProfile || ""}
                      onChange={e => setPortfolioNotes(prev => ({ ...prev, riskProfile: e.target.value }))}
                      placeholder="如：保守、波段、可接受回撤"
                      style={{width:"100%",background:C.subtle,border:`1px solid ${C.border}`,borderRadius:7,padding:"8px 10px",color:C.text,fontSize:11,outline:"none",fontFamily:"inherit"}}
                    />
                  </div>
                  <div>
                    <div style={{fontSize:9,color:C.textMute,marginBottom:3}}>操作偏好</div>
                    <input
                      value={portfolioNotes.preferences || ""}
                      onChange={e => setPortfolioNotes(prev => ({ ...prev, preferences: e.target.value }))}
                      placeholder="如：只做財報前布局、避免權證"
                      style={{width:"100%",background:C.subtle,border:`1px solid ${C.border}`,borderRadius:7,padding:"8px 10px",color:C.text,fontSize:11,outline:"none",fontFamily:"inherit"}}
                    />
                  </div>
                </div>
                <div>
                  <div style={{fontSize:9,color:C.textMute,marginBottom:3}}>自訂備註</div>
                  <textarea
                    value={portfolioNotes.customNotes || ""}
                    onChange={e => setPortfolioNotes(prev => ({ ...prev, customNotes: e.target.value }))}
                    placeholder="這組合的策略限制、委託人要求、特殊提醒..."
                    style={{width:"100%",background:C.subtle,border:`1px solid ${C.border}`,borderRadius:7,padding:8,color:C.text,fontSize:11,resize:"vertical",minHeight:72,outline:"none",fontFamily:"inherit",lineHeight:1.7}}
                  />
                </div>
              </div>
            ) : (
              <div style={{marginTop:12,fontSize:10,color:C.textMute,background:C.subtle,border:`1px solid ${C.border}`,borderRadius:8,padding:"8px 10px",lineHeight:1.7}}>
                目前在全部總覽模式，資料維持唯讀。要編輯 notes，先用上方「打開」切回某個單一組合。
              </div>
            )}
          </div>
        )}

        {/* today alert */}
        {viewMode !== OVERVIEW_VIEW_MODE && urgentCount>0 && (
          <div style={{background:C.upBg,border:`1px solid ${alpha(C.up, A.line)}`,
            borderLeft:`3px solid ${C.up}`,
            borderRadius:6,padding:"5px 10px",marginBottom:8,
            fontSize:10,color:C.up,lineHeight:1.6,fontWeight:500}}>
            今日 · {todayAlertSummary}
          </div>
        )}

        {viewMode === OVERVIEW_VIEW_MODE ? (
          <div style={{background:C.subtle,border:`1px solid ${C.border}`,borderRadius:8,padding:"8px 10px",marginBottom:6,display:"flex",justifyContent:"space-between",alignItems:"center",gap:8,flexWrap:"wrap"}}>
            <span style={{fontSize:10,color:C.textSec}}>全部總覽模式只讀，不會寫本機資料，也不會同步雲端。</span>
            <button className="ui-btn" onClick={exitOverview} style={{
              background:C.cardBlue,color:C.blue,border:`1px solid ${alpha(C.blue, A.strongLine)}`,
              ...ghostBtn,
            }}>
              返回目前組合
            </button>
          </div>
        ) : (
          <div className="seg" style={{display:"flex",gap:6,overflowX:"auto",padding:"2px 0 6px"}}>
            {TABS.map(t=>(
              <button className="ui-btn" key={t.k} onClick={()=>{setTab(t.k);window.scrollTo({top:0,behavior:"smooth"})}} style={{
                background:tab===t.k ? alpha(C.text, "10") : "transparent",
                color: tab===t.k ? C.text : C.textMute,
                border:`1px solid ${tab===t.k ? C.borderStrong : "transparent"}`,
                boxShadow:tab===t.k ? C.insetLine : "none",
                borderRadius:999,
                padding:"7px 13px",
                fontSize:11, fontWeight: tab===t.k ? 600 : 500,
                cursor:"pointer", whiteSpace:"nowrap",
              }}>{t.label}</button>
            ))}
          </div>
        )}
      </div>

      <div className="app-shell" style={{padding:"10px 14px"}}>

        {viewMode === OVERVIEW_VIEW_MODE && <>
          <div style={{...card,marginBottom:8,borderLeft:`3px solid ${alpha(C.blue, A.glow)}`}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:10,flexWrap:"wrap"}}>
              <div>
                <div style={{...lbl,color:C.blue,marginBottom:4}}>全部總覽</div>
                <div style={{fontSize:13,color:C.text,fontWeight:600}}>跨組合檢視目前持倉、重複部位與待處理事件</div>
                <div style={{fontSize:10,color:C.textMute,marginTop:4,lineHeight:1.7}}>
                  這裡只做彙總，不會修改任何組合資料。
                </div>
              </div>
              <button className="ui-btn" onClick={exitOverview} style={{
                background:C.cardBlue,color:C.blue,border:`1px solid ${alpha(C.blue, A.strongLine)}`,
                ...ghostBtn,
              }}>
                返回目前組合
              </button>
            </div>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:6,marginTop:10}}>
              {[
                ["組合數", `${overviewPortfolios.length}`, C.textSec],
                ["總市值", Math.round(overviewTotalValue).toLocaleString(), C.blue],
                ["總損益", `${overviewTotalPnl >= 0 ? "+" : ""}${Math.round(overviewTotalPnl).toLocaleString()}`, pc(overviewTotalPnl)],
              ].map(([label, value, color]) => (
                <div key={label} className="ui-card" style={metricCard}>
                  <div style={{fontSize:9,color:C.textMute,letterSpacing:"0.08em"}}>{label}</div>
                  <div className="tn" style={{fontSize:14,fontWeight:600,color,marginTop:2}}>{value}</div>
                </div>
              ))}
            </div>
          </div>

          <div style={{...card,marginBottom:8}}>
            <div style={lbl}>組合摘要</div>
            <div style={{display:"grid",gap:8}}>
              {overviewPortfolios.map(portfolio => {
                const noteSummary = [portfolio.notes.riskProfile, portfolio.notes.preferences, portfolio.notes.customNotes]
                  .filter(Boolean)
                  .join(" · ");
                return (
                  <div key={portfolio.id} style={{
                    background: portfolio.id === activePortfolioId ? C.subtleElev : C.subtle,
                    border:`1px solid ${portfolio.id === activePortfolioId ? C.borderStrong : C.border}`,
                    borderRadius:8,
                    padding:"10px 12px",
                  }}>
                    <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:10,flexWrap:"wrap"}}>
                      <div>
                        <div style={{fontSize:12,fontWeight:600,color:C.text}}>
                          {portfolio.name}
                          {portfolio.id === OWNER_PORTFOLIO_ID && <span style={{fontSize:9,color:C.textMute,marginLeft:6}}>owner</span>}
                        </div>
                        <div style={{fontSize:10,color:C.textMute,marginTop:4}}>
                          {portfolio.holdingCount} 檔 · 待處理事件 {portfolio.pendingEvents.length} 件 · 報酬 {portfolio.retPct >= 0 ? "+" : ""}{portfolio.retPct.toFixed(1)}%
                        </div>
                        {noteSummary && (
                          <div style={{fontSize:10,color:C.textSec,marginTop:6,lineHeight:1.7}}>
                            {noteSummary}
                          </div>
                        )}
                      </div>
                      <div style={{textAlign:"right"}}>
                        <div className="tn" style={{fontSize:16,fontWeight:700,color:pc(portfolio.totalPnl)}}>
                          {portfolio.totalPnl >= 0 ? "+" : ""}{Math.round(portfolio.totalPnl).toLocaleString()}
                        </div>
                        <button className="ui-btn" onClick={() => switchPortfolio(portfolio.id)} style={{
                          marginTop:6,
                          background:C.cardBlue,color:C.blue,border:`1px solid ${alpha(C.blue, A.strongLine)}`,
                          ...ghostBtn,
                        }}>
                          打開這組
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div style={{...card,marginBottom:8}}>
            <div style={lbl}>重複持股</div>
            {overviewDuplicateHoldings.length === 0 ? (
              <div style={{fontSize:11,color:C.textMute}}>目前沒有跨組合重複持有同一檔股票。</div>
            ) : (
              <div style={{display:"grid",gap:8}}>
                {overviewDuplicateHoldings.map(item => (
                  <div key={item.code} style={{paddingBottom:8,borderBottom:`1px solid ${C.borderSub}`}}>
                    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",gap:8,flexWrap:"wrap"}}>
                      <div>
                        <span style={{fontSize:12,color:C.text,fontWeight:600}}>{item.name}</span>
                        <span style={{fontSize:10,color:C.textMute,marginLeft:6}}>{item.code}</span>
                      </div>
                      <span className="tn" style={{fontSize:10,color:C.textSec}}>合計市值 {Math.round(item.totalValue).toLocaleString()}</span>
                    </div>
                    <div style={{display:"flex",gap:6,flexWrap:"wrap",marginTop:6}}>
                      {item.portfolios.map(portfolio => (
                        <span key={`${item.code}-${portfolio.id}`} style={{
                          fontSize:9,padding:"2px 8px",borderRadius:999,background:C.subtle,border:`1px solid ${C.border}`,color:C.textSec,
                        }}>
                          {portfolio.name} · {portfolio.qty}股 · {portfolio.pnl >= 0 ? "+" : ""}{Math.round(portfolio.pnl)}
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div style={card}>
            <div style={lbl}>待處理事項</div>
            {overviewPendingItems.length === 0 ? (
              <div style={{fontSize:11,color:C.textMute}}>目前所有組合都沒有待處理事件。</div>
            ) : (
              <div style={{display:"grid",gap:8}}>
                {overviewPendingItems.slice(0, 16).map(item => (
                  <div key={`${item.portfolioId}-${item.id}`} style={{
                    background:C.subtle,
                    border:`1px solid ${C.border}`,
                    borderRadius:8,
                    padding:"10px 12px",
                  }}>
                    <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:8,flexWrap:"wrap"}}>
                      <div>
                        <div style={{fontSize:11,color:C.text,fontWeight:600}}>{item.title}</div>
                        <div style={{fontSize:10,color:C.textMute,marginTop:4}}>
                          {item.portfolioName} · {item.date || "未排日期"} · 預測{item.pred === "up" ? "看漲" : item.pred === "down" ? "看跌" : "中性"}
                        </div>
                        {item.predReason && (
                          <div style={{fontSize:10,color:C.textSec,marginTop:6,lineHeight:1.7}}>{item.predReason}</div>
                        )}
                      </div>
                      <button className="ui-btn" onClick={() => switchPortfolio(item.portfolioId)} style={{
                        background:C.cardBlue,color:C.blue,border:`1px solid ${alpha(C.blue, A.strongLine)}`,
                        ...ghostBtn,
                      }}>
                        去處理
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>}

        {/* ══════════ HOLDINGS ══════════ */}
        {viewMode !== OVERVIEW_VIEW_MODE && tab==="holdings" && <>
          {/* 摘要 */}
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:6,marginBottom:8}}>
            {[["總成本",totalCost.toLocaleString(),C.textSec],
              ["總市值",totalVal.toLocaleString(),C.blue],
              ["持股數",H.length+"檔",C.lavender]].map(([l,v,c])=>(
              <div key={l} className="ui-card" style={metricCard}>
                <div style={{fontSize:9,color:C.textMute,letterSpacing:"0.08em"}}>{l}</div>
                <div className="tn" style={{fontSize:14,fontWeight:600,color:l==="總市值"?C.text:l==="持股數"?C.textSec:c,marginTop:2}}>{v}</div>
              </div>
            ))}
          </div>

          {/* ── 投組健檢：產業分佈 + 策略配置 ── */}
          {(()=>{
            const H_ = holdings || INIT_HOLDINGS;
            // 產業市值分佈
            const indMap = {};
            H_.forEach(h => {
              const m = STOCK_META[h.code];
              if (!m) return;
              indMap[m.industry] = (indMap[m.industry] || 0) + (h.value || 0);
            });
            const indArr = Object.entries(indMap).sort((a,b)=>b[1]-a[1]);
            const indTotal = indArr.reduce((s,x)=>s+x[1],0) || 1;
            // 策略分佈
            const stratMap = {};
            H_.forEach(h => {
              const m = STOCK_META[h.code];
              if (!m) return;
              stratMap[m.strategy] = (stratMap[m.strategy] || 0) + 1;
            });
            // 週期分佈
            const periodMap = {};
            H_.forEach(h => {
              const m = STOCK_META[h.code];
              if (!m) return;
              periodMap[m.period] = (periodMap[m.period] || 0) + 1;
            });
            // 核心 vs 衛星 vs 戰術
            const posMap = {};
            H_.forEach(h => {
              const m = STOCK_META[h.code];
              if (!m) return;
              posMap[m.position] = (posMap[m.position] || 0) + (h.value || 0);
            });
            // 產業重複警告（>2檔且佔比>25%）
            const warnings = indArr.filter(([ind, val]) => {
              const count = H_.filter(h => STOCK_META[h.code]?.industry === ind).length;
              return count >= 3 || val/indTotal > 0.25;
            });

            return <div style={{...card,marginBottom:8}}>
              <div style={lbl}>投組健檢</div>

              {/* 產業分佈 — 水平堆疊條 */}
              <div style={{display:"flex",borderRadius:4,overflow:"hidden",height:6,marginBottom:8}}>
                {indArr.map(([ind, val]) => (
                  <div key={ind} style={{
                    width:`${val/indTotal*100}%`,height:"100%",
                    background:IND_COLOR[ind]||C.textMute,
                  }}/>
                ))}
              </div>

              {/* 產業標籤 */}
              <div style={{display:"flex",gap:5,flexWrap:"wrap",marginBottom:8}}>
                {indArr.map(([ind, val]) => {
                  const pct = (val/indTotal*100).toFixed(0);
                  const count = H_.filter(h => STOCK_META[h.code]?.industry === ind).length;
                  const color = IND_COLOR[ind]||C.textMute;
                  return <span key={ind} style={{
                    display:"inline-flex",alignItems:"center",gap:4,
                    fontSize:10,padding:"3px 8px",borderRadius:6,
                    background:C.subtle,border:`1px solid ${C.border}`,color:C.textSec,
                  }}>
                    <span style={{width:6,height:6,borderRadius:3,background:color,flexShrink:0}}/>
                    {ind} {count}檔 {pct}%
                  </span>;
                })}
              </div>

              {/* 產業重複警告 */}
              {warnings.length > 0 && (
                <div style={{background:C.amberBg,border:`1px solid ${alpha(C.amber, A.soft)}`,
                  borderRadius:6,padding:"6px 10px",marginBottom:8,fontSize:10,color:C.amber,lineHeight:1.6}}>
                  ⚠ 產業集中：{warnings.map(([ind])=>{
                    const count = H_.filter(h => STOCK_META[h.code]?.industry === ind).length;
                    return `${ind}(${count}檔)`;
                  }).join("、")}
                  {warnings.some(([,val])=>val/indTotal>0.3) && " — 建議分散風險"}
                </div>
              )}

              {/* 策略 + 週期 + 持倉定位 — 三欄 */}
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:6}}>
                <div>
                  <div style={{fontSize:9,color:C.textMute,marginBottom:4}}>策略框架</div>
                  {Object.entries(stratMap).sort((a,b)=>b[1]-a[1]).map(([s,n])=>(
                    <div key={s} style={{fontSize:10,color:C.textSec,marginBottom:2}}>
                      {s} <span style={{color:C.text,fontWeight:600}}>{n}</span>
                    </div>
                  ))}
                </div>
                <div>
                  <div style={{fontSize:9,color:C.textMute,marginBottom:4}}>持有週期</div>
                  {Object.entries(periodMap).map(([p,n])=>(
                    <div key={p} style={{fontSize:10,color:C.textSec,marginBottom:2}}>
                      {p==="短"?"短期":p==="中"?"中期":p==="短中"?"短中期":"中長期"} <span style={{color:C.text,fontWeight:600}}>{n}</span>
                    </div>
                  ))}
                </div>
                <div>
                  <div style={{fontSize:9,color:C.textMute,marginBottom:4}}>持倉定位</div>
                  {Object.entries(posMap).sort((a,b)=>b[1]-a[1]).map(([p,val])=>(
                    <div key={p} style={{fontSize:10,color:C.textSec,marginBottom:2}}>
                      {p} <span style={{color:C.text,fontWeight:600}}>{(val/indTotal*100).toFixed(0)}%</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>;
          })()}

          {/* top5 — 水平 chip */}
          <div style={{...card,marginBottom:8}}>
            <div style={lbl}>市值佔比 Top 5</div>
            <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
              {top5.map((h,i)=>{
                const pct=h.value/totalVal*100;
                return <div key={h.code} style={{
                  display:"flex",alignItems:"center",gap:5,
                  background:C.subtle,border:`1px solid ${C.border}`,
                  borderRadius:20,padding:"4px 10px",
                }}>
                  <span style={{fontSize:11,color:C.textSec,fontWeight:500}}>{h.name}</span>
                  <span style={{fontSize:11,fontWeight:700,color:C.text}}>{pct.toFixed(1)}%</span>
                </div>;
              })}
            </div>
          </div>

          {/* 勝負摘要 */}
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:6,marginBottom:8}}>
            <div style={{...card,borderLeft:`3px solid ${alpha(C.up, A.glow)}`,padding:"8px 10px"}}>
              <div style={{...lbl,color:C.up,marginBottom:3}}>獲利 {winners.length}檔</div>
              {winners.slice(0,3).map(h=>(
                <div key={h.code} style={{display:"flex",justifyContent:"space-between",marginTop:4}}>
                  <span style={{fontSize:11,color:C.textSec}}>{h.name}</span>
                  <span style={{fontSize:11,fontWeight:600,color:C.up}}>+{h.pct}%</span>
                </div>
              ))}
            </div>
            <div style={{...card,borderLeft:`3px solid ${alpha(C.down, A.glow)}`,padding:"8px 10px"}}>
              <div style={{...lbl,color:C.down,marginBottom:3}}>虧損 {losers.length}檔</div>
              {losers.slice(0,3).map(h=>(
                <div key={h.code} style={{display:"flex",justifyContent:"space-between",marginTop:4}}>
                  <span style={{fontSize:11,color:C.textSec}}>{h.name}</span>
                  <span style={{fontSize:11,fontWeight:600,color:C.down}}>{h.pct}%</span>
                </div>
              ))}
            </div>
          </div>

          {/* 反轉追蹤（虧損持股）— 可收合 */}
          {losers.length>0 && (
            <div style={{...card,marginBottom:8,borderLeft:`3px solid ${alpha(C.amber, A.glow)}`,padding:"8px 10px"}}>
              <div onClick={()=>setShowReversal(p=>!p)} style={{
                display:"flex",justifyContent:"space-between",alignItems:"center",cursor:"pointer"}}>
                <div style={{...lbl,color:C.amber,marginBottom:0}}>反轉追蹤 · {losers.length}檔</div>
                <span style={{fontSize:9,color:C.textMute}}>{showReversal?"收合 ▲":"展開 ▼"}</span>
              </div>
              {/* 收合時顯示摘要 */}
              {!showReversal && (
                <div style={{display:"flex",gap:6,flexWrap:"wrap",marginTop:5}}>
                  {losers.map(h=>{
                    const rc = (reversalConditions||{})[h.code];
                    return <span key={h.code} style={{fontSize:10,padding:"2px 8px",borderRadius:12,
                      background:rc?alpha(C.olive, A.tint):C.subtle,
                      border:`1px solid ${rc?alpha(C.olive, A.soft):C.borderSub}`,
                      color:rc?C.olive:C.textMute}}>
                      {h.name} {h.pct}% {rc?"✓":""}
                    </span>;
                  })}
                </div>
              )}
              {/* 展開時顯示完整內容 */}
              {showReversal && losers.map(h=>{
                const rc = (reversalConditions||{})[h.code];
                const [editing, setEditing] = [
                  reviewingEvent===`rev-${h.code}`,
                  (v)=>setReviewingEvent(v?`rev-${h.code}`:null)
                ];
                return <div key={h.code} style={{marginTop:6,padding:"6px 0",
                  borderBottom:`1px solid ${C.borderSub}`}}>
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                    <div>
                      <span style={{fontSize:12,fontWeight:500,color:C.text}}>{h.name}</span>
                      <span style={{fontSize:10,color:C.down,marginLeft:6}}>{h.pct}%</span>
                    </div>
                    <button onClick={()=>setEditing(!editing)} style={{
                      padding:"3px 9px",borderRadius:5,fontSize:9,cursor:"pointer",
                      background:rc?alpha(C.olive, A.faint):"transparent",
                      border:`1px solid ${rc?alpha(C.olive, A.strongLine):C.border}`,
                      color:rc?C.olive:C.textMute}}>
                      {rc?"查看條件":"設定反轉條件"}
                    </button>
                  </div>
                  {rc && !editing && (
                    <div style={{fontSize:10,color:C.textSec,marginTop:3,lineHeight:1.6}}>
                      反轉訊號：{rc.signal} | 目標：{rc.target} | 停損：{rc.stopLoss}
                    </div>
                  )}
                  {editing && (()=>{
                    const draft = rc || {signal:"",target:"",stopLoss:"",note:""};
                    return <div style={{marginTop:6,background:C.subtle,borderRadius:7,padding:10}}>
                      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:6,marginBottom:6}}>
                        <div>
                          <div style={{fontSize:9,color:C.textMute,marginBottom:2}}>反轉目標價</div>
                          <input defaultValue={draft.target} id={`rv-t-${h.code}`}
                            placeholder="如 130"
                            style={{width:"100%",background:C.card,border:`1px solid ${C.border}`,
                              borderRadius:6,padding:"6px 8px",color:C.text,fontSize:11,outline:"none",fontFamily:"inherit"}}/>
                        </div>
                        <div>
                          <div style={{fontSize:9,color:C.textMute,marginBottom:2}}>停損價</div>
                          <input defaultValue={draft.stopLoss} id={`rv-s-${h.code}`}
                            placeholder="如 85"
                            style={{width:"100%",background:C.card,border:`1px solid ${C.border}`,
                              borderRadius:6,padding:"6px 8px",color:C.text,fontSize:11,outline:"none",fontFamily:"inherit"}}/>
                        </div>
                      </div>
                      <div style={{marginBottom:6}}>
                        <div style={{fontSize:9,color:C.textMute,marginBottom:2}}>反轉訊號（什麼條件出現代表反轉？）</div>
                        <input defaultValue={draft.signal} id={`rv-g-${h.code}`}
                          placeholder="如：月營收連續兩月成長、法人轉買超"
                          style={{width:"100%",background:C.card,border:`1px solid ${C.border}`,
                            borderRadius:6,padding:"6px 8px",color:C.text,fontSize:11,outline:"none",fontFamily:"inherit"}}/>
                      </div>
                      <div style={{marginBottom:8}}>
                        <div style={{fontSize:9,color:C.textMute,marginBottom:2}}>備註</div>
                        <input defaultValue={draft.note} id={`rv-n-${h.code}`}
                          placeholder="其他觀察..."
                          style={{width:"100%",background:C.card,border:`1px solid ${C.border}`,
                            borderRadius:6,padding:"6px 8px",color:C.text,fontSize:11,outline:"none",fontFamily:"inherit"}}/>
                      </div>
                      <button onClick={()=>{
                        updateReversal(h.code, {
                          signal: document.getElementById(`rv-g-${h.code}`).value,
                          target: document.getElementById(`rv-t-${h.code}`).value,
                          stopLoss: document.getElementById(`rv-s-${h.code}`).value,
                          note: document.getElementById(`rv-n-${h.code}`).value,
                        });
                        setEditing(false);
                      }} style={{width:"100%",padding:"8px",borderRadius:6,border:"none",
                        background:alpha(C.fillTeal, A.pressed),color:C.onFill,fontSize:11,fontWeight:500,cursor:"pointer"}}>
                        儲存反轉條件
                      </button>
                    </div>;
                  })()}
                </div>;
              })}
            </div>
          )}

          {/* 快速掃描工具 */}
          <div style={{...card,marginBottom:8,padding:"10px 12px"}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",gap:10,marginBottom:8,flexWrap:"wrap"}}>
              <div>
                <div style={{fontSize:10,color:C.textMute,letterSpacing:"0.06em",fontWeight:600}}>快速掃描</div>
                <div style={{fontSize:12,color:C.textSec,marginTop:2}}>
                  先找出需要處理的股票，再決定要不要展開細看
                </div>
              </div>
              <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
                {[
                  ["需處理", `${attentionCount} 檔`],
                  ["待處理", `${pendingCount} 檔`],
                  ["目標更新", `${targetUpdateCount} 檔`],
                ].map(([l,v])=>(
                  <div key={l} style={{background:C.subtle,border:`1px solid ${C.border}`,borderRadius:999,padding:"4px 10px"}}>
                    <span style={{fontSize:9,color:C.textMute}}>{l}</span>
                    <span style={{fontSize:10,color:C.text,marginLeft:6,fontWeight:600}}>{v}</span>
                  </div>
                ))}
              </div>
            </div>
            <div style={{display:"grid",gridTemplateColumns:"1.3fr 1fr",gap:8}}>
              <input
                value={scanQuery}
                onChange={e=>setScanQuery(e.target.value)}
                placeholder="搜尋股票、代碼、產業、策略..."
                style={{width:"100%",background:C.subtle,border:`1px solid ${C.border}`,borderRadius:8,padding:"9px 10px",color:C.text,fontSize:12,outline:"none",fontFamily:"inherit"}}
              />
              <div style={{display:"flex",gap:5,flexWrap:"wrap",alignItems:"center",justifyContent:"flex-end"}}>
                {["全部","需處理","待處理","目標更新","虧損","權證"].map(k=>(
                  <button key={k} className="ui-btn" onClick={()=>{setScanFilter(k);setShowAll(false);}} style={{
                    background: scanFilter===k ? C.subtleElev : "transparent",
                    color: scanFilter===k ? C.text : C.textMute,
                    border:`1px solid ${scanFilter===k ? C.borderStrong : C.border}`,
                    borderRadius:999,padding:"5px 10px",fontSize:10,fontWeight:500,cursor:"pointer",
                  }}>{k}</button>
                ))}
              </div>
            </div>
          </div>

          {/* 排序 + 列表 */}
          <div style={{display:"flex",gap:5,marginBottom:6,alignItems:"center",flexWrap:"wrap"}}>
            <span style={{fontSize:10,color:C.textMute}}>排序：</span>
            {[["value","市值"],["pnl","損益"],["pct","報酬%"]].map(([k,l])=>(
              <button key={k} onClick={()=>setSortBy(k)} style={{
                background: sortBy===k ? C.subtle : "transparent",
                color: sortBy===k ? C.amber : C.textMute,
                border:`1px solid ${sortBy===k ? alpha(C.amber, A.accent) : C.border}`,
                borderRadius:20, padding:"3px 11px", fontSize:10, fontWeight:500, cursor:"pointer",
              }}>{l}</button>
            ))}
            <span style={{fontSize:10,color:C.textMute,marginLeft:"auto"}}>
              顯示 {displayed.length} / {filteredRows.length} 檔
            </span>
          </div>

          <div style={card}>
            {displayed.map(({ h, meta, T, relatedEvents, hasPending, needsAttention, priority },i)=>{
              const tp     = T ? avgTarget(h.code) : null;
              const upside = tp && h.price ? ((tp - h.price) / h.price * 100) : null;
              const isNew  = T?.isNew;
              const isExpanded = expandedStock === h.code;
              const hits = relatedEvents.filter(e => e.correct === true).length;
              const misses = relatedEvents.filter(e => e.correct === false).length;
              const pending = relatedEvents.filter(e => e.correct == null).length;
              const indColor = meta ? (IND_COLOR[meta.industry]||C.textMute) : C.textMute;
              return (
              <div key={h.code} style={{
                padding:"9px 0",
                borderBottom: i<displayed.length-1 ? `1px solid ${C.borderSub}` : "none"}}>
                <div onClick={()=>setExpandedStock(isExpanded?null:h.code)}
                  style={{display:"flex", alignItems:"flex-start", justifyContent:"space-between", cursor:"pointer"}}>
                  <div style={{flex:1}}>
                    <div style={{display:"flex",alignItems:"center",gap:4,flexWrap:"wrap"}}>
                      <span style={{fontSize:12,fontWeight:600,color:C.text}}>{h.name}</span>
                      <span style={{fontSize:9,color:C.textMute}}>{h.code}</span>
                      {/* 產業標籤 */}
                      {meta && (
                        <span style={{fontSize:8,padding:"1px 5px",borderRadius:3,
                          background:alpha(indColor, A.tint),color:indColor,fontWeight:500,
                          borderLeft:`2px solid ${indColor}`}}>{meta.industry}</span>
                      )}
                      {h.type!=="股票"&&(
                        <span style={{fontSize:8,padding:"1px 5px",borderRadius:3,
                          background: h.type==="權證" ? C.amberBg : C.blueBg,
                          color: h.type==="權證" ? C.amber : C.blue,
                          fontWeight:500}}>{h.type}</span>
                      )}
                      {/* 策略/週期/定位 小標 */}
                      {meta && meta.leader!=="N/A" && (
                        <span style={{fontSize:8,padding:"1px 5px",borderRadius:3,
                          background:meta.leader==="龍頭"||meta.leader==="小龍頭"?C.amberBg:C.subtle,
                          color:meta.leader==="龍頭"||meta.leader==="小龍頭"?C.amber:C.textMute,
                          fontWeight:500}}>{meta.leader}</span>
                      )}
                      {h.expire&&<span style={{fontSize:8,color:C.amber,fontWeight:500}}>到期{h.expire}</span>}
                      {h.alert&&<span style={{fontSize:8,color:C.up,fontWeight:600}}>{h.alert}</span>}
                      {isNew&&<span style={{fontSize:8,padding:"1px 5px",borderRadius:3,
                        background:C.tealBg,color:C.teal,fontWeight:600,
                        animation:"pulse 1.5s ease-in-out infinite"}}>目標價更新</span>}
                      {needsAttention && !h.alert && !isNew && (
                        <span style={{fontSize:8,padding:"1px 5px",borderRadius:3,background:C.amberBg,color:C.amber,fontWeight:600}}>
                          需留意
                        </span>
                      )}
                      {relatedEvents.length>0 && (
                        <span style={{fontSize:8,padding:"1px 5px",borderRadius:3,
                          background:C.lavBg,color:C.lavender,fontWeight:500}}>
                          {hits>0&&`✓${hits}`}{misses>0&&` ✗${misses}`}{pending>0&&` ⏳${pending}`}
                        </span>
                      )}
                    </div>
                    <div style={{fontSize:10,color:C.textMute,marginTop:2}}>
                      {h.qty}股 · 成本{h.cost?.toLocaleString()} · 現{h.price?.toLocaleString()}
                      {meta && <span style={{marginLeft:6,fontSize:9,color:C.textMute}}>
                        {meta.strategy} · {meta.period==="短"?"短期":meta.period==="中"?"中期":meta.period==="短中"?"短中期":"中長期"} · {meta.position}
                      </span>}
                      <span style={{marginLeft:4,color:C.textMute,fontSize:9}}>{isExpanded?"▲":"▼"}</span>
                    </div>
                    <div style={{display:"flex",gap:6,flexWrap:"wrap",marginTop:6}}>
                      <span style={{fontSize:9,padding:"2px 7px",borderRadius:999,background:C.subtle,border:`1px solid ${C.border}`,color:C.textSec}}>
                        市值 {h.value?.toLocaleString()}
                      </span>
                      <span style={{fontSize:9,padding:"2px 7px",borderRadius:999,background:C.subtle,border:`1px solid ${C.border}`,color:pc(h.pnl)}}>
                        損益 {h.pnl>=0?"+":""}{h.pnl?.toLocaleString()}
                      </span>
                      <span style={{fontSize:9,padding:"2px 7px",borderRadius:999,background:C.subtle,border:`1px solid ${C.border}`,color:pc(h.pct)}}>
                        報酬 {h.pct>=0?"+":""}{h.pct?.toFixed(1)}%
                      </span>
                      {tp && <span style={{fontSize:9,padding:"2px 7px",borderRadius:999,background:C.subtle,border:`1px solid ${C.border}`,color:upside>=0?C.up:C.down}}>
                        目標差 {upside>=0?"+":""}{upside?.toFixed(1)}%
                      </span>}
                      {hasPending && <span style={{fontSize:9,padding:"2px 7px",borderRadius:999,background:C.subtle,border:`1px solid ${C.border}`,color:C.lavender}}>
                        事件待處理 {pending}
                      </span>}
                    </div>
                    {/* 目標價進度條 */}
                    {tp && (
                      <div style={{marginTop:7}}>
                        <div style={{display:"flex",justifyContent:"space-between",marginBottom:1}}>
                          <span style={{fontSize:9,color:C.textMute}}>
                            目標 {tp.toLocaleString()}
                            {T?.reports?.length>1 && <span style={{color:C.textMute}}> ({T.reports.length}家均)</span>}
                          </span>
                          <span style={{fontSize:9,fontWeight:600,
                            color: upside>=0 ? C.up : C.down}}>
                            {upside>=0?"+":""}{upside?.toFixed(1)}%
                          </span>
                        </div>
                        <div style={{background:C.subtle,borderRadius:2,height:2,width:"100%",overflow:"hidden"}}>
                          <div style={{
                            width:`${Math.min(Math.max((h.price/tp)*100,0),100)}%`,
                            height:"100%",
                            background: upside>=15 ? alpha(C.up, A.solid)
                              : upside>=0  ? alpha(C.amber, A.solid)
                              : alpha(C.down, A.solid),
                            borderRadius:3,
                          }}/>
                        </div>
                      </div>
                    )}
                  </div>
                  <div className="tn" style={{textAlign:"right",minWidth:84,paddingLeft:10}}>
                    <div style={{fontSize:9,color:C.textMute,marginBottom:2}}>掃描優先度</div>
                    <div style={{fontSize:17,fontWeight:700,color:priority==="A"?C.amber:priority==="B"?C.lavender:C.textSec,lineHeight:1}}>
                      {priority}
                    </div>
                    <div style={{fontSize:9,color:C.textMute,marginTop:4}}>
                      {priority==="A" ? "先看" : priority==="B" ? "追蹤中" : "穩定"}
                    </div>
                  </div>
                </div>
                {/* 展開：個股策略追蹤 */}
                {isExpanded && (
                  <div style={{marginTop:10,padding:"10px 12px",background:C.subtle,borderRadius:10}}>
                    <button onClick={(ev)=>{ev.stopPropagation();setTab("research");runResearch("single",h)}}
                      disabled={researching}
                      style={{width:"100%",padding:"8px",marginBottom:8,borderRadius:6,
                        border:`1px solid ${alpha(C.teal, A.strongLine)}`,background:alpha(C.teal, A.tint),
                        color:C.teal,fontSize:10,fontWeight:500,cursor:researching?"not-allowed":"pointer"}}>
                      🔬 深度研究 {h.name}
                    </button>
                    {relatedEvents.length === 0 ? (
                      <div style={{fontSize:11,color:C.textMute,textAlign:"center",padding:"8px 0"}}>
                        尚無相關事件預測紀錄
                      </div>
                    ) : (
                      <>
                        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}>
                          <div style={{fontSize:10,color:C.lavender,fontWeight:600}}>策略追蹤（{relatedEvents.length} 筆）</div>
                          <div style={{fontSize:10}}>
                            {hits>0&&<span style={{color:C.olive,marginRight:8}}>準確 {hits}</span>}
                            {misses>0&&<span style={{color:C.up,marginRight:8}}>失誤 {misses}</span>}
                            {pending>0&&<span style={{color:C.textMute}}>待處理 {pending}</span>}
                            {(hits+misses)>0&&<span style={{color:C.amber,marginLeft:8,fontWeight:600}}>
                              勝率 {Math.round(hits/(hits+misses)*100)}%
                            </span>}
                          </div>
                        </div>
                        {relatedEvents.map(e=>(
                          <div key={e.id} style={{padding:"8px 0",borderBottom:`1px solid ${C.borderSub}`}}>
                            <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}>
                              <div style={{flex:1}}>
                                <div style={{fontSize:11,fontWeight:500,color:C.text}}>{e.title}</div>
                                <div style={{fontSize:9,color:C.textMute,marginTop:2}}>{e.date}</div>
                              </div>
                              <div style={{display:"flex",gap:4,alignItems:"center",flexShrink:0}}>
                                <span style={{fontSize:9,padding:"2px 6px",borderRadius:3,
                                  background:e.pred==="up"?C.upBg:e.pred==="down"?C.downBg:C.blueBg,
                                  color:e.pred==="up"?C.up:e.pred==="down"?C.down:C.blue}}>
                                  預測{e.pred==="up"?"看漲":e.pred==="down"?"看跌":"中性"}
                                </span>
                                {e.correct===true && <span style={{fontSize:9,padding:"2px 6px",borderRadius:3,background:C.oliveBg,color:C.olive,fontWeight:600}}>✓ 準確</span>}
                                {e.correct===false && <span style={{fontSize:9,padding:"2px 6px",borderRadius:3,background:C.upBg,color:C.up,fontWeight:600}}>✗ 失誤</span>}
                                {e.correct==null && e.status==="pending" && <span style={{fontSize:9,padding:"2px 6px",borderRadius:3,background:C.blueBg,color:C.blue}}>待驗證</span>}
                                {e.correct==null && e.status==="tracking" && <span style={{fontSize:9,padding:"2px 6px",borderRadius:3,background:C.blueBg,color:C.blue}}>追蹤中</span>}
                              </div>
                            </div>
                            <div style={{fontSize:10,color:C.textMute,marginTop:4,lineHeight:1.6}}>{e.predReason}</div>
                            {e.actualNote && <div style={{fontSize:10,color:C.textSec,marginTop:3,lineHeight:1.6,
                              borderLeft:`2px solid ${alpha(e.correct?C.olive:C.up, A.accent)}`,paddingLeft:8}}>
                              結果：{e.actualNote}
                            </div>}
                            {e.lessons && <div style={{fontSize:10,color:C.amber,marginTop:3,lineHeight:1.6}}>
                              教訓：{e.lessons}
                            </div>}
                          </div>
                        ))}
                      </>
                    )}
                  </div>
                )}
              </div>
              );
            })}
            {!showAll && sorted.length>12 && (
              <button onClick={()=>setShowAll(true)} style={{
                width:"100%",marginTop:10,padding:"9px",
                background:"transparent",border:`1px solid ${C.border}`,
                borderRadius:8,color:C.textMute,fontSize:11,cursor:"pointer",fontWeight:400,
              }}>顯示全部 {sorted.length} 檔</button>
            )}
          </div>
        </>}

        {/* ══════════ WATCHLIST ══════════ */}
        {viewMode !== OVERVIEW_VIEW_MODE && tab==="watchlist" && <>
          {watchlistFocus && (
            <div style={{...card,borderLeft:`3px solid ${alpha(C.teal, A.accent)}`,marginBottom:8,background:C.cardBlue}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:10,flexWrap:"wrap"}}>
                <div style={{flex:1,minWidth:0}}>
                  <div style={{fontSize:9,color:C.teal,fontWeight:600,letterSpacing:"0.1em",textTransform:"uppercase"}}>焦點觀察</div>
                  <div style={{fontSize:15,fontWeight:600,color:C.text,marginTop:3,display:"flex",gap:6,alignItems:"center",flexWrap:"wrap"}}>
                    <span>{watchlistFocus.item.name} {watchlistFocus.item.code}</span>
                    <span style={{fontSize:9,padding:"2px 7px",borderRadius:20,background:C.subtle,border:`1px solid ${C.border}`,color:C.textSec}}>
                      {watchlistFocus.item.status || (watchlistFocus.trackingCount > 0 ? "追蹤中" : "觀察中")}
                    </span>
                  </div>
                  <div style={{fontSize:10,color:C.textSec,marginTop:5,lineHeight:1.7}}>
                    {watchlistFocus.summary}
                  </div>
                  <div style={{fontSize:10,color:C.textMute,marginTop:5,lineHeight:1.7}}>
                    {watchlistFocus.action}
                  </div>
                </div>
                <div style={{display:"flex",gap:6,flexWrap:"wrap",justifyContent:"flex-end"}}>
                  <span style={{fontSize:9,padding:"4px 8px",borderRadius:20,background:C.subtle,color:C.textSec,border:`1px solid ${C.borderSub}`}}>
                    現價 {watchlistFocus.item.price ? watchlistFocus.item.price.toLocaleString() : "—"}
                  </span>
                  <span style={{fontSize:9,padding:"4px 8px",borderRadius:20,background:C.subtle,color:C.textSec,border:`1px solid ${C.borderSub}`}}>
                    目標 {watchlistFocus.item.target ? watchlistFocus.item.target.toLocaleString() : "未設定"}
                  </span>
                  <span style={{fontSize:9,padding:"4px 8px",borderRadius:20,background:C.subtle,color:C.textSec,border:`1px solid ${C.borderSub}`}}>
                    {watchlistFocus.upside != null ? `潛在 ${watchlistFocus.upside >= 0 ? "+" : ""}${watchlistFocus.upside.toFixed(1)}%` : `事件 ${watchlistFocus.relatedEvents.length} 筆`}
                  </span>
                </div>
              </div>
            </div>
          )}

          {watchlistRows.length === 0 ? (
            <div style={{...card,textAlign:"center",padding:"24px 14px"}}>
              <div style={{fontSize:20,marginBottom:6,opacity:0.3}}>◌</div>
              <div style={{fontSize:12,color:C.textMute,fontWeight:400}}>
                這個組合目前沒有觀察股<br/>
                <span style={{fontSize:10}}>後續若要做多組合觀察名單，再把 watchlist 編輯功能補上。</span>
              </div>
            </div>
          ) : watchlistRows.map(({ item:w, index:wi, relatedEvents:wEvents, hits:wHits, misses:wMisses, pendingCount, trackingCount, upside },) => {
            const upsideText = upside != null ? `${upside >= 0 ? "+" : ""}${upside.toFixed(1)}%` : "—";
            const prog = w.target > 0 && w.price > 0 ? Math.min(w.price / w.target * 100, 100) : 0;
            const sc = C[w.scKey] || C.up;
            const bgTints=[C.card,C.cardBlue,C.cardAmber];
            const isWExp = expandedStock === `w-${w.code}`;
            return <div key={w.code} style={{...card, background:bgTints[wi%3], marginBottom:8}}>
              <div onClick={()=>setExpandedStock(isWExp?null:`w-${w.code}`)} style={{cursor:"pointer"}}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:10}}>
                  <div style={{flex:1,minWidth:0}}>
                    <div style={{fontSize:16,fontWeight:600,color:C.text}}>{w.name}
                      <span style={{fontSize:10,color:C.textMute,fontWeight:400,marginLeft:6}}>{w.code}</span>
                      {wEvents.length>0 && (
                        <span style={{fontSize:9,padding:"1px 6px",borderRadius:3,marginLeft:6,
                          background:C.lavBg,color:C.lavender,fontWeight:500}}>
                          {wHits>0&&`✓${wHits}`}{wMisses>0&&` ✗${wMisses}`}{pendingCount>0&&` ⏳${pendingCount}`}{trackingCount>0&&` 👁${trackingCount}`}
                        </span>
                      )}
                    </div>
                    <div style={{fontSize:10,color:C.textMute,marginTop:2,lineHeight:1.6}}>
                      {w.catalyst || "尚未補上催化劑"} <span style={{fontSize:9}}>{isWExp?"▲":"▼"}</span>
                    </div>
                  </div>
                  <span style={{background:C.subtle,color:C.textSec,fontSize:10,fontWeight:500,
                    border:`1px solid ${C.border}`,padding:"3px 11px",borderRadius:20,flexShrink:0}}>{w.status || "觀察中"}</span>
                </div>
                <div style={{display:"flex",gap:16,marginTop:12,flexWrap:"wrap"}}>
                  {[["現價",w.price ? w.price.toLocaleString() : "—",C.text],
                    ["目標價",w.target ? w.target.toLocaleString() : "未設定",C.textSec],
                    ["潛在漲幅",upsideText,C.text]].map(([l,v,c])=>(
                    <div key={l}>
                      <div style={{fontSize:9,color:C.textMute,marginBottom:3}}>{l}</div>
                      <div style={{fontSize:17,fontWeight:600,color:c}}>{v}</div>
                    </div>
                  ))}
                </div>
                <div style={{marginTop:12}}>
                  <div style={{background:C.subtle,borderRadius:3,height:3}}>
                    <div style={{width:`${prog}%`,height:"100%",
                      background:`linear-gradient(90deg,${alpha(sc, A.accent)},${alpha(C.olive, A.accent)})`,borderRadius:3}}/>
                  </div>
                </div>
                <div style={{fontSize:10,color:C.textMute,marginTop:9,lineHeight:1.7}}>{w.note || "尚未補上觀察重點。"}</div>
              </div>
              {/* 展開：觀察股策略追蹤 */}
              {isWExp && (
                <div style={{marginTop:10,padding:"10px 12px",background:C.bg,borderRadius:10}}>
                  {wEvents.length === 0 ? (
                    <div style={{fontSize:11,color:C.textMute,textAlign:"center",padding:"8px 0"}}>
                      尚無相關事件預測紀錄
                    </div>
                  ) : (
                    <>
                      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}>
                        <div style={{fontSize:10,color:C.lavender,fontWeight:600}}>策略追蹤（{wEvents.length} 筆）</div>
                        <div style={{fontSize:10}}>
                          {wHits>0&&<span style={{color:C.olive,marginRight:8}}>準確 {wHits}</span>}
                          {wMisses>0&&<span style={{color:C.up,marginRight:8}}>失誤 {wMisses}</span>}
                          {(pendingCount + trackingCount)>0&&<span style={{color:C.textMute}}>待處理 {pendingCount + trackingCount}</span>}
                          {(wHits+wMisses)>0&&<span style={{color:C.amber,marginLeft:8,fontWeight:600}}>
                            勝率 {Math.round(wHits/(wHits+wMisses)*100)}%
                          </span>}
                        </div>
                      </div>
                      {wEvents.map(e=>(
                        <div key={e.id} style={{padding:"8px 0",borderBottom:`1px solid ${C.borderSub}`}}>
                          <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}>
                            <div style={{flex:1}}>
                              <div style={{fontSize:11,fontWeight:500,color:C.text}}>{e.title}</div>
                              <div style={{fontSize:9,color:C.textMute,marginTop:2}}>{e.date}</div>
                            </div>
                            <div style={{display:"flex",gap:4,alignItems:"center",flexShrink:0}}>
                              <span style={{fontSize:9,padding:"2px 6px",borderRadius:3,
                                background:e.pred==="up"?C.upBg:e.pred==="down"?C.downBg:C.blueBg,
                                color:e.pred==="up"?C.up:e.pred==="down"?C.down:C.blue}}>
                                預測{e.pred==="up"?"看漲":e.pred==="down"?"看跌":"中性"}
                              </span>
                              {e.correct===true && <span style={{fontSize:9,padding:"2px 6px",borderRadius:3,background:C.oliveBg,color:C.olive,fontWeight:600}}>✓ 準確</span>}
                              {e.correct===false && <span style={{fontSize:9,padding:"2px 6px",borderRadius:3,background:C.upBg,color:C.up,fontWeight:600}}>✗ 失誤</span>}
                              {e.correct==null && e.status==="pending" && <span style={{fontSize:9,padding:"2px 6px",borderRadius:3,background:C.blueBg,color:C.blue}}>待驗證</span>}
                              {e.correct==null && e.status==="tracking" && <span style={{fontSize:9,padding:"2px 6px",borderRadius:3,background:C.blueBg,color:C.blue}}>追蹤中</span>}
                            </div>
                          </div>
                          <div style={{fontSize:10,color:C.textMute,marginTop:4,lineHeight:1.6}}>{e.predReason}</div>
                          {e.actualNote && <div style={{fontSize:10,color:C.textSec,marginTop:3,lineHeight:1.6,
                            borderLeft:`2px solid ${alpha(e.correct?C.olive:C.up, A.accent)}`,paddingLeft:8}}>
                            結果：{e.actualNote}
                          </div>}
                          {e.lessons && <div style={{fontSize:10,color:C.amber,marginTop:3,lineHeight:1.6}}>
                            教訓：{e.lessons}
                          </div>}
                        </div>
                      ))}
                    </>
                  )}
                </div>
              )}
            </div>;
          })}
        </>}

        {/* ══════════ EVENTS ══════════ */}
        {viewMode !== OVERVIEW_VIEW_MODE && tab==="events" && <>
          {showRelayPlan && (
            <div style={{...card,marginBottom:8,background:C.cardBlue,borderLeft:`3px solid ${alpha(C.teal, A.accent)}`}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:10,flexWrap:"wrap"}}>
                <div style={{flex:1,minWidth:0}}>
                  <div style={{fontSize:9,color:C.teal,fontWeight:600,letterSpacing:"0.1em",textTransform:"uppercase"}}>接力計畫</div>
                  <div style={{fontSize:15,fontWeight:600,color:C.text,marginTop:3}}>{RELAY_PLAN.title}</div>
                  <div style={{fontSize:10,color:C.textSec,marginTop:4,lineHeight:1.7}}>
                    {RELAY_PLAN.summary}
                  </div>
                </div>
                <button className="ui-btn" onClick={()=>setRelayPlanExpanded(v=>!v)} style={{
                  ...ghostBtn,
                  background:relayPlanExpanded ? C.subtleElev : alpha(C.teal, A.faint),
                  color:relayPlanExpanded ? C.text : C.teal,
                  border:`1px solid ${relayPlanExpanded ? C.borderStrong : alpha(C.teal, A.strongLine)}`,
                }}>
                  {relayPlanExpanded ? "收合" : "展開完整計畫"}
                </button>
              </div>

              <div style={{display:"flex",gap:6,flexWrap:"wrap",marginTop:10}}>
                {RELAY_PLAN.quickStates.map(item=>(
                  <span key={item.label} style={{
                    fontSize:9,padding:"4px 8px",borderRadius:20,
                    background:alpha(C[item.tone] || C.text, A.tint),
                    color:C[item.tone] || C.text,
                    border:`1px solid ${alpha(C[item.tone] || C.text, A.soft)}`,
                  }}>
                    {item.label} · {item.text}
                  </span>
                ))}
              </div>

              <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit, minmax(168px, 1fr))",gap:8,marginTop:10}}>
                {RELAY_PLAN.legs.map(leg=>(
                  <div key={leg.code} style={{background:C.subtle,border:`1px solid ${C.border}`,borderLeft:`2px solid ${alpha(C[leg.tone] || C.text, A.accent)}`,borderRadius:9,padding:"10px 11px"}}>
                    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",gap:8}}>
                      <div>
                        <div style={{fontSize:12,fontWeight:600,color:C.text}}>{leg.name} <span style={{fontSize:9,color:C.textMute,fontWeight:400}}>{leg.code}</span></div>
                        <div style={{fontSize:9,color:C.textMute,marginTop:2}}>{leg.role} · {leg.window}</div>
                      </div>
                      <span style={{fontSize:9,padding:"2px 7px",borderRadius:20,background:alpha(C[leg.tone] || C.text, A.tint),color:C[leg.tone] || C.text}}>
                        {leg.status}
                      </span>
                    </div>
                    <div style={{fontSize:11,color:C.text,marginTop:9,fontWeight:500,lineHeight:1.6}}>{leg.action}</div>
                    <div style={{fontSize:10,color:C.textSec,marginTop:6,lineHeight:1.7}}>
                      觸發：{leg.trigger}<br/>
                      防守：{leg.stop}
                    </div>
                  </div>
                ))}
              </div>

              {relayPlanExpanded && (
                <div style={{marginTop:10,paddingTop:10,borderTop:`1px solid ${C.borderSub}`}}>
                  <div style={{fontSize:10,color:C.textMute,fontWeight:600,marginBottom:6}}>核心邏輯</div>
                  <div style={{display:"grid",gap:6}}>
                    {RELAY_PLAN.thesis.map(item=>(
                      <div key={item} style={{fontSize:10,color:C.textSec,lineHeight:1.7,background:C.subtle,border:`1px solid ${C.borderSub}`,borderRadius:8,padding:"8px 10px"}}>
                        {item}
                      </div>
                    ))}
                  </div>

                  <div style={{fontSize:10,color:C.textMute,fontWeight:600,marginTop:10,marginBottom:6}}>關鍵觀察</div>
                  <div style={{display:"grid",gap:6}}>
                    {RELAY_PLAN.indicators.map(item=>(
                      <div key={`${item.code}-${item.when}`} style={{background:C.subtle,border:`1px solid ${C.borderSub}`,borderRadius:8,padding:"8px 10px"}}>
                        <div style={{fontSize:10,color:C.text,fontWeight:500}}>{item.name} · {item.when}</div>
                        <div style={{fontSize:10,color:C.textSec,marginTop:3,lineHeight:1.7}}>{item.what}</div>
                      </div>
                    ))}
                  </div>

                  <div style={{fontSize:10,color:C.textMute,fontWeight:600,marginTop:10,marginBottom:6}}>情境矩陣</div>
                  <div style={{display:"grid",gap:6}}>
                    {RELAY_PLAN.riskMatrix.map(item=>(
                      <div key={item.scenario} style={{background:C.subtle,border:`1px solid ${C.borderSub}`,borderRadius:8,padding:"8px 10px"}}>
                        <div style={{fontSize:10,color:C.text,fontWeight:500}}>{item.scenario}</div>
                        <div style={{fontSize:10,color:C.textSec,marginTop:3,lineHeight:1.7}}>{item.action}</div>
                      </div>
                    ))}
                  </div>

                  <div style={{fontSize:10,color:C.textMute,fontWeight:600,marginTop:10,marginBottom:6}}>資金配置</div>
                  <div style={{display:"grid",gap:6}}>
                    {RELAY_PLAN.allocations.map(item=>(
                      <div key={`${item.phase}-${item.target}`} style={{background:C.subtle,border:`1px solid ${C.borderSub}`,borderRadius:8,padding:"8px 10px"}}>
                        <div style={{fontSize:10,color:C.text,fontWeight:500}}>{item.phase} · {item.target}</div>
                        <div style={{fontSize:10,color:C.textSec,marginTop:3,lineHeight:1.7}}>{item.plan}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          <div style={{display:"flex",gap:5,flexWrap:"wrap",marginBottom:8}}>
            {["全部",...Object.keys(TYPE_COLOR)].map(t=>(
              <button key={t} onClick={()=>setFilterType(t)} style={{
                background: filterType===t ? C.subtleElev : "transparent",
                color: filterType===t ? C.text : C.textMute,
                border:`1px solid ${filterType===t?C.borderStrong:C.border}`,
                borderRadius:20,padding:"3px 11px",fontSize:10,fontWeight:500,cursor:"pointer",
              }}>{t}</button>
            ))}
          </div>

          {filteredEvents.map((e,i)=>{
            const tc = TYPE_COLOR[e.type]||C.textMute;
            return <div key={i} style={{...card,marginBottom:7,
              borderLeft:`2px solid ${e.urgent ? C.up : alpha(tc, A.accent)}`}}>
              <div style={{display:"flex",gap:10,alignItems:"flex-start"}}>
                <div style={{minWidth:48}}>
                  <div style={{background: e.urgent ? C.upBg : alpha(tc, A.tint),
                    color: e.urgent ? C.up : tc,
                    fontSize:9,fontWeight:600,padding:"2px 5px",borderRadius:4,
                    textAlign:"center",marginBottom:3}}>{e.type}</div>
                  <div style={{fontSize:9,color:C.textMute,textAlign:"center",lineHeight:1.4}}>{e.date}</div>
                </div>
                <div style={{flex:1}}>
                  <div style={{fontSize:12,fontWeight:500,color:e.urgent?C.up:C.text}}>{e.label}</div>
                  <div style={{fontSize:10,color:C.textMute,marginTop:3,lineHeight:1.6}}>{e.sub}</div>
                </div>
              </div>
            </div>;
          })}
        </>}

        {/* ══════════ DAILY ANALYSIS ══════════ */}
        {viewMode !== OVERVIEW_VIEW_MODE && tab==="daily" && <>
          {/* 手動觸發按鈕 */}
          {!dailyReport && !analyzing && (
            <div style={{...card,textAlign:"center",padding:"20px 14px",marginBottom:10}}>
              <div style={{fontSize:24,marginBottom:6,opacity:0.4}}>◎</div>
              <div style={{fontSize:12,color:C.textSec,fontWeight:500,marginBottom:4}}>每日收盤分析</div>
              <div style={{fontSize:10,color:C.textMute,marginBottom:12,lineHeight:1.6}}>
                分析今日股價變動與事件連動性 · 自動比對持倉漲跌、異常波動、策略建議
              </div>
              <button onClick={runDailyAnalysis} style={{
                padding:"10px 24px",borderRadius:8,border:"none",
                background:`linear-gradient(135deg,${alpha(C.blue, A.overlay)},${alpha(C.olive, A.overlay)})`,
                color:C.onFill,fontSize:12,fontWeight:600,cursor:"pointer",
                letterSpacing:"0.03em"}}>
                開始今日收盤分析
              </button>
            </div>
          )}

          {analyzing && (
            <div style={{...card,textAlign:"center",padding:"36px 16px"}}>
              <div style={{fontSize:13,color:C.amber,fontWeight:500,animation:"pulse 1.5s ease-in-out infinite"}}>
                {analyzeStep || "正在分析今日收盤數據..."}
              </div>
              <div style={{fontSize:11,color:C.textMute,marginTop:8}}>取得股價 → 比對事件 → AI策略分析 → 大腦進化</div>
              <div style={{width:"100%",height:3,background:C.borderSub,borderRadius:2,marginTop:12,overflow:"hidden"}}>
                <div style={{height:"100%",background:C.amber,borderRadius:2,animation:"progress 8s ease-in-out infinite",width:"70%"}} />
              </div>
            </div>
          )}

          {dailyReport && <>
            {/* 今日損益摘要 — 點擊展開/收合 */}
            <div id="daily-report-top" style={{...card,marginBottom:8,
              borderLeft:`3px solid ${alpha(dailyReport.totalTodayPnl>=0?C.up:C.down, A.glow)}`,cursor:"pointer"}}
              onClick={()=>setDailyExpanded(p=>!p)}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                <div style={{display:"flex",alignItems:"center",gap:6}}>
                  <div style={{...lbl,marginBottom:0}}>{dailyReport.date} 收盤分析</div>
                  <span style={{fontSize:9,color:C.textMute}}>{dailyReport.time}</span>
                  {!dailyExpanded && dailyReport.anomalies?.length>0 && (
                    <span style={{fontSize:9,padding:"1px 6px",borderRadius:3,background:C.amberBg,color:C.amber}}>
                      異常 {dailyReport.anomalies.length}
                    </span>
                  )}
                  {!dailyExpanded && dailyReport.needsReview?.length>0 && (
                    <span style={{fontSize:9,padding:"1px 6px",borderRadius:3,background:C.upBg,color:C.up}}>
                      復盤 {dailyReport.needsReview.length}
                    </span>
                  )}
                </div>
                <div style={{display:"flex",alignItems:"center",gap:8}}>
                  <div style={{fontSize:18,fontWeight:700,color:pc(dailyReport.totalTodayPnl),lineHeight:1.1}}>
                    {dailyReport.totalTodayPnl>=0?"+":""}{dailyReport.totalTodayPnl.toLocaleString()}
                  </div>
                  <span style={{fontSize:9,color:C.textMute}}>{dailyExpanded?"▲":"▼"}</span>
                </div>
              </div>
            </div>

            <button
              className="ui-btn"
              onClick={(ev)=>{ev.stopPropagation();runDailyAnalysis()}}
              disabled={analyzing}
              style={{
                width:"100%",
                padding:"10px 12px",
                borderRadius:8,
                border:`1px solid ${analyzing ? C.border : alpha(C.blue, A.strongLine)}`,
                background:analyzing ? C.subtle : C.cardBlue,
                color:analyzing ? C.textMute : C.blue,
                fontSize:11,
                fontWeight:600,
                cursor:analyzing ? "not-allowed" : "pointer",
                marginBottom:8,
              }}
            >
              {analyzing ? (analyzeStep || "分析中...") : "重新分析今日收盤"}
            </button>

            {dailyExpanded && <>
              {/* 持倉漲跌排行 */}
              <div style={{...card,marginBottom:8}}>
                <div style={lbl}>持倉今日漲跌</div>
                {dailyReport.changes.map((c,i)=>(
                  <div key={c.code} style={{display:"flex",justifyContent:"space-between",alignItems:"center",
                    padding:"5px 0",borderBottom:i<dailyReport.changes.length-1?`1px solid ${C.borderSub}`:"none"}}>
                    <div>
                      <span style={{fontSize:12,fontWeight:500,color:C.text}}>{c.name}</span>
                      <span style={{fontSize:9,color:C.textMute,marginLeft:5}}>{c.code}</span>
                      {c.type!=="股票"&&<span style={{fontSize:9,marginLeft:5,padding:"1px 5px",borderRadius:3,
                        background:C.amberBg,color:C.amber}}>{c.type}</span>}
                    </div>
                    <div style={{textAlign:"right",display:"flex",gap:12,alignItems:"center"}}>
                      <span style={{fontSize:11,color:C.textMute}}>{c.price?.toLocaleString()}</span>
                      <span style={{fontSize:12,fontWeight:600,color:pc(c.changePct),minWidth:55,textAlign:"right"}}>
                        {c.changePct>=0?"+":""}{c.changePct.toFixed(2)}%
                      </span>
                      <span style={{fontSize:10,color:pc(c.todayPnl),minWidth:50,textAlign:"right"}}>
                        {c.todayPnl>=0?"+":""}{c.todayPnl.toLocaleString()}
                      </span>
                    </div>
                  </div>
                ))}
              </div>

              {/* 異常波動 */}
              {dailyReport.anomalies.length>0 && (
                <div style={{...card,marginBottom:8,borderLeft:`3px solid ${alpha(C.amber, A.glow)}`}}>
                  <div style={{...lbl,color:C.amber}}>異常波動 ({">"}3%)</div>
                  {dailyReport.anomalies.map(a=>(
                    <div key={a.code} style={{display:"flex",justifyContent:"space-between",padding:"6px 0"}}>
                      <span style={{fontSize:12,color:C.text}}>{a.name}</span>
                      <span style={{fontSize:12,fontWeight:600,color:pc(a.changePct)}}>
                        {a.changePct>=0?"+":""}{a.changePct.toFixed(2)}%
                      </span>
                    </div>
                  ))}
                </div>
              )}

              {/* 事件連動 */}
              {dailyReport.eventCorrelations.length>0 && (
                <div style={{...card,marginBottom:8,borderLeft:`3px solid ${alpha(C.teal, A.glow)}`}}>
                  <div style={{...lbl,color:C.teal}}>事件連動分析</div>
                  {dailyReport.eventCorrelations.map(ec=>(
                    <div key={ec.id} style={{marginBottom:10,background:C.subtle,borderRadius:7,padding:"9px 11px"}}>
                      <div style={{fontSize:11,fontWeight:500,color:C.text,marginBottom:4}}>{ec.title}</div>
                      <div style={{fontSize:10,color:C.textMute,marginBottom:6}}>{ec.date}</div>
                      {ec.relatedStocks.map(s=>(
                        <div key={s.code} style={{display:"flex",justifyContent:"space-between",padding:"3px 0"}}>
                          <span style={{fontSize:10,color:C.textSec}}>{s.name}</span>
                          <span style={{fontSize:10,fontWeight:600,color:pc(s.changePct)}}>
                            {s.changePct>=0?"+":""}{s.changePct.toFixed(2)}%
                          </span>
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
              )}

              {/* AI 結構化事件評估 */}
              {(dailyReport.eventAssessments||[]).length>0 && (
                <div style={{...card,marginBottom:8,borderLeft:`3px solid ${alpha(C.blue, A.glow)}`}}>
                  <div style={{...lbl,color:C.blue}}>AI 事件評估 · {dailyReport.eventAssessments.length}件</div>
                  {dailyReport.eventAssessments.map((ea,i)=>{
                    const impactColor = ea.todayImpact==="positive"?C.up:ea.todayImpact==="negative"?C.down:C.textMute;
                    const impactLabel = ea.todayImpact==="positive"?"正面":ea.todayImpact==="negative"?"負面":ea.todayImpact==="neutral"?"中性":"無關";
                    return (
                      <div key={ea.eventId||i} style={{marginBottom:8,background:C.subtle,borderRadius:7,padding:"9px 11px"}}>
                        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:4}}>
                          <span style={{fontSize:11,fontWeight:500,color:C.text}}>{ea.title}</span>
                          <div style={{display:"flex",gap:6,alignItems:"center"}}>
                            <span style={{fontSize:9,padding:"2px 6px",borderRadius:3,background:impactColor+"22",color:impactColor,fontWeight:600}}>{impactLabel}</span>
                            {ea.suggestClose && <span style={{fontSize:9,padding:"2px 6px",borderRadius:3,background:C.amberBg,color:C.amber,fontWeight:600}}>建議結案</span>}
                          </div>
                        </div>
                        <div style={{fontSize:10,color:C.textSec,marginBottom:2}}>{ea.note}</div>
                        <div style={{display:"flex",gap:8,alignItems:"center"}}>
                          <span style={{fontSize:9,color:C.textMute}}>信心度 {Math.round((ea.confidence||0)*100)}%</span>
                          {ea.suggestClose && ea.suggestCloseReason && (
                            <span style={{fontSize:9,color:C.amber}}>{ea.suggestCloseReason}</span>
                          )}
                        </div>
                        {ea.suggestClose && (
                          <button onClick={(ev)=>{ev.stopPropagation();setTab("news");setExpandedNews(new Set([Number(ea.eventId)]))}}
                            style={{marginTop:4,padding:"4px 10px",borderRadius:5,border:`1px solid ${alpha(C.olive, A.strongLine)}`,
                              background:"transparent",color:C.olive,fontSize:10,cursor:"pointer"}}>
                            前往結案
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}

              {/* 需要復盤的事件 */}
              {dailyReport.needsReview.length>0 && (
                <div style={{...card,marginBottom:8,borderLeft:`3px solid ${alpha(C.up, A.glow)}`}}>
                  <div style={{...lbl,color:C.up}}>需要復盤 · {dailyReport.needsReview.length}件</div>
                  {dailyReport.needsReview.map(e=>(
                    <div key={e.id} style={{marginBottom:8}}>
                      <div style={{fontSize:11,fontWeight:500,color:C.text}}>{e.title}</div>
                      <div style={{fontSize:10,color:C.textMute}}>{e.date} — 預測{e.pred==="up"?"看漲":"看跌"}</div>
                      <button onClick={(ev)=>{ev.stopPropagation();setTab("news");setExpandedNews(new Set([e.id]))}}
                        style={{marginTop:4,padding:"4px 10px",borderRadius:5,border:`1px solid ${alpha(C.olive, A.strongLine)}`,
                          background:"transparent",color:C.olive,fontSize:10,cursor:"pointer"}}>
                        前往復盤
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {/* AI 策略分析 */}
              {dailyReport.aiInsight && (
                <div style={{...card,marginBottom:8,borderLeft:`3px solid ${alpha(C.lavender, A.glow)}`}}>
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:4}}>
                    <div style={{...lbl,color:C.lavender,marginBottom:0}}>AI 策略分析</div>
                    <span style={{fontSize:10,color:C.textMute,background:C.subtle,padding:"2px 8px",borderRadius:4}}>
                      {dailyReport.date} {dailyReport.time}
                    </span>
                  </div>
                  <Md text={dailyReport.aiInsight} color={C.textSec} />
                </div>
              )}

              {!dailyReport.aiInsight && (
                <div style={{...card,marginBottom:10,background:C.subtle}}>
                  <div style={{fontSize:11,color:C.textMute,textAlign:"center",padding:"8px 0"}}>
                    AI 分析未產生
                    {dailyReport.aiError ? `：${dailyReport.aiError}` : "：請確認本地 AI API 金鑰與後端設定"}
                  </div>
                </div>
              )}
            </>}
          </>}

          {/* 策略大腦 — 可收合 */}
          {strategyBrain && (()=>{
            const brainOpen = expandedStock === "brain";
            return <div style={{...card,marginBottom:10,borderLeft:`3px solid ${alpha(C.lavender, A.glow)}`,padding:"8px 10px"}}>
              <div onClick={()=>setExpandedStock(brainOpen?null:"brain")} style={{
                display:"flex",justifyContent:"space-between",alignItems:"center",cursor:"pointer"}}>
                <div style={{display:"flex",alignItems:"center",gap:8}}>
                  <div style={{...lbl,color:C.lavender,marginBottom:0}}>策略大腦</div>
                  <span style={{fontSize:9,color:C.textMute}}>
                    {strategyBrain.stats?.totalAnalyses||0}次分析 · 命中{strategyBrain.stats?.hitRate||"—"}
                  </span>
                </div>
                <span style={{fontSize:9,color:C.textMute}}>{brainOpen?"▲":"▼"}</span>
              </div>

              {brainOpen && <>
                {(strategyBrain.rules||[]).length>0 && (
                  <div style={{marginTop:8,marginBottom:8}}>
                    <div style={{fontSize:10,color:C.amber,fontWeight:600,marginBottom:4}}>核心策略規則</div>
                    {strategyBrain.rules.map((r,i)=>(
                      <div key={i} style={{fontSize:10,color:C.textSec,lineHeight:1.7,
                        padding:"2px 0",borderBottom:`1px solid ${C.borderSub}`}}>
                        {i+1}. {r}
                      </div>
                    ))}
                  </div>
                )}

                {(strategyBrain.commonMistakes||[]).length>0 && (
                  <div style={{marginBottom:8}}>
                    <div style={{fontSize:10,color:C.up,fontWeight:600,marginBottom:4}}>常犯錯誤</div>
                    {strategyBrain.commonMistakes.map((m,i)=>(
                      <div key={i} style={{fontSize:10,color:C.textSec,lineHeight:1.7}}>⚠ {m}</div>
                    ))}
                  </div>
                )}

                {(strategyBrain.lessons||[]).length>0 && (
                  <div style={{marginBottom:6}}>
                    <div style={{fontSize:10,color:C.olive,fontWeight:600,marginBottom:4}}>
                      最近教訓（{strategyBrain.lessons.length} 條）
                    </div>
                    {strategyBrain.lessons.slice(-3).reverse().map((l,i)=>(
                      <div key={i} style={{fontSize:10,color:C.textMute,lineHeight:1.6,
                        padding:"2px 0",borderBottom:`1px solid ${C.borderSub}`}}>
                        <span style={{color:C.textSec}}>[{l.date}]</span> {l.text}
                      </div>
                    ))}
                  </div>
                )}

                {activePortfolioId === OWNER_PORTFOLIO_ID && (strategyBrain.coachLessons||[]).length>0 && (
                  <div style={{marginBottom:6}}>
                    <div style={{fontSize:10,color:C.blue,fontWeight:600,marginBottom:4}}>
                      跨組合教練教訓（{strategyBrain.coachLessons.length} 條）
                    </div>
                    {strategyBrain.coachLessons.slice(-3).reverse().map((lesson, i)=>(
                      <div key={`${lesson.sourcePortfolioId}-${lesson.sourceEventId}-${i}`} style={{
                        fontSize:10,color:C.textMute,lineHeight:1.6,padding:"3px 0",
                        borderBottom:`1px solid ${C.borderSub}`
                      }}>
                        <span style={{color:C.textSec}}>[{lesson.date}]</span>{" "}
                        {lesson.source ? `${lesson.source}：` : ""}
                        {lesson.text}
                      </div>
                    ))}
                  </div>
                )}

                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginTop:6}}>
                  <span style={{fontSize:9,color:cloudSync?C.olive:C.textMute}}>
                    {cloudSync ? "☁ 已雲端同步" : "⚡ 本機模式"} · {strategyBrain.lastUpdate||"—"}
                  </span>
                  <div style={{display:"flex",gap:6}}>
                    <button onClick={cleanupBrain} disabled={brainCleaning}
                      style={{fontSize:9,padding:"2px 7px",borderRadius:4,border:`1px solid ${alpha(C.teal, A.line)}`,
                        background:"transparent",color:brainCleaning?C.textMute:C.teal,cursor:brainCleaning?"not-allowed":"pointer"}}>
                      {brainCleaning?"整理中...":"整理大腦"}
                    </button>
                    <button onClick={()=>{
                      const json = JSON.stringify(strategyBrain, null, 2);
                      const blob = new Blob([json], {type:"application/json"});
                      const a = document.createElement("a");
                      a.href = URL.createObjectURL(blob);
                      a.download = `strategy-brain-${new Date().toISOString().slice(0,10)}.json`;
                      a.click();
                    }} style={{fontSize:9,padding:"2px 7px",borderRadius:4,border:`1px solid ${C.border}`,background:"transparent",color:C.textMute,cursor:"pointer"}}>
                      匯出
                    </button>
                    <button onClick={()=>{
                      if (confirm("確定要重置策略大腦？")) {
                        setStrategyBrain(null);
                        savePortfolioData(activePortfolioId, "brain-v1", null);
                        if (canUseCloud) {
                          fetch("/api/brain",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({action:"save-brain",data:null})}).catch(()=>{});
                        }
                      }
                    }} style={{fontSize:9,padding:"2px 7px",borderRadius:4,border:`1px solid ${alpha(C.up, A.line)}`,background:"transparent",color:C.up,cursor:"pointer"}}>
                      重置
                    </button>
                  </div>
                </div>
              </>}
            </div>;
          })()}

          {!strategyBrain && (
            <div style={{...card,marginBottom:12,textAlign:"center",padding:"16px"}}>
              <div style={{fontSize:11,color:C.textMute}}>
                執行第一次收盤分析後，策略大腦將自動建立並持續進化
              </div>
            </div>
          )}

          {/* 歷史分析 */}
          {(analysisHistory||[]).length>0 && (
            <div style={{...card}}>
              <div style={lbl}>歷史分析記錄</div>
              {(analysisHistory||[]).slice(0,10).map(r=>(
                <div key={r.id} onClick={()=>{
                    setDailyReport(r);
                    setDailyExpanded(true);
                    setTimeout(()=>document.getElementById("daily-report-top")?.scrollIntoView({behavior:"smooth"}),50);
                  }}
                  style={{display:"flex",justifyContent:"space-between",alignItems:"center",
                    padding:"8px 0",cursor:"pointer",
                    background:dailyReport?.id===r.id?C.subtle:"transparent",
                    borderRadius:6, paddingLeft:6, paddingRight:6,
                    borderBottom:`1px solid ${C.borderSub}`}}>
                  <div>
                    <span style={{fontSize:12,color:C.text}}>{r.date}</span>
                    <span style={{fontSize:10,color:C.textMute,marginLeft:6}}>{r.time}</span>
                  </div>
                  <span style={{fontSize:12,fontWeight:600,color:pc(r.totalTodayPnl)}}>
                    {r.totalTodayPnl>=0?"+":""}{r.totalTodayPnl.toLocaleString()}
                  </span>
                </div>
              ))}
            </div>
          )}
        </>}

        {/* ══════════ RESEARCH (AutoResearch) ══════════ */}
        {viewMode !== OVERVIEW_VIEW_MODE && tab==="research" && <>
          <div style={{...card,marginBottom:10,borderLeft:`3px solid ${alpha(C.teal, A.glow)}`}}>
            <div style={{...lbl,color:C.teal,marginBottom:6}}>AutoResearch · 自主進化系統</div>
            <div style={{fontSize:11,color:C.textSec,lineHeight:1.7,marginBottom:10}}>
              借鑒 Karpathy autoresearch：AI 不只研究個股，更能審視你的整個投資系統 —
              決策品質、認知盲點、情緒模式、策略一致性 — 並自動進化策略大腦。
            </div>

            <div style={{display:"flex",gap:6,marginBottom:10}}>
              <button onClick={()=>runResearch("evolve")} disabled={researching}
                style={{flex:1,padding:"11px",borderRadius:8,border:"none",fontSize:12,fontWeight:600,
                  cursor:researching?"not-allowed":"pointer",
                  background:researching && researchTarget==="EVOLVE"?C.subtle:`linear-gradient(135deg,${C.fillTomato},${C.fillChoco})`,
                  color:researching && researchTarget==="EVOLVE"?C.textMute:C.onFill}}>
                {researching && researchTarget==="EVOLVE" ? "系統進化中..." : "🧬 系統自我進化"}
              </button>
              <button onClick={()=>runResearch("portfolio")} disabled={researching}
                style={{flex:1,padding:"11px",borderRadius:8,border:"none",fontSize:12,fontWeight:500,
                  cursor:researching?"not-allowed":"pointer",
                  background:researching && researchTarget==="PORTFOLIO"?C.subtle:alpha(C.fillTeal, A.pressed),
                  color:researching && researchTarget==="PORTFOLIO"?C.textMute:C.onFill}}>
                {researching && researchTarget==="PORTFOLIO" ? "全組合研究中..." : "🔬 全組合研究"}
              </button>
            </div>

            {/* 個股研究選擇 */}
            <div style={{fontSize:9,color:C.textMute,marginBottom:4}}>或選擇個股深度研究（3 輪迭代）：</div>
            <div style={{display:"flex",gap:4,flexWrap:"wrap"}}>
              {H.map(h => {
                const m = STOCK_META[h.code];
                const color = m ? IND_COLOR[m.industry] || C.textMute : C.textMute;
                const isTarget = researching && researchTarget === h.code;
                return <button key={h.code}
                  onClick={()=>runResearch("single", h)}
                  disabled={researching}
                  style={{fontSize:9,padding:"4px 8px",borderRadius:6,cursor:researching?"not-allowed":"pointer",
                    background:isTarget?alpha(color, A.soft):C.card,
                    border:`1px solid ${isTarget?color:C.border}`,
                    color:isTarget?color:C.textSec,
                    whiteSpace:"nowrap"}}>
                  {isTarget?"研究中...":h.name}
                </button>;
              })}
            </div>
          </div>

          {/* 研究進度 */}
          {researching && (
            <div style={{...card,marginBottom:10,textAlign:"center",padding:"20px 14px"}}>
              <div style={{fontSize:12,color:researchTarget==="EVOLVE"?C.up:C.teal,fontWeight:500,marginBottom:6,animation:"pulse 2s infinite"}}>
                {researchTarget==="EVOLVE"
                  ? "AI 正在審視你的投資系統並自我進化..."
                  : `AI 正在進行${researchTarget==="PORTFOLIO"?"全組合":"個股"}深度研究...`}
              </div>
              <div style={{fontSize:10,color:C.textMute}}>
                {researchTarget==="EVOLVE"
                  ? "3 輪迭代：系統診斷 → 進化建議 → 策略大腦更新，預計 1-2 分鐘"
                  : researchTarget==="PORTFOLIO"
                  ? `逐一分析 ${H.length} 檔持股 + 組合策略，預計 1-2 分鐘`
                  : "3 輪迭代研究：基本面 → 風險催化 → 策略建議，預計 30 秒"}
              </div>
              <div style={{marginTop:10,height:3,background:C.subtle,borderRadius:2,overflow:"hidden"}}>
                <div style={{height:"100%",background:C.teal,borderRadius:2,animation:"progress 15s ease-in-out infinite",width:"70%"}} />
              </div>
            </div>
          )}

          {/* 研究結果 */}
          {researchResults && !researching && (
            <div style={{marginBottom:10}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}>
                <div style={{...lbl,marginBottom:0,color:C.teal}}>
                  {researchResults.name} · {researchResults.date}
                </div>
                {researchResults.priceAtResearch && (
                  <span style={{fontSize:10,color:C.textMute}}>
                    研究時股價 {researchResults.priceAtResearch}
                  </span>
                )}
              </div>

              {researchResults.rounds?.map((round, i) => (
                <div key={i} style={{...card,marginBottom:6,borderLeft:`2px solid ${alpha([C.blue,C.amber,C.teal][i%3], A.glow)}`}}>
                  <div style={{fontSize:10,fontWeight:600,color:[C.blue,C.amber,C.teal][i%3],marginBottom:6}}>
                    Round {i+1}：{round.title}
                  </div>
                  <Md text={round.content} color={C.textSec} />
                </div>
              ))}
            </div>
          )}

          {/* 歷史研究 */}
          {(researchHistory||[]).length > 0 && (
            <div style={card}>
              <div style={{...lbl,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                <span>歷史研究記錄</span>
                <span style={{fontSize:9,color:C.textMute,fontWeight:400}}>{(researchHistory||[]).length} 筆</span>
              </div>
              {(researchHistory||[]).map((r, i) => (
                <div key={r.timestamp || i}
                  onClick={() => setResearchResults(r)}
                  style={{display:"flex",justifyContent:"space-between",alignItems:"center",
                    padding:"8px 6px",cursor:"pointer",borderRadius:6,
                    background:researchResults?.timestamp===r.timestamp?C.subtle:"transparent",
                    borderBottom:`1px solid ${C.borderSub}`}}>
                  <div>
                    <span style={{fontSize:12,color:r.mode==="evolve"?C.up:C.text}}>
                      {r.mode==="evolve"?"🧬 ":"🔬 "}{r.name}
                    </span>
                    <span style={{fontSize:10,color:C.textMute,marginLeft:6}}>{r.date}</span>
                  </div>
                  <span style={{fontSize:9,color:C.textMute}}>
                    {r.rounds?.length || 0} 輪分析
                  </span>
                </div>
              ))}
            </div>
          )}

          {!researchResults && !researching && (researchHistory||[]).length === 0 && (
            <div style={{...card,textAlign:"center",padding:"24px"}}>
              <div style={{fontSize:11,color:C.textMute,lineHeight:1.8}}>
                點擊上方按鈕開始第一次深度研究。<br/>
                AI 將自主進行多輪迭代分析，像研究員一樣逐步深入。
              </div>
            </div>
          )}
        </>}

        {/* ══════════ UPLOAD ══════════ */}
        {viewMode !== OVERVIEW_VIEW_MODE && tab==="trade" && <>
          {!parsed && (
            <>
              <div
                onDragOver={e=>{e.preventDefault();setDragOver(true)}}
                onDragLeave={()=>setDragOver(false)}
                onDrop={e=>{e.preventDefault();setDragOver(false);processFile(e.dataTransfer.files[0])}}
                onClick={()=>document.getElementById("fi").click()}
                className="ui-card"
                style={{border:`1px dashed ${dragOver?C.borderStrong:C.border}`,
                  borderRadius:12,padding:"28px 16px",textAlign:"center",cursor:"pointer",
                  background:dragOver?C.subtleElev:C.card,marginBottom:12,transition:"all 0.2s"}}>
                <input id="fi" type="file" accept="image/*"
                  onChange={e=>processFile(e.target.files[0])} style={{display:"none"}}/>
                {img ? (
                  <><img src={img} alt="" style={{maxHeight:200,maxWidth:"100%",
                    borderRadius:8,objectFit:"contain",marginBottom:8}}/>
                  <div style={{fontSize:11,color:C.textMute}}>點擊更換截圖</div></>
                ) : (
                  <><div style={{fontSize:32,marginBottom:10,opacity:0.5}}>↑</div>
                  <div style={{fontSize:13,fontWeight:500,color:C.textSec}}>上傳已成交截圖</div>
                  <div style={{fontSize:11,color:C.textMute,marginTop:4}}>買進 · 賣出回報皆可</div></>
                )}
              </div>
              {img && (
                <button className="ui-btn" onClick={parseShot} disabled={parsing} style={{
                  width:"100%",padding:"13px",borderRadius:10,
                  background: parsing ? C.subtle : C.cardHover,
                  color: parsing ? C.textMute : C.text,
                  border: `1px solid ${parsing ? C.border : alpha(C.amber, A.accent)}`,
                  fontSize:13, fontWeight:500, cursor:parsing?"not-allowed":"pointer",
                  letterSpacing:"0.02em"}}>
                  {parsing ? "解析中..." : "解析這筆交易"}
                </button>
              )}
              {parseErr && <div style={{marginTop:10, background:C.upBg,
                border:`1px solid ${alpha(C.up, A.line)}`, borderRadius:10,
                padding:12, fontSize:12, color:C.up}}>
                {parseErr}
              </div>}
            </>
          )}

          {parsed?.trades?.length>0 && (
            <div>
              <div style={{...card,marginBottom:12}}>
                <div style={lbl}>解析結果</div>
                {parsed.trades.map((t,i)=>(
                  <div key={i} style={{display:"flex",justifyContent:"space-between",
                    alignItems:"center",padding:"10px 0",
                    borderBottom:i<parsed.trades.length-1?`1px solid ${C.borderSub}`:"none"}}>
                    <div>
                      <div style={{display:"flex",alignItems:"center",gap:6}}>
                        <span style={{
                          background: t.action==="買進" ? C.upBg : C.downBg,
                          color: t.action==="買進" ? C.up : C.down,
                          fontSize:10, fontWeight:600, padding:"2px 9px", borderRadius:4}}>
                          {t.action}
                        </span>
                        <span style={{fontSize:14,fontWeight:600,color:C.text}}>{t.name}</span>
                        <span style={{fontSize:10,color:C.textMute}}>{t.code}</span>
                      </div>
                      <div style={{fontSize:11,color:C.textMute,marginTop:3}}>
                        {t.qty}股 @ {t.price?.toLocaleString()}元
                      </div>
                    </div>
                  </div>
                ))}
                {parsed.targetPriceUpdates?.length>0 && (
                  <div style={{marginTop:10,background:C.tealBg,border:`1px solid ${alpha(C.teal, A.line)}`,
                    borderRadius:7,padding:"8px 10px"}}>
                    <div style={{fontSize:9,color:C.teal,fontWeight:600,marginBottom:4}}>
                      偵測到目標價更新
                    </div>
                    {parsed.targetPriceUpdates.map((u,i)=>(
                      <div key={i} style={{fontSize:11,color:C.textSec}}>
                        {u.code} · {u.firm} → {u.target?.toLocaleString()}元
                      </div>
                    ))}
                  </div>
                )}
                {parsed.note && <div style={{fontSize:10,color:C.textMute,marginTop:8}}>{parsed.note}</div>}
              </div>

              <div style={{...card,borderLeft:`2px solid ${alpha(C.blue, A.glow)}`}}>
                <div style={lbl}>交易備忘錄</div>
                {memoAns.map((a,i)=>(
                  <div key={i} style={{marginBottom:12}}>
                    <div style={{fontSize:10,color:C.textMute,marginBottom:4}}>Q{i+1}. {qs[i]}</div>
                    <div style={{fontSize:12,color:C.textSec,background:C.subtle,
                      borderRadius:6,padding:"8px 10px",lineHeight:1.6}}>{a}</div>
                  </div>
                ))}
                <div style={{fontSize:12,fontWeight:500,color:C.blue,marginBottom:8}}>
                  Q{memoStep+1}/{qs.length}. {qs[memoStep]}
                </div>
                <textarea value={memoIn}
                  onChange={e=>setMemoIn(e.target.value)}
                  onKeyDown={e=>{
                    if (e.key==="Enter" && !e.shiftKey && !isImeComposing(e) && memoIn.trim()) {
                      e.preventDefault();
                      submitMemo();
                    }
                  }}
                  placeholder="輸入你的想法... (Enter送出)"
                  style={{width:"100%", background:C.subtle, border:`1px solid ${C.border}`,
                    borderRadius:8, padding:"10px", color:C.text, fontSize:12,
                    resize:"none", minHeight:70, outline:"none",
                    fontFamily:"inherit", marginBottom:10, lineHeight:1.7}}/>
                <button onClick={submitMemo} disabled={!memoIn.trim()} style={{
                  width:"100%", padding:"12px", border:"none", borderRadius:8,
                  background: memoIn.trim()
                    ? alpha(C.fillTeal, A.pressed)
                    : C.subtle,
                  color: memoIn.trim() ? C.onFill : C.textMute,
                  fontSize:13, fontWeight:500, cursor:memoIn.trim()?"pointer":"not-allowed",
                  letterSpacing:"0.02em"}}>
                  {memoStep===qs.length-1 ? "完成備忘 · 更新持倉" : `下一題 (${memoStep+1}/${qs.length})`}
                </button>
              </div>
            </div>
          )}

          {/* 手動更新目標價 */}
          {!parsed && !img && (()=>{
            const handleAddTarget = () => {
              if (!tpCode.trim()||!tpVal) return;
              const code = tpCode.trim();
              const target = parseFloat(tpVal);
              if (isNaN(target)) return;
              setTargets(prev=>{
                const existing = (prev||{})[code] || {reports:[]};
                const firm = tpFirm.trim()||"手動輸入";
                const already = existing.reports.find(r=>r.firm===firm);
                const newR = {firm, target, date:new Date().toLocaleDateString("zh-TW")};
                return {
                  ...(prev||{}),
                  [code]: {
                    reports: already
                      ? existing.reports.map(r=>r.firm===firm?newR:r)
                      : [...existing.reports, newR],
                    updatedAt: new Date().toLocaleDateString("zh-TW"),
                    isNew: true,
                  }
                };
              });
              setSaved("✅ 目標價已更新");
              setTimeout(()=>setSaved(""),2000);
              setTpCode(""); setTpFirm(""); setTpVal("");
            };
            return (
              <div style={{...card,marginTop:14,borderLeft:`2px solid ${alpha(C.teal, A.accent)}`}}>
                <div style={lbl}>手動更新目標價</div>
                <div style={{fontSize:11,color:C.textMute,marginBottom:10,lineHeight:1.6}}>
                  收到新研究報告時，直接在這裡更新。系統會自動計算多家均值。
                </div>
                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:7,marginBottom:7}}>
                  <div>
                    <div style={{fontSize:9,color:C.textMute,marginBottom:3}}>股票代碼</div>
                    <input value={tpCode} onChange={e=>setTpCode(e.target.value)}
                      placeholder="如 3006"
                      style={{width:"100%",background:C.subtle,border:`1px solid ${C.border}`,
                        borderRadius:7,padding:"8px 10px",color:C.text,fontSize:12,outline:"none",fontFamily:"inherit"}}/>
                  </div>
                  <div>
                    <div style={{fontSize:9,color:C.textMute,marginBottom:3}}>目標價（元）</div>
                    <input value={tpVal} onChange={e=>setTpVal(e.target.value)}
                      placeholder="如 205"
                      type="number"
                      style={{width:"100%",background:C.subtle,border:`1px solid ${C.border}`,
                        borderRadius:7,padding:"8px 10px",color:C.text,fontSize:12,outline:"none",fontFamily:"inherit"}}/>
                  </div>
                </div>
                <div style={{marginBottom:10}}>
                  <div style={{fontSize:9,color:C.textMute,marginBottom:3}}>券商 / 來源</div>
                  <input value={tpFirm} onChange={e=>setTpFirm(e.target.value)}
                    placeholder="如 元大投顧、FactSet共識"
                    style={{width:"100%",background:C.subtle,border:`1px solid ${C.border}`,
                      borderRadius:7,padding:"8px 10px",color:C.text,fontSize:12,outline:"none",fontFamily:"inherit"}}/>
                </div>
                <button onClick={handleAddTarget}
                  disabled={!tpCode.trim()||!tpVal}
                  style={{
                    width:"100%",padding:"10px",border:"none",borderRadius:8,
                    background: tpCode.trim()&&tpVal ? alpha(C.fillTeal, A.pressed) : C.subtle,
                    color: tpCode.trim()&&tpVal ? C.onFill : C.textMute,
                    fontSize:12,fontWeight:500,cursor:tpCode.trim()&&tpVal?"pointer":"not-allowed",
                  }}>
                  新增 / 更新目標價
                </button>
              </div>
            );
          })()}
        </>}

        {/* ══════════ LOG ══════════ */}
        {viewMode !== OVERVIEW_VIEW_MODE && tab==="log" && <>
          {(!tradeLog||tradeLog.length===0) ? (
            <div style={{...card,textAlign:"center",padding:"24px 14px"}}>
              <div style={{fontSize:20,marginBottom:6,opacity:0.3}}>◌</div>
              <div style={{fontSize:12,color:C.textMute,fontWeight:400}}>
                還沒有交易記錄<br/>
                <span style={{fontSize:10}}>上傳成交截圖後自動記錄在這裡</span>
              </div>
            </div>
          ) : (
            [...(tradeLog||[])].sort((a,b)=>b.id-a.id).map(log=>(
              <div key={log.id} style={{...card,marginBottom:8,
                borderLeft:`2px solid ${alpha(log.action==="買進" ? C.up : C.down, A.glow)}`}}>
                <div style={{display:"flex",justifyContent:"space-between",marginBottom:4}}>
                  <div style={{display:"flex",alignItems:"center",gap:7}}>
                    <span style={{
                      background: log.action==="買進" ? C.upBg : C.downBg,
                      color: log.action==="買進" ? C.up : C.down,
                      fontSize:9, fontWeight:600, padding:"2px 8px", borderRadius:4}}>
                      {log.action}
                    </span>
                    <span style={{fontSize:14,fontWeight:600,color:C.text}}>{log.name}</span>
                    <span style={{fontSize:10,color:C.textMute}}>{log.code}</span>
                  </div>
                  <div style={{fontSize:10,color:C.textMute}}>{log.date} {log.time}</div>
                </div>
                <div style={{fontSize:11,color:C.textMute,marginBottom:10}}>
                  {log.qty}股 @ {log.price?.toLocaleString()}元
                </div>
                {log.qa.map((item,i)=>(
                  <div key={i} style={{marginBottom:8}}>
                    <div style={{fontSize:10,color:C.textMute,marginBottom:3}}>{item.q}</div>
                    <div style={{fontSize:11,color:C.textSec,background:C.subtle,
                      borderRadius:6,padding:"7px 10px",lineHeight:1.7}}>
                      {item.a||"（未填）"}
                    </div>
                  </div>
                ))}
              </div>
            ))
          )}
        </>}

        {/* ══════════ NEWS ANALYSIS ══════════ */}
        {viewMode !== OVERVIEW_VIEW_MODE && tab==="news" && (()=>{
          const NE = newsEvents || NEWS_EVENTS;
          const past    = NE.filter(isClosedEvent).sort((a,b)=>b.id-a.id);
          const tracking = NE.filter(e=>e.status==="tracking").sort((a,b)=>a.id-b.id);
          const pending = NE.filter(e=>e.status==="pending").sort((a,b)=>a.id-b.id);
          const hits    = NE.filter(e=>e.correct===true).length;
          const misses  = NE.filter(e=>e.correct===false).length;

          const predIcon = (p) => p==="up"?"↑":p==="down"?"↓":"—";
          const predLabel= (p) => p==="up"?"看漲":p==="down"?"看跌":"中性";
          const predC    = (p) => p==="up"?C.up:p==="down"?C.down:C.textMute;

          // 每隔一個卡片用不同底色，保持莫蘭迪跳色感
          const tints = [C.card, C.cardBlue, C.cardAmber, C.cardOlive, C.cardRose];
          const tint  = (i) => tints[i % tints.length];

          const renderEvent = (e, idx) => {
            const open   = expandedNews.has(e.id);
            const isCorrect = e.correct;
            const trackingMetrics = e.status === "tracking" ? getEventTrackingMetrics(e) : null;
            const borderC = isClosedEvent(e)
              ? (isCorrect===true ? alpha(C.olive, A.solid) : isCorrect===false ? alpha(C.up, A.solid) : C.border)
              : e.status === "tracking"
                ? alpha(C.blue, A.strongLine)
                : alpha(predC(e.pred), A.strongLine);

            return (
              <div key={e.id}
                onClick={()=>toggleNews(e.id)}
                style={{
                  background: tint(idx),
                  border:`1px solid ${C.border}`,
                  borderLeft:`2px solid ${borderC}`,
                  borderRadius:10, marginBottom:6,
                  cursor:"pointer", overflow:"hidden",
                  transition:"all 0.15s",
                }}
              >
                {/* ── 縮列行 ── */}
                <div style={{display:"flex",alignItems:"center",gap:8,padding:"10px 12px"}}>
                  {/* 預測/結果標籤 */}
                  <div style={{
                    minWidth:26, textAlign:"center",
                    fontSize:14, fontWeight:700,
                    color: predC(e.pred), opacity: 0.85,
                  }}>{predIcon(e.pred)}</div>

                  {/* 標題區 */}
                  <div style={{flex:1, minWidth:0}}>
                    <div style={{
                      fontSize:12, fontWeight:500, color:C.text,
                      whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis",
                    }}>{e.title}</div>
                    <div style={{display:"flex",alignItems:"center",gap:6,marginTop:3,flexWrap:"wrap"}}>
                      <span style={{fontSize:9,color:C.textMute}}>{e.date}</span>
                      {e.stocks.slice(0,2).map(s=>(
                        <span key={s} style={{fontSize:9,padding:"1px 6px",borderRadius:3,
                          background:C.subtle,color:C.textSec}}>{s.split(" ")[0]}</span>
                      ))}
                      {e.stocks.length>2 && <span style={{fontSize:9,color:C.textMute}}>+{e.stocks.length-2}</span>}
                    </div>
                  </div>

                  {/* 右側狀態 */}
                  <div style={{display:"flex",flexDirection:"column",alignItems:"flex-end",gap:3,flexShrink:0}}>
                    {isClosedEvent(e) && isCorrect!==null && (
                      <span style={{
                        fontSize:9, fontWeight:600, padding:"2px 7px", borderRadius:20,
                        background: isCorrect ? C.oliveBg : C.upBg,
                        color: isCorrect ? C.olive : C.up,
                      }}>{isCorrect ? "✓ 正確" : "✗ 有誤"}</span>
                    )}
                    {e.status==="tracking" && (() => {
                      const days = trackingMetrics?.trackingDays;
                      const isOverdue = days != null && days > 14;
                      const isWarning = days != null && days > 7 && !isOverdue;
                      return <>
                        <span style={{fontSize:9,color:isOverdue?C.up:isWarning?C.amber:C.blue,fontWeight:600}}>
                          追蹤中{days != null ? ` · ${days}天` : ""}
                        </span>
                        {isOverdue && <span style={{fontSize:8,padding:"1px 5px",borderRadius:3,background:C.upBg,color:C.up,fontWeight:600}}>逾期未結案</span>}
                        {isWarning && <span style={{fontSize:8,padding:"1px 5px",borderRadius:3,background:C.amberBg,color:C.amber,fontWeight:600}}>即將逾期</span>}
                      </>;
                    })()}
                    {e.status==="pending" && (
                      <span style={{fontSize:9,color:C.textMute,fontWeight:500}}>待驗證</span>
                    )}
                    <span style={{fontSize:10,color:C.textMute}}>{open?"▲":"▼"}</span>
                  </div>
                </div>

                {/* ── 展開內容 ── */}
                {open && (
                  <div style={{
                    padding:"0 12px 12px",
                    borderTop:`1px solid ${C.borderSub}`,
                    paddingTop:10,
                  }}>
                    {/* 全部個股 */}
                    <div style={{display:"flex",gap:5,flexWrap:"wrap",marginBottom:10}}>
                      {e.stocks.map(s=>(
                        <span key={s} style={{fontSize:9,padding:"2px 8px",borderRadius:3,
                          background:C.blueBg,color:C.blue,fontWeight:500}}>{s}</span>
                      ))}
                    </div>

                    <div style={{fontSize:11,color:C.textSec,lineHeight:1.8,marginBottom:8}}>{e.detail}</div>

                    {/* 預測邏輯 */}
                    <div style={{background:C.subtle,borderRadius:7,padding:"9px 11px",marginBottom: e.actualNote?8:0}}>
                      <div style={{fontSize:9,color:predC(e.pred),fontWeight:600,marginBottom:3,letterSpacing:"0.05em"}}>
                        {predIcon(e.pred)} 預測{predLabel(e.pred)} — 邏輯
                      </div>
                      <div style={{fontSize:11,color:C.textSec,lineHeight:1.7}}>{e.predReason}</div>
                    </div>

                    {trackingMetrics && (
                      <div style={{
                        background:C.blueBg,
                        border:`1px solid ${alpha(C.blue, A.soft)}`,
                        borderRadius:7,
                        padding:"9px 11px",
                        marginTop:8,
                      }}>
                        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",gap:8,flexWrap:"wrap"}}>
                          <div style={{fontSize:9,color:C.blue,fontWeight:600,letterSpacing:"0.05em"}}>
                            追蹤中 · {trackingMetrics.trackingDays != null ? `${trackingMetrics.trackingDays} 天` : "天數計算中"}
                          </div>
                          {trackingMetrics.trackingDays != null && trackingMetrics.trackingDays >= 90 && (
                            <span style={{fontSize:9,color:C.up,fontWeight:600}}>超過 90 天，建議結案</span>
                          )}
                        </div>
                        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginTop:8}}>
                          <div>
                            <div style={{fontSize:9,color:C.textMute,marginBottom:3}}>事件日價格</div>
                            <div style={{fontSize:11,color:C.textSec,lineHeight:1.6}}>
                              {formatEventPriceRecord(e.priceAtEvent)}
                            </div>
                          </div>
                          <div>
                            <div style={{fontSize:9,color:C.textMute,marginBottom:3}}>最新價格</div>
                            <div style={{fontSize:11,color:C.textSec,lineHeight:1.6}}>
                              {formatEventPriceRecord(trackingMetrics.currentPrices)}
                            </div>
                          </div>
                        </div>
                        {trackingMetrics.changePct != null && (
                          <div style={{marginTop:8,fontSize:11,color:trackingMetrics.changePct >= 0 ? C.up : C.down,fontWeight:600}}>
                            平均變化 {trackingMetrics.changePct >= 0 ? "+" : ""}{trackingMetrics.changePct.toFixed(2)}%
                            {trackingMetrics.latestDate ? ` · 更新到 ${trackingMetrics.latestDate}` : ""}
                          </div>
                        )}
                      </div>
                    )}

                    {/* 實際結果（已發生） */}
                    {e.actualNote && (
                      <div style={{
                        background: isCorrect ? alpha(C.oliveBg, A.glow) : alpha(C.upBg, A.glow),
                        border:`1px solid ${isCorrect ? alpha(C.olive, A.line):alpha(C.up, A.line)}`,
                        borderRadius:7, padding:"9px 11px", marginTop:8,
                      }}>
                        <div style={{fontSize:9,color: isCorrect?C.olive:C.up,fontWeight:600,marginBottom:3,letterSpacing:"0.05em"}}>
                          {predIcon(e.actual)} 實際{predLabel(e.actual)} — {isCorrect?"預測正確":"預測有誤"}
                        </div>
                        <div style={{fontSize:11,color:C.textSec,lineHeight:1.7}}>{e.actualNote}</div>
                      </div>
                    )}

                    {/* 復盤教訓（若有） */}
                    {e.lessons && (
                      <div style={{background:C.blueBg,border:`1px solid ${alpha(C.blue, A.soft)}`,
                        borderRadius:7,padding:"9px 11px",marginTop:8}}>
                        <div style={{fontSize:9,color:C.blue,fontWeight:600,marginBottom:3}}>策略覆盤教訓</div>
                        <div style={{fontSize:11,color:C.textSec,lineHeight:1.7}}>{e.lessons}</div>
                      </div>
                    )}

                    {/* 復盤按鈕（待觀察事件） */}
                    {(e.status==="pending" || e.status==="tracking") && (
                      <button onClick={(ev)=>openEventReview(e, ev)}
                        style={{marginTop:10,width:"100%",padding:"9px",
                          background:alpha(C.olive, A.faint),border:`1px solid ${alpha(C.olive, A.strongLine)}`,
                          borderRadius:8,color:C.olive,fontSize:11,fontWeight:500,cursor:"pointer"}}>
                        {e.status==="tracking" ? "結案復盤" : "標記結果 · 撰寫復盤"}
                      </button>
                    )}

                    {/* 復盤表單 */}
                    {reviewingEvent===e.id && (
                      <div onClick={ev=>ev.stopPropagation()} onTouchStart={ev=>ev.stopPropagation()}
                        style={{marginTop:10,background:C.subtle,borderRadius:8,padding:12,
                          border:`1px solid ${alpha(C.blue, A.line)}`}}>
                        <div style={{fontSize:10,color:C.blue,fontWeight:600,marginBottom:10}}>撰寫完整復盤</div>

                        <div style={{marginBottom:10}}>
                          <div style={{fontSize:9,color:C.textMute,marginBottom:4}}>實際走勢</div>
                          <div style={{display:"flex",gap:6}}>
                            {["up","down","neutral"].map(v=>(
                              <button key={v} onClick={()=>setReviewForm(p=>({...p,actual:v}))}
                                style={{flex:1,padding:"6px",borderRadius:6,fontSize:10,fontWeight:500,cursor:"pointer",
                                  background:reviewForm.actual===v?(v==="up"?C.upBg:v==="down"?C.downBg:C.subtle):"transparent",
                                  color:reviewForm.actual===v?(v==="up"?C.up:v==="down"?C.down:C.textSec):C.textMute,
                                  border:`1px solid ${reviewForm.actual===v?(v==="up"?alpha(C.up, A.strongLine):v==="down"?alpha(C.down, A.strongLine):C.border):C.border}`}}>
                                {v==="up"?"↑ 漲":v==="down"?"↓ 跌":"— 中性"}
                              </button>
                            ))}
                          </div>
                        </div>

                        <div style={{marginBottom:10}}>
                          <div style={{fontSize:9,color:C.textMute,marginBottom:4}}>發生了什麼？（點選快填或自行輸入）</div>
                          <div style={{display:"flex",gap:4,flexWrap:"wrap",marginBottom:6}}>
                            {["如預期上漲，符合邏輯","超預期大漲，市場過熱","不如預期，漲幅有限",
                              "與預測相反，大跌","橫盤震盪，方向不明","利多出盡，衝高回落",
                              "跳空突破，量能放大","緩跌破支撐，止跌不明"].map(chip=>(
                              <button key={chip} onClick={()=>setReviewForm(p=>({...p,actualNote:p.actualNote?p.actualNote+"；"+chip:chip}))}
                                style={{fontSize:9,padding:"3px 8px",borderRadius:12,cursor:"pointer",
                                  background:C.card,border:`1px solid ${C.border}`,color:C.textSec,
                                  whiteSpace:"nowrap"}}>
                                {chip}
                              </button>
                            ))}
                          </div>
                          <textarea value={reviewForm.actualNote}
                            onChange={ev=>setReviewForm(p=>({...p,actualNote:ev.target.value}))}
                            placeholder="描述事件結果和股價反應..."
                            style={{width:"100%",background:C.card,border:`1px solid ${C.border}`,
                              borderRadius:7,padding:8,color:C.text,fontSize:11,resize:"none",
                              minHeight:50,outline:"none",fontFamily:"inherit",lineHeight:1.7}}/>
                        </div>

                        <div style={{marginBottom:10}}>
                          <div style={{fontSize:9,color:C.textMute,marginBottom:4}}>策略覆盤（點選快填或自行輸入）</div>
                          <div style={{display:"flex",gap:4,flexWrap:"wrap",marginBottom:6}}>
                            {["進場時機正確","出場太慢，錯過高點","倉位太重，應該減碼",
                              "該停損沒停","預測邏輯正確但時間點偏差","受市場情緒影響判斷",
                              "資訊不足就進場","完美執行策略","下次應等回檔再進",
                              "應加碼但猶豫錯過"].map(chip=>(
                              <button key={chip} onClick={()=>setReviewForm(p=>({...p,lessons:p.lessons?p.lessons+"；"+chip:chip}))}
                                style={{fontSize:9,padding:"3px 8px",borderRadius:12,cursor:"pointer",
                                  background:C.card,border:`1px solid ${C.border}`,color:C.textSec,
                                  whiteSpace:"nowrap"}}>
                                {chip}
                              </button>
                            ))}
                          </div>
                          <textarea value={reviewForm.lessons}
                            onChange={ev=>setReviewForm(p=>({...p,lessons:ev.target.value}))}
                            placeholder="進場理由回顧、策略偏差、改進方向..."
                            style={{width:"100%",background:C.card,border:`1px solid ${C.border}`,
                              borderRadius:7,padding:8,color:C.text,fontSize:11,resize:"none",
                              minHeight:50,outline:"none",fontFamily:"inherit",lineHeight:1.7}}/>
                        </div>

                        <div style={{display:"flex",gap:6}}>
                          <button onClick={()=>{setReviewingEvent(null);setReviewForm(createDefaultReviewForm());}}
                            style={{flex:1,padding:"9px",background:"transparent",border:`1px solid ${C.border}`,
                              borderRadius:7,color:C.textMute,fontSize:11,cursor:"pointer"}}>取消</button>
                          <button onClick={()=>submitReview(e.id)}
                            disabled={!reviewForm.actualNote.trim()}
                            style={{flex:2,padding:"9px",borderRadius:7,border:"none",fontSize:11,fontWeight:500,cursor:"pointer",
                              background:reviewForm.actualNote.trim()?alpha(C.fillTeal, A.pressed):C.subtle,
                              color:reviewForm.actualNote.trim()?C.onFill:C.textMute}}>
                            確認送出復盤
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          };

          return <>
            {/* 準確率摘要 */}
            <div style={{
              display:"grid", gridTemplateColumns:"1fr 1fr 1fr 1fr", gap:6, marginBottom:10,
            }}>
              {[
                ["待追蹤", `${pending.length}`, C.textSec, C.card],
                ["追蹤中", `${tracking.length}`, C.blue, C.cardBlue],
                ["預測正確", `${hits}`, C.up, C.cardRose],
                ["命中率", hits+misses>0?`${Math.round(hits/(hits+misses)*100)}%`:"—", C.amber, C.cardAmber],
              ].map(([l,v,c,bg])=>(
                <div key={l} style={{background:bg,border:`1px solid ${C.border}`,borderRadius:8,padding:"7px 10px"}}>
                  <div style={{fontSize:9,color:C.textMute,letterSpacing:"0.06em"}}>{l}</div>
                  <div style={{fontSize:16,fontWeight:600,color:c,marginTop:2}}>{v}</div>
                </div>
              ))}
            </div>

            {/* 行事曆視圖 */}
            <button onClick={()=>setShowCalendar(p=>!p)} style={{
              width:"100%",padding:"8px",marginBottom:8,borderRadius:8,
              background:showCalendar?C.subtle:C.card,
              border:`1px solid ${C.border}`,
              color:showCalendar?C.textMute:C.textSec,fontSize:10,fontWeight:500,cursor:"pointer"}}>
              {showCalendar?"收合行事曆":"展開行事曆"}
            </button>

            {showCalendar && (() => {
              const { year: cYear, month: cMonth } = calendarMonth;
              const firstDay = new Date(cYear, cMonth, 1).getDay(); // 0=Sun
              const daysInMonth = new Date(cYear, cMonth + 1, 0).getDate();
              const monthLabel = `${cYear} 年 ${cMonth + 1} 月`;
              const allEvents = [...pending, ...tracking, ...past];
              // 建立日期→事件映射
              const dateEventMap = {};
              allEvents.forEach(e => {
                if (!e.date) return;
                const parts = e.date.match(/^(\d{4})\/(\d{2})\/(\d{2})$/);
                if (!parts) return;
                const [, ey, em, ed] = parts;
                if (parseInt(ey) === cYear && parseInt(em) - 1 === cMonth) {
                  const day = parseInt(ed);
                  if (!dateEventMap[day]) dateEventMap[day] = [];
                  dateEventMap[day].push(e);
                }
              });
              const todayD = new Date();
              const isToday = (d) => todayD.getFullYear() === cYear && todayD.getMonth() === cMonth && todayD.getDate() === d;
              const cells = [];
              for (let i = 0; i < firstDay; i++) cells.push(null);
              for (let d = 1; d <= daysInMonth; d++) cells.push(d);

              return (
                <div style={{...card, marginBottom:10}}>
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}>
                    <button onClick={()=>setCalendarMonth(p => {
                      const m = p.month - 1;
                      return m < 0 ? { year: p.year - 1, month: 11 } : { ...p, month: m };
                    })} style={{background:"transparent",border:"none",color:C.textSec,fontSize:14,cursor:"pointer",padding:"4px 8px"}}>◀</button>
                    <span style={{fontSize:12,fontWeight:600,color:C.text}}>{monthLabel}</span>
                    <button onClick={()=>setCalendarMonth(p => {
                      const m = p.month + 1;
                      return m > 11 ? { year: p.year + 1, month: 0 } : { ...p, month: m };
                    })} style={{background:"transparent",border:"none",color:C.textSec,fontSize:14,cursor:"pointer",padding:"4px 8px"}}>▶</button>
                  </div>
                  <div style={{display:"grid",gridTemplateColumns:"repeat(7,1fr)",gap:1,textAlign:"center"}}>
                    {["日","一","二","三","四","五","六"].map(d=>(
                      <div key={d} style={{fontSize:9,color:C.textMute,padding:"4px 0",fontWeight:600}}>{d}</div>
                    ))}
                    {cells.map((d, i) => {
                      if (d === null) return <div key={`e${i}`}/>;
                      const evts = dateEventMap[d] || [];
                      const hasTracking = evts.some(e => e.status === "tracking");
                      const hasPending = evts.some(e => e.status === "pending");
                      const hasClosed = evts.some(e => isClosedEvent(e));
                      const hasCorrect = evts.some(e => e.correct === true);
                      const hasWrong = evts.some(e => e.correct === false);
                      return (
                        <div key={d}
                          onClick={()=>{ if (evts.length > 0) setExpandedNews(new Set(evts.map(e=>e.id))); }}
                          style={{
                            padding:"4px 2px", borderRadius:6, cursor: evts.length > 0 ? "pointer" : "default",
                            background: isToday(d) ? alpha(C.blue, A.faint) : evts.length > 0 ? C.subtle : "transparent",
                            border: isToday(d) ? `1px solid ${alpha(C.blue, A.strongLine)}` : "1px solid transparent",
                            minHeight: 32,
                          }}>
                          <div style={{fontSize:10,color: isToday(d)?C.blue:C.text,fontWeight: isToday(d)?700:400}}>{d}</div>
                          {evts.length > 0 && (
                            <div style={{display:"flex",justifyContent:"center",gap:2,marginTop:2,flexWrap:"wrap"}}>
                              {hasPending && <div style={{width:5,height:5,borderRadius:"50%",background:C.textMute}}/>}
                              {hasTracking && <div style={{width:5,height:5,borderRadius:"50%",background:C.blue}}/>}
                              {hasCorrect && <div style={{width:5,height:5,borderRadius:"50%",background:C.olive}}/>}
                              {hasWrong && <div style={{width:5,height:5,borderRadius:"50%",background:C.up}}/>}
                              {hasClosed && !hasCorrect && !hasWrong && <div style={{width:5,height:5,borderRadius:"50%",background:C.textSec}}/>}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                  <div style={{display:"flex",gap:12,marginTop:8,justifyContent:"center"}}>
                    {[["待追蹤",C.textMute],["追蹤中",C.blue],["正確",C.olive],["有誤",C.up]].map(([l,c])=>(
                      <div key={l} style={{display:"flex",alignItems:"center",gap:3}}>
                        <div style={{width:5,height:5,borderRadius:"50%",background:c}}/>
                        <span style={{fontSize:8,color:C.textMute}}>{l}</span>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })()}

            {/* 新增事件按鈕 */}
            <button onClick={()=>setShowAddEvent(!showAddEvent)} style={{
              width:"100%",padding:"10px",marginBottom:10,borderRadius:8,
              background:showAddEvent?C.subtle:alpha(C.blue, A.faint),
              border:`1px solid ${showAddEvent?C.border:alpha(C.blue, A.strongLine)}`,
              color:showAddEvent?C.textMute:C.blue,fontSize:11,fontWeight:500,cursor:"pointer"}}>
              {showAddEvent?"取消":"＋ 新增事件（法說會、財報、營收、催化劑）"}
            </button>

            {showAddEvent && (
              <div style={{...card,marginBottom:12,borderLeft:`2px solid ${alpha(C.blue, A.glow)}`}}>
                <div style={{...lbl,color:C.blue}}>新增事件</div>
                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:7,marginBottom:7}}>
                  <div>
                    <div style={{fontSize:9,color:C.textMute,marginBottom:3}}>日期</div>
                    <input value={newEvent.date} onChange={e=>setNewEvent(p=>({...p,date:e.target.value}))}
                      placeholder="如 2026/04/01"
                      style={{width:"100%",background:C.subtle,border:`1px solid ${C.border}`,
                        borderRadius:7,padding:"8px 10px",color:C.text,fontSize:12,outline:"none",fontFamily:"inherit"}}/>
                  </div>
                  <div>
                    <div style={{fontSize:9,color:C.textMute,marginBottom:3}}>相關個股（逗號分隔）</div>
                    <input value={newEvent.stocks} onChange={e=>setNewEvent(p=>({...p,stocks:e.target.value}))}
                      placeholder="如 台燿 6274, 晶豪科 3006"
                      style={{width:"100%",background:C.subtle,border:`1px solid ${C.border}`,
                        borderRadius:7,padding:"8px 10px",color:C.text,fontSize:12,outline:"none",fontFamily:"inherit"}}/>
                  </div>
                </div>
                <div style={{marginBottom:7}}>
                  <div style={{fontSize:9,color:C.textMute,marginBottom:3}}>事件標題</div>
                  <input value={newEvent.title} onChange={e=>setNewEvent(p=>({...p,title:e.target.value}))}
                    placeholder="如：台燿 Q1 財報法說會"
                    style={{width:"100%",background:C.subtle,border:`1px solid ${C.border}`,
                      borderRadius:7,padding:"8px 10px",color:C.text,fontSize:12,outline:"none",fontFamily:"inherit"}}/>
                </div>
                <div style={{marginBottom:7}}>
                  <div style={{fontSize:9,color:C.textMute,marginBottom:3}}>事件細節</div>
                  <textarea value={newEvent.detail}
                    onChange={e=>setNewEvent(p=>({...p,detail:e.target.value}))}
                    placeholder="關鍵觀察重點..."
                    style={{width:"100%",background:C.subtle,border:`1px solid ${C.border}`,
                      borderRadius:7,padding:8,color:C.text,fontSize:11,resize:"none",
                      minHeight:50,outline:"none",fontFamily:"inherit",lineHeight:1.7}}/>
                </div>
                <div style={{marginBottom:7}}>
                  <div style={{fontSize:9,color:C.textMute,marginBottom:4}}>預測方向</div>
                  <div style={{display:"flex",gap:6}}>
                    {["up","down","neutral"].map(v=>(
                      <button key={v} onClick={()=>setNewEvent(p=>({...p,pred:v}))}
                        style={{flex:1,padding:"6px",borderRadius:6,fontSize:10,fontWeight:500,cursor:"pointer",
                          background:newEvent.pred===v?(v==="up"?C.upBg:v==="down"?C.downBg:C.subtle):"transparent",
                          color:newEvent.pred===v?(v==="up"?C.up:v==="down"?C.down:C.textSec):C.textMute,
                          border:`1px solid ${newEvent.pred===v?(v==="up"?alpha(C.up, A.strongLine):v==="down"?alpha(C.down, A.strongLine):C.border):C.border}`}}>
                        {v==="up"?"↑ 看漲":v==="down"?"↓ 看跌":"— 中性"}
                      </button>
                    ))}
                  </div>
                </div>
                <div style={{marginBottom:10}}>
                  <div style={{fontSize:9,color:C.textMute,marginBottom:3}}>預測邏輯</div>
                  <textarea value={newEvent.predReason}
                    onChange={e=>setNewEvent(p=>({...p,predReason:e.target.value}))}
                    placeholder="為什麼這樣預測？依據是什麼？"
                    style={{width:"100%",background:C.subtle,border:`1px solid ${C.border}`,
                      borderRadius:7,padding:8,color:C.text,fontSize:11,resize:"none",
                      minHeight:50,outline:"none",fontFamily:"inherit",lineHeight:1.7}}/>
                </div>
                <button onClick={addEvent}
                  disabled={!newEvent.title.trim()||!newEvent.date.trim()}
                  style={{width:"100%",padding:"10px",borderRadius:8,border:"none",fontSize:12,
                    fontWeight:500,cursor:newEvent.title.trim()&&newEvent.date.trim()?"pointer":"not-allowed",
                    background:newEvent.title.trim()&&newEvent.date.trim()?alpha(C.fillTeal, A.pressed):C.subtle,
                    color:newEvent.title.trim()&&newEvent.date.trim()?C.onFill:C.textMute}}>
                  新增事件
                </button>
              </div>
            )}

            {/* 待觀察 */}
            <div style={{
              display:"flex", alignItems:"center", justifyContent:"space-between",
              marginBottom:8,
            }}>
              <div style={{...lbl, marginBottom:0}}>待觀察 · {pending.length} 件</div>
              <span style={{fontSize:9,color:C.textMute}}>點擊展開詳情</span>
            </div>
            {pending.map((e,i)=> renderEvent(e, i))}

            {/* 復盤超時提醒 banner */}
            {(() => {
              const overdueEvents = tracking.filter(e => {
                const m = getEventTrackingMetrics(e);
                return m?.trackingDays != null && m.trackingDays > 14;
              });
              return overdueEvents.length > 0 ? (
                <div style={{background:C.upBg,border:`1px solid ${alpha(C.up, A.strongLine)}`,borderRadius:8,padding:"10px 12px",marginBottom:8,marginTop:16}}>
                  <div style={{fontSize:11,fontWeight:600,color:C.up,marginBottom:4}}>
                    {overdueEvents.length} 件追蹤事件已超過 14 天未結案
                  </div>
                  {overdueEvents.map(e => {
                    const m = getEventTrackingMetrics(e);
                    return (
                      <div key={e.id} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"4px 0"}}>
                        <div>
                          <span style={{fontSize:10,color:C.text}}>{e.title}</span>
                          <span style={{fontSize:9,color:C.textMute,marginLeft:6}}>已追蹤 {m?.trackingDays} 天</span>
                        </div>
                        <button onClick={(ev)=>{ev.stopPropagation();openEventReview(e.id)}}
                          style={{padding:"3px 8px",borderRadius:4,border:`1px solid ${alpha(C.olive, A.strongLine)}`,
                            background:"transparent",color:C.olive,fontSize:9,cursor:"pointer",fontWeight:600}}>
                          快速結案
                        </button>
                      </div>
                    );
                  })}
                </div>
              ) : null;
            })()}

            <div style={{...lbl, marginBottom:8, marginTop:tracking.length > 0 ? 8 : 16}}>追蹤中 · {tracking.length} 件</div>
            {tracking.map((e,i)=> renderEvent(e, pending.length + i))}

            {/* 已發生 */}
            <div style={{...lbl, marginBottom:8, marginTop:16}}>已發生 · 驗證 {hits+misses}/{past.length} 件</div>
            {past.map((e,i)=> renderEvent(e, i))}
          </>;
        })()}

      </div>
      <div style={{textAlign:"center",padding:"8px 0",fontSize:9,color:C.textMute,opacity:0.5}}>v2024.03.21b · bg:{C.bg}</div>
    </div>
  );
}
