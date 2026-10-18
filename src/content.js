// 子ども向けの説明（星座・星・ならび・惑星・月・まめちしき）
const SEASON_NAME = { spring: '春', summer: '夏', autumn: '秋', winter: '冬', all: '一年中' };

// 星座（教科書でよく出る20）
const CONS = [
  { id: 'Lyr', name: 'こと座', yomi: 'ことざ', season: 'summer', main: 91262, story: 'たてごとの名人オルフェウスのたてごと。1等星ベガは、七夕のおりひめ星です。' },
  { id: 'Aql', name: 'わし座', yomi: 'わしざ', season: 'summer', main: 97649, story: '神さまゼウスのつかいの、大きなわし。1等星アルタイルは、七夕のひこ星です。' },
  { id: 'Cyg', name: 'はくちょう座', yomi: 'はくちょうざ', season: 'summer', main: 102098, story: '天の川の上を、つばさを広げてとぶ白鳥。十字の形なので「北十字」ともよばれます。' },
  { id: 'Sco', name: 'さそり座', yomi: 'さそりざ', season: 'summer', main: 80763, story: 'オリオンをさしたさそり。だからオリオンは、さそりがのぼると西へにげてしずむ、というお話があります。赤い1等星アンタレスは、さそりの心ぞう。' },
  { id: 'Sgr', name: 'いて座', yomi: 'いてざ', season: 'summer', main: null, story: '弓をかまえる、半分人で半分馬のケンタウロス。6つの星が、ひしゃくの形の「南斗六星（なんとろくせい）」になっています。' },
  { id: 'Ori', name: 'オリオン座', yomi: 'おりおんざ', season: 'winter', main: 24436, story: 'りょうしのオリオン。まん中に3つならんだ星（三つ星）が目じるし。赤いベテルギウスと青白いリゲル、色のちがいがよくわかります。' },
  { id: 'CMa', name: 'おおいぬ座', yomi: 'おおいぬざ', season: 'winter', main: 32349, story: 'オリオンがつれている大きな犬。シリウスは、星座をつくる星の中でいちばん明るい星です。' },
  { id: 'CMi', name: 'こいぬ座', yomi: 'こいぬざ', season: 'winter', main: 37279, story: 'オリオンのもう1ぴきの犬。明るい星が2つだけの、小さな星座です。' },
  { id: 'Gem', name: 'ふたご座', yomi: 'ふたござ', season: 'winter', main: 37826, story: 'なかよしのふたごの兄弟、カストルとポルックス。2つの明るい星が、ならんで光ります。' },
  { id: 'Tau', name: 'おうし座', yomi: 'おうしざ', season: 'winter', main: 21421, story: '神さまゼウスが白い牛にすがたをかえたもの。牛の目はオレンジ色のアルデバラン。かたのあたりに「すばる」があります。' },
  { id: 'Aur', name: 'ぎょしゃ座', yomi: 'ぎょしゃざ', season: 'winter', main: 24608, story: '馬車に乗る人の星座。やぎをだいている姿です。黄色っぽい1等星カペラは「小さなめすのやぎ」という意味。' },
  { id: 'UMa', name: 'おおぐま座', yomi: 'おおぐまざ', season: 'spring', main: null, story: '大きなくま。しっぽとこしの7つの星が「北斗七星」です。ひしゃくの形をしています。' },
  { id: 'UMi', name: 'こぐま座', yomi: 'こぐまざ', season: 'all', main: 11767, story: '小さなくま。しっぽの先が北極星です。北の空で、ほとんど動きません。' },
  { id: 'Leo', name: 'しし座', yomi: 'ししざ', season: 'spring', main: 49669, story: '勇者ヘラクレスとたたかったライオン。頭の星が「？」を反対にした形にならんでいます。' },
  { id: 'Vir', name: 'おとめ座', yomi: 'おとめざ', season: 'spring', main: 65474, story: '麦のほを持つ女神。青白い1等星スピカは「麦のほ」という意味です。' },
  { id: 'Boo', name: 'うしかい座', yomi: 'うしかいざ', season: 'spring', main: 69673, story: '北斗七星のくまを見はる人。オレンジ色のアークトゥルスが、ネクタイのような形の先で光ります。' },
  { id: 'Cas', name: 'カシオペヤ座', yomi: 'かしおぺやざ', season: 'autumn', main: null, story: 'エチオピアのおきさき、カシオペヤ。5つの星がWの形。北極星をさがす目じるしになります。' },
  { id: 'Peg', name: 'ペガスス座', yomi: 'ぺがすすざ', season: 'autumn', main: null, story: 'つばさのある天の馬。大きな四角形「秋の四辺形」が目じるしです。' },
  { id: 'And', name: 'アンドロメダ座', yomi: 'あんどろめだざ', season: 'autumn', main: null, story: 'カシオペヤのむすめのおひめさま。勇者ペルセウスに助けられたお話があります。' },
  { id: 'Per', name: 'ペルセウス座', yomi: 'ぺるせうすざ', season: 'autumn', main: null, story: 'かいぶつメドゥーサをたおした勇者。アンドロメダひめを助けました。' }
];

