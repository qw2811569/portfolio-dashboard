const TAIPEI_DAY_FORMATTER = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Asia/Taipei',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
})

const BUFFETT = 'Warren Buffett · 巴菲特'
const MUNGER = 'Charlie Munger · 蒙格'
const LYNCH = 'Peter Lynch · 彼得.林區'
const GRAHAM = 'Benjamin Graham · 葛拉漢'
const MARKS = 'Howard Marks · 霍華.馬克斯'
const TEMPLETON = 'John Templeton · 鄧普頓'
const SOROS = 'George Soros · 索羅斯'
const KLARMAN = 'Seth Klarman · 克拉曼'
const LIVERMORE = 'Jesse Livermore · 李佛摩'
const FISHER = 'Philip Fisher · 費雪'
const HOUSEL = 'Morgan Housel'
const BOGLE = 'John Bogle · 柏格'
const DALIO = 'Ray Dalio · 達利歐'
const DRUCK = 'Stanley Druckenmiller · 杜肯米勒'
const TEPPER = 'David Tepper · 特珀'
const ROGERS = 'Jim Rogers · 羅傑斯'
const ICAHN = 'Carl Icahn · 伊坎'
const ACKMAN = 'Bill Ackman · 艾克曼'
const GREENBLATT = 'Joel Greenblatt · 葛林布雷'
const SCHLOSS = 'Walter Schloss · 史洛斯'
const BURRY = 'Michael Burry · 貝瑞'
const MAUBOUSSIN = 'Michael Mauboussin'
const TWAIN = 'Mark Twain · 馬克吐溫'
const KAHNEMAN = 'Daniel Kahneman · 康納曼'
const THALER = 'Richard Thaler · 塞勒'
const SHILLER = 'Robert Shiller · 席勒'
const TALEB = 'Nassim Taleb · 塔雷伯'
const KEYNES = 'John Maynard Keynes · 凱因斯'
const ARNOTT = 'Robert Arnott'
const SUNTZU = '孫子'
const LAOZI = '老子'
const ZHUANGZI = '莊子'
const DUANYP = '段永平'
const QIUGL = '邱國鷺'
const DANBIN = '但斌'
const ZHANGL = '張磊（高瓴）'
const LIKS = '李嘉誠'
const WANGYC = '王永慶'
const TSAIMK = '蔡明介'
const STREET = 'Wall Street 市井諺語'

