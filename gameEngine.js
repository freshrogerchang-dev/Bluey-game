// 純邏輯：不碰 DOM 與 3D，方便用 node --test 測試。
// 每個遊戲都是「3 分鐘內能完成幾個」，動作回傳 { ok, event, hint } 讓畫面決定要播什麼動畫。

export const GAME_SECONDS = 180;

export const missions = [
  { id: "omelet", title: "香香蛋餅店", icon: "🍳", unit: "個蛋餅", summary: "拿餅皮、雞蛋、蔥花放進鍋子煎，3 分鐘煎幾個？" },
  { id: "dishes", title: "洗碗小幫手", icon: "🫧", unit: "個碗盤", summary: "把髒碗盤放進水槽刷一刷、沖乾淨、放上瀝水架。" },
  { id: "clean", title: "客廳整理隊", icon: "🧹", unit: "樣東西", summary: "把地上的玩具、衣服、垃圾送回正確的家。" },
  { id: "errand", title: "市場跑腿趣", icon: "🛒", unit: "張清單", summary: "照著購物清單拿東西，拿齊了去櫃台結帳。" },
  { id: "table", title: "擺餐桌", icon: "🥢", unit: "桌", summary: "照桌上的淡淡圖案，擺好盤子、碗、筷子和杯子。" },
  { id: "recycle", title: "資源回收站", icon: "♻️", unit: "樣東西", summary: "紙類、塑膠、鐵鋁罐、廚餘、一般垃圾，分對了才算！" },
  { id: "seek", title: "捉迷藏", icon: "🙈", unit: "次", summary: "妹妹躲起來了！點家具找找看她在哪裡。" },
  { id: "treasure", title: "後院尋寶", icon: "🗺️", unit: "個寶藏", summary: "看藏寶圖，到對的地方挖出寶藏。" }
];

// ---------- 共用 ----------

export function createClock(seconds = GAME_SECONDS) {
  return { total: seconds, left: seconds, over: false };
}

export function tickClock(clock, dt) {
  if (clock.over) return clock;
  clock.left = Math.max(0, clock.left - dt);
  if (clock.left === 0) clock.over = true;
  return clock;
}

