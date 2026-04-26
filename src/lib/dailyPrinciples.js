const TAIPEI_DAY_FORMATTER = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Asia/Taipei',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
})

// Author registry — each entry: name (display), brief (1-line). 國際投資人 only per
// user 2026-04-17 R4.6 directive ("台灣人不屑台灣人 · 語錄池只留國際"). 不收台灣 / 中港 /
// 古典中文 / 商人格言。
const AUTHORS = Object.freeze({
  buffett: {
    name: 'Warren Buffett',
    brief: 'Berkshire Hathaway 董事長 · 價值投資代表人物',
  },
  munger: {
    name: 'Charlie Munger · 蒙格',
    brief: 'Berkshire Hathaway 副董事長 · 反向思考的代言人',
  },
  lynch: { name: 'Peter Lynch · 彼得.林區', brief: 'Magellan Fund 傳奇基金經理人' },
  graham: { name: 'Benjamin Graham · 葛拉漢', brief: '價值投資之父 · Warren Buffett 的老師' },
  marks: { name: 'Howard Marks · 霍華.馬克斯', brief: 'Oaktree Capital 共同創辦人 · memo 作者' },
  templeton: { name: 'John Templeton · 鄧普頓', brief: 'Templeton Funds 創辦人 · 全球投資先驅' },
  soros: { name: 'George Soros · 索羅斯', brief: 'Quantum Fund 操盤手 · 反身性理論' },
  klarman: { name: 'Seth Klarman · 克拉曼', brief: 'Baupost Group · Margin of Safety 作者' },
  livermore: { name: 'Jesse Livermore · 李佛摩', brief: '20 世紀初投機交易傳奇' },
  fisher: { name: 'Philip Fisher · 費雪', brief: 'Common Stocks and Uncommon Profits 作者' },
  housel: { name: 'Morgan Housel', brief: 'The Psychology of Money 作者' },
  bogle: { name: 'John Bogle · 柏格', brief: 'Vanguard 創辦人 · 指數基金之父' },
  dalio: { name: 'Ray Dalio · 達利歐', brief: 'Bridgewater Associates 創辦人 · Principles 作者' },
  druck: {
    name: 'Stanley Druckenmiller · 杜肯米勒',
    brief: '前 Soros 主要交易員 · Duquesne 創辦人',
  },
  tepper: { name: 'David Tepper · 特珀', brief: 'Appaloosa Management 創辦人' },
  rogers: { name: 'Jim Rogers · 羅傑斯', brief: 'Quantum Fund 共同創辦人' },
  icahn: { name: 'Carl Icahn · 伊坎', brief: '激進股東主義代表 · Icahn Enterprises 主席' },
  ackman: { name: 'Bill Ackman · 艾克曼', brief: 'Pershing Square Capital 創辦人' },
  greenblatt: { name: 'Joel Greenblatt · 葛林布雷', brief: 'Gotham Asset · 神奇公式作者' },
  schloss: { name: 'Walter Schloss · 史洛斯', brief: '葛拉漢嫡傳弟子 · 持有期超長的價值投資者' },
  burry: { name: 'Michael Burry · 貝瑞', brief: 'The Big Short 中放空次貸的醫生投資人' },
  mauboussin: {
    name: 'Michael Mauboussin',
    brief: 'Morgan Stanley · Counterpoint Global 研究主管',
  },
  twain: { name: 'Mark Twain · 馬克吐溫', brief: '美國作家 · 19 世紀投機者格言常被引用' },
  kahneman: { name: 'Daniel Kahneman · 康納曼', brief: '諾貝爾經濟學獎 · Thinking Fast and Slow' },
  thaler: { name: 'Richard Thaler · 塞勒', brief: '諾貝爾經濟學獎 · 行為經濟學奠基者' },
  shiller: { name: 'Robert Shiller · 席勒', brief: '諾貝爾經濟學獎 · Irrational Exuberance 作者' },
  taleb: { name: 'Nassim Taleb · 塔雷伯', brief: 'Black Swan / Antifragile 作者' },
  keynes: { name: 'John Maynard Keynes · 凱因斯', brief: '20 世紀經濟學家 · 也是成功的投資人' },
  arnott: { name: 'Robert Arnott', brief: 'Research Affiliates 創辦人 · 因子投資先驅' },
  bernstein: {
    name: 'William Bernstein · 伯恩斯坦',
    brief: '神經科醫師 + 投資作家 · The Four Pillars of Investing',
  },
  baruch: {
    name: 'Bernard Baruch · 伯納德.巴魯克',
    brief: '美國投資家與政治顧問 · 以紀律賣出聞名',
  },
  simons: {
    name: 'Jim Simons · 吉姆.西蒙斯',
    brief: 'Renaissance Technologies 創辦人 · 量化投資先驅',
  },
  dreman: {
    name: 'David Dreman · 大衛.德瑞曼',
    brief: '反向投資代表人物 · Contrarian Investment Strategies 作者',
  },
  williamONeil: {
    name: "William O'Neil · 威廉.歐尼爾",
    brief: 'Investor’s Business Daily 創辦人 · CAN SLIM 方法提出者',
  },
  minervini: {
    name: 'Mark Minervini · 馬克.米奈維尼',
    brief: '美國短線冠軍交易員 · Trade Like a Stock Market Wizard 作者',
  },
  weinstein: {
    name: 'Stan Weinstein · 史坦.溫斯坦',
    brief: '階段分析法代表人物 · Secrets for Profiting in Bull and Bear Markets 作者',
  },
  darvas: {
    name: 'Nicolas Darvas · 尼可拉斯.達瓦斯',
    brief: 'How I Made $2,000,000 in the Stock Market 作者 · 箱型理論代表',
  },
  steinhardt: {
    name: 'Michael Steinhardt · 麥可.史坦哈特',
    brief: '對沖基金先驅 · No Bull 作者',
  },
  seykota: {
    name: 'Ed Seykota · 艾德.塞柯塔',
    brief: '趨勢追蹤先驅 · Market Wizards 經典受訪者',
  },
  pabrai: {
    name: 'Mohnish Pabrai · 莫尼什.帕伯萊',
    brief: 'Pabrai Funds 創辦人 · The Dhandho Investor 作者',
  },
  damodaran: {
    name: 'Aswath Damodaran · 阿斯沃斯.達摩達蘭',
    brief: 'NYU Stern 教授 · 估值研究代表人物',
  },
  asness: {
    name: 'Cliff Asness · 克里夫.阿斯內斯',
    brief: 'AQR Capital 創辦人 · 因子投資與價值風格研究者',
  },
  tillinghast: {
    name: 'Joel Tillinghast · 喬爾.提林哈斯特',
    brief: 'Fidelity Low-Priced Stock Fund 傳奇經理人',
  },
  grantham: {
    name: 'Jeremy Grantham · 傑瑞米.葛蘭森',
    brief: 'GMO 共同創辦人 · 泡沫循環觀察者',
  },
  miller: {
    name: 'Bill Miller · 比爾.米勒',
    brief: 'Legg Mason 傳奇基金經理人 · 連續 15 年勝 S&P 500',
  },
  neff: {
    name: 'John Neff · 約翰.奈夫',
    brief: 'Vanguard Windsor Fund 傳奇經理人 · 低本益比投資代表',
  },
  swensen: {
    name: 'David Swensen · 大衛.史文森',
    brief: 'Yale Endowment 長年掌舵者 · 機構資產配置革新者',
  },
  ariely: {
    name: 'Dan Ariely · 丹.艾瑞里',
    brief: '行為經濟學作家 · Predictably Irrational 作者',
  },
  shefrin: {
    name: 'Hersh Shefrin · 赫許.雪夫林',
    brief: '行為財務學者 · Beyond Greed and Fear 作者',
  },
  friedman: {
    name: 'Milton Friedman · 傅利曼',
    brief: '諾貝爾經濟學獎得主 · 自由市場經濟學代表',
  },
  hayek: {
    name: 'Friedrich Hayek · 海耶克',
    brief: '諾貝爾經濟學獎得主 · 分散知識與價格機制思想家',
  },
  schumpeter: {
    name: 'Joseph Schumpeter · 熊彼特',
    brief: '經濟學家 · 創造性破壞理論代表',
  },
  galbraith: {
    name: 'John Kenneth Galbraith · 加爾布雷斯',
    brief: '經濟學家與作家 · A Short History of Financial Euphoria 作者',
  },
  johnTrain: {
    name: 'John Train · 約翰.崔恩',
    brief: '投資作家 · The Money Masters 作者',
  },
  adamSmith: {
    name: 'Adam Smith · 亞當.斯密',
    brief: '古典經濟學奠基者 · The Wealth of Nations 作者',
  },
  gordonGekko: {
    name: 'Gordon Gekko · 高登.蓋柯',
    brief: '電影 Wall Street (1987) 的虛構企業掠奪者角色',
  },
  bigShortFilm: {
    name: 'The Big Short · 大賣空',
    brief: '2015 年金融危機電影 · 聚焦次貸泡沫與錯價',
  },
  marginCallFilm: {
    name: 'Margin Call · 商海通牒',
    brief: '2011 年金融危機電影 · 描繪投行連夜去風險',
  },
  insideJobFilm: {
    name: 'Inside Job · 監守自盜',
    brief: '2010 年金融危機紀錄片 · 討論誘因與監管失靈',
  },
  street: { name: 'Wall Street 市井諺語', brief: '長年累積的市場格言 · 無單一作者' },
})

const A = {}
for (const [k, v] of Object.entries(AUTHORS)) {
  A[k] = v.name
}

const DEFAULT_PRINCIPLE_TAGS = Object.freeze(['discipline', 'patience'])

function principle(authorKey, quote, quoteEn, year = '', tags = DEFAULT_PRINCIPLE_TAGS) {
  return {
    quote,
    quoteEn,
    author: A[authorKey],
    year,
    authorBrief: AUTHORS[authorKey].brief,
    tags,
  }
}

function principles(authorKey, rows = []) {
  return rows.map(([year, quote, quoteEn, tags]) =>
    principle(authorKey, quote, quoteEn, year, tags)
  )
}