export const DAILY_PRINCIPLES = Object.freeze([
  // === Buffett 巴菲特 ===
  {
    quote: '別人貪婪時恐懼，別人恐懼時貪婪。',
    author: BUFFETT,
    tags: ['caution', 'courage', 'cycles'],
  },
  {
    quote: '時間是好公司的朋友，是平庸公司的敵人。',
    author: BUFFETT,
    tags: ['long-term', 'patience'],
  },
  {
    quote: '當潮水退去，才會知道誰在裸泳。',
    author: BUFFETT,
    tags: ['cycles', 'risk', 'humility'],
  },
  {
    quote: '若你不打算持有十年，就別考慮持有十分鐘。',
    author: BUFFETT,
    tags: ['long-term', 'patience'],
  },
  {
    quote: '股票不知道你擁有它，所以對它別有感情。',
    author: BUFFETT,
    tags: ['discipline', 'humility'],
  },
  { quote: '了解自己的能力圈，並待在裡面。', author: BUFFETT, tags: ['discipline', 'humility'] },
  {
    quote: '投資的本質，是把現在的購買力轉成未來更多的購買力。',
    author: BUFFETT,
    tags: ['long-term', 'value'],
  },
  { quote: '價格是你付的，價值是你拿到的。', author: BUFFETT, tags: ['value', 'discipline'] },
  {
    quote: '寧可付合理價格買偉大的公司，也不要用便宜價格買平庸的公司。',
    author: BUFFETT,
    tags: ['value', 'long-term'],
  },
  { quote: '我們最不想冒的險，是讓本金永久損失。', author: BUFFETT, tags: ['risk', 'caution'] },
  {
    quote: '規則一：不要賠錢。規則二：不要忘記規則一。',
    author: BUFFETT,
    tags: ['risk', 'discipline'],
  },
  { quote: '風險來自於你不知道自己在做什麼。', author: BUFFETT, tags: ['risk', 'humility'] },
  {
    quote: '若你不能在帳戶縮水 50% 時保持冷靜，你不該在股市裡。',
    author: BUFFETT,
    tags: ['drawdown', 'discipline'],
  },
  { quote: '最好的持有期限是永遠。', author: BUFFETT, tags: ['long-term', 'patience'] },
  { quote: '機會出現時，必須狠狠地揮棒。', author: BUFFETT, tags: ['courage', 'opportunity'] },
  { quote: '挑公司比挑股票重要。', author: BUFFETT, tags: ['value', 'long-term'] },
  {
    quote: '股市是一個把錢從沒耐心的人轉到有耐心的人的地方。',
    author: BUFFETT,
    tags: ['patience', 'long-term'],
  },
  {
    quote: '你不需要每一球都揮棒，等到甜蜜點再出手。',
    author: BUFFETT,
    tags: ['patience', 'opportunity'],
  },
  {
    quote: '能夠了解自己「不知道」的範圍，比知道多少還重要。',
    author: BUFFETT,
    tags: ['humility', 'discipline'],
  },
  { quote: '價格波動的本質就是：好公司有時會變便宜。', author: BUFFETT, tags: ['cycles', 'value'] },
  { quote: '我從不試著預測市場，只試著理解企業。', author: BUFFETT, tags: ['discipline', 'value'] },
  { quote: '要等到牆角的雪球夠長，再開始滾。', author: BUFFETT, tags: ['patience', 'long-term'] },
  { quote: '永遠不要做空美國。', author: BUFFETT, tags: ['long-term', 'optimism'] },
  { quote: '投資不複雜，但很簡單不等於容易。', author: BUFFETT, tags: ['discipline', 'humility'] },
  {
    quote: '若你買了一檔股票，希望它跌不希望它漲，這樣才有機會加碼。',
    author: BUFFETT,
    tags: ['drawdown', 'opportunity', 'patience'],
  },

  // === Munger 蒙格 ===
  { quote: '只要知道我會死在哪裡，我就絕不會去那裡。', author: MUNGER, tags: ['risk', 'humility'] },
  { quote: '反過來想，總是反過來想。', author: MUNGER, tags: ['discipline', 'risk'] },
  {
    quote: '我比較喜歡笨拙地正確，勝過聰明地犯錯。',
    author: MUNGER,
    tags: ['humility', 'discipline'],
  },
  { quote: '一個錯誤的決定要花十年來修正。', author: MUNGER, tags: ['caution', 'risk'] },
  {
    quote: '一張糟糕的待辦清單會讓人忙到死，卻離真正重要的事越來越遠。',
    author: MUNGER,
    tags: ['discipline', 'patience'],
  },
  {
    quote: '把屁股黏在椅子上，是這個世界上最被低估的能力。',
    author: MUNGER,
    tags: ['patience', 'long-term'],
  },
  {
    quote: '在投資裡，只有少數幾個重要的決定會塑造你大部分的成就。',
    author: MUNGER,
    tags: ['patience', 'opportunity'],
  },
  {
    quote: '如果你拒絕從別人的錯誤中學習，你就只能用自己的錢去學。',
    author: MUNGER,
    tags: ['humility', 'risk'],
  },
  { quote: '常識在投資裡是非常稀有的常識。', author: MUNGER, tags: ['discipline', 'humility'] },
  {
    quote: '把一件事做到底，比同時做十件事更容易賺錢。',
    author: MUNGER,
    tags: ['discipline', 'patience'],
  },
  { quote: '理性比聰明更重要。', author: MUNGER, tags: ['discipline', 'humility'] },
  { quote: '經驗是用昂貴的學費買來的智慧。', author: MUNGER, tags: ['humility', 'risk'] },
  {
    quote: '決定不做什麼，跟決定要做什麼一樣重要。',
    author: MUNGER,
    tags: ['discipline', 'patience'],
  },
  {
    quote: '你沒辦法靠多觀察兩眼，把一個糟糕的生意變成好生意。',
    author: MUNGER,
    tags: ['value', 'discipline'],
  },
  { quote: '想要結果，先看誘因。', author: MUNGER, tags: ['discipline', 'humility'] },
  { quote: '錯過一個你看不懂的機會，不算錯過。', author: MUNGER, tags: ['discipline', 'humility'] },
  {
    quote: '投資生涯能挑對 20 個關鍵決定，這輩子就夠了。',
    author: MUNGER,
    tags: ['patience', 'opportunity'],
  },
  {
    quote: '如果你不願意承受 50% 的回撤，你就不該擁有股票。',
    author: MUNGER,
    tags: ['drawdown', 'discipline'],
  },

  // === Lynch 林區 ===
  { quote: '知道你買了什麼，也知道你為什麼買它。', author: LYNCH, tags: ['discipline', 'value'] },
  {
    quote: '一個錯誤的決定要花十年來修正，而正確的決定通常很無聊。',
    author: LYNCH,
    tags: ['patience', 'discipline'],
  },
  {
    quote: '預測市場短期走勢，是專家們最常做也最常錯的事。',
    author: LYNCH,
    tags: ['humility', 'discipline'],
  },
  {
    quote: '每張股票後面都有一家公司，搞清楚那家公司在做什麼。',
    author: LYNCH,
    tags: ['value', 'discipline'],
  },
  { quote: '股價不會無緣無故漲，背後一定有原因。', author: LYNCH, tags: ['discipline', 'value'] },
  {
    quote: '在你了解一家公司前，永遠不要因為別人說它好就買它。',
    author: LYNCH,
    tags: ['humility', 'discipline'],
  },
  {
    quote: '長期持有好公司，比追逐短線好機會更會賺。',
    author: LYNCH,
    tags: ['long-term', 'patience'],
  },
  {
    quote: '如果你在投資前花的時間，比挑微波爐還少，麻煩就大了。',
    author: LYNCH,
    tags: ['discipline', 'humility'],
  },
  { quote: '投資裡，胃比腦袋重要。', author: LYNCH, tags: ['drawdown', 'discipline'] },
  {
    quote: '在投資裡，「等等再進場」常常等於「永遠不進場」。',
    author: LYNCH,
    tags: ['courage', 'opportunity'],
  },
  { quote: '十大致富股，有八支來自你身邊的日常。', author: LYNCH, tags: ['value', 'discipline'] },

  // === Graham 葛拉漢 ===
  {
    quote: '短期市場是一台投票機，長期是一台秤重機。',
    author: GRAHAM,
    tags: ['cycles', 'long-term', 'value'],
  },
  {
    quote: '聰明的投資者是現實主義者，向樂觀者賣出，向悲觀者買進。',
    author: GRAHAM,
    tags: ['cycles', 'value', 'discipline'],
  },
  { quote: '投資者最大的敵人，往往是自己。', author: GRAHAM, tags: ['discipline', 'humility'] },
  { quote: '安全邊際是投資的核心概念。', author: GRAHAM, tags: ['risk', 'value'] },
  { quote: '投資是一場理性與情緒的對抗。', author: GRAHAM, tags: ['discipline'] },
  {
    quote: '價格波動的真正意義，是讓你有機會用聰明的價格做交易。',
    author: GRAHAM,
    tags: ['cycles', 'value', 'opportunity'],
  },
  {
    quote: '別讓市場先生決定你買賣的時機，他只是來報價的。',
    author: GRAHAM,
    tags: ['discipline', 'cycles'],
  },
  {
    quote: '投資操作必須以充分的分析為基礎，承諾本金安全與合理回報。',
    author: GRAHAM,
    tags: ['risk', 'discipline'],
  },

  // === Marks 馬克斯 ===
  { quote: '無法預測，但可以做好準備。', author: MARKS, tags: ['risk', 'discipline'] },
  { quote: '便宜不是買進的理由，貴也不是賣出的理由。', author: MARKS, tags: ['value', 'patience'] },
  { quote: '你不能控制報酬，但可以控制風險。', author: MARKS, tags: ['risk', 'discipline'] },
  { quote: '投資的成功不在於買到好東西，而在於買得好。', author: MARKS, tags: ['value'] },
  { quote: '在循環裡待得越久，學會的越多。', author: MARKS, tags: ['cycles', 'humility'] },
  {
    quote: '當大家都覺得不會出錯時，往往就是最危險的時候。',
    author: MARKS,
    tags: ['caution', 'cycles'],
  },
  {
    quote: '我們不能精準預測市場，但能感受到自己處在循環的哪個位置。',
    author: MARKS,
    tags: ['cycles', 'humility'],
  },
  { quote: '想清楚再行動，行動了就要堅定。', author: MARKS, tags: ['discipline'] },
  {
    quote: '差別不在於你比別人聰明多少，而在於你比別人少犯多少蠢事。',
    author: MARKS,
    tags: ['humility', 'risk'],
  },

  // === Templeton 鄧普頓 ===
  {
    quote: '投資中最危險的四個字是：「這次不一樣」。',
    author: TEMPLETON,
    tags: ['cycles', 'humility', 'caution'],
  },
  {
    quote: '牛市生於悲觀，成於懷疑，熟於樂觀，死於亢奮。',
    author: TEMPLETON,
    tags: ['cycles', 'caution'],
  },
  {
    quote: '在最大悲觀點買進，是長期最賺錢的時刻。',
    author: TEMPLETON,
    tags: ['courage', 'opportunity'],
  },
  {
    quote: '便宜的時候別人都覺得會更便宜，那就是你的機會。',
    author: TEMPLETON,
    tags: ['courage', 'opportunity'],
  },
  { quote: '長期下來，國際分散是降低風險最好的方式之一。', author: TEMPLETON, tags: ['risk'] },

  // === Soros 索羅斯 ===
  {
    quote: '重點不是對或錯，而是看對時賺多少、看錯時賠多少。',
    author: SOROS,
    tags: ['risk', 'discipline'],
  },
  {
    quote: '市場永遠是錯的，但要等到大家也覺得錯時才會反轉。',
    author: SOROS,
    tags: ['cycles', 'patience'],
  },
  {
    quote: '我富有的原因，是因為我知道何時錯了。',
    author: SOROS,
    tags: ['humility', 'discipline'],
  },
  { quote: '當你不確定時，部位就要小。', author: SOROS, tags: ['risk', 'discipline'] },
  { quote: '投資不是流行，越冷門的反而越值得想。', author: SOROS, tags: ['value', 'opportunity'] },

  // === Klarman 克拉曼 ===
  { quote: '風險不是一個數字，而是一種觀念。', author: KLARMAN, tags: ['risk', 'humility'] },
  { quote: '寧可錯過，也不要踩雷。', author: KLARMAN, tags: ['caution', 'risk'] },
  { quote: '永遠把保本放在賺錢之前。', author: KLARMAN, tags: ['risk', 'discipline'] },
  {
    quote: '價值投資需要耐心，更需要忍受別人賺得比你快的痛。',
    author: KLARMAN,
    tags: ['patience', 'discipline'],
  },
  {
    quote: '當別人在追逐 momentum 時，價值投資者在等待 mispricing。',
    author: KLARMAN,
    tags: ['value', 'patience'],
  },

  // === Livermore 李佛摩 ===
  { quote: '華爾街沒有新鮮事。', author: LIVERMORE, tags: ['cycles', 'humility'] },
  { quote: '市場永遠對，但人會錯。', author: LIVERMORE, tags: ['discipline', 'humility'] },
  { quote: '錢是賺在屁股上，不是腦子裡。', author: LIVERMORE, tags: ['patience', 'discipline'] },
  {
    quote: '永遠記得：行情總在絕望中誕生，在猶豫中成長，在亢奮中死亡。',
    author: LIVERMORE,
    tags: ['cycles'],
  },
  {
    quote: '一個人的失敗，不在於市場，在於他自己。',
    author: LIVERMORE,
    tags: ['humility', 'discipline'],
  },
  {
    quote: '進場容易，出場難。每筆交易進場前先想出場條件。',
    author: LIVERMORE,
    tags: ['discipline', 'risk'],
  },

  // === Fisher 費雪 ===
  {
    quote: '市場上充滿了知道每樣東西價格、卻不知道任何東西價值的人。',
    author: FISHER,
    tags: ['value', 'discipline'],
  },
  {
    quote: '一檔好公司若是放對地方，幾乎沒有理由賣出。',
    author: FISHER,
    tags: ['long-term', 'value'],
  },
  { quote: '研究越深，持有越久，賺得越多。', author: FISHER, tags: ['long-term', 'discipline'] },
  {
    quote: '看一家公司的競爭力，先看它的客戶怎麼說。',
    author: FISHER,
    tags: ['value', 'discipline'],
  },

  // === Housel ===
  {
    quote: '財富是你看不見的東西，是你沒花的錢。',
    author: HOUSEL,
    tags: ['discipline', 'long-term'],
  },
  {
    quote: '在投資裡，悲觀的人聽起來像智者，樂觀的人聽起來像傻子。',
    author: HOUSEL,
    tags: ['cycles', 'discipline'],
  },
  {
    quote: '你不需要做出非凡的決定，只需要避免做出愚蠢的決定。',
    author: HOUSEL,
    tags: ['discipline', 'risk'],
  },
  { quote: '時間是投資中最強的槓桿。', author: HOUSEL, tags: ['long-term', 'patience'] },
  {
    quote: '錢買到自由，比買到漂亮東西更值得。',
    author: HOUSEL,
    tags: ['discipline', 'long-term'],
  },
  { quote: '錯過 10 個好機會比賠 1 次本金便宜。', author: HOUSEL, tags: ['risk', 'discipline'] },
  {
    quote: '相信你看不到的歷史循環，比相信你預測的未來重要。',
    author: HOUSEL,
    tags: ['cycles', 'humility'],
  },
  { quote: '高品質報酬通常很無聊。', author: HOUSEL, tags: ['patience', 'discipline'] },

  // === Bogle 柏格 ===
  { quote: '別找乾草堆裡的針，買整個乾草堆。', author: BOGLE, tags: ['risk', 'long-term'] },
  {
    quote: '投資成功的祕訣是：低成本、長持有、別亂動。',
    author: BOGLE,
    tags: ['discipline', 'long-term', 'patience'],
  },
  { quote: '時間是你的朋友，衝動是你的敵人。', author: BOGLE, tags: ['patience', 'discipline'] },
  {
    quote: '別讓 yesterday 偷走你 tomorrow 的報酬。',
    author: BOGLE,
    tags: ['discipline', 'long-term'],
  },

  // === Dalio 達利歐 ===
  { quote: '痛苦 + 反省 = 進步。', author: DALIO, tags: ['humility', 'discipline'] },
  { quote: '別預測市場，要為各種情境做好準備。', author: DALIO, tags: ['risk', 'discipline'] },
  { quote: '想要 alpha 又想要安心，分散就是答案。', author: DALIO, tags: ['risk'] },
  { quote: '能持續對的人，往往是那些能說「我不知道」的人。', author: DALIO, tags: ['humility'] },
  { quote: '一切重大失敗，根因都是傲慢與不謙卑。', author: DALIO, tags: ['humility', 'risk'] },

  // === Druckenmiller 杜肯米勒 ===
  {
    quote: '若你看對方向，部位要夠大；若沒把握，就回家睡覺。',
    author: DRUCK,
    tags: ['courage', 'discipline'],
  },
  {
    quote: '不要在意過去買的成本，只看現在這檔該不該抱。',
    author: DRUCK,
    tags: ['discipline', 'humility'],
  },
  { quote: '我犯過最大的錯，是太早賣掉好公司。', author: DRUCK, tags: ['patience', 'long-term'] },

  // === Tepper 特珀 ===
  { quote: '機會出現時，做人要狠一點。', author: TEPPER, tags: ['courage', 'opportunity'] },
  { quote: '別逆 Fed 操作。', author: TEPPER, tags: ['discipline', 'cycles'] },

  // === Rogers 羅傑斯 ===
  {
    quote: '在沒人關心的地方，找到下一個泡沫的種子。',
    author: ROGERS,
    tags: ['value', 'opportunity'],
  },
  {
    quote: '只在你看得懂、能解釋給孩子聽的市場下注。',
    author: ROGERS,
    tags: ['discipline', 'humility'],
  },

  // === Icahn 伊坎 ===
  { quote: '在投資裡，懶惰比錯誤更貴。', author: ICAHN, tags: ['discipline'] },
  {
    quote: '你想找到便宜貨，必須去別人不去的地方。',
    author: ICAHN,
    tags: ['value', 'opportunity'],
  },

  // === Ackman 艾克曼 ===
  {
    quote: '投資想成功，要有耐心、紀律，加上承擔短期難堪的勇氣。',
    author: ACKMAN,
    tags: ['patience', 'discipline'],
  },
  {
    quote: '高品質的事業 + 合理的價格 + 長期持有，是賺錢的鐵三角。',
    author: ACKMAN,
    tags: ['value', 'long-term'],
  },

  // === Greenblatt 葛林布雷 ===
  {
    quote: '若你不能堅守一套有效策略，再好的策略也救不了你。',
    author: GREENBLATT,
    tags: ['discipline'],
  },
  { quote: '便宜的好公司，是價值投資的核心。', author: GREENBLATT, tags: ['value'] },

  // === Schloss 史洛斯 ===
  { quote: '別讓市場逼你賣，讓邏輯告訴你賣。', author: SCHLOSS, tags: ['discipline'] },
  {
    quote: '買便宜的、抱久一點，剩下的交給時間。',
    author: SCHLOSS,
    tags: ['value', 'long-term', 'patience'],
  },

  // === Burry 貝瑞 ===
  { quote: '當大家都不再質疑時，就是最該質疑的時候。', author: BURRY, tags: ['caution', 'cycles'] },
  {
    quote: '基本面終究會勝出，但市場可以比你撐得更久。',
    author: BURRY,
    tags: ['patience', 'risk'],
  },

  // === Mauboussin ===
  {
    quote: '在投資裡，過程比結果更值得評估。',
    author: MAUBOUSSIN,
    tags: ['discipline', 'humility'],
  },
  { quote: '運氣與技巧永遠在比例變化中。', author: MAUBOUSSIN, tags: ['humility'] },

  // === Twain 馬克吐溫 ===
  {
    quote: '會把帳戶搞垮的，不是看不懂的東西，而是自以為看懂的東西。',
    author: TWAIN,
    tags: ['humility', 'risk'],
  },
  {
    quote: '十月，是炒股最危險的月份；其他危險的月份是七、九、八、五……',
    author: TWAIN,
    tags: ['cycles', 'caution'],
  },

  // === Kahneman / Thaler / Shiller / Taleb ===
  {
    quote: '我們不是看到風險，是看到我們對風險的故事。',
    author: KAHNEMAN,
    tags: ['risk', 'humility'],
  },
  {
    quote: '損失帶來的痛苦，大約是同等收益快樂的兩倍。',
    author: KAHNEMAN,
    tags: ['drawdown', 'discipline'],
  },
  { quote: '我們對自己掌控感的幻覺，是投資失誤的開端。', author: KAHNEMAN, tags: ['humility'] },
  {
    quote: '人們不是不理性，他們只是有自己的理由。',
    author: THALER,
    tags: ['humility', 'discipline'],
  },
  {
    quote: '心理帳戶會讓你覺得這筆錢和那筆錢不一樣，但市場不在乎。',
    author: THALER,
    tags: ['discipline'],
  },
  { quote: '泡沫的特徵是大家都覺得這次不一樣。', author: SHILLER, tags: ['cycles', 'caution'] },
  {
    quote: '不要混淆波動與風險。波動只是噪音，風險是永久性損失。',
    author: TALEB,
    tags: ['risk', 'cycles'],
  },
  { quote: '黑天鵝不是預測出來的，是準備出來的。', author: TALEB, tags: ['risk', 'discipline'] },
  {
    quote: '不要問「會發生什麼」，要問「如果發生了，我承受得住嗎」。',
    author: TALEB,
    tags: ['risk', 'discipline'],
  },

  // === Keynes 凱因斯 ===
  {
    quote: '市場保持不理性的時間，可能比你保持有償付能力的時間還長。',
    author: KEYNES,
    tags: ['patience', 'risk'],
  },
  {
    quote: '當事實改變了，我也改變我的想法；你呢？',
    author: KEYNES,
    tags: ['humility', 'discipline'],
  },

  // === Arnott ===
  {
    quote: '在投資裡，舒服的時候通常代表錢已經賺完了。',
    author: ARNOTT,
    tags: ['caution', 'cycles'],
  },

  // === 孫子 老子 莊子 ===
  {
    quote: '兵者，詭道也。能而示之不能，用而示之不用。',
    author: SUNTZU,
    tags: ['discipline', 'risk'],
  },
  {
    quote: '勝兵先勝而後求戰，敗兵先戰而後求勝。',
    author: SUNTZU,
    tags: ['discipline', 'patience'],
  },
  { quote: '不戰而屈人之兵，善之善者也。', author: SUNTZU, tags: ['discipline'] },
  {
    quote: '故善戰者，立於不敗之地，而不失敵之敗也。',
    author: SUNTZU,
    tags: ['risk', 'discipline'],
  },
  { quote: '兵無常勢，水無常形。', author: SUNTZU, tags: ['cycles', 'humility'] },
  { quote: '知己知彼，百戰不殆。', author: SUNTZU, tags: ['discipline', 'humility'] },
  { quote: '上善若水，水善利萬物而不爭。', author: LAOZI, tags: ['patience', 'humility'] },
  { quote: '禍兮福之所倚，福兮禍之所伏。', author: LAOZI, tags: ['cycles', 'humility'] },
  { quote: '為學日益，為道日損。', author: LAOZI, tags: ['discipline', 'humility'] },
  {
    quote: '天下大事必作於細，天下難事必作於易。',
    author: LAOZI,
    tags: ['discipline', 'patience'],
  },
  { quote: '知人者智，自知者明。', author: LAOZI, tags: ['humility'] },
  {
    quote: '吾生也有涯，而知也無涯。以有涯隨無涯，殆已。',
    author: ZHUANGZI,
    tags: ['humility', 'discipline'],
  },

  // === 段永平 ===
  {
    quote: '投資的本質就是看商業模式，能不能持續賺錢。',
    author: DUANYP,
    tags: ['value', 'long-term'],
  },
  { quote: '本分、做對的事、把事情做對。', author: DUANYP, tags: ['discipline'] },
  { quote: '不懂不做。', author: DUANYP, tags: ['discipline', 'humility'] },
  {
    quote: '股票是用來買的，不是用來賣的。買對了，剩下都不用做。',
    author: DUANYP,
    tags: ['long-term', 'patience'],
  },
  {
    quote: '投資是用閒錢做的事，閒到可以等十年的那種。',
    author: DUANYP,
    tags: ['long-term', 'patience'],
  },

  // === 邱國鷺 ===
  { quote: '投資三大紀律：好行業、好公司、好價格。', author: QIUGL, tags: ['value', 'discipline'] },
  { quote: '估值的便宜，遠比聽起來的故事重要。', author: QIUGL, tags: ['value'] },
  {
    quote: '投資是少數人的遊戲，多數人輸是因為他們做了多數人會做的事。',
    author: QIUGL,
    tags: ['discipline', 'cycles'],
  },

  // === 但斌 ===
  { quote: '時間，是價值投資者最好的朋友。', author: DANBIN, tags: ['long-term', 'patience'] },
  {
    quote: '陪伴偉大企業成長，是最簡單也最難的事。',
    author: DANBIN,
    tags: ['long-term', 'patience'],
  },

  // === 張磊 高瓴 ===
  { quote: '弱水三千，只取一瓢飲。', author: ZHANGL, tags: ['discipline', 'patience'] },
  { quote: '長期持有，深度研究，與偉大公司同行。', author: ZHANGL, tags: ['long-term', 'value'] },
  { quote: '投資要選擇有非共識正確的方向。', author: ZHANGL, tags: ['value', 'discipline'] },

  // === 李嘉誠 王永慶 蔡明介 ===
  {
    quote: '寧願少賺，也不要賠錢；本金不在了，就什麼都沒了。',
    author: LIKS,
    tags: ['risk', 'caution'],
  },
  { quote: '90% 的時候在想風險，10% 的時候在想報酬。', author: LIKS, tags: ['risk', 'discipline'] },
  {
    quote: '富不過三代，是因為守不住，不是賺不到。',
    author: LIKS,
    tags: ['discipline', 'long-term'],
  },
  {
    quote: '經營之神不是賺最多的人，而是不會倒的人。',
    author: WANGYC,
    tags: ['risk', 'long-term'],
  },
  {
    quote: '一塊錢不是一塊錢，賺進口袋裡的一塊錢才是一塊錢。',
    author: WANGYC,
    tags: ['discipline', 'value'],
  },
  { quote: '能撐過冬天的人，才有資格享受春天。', author: WANGYC, tags: ['patience', 'cycles'] },
  { quote: '景氣循環走過去，剩下的就是真正的競爭力。', author: TSAIMK, tags: ['cycles', 'value'] },
  {
    quote: '在景氣最壞時，加倍研發；在景氣最好時，加倍儲糧。',
    author: TSAIMK,
    tags: ['cycles', 'discipline'],
  },

  // === Wall Street 諺語 / 市井智慧 ===
  {
    quote: 'Buy the rumor, sell the news. 利多兌現，常是行情盡頭。',
    author: STREET,
    tags: ['cycles', 'caution'],
  },
  {
    quote: 'Bulls make money, bears make money, pigs get slaughtered. 牛和熊都賺錢，貪心的豬被宰。',
    author: STREET,
    tags: ['discipline', 'caution'],
  },
  {
    quote: 'The trend is your friend, until it ends. 趨勢是朋友，但會結束。',
    author: STREET,
    tags: ['cycles', 'discipline'],
  },
  {
    quote: "Don't catch a falling knife. 別接落下的刀。",
    author: STREET,
    tags: ['caution', 'risk'],
  },
  {
    quote: 'Cut your losses short, let your profits run. 停損要快，獲利要讓它跑。',
    author: STREET,
    tags: ['discipline', 'risk'],
  },
  {
    quote:
      "When everyone is talking about a stock, it's often too late. 大家都在討論時，往往已經晚了。",
    author: STREET,
    tags: ['caution', 'cycles'],
  },
  {
    quote:
      'In a bear market, money returns to its rightful owners. 熊市裡，錢回到該擁有它的人手上。',
    author: STREET,
    tags: ['cycles', 'patience'],
  },
  {
    quote: 'Time in the market beats timing the market. 待在市場裡，勝過抓進場時機。',
    author: STREET,
    tags: ['long-term', 'patience'],
  },
  {
    quote:
      "It's not the market that beats traders, it's themselves. 打敗交易員的不是市場，是自己。",
    author: STREET,
    tags: ['discipline', 'humility'],
  },
  {
    quote:
      'Sell in May and go away — but watch where you walk back. 五月賣出 · 但回來時看清楚再進場。',
    author: STREET,
    tags: ['cycles', 'caution'],
  },
  {
    quote:
      'Markets can stay irrational longer than you can stay solvent. 市場保持不理性的時間，比你保持有錢的時間長。',
    author: STREET,
    tags: ['risk', 'patience'],
  },

  // === 補充 Buffett (twenty more from letters) ===
  {
    quote: '若你願意做別人不願意做的功課，就會獲得別人不會獲得的優勢。',
    author: BUFFETT,
    tags: ['discipline', 'value'],
  },
  {
    quote: '在企業裡，名譽要花二十年建立，五分鐘毀掉。',
    author: BUFFETT,
    tags: ['risk', 'discipline'],
  },
  { quote: '你不需要看每張球，等到甜蜜點。', author: BUFFETT, tags: ['patience', 'opportunity'] },
  {
    quote: '在投資中，最重要的特質不是智商，是性格。',
    author: BUFFETT,
    tags: ['discipline', 'humility'],
  },
  {
    quote: '若你能夠列出一檔股票該漲不該漲的理由，你才真的了解它。',
    author: BUFFETT,
    tags: ['discipline', 'value'],
  },
  {
    quote: '糟糕的天氣不會讓農夫離農，糟糕的市場不會讓投資人離市場。',
    author: BUFFETT,
    tags: ['cycles', 'patience'],
  },
  {
    quote: '一家偉大公司的特色是：你越想賣它，越會後悔。',
    author: BUFFETT,
    tags: ['long-term', 'patience'],
  },
  {
    quote: '你的時間成本，是被誤判加倍懲罰的成本。',
    author: BUFFETT,
    tags: ['discipline', 'long-term'],
  },
  {
    quote: '當你發現一個錯誤，第一件事是停下，第二件事是縮小，第三件事是更新觀點。',
    author: BUFFETT,
    tags: ['humility', 'discipline'],
  },
  { quote: '人都會犯錯，重點是別在錯的地方下大注。', author: BUFFETT, tags: ['risk', 'humility'] },

  // === 補充 Munger (more) ===
  {
    quote: '一個人若不會說「我不知道」，那他不夠格說自己懂投資。',
    author: MUNGER,
    tags: ['humility'],
  },
  { quote: '投資的反義不是賺錢，是失去本金。', author: MUNGER, tags: ['risk'] },
  {
    quote: '能成功的長期投資人，必有「適度的偏執」。',
    author: MUNGER,
    tags: ['discipline', 'risk'],
  },
  {
    quote: '在投資裡，你不需要做太多正確的事，重點是少做錯的事。',
    author: MUNGER,
    tags: ['discipline', 'risk'],
  },
  {
    quote: '聰明人若沒紀律，最終會比笨人賠更多。',
    author: MUNGER,
    tags: ['discipline', 'humility'],
  },
  { quote: '別跟你不尊敬的人合作，無論報酬多吸引。', author: MUNGER, tags: ['discipline'] },
  { quote: '會不會做選擇，決定你會不會賺到錢。', author: MUNGER, tags: ['discipline'] },

  // === 補充 Lynch ===
  {
    quote: '最大的虧損常來自於你以為很懂、其實不懂的東西。',
    author: LYNCH,
    tags: ['humility', 'risk'],
  },
  {
    quote: '在你買進前，先問自己：這家公司的優勢能維持十年嗎？',
    author: LYNCH,
    tags: ['long-term', 'value'],
  },
  { quote: '別把短線運氣當作長期能力。', author: LYNCH, tags: ['humility', 'discipline'] },
  { quote: '如果一檔股票讓你睡不好，部位太大了。', author: LYNCH, tags: ['risk', 'discipline'] },

  // === 補充 Marks ===
  {
    quote: '相同的事在景氣循環不同階段做，會有完全不同的結果。',
    author: MARKS,
    tags: ['cycles', 'discipline'],
  },
  {
    quote: '別人說對的事情通常已被定價。我們要找的是還沒被定價的事。',
    author: MARKS,
    tags: ['value', 'opportunity'],
  },
  { quote: '大膽不是無謀，謹慎不是膽小。', author: MARKS, tags: ['risk', 'discipline'] },

  // === 補充 Klarman ===
  { quote: '價值投資的本質，是準備好等市場犯錯。', author: KLARMAN, tags: ['patience', 'value'] },
  { quote: '錢不是用來追求最高報酬，而是用來避免最差結果。', author: KLARMAN, tags: ['risk'] },

  // === 補充 Soros ===
  {
    quote: '投資要做的是大方向對的事，而不是小細節都贏。',
    author: SOROS,
    tags: ['discipline', 'patience'],
  },

  // === 補充 Livermore ===
  { quote: '股市裡最賺錢的，不是天天交易的人。', author: LIVERMORE, tags: ['patience'] },
  {
    quote: '行情有它自己的節奏，不要逼它配合你。',
    author: LIVERMORE,
    tags: ['patience', 'discipline'],
  },

  // === 補充 Asian wisdom ===
  { quote: '小不忍則亂大謀。', author: '《論語》', tags: ['patience', 'discipline'] },
  { quote: '凡事豫則立，不豫則廢。', author: '《禮記·中庸》', tags: ['discipline', 'risk'] },
  { quote: '欲速則不達，見小利則大事不成。', author: '《論語》', tags: ['patience', 'discipline'] },
  { quote: '勿以惡小而為之，勿以善小而不為。', author: '劉備', tags: ['discipline'] },
  { quote: '治大國若烹小鮮。', author: LAOZI, tags: ['patience', 'discipline'] },
  { quote: '夫唯不爭，故天下莫能與之爭。', author: LAOZI, tags: ['patience', 'humility'] },
  { quote: '知止不殆，可以長久。', author: LAOZI, tags: ['discipline', 'long-term'] },
  { quote: '物極必反，盛極必衰。', author: '《易經》', tags: ['cycles', 'caution'] },

  // === 補充 Housel / 行為 ===
  {
    quote: '記住：你看到別人賺多少，看不到他承擔多少風險。',
    author: HOUSEL,
    tags: ['risk', 'humility'],
  },
  { quote: '錢的最高境界是「不用思考它」。', author: HOUSEL, tags: ['discipline', 'long-term'] },
  { quote: '保持遊戲在桌上，比每局都贏更重要。', author: HOUSEL, tags: ['risk', 'patience'] },

  // === 通用市井 ===
  { quote: '在投資裡，最貴的兩個字是：「我以為」。', author: STREET, tags: ['humility', 'risk'] },
  { quote: '別把希望當策略。', author: STREET, tags: ['discipline', 'risk'] },
  {
    quote: '加倍下注一個錯誤，不會把它變對。',
    author: STREET,
    tags: ['discipline', 'risk', 'drawdown'],
  },
  {
    quote: '在熊市裡學到的紀律，會在牛市裡保住你。',
    author: STREET,
    tags: ['cycles', 'discipline'],
  },
  {
    quote: '便宜的股票常常會更便宜，這是價值投資者必須面對的事實。',
    author: STREET,
    tags: ['value', 'patience'],
  },
  {
    quote: '行情的尖叫聲總是最大，理性的聲音總是最小。',
    author: STREET,
    tags: ['cycles', 'discipline'],
  },
  {
    quote: '股票漲，看起來都對；跌，才看得出誰真的對。',
    author: STREET,
    tags: ['cycles', 'humility'],
  },
  { quote: '不要把交易頻率當作努力的證明。', author: STREET, tags: ['discipline', 'patience'] },
  {
    quote: '盤整是市場最常見的狀態，等待是投資人最稀缺的能力。',
    author: STREET,
    tags: ['patience'],
  },
  {
    quote: '你越想證明自己對，越容易做出錯誤決定。',
    author: STREET,
    tags: ['humility', 'discipline'],
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