export function formatTime(seconds) {
  const s = Math.ceil(Math.max(0, seconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

export function starsFor(score) {
  if (score >= 8) return 3;
  if (score >= 4) return 2;
  return score >= 1 ? 1 : 0;
}

export function bestScores(raw, missionId, score) {
  const table = raw && typeof raw === "object" && !Array.isArray(raw) ? { ...raw } : {};
  table[missionId] = Math.max(Number(table[missionId]) || 0, score);
  return table;
}

function shuffle(list, rand) {
  const copy = [...list];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

// ---------- 蛋餅：餅皮 → 雞蛋 → 蔥花，煎熟一面翻面，再煎熟起鍋 ----------

export const OMELET_RECIPE = ["wrap", "egg", "scallion"];
export const OMELET_NAMES = { wrap: "餅皮", egg: "雞蛋", scallion: "蔥花" };
export const COOK_SECONDS = 4;
// 熟了以後再放這麼久會燒焦
export const BURN_SECONDS = 6;

export function createOmelet() {
  return { score: 0, holding: null, pan: [], side: 0, cook: 0, burnt: false };
}

export function omeletNext(state) {
  return OMELET_RECIPE[state.pan.length] ?? null;
}

export function omeletStatus(state) {
  if (state.pan.length < OMELET_RECIPE.length) return "filling";
  if (state.burnt) return "burnt";
  return state.cook >= COOK_SECONDS ? (state.side === 1 ? "flip" : "serve") : "cooking";
}

export function omeletPick(state, ingredient) {
  if (!OMELET_RECIPE.includes(ingredient)) return { ok: false, hint: "這個不是蛋餅的材料喔。" };
  state.holding = ingredient;
  return { ok: true, event: "pick" };
}

export function omeletUsePan(state) {
  const status = omeletStatus(state);
  if (status === "filling") {
    const need = omeletNext(state);
    if (!state.holding) return { ok: false, hint: `先去拿${OMELET_NAMES[need]}。` };
    if (state.holding !== need) return { ok: false, hint: `順序不對喔，現在要放${OMELET_NAMES[need]}。` };
    state.pan.push(state.holding);
    state.holding = null;
    if (state.pan.length === OMELET_RECIPE.length) { state.side = 1; state.cook = 0; }
    return { ok: true, event: "add" };
  }
  if (status === "cooking") return { ok: false, hint: "還在煎，等它變金黃色。" };
  if (status === "flip") { state.side = 2; state.cook = 0; return { ok: true, event: "flip" }; }
  const burnt = status === "burnt";
  if (!burnt) state.score += 1;
  Object.assign(state, { pan: [], side: 0, cook: 0, burnt: false });
  return burnt ? { ok: true, event: "toss", hint: "煎太久焦掉了，下一個早點翻面。" } : { ok: true, event: "serve" };
}

export function omeletTick(state, dt) {
  if (state.side === 0 || state.burnt) return state;
  state.cook += dt;
  if (state.cook >= COOK_SECONDS + BURN_SECONDS) state.burnt = true;
  return state;
}

// ---------- 洗碗：髒碗盤 → 水槽 → 刷 4 下 → 沖水 → 瀝水架 ----------

export const SCRUBS_NEEDED = 4;

export function createDishes() {
  return { score: 0, holding: false, sink: null };
}

export function dishesStatus(state) {
  if (!state.sink) return state.holding ? "carry" : "empty";
  if (state.sink.scrubs < SCRUBS_NEEDED) return "scrub";
  return state.sink.rinsed ? "done" : "rinse";
}

export function dishesPickDirty(state) {
  if (state.holding) return { ok: false, hint: "手上已經有碗盤了，放進水槽吧。" };
  if (state.sink) return { ok: false, hint: "先把水槽裡的洗好。" };
  state.holding = true;
  return { ok: true, event: "pick" };
}

export function dishesUseSink(state) {
  const status = dishesStatus(state);
  if (status === "empty") return { ok: false, hint: "先去拿一個髒碗盤。" };
  if (status === "carry") { state.holding = false; state.sink = { scrubs: 0, rinsed: false }; return { ok: true, event: "place" }; }
  if (status === "scrub") { state.sink.scrubs += 1; return { ok: true, event: "scrub" }; }
  if (status === "rinse") return { ok: false, hint: "刷乾淨了，按水龍頭沖掉泡泡。" };
  return { ok: false, hint: "洗好了，放到瀝水架上。" };
}

export function dishesRinse(state) {
  const status = dishesStatus(state);
  if (status === "scrub") return { ok: false, hint: "還有髒髒的地方，再刷一刷。" };
  if (status !== "rinse") return { ok: false, hint: "水槽裡還沒有要沖的碗盤。" };
  state.sink.rinsed = true;
  return { ok: true, event: "rinse" };
}

export function dishesUseRack(state) {
  if (dishesStatus(state) !== "done") return { ok: false, hint: "要先洗乾淨、沖好水才能放上來。" };
  state.sink = null;
  state.score += 1;
  return { ok: true, event: "rack" };
}

// ---------- 分類（客廳、資源回收）：撿起東西，放進正確的箱子 ----------

export const CLEAN_BINS = { toybox: "玩具箱", laundry: "洗衣籃", trash: "垃圾桶" };
export const CLEAN_ITEMS = [
  { kind: "block", name: "積木", bin: "toybox" },
  { kind: "ball", name: "皮球", bin: "toybox" },
  { kind: "car", name: "玩具車", bin: "toybox" },
  { kind: "sock", name: "襪子", bin: "laundry" },
  { kind: "shirt", name: "衣服", bin: "laundry" },
  { kind: "paper", name: "紙團", bin: "trash" },
  { kind: "peel", name: "香蕉皮", bin: "trash" }
];
export const FLOOR_SIZE = 6;

export function createClean(rand = Math.random, { items = CLEAN_ITEMS, bins = CLEAN_BINS, floorSize = FLOOR_SIZE } = {}) {
  const state = { score: 0, holding: null, floor: [], nextId: 1, rand, items, bins };
  while (state.floor.length < floorSize) spawnMess(state);
  return state;
}

function spawnMess(state) {
  const item = state.items[Math.floor(state.rand() * state.items.length)];
  const mess = { id: state.nextId++, ...item };
  state.floor.push(mess);
  return mess;
}

export function cleanPick(state, id) {
  if (state.holding) return { ok: false, hint: `先把${state.holding.name}放好。` };
  const index = state.floor.findIndex(item => item.id === id);
  if (index < 0) return { ok: false };
  [state.holding] = state.floor.splice(index, 1);
  return { ok: true, event: "pick", item: state.holding };
}

export function cleanDrop(state, bin) {
  if (!state.holding) return { ok: false, hint: "先撿起地上的東西。" };
  if (state.holding.bin !== bin) return { ok: false, hint: `${state.holding.name}不是放${state.bins[bin]}喔。` };
  const item = state.holding;
  state.holding = null;
  state.score += 1;
  return { ok: true, event: "drop", item, spawned: spawnMess(state) };
}

// ---------- 市場：照清單拿 3 樣，去櫃台結帳 ----------

export const SHOP_ITEMS = { egg: "雞蛋", scallion: "青蔥", milk: "牛奶", apple: "蘋果", bread: "麵包", carrot: "紅蘿蔔" };
export const LIST_SIZE = 3;

export function createErrand(rand = Math.random) {
  return { score: 0, list: newList(rand), basket: [], rand };
}

function newList(rand) {
  return shuffle(Object.keys(SHOP_ITEMS), rand).slice(0, LIST_SIZE);
}

export function errandTake(state, item) {
  if (!state.list.includes(item)) return { ok: false, hint: `清單上沒有${SHOP_ITEMS[item]}喔。` };
  if (state.basket.includes(item)) return { ok: false, hint: `${SHOP_ITEMS[item]}已經拿過了。` };
  state.basket.push(item);
  return { ok: true, event: "take", ready: state.basket.length === state.list.length };
}

export function errandCheckout(state) {
  const missing = state.list.filter(item => !state.basket.includes(item));
  if (missing.length) return { ok: false, hint: `還差${missing.map(item => SHOP_ITEMS[item]).join("、")}。` };
  state.score += 1;
  state.basket = [];
  state.list = newList(state.rand);
  return { ok: true, event: "checkout" };
}

// ---------- 資源回收（用上面的分類規則） ----------

export const RECYCLE_BINS = { paper: "紙類", plastic: "塑膠類", metal: "鐵鋁罐", food: "廚餘", trash: "一般垃圾" };
export const RECYCLE_ITEMS = [
  { kind: "newspaper", name: "舊報紙", bin: "paper" },
  { kind: "carton", name: "紙盒", bin: "paper" },
  { kind: "bottle", name: "寶特瓶", bin: "plastic" },
  { kind: "cup", name: "塑膠杯", bin: "plastic" },
  { kind: "can", name: "鋁罐", bin: "metal" },
  { kind: "tin", name: "鐵罐頭", bin: "metal" },
  { kind: "peel", name: "香蕉皮", bin: "food" },
  { kind: "core", name: "蘋果核", bin: "food" },
  { kind: "tissue", name: "用過的衛生紙", bin: "trash" },
  { kind: "diaper", name: "髒尿布", bin: "trash" }
];

export function createRecycle(rand = Math.random) {
  return createClean(rand, { items: RECYCLE_ITEMS, bins: RECYCLE_BINS, floorSize: 4 });
}

// ---------- 擺餐桌：照每個位子的淡淡圖案擺好餐具 ----------

export const TABLE_ITEMS = { plate: "盤子", bowl: "碗", chopsticks: "筷子", cup: "杯子" };
export const SEATS = 2;

function newTable(rand) {
  // 每個位子一定有盤子，再加兩樣
  return Array.from({ length: SEATS }, () => ({
    needs: ["plate", ...shuffle(["bowl", "chopsticks", "cup"], rand).slice(0, 2)],
    placed: []
  }));
}

export function createTable(rand = Math.random) {
  return { score: 0, holding: null, seats: newTable(rand), rand };
}

export function tableMissing(state) {
  return state.seats.flatMap((seat, index) => seat.needs.filter(item => !seat.placed.includes(item)).map(item => ({ seat: index, item })));
}

export function tablePick(state, item) {
  if (!TABLE_ITEMS[item]) return { ok: false };
  state.holding = item;
  return { ok: true, event: "pick" };
}

export function tablePlace(state, seatIndex) {
  const seat = state.seats[seatIndex];
  if (!seat) return { ok: false };
  if (!state.holding) return { ok: false, hint: "先去櫃子拿餐具。" };
  const name = TABLE_ITEMS[state.holding];
  if (!seat.needs.includes(state.holding)) return { ok: false, hint: `這個位子不用${name}喔，看看淡淡的圖案。` };
  if (seat.placed.includes(state.holding)) return { ok: false, hint: `這裡已經有${name}了。` };
  const item = state.holding;
  seat.placed.push(item);
  state.holding = null;
  if (tableMissing(state).length) return { ok: true, event: "place", item };
  state.score += 1;
  state.seats = newTable(state.rand);
  return { ok: true, event: "table", item };
}

// ---------- 找地點（捉迷藏、尋寶）：目標在其中一個地點，點對了才算 ----------

export function createSearch(spots, rand = Math.random) {
  const state = { score: 0, spots, target: -1, misses: 0, rand };
  moveTarget(state);
  return state;
}

function moveTarget(state) {
  const choices = [...Array(state.spots).keys()].filter(index => index !== state.target);
  state.target = choices[Math.floor(state.rand() * choices.length)];
  state.misses = 0;
}

export function searchLook(state, index) {
  if (index !== state.target) {
    state.misses += 1;
    return { ok: false, event: "miss", misses: state.misses };
  }
  state.score += 1;
  moveTarget(state);
  return { ok: true, event: "found", at: index };
}