// Each entry: { quote (zh translation), quoteEn (original English where known),
// author (display name from AUTHORS), year (approximate quote year, '' if unknown),
// authorBrief (1-line context), tags (mood/situation tags)
// Tag taxonomy: caution / courage / cycles / discipline / drawdown / humility /
// long-term / opportunity / patience / risk / value / optimism
export const DAILY_PRINCIPLES = Object.freeze([
  // === Buffett ===
  {
    quote: '別人貪婪時恐懼，別人恐懼時貪婪。',
    quoteEn: 'Be fearful when others are greedy, and greedy when others are fearful.',
    author: A.buffett,
    year: '2004',
    authorBrief: AUTHORS.buffett.brief,
    tags: ['caution', 'courage', 'cycles'],
  },
  {
    quote: '時間是好公司的朋友，是平庸公司的敵人。',
    quoteEn: 'Time is the friend of the wonderful company, the enemy of the mediocre.',
    author: A.buffett,
    year: '1989',
    authorBrief: AUTHORS.buffett.brief,
    tags: ['long-term', 'patience'],
  },
  {
    quote: '當潮水退去，才會知道誰在裸泳。',
    quoteEn: "Only when the tide goes out do you discover who's been swimming naked.",
    author: A.buffett,
    year: '2001',
    authorBrief: AUTHORS.buffett.brief,
    tags: ['cycles', 'risk', 'humility'],
  },
  {
    quote: '若你不打算持有一檔股票十年，就別考慮持有它十分鐘。',
    quoteEn:
      "If you aren't willing to own a stock for ten years, don't even think about owning it for ten minutes.",
    author: A.buffett,
    year: '1996',
    authorBrief: AUTHORS.buffett.brief,
    tags: ['long-term', 'patience'],
  },
  {
    quote: '股票不知道你擁有它，所以對它別有感情。',
    quoteEn: "The stock doesn't know that you own it.",
    author: A.buffett,
    year: 'unknown',
    authorBrief: AUTHORS.buffett.brief,
    tags: ['discipline', 'humility'],
  },
  {
    quote: '了解自己的能力圈，並待在裡面。',
    quoteEn: 'Know your circle of competence, and stick within it.',
    author: A.buffett,
    year: '1996',
    authorBrief: AUTHORS.buffett.brief,
    tags: ['discipline', 'humility'],
  },
  {
    quote: '價格是你付的，價值是你拿到的。',
    quoteEn: 'Price is what you pay. Value is what you get.',
    author: A.buffett,
    year: '2008',
    authorBrief: AUTHORS.buffett.brief,
    tags: ['value', 'discipline'],
  },
  {
    quote: '寧可付合理價格買偉大的公司，也不要用便宜價格買平庸的公司。',
    quoteEn:
      "It's far better to buy a wonderful company at a fair price than a fair company at a wonderful price.",
    author: A.buffett,
    year: '1989',
    authorBrief: AUTHORS.buffett.brief,
    tags: ['value', 'long-term'],
  },
  {
    quote: '規則一：不要賠錢。規則二：不要忘記規則一。',
    quoteEn: 'Rule No. 1: Never lose money. Rule No. 2: Never forget rule No. 1.',
    author: A.buffett,
    year: 'unknown',
    authorBrief: AUTHORS.buffett.brief,
    tags: ['risk', 'discipline'],
  },
  {
    quote: '風險來自於你不知道自己在做什麼。',
    quoteEn: 'Risk comes from not knowing what you are doing.',
    author: A.buffett,
    year: 'unknown',
    authorBrief: AUTHORS.buffett.brief,
    tags: ['risk', 'humility'],
  },
  {
    quote: '若你不能在帳戶縮水 50% 時保持冷靜，你不該在股市裡。',
    quoteEn:
      'If you cannot watch your stock decline by 50% without becoming panic-stricken, you should not be in the stock market.',
    author: A.buffett,
    year: 'unknown',
    authorBrief: AUTHORS.buffett.brief,
    tags: ['drawdown', 'discipline'],
  },
  {
    quote: '我們最喜歡的持有期間是永遠。',
    quoteEn: 'Our favorite holding period is forever.',
    author: A.buffett,
    year: '1988',
    authorBrief: AUTHORS.buffett.brief,
    tags: ['long-term', 'patience'],
  },
  {
    quote: '挑公司比挑股票重要。',
    quoteEn: 'In the business world, the rearview mirror is always clearer than the windshield.',
    author: A.buffett,
    year: 'unknown',
    authorBrief: AUTHORS.buffett.brief,
    tags: ['value', 'long-term'],
  },
  {
    quote: '股市是一個把錢從沒耐心的人轉到有耐心的人的地方。',
    quoteEn:
      'The stock market is a device for transferring money from the impatient to the patient.',
    author: A.buffett,
    year: 'unknown',
    authorBrief: AUTHORS.buffett.brief,
    tags: ['patience', 'long-term'],
  },
  {
    quote: '你不需要每一球都揮棒，等到甜蜜點再出手。',
    quoteEn:
      "There are no called strikes in investing. You don't have to swing at everything — you can wait for your pitch.",
    author: A.buffett,
    year: 'unknown',
    authorBrief: AUTHORS.buffett.brief,
    tags: ['patience', 'opportunity'],
  },
  {
    quote: '我從不試著預測市場，只試著理解企業。',
    quoteEn:
      'I never attempt to make money on the stock market. I buy on the assumption that they could close the market the next day and not reopen it for five years.',
    author: A.buffett,
    year: 'unknown',
    authorBrief: AUTHORS.buffett.brief,
    tags: ['discipline', 'value'],
  },
  {
    quote: '永遠不要做空美國。',
    quoteEn: 'Never bet against America.',
    author: A.buffett,
    year: '2008',
    authorBrief: AUTHORS.buffett.brief,
    tags: ['long-term', 'optimism'],
  },
  {
    quote: '在投資中，最重要的特質不是智商，是性格。',
    quoteEn: 'The most important quality for an investor is temperament, not intellect.',
    author: A.buffett,
    year: 'unknown',
    authorBrief: AUTHORS.buffett.brief,
    tags: ['discipline', 'humility'],
  },
  {
    quote: '名譽要花二十年建立，五分鐘毀掉。',
    quoteEn: 'It takes 20 years to build a reputation and five minutes to ruin it.',
    author: A.buffett,
    year: 'unknown',
    authorBrief: AUTHORS.buffett.brief,
    tags: ['risk', 'discipline'],
  },
  {
    quote: '人都會犯錯，重點是別在錯的地方下大注。',
    quoteEn:
      "You only have to do a very few things right in your life so long as you don't do too many things wrong.",
    author: A.buffett,
    year: 'unknown',
    authorBrief: AUTHORS.buffett.brief,
    tags: ['risk', 'humility'],
  },

  // === Munger 蒙格 ===
  {
    quote: '只要知道我會死在哪裡，我就絕不會去那裡。',
    quoteEn: "All I want to know is where I'm going to die, so I'll never go there.",
    author: A.munger,
    year: 'unknown',
    authorBrief: AUTHORS.munger.brief,
    tags: ['risk', 'humility'],
  },
  {
    quote: '反過來想，總是反過來想。',
    quoteEn: 'Invert, always invert.',
    author: A.munger,
    year: 'unknown',
    authorBrief: AUTHORS.munger.brief,
    tags: ['discipline', 'risk'],
  },
  {
    quote: '把屁股黏在椅子上，是這個世界上最被低估的能力。',
    quoteEn: 'The big money is not in the buying or the selling, but in the waiting.',
    author: A.munger,
    year: 'unknown',
    authorBrief: AUTHORS.munger.brief,
    tags: ['patience', 'long-term'],
  },
  {
    quote: '如果你拒絕從別人的錯誤中學習，你就只能用自己的錢去學。',
    quoteEn: "If you don't learn from the mistakes of others, you'll have to make them yourself.",
    author: A.munger,
    year: 'unknown',
    authorBrief: AUTHORS.munger.brief,
    tags: ['humility', 'risk'],
  },
  {
    quote: '常識是非常稀有的常識。',
    quoteEn: 'Common sense is not so common.',
    author: A.munger,
    year: 'unknown',
    authorBrief: AUTHORS.munger.brief,
    tags: ['discipline', 'humility'],
  },
  {
    quote: '理性比聰明更重要。',
    quoteEn: 'Rationality is the only thing that helps you. Brilliance does not.',
    author: A.munger,
    year: 'unknown',
    authorBrief: AUTHORS.munger.brief,
    tags: ['discipline', 'humility'],
  },
  {
    quote: '想要結果，先看誘因。',
    quoteEn: 'Show me the incentive and I will show you the outcome.',
    author: A.munger,
    year: 'unknown',
    authorBrief: AUTHORS.munger.brief,
    tags: ['discipline', 'humility'],
  },
  {
    quote: '如果你不願意承受 50% 的回撤，你就不該擁有股票。',
    quoteEn:
      "If you're not willing to react with equanimity to a market price decline of 50%, you're not fit to be a common shareholder.",
    author: A.munger,
    year: 'unknown',
    authorBrief: AUTHORS.munger.brief,
    tags: ['drawdown', 'discipline'],
  },
  {
    quote: '一個人若不會說「我不知道」，就不夠格說自己懂投資。',
    quoteEn: "Acknowledging what you don't know is the dawning of wisdom.",
    author: A.munger,
    year: 'unknown',
    authorBrief: AUTHORS.munger.brief,
    tags: ['humility'],
  },
  {
    quote: '投資生涯能挑對 20 個關鍵決定，這輩子就夠了。',
    quoteEn:
      'It is remarkable how much long-term advantage people like us have gotten by trying to be consistently not stupid.',
    author: A.munger,
    year: 'unknown',
    authorBrief: AUTHORS.munger.brief,
    tags: ['patience', 'opportunity'],
  },
  {
    quote: '別跟你不尊敬的人合作，無論報酬多吸引。',
    quoteEn: 'Never work with anyone you do not admire.',
    author: A.munger,
    year: 'unknown',
    authorBrief: AUTHORS.munger.brief,
    tags: ['discipline'],
  },

  // === Lynch 林區 ===
  {
    quote: '知道你買了什麼，也知道你為什麼買它。',
    quoteEn: 'Know what you own, and know why you own it.',
    author: A.lynch,
    year: '1989',
    authorBrief: AUTHORS.lynch.brief,
    tags: ['discipline', 'value'],
  },
  {
    quote: '預測市場短期走勢，是專家們最常做也最常錯的事。',
    quoteEn:
      'Far more money has been lost by investors preparing for corrections than has been lost in corrections themselves.',
    author: A.lynch,
    year: '1994',
    authorBrief: AUTHORS.lynch.brief,
    tags: ['humility', 'discipline'],
  },
  {
    quote: '每張股票後面都有一家公司，搞清楚那家公司在做什麼。',
    quoteEn: "Behind every stock is a company. Find out what it's doing.",
    author: A.lynch,
    year: '1989',
    authorBrief: AUTHORS.lynch.brief,
    tags: ['value', 'discipline'],
  },
  {
    quote: '如果你在投資前花的時間，比挑微波爐還少，麻煩就大了。',
    quoteEn:
      'Investing without research is like playing stud poker and never looking at the cards.',
    author: A.lynch,
    year: '1989',
    authorBrief: AUTHORS.lynch.brief,
    tags: ['discipline', 'humility'],
  },
  {
    quote: '投資裡，胃比腦袋重要。',
    quoteEn: "In the stock market, the most important organ is the stomach. It's not the brain.",
    author: A.lynch,
    year: 'unknown',
    authorBrief: AUTHORS.lynch.brief,
    tags: ['drawdown', 'discipline'],
  },
  {
    quote: '十大致富股，有八支來自你身邊的日常。',
    quoteEn: 'Invest in what you know.',
    author: A.lynch,
    year: 'unknown',
    authorBrief: AUTHORS.lynch.brief,
    tags: ['value', 'discipline'],
  },
  {
    quote: '如果一檔股票讓你睡不好，部位太大了。',
    quoteEn: "Don't bottom fish. Don't average down.",
    author: A.lynch,
    year: 'unknown',
    authorBrief: AUTHORS.lynch.brief,
    tags: ['risk', 'discipline'],
  },

  // === Graham 葛拉漢 ===
  {
    quote: '短期市場是一台投票機，長期是一台秤重機。',
    quoteEn:
      'In the short run, the market is a voting machine, but in the long run it is a weighing machine.',
    author: A.graham,
    year: '1949',
    authorBrief: AUTHORS.graham.brief,
    tags: ['cycles', 'long-term', 'value'],
  },
  {
    quote: '聰明的投資者是現實主義者，向樂觀者賣出，向悲觀者買進。',
    quoteEn:
      'The intelligent investor is a realist who sells to optimists and buys from pessimists.',
    author: A.graham,
    year: '1949',
    authorBrief: AUTHORS.graham.brief,
    tags: ['cycles', 'value', 'discipline'],
  },
  {
    quote: '投資者最大的敵人，往往是自己。',
    quoteEn: "The investor's chief problem — and even his worst enemy — is likely to be himself.",
    author: A.graham,
    year: '1949',
    authorBrief: AUTHORS.graham.brief,
    tags: ['discipline', 'humility'],
  },
  {
    quote: '安全邊際是投資的核心概念。',
    quoteEn:
      'The function of the margin of safety is, in essence, that of rendering unnecessary an accurate estimate of the future.',
    author: A.graham,
    year: '1949',
    authorBrief: AUTHORS.graham.brief,
    tags: ['risk', 'value'],
  },
  {
    quote: '別讓市場先生決定你買賣的時機，他只是來報價的。',
    quoteEn: 'Mr. Market is there to serve you, not to guide you.',
    author: A.graham,
    year: '1949',
    authorBrief: AUTHORS.graham.brief,
    tags: ['discipline', 'cycles'],
  },
  {
    quote: '投資操作必須以充分的分析為基礎，承諾本金安全與合理回報。',
    quoteEn:
      'An investment operation is one which, upon thorough analysis, promises safety of principal and an adequate return.',
    author: A.graham,
    year: '1934',
    authorBrief: AUTHORS.graham.brief,
    tags: ['risk', 'discipline'],
  },

  // === Marks 馬克斯 ===
  {
    quote: '無法預測，但可以做好準備。',
    quoteEn: "You can't predict. You can prepare.",
    author: A.marks,
    year: '2001',
    authorBrief: AUTHORS.marks.brief,
    tags: ['risk', 'discipline'],
  },
  {
    quote: '便宜不是買進的理由，貴也不是賣出的理由。',
    quoteEn: "It's not what you buy, it's what you pay that matters.",
    author: A.marks,
    year: 'unknown',
    authorBrief: AUTHORS.marks.brief,
    tags: ['value', 'patience'],
  },
  {
    quote: '你不能控制報酬，但可以控制風險。',
    quoteEn:
      'In the world of investing, you cannot control outcomes; you can only control your risk.',
    author: A.marks,
    year: 'unknown',
    authorBrief: AUTHORS.marks.brief,
    tags: ['risk', 'discipline'],
  },
  {
    quote: '差別不在於你比別人聰明多少，而在於你比別人少犯多少蠢事。',
    quoteEn: 'The road to investment success is paved with the avoidance of mistakes.',
    author: A.marks,
    year: 'unknown',
    authorBrief: AUTHORS.marks.brief,
    tags: ['humility', 'risk'],
  },
  {
    quote: '我們不能精準預測市場，但能感受到自己處在循環的哪個位置。',
    quoteEn: "We can't predict the future, but we can know where we stand in the cycle.",
    author: A.marks,
    year: '2018',
    authorBrief: AUTHORS.marks.brief,
    tags: ['cycles', 'humility'],
  },
  {
    quote: '當大家都覺得不會出錯時，往往就是最危險的時候。',
    quoteEn: 'The riskiest moment is when you think you have it figured out.',
    author: A.marks,
    year: 'unknown',
    authorBrief: AUTHORS.marks.brief,
    tags: ['caution', 'cycles'],
  },

  // === Templeton 鄧普頓 ===
  {
    quote: '投資中最危險的四個字是：「這次不一樣」。',
    quoteEn: "The four most dangerous words in investing are: 'this time it's different.'",
    author: A.templeton,
    year: 'unknown',
    authorBrief: AUTHORS.templeton.brief,
    tags: ['cycles', 'humility', 'caution'],
  },
  {
    quote: '牛市生於悲觀，成於懷疑，熟於樂觀，死於亢奮。',
    quoteEn:
      'Bull markets are born on pessimism, grow on skepticism, mature on optimism, and die on euphoria.',
    author: A.templeton,
    year: 'unknown',
    authorBrief: AUTHORS.templeton.brief,
    tags: ['cycles', 'caution'],
  },
  {
    quote: '在最大悲觀點買進，是長期最賺錢的時刻。',
    quoteEn:
      'The time of maximum pessimism is the best time to buy, and the time of maximum optimism is the best time to sell.',
    author: A.templeton,
    year: 'unknown',
    authorBrief: AUTHORS.templeton.brief,
    tags: ['courage', 'opportunity'],
  },
  {
    quote: '長期下來，國際分散是降低風險最好的方式之一。',
    quoteEn: 'Diversify. In stocks and bonds, as in much else, there is safety in numbers.',
    author: A.templeton,
    year: 'unknown',
    authorBrief: AUTHORS.templeton.brief,
    tags: ['risk'],
  },

  // === Soros 索羅斯 ===
  {
    quote: '重點不是對或錯，而是看對時賺多少、看錯時賠多少。',
    quoteEn:
      "It's not whether you're right or wrong that's important, but how much money you make when you're right and how much you lose when you're wrong.",
    author: A.soros,
    year: 'unknown',
    authorBrief: AUTHORS.soros.brief,
    tags: ['risk', 'discipline'],
  },
  {
    quote: '我富有的原因，是因為我知道何時錯了。',
    quoteEn: "I'm only rich because I know when I'm wrong.",
    author: A.soros,
    year: 'unknown',
    authorBrief: AUTHORS.soros.brief,
    tags: ['humility', 'discipline'],
  },
  {
    quote: '當你不確定時，部位就要小。',
    quoteEn:
      'When you have a great conviction, you should bet very big — but when you are not sure, smaller.',
    author: A.soros,
    year: 'unknown',
    authorBrief: AUTHORS.soros.brief,
    tags: ['risk', 'discipline'],
  },

  // === Klarman 克拉曼 ===
  {
    quote: '風險不是一個數字，而是一種觀念。',
    quoteEn: 'Risk is not a number. It is a notion.',
    author: A.klarman,
    year: '1991',
    authorBrief: AUTHORS.klarman.brief,
    tags: ['risk', 'humility'],
  },
  {
    quote: '寧可錯過，也不要踩雷。',
    quoteEn: 'Avoiding loss should be the primary goal of every investor.',
    author: A.klarman,
    year: '1991',
    authorBrief: AUTHORS.klarman.brief,
    tags: ['caution', 'risk'],
  },
  {
    quote: '價值投資需要耐心，更需要忍受別人賺得比你快的痛。',
    quoteEn:
      'Value investing requires a great deal of hard work, unusually strict discipline, and a long-term investment horizon.',
    author: A.klarman,
    year: '1991',
    authorBrief: AUTHORS.klarman.brief,
    tags: ['patience', 'discipline'],
  },

  // === Livermore 李佛摩 ===
  {
    quote: '華爾街沒有新鮮事。',
    quoteEn:
      "There is nothing new in Wall Street. There can't be because speculation is as old as the hills.",
    author: A.livermore,
    year: '1923',
    authorBrief: AUTHORS.livermore.brief,
    tags: ['cycles', 'humility'],
  },
  {
    quote: '錢是賺在屁股上，不是腦子裡。',
    quoteEn: 'It was never my thinking that made the big money for me. It was always my sitting.',
    author: A.livermore,
    year: '1923',
    authorBrief: AUTHORS.livermore.brief,
    tags: ['patience', 'discipline'],
  },
  {
    quote: '一個人的失敗，不在於市場，在於他自己。',
    quoteEn: 'The market does not beat them. They beat themselves.',
    author: A.livermore,
    year: '1923',
    authorBrief: AUTHORS.livermore.brief,
    tags: ['humility', 'discipline'],
  },

  // === Fisher 費雪 ===
  {
    quote: '市場上充滿了知道每樣東西價格、卻不知道任何東西價值的人。',
    quoteEn:
      'The stock market is filled with individuals who know the price of everything, but the value of nothing.',
    author: A.fisher,
    year: '1958',
    authorBrief: AUTHORS.fisher.brief,
    tags: ['value', 'discipline'],
  },
  {
    quote: '研究越深，持有越久，賺得越多。',
    quoteEn:
      'If the job has been correctly done when a common stock is purchased, the time to sell it is — almost never.',
    author: A.fisher,
    year: '1958',
    authorBrief: AUTHORS.fisher.brief,
    tags: ['long-term', 'discipline'],
  },

  // === Housel ===
  {
    quote: '財富是你看不見的東西，是你沒花的錢。',
    quoteEn: "Wealth is what you don't see.",
    author: A.housel,
    year: '2020',
    authorBrief: AUTHORS.housel.brief,
    tags: ['discipline', 'long-term'],
  },
  {
    quote: '你不需要做出非凡的決定，只需要避免做出愚蠢的決定。',
    quoteEn: 'You can be wrong half the time and still make a fortune.',
    author: A.housel,
    year: '2020',
    authorBrief: AUTHORS.housel.brief,
    tags: ['discipline', 'risk'],
  },
  {
    quote: '時間是投資中最強的槓桿。',
    quoteEn: 'Compounding is the eighth wonder of the world.',
    author: A.housel,
    year: '2020',
    authorBrief: AUTHORS.housel.brief,
    tags: ['long-term', 'patience'],
  },
  {
    quote: '記住：你看到別人賺多少，看不到他承擔多少風險。',
    quoteEn: "Be careful when learning lessons from people who can't go bust.",
    author: A.housel,
    year: '2020',
    authorBrief: AUTHORS.housel.brief,
    tags: ['risk', 'humility'],
  },
  {
    quote: '保持遊戲在桌上，比每局都贏更重要。',
    quoteEn:
      'The ability to do what you want, when you want, with who you want, for as long as you want, is priceless.',
    author: A.housel,
    year: '2020',
    authorBrief: AUTHORS.housel.brief,
    tags: ['risk', 'patience'],
  },

  // === Bogle 柏格 ===
  {
    quote: '別找乾草堆裡的針，買整個乾草堆。',
    quoteEn: "Don't look for the needle in the haystack. Just buy the haystack.",
    author: A.bogle,
    year: '2007',
    authorBrief: AUTHORS.bogle.brief,
    tags: ['risk', 'long-term'],
  },
  {
    quote: '時間是你的朋友，衝動是你的敵人。',
    quoteEn: 'Time is your friend; impulse is your enemy.',
    author: A.bogle,
    year: 'unknown',
    authorBrief: AUTHORS.bogle.brief,
    tags: ['patience', 'discipline'],
  },
  {
    quote: '投資成功的祕訣是：低成本、長持有、別亂動。',
    quoteEn: 'Stay the course. No matter what happens, stick to your program.',
    author: A.bogle,
    year: 'unknown',
    authorBrief: AUTHORS.bogle.brief,
    tags: ['discipline', 'long-term', 'patience'],
  },

  // === Dalio 達利歐 ===
  {
    quote: '痛苦 + 反省 = 進步。',
    quoteEn: 'Pain + Reflection = Progress.',
    author: A.dalio,
    year: '2017',
    authorBrief: AUTHORS.dalio.brief,
    tags: ['humility', 'discipline'],
  },
  {
    quote: '別預測市場，要為各種情境做好準備。',
    quoteEn: 'He who lives by the crystal ball will eat shattered glass.',
    author: A.dalio,
    year: 'unknown',
    authorBrief: AUTHORS.dalio.brief,
    tags: ['risk', 'discipline'],
  },
  {
    quote: '能持續對的人，往往是那些能說「我不知道」的人。',
    quoteEn: 'I learned that I should look for the best independent thinkers.',
    author: A.dalio,
    year: '2017',
    authorBrief: AUTHORS.dalio.brief,
    tags: ['humility'],
  },

  // === Druckenmiller ===
  {
    quote: '若你看對方向，部位要夠大；若沒把握，就回家睡覺。',
    quoteEn: 'When you see something — when it really makes sense — bet big.',
    author: A.druck,
    year: 'unknown',
    authorBrief: AUTHORS.druck.brief,
    tags: ['courage', 'discipline'],
  },
  {
    quote: '我犯過最大的錯，是太早賣掉好公司。',
    quoteEn: 'The way to build long-term returns is through preservation of capital and home runs.',
    author: A.druck,
    year: 'unknown',
    authorBrief: AUTHORS.druck.brief,
    tags: ['patience', 'long-term'],
  },

  // === Tepper ===
  {
    quote: '別逆 Fed 操作。',
    quoteEn: "Don't fight the Fed.",
    author: A.tepper,
    year: 'unknown',
    authorBrief: AUTHORS.tepper.brief,
    tags: ['discipline', 'cycles'],
  },

  // === Rogers 羅傑斯 ===
  {
    quote: '在沒人關心的地方，找到下一個泡沫的種子。',
    quoteEn:
      'I look for the cheapest, most undervalued things I can possibly find anywhere in the world.',
    author: A.rogers,
    year: 'unknown',
    authorBrief: AUTHORS.rogers.brief,
    tags: ['value', 'opportunity'],
  },
  {
    quote: '只在你看得懂、能解釋給孩子聽的市場下注。',
    quoteEn: "If you don't understand it, don't put your money in.",
    author: A.rogers,
    year: 'unknown',
    authorBrief: AUTHORS.rogers.brief,
    tags: ['discipline', 'humility'],
  },

  // === Ackman 艾克曼 ===
  {
    quote: '高品質的事業 + 合理的價格 + 長期持有，是賺錢的鐵三角。',
    quoteEn:
      'Investing is a business where you can look very silly for a long period of time before you are proven right.',
    author: A.ackman,
    year: 'unknown',
    authorBrief: AUTHORS.ackman.brief,
    tags: ['value', 'long-term'],
  },

  // === Greenblatt 葛林布雷 ===
  {
    quote: '若你不能堅守一套有效策略，再好的策略也救不了你。',
    quoteEn:
      "Choosing individual stocks without any idea of what you're looking for is like running through a dynamite factory with a burning match.",
    author: A.greenblatt,
    year: 'unknown',
    authorBrief: AUTHORS.greenblatt.brief,
    tags: ['discipline'],
  },

  // === Schloss 史洛斯 ===
  {
    quote: '買便宜的、抱久一點，剩下的交給時間。',
    quoteEn: 'I try to buy stocks cheap, and I am willing to hold them.',
    author: A.schloss,
    year: 'unknown',
    authorBrief: AUTHORS.schloss.brief,
    tags: ['value', 'long-term', 'patience'],
  },

  // === Burry 貝瑞 ===
  {
    quote: '基本面終究會勝出，但市場可以比你撐得更久。',
    quoteEn: 'If you are going to be a great investor, you have to fit the style to who you are.',
    author: A.burry,
    year: 'unknown',
    authorBrief: AUTHORS.burry.brief,
    tags: ['patience', 'risk'],
  },

  // === Mauboussin ===
  {
    quote: '在投資裡，過程比結果更值得評估。',
    quoteEn: 'You should evaluate decisions on the basis of the process, not the outcome.',
    author: A.mauboussin,
    year: '2012',
    authorBrief: AUTHORS.mauboussin.brief,
    tags: ['discipline', 'humility'],
  },

  // === Twain 馬克吐溫 ===
  {
    quote: '會把帳戶搞垮的，不是看不懂的東西，而是自以為看懂的東西。',
    quoteEn:
      "It ain't what you don't know that gets you into trouble. It's what you know for sure that just ain't so.",
    author: A.twain,
    year: 'unknown',
    authorBrief: AUTHORS.twain.brief,
    tags: ['humility', 'risk'],
  },
  {
    quote: '十月，是炒股最危險的月份；其他危險的月份是七月、九月、八月、五月……',
    quoteEn:
      'October. This is one of the peculiarly dangerous months to speculate in stocks. The others are July, January, September, April, November, May, March, June, December, August, and February.',
    author: A.twain,
    year: '1894',
    authorBrief: AUTHORS.twain.brief,
    tags: ['cycles', 'caution'],
  },

  // === Kahneman / Thaler / Shiller / Taleb ===
  {
    quote: '損失帶來的痛苦，大約是同等收益快樂的兩倍。',
    quoteEn: 'Losses loom larger than gains.',
    author: A.kahneman,
    year: '1979',
    authorBrief: AUTHORS.kahneman.brief,
    tags: ['drawdown', 'discipline'],
  },
  {
    quote: '我們對自己掌控感的幻覺，是投資失誤的開端。',
    quoteEn: 'Confidence is a feeling, not a measure of accuracy.',
    author: A.kahneman,
    year: '2011',
    authorBrief: AUTHORS.kahneman.brief,
    tags: ['humility'],
  },
  {
    quote: '人們不是不理性，他們只是有自己的理由。',
    quoteEn: 'People are not rational; they are simply calculative within their own framing.',
    author: A.thaler,
    year: 'unknown',
    authorBrief: AUTHORS.thaler.brief,
    tags: ['humility', 'discipline'],
  },
  {
    quote: '泡沫的特徵是大家都覺得這次不一樣。',
    quoteEn: 'A speculative bubble is a fad of beliefs about facts.',
    author: A.shiller,
    year: '2000',
    authorBrief: AUTHORS.shiller.brief,
    tags: ['cycles', 'caution'],
  },
  {
    quote: '不要混淆波動與風險。波動只是噪音，風險是永久性損失。',
    quoteEn: "Don't confuse volatility with risk. Volatility creates opportunity.",
    author: A.taleb,
    year: '2007',
    authorBrief: AUTHORS.taleb.brief,
    tags: ['risk', 'cycles'],
  },
  {
    quote: '黑天鵝不是預測出來的，是準備出來的。',
    quoteEn: "I don't try to predict the Black Swan; I try to be prepared for it.",
    author: A.taleb,
    year: '2007',
    authorBrief: AUTHORS.taleb.brief,
    tags: ['risk', 'discipline'],
  },
  {
    quote: '不要問「會發生什麼」，要問「如果發生了，我承受得住嗎」。',
    quoteEn: "It's not how much you make. It's how much you keep when something bad happens.",
    author: A.taleb,
    year: 'unknown',
    authorBrief: AUTHORS.taleb.brief,
    tags: ['risk', 'discipline'],
  },

  // === Keynes 凱因斯 ===
  {
    quote: '市場保持不理性的時間，可能比你保持有償付能力的時間還長。',
    quoteEn: 'The market can stay irrational longer than you can stay solvent.',
    author: A.keynes,
    year: '1930',
    authorBrief: AUTHORS.keynes.brief,
    tags: ['patience', 'risk'],
  },
  {
    quote: '當事實改變了，我也改變我的想法；你呢？',
    quoteEn: 'When the facts change, I change my mind. What do you do, sir?',
    author: A.keynes,
    year: 'unknown',
    authorBrief: AUTHORS.keynes.brief,
    tags: ['humility', 'discipline'],
  },

  // === Arnott / Bernstein ===
  {
    quote: '在投資裡，舒服的時候通常代表錢已經賺完了。',
    quoteEn: 'In investing, what is comfortable is rarely profitable.',
    author: A.arnott,
    year: 'unknown',
    authorBrief: AUTHORS.arnott.brief,
    tags: ['caution', 'cycles'],
  },
  {
    quote: '你比銷售員更了解你自己的目標 — 不要把判斷外包出去。',
    quoteEn:
      'You are at war with the financial industry. They want as much of your money as they can get.',
    author: A.bernstein,
    year: '2002',
    authorBrief: AUTHORS.bernstein.brief,
    tags: ['discipline', 'humility'],
  },

  // === Wall Street 諺語 ===
  {
    quote: '利多兌現，常是行情盡頭。',
    quoteEn: 'Buy the rumor, sell the news.',
    author: A.street,
    year: 'unknown',
    authorBrief: AUTHORS.street.brief,
    tags: ['cycles', 'caution'],
  },
  {
    quote: '牛和熊都賺錢，貪心的豬被宰。',
    quoteEn: 'Bulls make money, bears make money, pigs get slaughtered.',
    author: A.street,
    year: 'unknown',
    authorBrief: AUTHORS.street.brief,
    tags: ['discipline', 'caution'],
  },
  {
    quote: '趨勢是朋友，但會結束。',
    quoteEn: 'The trend is your friend, until it ends.',
    author: A.street,
    year: 'unknown',
    authorBrief: AUTHORS.street.brief,
    tags: ['cycles', 'discipline'],
  },
  {
    quote: '別接落下的刀。',
    quoteEn: "Don't catch a falling knife.",
    author: A.street,
    year: 'unknown',
    authorBrief: AUTHORS.street.brief,
    tags: ['caution', 'risk'],
  },
  {
    quote: '停損要快，獲利要讓它跑。',
    quoteEn: 'Cut your losses short and let your profits run.',
    author: A.street,
    year: 'unknown',
    authorBrief: AUTHORS.street.brief,
    tags: ['discipline', 'risk'],
  },
  {
    quote: '在熊市裡，錢回到該擁有它的人手上。',
    quoteEn: 'In a bear market, money returns to its rightful owners.',
    author: A.street,
    year: 'unknown',
    authorBrief: AUTHORS.street.brief,
    tags: ['cycles', 'patience'],
  },
  {
    quote: '待在市場裡，勝過抓進場時機。',
    quoteEn: 'Time in the market beats timing the market.',
    author: A.street,
    year: 'unknown',
    authorBrief: AUTHORS.street.brief,
    tags: ['long-term', 'patience'],
  },

  // === New International Expansion ===
  ...principles('baruch', [
    [
      '1930',
      '真正的大錢，常常不是賣在最高點，而是願意提早收手。',
      'I made my money by selling too soon.',
      ['discipline', 'caution'],
    ],
    [
      '1930',
      '希望從來不是風控方法。',
      'Paraphrase: Hope is never a risk-management method.',
      ['risk', 'discipline'],
    ],
    [
      '1930',
      '保住實力，比證明自己更重要。',
      'Paraphrase: Staying solvent matters more than winning every market argument.',
      ['risk', 'humility'],
    ],
    [
      '1930',
      '你可以少賺一些，但不要因為想賺到最後一段而翻車。',
      'Paraphrase: Giving up the last part of a move is a cheap price for survival.',
      ['caution', 'discipline'],
    ],
  ]),
  ...principles('simons', [
    [
      '2010',
      '別愛上故事，先看訊號有沒有重複出現。',
      'Paraphrase: Trust repeatable signals more than elegant stories.',
      ['discipline', 'risk'],
    ],
    [
      '2010',
      '模型若有優勢，就該服從資料而不是情緒。',
      'Paraphrase: When the data says the edge is there, do not let emotion overrule the system.',
      ['discipline', 'humility'],
    ],
    [
      '2010',
      '量化不是預言，而是讓大量小優勢持續複利。',
      'Paraphrase: Quant investing is not prophecy; it is the compounding of many small edges.',
      ['long-term', 'discipline'],
    ],
    [
      '2010',
      '若你無法承認模型會失效，就不配談模型。',
      'Paraphrase: Model risk begins when you stop questioning the model.',
      ['humility', 'risk'],
    ],
  ]),
  ...principles('dreman', [
    [
      '1980',
      '群眾最有把握的地方，常常就是定價最差的地方。',
      'Paraphrase: Consensus confidence often produces the worst prices.',
      ['value', 'caution'],
    ],
    [
      '1980',
      '反向投資不是逢跌就買，而是等情緒把價格壓到過頭。',
      'Paraphrase: Contrarian investing means buying after emotion has over-discounted reality.',
      ['value', 'opportunity'],
    ],
    [
      '1998',
      '市場最愛把壞消息直線外推。',
      'Paraphrase: Investors routinely extrapolate bad news too far into the future.',
      ['cycles', 'humility'],
    ],
    [
      '1998',
      '便宜股的優勢，不在光鮮，而在預期已經足夠低。',
      'Paraphrase: Low expectations are often the value investor’s ally.',
      ['value', 'risk'],
    ],
  ]),
  ...principles('williamONeil', [
    [
      '1988',
      '每一筆虧損都要在 7% 到 8% 內處理掉。',
      'Cut every loss when it is 7% or 8% below your purchase price.',
      ['risk', 'discipline'],
    ],
    [
      '1988',
      '永遠不要對一筆虧損部位加碼。',
      'Paraphrase: Never average down in a losing position.',
      ['risk', 'discipline'],
    ],
    [
      '1988',
      '強勢股通常會先強給你看，再給你機會。',
      'Paraphrase: Real market leaders show strength before they become obvious to everyone.',
      ['opportunity', 'discipline'],
    ],
    [
      '1988',
      '真正的大贏家，往往來自營收與盈餘加速，而不是低本益比。',
      'Paraphrase: Big stock winners usually come from accelerating fundamentals, not low multiples alone.',
      ['opportunity', 'discipline'],
    ],
    [
      '1988',
      '市場方向錯了，再好的選股都很難救。',
      'Paraphrase: Stock selection works best when the general market is aligned with you.',
      ['cycles', 'risk'],
    ],
  ]),
  ...principles('minervini', [
    [
      '2013',
      '先學會出場，才有資格談進場。',
      'Paraphrase: If you cannot sell well, you have not earned the right to buy aggressively.',
      ['discipline', 'risk'],
    ],
    [
      '2013',
      '資金配置是交易者真正的命。',
      'Paraphrase: Position sizing is where survival and long-term performance are decided.',
      ['risk', 'discipline'],
    ],
    [
      '2013',
      '最好的突破，不需要你用想像力幫它補故事。',
      'Paraphrase: The best breakouts carry their own proof in price and volume.',
      ['opportunity', 'discipline'],
    ],
    [
      '2013',
      '錯了就快切，因為市場不會為你的成本負責。',
      'Paraphrase: The market does not care about your cost basis; exit losers quickly.',
      ['risk', 'discipline'],
    ],
    [
      '2013',
      '超級績效不是靠命中率，而是靠賺賠比。',
      'Paraphrase: Extraordinary performance comes from asymmetry, not from being right all the time.',
      ['risk', 'opportunity'],
    ],
  ]),
  ...principles('weinstein', [
    [
      '1988',
      '不要在第一階段買希望，也不要在第四階段撿幻覺。',
      'Paraphrase: Avoid buying laggards before accumulation is proven and avoid bottom-fishing in clear downtrends.',
      ['caution', 'cycles'],
    ],
    [
      '1988',
      '趨勢一旦進入第二階段，讓價格和量能替你說話。',
      'Paraphrase: Stage-two advances should be confirmed by both price and volume.',
      ['opportunity', 'discipline'],
    ],
    [
      '1988',
      '相對強勢會先露出端倪。',
      'Paraphrase: Relative strength often turns up before the crowd notices the new leader.',
      ['opportunity', 'discipline'],
    ],
    [
      '1988',
      '跌破關鍵均線卻不處理，多半只是把小錯養大。',
      'Paraphrase: Ignoring a decisive break below support usually turns a manageable loss into a large one.',
      ['risk', 'discipline'],
    ],
  ]),
  ...principles('darvas', [
    [
      '1960',
      '大錢不是賺在來回跳舞，而是賺在抓住大波段。',
      'Paraphrase: The big money is made in the big swing, not in constant activity.',
      ['patience', 'opportunity'],
    ],
    [
      '1960',
      '箱體不是預言，是替自己劃出進退紀律。',
      'Paraphrase: A trading box is not prophecy; it is a discipline for entry and exit.',
      ['discipline', 'risk'],
    ],
    [
      '1960',
      '量價一起說話時，趨勢才值得你拿真金白銀押上。',
      'Paraphrase: Price movement matters most when it is confirmed by volume.',
      ['discipline', 'opportunity'],
    ],
    [
      '1960',
      '市場若把你趕出去，就先出去，不要和它爭。',
      'Paraphrase: If price invalidates your setup, leave without debate.',
      ['risk', 'discipline'],
    ],
  ]),
  ...principles('steinhardt', [
    [
      '1991',
      '高報酬往往來自和共識不同，但前提是你真的做足功課。',
      'Paraphrase: Non-consensus investing pays only when the work is deeper than the crowd’s opinion.',
      ['opportunity', 'discipline'],
    ],
    [
      '1991',
      '別把交易當表態，要把它當修正機率。',
      'Paraphrase: A position is not a statement of identity; it is a probabilistic wager that can change.',
      ['humility', 'discipline'],
    ],
    [
      '1991',
      '快速承認錯誤，不會讓你看起來笨，只會讓你活得更久。',
      'Paraphrase: Speed in admitting mistakes is a professional advantage.',
      ['humility', 'risk'],
    ],
    [
      '1991',
      '最難的是在正確時敢押，在錯誤時敢退。',
      'Paraphrase: Great investing requires both conviction and the ability to reverse course fast.',
      ['courage', 'discipline'],
    ],
  ]),
  ...principles('seykota', [
    [
      '1989',
      '交易成功的前三條規則都是：砍虧損。',
      'The elements of good trading are: (1) cutting losses, (2) cutting losses, and (3) cutting losses.',
      ['risk', 'discipline'],
    ],
    [
      '1989',
      '人人得到自己想從市場得到的東西。',
      'Everybody gets what they want out of the market.',
      ['humility', 'discipline'],
    ],
    [
      '1989',
      '系統要簡單到你在壓力下也能照做。',
      'Paraphrase: A trading system is only useful if you can follow it under stress.',
      ['discipline', 'risk'],
    ],
    [
      '1989',
      '趨勢追蹤不需要預測，只需要服從。',
      'Paraphrase: Trend following is not about forecasting; it is about obeying the market.',
      ['discipline', 'cycles'],
    ],
    [
      '1989',
      '虧損不會毀掉你，拒絕認賠才會。',
      'Paraphrase: Losses are manageable; denial is what becomes fatal.',
      ['risk', 'humility'],
    ],
  ]),
  ...principles('pabrai', [
    [
      '2007',
      '抬頭看報酬前，先低頭看下檔。',
      'Paraphrase: In Dhandho investing, the first question is always how little you can lose.',
      ['risk', 'value'],
    ],
    [
      '2007',
      '高不確定不等於高風險，只要價格已經夠便宜。',
      'Paraphrase: Uncertainty is not the same as risk when the odds and price are favorable.',
      ['value', 'opportunity'],
    ],
    [
      '2007',
      '把注押在少數明顯的好機會上，而不是每件看起來都不錯的事。',
      'Paraphrase: Bet heavily only when the odds are deeply in your favor.',
      ['opportunity', 'discipline'],
    ],
    [
      '2007',
      '模仿不是偷懶，而是承認市場上已經有人做過艱難功課。',
      'Paraphrase: Cloning great investors can be rational if you understand what you are copying.',
      ['humility', 'discipline'],
    ],
  ]),
  ...principles('damodaran', [
    [
      '2012',
      '估值不是求精準，而是誠實面對假設。',
      'Paraphrase: Valuation is not about precision; it is about making your assumptions explicit.',
      ['discipline', 'humility'],
    ],
    [
      '2012',
      '別把 spreadsheet 的小數點錯當成真相。',
      'Paraphrase: A more detailed model does not automatically make the valuation more true.',
      ['humility', 'risk'],
    ],
    [
      '2012',
      '好公司不一定是好股票，端看你付了什麼價格。',
      'Paraphrase: A great business can still be a poor investment if the entry price is too high.',
      ['value', 'discipline'],
    ],
    [
      '2012',
      '故事和數字都重要；少一邊，估值就會失真。',
      'Paraphrase: Every valuation needs a narrative and every narrative must face the numbers.',
      ['discipline', 'value'],
    ],
    [
      '2012',
      '與其假裝確定，不如把不確定放進估值。',
      'Paraphrase: It is better to price uncertainty than to pretend it does not exist.',
      ['risk', 'humility'],
    ],
  ]),
  ...principles('asness', [
    [
      '2014',
      '價值風格最難熬的時候，往往也是它最接近回歸的時候。',
      'Paraphrase: Value is hardest to hold right before it works again.',
      ['cycles', 'patience'],
    ],
    [
      '2014',
      '因子投資的核心不是魔法，是紀律地承受長期不舒服。',
      'Paraphrase: Factor investing works only if you can endure the stretches when it feels broken.',
      ['discipline', 'patience'],
    ],
    [
      '2014',
      '便宜不保證明天反彈，但昂貴通常不會永遠被寬恕。',
      'Paraphrase: Cheap can get cheaper, but expensive rarely stays expensive forever.',
      ['value', 'cycles'],
    ],
    [
      '2014',
      '最大的行為優勢，就是願意做現在很丟臉、長期卻合理的事。',
      'Paraphrase: Behavioral edge comes from doing what is uncomfortable but sensible.',
      ['courage', 'discipline'],
    ],
  ]),
  ...principles('tillinghast', [
    [
      '2017',
      '小型股裡有更多被忽略的低估，但也有更多地雷。',
      'Paraphrase: The lower-priced part of the market offers more neglect and more traps.',
      ['value', 'risk'],
    ],
    [
      '2017',
      '先避開脆弱資產負債表，便宜才有意義。',
      'Paraphrase: Cheapness matters only after balance-sheet fragility is addressed.',
      ['risk', 'value'],
    ],
    [
      '2017',
      '投資小公司時，管理層的誠信常比模型更重要。',
      'Paraphrase: In smaller companies, management character can outweigh spreadsheet elegance.',
      ['discipline', 'risk'],
    ],
    [
      '2017',
      '低價股不是彩票；它們需要同樣嚴格的研究。',
      'Paraphrase: Low-priced stocks are not excuses for lower standards of analysis.',
      ['discipline', 'humility'],
    ],
  ]),
  ...principles('grantham', [
    [
      '2011',
      '泡沫最危險的地方，不在估值高，而在大家都把高估值當成新常態。',
      'Paraphrase: Bubbles become lethal when extreme valuations start to feel normal.',
      ['cycles', 'caution'],
    ],
    [
      '2011',
      '均值回歸不趕時間，但它很少缺席。',
      'Paraphrase: Mean reversion can take longer than you expect, but it rarely cancels the appointment.',
      ['cycles', 'patience'],
    ],
    [
      '2021',
      '狂熱的末端，故事會壓過現金流。',
      'Paraphrase: Near a bubble peak, narrative overwhelms cash-flow reality.',
      ['caution', 'value'],
    ],
    [
      '2021',
      '投資人的麻煩，不是沒看到泡沫，而是太早知道自己是對的。',
      'Paraphrase: Seeing a bubble early is emotionally expensive because timing remains brutal.',
      ['humility', 'cycles'],
    ],
    [
      '2021',
      '最好的防禦，不是猜轉折日，而是不去相信永動牛市。',
      'Paraphrase: You do not need the exact peak to avoid believing in perpetual boom conditions.',
      ['caution', 'risk'],
    ],
  ]),
  ...principles('miller', [
    [
      '2004',
      '便宜不該用靜態指標看，而要看市場有沒有低估變化。',
      'Paraphrase: Value often lies in change that the market has not yet fully recognized.',
      ['value', 'opportunity'],
    ],
    [
      '2004',
      '長期勝率來自獨立思考，不是和指數比誰更像指數。',
      'Paraphrase: Outperformance requires active disagreement with the benchmark.',
      ['discipline', 'courage'],
    ],
    [
      '2004',
      '一家公司若能持續把資本投入高報酬處，估值應該比表面更高。',
      'Paraphrase: Great capital allocation deserves more weight than simple static multiples.',
      ['value', 'long-term'],
    ],
    [
      '2004',
      '價值投資不是只買便宜貨，而是買市場想錯的東西。',
      'Paraphrase: Value investing is about incorrect expectations, not cheapness alone.',
      ['value', 'discipline'],
    ],
  ]),
  ...principles('neff', [
    [
      '1999',
      '低本益比本身不是答案，但它能替你留下更大的容錯。',
      'Paraphrase: A low P/E is valuable because it can provide room for error.',
      ['value', 'risk'],
    ],
    [
      '1999',
      '高殖利率與穩定現金流，能讓你在等待重估時不至於乾耗。',
      'Paraphrase: Yield pays you while you wait for recognition.',
      ['patience', 'value'],
    ],
    [
      '1999',
      '市場熱愛華麗成長，這正是冷門價值股的機會來源。',
      'Paraphrase: Neglect often creates value because the crowd prefers glamour.',
      ['opportunity', 'value'],
    ],
    [
      '1999',
      '只看低估不看基本面，很容易把便宜買成破產。',
      'Paraphrase: Cheap stocks still need business durability.',
      ['risk', 'discipline'],
    ],
  ]),
  ...principles('swensen', [
    [
      '2000',
      '資產配置決定長期結果的骨架，選標的只是填肉。',
      'Paraphrase: Asset allocation shapes the skeleton of long-term returns.',
      ['long-term', 'risk'],
    ],
    [
      '2000',
      '機構投資最危險的事，是把短期波動誤認成長期風險。',
      'Paraphrase: Volatility and long-horizon risk are not the same thing.',
      ['risk', 'long-term'],
    ],
    [
      '2000',
      '分散不是為了看起來穩，而是避免單一敘事毀掉整個組合。',
      'Paraphrase: Diversification is protection against one narrative taking down the portfolio.',
      ['risk', 'discipline'],
    ],
    [
      '2000',
      '能忍受流動性較差的人，才有資格拿流動性溢酬。',
      'Paraphrase: Illiquidity premia belong only to investors who can truly tolerate illiquidity.',
      ['patience', 'risk'],
    ],
    [
      '2000',
      '投資流程若跟組織治理不一致，最後一定被短期情緒拉走。',
      'Paraphrase: Governance and investment horizon must match or the strategy will not survive stress.',
      ['discipline', 'long-term'],
    ],
  ]),
  ...principles('ariely', [
    [
      '2008',
      '人不是照理性做決策，而是照情境做決策。',
      'Paraphrase: People do not decide in a vacuum; they decide inside biased contexts.',
      ['humility', 'discipline'],
    ],
    [
      '2008',
      '免費最危險，因為它會讓你停止比較代價。',
      'Paraphrase: Zero price changes behavior far more than standard logic predicts.',
      ['caution', 'discipline'],
    ],
    [
      '2008',
      '先看到的數字會綁架後面的判斷。',
      'Paraphrase: Anchors distort later judgments even when we know they are arbitrary.',
      ['humility', 'risk'],
    ],
    [
      '2008',
      '投資紀律若只存在於清醒時刻，壓力來時就會消失。',
      'Paraphrase: Good intentions are weak unless the environment is designed to support them.',
      ['discipline', 'risk'],
    ],
  ]),
  ...principles('shefrin', [
    [
      '2000',
      '投資失誤常不是不知道，而是不肯照知道的去做。',
      'Paraphrase: Behavioral finance begins where knowledge fails to control action.',
      ['humility', 'discipline'],
    ],
    [
      '2000',
      '自信過頭會讓投資人把運氣誤認成能力。',
      'Paraphrase: Overconfidence turns noise into false evidence of skill.',
      ['humility', 'risk'],
    ],
    [
      '2000',
      '心理帳戶讓人同時保守又魯莽。',
      'Paraphrase: Mental accounting makes the same person irrationally cautious in one bucket and reckless in another.',
      ['humility', 'risk'],
    ],
    [
      '2000',
      '害怕認錯，常比看錯方向更傷。',
      'Paraphrase: The reluctance to realize losses often inflicts more damage than the original mistake.',
      ['drawdown', 'discipline'],
    ],
  ]),
  ...principles('friedman', [
    [
      '1962',
      '若價格不能自由說話，市場就無法有效配置資源。',
      'Paraphrase: Free prices transmit information that no planner can fully replace.',
      ['discipline', 'value'],
    ],
    ['1962', '沒有免費午餐。', "There's no such thing as a free lunch.", ['risk', 'discipline']],
    [
      '1962',
      '穩定規則通常比臨場天才更可靠。',
      'Paraphrase: Sound systems prefer rules over discretionary improvisation.',
      ['discipline', 'risk'],
    ],
    [
      '1962',
      '看似暫時的干預，常會變成長期扭曲。',
      'Paraphrase: Temporary interventions often outlive the problems they were meant to solve.',
      ['caution', 'cycles'],
    ],
  ]),
  ...principles('hayek', [
    [
      '1945',
      '市場價格最重要的功能，是把分散在各地的知識濃縮成訊號。',
      'Paraphrase: Prices communicate dispersed knowledge that no one mind can collect in full.',
      ['humility', 'discipline'],
    ],
    [
      '1945',
      '自以為能全面掌控，往往是風險的起點。',
      'Paraphrase: The pretense of knowledge is a recurrent source of policy and investment error.',
      ['humility', 'risk'],
    ],
    [
      '1945',
      '複雜系統該靠規則運作，不該靠少數人強行指揮。',
      'Paraphrase: Complex orders are usually better governed by rules than by centralized commands.',
      ['discipline', 'risk'],
    ],
    [
      '1945',
      '不知道，比假裝知道安全。',
      'Paraphrase: Admitting ignorance is safer than forcing confidence upon uncertain systems.',
      ['humility', 'caution'],
    ],
  ]),
  ...principles('schumpeter', [
    [
      '1942',
      '資本主義不是靜態效率，而是不斷淘汰舊結構的動態效率。',
      'Paraphrase: Capitalism advances through creative destruction, not through permanence.',
      ['cycles', 'opportunity'],
    ],
    [
      '1942',
      '昨日的護城河，明天可能正是包袱。',
      'Paraphrase: Today’s advantage can become tomorrow’s rigidity.',
      ['cycles', 'caution'],
    ],
    [
      '1942',
      '投資成熟產業時，要記得創新往往從外部殺進來。',
      'Paraphrase: Disruption often arrives from outside the incumbent structure.',
      ['risk', 'cycles'],
    ],
    [
      '1942',
      '真正的成長，通常伴隨對舊秩序的不舒服。',
      'Paraphrase: Progress is rarely comfortable for existing winners.',
      ['opportunity', 'courage'],
    ],
  ]),
  ...principles('galbraith', [
    [
      '1990',
      '金融史最穩定的特徵，就是遺忘。',
      'Paraphrase: Financial memory is short, which is why euphoria keeps returning.',
      ['cycles', 'humility'],
    ],
    [
      '1990',
      '泡沫末端，人們不是缺資訊，而是缺懷疑。',
      'Paraphrase: Manias are sustained less by missing data than by missing skepticism.',
      ['caution', 'cycles'],
    ],
    [
      '1990',
      '每一代人都愛把相同的投機包裝成全新的時代。',
      'Paraphrase: Every boom tells itself that the old rules no longer apply.',
      ['cycles', 'humility'],
    ],
    [
      '1990',
      '信用擴張最危險時，看起來通常最輕鬆。',
      'Paraphrase: Easy credit feels safest right before it proves dangerous.',
      ['risk', 'caution'],
    ],
    [
      '1990',
      '狂熱的共同語言，是「這次真的不同」。',
      'Paraphrase: Euphoria always invents reasons why this cycle should be exempt from history.',
      ['caution', 'cycles'],
    ],
  ]),
  ...principles('johnTrain', [
    [
      '1980',
      '投資高手最像的地方，不是風格，而是紀律。',
      'Paraphrase: Great investors differ in method but resemble one another in discipline.',
      ['discipline', 'humility'],
    ],
    [
      '1980',
      '沒有一套方法能適合所有性格。',
      'Paraphrase: The best strategy is one that matches the investor’s temperament.',
      ['discipline', 'humility'],
    ],
    [
      '1980',
      '模仿高手的結論沒用，學他們的程序才有用。',
      'Paraphrase: You learn more from how masters think than from the stocks they happened to own.',
      ['discipline', 'long-term'],
    ],
    [
      '1980',
      '投資的第一課往往不是怎麼賺，而是怎麼不失手。',
      'Paraphrase: The masters usually begin with defense before offense.',
      ['risk', 'discipline'],
    ],
  ]),
  ...principles('adamSmith', [
    [
      '1776',
      '分工會提高生產率，但也會讓經濟更依賴交換與價格。',
      'Paraphrase: Division of labor raises productivity and makes exchange central.',
      ['long-term', 'value'],
    ],
    [
      '1776',
      '資本會流向更高回報處，這本身就是市場紀律的一部分。',
      'Paraphrase: Capital naturally seeks the highest risk-adjusted return it can find.',
      ['discipline', 'value'],
    ],
    [
      '1776',
      '沒有穩定制度，再勤奮的商業也難長久。',
      'Paraphrase: Commerce flourishes when rules and property rights are dependable.',
      ['risk', 'long-term'],
    ],
    [
      '1776',
      '價格不只是成交結果，也是稀缺性的訊號。',
      'Paraphrase: Prices reveal scarcity as well as preference.',
      ['discipline', 'value'],
    ],
  ]),
  ...principles('kahneman', [
    [
      '2011',
      '人對損失的痛，比對同等收益的快樂更強。',
      'Paraphrase: Loss aversion is stronger than the pleasure of equivalent gains.',
      ['drawdown', 'humility'],
    ],
    [
      '2011',
      '先看到的數字，會變成你後面判斷的錨。',
      'Paraphrase: Anchoring pulls later estimates toward whatever number appeared first.',
      ['humility', 'risk'],
    ],
    [
      '2011',
      '容易想起來的事，常被誤認成更常發生。',
      'Paraphrase: Availability makes vivid events seem more probable than they are.',
      ['humility', 'risk'],
    ],
    [
      '2011',
      '直覺不是不能用，但它在陌生環境裡很不可靠。',
      'Paraphrase: Intuition works poorly in environments without stable feedback.',
      ['discipline', 'humility'],
    ],
    [
      '2011',
      '投資人的大腦會用故事修補機率。',
      'Paraphrase: The mind prefers coherent stories even when the evidence is thin.',
      ['humility', 'risk'],
    ],
    [
      '2011',
      '把運氣誤認成技巧，是市場裡最昂貴的認知錯覺。',
      'Paraphrase: Outcome bias makes lucky results look like skill.',
      ['humility', 'caution'],
    ],
  ]),
  ...principles('thaler', [
    [
      '2015',
      '人會把錢分不同抽屜看待，哪怕那些錢其實完全一樣。',
      'Paraphrase: Mental accounting makes identical dollars feel different.',
      ['humility', 'risk'],
    ],
    [
      '2015',
      '你若想讓自己做對事，先把預設選項設對。',
      'Paraphrase: Better defaults often beat stronger intentions.',
      ['discipline', 'long-term'],
    ],
    [
      '2015',
      '市場不只由理性人組成，所以價格也不會永遠理性。',
      'Paraphrase: Because humans are flawed, market prices can stay behaviorally distorted.',
      ['cycles', 'humility'],
    ],
    [
      '2015',
      '許多錯誤不是不會算，而是太會替自己找藉口。',
      'Paraphrase: Self-control failures often matter more than arithmetic failures.',
      ['discipline', 'humility'],
    ],
    [
      '2015',
      '投資計畫若忽略人的弱點，就不會被長久執行。',
      'Paraphrase: A strategy that ignores human behavior usually breaks in practice.',
      ['discipline', 'risk'],
    ],
  ]),
  ...principles('shiller', [
    [
      '2000',
      '市場會被故事推著跑，不只被現金流推著跑。',
      'Paraphrase: Markets are moved by narratives as well as by fundamentals.',
      ['cycles', 'humility'],
    ],
    [
      '2000',
      '狂熱不是估值指標本身，而是大家對估值失去羞恥感。',
      'Paraphrase: Irrational exuberance appears when valuation concern no longer restrains behavior.',
      ['caution', 'cycles'],
    ],
    [
      '2019',
      '一個好故事能比一張好財報傳得更快。',
      'Paraphrase: Narratives spread through economies like epidemics.',
      ['cycles', 'risk'],
    ],
    [
      '2000',
      '泡沫最難的不是辨認，而是承認自己也在其中。',
      'Paraphrase: Diagnosing a bubble is easier than behaving prudently inside one.',
      ['humility', 'caution'],
    ],
    [
      '2019',
      '投資敘事一旦變成身份認同，價格就更難回到常識。',
      'Paraphrase: When narratives become social identity, mispricing can persist much longer.',
      ['cycles', 'risk'],
    ],
  ]),
  ...principles('bogle', [
    [
      '1999',
      '別去草堆裡找針，直接買下整個草堆。',
      "Don't look for the needle in the haystack. Just buy the haystack.",
      ['long-term', 'discipline'],
    ],
    [
      '1999',
      '成本是你能百分之百確定的負報酬。',
      'Paraphrase: Costs are certain; alpha is not.',
      ['discipline', 'risk'],
    ],
    [
      '1999',
      '投資成功的第一步，不是猜贏家，而是把摩擦降到最低。',
      'Paraphrase: Lowering friction is one of the most reliable ways to improve investor outcomes.',
      ['discipline', 'long-term'],
    ],
    [
      '1999',
      '週轉越高，替你工作的是券商，不是資本。',
      'Paraphrase: High turnover enriches intermediaries more often than investors.',
      ['caution', 'discipline'],
    ],
    [
      '2007',
      '你得到的，通常就是市場報酬減掉成本與錯誤。',
      'Paraphrase: The arithmetic of investing leaves investors with market return minus costs and behavior.',
      ['discipline', 'long-term'],
    ],
    [
      '2007',
      '長期投資最大的邊際，不是資訊，而是耐心。',
      'Paraphrase: The ordinary investor’s edge is staying the course.',
      ['patience', 'long-term'],
    ],
  ]),
  ...principles('graham', [
    [
      '1949',
      '市場先生每天報價，但你沒有義務每天交易。',
      'Paraphrase: Mr. Market serves you with prices; he does not command your actions.',
      ['discipline', 'cycles'],
    ],
    [
      '1949',
      '當市場情緒極端時，理性的定價者會顯得像怪人。',
      'Paraphrase: The intelligent investor often looks eccentric during emotional extremes.',
      ['courage', 'value'],
    ],
    [
      '1949',
      '安全邊際不是悲觀，而是承認自己會出錯。',
      'Paraphrase: Margin of safety is the admission that forecasts can fail.',
      ['risk', 'humility'],
    ],
    [
      '1949',
      '防守型投資人要先避免重大失誤，再追求額外報酬。',
      'Paraphrase: For the defensive investor, error avoidance comes before brilliance.',
      ['risk', 'discipline'],
    ],
    [
      '1949',
      '進取型投資人若沒有流程，很快就會變成投機者。',
      'Paraphrase: The enterprising investor needs method, or enterprise degenerates into speculation.',
      ['discipline', 'risk'],
    ],
    [
      '1934',
      '分析的目的，不是預言未來，而是建立足夠保守的估值區間。',
      'Paraphrase: Analysis should create a margin for error, not an illusion of perfect foresight.',
      ['value', 'risk'],
    ],
    [
      '1949',
      '投資要以價格對價值的折讓作為安全帶。',
      'Paraphrase: The discount to value is the investor’s seat belt.',
      ['value', 'risk'],
    ],
    [
      '1949',
      '在市場亢奮時，沉默往往比跟著起舞更有價值。',
      'Paraphrase: When prices run far ahead of value, inactivity can be a superior act.',
      ['caution', 'discipline'],
    ],
  ]),
  ...principles('gordonGekko', [
    [
      '1987',
      '貪婪，講白一點，是好的。',
      'Greed, for lack of a better word, is good.',
      ['caution', 'cycles'],
    ],
    [
      '1987',
      '重點不是你怎麼創造，而是你怎麼切割。',
      'Paraphrase: In the film, capital markets are framed as tools for extraction rather than stewardship.',
      ['caution', 'risk'],
    ],
  ]),
  ...principles('bigShortFilm', [
    [
      '2015',
      '你不是因為知道得少而出事，而是因為把錯的東西當成確定。',
      "It ain't what you don't know that gets you into trouble. It's what you know for sure that just ain't so.",
      ['humility', 'risk'],
    ],
    [
      '2015',
      '如果你看對了，通常代表別人會很難受。',
      'Paraphrase: In systemic shorts, being right can still mean widespread social damage.',
      ['caution', 'cycles'],
    ],
    [
      '2015',
      '體系最脆弱時，看起來常像最穩定。',
      'Paraphrase: Structured fragility often hides beneath comforting surface statistics.',
      ['risk', 'caution'],
    ],
  ]),
  ...principles('marginCallFilm', [
    [
      '2011',
      '先活下來，明天才有資格繼續交易。',
      'Paraphrase: Survival comes before reputation, elegance, and theoretical value.',
      ['risk', 'discipline'],
    ],
    [
      '2011',
      '你不需要比所有人聰明，只需要比風險早一步。',
      'Paraphrase: The winner in a panic is often the one who acts before the crowd freezes.',
      ['caution', 'risk'],
    ],
    [
      '2011',
      '市場最殘酷的夜晚，賣出與道德常不在同一側。',
      'Paraphrase: Deleveraging decisions can be financially rational and morally ugly at the same time.',
      ['caution', 'humility'],
    ],
  ]),
  ...principles('insideJobFilm', [
    [
      '2010',
      '當誘因設計錯了，聰明人也會把系統玩壞。',
      'Paraphrase: Bad incentives can corrupt sophisticated systems from the inside.',
      ['risk', 'discipline'],
    ],
    [
      '2010',
      '危機很少是單一壞人造成，更多是整套制度鼓勵錯誤。',
      'Paraphrase: Financial crises emerge from incentive structures, not just isolated villains.',
      ['cycles', 'risk'],
    ],
    [
      '2010',
      '監管若跟市場太親近，風險只會被包裝，不會被消除。',
      'Paraphrase: Regulatory capture transforms risk into a presentation problem rather than a real constraint.',
      ['caution', 'risk'],
    ],
  ]),
  ...principles('buffett', [
    [
      '1965',
      '先看每股價值能否持續增加，再看公司規模有多大。',
      'Paraphrase: Per-share progress matters more than growth in size for its own sake.',
      ['value', 'discipline'],
    ],
    [
      '1966',
      '當資本變大時，早年的高報酬率不應被機械外推。',
      'Paraphrase: High returns from a tiny base cannot be extrapolated forever.',
      ['humility', 'long-term'],
    ],
    [
      '1967',
      '市場願意短暫忽略價值，正是耐心資本的空間。',
      'Paraphrase: Temporary market neglect can create opportunity for patient capital.',
      ['opportunity', 'patience'],
    ],
    [
      '1968',
      '風格在某一年落後，不代表方法已經失效。',
      'Paraphrase: One poor year does not invalidate a sound discipline.',
      ['patience', 'discipline'],
    ],
    [
      '1969',
      '當找不到便宜又明顯的機會時，現金不是懶惰，是紀律。',
      'Paraphrase: Holding cash when bargains are scarce is discipline, not laziness.',
      ['caution', 'discipline'],
    ],
    [
      '1970',
      '投資結果要和合理基準相比，而不是只看絕對數字。',
      'Paraphrase: Results should be judged against an honest benchmark, not in isolation.',
      ['discipline', 'humility'],
    ],
    [
      '1971',
      '資本配置的品質，最後會主導股東每股成果。',
      'Paraphrase: Capital allocation eventually determines per-share outcomes.',
      ['value', 'long-term'],
    ],
    [
      '1972',
      '便宜資產若遇到能力強、誠信高的管理者，才會真正轉化成價值。',
      'Paraphrase: Cheap assets need capable and trustworthy management before value is realized.',
      ['value', 'risk'],
    ],
    [
      '1973',
      '市場先生在悲觀時給你的，不只是報價，也是考驗。',
      'Paraphrase: Pessimistic prices test temperament as much as analysis.',
      ['courage', 'cycles'],
    ],
    [
      '1974',
      '在熊市裡保住頭腦清楚，比抓最低點重要。',
      'Paraphrase: Bear markets reward clarity and discipline more than perfect timing.',
      ['drawdown', 'discipline'],
    ],
    [
      '1975',
      '若基本面改善而估值仍低，時間通常站在你這邊。',
      'Paraphrase: Improving business economics and a low valuation make time an ally.',
      ['value', 'patience'],
    ],
    [
      '1976',
      '真正的複利，來自讓少數正確決策滾很多年。',
      'Paraphrase: Compounding comes from a handful of right decisions carried for long periods.',
      ['long-term', 'patience'],
    ],
    [
      '1977',
      '壞產業結構會把再努力的經營都磨掉。',
      'Paraphrase: A poor business economics can overwhelm even excellent management effort.',
      ['risk', 'value'],
    ],
    [
      '1977',
      '挑企業時，先問經濟特性，再問管理層多勤奮。',
      'Paraphrase: Business economics come before management brilliance in the long run.',
      ['value', 'discipline'],
    ],
    [
      '1978',
      '保險公司最重要的成長，不是保費，而是承保紀律。',
      'Paraphrase: In insurance, underwriting discipline matters more than premium volume.',
      ['risk', 'discipline'],
    ],
    [
      '1978',
      '浮存金是好工具，但前提是它的成本長期合理。',
      'Paraphrase: Insurance float is valuable only when its long-term cost is acceptable.',
      ['value', 'risk'],
    ],
    [
      '1979',
      '通膨會懲罰需要不斷追加資本、卻難以提價的企業。',
      'Paraphrase: Inflation punishes capital-hungry businesses without pricing power.',
      ['risk', 'value'],
    ],
    [
      '1979',
      '真正的好生意，能在少量追加資本下創造更多現金。',
      'Paraphrase: A superior business can grow value without endless capital demands.',
      ['value', 'long-term'],
    ],
    [
      '1980',
      '資本密集又缺乏定價權的企業，很難讓股東滿意。',
      'Paraphrase: Capital intensity without pricing power is a poor bargain for owners.',
      ['value', 'risk'],
    ],
    [
      '1980',
      '用會不斷吞噬現金的事業去追規模，通常不是好交易。',
      'Paraphrase: Scale is not attractive when the business continually consumes capital.',
      ['caution', 'risk'],
    ],
    [
      '1981',
      '留存盈餘只有在能創造一元以上市場價值時才值得留下。',
      'Paraphrase: Retained earnings are justified only when they create at least equal market value.',
      ['value', 'discipline'],
    ],
    [
      '1981',
      '資本配置不是附屬工作，而是管理層最核心的責任之一。',
      'Paraphrase: Capital allocation is one of management’s most important jobs.',
      ['discipline', 'value'],
    ],
    [
      '1982',
      '悲觀時刻會把好資產和壞資產一起打折。',
      'Paraphrase: Broad pessimism can discount the excellent along with the mediocre.',
      ['opportunity', 'cycles'],
    ],
    [
      '1982',
      '如果你已知自己無法預測景氣，估值紀律就更重要。',
      'Paraphrase: When macro forecasting is unreliable, valuation discipline matters even more.',
      ['discipline', 'humility'],
    ],
    [
      '1983',
      '好經理人遇上好資產，結果可能驚人；好經理人遇上爛資產，多半只是被拖住。',
      'Paraphrase: Outstanding managers shine best in businesses with favorable economics.',
      ['value', 'discipline'],
    ],
    [
      '1983',
      '買公司不是買一季數字，而是買未來很多年的資本回報。',
      'Paraphrase: Buying a business means buying many years of future capital returns.',
      ['long-term', 'value'],
    ],
    [
      '1984',
      '穿透式盈餘比帳面上拿到多少股利，更接近股東真正擁有的成果。',
      'Paraphrase: Look-through earnings reveal economic reality better than reported dividends alone.',
      ['value', 'discipline'],
    ],
    [
      '1984',
      '不要讓會計呈現方式遮住企業的真實經濟性。',
      'Paraphrase: Accounting form should not obscure business reality.',
      ['discipline', 'humility'],
    ],
    [
      '1985',
      '若一門生意長期沒有護城河，再低的成本也很難補救。',
      'Paraphrase: Persistent weak economics cannot be fixed by effort alone.',
      ['risk', 'value'],
    ],
    [
      '1985',
      '退出錯誤產業有時比在錯產業裡更努力更有價值。',
      'Paraphrase: Exiting a bad business can be wiser than managing it harder.',
      ['caution', 'discipline'],
    ],
    [
      '1986',
      '機構慣性會讓人模仿同業、擴張帝國、合理化壞決策。',
      'Paraphrase: The institutional imperative pushes managers toward imitation and poor capital decisions.',
      ['humility', 'risk'],
    ],
    [
      '1986',
      '再聰明的管理層，也可能被組織習性帶去做蠢事。',
      'Paraphrase: Organizational habits can overpower individual intelligence.',
      ['humility', 'discipline'],
    ],
    [
      '1987',
      '市場暴跌時，價格波動不等於企業價值同步蒸發。',
      'Paraphrase: Violent market declines do not automatically mean equal declines in business value.',
      ['courage', 'cycles'],
    ],
    [
      '1987',
      '崩盤來時，你的性格會比模型先被檢驗。',
      'Paraphrase: Crashes test temperament before they test analytical elegance.',
      ['drawdown', 'discipline'],
    ],
    [
      '1988',
      '好公司值得長抱，前提是你沒有付出荒唐價格。',
      'Paraphrase: A wonderful business deserves a long holding period if the purchase price is sensible.',
      ['long-term', 'value'],
    ],
    [
      '1988',
      '我們偏好讓時間和企業品質幫忙，而不是頻繁換手。',
      'Paraphrase: Let business quality and time do the heavy lifting.',
      ['patience', 'long-term'],
    ],
    [
      '1989',
      '時間會放大企業品質。',
      'Paraphrase: Time amplifies the difference between superior and mediocre businesses.',
      ['long-term', 'value'],
    ],
    [
      '1989',
      '當你找到真正優秀的企業，價格只要合理就不必苛求完美。',
      'Paraphrase: With a truly superior business, fair price is often enough.',
      ['value', 'long-term'],
    ],
    [
      '1990',
      '過度舉債會讓原本可忍受的波動變成致命問題。',
      'Paraphrase: Excess leverage can turn manageable volatility into permanent damage.',
      ['risk', 'caution'],
    ],
    [
      '1990',
      '資本市場很寬容現金在手，卻很少寬容流動性短缺。',
      'Paraphrase: Liquidity reserves buy freedom that leverage later destroys.',
      ['risk', 'discipline'],
    ],
    [
      '1991',
      '誠實是資本配置文化的一部分，不只是公關語氣。',
      'Paraphrase: Candor with owners is part of sound stewardship, not a communications style.',
      ['discipline', 'humility'],
    ],
    [
      '1991',
      '管理者若把股東當夥伴，決策框架自然會不同。',
      'Paraphrase: Thinking of shareholders as partners changes how decisions get made.',
      ['discipline', 'long-term'],
    ],
    [
      '1992',
      '發股票做併購時，也是在賣出自家公司的一部分。',
      'Paraphrase: Issuing stock for acquisitions means selling part of your business.',
      ['value', 'discipline'],
    ],
    [
      '1992',
      '若管理層不在乎稀釋，股東遲早會替它付學費。',
      'Paraphrase: Indifference to dilution eventually becomes a shareholder cost.',
      ['risk', 'discipline'],
    ],
    [
      '1993',
      '能力圈不是侷限，而是避免亂出手的邊界。',
      'Paraphrase: Circle of competence is a boundary that prevents costly wandering.',
      ['discipline', 'humility'],
    ],
    [
      '1993',
      '你不需要每件事都懂，只需要在少數懂的事上更有把握。',
      'Paraphrase: You do not need expertise everywhere, only enough conviction where you truly understand.',
      ['opportunity', 'discipline'],
    ],
    [
      '1994',
      '雪茄屁股型投資不是不能做，只是不如好公司能帶來乾淨的複利。',
      'Paraphrase: Bargain scraps can work, but superior businesses compound more elegantly.',
      ['value', 'long-term'],
    ],
    [
      '1994',
      '用低品質資產賺快錢很誘人，卻常沒有高品質資產賺慢錢穩。',
      'Paraphrase: Fast gains from weak businesses rarely rival slow compounding from strong ones.',
      ['long-term', 'value'],
    ],
  ]),
  ...principles('buffett', [
    [
      '1995',
      '股價有時跑在企業前面，有時落在企業後面，但兩者不會永遠脫節。',
      'Paraphrase: Market price can diverge from business progress, but not indefinitely.',
      ['cycles', 'value'],
    ],
    [
      '1995',
      '我們希望吸引的是長期主人，而不是短期過客。',
      'Paraphrase: Owner-oriented shareholders make better partners than transient traders.',
      ['long-term', 'discipline'],
    ],
    [
      '1996',
      '成本很重要，因為它會在複利上年復一年地啃掉成果。',
      'Paraphrase: Costs matter enormously because they compound against you.',
      ['discipline', 'long-term'],
    ],
    [
      '1996',
      '我們在這裡是和股東一起賺錢，不是從股東身上賺錢。',
      'Paraphrase: Management should make money with owners, not off them.',
      ['discipline', 'long-term'],
    ],
    [
      '1997',
      '當市場把你捧得太高時，誠實比迎合更重要。',
      'Paraphrase: When a company’s stock is richly priced, candor matters more than applause.',
      ['humility', 'discipline'],
    ],
    [
      '1997',
      '經理人若不把內在價值掛在心上，股東很快就會被市場情緒牽走。',
      'Paraphrase: Managers should anchor owners on intrinsic value when markets become emotional.',
      ['value', 'discipline'],
    ],
    [
      '1998',
      '股票若短期領先企業太多，之後就可能用時間補課。',
      'Paraphrase: When stock performance outruns business performance, later returns often normalize.',
      ['cycles', 'caution'],
    ],
    [
      '1998',
      '最難的是在股價很好看時，仍記得企業本身才是答案。',
      'Paraphrase: A soaring stock can distract owners from the underlying business reality.',
      ['humility', 'cycles'],
    ],
    [
      '1999',
      '新時代的語言，常被用來包裝老問題。',
      'Paraphrase: New-era rhetoric often disguises old speculative behavior.',
      ['caution', 'cycles'],
    ],
    [
      '1999',
      '科技改變世界，不代表任何價格都合理。',
      'Paraphrase: A transformative industry still does not justify every valuation.',
      ['value', 'caution'],
    ],
    [
      '2000',
      '別因為隔壁贏得快，就放棄自己看得懂的方法。',
      'Paraphrase: Do not abandon your discipline simply because someone else is getting rich faster.',
      ['discipline', 'humility'],
    ],
    [
      '2000',
      '投資裡最難的，不是缺機會，而是忍住不追自己不懂的熱潮。',
      'Paraphrase: The hard part is often resisting booms outside your competence.',
      ['discipline', 'humility'],
    ],
    [
      '2001',
      '當潮水退去，會暴露的不只是槓桿，也包括誠信。',
      'Paraphrase: Falling tides expose leverage, weak economics, and weak character alike.',
      ['risk', 'humility'],
    ],
    [
      '2001',
      '把股東當傻子的人，最後往往也把自己當成了例外。',
      'Paraphrase: Managers who treat owners like patsies eventually reveal what they are.',
      ['discipline', 'caution'],
    ],
    [
      '2002',
      '衍生品在錯誤手上，可以把局部失誤放大成系統風險。',
      'Paraphrase: Derivatives can convert ordinary mistakes into large systemic exposures.',
      ['risk', 'caution'],
    ],
    [
      '2002',
      '若你需要完美預測利率、匯率或市場情緒才能安全，那本身就不安全。',
      'Paraphrase: A strategy that requires correct macro forecasts to survive is fragile by design.',
      ['risk', 'humility'],
    ],
    [
      '2003',
      '好的保險文化，靠的是在好年景也不鬆手。',
      'Paraphrase: Insurance discipline must hold even when the cycle tempts everyone to relax.',
      ['discipline', 'cycles'],
    ],
    [
      '2003',
      '保守不是慢，而是替未來的大手筆保留火力。',
      'Paraphrase: Conservatism preserves the capacity to act decisively later.',
      ['caution', 'opportunity'],
    ],
    [
      '2004',
      '恐懼與貪婪會輪流主導市場，但它們都不該主導你。',
      'Paraphrase: Fear and greed cycle through markets; discipline should govern the investor.',
      ['cycles', 'discipline'],
    ],
    [
      '2004',
      '市場熱鬧時，你最需要的不是速度，而是邊界。',
      'Paraphrase: Booming markets increase the value of clear limits.',
      ['caution', 'discipline'],
    ],
    [
      '2005',
      '收購若用股票支付，也要像拿現金一樣斤斤計較。',
      'Paraphrase: Equity used in acquisitions should be treated as real currency, not free money.',
      ['value', 'discipline'],
    ],
    [
      '2005',
      '稅後結果才是股東真正能拿到的結果。',
      'Paraphrase: Owner economics should be judged after taxes, not before.',
      ['value', 'discipline'],
    ],
    [
      '2006',
      '接班規劃不是人事題，而是資本保全題。',
      'Paraphrase: Succession is part of risk management and capital stewardship.',
      ['risk', 'long-term'],
    ],
    [
      '2006',
      '名聲和文化這類無形資產，通常在出事前最像不存在。',
      'Paraphrase: Culture and reputation are invisible assets until the day they are tested.',
      ['discipline', 'risk'],
    ],
    [
      '2007',
      '能用簡單方法解釋清楚的生意，通常比較容易長抱。',
      'Paraphrase: Simplicity supports conviction and long holding periods.',
      ['long-term', 'discipline'],
    ],
    [
      '2007',
      '越是無法預測總體，越要把注意力留給企業品質與價格。',
      'Paraphrase: Uncertain macro conditions make business quality and price even more central.',
      ['value', 'humility'],
    ],
    ['2008', '不要和美國長期作對。', 'Never bet against America.', ['optimism', 'long-term']],
    [
      '2008',
      '危機時最珍貴的資產不是勇氣，而是先前留下的現金與信用。',
      'Paraphrase: In a crisis, prior conservatism creates the ability to be courageous.',
      ['courage', 'risk'],
    ],
    [
      '2009',
      '別等情況舒服才出手，真正的便宜常發生在不舒服的時候。',
      'Paraphrase: The best bargains rarely arrive when conditions feel reassuring.',
      ['courage', 'opportunity'],
    ],
    [
      '2009',
      '只有先活過恐慌，你才有資格從恐慌中獲利。',
      'Paraphrase: You can profit from panic only if you survive it first.',
      ['risk', 'courage'],
    ],
    [
      '2010',
      '黃金不會生產東西，它只是等下一個人用更高價格接手。',
      'Paraphrase: Assets that produce nothing depend heavily on the next buyer’s enthusiasm.',
      ['value', 'caution'],
    ],
    [
      '2010',
      '真正可複利的資產，通常會自己創造現金流。',
      'Paraphrase: Productive assets compound by generating cash, not by being admired.',
      ['value', 'long-term'],
    ],
    [
      '2011',
      '回購股票只有在價格低於內在價值時才對原股東有利。',
      'Paraphrase: Buybacks make sense only below intrinsic value.',
      ['value', 'discipline'],
    ],
    [
      '2011',
      '資本配置裡，什麼都做一點往往不如少數幾件做對。',
      'Paraphrase: A few sound capital-allocation decisions matter more than constant activity.',
      ['discipline', 'long-term'],
    ],
    [
      '2012',
      '大多數人害怕波動，但真正該怕的是永久損失。',
      'Paraphrase: Volatility is not the same as the permanent destruction of capital.',
      ['risk', 'humility'],
    ],
    [
      '2012',
      '股市關門五年仍願意持有的東西，才值得你今天買。',
      'Paraphrase: Buy only what you would own even if markets closed for years.',
      ['long-term', 'discipline'],
    ],
    [
      '2013',
      '企業文化若鼓勵坦率，錯誤會更早被看見也更早被處理。',
      'Paraphrase: Candor-rich cultures surface mistakes early enough to fix them.',
      ['discipline', 'risk'],
    ],
    [
      '2013',
      '股東最終擁有的是經營成果，不是簡報語氣。',
      'Paraphrase: Owners ultimately receive operating results, not polished narratives.',
      ['value', 'humility'],
    ],
    [
      '2014',
      '好文化是慢慢累積的複利，不是出事那天才臨時印出來。',
      'Paraphrase: Culture compounds quietly over time and cannot be improvised in a crisis.',
      ['long-term', 'discipline'],
    ],
    [
      '2014',
      '長期複利最怕的，不是短期難看，而是中途把方法丟掉。',
      'Paraphrase: Compounding is damaged more by abandoning discipline than by interim ugliness.',
      ['patience', 'long-term'],
    ],
    [
      '2015',
      '沒必要靠預測利率和市場來證明自己聰明。',
      'Paraphrase: Investors need not prove brilliance by forecasting macro variables.',
      ['humility', 'discipline'],
    ],
    [
      '2015',
      '保留彈性，有時比把每一塊錢都投滿更有價值。',
      'Paraphrase: Optionality can be more valuable than being fully invested at all times.',
      ['caution', 'opportunity'],
    ],
    [
      '2016',
      '美國體制的長期順風，遠比短期新聞更值得下注。',
      'Paraphrase: The long American tailwind matters more than the year’s headlines.',
      ['optimism', 'long-term'],
    ],
    [
      '2016',
      '複利真正驚人的地方，在於多年後才看起來像奇蹟。',
      'Paraphrase: The miracle of compounding usually looks ordinary until many years have passed.',
      ['long-term', 'patience'],
    ],
    [
      '2017',
      '真正稀缺的管理者，不是會說故事，而是會把多餘資本放到對的地方。',
      'Paraphrase: Great managers distinguish themselves through capital allocation, not showmanship.',
      ['value', 'discipline'],
    ],
    [
      '2017',
      '判斷企業質量時，回報率和再投資跑道要一起看。',
      'Paraphrase: High returns and a long runway together define exceptional businesses.',
      ['value', 'long-term'],
    ],
    [
      '2018',
      '會計規則的波動不該被誤讀成企業經濟性的大起大落。',
      'Paraphrase: Accounting volatility can obscure stable underlying business economics.',
      ['humility', 'discipline'],
    ],
    [
      '2018',
      '面對雜訊，投資人要守住的是框架，不是感覺。',
      'Paraphrase: When noise rises, cling to process rather than emotion.',
      ['discipline', 'humility'],
    ],
    [
      '2019',
      '現金放著看起來會焦慮，但沒現金時機會來了更焦慮。',
      'Paraphrase: Idle cash feels uncomfortable until the day it becomes strategic.',
      ['caution', 'opportunity'],
    ],
    [
      '2019',
      '好價格不是天天有，所以好耐心也不能只是口號。',
      'Paraphrase: Attractive prices are infrequent, which is why patience must be real.',
      ['patience', 'opportunity'],
    ],
    [
      '2020',
      '疫情這類外部衝擊提醒你：韌性本身就是資產。',
      'Paraphrase: Resilience is an economic asset, not a soft virtue.',
      ['risk', 'long-term'],
    ],
    [
      '2020',
      '在極端事件中，過去看似保守的做法會突然變得剛剛好。',
      'Paraphrase: In extreme conditions, earlier conservatism often proves merely adequate.',
      ['caution', 'risk'],
    ],
    [
      '2021',
      '通膨環境裡，定價權比敘事更值錢。',
      'Paraphrase: Pricing power matters more than storytelling when inflation rises.',
      ['value', 'risk'],
    ],
    [
      '2021',
      '面對通膨，能高回報再投資的企業比固定面額資產更有吸引力。',
      'Paraphrase: Reinvestable businesses often defend owners better than fixed-dollar claims.',
      ['value', 'long-term'],
    ],
    [
      '2022',
      '犯錯不可避免，但重點是別讓錯誤變成制度。',
      'Paraphrase: Mistakes are inevitable; institutionalizing them is optional.',
      ['humility', 'discipline'],
    ],
    [
      '2022',
      '投資上沒有因為你很努力，市場就該給你分數這回事。',
      'Paraphrase: The market does not reward effort alone; it rewards sound judgment and price discipline.',
      ['humility', 'discipline'],
    ],
    [
      '2023',
      '少數真正的大贏家，會替很多普通決策扛起成績。',
      'Paraphrase: A few major winners can carry an investing lifetime.',
      ['optimism', 'long-term'],
    ],
    [
      '2023',
      '你不需要不停證明自己，只需要在少數時刻把資本放對。',
      'Paraphrase: Constant action is unnecessary if important capital decisions are right.',
      ['patience', 'discipline'],
    ],
    [
      '2024',
      '美國奇蹟對有耐心的資本仍然友善。',
      'Paraphrase: Patient capital has long participated in the American miracle.',
      ['optimism', 'long-term'],
    ],
    [
      '2024',
      '長期不亂發股息，前提是公司真能把留存資本用得更好。',
      'Paraphrase: Retained capital is justified only when management can redeploy it well.',
      ['value', 'discipline'],
    ],
  ]),
])

