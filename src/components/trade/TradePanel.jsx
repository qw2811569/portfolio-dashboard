import { createElement as h } from "react";
import { C, alpha } from "../../theme.js";
import { Card, Button, TextInput } from "../common";

const card = {
  background: C.card,
  border: `1px solid ${C.border}`,
  borderRadius: 10,
  padding: "12px 14px",
  boxShadow: `${C.insetLine}, ${C.shadow}`,
};

const lbl = { fontSize: 10, color: C.textMute, letterSpacing: "0.06em", fontWeight: 600, marginBottom: 5 };

/**
 * Upload Dropzone
 */
export function UploadDropzone({ img, dragOver, setDragOver, processFile, parseShot, parsing, parseErr }) {
  return h("div", null,
    !parsed && h("div", {
      onDragOver: (e) => { e.preventDefault(); setDragOver(true); },
      onDragLeave: () => setDragOver(false),
      onDrop: (e) => { e.preventDefault(); setDragOver(false); processFile(e.dataTransfer.files[0]); },
      onClick: () => document.getElementById("fi").click(),
      className: "ui-card",
      style: {
        border: `1px dashed ${dragOver ? C.borderStrong : C.border}`,
        borderRadius: 12,
        padding: "28px 16px",
        textAlign: "center",
        cursor: "pointer",
        background: dragOver ? C.subtleElev : C.card,
        marginBottom: 12,
        transition: "all 0.2s",
      },
    },
      h("input", { id: "fi", type: "file", accept: "image/*", onChange: (e) => processFile(e.target.files[0]), style: { display: "none" } }),
      img
        ? h("div", null,
            h("img", { src: img, alt: "", style: { maxHeight: 200, maxWidth: "100%", borderRadius: 8, objectFit: "contain", marginBottom: 8 } }),
            h("div", { style: { fontSize: 11, color: C.textMute } }, "點擊更換截圖")
          )
        : h("div", null,
            h("div", { style: { fontSize: 32, marginBottom: 10, opacity: 0.5 } }, "↑"),
            h("div", { style: { fontSize: 13, fontWeight: 500, color: C.textSec } }, "上傳已成交截圖"),
            h("div", { style: { fontSize: 11, color: C.textMute, marginTop: 4 } }, "買進 · 賣出回報皆可")
          )
    ),
    img && h(Button, {
      onClick: parseShot,
      disabled: parsing,
      style: {
        width: "100%",
        padding: "13px",
        borderRadius: 10,
        background: parsing ? C.subtle : C.cardHover,
        color: parsing ? C.textMute : C.text,
        border: `1px solid ${parsing ? C.border : alpha(C.amber, "40")}`,
        fontSize: 13,
        fontWeight: 500,
        cursor: parsing ? "not-allowed" : "pointer",
        letterSpacing: "0.02em",
      },
    }, parsing ? "解析中..." : "解析這筆交易"),
    parseErr && h("div", {
      style: {
        marginTop: 10,
        background: C.upBg,
        border: `1px solid ${alpha(C.up, "20")}`,
        borderRadius: 10,
        padding: 12,
        fontSize: 12,
        color: C.up,
      },
    }, parseErr)
  );
}

/**
 * Parse Results
 */