// 名前のある星
const STARS = [
  { hip: 91262, name: 'ベガ', yomi: 'べが', con: 'Lyr', color: '白', season: 'summer', note: '夏の大三角の1つ。七夕のおりひめ星（しょくじょ星）。' },
  { hip: 97649, name: 'アルタイル', yomi: 'あるたいる', con: 'Aql', color: '白', season: 'summer', note: '夏の大三角の1つ。七夕のひこ星（けんぎゅう星）。' },
  { hip: 102098, name: 'デネブ', yomi: 'でねぶ', con: 'Cyg', color: '白', season: 'summer', note: '夏の大三角の1つ。白鳥のしっぽで光ります。' },
  { hip: 80763, name: 'アンタレス', yomi: 'あんたれす', con: 'Sco', color: '赤', season: 'summer', note: '赤い星の代表。夏、南の低い空で光ります。' },
  { hip: 27989, name: 'ベテルギウス', yomi: 'べてるぎうす', con: 'Ori', color: '赤', season: 'winter', note: '冬の大三角の1つ。赤い星。オリオンのかたで光ります。' },
  { hip: 24436, name: 'リゲル', yomi: 'りげる', con: 'Ori', color: '青白', season: 'winter', note: '青白い星。オリオンの足もとで光ります。' },
  { hip: 32349, name: 'シリウス', yomi: 'しりうす', con: 'CMa', color: '白', season: 'winter', note: '冬の大三角の1つ。星座をつくる星の中で、いちばん明るい星。' },
  { hip: 37279, name: 'プロキオン', yomi: 'ぷろきおん', con: 'CMi', color: 'うすい黄', season: 'winter', note: '冬の大三角の1つ。' },
  { hip: 11767, name: '北極星', yomi: 'ほっきょくせい ぽらりす', con: 'UMi', color: 'うすい黄', season: 'all', note: '2等星。真北の空にあり、時間がたってもほとんど動きません。北の方角を知る目じるしです。' },
  { hip: 69673, name: 'アークトゥルス', yomi: 'あーくとぅるす', con: 'Boo', color: 'オレンジ', season: 'spring', note: '春の大三角の1つ。オレンジ色の明るい星。' },
  { hip: 65474, name: 'スピカ', yomi: 'すぴか', con: 'Vir', color: '青白', season: 'spring', note: '春の大三角の1つ。青白い星。' },
  { hip: 49669, name: 'レグルス', yomi: 'れぐるす', con: 'Leo', color: '青白', season: 'spring', note: 'ライオンの心ぞうの星。' },
  { hip: 57632, name: 'デネボラ', yomi: 'でねぼら', con: 'Leo', color: '白', season: 'spring', note: '2等星。春の大三角の1つ。ライオンのしっぽ。' },
  { hip: 24608, name: 'カペラ', yomi: 'かぺら', con: 'Aur', color: '黄', season: 'winter', note: '黄色っぽい明るい星。冬、頭の上の高い空で光ります。' },
  { hip: 21421, name: 'アルデバラン', yomi: 'あるでばらん', con: 'Tau', color: 'オレンジ', season: 'winter', note: 'オレンジ色の星。おうしの目のところで光ります。' },
  { hip: 37826, name: 'ポルックス', yomi: 'ぽるっくす', con: 'Gem', color: 'オレンジ', season: 'winter', note: 'ふたごの弟。オレンジ色の1等星。' },
  { hip: 36850, name: 'カストル', yomi: 'かすとる', con: 'Gem', color: '白', season: 'winter', note: 'ふたごの兄。2等星。' },
  { hip: 17702, name: 'すばる', yomi: 'すばる ぷれあです', con: 'Tau', color: '青白', season: 'winter', note: 'たくさんの星が集まった「星団」。目で見ると6〜7こ見えます。むかしの日本の本にも出てくる、昔から親しまれた星です。', cluster: true }
];

