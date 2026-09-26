export const missions = [
  {
    id: "dishes", title: "洗碗小幫手", icon: "🫧", summary: "把餐具洗乾淨、放回瀝水架。",
    steps: [
      step("先整理餐桌", "吃完蛋餅，第一步要做什麼？", "把剩菜倒進廚餘桶", [item("廚餘桶", "🗑️", true), item("直接沖水", "🚿"), item("藏在盤子下", "🙈")]),
      step("加一點清潔劑", "哪一個是洗碗要用的？", "洗碗精", [item("洗碗精", "🧴", true), item("果汁", "🧃"), item("洗髮精", "🧼")]),
      step("刷刷碗盤", "用什麼把油污刷乾淨？", "海綿", [item("海綿", "🟨", true), item("鉛筆", "✏️"), item("襪子", "🧦")]),
      step("沖掉泡泡", "把泡泡沖乾淨後，盤子要放哪裡？", "瀝水架", [item("瀝水架", "🍽️", true), item("地板", "🟫"), item("椅子", "🪑")])
    ]
  },
  {
    id: "clean", title: "客廳整理隊", icon: "🧹", summary: "分類、擦拭，再把地板掃乾淨。",
    steps: [
      step("玩具回家", "積木玩完了，要放去哪裡？", "玩具箱", [item("玩具箱", "🧸", true), item("沙發底下", "🛋️"), item("門口", "🚪")]),
      step("衣服分類", "地上的髒襪子要去哪裡？", "洗衣籃", [item("洗衣籃", "🧺", true), item("書架", "📚"), item("冰箱", "🧊")]),
      step("擦擦桌面", "桌上有灰塵，選一個安全工具。", "抹布", [item("抹布", "🟦", true), item("剪刀", "✂️"), item("油漆", "🪣")]),
      step("最後掃地", "要往哪裡掃，才容易收起來？", "集中成一小堆", [item("集中成一小堆", "🧹", true), item("掃到床底", "🛏️"), item("往空中揮", "💨")])
    ]
  },
  {
    id: "errand", title: "市場跑腿趣", icon: "🛒", summary: "看清單買東西，也記得交通安全。",
    steps: [
      step("出門前", "要先帶上哪一樣？", "購物清單", [item("購物清單", "📝", true), item("大枕頭", "🛏️"), item("遙控器", "📺")]),
      step("安全過馬路", "綠燈亮了，還要做什麼？", "左右看，和大人一起走", [item("左右看，和大人一起走", "🚦", true), item("閉眼快跑", "🏃"), item("邊走邊玩", "🎮")]),
      step("照清單選", "今天要做蛋餅，清單上有雞蛋。選哪個？", "雞蛋", [item("雞蛋", "🥚", true), item("冰淇淋", "🍦"), item("糖果", "🍬")]),
      step("有禮貌結帳", "店員把東西交給你，可以說什麼？", "謝謝", [item("謝謝", "😊", true), item("快一點", "😠"), item("不說話搶走", "💨")])
    ]
  },
  {
    id: "omelet", title: "香香蛋餅店", icon: "🍳", summary: "洗手、備料，和大人一起做蛋餅。",
    steps: [
      step("料理前準備", "碰食物以前，要先做什麼？", "用肥皂洗手", [item("用肥皂洗手", "🧼", true), item("只吹一吹", "💨"), item("先玩玩具", "🧸")]),
      step("準備蛋液", "雞蛋要在哪裡打開比較好？", "打進碗裡", [item("打進碗裡", "🥣", true), item("打在桌上", "🪵"), item("放進口袋", "👖")]),
      step("下鍋加熱", "平底鍋很燙，誰來開火？", "請大人幫忙", [item("請大人幫忙", "🧑‍🍳", true), item("自己偷偷開", "🔥"), item("用手摸鍋子", "✋")]),
      step("完成蛋餅", "蛋餅煎好後，先怎麼做？", "放涼一點再吃", [item("放涼一點再吃", "🍽️", true), item("直接用手抓", "🔥"), item("丟高高", "🤹")])
    ]
  }
];

function item(label, emoji, correct = false) { return { label, emoji, correct }; }
function step(title, prompt, answer, choices) { return { title, prompt, answer, choices }; }
export function isCorrect(stepData, choiceIndex) { return Boolean(stepData?.choices?.[choiceIndex]?.correct); }
export function nextStep(current, total) { return Math.min(current + 1, total); }
export function completionSet(raw, missionId) { return [...new Set([...(Array.isArray(raw) ? raw : []), missionId])]; }
