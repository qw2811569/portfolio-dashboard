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
    name: 'Warren Buffett · 巴菲特',
    brief: 'Berkshire Hathaway 董事長 · 價值投資代表人物',
  },
  munger: {
    name: 'Charlie Munger · 蒙格',
    brief: 'Berkshire Hathaway 副董事長 · 反向思考的代言人',
  },
  lynch: { name: 'Peter Lynch · 彼得.林區', brief: 'Magellan Fund 傳奇基金經理人' },
  graham: { name: 'Benjamin Graham · 葛拉漢', brief: '價值投資之父 · 巴菲特的老師' },
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
  street: { name: 'Wall Street 市井諺語', brief: '長年累積的市場格言 · 無單一作者' },
})

const A = {}
for (const [k, v] of Object.entries(AUTHORS)) {
  A[k] = v.name
}

// Each entry: { quote (zh translation), quoteEn (original English where known),
// author (display name from AUTHORS), year (approximate quote year, '' if unknown),
// authorBrief (1-line context), tags (mood/situation tags)
// Tag taxonomy: caution / courage / cycles / discipline / drawdown / humility /
// long-term / opportunity / patience / risk / value / optimism
export const DAILY_PRINCIPLES = Object.freeze([
  // === Buffett 巴菲特 ===
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
    year: '',
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
    year: '',
    authorBrief: AUTHORS.buffett.brief,
    tags: ['risk', 'discipline'],
  },
  {
    quote: '風險來自於你不知道自己在做什麼。',
    quoteEn: 'Risk comes from not knowing what you are doing.',
    author: A.buffett,
    year: '',
    authorBrief: AUTHORS.buffett.brief,
    tags: ['risk', 'humility'],
  },
  {
    quote: '若你不能在帳戶縮水 50% 時保持冷靜，你不該在股市裡。',
    quoteEn:
      'If you cannot watch your stock decline by 50% without becoming panic-stricken, you should not be in the stock market.',
    author: A.buffett,
    year: '',
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
    year: '',
    authorBrief: AUTHORS.buffett.brief,
    tags: ['value', 'long-term'],
  },
  {
    quote: '股市是一個把錢從沒耐心的人轉到有耐心的人的地方。',
    quoteEn:
      'The stock market is a device for transferring money from the impatient to the patient.',
    author: A.buffett,
    year: '',
    authorBrief: AUTHORS.buffett.brief,
    tags: ['patience', 'long-term'],
  },
  {
    quote: '你不需要每一球都揮棒，等到甜蜜點再出手。',
    quoteEn:
      "There are no called strikes in investing. You don't have to swing at everything — you can wait for your pitch.",
    author: A.buffett,
    year: '',
    authorBrief: AUTHORS.buffett.brief,
    tags: ['patience', 'opportunity'],
  },
  {
    quote: '我從不試著預測市場，只試著理解企業。',
    quoteEn:
      'I never attempt to make money on the stock market. I buy on the assumption that they could close the market the next day and not reopen it for five years.',
    author: A.buffett,
    year: '',
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
    year: '',
    authorBrief: AUTHORS.buffett.brief,
    tags: ['discipline', 'humility'],
  },
  {
    quote: '名譽要花二十年建立，五分鐘毀掉。',
    quoteEn: 'It takes 20 years to build a reputation and five minutes to ruin it.',
    author: A.buffett,
    year: '',
    authorBrief: AUTHORS.buffett.brief,
    tags: ['risk', 'discipline'],
  },
  {
    quote: '人都會犯錯，重點是別在錯的地方下大注。',
    quoteEn:
      "You only have to do a very few things right in your life so long as you don't do too many things wrong.",
    author: A.buffett,
    year: '',
    authorBrief: AUTHORS.buffett.brief,
    tags: ['risk', 'humility'],
  },

  // === Munger 蒙格 ===
  {
    quote: '只要知道我會死在哪裡，我就絕不會去那裡。',
    quoteEn: "All I want to know is where I'm going to die, so I'll never go there.",
    author: A.munger,
    year: '',
    authorBrief: AUTHORS.munger.brief,
    tags: ['risk', 'humility'],
  },
  {
    quote: '反過來想，總是反過來想。',
    quoteEn: 'Invert, always invert.',
    author: A.munger,
    year: '',
    authorBrief: AUTHORS.munger.brief,
    tags: ['discipline', 'risk'],
  },
  {
    quote: '把屁股黏在椅子上，是這個世界上最被低估的能力。',
    quoteEn: 'The big money is not in the buying or the selling, but in the waiting.',
    author: A.munger,
    year: '',
    authorBrief: AUTHORS.munger.brief,
    tags: ['patience', 'long-term'],
  },
  {
    quote: '如果你拒絕從別人的錯誤中學習，你就只能用自己的錢去學。',
    quoteEn: "If you don't learn from the mistakes of others, you'll have to make them yourself.",
    author: A.munger,
    year: '',
    authorBrief: AUTHORS.munger.brief,
    tags: ['humility', 'risk'],
  },
  {
    quote: '常識是非常稀有的常識。',
    quoteEn: 'Common sense is not so common.',
    author: A.munger,
    year: '',
    authorBrief: AUTHORS.munger.brief,
    tags: ['discipline', 'humility'],
  },
  {
    quote: '理性比聰明更重要。',
    quoteEn: 'Rationality is the only thing that helps you. Brilliance does not.',
    author: A.munger,
    year: '',
    authorBrief: AUTHORS.munger.brief,
    tags: ['discipline', 'humility'],
  },
  {
    quote: '想要結果，先看誘因。',
    quoteEn: 'Show me the incentive and I will show you the outcome.',
    author: A.munger,
    year: '',
    authorBrief: AUTHORS.munger.brief,
    tags: ['discipline', 'humility'],
  },
  {
    quote: '如果你不願意承受 50% 的回撤，你就不該擁有股票。',
    quoteEn:
      "If you're not willing to react with equanimity to a market price decline of 50%, you're not fit to be a common shareholder.",
    author: A.munger,
    year: '',
    authorBrief: AUTHORS.munger.brief,
    tags: ['drawdown', 'discipline'],
  },
  {
    quote: '一個人若不會說「我不知道」，就不夠格說自己懂投資。',
    quoteEn: "Acknowledging what you don't know is the dawning of wisdom.",
    author: A.munger,
    year: '',
    authorBrief: AUTHORS.munger.brief,
    tags: ['humility'],
  },
  {
    quote: '投資生涯能挑對 20 個關鍵決定，這輩子就夠了。',
    quoteEn:
      'It is remarkable how much long-term advantage people like us have gotten by trying to be consistently not stupid.',
    author: A.munger,
    year: '',
    authorBrief: AUTHORS.munger.brief,
    tags: ['patience', 'opportunity'],
  },
  {
    quote: '別跟你不尊敬的人合作，無論報酬多吸引。',
    quoteEn: 'Never work with anyone you do not admire.',
    author: A.munger,
    year: '',
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
    year: '',
    authorBrief: AUTHORS.lynch.brief,
    tags: ['drawdown', 'discipline'],
  },
  {
    quote: '十大致富股，有八支來自你身邊的日常。',
    quoteEn: 'Invest in what you know.',
    author: A.lynch,
    year: '',
    authorBrief: AUTHORS.lynch.brief,
    tags: ['value', 'discipline'],
  },
  {
    quote: '如果一檔股票讓你睡不好，部位太大了。',
    quoteEn: "Don't bottom fish. Don't average down.",
    author: A.lynch,
    year: '',
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
    year: '',
    authorBrief: AUTHORS.marks.brief,
    tags: ['value', 'patience'],
  },
  {
    quote: '你不能控制報酬，但可以控制風險。',
    quoteEn:
      'In the world of investing, you cannot control outcomes; you can only control your risk.',
    author: A.marks,
    year: '',
    authorBrief: AUTHORS.marks.brief,
    tags: ['risk', 'discipline'],
  },
  {
    quote: '差別不在於你比別人聰明多少，而在於你比別人少犯多少蠢事。',
    quoteEn: 'The road to investment success is paved with the avoidance of mistakes.',
    author: A.marks,
    year: '',
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
    year: '',
    authorBrief: AUTHORS.marks.brief,
    tags: ['caution', 'cycles'],
  },

  // === Templeton 鄧普頓 ===
  {
    quote: '投資中最危險的四個字是：「這次不一樣」。',
    quoteEn: "The four most dangerous words in investing are: 'this time it's different.'",
    author: A.templeton,
    year: '',
    authorBrief: AUTHORS.templeton.brief,
    tags: ['cycles', 'humility', 'caution'],
  },
  {
    quote: '牛市生於悲觀，成於懷疑，熟於樂觀，死於亢奮。',
    quoteEn:
      'Bull markets are born on pessimism, grow on skepticism, mature on optimism, and die on euphoria.',
    author: A.templeton,
    year: '',
    authorBrief: AUTHORS.templeton.brief,
    tags: ['cycles', 'caution'],
  },
  {
    quote: '在最大悲觀點買進，是長期最賺錢的時刻。',
    quoteEn:
      'The time of maximum pessimism is the best time to buy, and the time of maximum optimism is the best time to sell.',
    author: A.templeton,
    year: '',
    authorBrief: AUTHORS.templeton.brief,
    tags: ['courage', 'opportunity'],
  },
  {
    quote: '長期下來，國際分散是降低風險最好的方式之一。',
    quoteEn: 'Diversify. In stocks and bonds, as in much else, there is safety in numbers.',
    author: A.templeton,
    year: '',
    authorBrief: AUTHORS.templeton.brief,
    tags: ['risk'],
  },

  // === Soros 索羅斯 ===
  {
    quote: '重點不是對或錯，而是看對時賺多少、看錯時賠多少。',
    quoteEn:
      "It's not whether you're right or wrong that's important, but how much money you make when you're right and how much you lose when you're wrong.",
    author: A.soros,
    year: '',
    authorBrief: AUTHORS.soros.brief,
    tags: ['risk', 'discipline'],
  },
  {
    quote: '我富有的原因，是因為我知道何時錯了。',
    quoteEn: "I'm only rich because I know when I'm wrong.",
    author: A.soros,
    year: '',
    authorBrief: AUTHORS.soros.brief,
    tags: ['humility', 'discipline'],
  },
  {
    quote: '當你不確定時，部位就要小。',
    quoteEn:
      'When you have a great conviction, you should bet very big — but when you are not sure, smaller.',
    author: A.soros,
    year: '',
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
    year: '',
    authorBrief: AUTHORS.bogle.brief,
    tags: ['patience', 'discipline'],
  },
  {
    quote: '投資成功的祕訣是：低成本、長持有、別亂動。',
    quoteEn: 'Stay the course. No matter what happens, stick to your program.',
    author: A.bogle,
    year: '',
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
    year: '',
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
    year: '',
    authorBrief: AUTHORS.druck.brief,
    tags: ['courage', 'discipline'],
  },
  {
    quote: '我犯過最大的錯，是太早賣掉好公司。',
    quoteEn: 'The way to build long-term returns is through preservation of capital and home runs.',
    author: A.druck,
    year: '',
    authorBrief: AUTHORS.druck.brief,
    tags: ['patience', 'long-term'],
  },

  // === Tepper ===
  {
    quote: '別逆 Fed 操作。',
    quoteEn: "Don't fight the Fed.",
    author: A.tepper,
    year: '',
    authorBrief: AUTHORS.tepper.brief,
    tags: ['discipline', 'cycles'],
  },

  // === Rogers 羅傑斯 ===
  {
    quote: '在沒人關心的地方，找到下一個泡沫的種子。',
    quoteEn:
      'I look for the cheapest, most undervalued things I can possibly find anywhere in the world.',
    author: A.rogers,
    year: '',
    authorBrief: AUTHORS.rogers.brief,
    tags: ['value', 'opportunity'],
  },
  {
    quote: '只在你看得懂、能解釋給孩子聽的市場下注。',
    quoteEn: "If you don't understand it, don't put your money in.",
    author: A.rogers,
    year: '',
    authorBrief: AUTHORS.rogers.brief,
    tags: ['discipline', 'humility'],
  },

  // === Ackman 艾克曼 ===
  {
    quote: '高品質的事業 + 合理的價格 + 長期持有，是賺錢的鐵三角。',
    quoteEn:
      'Investing is a business where you can look very silly for a long period of time before you are proven right.',
    author: A.ackman,
    year: '',
    authorBrief: AUTHORS.ackman.brief,
    tags: ['value', 'long-term'],
  },

  // === Greenblatt 葛林布雷 ===
  {
    quote: '若你不能堅守一套有效策略，再好的策略也救不了你。',
    quoteEn:
      "Choosing individual stocks without any idea of what you're looking for is like running through a dynamite factory with a burning match.",
    author: A.greenblatt,
    year: '',
    authorBrief: AUTHORS.greenblatt.brief,
    tags: ['discipline'],
  },

  // === Schloss 史洛斯 ===
  {
    quote: '買便宜的、抱久一點，剩下的交給時間。',
    quoteEn: 'I try to buy stocks cheap, and I am willing to hold them.',
    author: A.schloss,
    year: '',
    authorBrief: AUTHORS.schloss.brief,
    tags: ['value', 'long-term', 'patience'],
  },

  // === Burry 貝瑞 ===
  {
    quote: '基本面終究會勝出，但市場可以比你撐得更久。',
    quoteEn: 'If you are going to be a great investor, you have to fit the style to who you are.',
    author: A.burry,
    year: '',
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
    year: '',
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
    year: '',
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
    year: '',
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
    year: '',
    authorBrief: AUTHORS.keynes.brief,
    tags: ['humility', 'discipline'],
  },

  // === Arnott / Bernstein ===
  {
    quote: '在投資裡，舒服的時候通常代表錢已經賺完了。',
    quoteEn: 'In investing, what is comfortable is rarely profitable.',
    author: A.arnott,
    year: '',
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
    year: '',
    authorBrief: AUTHORS.street.brief,
    tags: ['cycles', 'caution'],
  },
  {
    quote: '牛和熊都賺錢，貪心的豬被宰。',
    quoteEn: 'Bulls make money, bears make money, pigs get slaughtered.',
    author: A.street,
    year: '',
    authorBrief: AUTHORS.street.brief,
    tags: ['discipline', 'caution'],
  },
  {
    quote: '趨勢是朋友，但會結束。',
    quoteEn: 'The trend is your friend, until it ends.',
    author: A.street,
    year: '',
    authorBrief: AUTHORS.street.brief,
    tags: ['cycles', 'discipline'],
  },
  {
    quote: '別接落下的刀。',
    quoteEn: "Don't catch a falling knife.",
    author: A.street,
    year: '',
    authorBrief: AUTHORS.street.brief,
    tags: ['caution', 'risk'],
  },
  {
    quote: '停損要快，獲利要讓它跑。',
    quoteEn: 'Cut your losses short and let your profits run.',
    author: A.street,
    year: '',
    authorBrief: AUTHORS.street.brief,
    tags: ['discipline', 'risk'],
  },
  {
    quote: '在熊市裡，錢回到該擁有它的人手上。',
    quoteEn: 'In a bear market, money returns to its rightful owners.',
    author: A.street,
    year: '',
    authorBrief: AUTHORS.street.brief,
    tags: ['cycles', 'patience'],
  },
  {
    quote: '待在市場裡，勝過抓進場時機。',
    quoteEn: 'Time in the market beats timing the market.',
    author: A.street,
    year: '',
    authorBrief: AUTHORS.street.brief,
    tags: ['long-term', 'patience'],
  },
])

const FALLBACK_TAGS = Object.freeze(['discipline', 'patience'])

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