// 星のならび
const ASTERISMS = [
  { id: 'summer3', name: '夏の大三角', yomi: 'なつのだいさんかく', season: 'summer', stars: [91262, 102098, 97649, 91262], note: 'ベガ・デネブ・アルタイルをむすんだ大きな三角形。夏の夜、頭の上の高い空に見えます。' },
  { id: 'winter3', name: '冬の大三角', yomi: 'ふゆのだいさんかく', season: 'winter', stars: [27989, 37279, 32349, 27989], note: 'ベテルギウス・プロキオン・シリウスをむすんだ三角形。冬の夜、南の空に見えます。' },
  { id: 'spring3', name: '春の大三角', yomi: 'はるのだいさんかく', season: 'spring', stars: [69673, 57632, 65474, 69673], note: 'アークトゥルス・デネボラ・スピカをむすんだ三角形。' },
  { id: 'autumn4', name: '秋の四辺形', yomi: 'あきのしへんけい', season: 'autumn', stars: [113963, 113881, 677, 1067, 113963], note: 'ペガスス座の大きな四角形。秋の夜、頭の上近くに見えます。' },
  { id: 'hokuto', name: '北斗七星', yomi: 'ほくとしちせい', season: 'spring', stars: [54061, 53910, 58001, 59774, 62956, 65378, 67301], note: 'ひしゃくの形の7つの星。ひしゃくの先の2つの星を5倍のばすと北極星があります。' }
];

const PLANETS = [
  { id: 'mercury', name: '水星', yomi: 'すいせい', color: '#d9cbb0', size: 9, note: '太陽にいちばん近い惑星（わくせい）。太陽のそばにいるので、夕方か明け方の低い空でしか見られません。' },
  { id: 'venus', name: '金星', yomi: 'きんせい よいのみょうじょう あけのみょうじょう', color: '#fff6d8', size: 15, note: 'いちばん明るく見える惑星。夕方の西の空なら「よいの明星」、明け方の東の空なら「明けの明星」。' },
  { id: 'mars', name: '火星', yomi: 'かせい', color: '#ff8a5c', size: 11, note: '赤っぽく見える惑星。地球のすぐ外側をまわっています。' },
  { id: 'jupiter', name: '木星', yomi: 'もくせい', color: '#ffe7b8', size: 14, note: '太陽系でいちばん大きな惑星。とても明るく見えます。' },
  { id: 'saturn', name: '土星', yomi: 'どせい', color: '#f3d98c', size: 11, note: 'わ（リング）のある惑星。望遠鏡で見ると、わが見えます。' }
];

const TIPS = [
  { id: 'tip-mag', name: '星の明るさ', yomi: 'ほしのあかるさ とうせい', note: '星の明るさは「1等星」「2等星」…とあらわします。数が小さいほど明るい星です。1等星は2等星よりおよそ2.5倍明るく見えます。' },
  { id: 'tip-color', name: '星の色', yomi: 'ほしのいろ', note: '星には、赤・オレンジ・黄・白・青白などの色があります。赤い星はアンタレスやベテルギウス、青白い星はリゲルやスピカ。' },
  { id: 'tip-move', name: '星の動き', yomi: 'ほしのうごき', note: '星は、時間がたつと東から出て、南の高い空を通り、西へしずみます。星のならび方（形）はかわりません。「じかん」で▶をおして見てみよう。', action: 'south' },
  { id: 'tip-north', name: '北の空の星の動き', yomi: 'きたのそらのほしのうごき', note: '北の空の星は、北極星を中心に、時計のはりと反対の向きにまわります。北極星はほとんど動きません。', action: 'north' },
  { id: 'tip-planet', name: '惑星ってなに？', yomi: 'わくせいってなに', note: '惑星（わくせい）は、太陽のまわりをまわる星。自分では光らず、太陽の光をはね返して光ります。星座の中を少しずつ動いていくので「まどう星」と書きます。' },
  { id: 'tip-fist', name: '高さのはかり方', yomi: 'たかさのはかりかた にぎりこぶし', note: 'うでをまっすぐのばして、にぎりこぶし1こ分がおよそ10°。地平線から何こ分かで、星の高さがわかります。' }
];