export function ParseResults({ parsed, setParsed, qs, memoAns, memoIn, setMemoIn, memoStep, submitMemo, isImeComposing }) {
  if (!parsed?.trades?.length) return null;

  return h("div", null,
    h(Card, { style: { marginBottom: 12 } },
      h("div", { style: { display: "flex", justifyContent: "space-between", alignItems: "center" } },
        h("div", { style: lbl }, "解析結果"),
        h("span", { style: { fontSize: 9, color: C.textMute } }, "點擊可修正")
      ),
      parsed.trades.map((t, i) => {
        const toggleAction = () => setParsed(prev => {
          const trades = [...prev.trades];
          trades[i] = { ...trades[i], action: trades[i].action === "買進" ? "賣出" : "買進" };
          return { ...prev, trades };
        });
        const editField = (field) => {
          const label = { qty: "股數", price: "成交價", name: "名稱", code: "代碼" }[field];
          const val = prompt(`修正${label}：`, t[field]);
          if (val == null) return;
          setParsed(prev => {
            const trades = [...prev.trades];
            const parsed = field === "qty" || field === "price" ? Number(val) : val;
            if ((field === "qty" || field === "price") && isNaN(parsed)) return prev;
            trades[i] = { ...trades[i], [field]: parsed };
            return { ...prev, trades };
          });
        };

        return h("div", {
          key: i,
          style: { padding: "10px 0", borderBottom: i < parsed.trades.length - 1 ? `1px solid ${C.borderSub}` : "none" },
        },
          h("div", { style: { display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" } },
            h("span", {
              onClick: toggleAction,
              style: {
                background: t.action === "買進" ? C.upBg : C.downBg,
                color: t.action === "買進" ? C.up : C.down,
                fontSize: 10,
                fontWeight: 600,
                padding: "2px 9px",
                borderRadius: 4,
                cursor: "pointer",
                border: `1px dashed ${t.action === "買進" ? C.up : C.down}44`,
              },
            }, `${t.action} ↔`),
            h("span", {
              onClick: () => editField("name"),
              style: { fontSize: 14, fontWeight: 600, color: C.text, cursor: "pointer" },
            }, t.name),
            h("span", {
              onClick: () => editField("code"),
              style: { fontSize: 10, color: C.textMute, cursor: "pointer" },
            }, t.code)
          ),
          h("div", { style: { display: "flex", alignItems: "center", gap: 4, marginTop: 3 } },
            h("span", {
              onClick: () => editField("qty"),
              style: { fontSize: 11, color: C.textMute, cursor: "pointer", borderBottom: `1px dashed ${C.borderStrong}` },
            }, `${t.qty}股`),
            h("span", { style: { fontSize: 11, color: C.textMute } }, "@"),
            h("span", {
              onClick: () => editField("price"),
              style: { fontSize: 11, color: C.textMute, cursor: "pointer", borderBottom: `1px dashed ${C.borderStrong}` },
            }, `${t.price?.toLocaleString()}元`)
          )
        );
      }),
      parsed.note && h("div", { style: { fontSize: 10, color: C.textMute, marginTop: 8 } }, parsed.note),
      parsed.targetPriceUpdates?.length > 0 && h("div", {
        style: {
          marginTop: 10,
          background: C.tealBg,
          border: `1px solid ${alpha(C.teal, "20")}`,
          borderRadius: 7,
          padding: "8px 10px",
        },
      },
        h("div", { style: { fontSize: 9, color: C.teal, fontWeight: 600, marginBottom: 4 } }, "偵測到目標價更新"),
        parsed.targetPriceUpdates.map((u, i) =>
          h("div", { key: i, style: { fontSize: 11, color: C.textSec } },
            `${u.code} · ${u.firm} → ${u.target?.toLocaleString()}元`
          )
        )
      )
    ),

    h(Card, { style: { borderLeft: `2px solid ${alpha(C.blue, "40")}` } },
      h("div", { style: lbl }, "交易備忘錄"),
      memoAns.map((a, i) =>
        h("div", { key: i, style: { marginBottom: 12 } },
          h("div", { style: { fontSize: 10, color: C.textMute, marginBottom: 4 } }, `Q${i + 1}. ${qs[i]}`),
          h("div", {
            style: {
              fontSize: 12,
              color: C.textSec,
              background: C.subtle,
              borderRadius: 6,
              padding: "8px 10px",
              lineHeight: 1.6,
            },
          }, a)
        )
      ),
      h("div", { style: { fontSize: 12, fontWeight: 500, color: C.blue, marginBottom: 8 } },
        `Q${memoStep + 1}/${qs.length}. ${qs[memoStep]}`
      ),
      h("textarea", {
        value: memoIn,
        onChange: (e) => setMemoIn(e.target.value),
        placeholder: "輸入你的想法... (Enter 送出)",
        style: {
          width: "100%",
          background: C.subtle,
          border: `1px solid ${C.border}`,
          borderRadius: 8,
          padding: "10px",
          color: C.text,
          fontSize: 12,
          resize: "none",
          minHeight: 70,
          outline: "none",
          fontFamily: "inherit",
          marginBottom: 10,
          lineHeight: 1.7,
        },
      }),
      h(Button, {
        onClick: submitMemo,
        disabled: !memoIn.trim(),
        style: {
          width: "100%",
          padding: "12px",
          border: "none",
          borderRadius: 8,
          background: memoIn.trim() ? alpha(C.fillTeal, "40") : C.subtle,
          color: memoIn.trim() ? C.onFill : C.textMute,
          fontSize: 13,
          fontWeight: 500,
          cursor: memoIn.trim() ? "pointer" : "not-allowed",
          letterSpacing: "0.02em",
        },
      }, memoStep === qs.length - 1 ? "完成備忘 · 更新持倉" : `下一題 (${memoStep + 1}/${qs.length})`)
    )
  );
}

/**
 * Manual Update Forms
 */
export function ManualUpdateForms({ tpCode, tpFirm, tpVal, setTpCode, setTpFirm, setTpVal, fundamentalDraft, setFundamentalDraft, upsertTargetReport, upsertFundamentalsEntry, createDefaultFundamentalDraft, toSlashDate }) {
  const handleAddTarget = () => {
    const ok = upsertTargetReport({
      code: tpCode,
      firm: tpFirm,
      target: parseFloat(tpVal),
      date: toSlashDate(),
    });
    if (!ok) return;
    setTpCode(""); setTpFirm(""); setTpVal("");
  };

  const handleSaveFundamentals = () => {
    const code = fundamentalDraft.code.trim();
    if (!code) return;
    const ok = upsertFundamentalsEntry(code, {
      revenueMonth: fundamentalDraft.revenueMonth.trim() || null,
      revenueYoY: fundamentalDraft.revenueYoY === "" ? null : Number(fundamentalDraft.revenueYoY),
      revenueMoM: fundamentalDraft.revenueMoM === "" ? null : Number(fundamentalDraft.revenueMoM),
      quarter: fundamentalDraft.quarter.trim() || null,
      eps: fundamentalDraft.eps === "" ? null : Number(fundamentalDraft.eps),
      grossMargin: fundamentalDraft.grossMargin === "" ? null : Number(fundamentalDraft.grossMargin),
      roe: fundamentalDraft.roe === "" ? null : Number(fundamentalDraft.roe),
      source: fundamentalDraft.source.trim() || "手動整理",
      updatedAt: fundamentalDraft.updatedAt.trim() || toSlashDate(),
      note: fundamentalDraft.note.trim(),
    });
    if (!ok) return;
    setFundamentalDraft(createDefaultFundamentalDraft());
  };

  return h("div", { style: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginTop: 14 } },
    h(Card, { style: { borderLeft: `2px solid ${alpha(C.teal, "40")}` } },
      h("div", { style: lbl }, "手動更新目標價"),
      h("div", { style: { fontSize: 11, color: C.textMute, marginBottom: 10, lineHeight: 1.6 } },
        "收到新研究報告時，直接在這裡更新。系統會自動計算多家均值。"
      ),
      h("div", { style: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 7, marginBottom: 7 } },
        h("div", null,
          h("div", { style: { fontSize: 9, color: C.textMute, marginBottom: 3 } }, "股票代碼"),
          h("input", {
            value: tpCode,
            onChange: (e) => setTpCode(e.target.value),
            placeholder: "如 3006",
            style: { width: "100%", background: C.subtle, border: `1px solid ${C.border}`, borderRadius: 7, padding: "8px 10px", color: C.text, fontSize: 12, outline: "none", fontFamily: "inherit" },
          })
        ),
        h("div", null,
          h("div", { style: { fontSize: 9, color: C.textMute, marginBottom: 3 } }, "目標價（元）"),
          h("input", {
            value: tpVal,
            onChange: (e) => setTpVal(e.target.value),
            placeholder: "如 205",
            type: "number",
            style: { width: "100%", background: C.subtle, border: `1px solid ${C.border}`, borderRadius: 7, padding: "8px 10px", color: C.text, fontSize: 12, outline: "none", fontFamily: "inherit" },
          })
        )
      ),
      h("div", { style: { marginBottom: 10 } },
        h("div", { style: { fontSize: 9, color: C.textMute, marginBottom: 3 } }, "券商 / 來源"),
        h("input", {
          value: tpFirm,
          onChange: (e) => setTpFirm(e.target.value),
          placeholder: "如 元大投顧、FactSet 共識",
          style: { width: "100%", background: C.subtle, border: `1px solid ${C.border}`, borderRadius: 7, padding: "8px 10px", color: C.text, fontSize: 12, outline: "none", fontFamily: "inherit" },
        })
      ),
      h(Button, {
        onClick: handleAddTarget,
        disabled: !tpCode.trim() || !tpVal,
        style: {
          width: "100%",
          padding: "10px",
          border: "none",
          borderRadius: 8,
          background: tpCode.trim() && tpVal ? alpha(C.fillTeal, "40") : C.subtle,
          color: tpCode.trim() && tpVal ? C.onFill : C.textMute,
          fontSize: 12,
          fontWeight: 500,
          cursor: tpCode.trim() && tpVal ? "pointer" : "not-allowed",
        },
      }, "新增 / 更新目標價")
    ),

    h(Card, { style: { borderLeft: `2px solid ${alpha(C.amber, "40")}` } },
      h("div", { style: lbl }, "手動更新財報 / 營收"),
      h("div", { style: { fontSize: 11, color: C.textMute, marginBottom: 10, lineHeight: 1.6 } },
        "法說、月營收或財報出來後，把關鍵數字補進來，dossier 就會跟著變新。"
      ),
      h("div", { style: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 7, marginBottom: 7 } },
        h("div", null,
          h("div", { style: { fontSize: 9, color: C.textMute, marginBottom: 3 } }, "股票代碼"),
          h("input", {
            value: fundamentalDraft.code,
            onChange: (e) => setFundamentalDraft(prev => ({ ...prev, code: e.target.value })),
            placeholder: "如 6274",
            style: { width: "100%", background: C.subtle, border: `1px solid ${C.border}`, borderRadius: 7, padding: "8px 10px", color: C.text, fontSize: 12, outline: "none", fontFamily: "inherit" },
          })
        ),
        h("div", null,
          h("div", { style: { fontSize: 9, color: C.textMute, marginBottom: 3 } }, "資料日期"),
          h("input", {
            value: fundamentalDraft.updatedAt,
            onChange: (e) => setFundamentalDraft(prev => ({ ...prev, updatedAt: e.target.value })),
            placeholder: "如 2026/03/24",
            style: { width: "100%", background: C.subtle, border: `1px solid ${C.border}`, borderRadius: 7, padding: "8px 10px", color: C.text, fontSize: 12, outline: "none", fontFamily: "inherit" },
          })
        )
      ),
      h("div", { style: { marginBottom: 10 } },
        h(Button, {
          onClick: handleSaveFundamentals,
          disabled: !fundamentalDraft.code.trim(),
          style: {
            width: "100%",
            padding: "10px",
            border: "none",
            borderRadius: 8,
            background: fundamentalDraft.code.trim() ? alpha(C.fillAmber, "40") : C.subtle,
            color: fundamentalDraft.code.trim() ? C.onFill : C.textMute,
            fontSize: 12,
            fontWeight: 500,
            cursor: fundamentalDraft.code.trim() ? "pointer" : "not-allowed",
          },
        }, "儲存財報 / 營收摘要")
      )
    )
  );
}

/**
 * Main Trade Panel
 */
export function TradePanel({
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
  qs,
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
}) {
  return h("div", null,
    h(UploadDropzone, {
      img,
      dragOver,
      setDragOver,
      processFile,
      parseShot,
      parsing,
      parseErr,
    }),
    h(ParseResults, {
      parsed,
      setParsed,
      qs,
      memoAns,
      memoIn,
      setMemoIn,
      memoStep,
      submitMemo,
      isImeComposing,
    }),
    h(ManualUpdateForms, {
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
    })
  );
}