const FALLBACK_TAGS = DEFAULT_PRINCIPLE_TAGS

function normalizeDateInput(date = new Date()) {
  if (date instanceof Date) return Number.isNaN(date.getTime()) ? new Date() : new Date(date)
  const parsed = new Date(date)
  return Number.isNaN(parsed.getTime()) ? new Date() : parsed
}

export function getDailyPrincipleDayKey(date = new Date()) {
  const source = normalizeDateInput(date)
  const parts = TAIPEI_DAY_FORMATTER.formatToParts(source)
  const year = parts.find((part) => part.type === 'year')?.value || '1970'
  const month = parts.find((part) => part.type === 'month')?.value || '01'
  const day = parts.find((part) => part.type === 'day')?.value || '01'
  return `${year}-${month}-${day}`
}

function dateSeed(date = new Date()) {
  return Number(getDailyPrincipleDayKey(date).replace(/-/g, '')) || 0
}

function resolveContextTags(context = null) {
  if (!context || typeof context !== 'object') return null
  const todayPct = Number(context.todayRetPct)
  const weekPct = Number(context.weekRetPct)
  const drawdownPct = Number(context.drawdownPct)
  const headlineTone = String(context.headlineTone || '').toLowerCase()
  const tags = []

  if (Number.isFinite(drawdownPct) && drawdownPct <= -10) {
    tags.push('drawdown', 'courage')
  }
  if (Number.isFinite(todayPct)) {
    if (todayPct >= 1.5) tags.push('caution', 'humility')
    else if (todayPct <= -1.5) tags.push('courage', 'patience')
    else tags.push('discipline')
  }
  if (Number.isFinite(weekPct)) {
    if (weekPct >= 5) tags.push('caution', 'cycles')
    else if (weekPct <= -5) tags.push('courage', 'cycles')
  }
  if (headlineTone === 'alert') tags.push('risk', 'caution')
  else if (headlineTone === 'watch') tags.push('cycles', 'patience')

  return tags.length > 0 ? Array.from(new Set(tags)) : FALLBACK_TAGS
}

export function getDailyPrinciple(date = new Date(), context = null) {
  const tags = resolveContextTags(context)
  const seed = dateSeed(date)
  if (!tags || tags.length === 0) {
    return DAILY_PRINCIPLES[seed % DAILY_PRINCIPLES.length] || DAILY_PRINCIPLES[0]
  }
  const matched = DAILY_PRINCIPLES.filter(
    (entry) => Array.isArray(entry.tags) && entry.tags.some((tag) => tags.includes(tag))
  )
  const pool = matched.length > 0 ? matched : DAILY_PRINCIPLES
  return pool[seed % pool.length] || DAILY_PRINCIPLES[0]
}
