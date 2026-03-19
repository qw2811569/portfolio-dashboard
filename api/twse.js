// Vercel Serverless Function — 代理 TWSE 即時報價 API
// 用途：解決瀏覽器 CORS 限制，讓前端可以取得台股即時股價
export default async function handler(req, res) {
  const { ex_ch } = req.query;
  if (!ex_ch) {
    return res.status(400).json({ error: "缺少 ex_ch 參數" });
  }

  try {
    const url = `https://mis.twse.com.tw/stock/api/getStockInfo.jsp?ex_ch=${encodeURIComponent(ex_ch)}&json=1&delay=0`;
    const response = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0",
        "Accept": "application/json",
      },
    });
    const data = await response.json();

    // 設定 CORS headers
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Cache-Control", "no-cache, no-store");
    return res.status(200).json(data);
  } catch (err) {
    return res.status(500).json({ error: "TWSE API 請求失敗", detail: err.message });
  }
}