// 解説の動画（公的な機関・科学館・教育委員会のYouTube。2026-10-18 に1本ずつ開けることを確かめた）
const VIDEO_LIST = {"tanabata": ["sarYMXuemj0", "七夕のおはなし", "さいたま市青少年宇宙科学館", "4分"], "natsu1": ["Gw0U9JaQrC4", "星座とギリシャ神話の世界 夏 part1", "那須塩原市", "7分"], "natsu2": ["YdcZuH1EdV8", "星座とギリシャ神話の世界 夏 part2", "那須塩原市", "8分"], "naoj7": ["t1mBYYLbTrg", "七夕の星をさがそう", "国立天文台", "2分"], "sasori": ["RP6kXcCShds", "さそり座といて座", "柏崎市立博物館", "7分"], "sasori2": ["PkmMiI72jfQ", "さそり座と天の川を見つけよう", "佐賀県立宇宙科学館", "5分"], "fuyu2": ["3-MMO_hGSOM", "星座とギリシャ神話の世界 冬 part2", "那須塩原市", "7分"], "orion": ["IFMW_JfuosE", "オリオン座を見つけよう", "佐賀県立宇宙科学館", "4分"], "fuyuyozora": ["-mkE5fv8cA8", "冬の夜空の物語", "旭川市科学館", "14分"], "oushi": ["emAKvbbrKAU", "おうし座とふたご座", "柏崎市立博物館", "5分"], "subaru": ["OvWl_MSbvpw", "おうし座、すばるを見つけよう", "佐賀県立宇宙科学館", "4分"], "diamond": ["eoVlCkGVYMY", "冬のダイヤモンドを見つけよう", "佐賀県立宇宙科学館", "6分"], "kuma": ["_-quXshjl-o", "おおぐま座とこぐま座", "柏崎市立博物館", "5分"], "hokuto": ["ddU0-YLfzj0", "北斗七星と北極星を見つけよう", "佐賀県立宇宙科学館", "5分"], "hokuto2": ["VSuO-PNo_i8", "北斗七星と北極星", "富山市科学博物館", "5分"], "shishi": ["hAIlAZPVI-8", "かに座としし座", "柏崎市立博物館", "6分"], "shishi2": ["SepR17HixVY", "しし座を見つけよう", "佐賀県立宇宙科学館", "6分"], "otome": ["M9dEAZdIAzc", "おとめ座のおはなし", "富山市科学博物館", "5分"], "ushikai": ["WAvwgL-Szlg", "うしかい座", "福岡市科学館", "3分"], "haru1": ["qquBC0Szfp8", "星座とギリシャ神話の世界 春 part1", "那須塩原市", "7分"], "cassio": ["VxgijPBwuBk", "カシオペヤ座を見つけよう", "佐賀県立宇宙科学館", "4分"], "aki2": ["UoD2Cmmn4a0", "ギリシャ神話と星座の世界 秋 part2", "那須塩原市", "7分"], "ouke": ["yaAQh77z98Q", "古代エチオピア王家の星座を見つけよう", "佐賀県立宇宙科学館", "7分"], "natsu3": ["Vty0b0eSe_g", "夏の大三角を見つけよう", "佐賀県立宇宙科学館", "6分"], "haru3": ["8MiZHv87VsM", "春の大三角", "石川県柳田星の観察館「満天星」", "4分"], "aki4": ["P59Oo7C3Q9I", "秋の四辺形と秋の一つ星を見つけよう", "佐賀県立宇宙科学館", "6分"], "irokaru2": ["LnQx8FgxuBM", "小4理科 星の明るさや色②", "福岡市教育委員会", "3分"], "irokaru3": ["82a6bu-FP8k", "小4理科 星の明るさや色③", "福岡市教育委員会", "2分"], "ichi1": ["KdiawRiKT5Y", "小4理科 月と星の位置の変化①", "福岡市教育委員会", "3分"], "ugoki": ["QTtxPlA3g1s", "星の動き", "多摩六都科学館", "3分"], "tsuki1": ["FPbg4xlU67w", "小6理科 月と太陽①", "福岡市教育委員会", "3分"], "tsuki2": ["LZnvZZUkpGU", "小6理科 月と太陽②", "福岡市教育委員会", "3分"]};
const VIDEOS = {"Lyr": ["tanabata", "natsu1"], "Aql": ["tanabata", "natsu1"], "Cyg": ["natsu1"], "Sco": ["sasori", "sasori2"], "Sgr": ["sasori", "natsu2"], "Ori": ["fuyu2", "orion"], "CMa": ["fuyuyozora"], "CMi": ["fuyuyozora"], "Gem": ["oushi"], "Tau": ["oushi", "subaru"], "Aur": ["diamond"], "UMa": ["kuma", "hokuto"], "UMi": ["kuma", "hokuto2"], "Leo": ["shishi", "shishi2"], "Vir": ["otome", "haru1"], "Boo": ["ushikai", "haru1"], "Cas": ["cassio", "aki2"], "Peg": ["aki2", "ouke"], "And": ["aki2", "ouke"], "Per": ["aki2", "ouke"], "summer3": ["natsu3"], "winter3": ["fuyuyozora", "diamond"], "spring3": ["haru3"], "autumn4": ["aki4"], "hokuto": ["hokuto", "hokuto2"], "s91262": ["tanabata", "naoj7"], "s97649": ["tanabata", "naoj7"], "s11767": ["hokuto2", "kuma"], "s17702": ["subaru"], "tip-mag": ["irokaru2", "irokaru3"], "tip-color": ["irokaru2", "irokaru3"], "tip-move": ["ichi1", "ugoki"], "tip-north": ["hokuto2"], "moon": ["tsuki1", "tsuki2"]};
