/**
 * Trade Upload Page
 * 
 * Upload trade screenshots and parse transactions
 */

import { createElement as h } from 'react';
import { TradePanel } from '../components/trade/index.js';
import { useHoldingsStore } from '../stores/holdingsStore.js';
import { useReportsStore } from '../stores/reportsStore.js';
import { useState, useRef } from 'react';

const MEMO_Q = {
  "買進": ["為什麼選這檔？核心邏輯是什麼？", "進場的技術或籌碼依據？", "出場計畫：目標價？停損價？"],
  "賣出": ["為什麼在這個價位賣？", "達成原本預期了嗎？", "這筆資金的下一步？"],
};

export function TradePage() {
  // Get state from stores
  const setHoldings = useHoldingsStore(state => state.setHoldings);
  const upsertTargetReport = useHoldingsStore(state => state.updateTargetPrice);
  const upsertFundamentalsEntry = useHoldingsStore(state => state.upsertFundamentals);
  
  // Local state for upload flow
  const [img, setImg] = useState(null);
  const [b64, setB64] = useState(null);
  const [dragOver, setDragOver] = useState(false);
  const [parsing, setParsing] = useState(false);
  const [parsed, setParsed] = useState(null);
  const [parseErr, setParseErr] = useState(null);
  const [memoStep, setMemoStep] = useState(0);
  const [memoAns, setMemoAns] = useState([]);
  const [memoIn, setMemoIn] = useState('');
  
  // Target price and fundamentals state
  const [tpCode, setTpCode] = useState('');
  const [tpFirm, setTpFirm] = useState('');
  const [tpVal, setTpVal] = useState('');
  const [fundamentalDraft, setFundamentalDraft] = useState({
    code: '',
    revenueMonth: '',
    revenueYoY: '',
    revenueMoM: '',
    quarter: '',
    eps: '',
    grossMargin: '',
    roe: '',
    source: '',
    updatedAt: '',
    note: '',
  });
  
  const imgTypeRef = useRef('image/jpeg');
  
  // Handlers
  const processFile = (file) => {
    if (!file?.type.startsWith('image/')) return;
    setImg(URL.createObjectURL(file));
    setParsed(null);
    setParseErr(null);
    setMemoStep(0);
    setMemoAns([]);
    setMemoIn('');
    imgTypeRef.current = file.type || 'image/jpeg';
    
    const r = new FileReader();
    r.onload = e => setB64(e.target.result.split(',')[1]);
    r.readAsDataURL(file);
  };
  
  const parseShot = async () => {
    if (!b64) return;
    setParsing(true);
    setParseErr(null);
    
    try {
      const res = await fetch('/api/parse', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          systemPrompt: `你是台股券商成交回報截圖的解析器。解析截圖中的交易，以 JSON 格式輸出`,
          base64: b64,
          mediaType: imgTypeRef.current,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || data.error || 'API 錯誤');
      const clean = (data.content?.[0]?.text || '').replace(/```json|```/g, '').trim();
      if (!clean) throw new Error('AI 未回傳可解析的內容');
      setParsed(JSON.parse(clean));
    } catch (err) {
      console.error('parseShot error:', err);
      setParseErr(err.message || '解析失敗，請確認截圖清晰');
    } finally {
      setParsing(false);
    }
  };
  
  const submitMemo = () => {
    if (!parsed?.trades?.length) return;
    const t = parsed.trades[0];
    const qs = MEMO_Q[t.action] || MEMO_Q["買進"];
    const ans = [...memoAns, memoIn];
    setMemoIn('');
    
    if (memoStep < qs.length - 1) {
      setMemoAns(ans);
      setMemoStep(memoStep + 1);
      return;
    }
    
    // Create trade entry
    const entry = {
      id: Date.now(),
      date: new Date().toLocaleDateString('zh-TW'),
      time: new Date().toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit' }),
      action: t.action,
      code: t.code,
      name: t.name,
      qty: t.qty,
      price: t.price,
      qa: qs.map((q, i) => ({ q, a: ans[i] || '' })),
    };
    
    // Update holdings
    setHoldings(prev => {
      // TODO: Implement applyTradeEntryToHoldings
      return prev;
    });
    
    // Reset
    setParsed(null);
    setImg(null);
    setB64(null);
    setMemoStep(0);
    setMemoAns([]);
  };
  
  const isImeComposing = (ev) => ev.nativeEvent?.isComposing || ev.keyCode === 229;
  
  const toSlashDate = (date = new Date()) => {
    const d = new Date(date);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}/${month}/${day}`;
  };
  
  const createDefaultFundamentalDraft = () => ({
    code: '',
    revenueMonth: '',
    revenueYoY: '',
    revenueMoM: '',
    quarter: '',
    eps: '',
    grossMargin: '',
    roe: '',
    source: '',
    updatedAt: '',
    note: '',
  });
  
  return h(TradePanel, {
    img,
    setImg,
    dragOver,
    setDragOver,
    processFile,
    parseShot,
    parsing,
    parseErr,
    parsed,
    setParsed,
    qs: MEMO_Q,
    memoAns,
    setMemoAns,
    memoIn,
    setMemoIn,
    memoStep,
    setMemoStep,
    submitMemo,
    isImeComposing,
    tpCode,
    tpFirm,
    tpVal,
    setTpCode,
    setTpFirm,
    setTpVal,
    fundamentalDraft,
    setFundamentalDraft,
    upsertTargetReport,
    upsertFundamentalsEntry,
    createDefaultFundamentalDraft,
    toSlashDate,
  });
}
