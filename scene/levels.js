// 四個 3D 關卡。每個關卡回傳 { intro, update(dt), score() }，規則都在 gameEngine.js。
import { THREE, Stage, createPup, createHints, room, box, cyl, ball, at, group, label, hitBox, mat } from "./stage.js";
import * as g from "../gameEngine.js";

const V = (x, y, z) => new THREE.Vector3(x, y, z);

function counter(width, color = "#e9d3ad", top = "#ffffff") {
  return group(at(box(width, 1.3, 1.4, color), 0, 0.65, 0), at(box(width + 0.1, 0.12, 1.5, top), 0, 1.36, 0));
}

// 桌上物件前方、小狗要站的位置
const standBefore = (x, z) => [x, z + 1.35];

// ---------------- 蛋餅 ----------------

function omeletMesh(kind) {
  if (kind === "wrap") return cyl(0.55, 0.55, 0.06, "#f3d9a4", 28);
  if (kind === "egg") return group(at(ball(0.22, "#fff6e8"), 0, 0.2, 0));
  const pile = group();
  for (let i = 0; i < 6; i++) pile.add(at(cyl(0.05, 0.05, 0.18, "#4caf50", 8), (i % 3 - 1) * 0.12, 0.09, Math.floor(i / 3) * 0.14 - 0.07));
  return pile;
}

export function buildOmelet(container, ui) {
  const stage = new Stage(container, { cameraPos: [0, 10.5, 5], lookAt: [0, 0.8, -2.3], background: "#ffe1d6" });
  room(stage, { floor: "#f7e3c4", wall: "#ffece4" });
  const state = g.createOmelet();
  const pup = createPup(stage);
  at(pup, 0, 0, 1);

  const bins = { wrap: -5, egg: -2.8, scallion: -0.6 };
  const binObjects = {};
  const showHints = createHints(stage);
  const stoveX = 2.6;
  stage.add(at(counter(7.6), -2.8, 0, -3.6), at(counter(3.2, "#c6d4e1", "#8a99a8"), stoveX, 0, -3.6));

  for (const [kind, x] of Object.entries(bins)) {
    const bin = group();
    if (kind === "wrap") for (let i = 0; i < 5; i++) bin.add(at(omeletMesh("wrap"), 0, i * 0.07, 0));
    if (kind === "egg") {
      bin.add(at(box(1.1, 0.2, 0.8, "#c9a27a"), 0, 0.1, 0));
      for (let i = 0; i < 6; i++) bin.add(at(ball(0.16, "#fff6e8"), (i % 3 - 1) * 0.33, 0.3, i < 3 ? -0.18 : 0.18));
    }
    if (kind === "scallion") {
      bin.add(at(cyl(0.5, 0.35, 0.35, "#ffffff"), 0, 0.17, 0));
      bin.add(at(omeletMesh("scallion"), 0, 0.3, 0));
    }
    bin.add(at(label(g.OMELET_NAMES[kind], { size: 0.55 }), 0, 1.2, 0));
    hitBox(bin, 1.8, 1.6, 1.4);
    at(bin, x, 1.42, -3.6);
    stage.add(bin);
    binObjects[kind] = bin;
    stage.tappable(bin, () => pup.walkTo(...standBefore(x, -3.6), () => {
      const result = g.omeletPick(state, kind);
      if (!result.ok) return ui.hint(result.hint);
      pup.carry(omeletMesh(kind));
      ui.sfx("pop");
      refresh();
    }, V(x, 0, -3.6)));
  }

  // 爐子與鍋子
  const stove = group(at(cyl(0.75, 0.75, 0.05, "#333"), 0, 0.03, 0));
  const pan = group(at(cyl(0.8, 0.7, 0.18, "#2d2d2d"), 0, 0.12, 0), at(box(1.2, 0.08, 0.16, "#5a3b22"), 1.3, 0.2, 0));
  const flame = group();
  for (let i = 0; i < 8; i++) flame.add(at(cyl(0, 0.08, 0.25, "#ff8a3d", 6), Math.cos(i * 0.785) * 0.55, -0.05, Math.sin(i * 0.785) * 0.55));
  stove.add(pan, flame);
  const food = group();
  food.position.y = 0.23;
  pan.add(food);
  const ring = new THREE.Mesh(new THREE.RingGeometry(0.95, 1.1, 40, 1, 0, 0.01), new THREE.MeshBasicMaterial({ color: "#ff9f1a", side: THREE.DoubleSide }));
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = 0.3;
  stove.add(ring);
  const badge = at(label("🔥", { size: 0.8, background: null }), 0, 1.6, 0);
  stove.add(badge);
  hitBox(stove, 2.4, 1.6, 1.6);
  at(stove, stoveX - 0.3, 1.42, -3.6);
  stage.add(stove);

  // 煎好的蛋餅疊在盤子上
  const plate = group(cyl(0.85, 0.7, 0.1, "#ffffff"));
  at(plate, 4.9, 0, -1.6);
  const plateTable = group(at(box(1.9, 1.1, 1.9, "#9ecae1"), 0, 0.55, 0));
  at(plateTable, 4.9, 0, -1.6);
  plate.position.y = 1.15;
  plate.add(at(label("🍽️ 完成區", { size: 0.5 }), 0, 1.1, 0));
  stage.add(plateTable, plate);

  const colorFor = () => {
    const status = g.omeletStatus(state);
    if (status === "burnt") return new THREE.Color("#4a2f1a");
    const done = Math.min(1, state.cook / g.COOK_SECONDS);
    const over = Math.max(0, (state.cook - g.COOK_SECONDS) / g.BURN_SECONDS);
    return new THREE.Color("#fff1a8").lerp(new THREE.Color("#f0b54a"), done).lerp(new THREE.Color("#8a5a2b"), over * 0.7);
  };

  let omelet = null;
  let wrapMat = new THREE.MeshStandardMaterial({ color: "#f3d9a4", roughness: 0.8 });
  let eggMat = new THREE.MeshStandardMaterial({ color: "#ffe27a", roughness: 0.8 });
  function refresh() {
    const status = g.omeletStatus(state);
    const next = g.omeletNext(state);
    const steps = g.OMELET_RECIPE.map((kind, i) => `<span class="${i < state.pan.length ? "done" : kind === next ? "now" : ""}">${["🫓", "🥚", "🌿"][i]} ${g.OMELET_NAMES[kind]}</span>`);
    const tail = { filling: next ? `去拿${g.OMELET_NAMES[next]}` : "", cooking: "煎煎煎…", flip: "翻面！點鍋子", serve: "起鍋！點鍋子", burnt: "焦了，點鍋子倒掉" }[status];
    ui.guide(`${steps.join("<b>›</b>")}<b>›</b><span class="now">${tail}</span>`);
    if (status === "filling") {
      showHints(state.holding === next
        ? [{ object: stove, text: `把${g.OMELET_NAMES[next]}放進鍋子` }]
        : [{ object: binObjects[next], text: `拿${g.OMELET_NAMES[next]}` }]);
    } else {
      // 翻面／起鍋時鍋子上方已經有大提示牌
      showHints([]);
    }
  }

  function rebuildFood() {
    food.clear();
    omelet = null;
    // 盤子上的蛋餅保留原本的材質，鍋裡的新蛋餅用新的材質
    if (!state.pan.length) return;
    if (state.pan.length === 1) {
      wrapMat = new THREE.MeshStandardMaterial({ color: "#f3d9a4", roughness: 0.8 });
      eggMat = new THREE.MeshStandardMaterial({ color: "#ffe27a", roughness: 0.8 });
    }
    if (state.pan.includes("wrap")) {
      omelet = group(new THREE.Mesh(new THREE.CylinderGeometry(0.6, 0.6, 0.06, 28), wrapMat));
      if (state.pan.includes("egg")) omelet.add(at(new THREE.Mesh(new THREE.CylinderGeometry(0.56, 0.56, 0.05, 28), eggMat), 0, 0.05, 0));
      if (state.pan.includes("scallion")) for (let i = 0; i < 9; i++) omelet.add(at(ball(0.05, "#3e9b45"), Math.cos(i * 2.4) * 0.35 * ((i % 3) / 2 + 0.3), 0.09, Math.sin(i * 2.4) * 0.35 * ((i % 3) / 2 + 0.3)));
      food.add(omelet);
    }
  }

  stage.tappable(stove, () => pup.walkTo(...standBefore(stoveX - 0.3, -3.6), () => {
    const result = g.omeletUsePan(state);
    if (!result.ok) return ui.hint(result.hint);
    if (result.event === "add") {
      pup.putDown(V(stoveX - 0.3, 1.75, -3.6), held => { held.removeFromParent(); rebuildFood(); });
      ui.sfx("pop");
      if (state.pan.length === g.OMELET_RECIPE.length) ui.say("開始煎囉！變金黃色就翻面。");
    }
    if (result.event === "flip") {
      stage.tween(0.5, t => { food.rotation.x = t * Math.PI; food.position.y = 0.23 + Math.sin(t * Math.PI) * 0.45; }, () => { food.rotation.x = 0; });
      ui.sfx("good");
    }
    if (result.event === "serve" || result.event === "toss") {
      const piece = omelet;
      if (piece && result.event === "serve") {
        // 布麗用手把蛋餅端到完成區的盤子上
        pup.carry(piece);
        const stack = Math.min(state.score, 12);
        pup.walkTo(3.4, -1.6, () => pup.putDown(V(4.9, 1.25 + stack * 0.07, -1.6), done => {
          if (state.score <= 12) plate.attach(done); else done.removeFromParent();
        }), V(4.9, 0, -1.6));
      } else if (piece) {
        // 焦掉的慢慢縮小消失
        stage.tween(0.5, t => piece.scale.setScalar(Math.max(0.01, 1 - t)), () => piece.removeFromParent());
      }
      omelet = null;
      if (result.event === "serve") ui.good(`煎好 ${state.score} 個！`);
      else ui.hint(result.hint);
      ui.score(state.score);
    }
    refresh();
  }, V(stoveX - 0.3, 0, -3.6)));

  refresh();
  let lastStatus = "filling";
  return {
    stage,
    intro: "點食材，布麗會幫你拿。照順序放餅皮、雞蛋、蔥花進鍋子，金黃色就翻面，再煎一下就起鍋！",
    score: () => state.score,
    update(dt) {
      g.omeletTick(state, dt);
      const status = g.omeletStatus(state);
      flame.visible = state.side > 0;
      flame.children.forEach((f, i) => { f.scale.y = 0.8 + Math.sin(performance.now() / 70 + i) * 0.3; });
      if (state.side > 0) {
        wrapMat.color.copy(colorFor());
        eggMat.color.copy(colorFor().lerp(new THREE.Color("#ffe27a"), 0.4));
      }
      const progress = state.side ? Math.min(1, state.cook / g.COOK_SECONDS) : 0;
      ring.visible = state.side > 0 && status === "cooking";
      if (ring.visible) {
        ring.geometry.dispose();
        ring.geometry = new THREE.RingGeometry(0.95, 1.1, 40, 1, 0, Math.max(0.01, progress * Math.PI * 2));
      }
      badge.visible = status !== "filling";
      if (status !== lastStatus) {
        const text = { cooking: "🔥", flip: "🔄 翻面！", serve: "🍽️ 起鍋！", burnt: "💨 焦了" }[status];
        if (text) {
          badge.material.map.dispose();
          const fresh = label(text, { size: 0.75, background: status === "cooking" ? null : "rgba(255,255,255,.95)" });
          badge.material = fresh.material;
          badge.scale.copy(fresh.scale);
        }
        if (status === "flip") ui.say("可以翻面了！");
        if (status === "serve") ui.say("煎好了，起鍋！");
        lastStatus = status;
        refresh();
      }
      badge.position.y = 1.6 + Math.sin(performance.now() / 200) * 0.08;
    }
  };
}

// ---------------- 洗碗 ----------------

function dishMesh(index, dirty = true) {
  const d = index % 3;
  const dish = d === 1
    ? group(at(cyl(0.45, 0.28, 0.35, "#f7f7f7"), 0, 0.17, 0), at(cyl(0.38, 0.24, 0.3, "#dfe9f2"), 0, 0.22, 0))
    : d === 2
      ? group(at(cyl(0.22, 0.2, 0.45, "#ffd166"), 0, 0.22, 0))
      : group(at(cyl(0.55, 0.45, 0.08, "#f7f7f7"), 0, 0.04, 0));
  if (dirty) for (let i = 0; i < g.SCRUBS_NEEDED; i++) {
    const spot = ball(0.08, "#8d6e4a");
    spot.name = "dirt";
    const r = d === 2 ? 0.23 : 0.3;
    at(spot, Math.cos(i * 1.7) * r, d === 0 ? 0.1 : 0.35, Math.sin(i * 1.7) * r);
    dish.add(spot);
  }
  return dish;
}

export function buildDishes(container, ui) {
  const stage = new Stage(container, { cameraPos: [0, 10.5, 5], lookAt: [0, 0.8, -2.3], background: "#d4efff" });
  room(stage, { floor: "#e6eef5", wall: "#eaf7ff" });
  const state = g.createDishes();
  const pup = createPup(stage);
  at(pup, 0, 0, 1);
  let served = 0;

  stage.add(at(counter(13), 0, 0, -3.6));

  const pile = group();
  for (let i = 0; i < 5; i++) pile.add(at(dishMesh(0), 0, i * 0.1, 0));
  pile.add(at(label("🍽️ 髒碗盤", { size: 0.5 }), 0, 1.3, 0));
  hitBox(pile, 1.8, 1.6, 1.4);
  at(pile, -4.6, 1.42, -3.6);
  stage.add(pile);

  const sinkX = -0.8;
  const sink = group(at(box(2.4, 0.1, 1.2, "#b8c7d6"), 0, 0.02, 0), at(box(2.1, 0.05, 1, "#8fb3d1"), 0, 0.06, 0));
  sink.add(at(label("🧽 水槽（點一點刷）", { size: 0.45 }), 0, 1.5, 0.2));
  hitBox(sink, 2.4, 1.2, 1.4);
  at(sink, sinkX, 1.4, -3.6);
  const inSink = group();
  inSink.position.y = 0.1;
  sink.add(inSink);
  const bubbles = group();
  sink.add(bubbles);
  stage.add(sink);

  const faucet = group(at(cyl(0.08, 0.08, 1.1, "#9aa5b1"), 0, 0.55, 0), at(cyl(0.07, 0.07, 0.6, "#9aa5b1"), 0, 1.05, 0.25), at(box(0.3, 0.12, 0.3, "#2f80c9"), 0.3, 0.8, 0));
  faucet.children[1].rotation.x = Math.PI / 2;
  const water = at(cyl(0.06, 0.06, 1, "#8fd3ff", 10, { transparent: true, opacity: 0.7 }), 0, 0.45, 0.55);
  water.visible = false;
  faucet.add(water, at(label("🚰 沖水", { size: 0.45 }), 0.9, 1.4, 0));
  hitBox(faucet, 1.4, 1.8, 1);
  at(faucet, sinkX + 1.9, 1.42, -4.1);
  stage.add(faucet);

  const rack = group(at(box(2, 0.1, 1.2, "#8bc34a"), 0, 0.05, 0));
  for (let i = 0; i < 6; i++) rack.add(at(box(0.05, 0.6, 1.1, "#7cb342"), -0.8 + i * 0.32, 0.35, 0));
  rack.add(at(label("✨ 瀝水架", { size: 0.5 }), 0, 1.5, 0));
  hitBox(rack, 2.2, 1.6, 1.4);
  at(rack, 4.3, 1.42, -3.6);
  stage.add(rack);

  const showHints = createHints(stage);
  function refresh() {
    const status = g.dishesStatus(state);
    const hint = { empty: [pile, "拿髒碗盤"], carry: [sink, "放進水槽"], scrub: [sink, "點水槽刷一刷"], rinse: [faucet, "按水龍頭沖水"], done: [rack, "放到瀝水架"] }[status];
    showHints([{ object: hint[0], text: hint[1] }]);
    const order = ["empty", "carry", "scrub", "rinse", "done"];
    const names = ["拿髒碗盤", "放進水槽", "刷一刷", "沖水", "放瀝水架"];
    const current = order.indexOf(status);
    ui.guide(names.map((name, i) => `<span class="${i < current ? "done" : i === current ? "now" : ""}">${name}${i === 2 && status === "scrub" ? ` ${state.sink.scrubs}/${g.SCRUBS_NEEDED}` : ""}</span>`).join("<b>›</b>"));
  }

  stage.tappable(pile, () => pup.walkTo(...standBefore(-4.6, -3.6), () => {
    const result = g.dishesPickDirty(state);
    if (!result.ok) return ui.hint(result.hint);
    pup.carry(dishMesh(served));
    ui.sfx("pop");
    refresh();
  }, V(-4.6, 0, -3.6)));

  stage.tappable(sink, () => pup.walkTo(...standBefore(sinkX, -3.6), () => {
    const result = g.dishesUseSink(state);
    if (!result.ok) return ui.hint(result.hint);
    if (result.event === "place") {
      pup.putDown(V(sinkX, 1.5, -3.6), held => { inSink.add(held); held.position.set(0, 0, 0); });
      ui.sfx("pop");
    } else {
      const dish = inSink.children[0];
      const dirt = dish?.children.find(child => child.name === "dirt" && child.visible);
      if (dirt) dirt.visible = false;
      for (let i = 0; i < 3; i++) {
        const bubble = ball(0.1 + Math.random() * 0.08, "#ffffff", { transparent: true, opacity: 0.85 });
        at(bubble, (Math.random() - 0.5) * 1.4, 0.2 + Math.random() * 0.4, (Math.random() - 0.5) * 0.7);
        bubbles.add(bubble);
      }
      pup.rotation.z = 0.15;
      stage.tween(0.2, t => { pup.rotation.z = Math.sin(t * Math.PI * 2) * 0.15; });
      ui.sfx("scrub");
      if (g.dishesStatus(state) === "rinse") ui.say("好乾淨！去按水龍頭沖水。");
    }
    refresh();
  }, V(sinkX, 0, -3.6)));

  stage.tappable(faucet, () => pup.walkTo(...standBefore(sinkX + 1.2, -3.6), () => {
    const result = g.dishesRinse(state);
    if (!result.ok) return ui.hint(result.hint);
    water.visible = true;
    ui.sfx("water");
    const list = [...bubbles.children];
    stage.tween(0.9, t => list.forEach(b => b.scale.setScalar(1 - t)), () => { bubbles.clear(); water.visible = false; });
    // 沖乾淨後布麗把碗盤拿在手上，準備放去瀝水架
    const dish = inSink.children[0];
    if (dish) pup.carry(dish);
    ui.say("洗好了！拿去瀝水架。");
    refresh();
  }, V(sinkX + 1.9, 0, -4.1)));

  stage.tappable(rack, () => pup.walkTo(...standBefore(4.3, -3.6), () => {
    const result = g.dishesUseRack(state);
    if (!result.ok) return ui.hint(result.hint);
    if (!pup.holding() && inSink.children[0]) pup.carry(inSink.children[0]);
    const slot = served % 6;
    pup.putDown(V(4.3 - 0.8 + slot * 0.32, 1.7, -3.6), dish => {
      dish.rotation.set(0, 0, Math.PI / 2.4);
      dish.userData.clean = true;
      rack.attach(dish);
      while (rack.children.filter(child => child.userData.clean).length > 6) rack.children.find(child => child.userData.clean).removeFromParent();
    });
    served += 1;
    ui.score(state.score);
    ui.good(`洗好 ${state.score} 個！`);
    refresh();
  }, V(4.3, 0, -3.6)));

  refresh();
  return {
    stage,
    intro: "點髒碗盤拿起來，放進水槽，點水槽刷四下，再按水龍頭沖水，最後放到瀝水架！",
    score: () => state.score,
    update() { bubbles.children.forEach((b, i) => { b.position.y += Math.sin(performance.now() / 300 + i) * 0.002; }); }
  };
}

// ---------------- 客廳 ----------------

const MESS_COLORS = ["#e74c3c", "#f1c40f", "#3498db", "#2ecc71", "#9b59b6"];

function messMesh(kind, seed) {
  const color = MESS_COLORS[seed % MESS_COLORS.length];
  if (kind === "block") return group(at(box(0.5, 0.5, 0.5, color), 0, 0.25, 0));
  if (kind === "ball") {
    const stripe = at(cyl(0.305, 0.305, 0.12, "#ffffff", 20), 0, 0.3, 0);
    stripe.rotation.z = Math.PI / 2;
    return group(at(ball(0.3, color), 0, 0.3, 0), stripe);
  }
  if (kind === "car") {
    const car = group(at(box(0.8, 0.25, 0.45, color), 0, 0.25, 0), at(box(0.4, 0.2, 0.4, "#dff3ff"), -0.05, 0.47, 0));
    [[-0.25, -0.24], [0.25, -0.24], [-0.25, 0.24], [0.25, 0.24]].forEach(([x, z]) => {
      const wheel = at(cyl(0.12, 0.12, 0.08, "#222", 12), x, 0.12, z);
      wheel.rotation.x = Math.PI / 2;
      car.add(wheel);
    });
    return car;
  }
  if (kind === "sock") {
    const sock = group(at(cyl(0.12, 0.12, 0.55, color, 12), 0, 0.12, 0), at(ball(0.14, color), 0.12, 0.12, 0.3));
    sock.children[0].rotation.x = Math.PI / 2;
    sock.children[0].position.z = 0;
    sock.children[1].scale.set(1.3, 0.9, 1);
    return sock;
  }
  if (kind === "shirt") {
    const shirt = group(at(box(0.7, 0.08, 0.8, color), 0, 0.05, 0), at(box(0.3, 0.08, 0.25, color), -0.45, 0.05, -0.25), at(box(0.3, 0.08, 0.25, color), 0.45, 0.05, -0.25));
    return shirt;
  }
  if (kind === "paper") {
    const paper = new THREE.Mesh(new THREE.IcosahedronGeometry(0.22, 0), mat("#f5f5f5", { flatShading: true }));
    paper.castShadow = true;
    return group(at(paper, 0, 0.22, 0));
  }
  const peel = group();
  for (let i = 0; i < 3; i++) {
    const strip = ball(0.18, "#ffd23f");
    strip.scale.set(0.5, 0.25, 1.4);
    strip.position.set(Math.cos(i * 2.1) * 0.15, 0.06, Math.sin(i * 2.1) * 0.15);
    strip.rotation.y = i * 2.1;
    peel.add(strip);
  }
  peel.add(at(cyl(0.05, 0.05, 0.12, "#6b4f2a", 6), 0, 0.12, 0));
  return peel;
}

// 分類場景（客廳、資源回收共用）：地上的東西撿起來，送進正確的箱子
function buildSorter(container, ui, { state, background, floor, wall, rugColor, fitWidth, bins, meshFor, scale = 1.4, intro }) {
  const stage = new Stage(container, { background, fitWidth });
  room(stage, { floor, wall });
  const rug = cyl(4.5, 4.5, 0.03, rugColor, 40);
  rug.scale.z = 0.6;
  at(rug, 0, 0.015, 1);
  stage.add(rug);
  const pup = createPup(stage);
  at(pup, 0, 0, 0.5);

  const binMeshes = {};
  for (const [bin, { spot: [x, z], mesh }] of Object.entries(bins)) {
    hitBox(mesh, 2.2, 2.4, 1.6);
    at(mesh, x, 0, z);
    stage.add(mesh);
    binMeshes[bin] = mesh;
    stage.tappable(mesh, () => pup.walkTo(x, z + 1.4, () => {
      const result = g.cleanDrop(state, bin);
      if (!result.ok) return ui.hint(result.hint);
      pup.putDown(V(x, 0.9, z), held => held.removeFromParent());
      ui.score(state.score);
      ui.good(`${result.item.name}放對了！`);
      spawn(result.spawned, true);
      refresh();
    }, V(x, 0, z)));
  }

  // 散落的位置：格子隨機挑，避免重疊；只放在鏡頭看得到的範圍，布麗走過去也不會跑出畫面
  const spots = [];
  for (let x = -5; x <= 5; x += 2) for (const z of [-1.4, -0.2, 1, 2.2]) spots.push([x, z]);
  const used = new Map();
  const messMeshes = new Map();
  function freeSpot() {
    const free = spots.filter(spot => ![...used.values()].includes(spot) && Math.hypot(spot[0] - pup.position.x, spot[1] - pup.position.z) > 1.2);
    const pool = free.length ? free : spots;
    return pool[Math.floor(Math.random() * pool.length)];
  }

  function spawn(item, animate) {
    const spot = freeSpot();
    used.set(item.id, spot);
    const mesh = group(meshFor(item.kind, item.id));
    messMeshes.set(item.id, mesh);
    mesh.children[0].scale.setScalar(scale);
    hitBox(mesh, 1.3, 1, 1.3, 0.4);
    const jitter = [(Math.random() - 0.5) * 0.5, (Math.random() - 0.5) * 0.4];
    at(mesh, spot[0] + jitter[0], 0, spot[1] + jitter[1]);
    mesh.children[0].rotation.y = Math.random() * Math.PI;
    stage.add(mesh);
    if (animate) stage.tween(0.4, t => mesh.scale.setScalar(Math.max(0.01, t)));
    stage.tappable(mesh, () => pup.walkTo(mesh.position.x, mesh.position.z + 0.9, () => {
      const result = g.cleanPick(state, item.id);
      if (!result.ok) return result.hint && ui.hint(result.hint);
      used.delete(item.id);
      messMeshes.delete(item.id);
      mesh.userData.onTap = null;
      const inner = mesh.children[0];
      pup.carry(inner);
      inner.position.y = -0.3;
      mesh.removeFromParent();
      ui.sfx("pop");
      ui.say(`${item.name}，要放哪裡呢？`);
      refresh();
    }, mesh.position));
  }
  state.floor.forEach(item => spawn(item, false));
  const showHints = createHints(stage);
  const binList = Object.entries(bins).map(([bin, { icon }]) => `<span>${icon} ${state.bins[bin]}</span>`).join("");

  function refresh() {
    if (state.holding) {
      showHints([{ object: binMeshes[state.holding.bin], text: `${state.holding.name}放這裡` }]);
    } else {
      const nearest = [...messMeshes.values()].sort((a, b) => a.position.distanceTo(pup.position) - b.position.distanceTo(pup.position))[0];
      showHints(nearest ? [{ object: nearest, text: "撿起來", height: 1.5 }] : []);
    }
    ui.guide(state.holding
      ? `<span class="now">拿著${state.holding.name}</span><b>›</b>${binList}`
      : `<span class="now">點地上的東西撿起來</span><b>›</b>${binList}`);
  }
  refresh();
  return { stage, intro, score: () => state.score, update() {}, debug: { state, binMeshes, messMeshes } };
}

export function buildClean(container, ui) {
  return buildSorter(container, ui, {
    state: g.createClean(),
    background: "#d8f3e8", floor: "#e7c9a0", wall: "#f0fff7", rugColor: "#b8e0d2",
    meshFor: messMesh,
    bins: {
      toybox: { spot: [-4.8, -3.6], icon: "🧸", mesh: group(at(box(2, 1.1, 1.3, "#ff8c61"), 0, 0.55, 0), at(box(2.1, 0.12, 1.4, "#ffb38a"), 0, 1.15, 0), at(label("🧸 玩具箱", { size: 0.55 }), 0, 2, 0)) },
      laundry: { spot: [0, -3.9], icon: "🧺", mesh: group(at(cyl(0.8, 0.65, 1.1, "#d9b77e", 20), 0, 0.55, 0), at(cyl(0.72, 0.72, 0.05, "#8a6d3b", 20), 0, 1.1, 0), at(label("🧺 洗衣籃", { size: 0.55 }), 0, 2, 0)) },
      trash: { spot: [4.8, -3.6], icon: "🗑️", mesh: group(at(cyl(0.6, 0.5, 1.1, "#7f8c8d", 20), 0, 0.55, 0), at(cyl(0.65, 0.65, 0.1, "#5f6c6d", 20), 0, 1.12, 0), at(label("🗑️ 垃圾桶", { size: 0.55 }), 0, 2, 0)) }
    },
    intro: "點地上的東西，布麗會撿起來。玩具放玩具箱，衣服襪子放洗衣籃，垃圾丟垃圾桶！"
  });
}

// ---------------- 資源回收 ----------------

function recycleMesh(kind) {
  if (kind === "newspaper") {
    const paper = group(at(box(0.8, 0.06, 0.6, "#e8e8e8"), 0, 0.03, 0));
    for (let i = 0; i < 4; i++) paper.add(at(box(0.6, 0.01, 0.04, "#9e9e9e"), 0, 0.065, -0.2 + i * 0.13));
    return paper;
  }
  if (kind === "carton") return group(at(box(0.55, 0.45, 0.45, "#c8a06a"), 0, 0.22, 0), at(box(0.56, 0.02, 0.1, "#a57f4b"), 0, 0.45, 0));
  if (kind === "bottle") {
    const bottle = group(at(cyl(0.16, 0.16, 0.6, "#b8e3ff", 16, { transparent: true, opacity: 0.75 }), 0, 0.16, 0), at(cyl(0.07, 0.07, 0.1, "#2e86de", 10), 0, 0.16, 0.36));
    bottle.children.forEach(part => { part.rotation.x = Math.PI / 2; });
    bottle.children[0].position.z = 0;
    return bottle;
  }
  if (kind === "cup") return group(at(cyl(0.2, 0.14, 0.4, "#f8f8f8", 16, { transparent: true, opacity: 0.85 }), 0, 0.2, 0), at(cyl(0.02, 0.02, 0.35, "#e74c3c", 6), 0.08, 0.5, 0));
  if (kind === "can") return group(at(cyl(0.15, 0.15, 0.42, "#d0d4d9", 16, { metalness: 0.6, roughness: 0.3 }), 0, 0.21, 0), at(cyl(0.155, 0.155, 0.2, "#e53935", 16), 0, 0.21, 0));
  if (kind === "tin") return group(at(cyl(0.2, 0.2, 0.32, "#9aa3ad", 16, { metalness: 0.6, roughness: 0.35 }), 0, 0.16, 0), at(cyl(0.205, 0.205, 0.16, "#fbc02d", 16), 0, 0.16, 0));
  if (kind === "peel") return messMesh("peel", 0);
  if (kind === "core") {
    const core = ball(0.14, "#f3e3b5");
    core.scale.y = 1.8;
    return group(at(core, 0, 0.25, 0), at(ball(0.12, "#e53935"), 0, 0.12, 0), at(ball(0.12, "#e53935"), 0, 0.42, 0), at(cyl(0.02, 0.02, 0.12, "#5d4037", 6), 0, 0.58, 0));
  }
  if (kind === "tissue") {
    const tissue = new THREE.Mesh(new THREE.IcosahedronGeometry(0.2, 1), mat("#ffffff", { flatShading: true }));
    tissue.castShadow = true;
    tissue.scale.y = 0.7;
    return group(at(tissue, 0, 0.15, 0));
  }
  return group(at(box(0.6, 0.18, 0.45, "#f5f5f5"), 0, 0.09, 0), at(box(0.3, 0.02, 0.2, "#c9a26b"), 0, 0.19, 0));
}

function recycleBin(color, text) {
  return group(
    at(box(1.6, 1.3, 1.2, color), 0, 0.65, 0),
    at(box(1.7, 0.12, 1.3, color, { roughness: 0.5 }), 0, 1.36, 0),
    at(box(1, 0.04, 0.3, "#263238"), 0, 1.43, 0.1),
    at(label(text, { size: 0.5 }), 0, 2.1, 0)
  );
}

export function buildRecycle(container, ui) {
  const bins = {
    paper: { icon: "📰", color: "#3f8fd8" },
    plastic: { icon: "🧴", color: "#f39c12" },
    metal: { icon: "🥫", color: "#8e9aa6" },
    food: { icon: "🍌", color: "#6aa84f" },
    trash: { icon: "🗑️", color: "#5d6d7e" }
  };
  const state = g.createRecycle();
  return buildSorter(container, ui, {
    state,
    background: "#e3f6e1", floor: "#dcd3c2", wall: "#f3fbef", rugColor: "#cfe8c8", fitWidth: 14.5,
    meshFor: recycleMesh, scale: 1.5,
    bins: Object.fromEntries(Object.entries(bins).map(([bin, { icon, color }], i) => [bin, {
      spot: [-5.2 + i * 2.6, -3.7], icon, mesh: recycleBin(color, `${icon} ${g.RECYCLE_BINS[bin]}`)
    }])),
    intro: "垃圾要分類！紙類、塑膠類、鐵鋁罐、廚餘、一般垃圾，點地上的東西撿起來，再放進對的回收桶。"
  });
}

// ---------------- 市場 ----------------

function produceMesh(kind) {
  if (kind === "egg") return group(at(ball(0.16, "#fff3dc"), 0, 0.18, 0));
  if (kind === "scallion") return group(at(cyl(0.05, 0.05, 0.7, "#4caf50", 8), 0, 0.35, 0), at(cyl(0.07, 0.07, 0.2, "#f4f4f4", 8), 0, 0.1, 0));
  if (kind === "milk") return group(at(box(0.3, 0.5, 0.3, "#ffffff"), 0, 0.25, 0), at(box(0.31, 0.15, 0.31, "#2f80c9"), 0, 0.35, 0));
  if (kind === "apple") return group(at(ball(0.2, "#e53935"), 0, 0.2, 0), at(cyl(0.02, 0.02, 0.12, "#5d4037", 6), 0, 0.42, 0));
  if (kind === "bread") {
    const loaf = ball(0.26, "#d99a4e");
    loaf.scale.set(1.5, 0.8, 0.9);
    return group(at(loaf, 0, 0.2, 0));
  }
  const carrot = cyl(0.1, 0.02, 0.5, "#ff7f11", 10);
  carrot.rotation.z = Math.PI / 2;
  return group(at(carrot, 0, 0.12, 0), at(cyl(0.02, 0.05, 0.2, "#43a047", 6), -0.3, 0.15, 0));
}

const SHOP_ICONS = { egg: "🥚", scallion: "🌿", milk: "🥛", apple: "🍎", bread: "🍞", carrot: "🥕" };

export function buildErrand(container, ui) {
  const stage = new Stage(container, { cameraPos: [0, 11, 7], lookAt: [0, 0.5, -1.4], background: "#fff0b8", fitWidth: 14.5 });
  room(stage, { floor: "#d7ccc8", wall: "#fff8e1", width: 18 });
  const state = g.createErrand();
  const pup = createPup(stage);
  at(pup, -2, 0, 1.5);

  const basket = group(at(cyl(0.45, 0.35, 0.35, "#c68642", 16), 0, -0.1, 0));
  const basketItems = group();
  basket.add(basketItems);
  pup.carry(basket);

  const kinds = Object.keys(g.SHOP_ITEMS);
  const awnings = ["#ef5350", "#42a5f5", "#66bb6a", "#ffa726", "#ab47bc", "#26c6da"];
  const stalls = {};
  const showHints = createHints(stage);
  kinds.forEach((kind, i) => {
    const x = -5.5 + i * 2.2;
    const z = -3.6;
    const stall = group(at(box(1.9, 1.1, 1.3, "#a1887f"), 0, 0.55, 0), at(box(2, 0.12, 0.6, awnings[i]), 0, 2.6, -0.45), at(cyl(0.05, 0.05, 1.5, "#6d4c41", 6), -0.85, 1.85, -0.55), at(cyl(0.05, 0.05, 1.5, "#6d4c41", 6), 0.85, 1.85, -0.55));
    for (let n = 0; n < 5; n++) stall.add(at(produceMesh(kind), (n % 3 - 1) * 0.5, 1.1, n < 3 ? -0.2 : 0.25));
    stall.add(at(label(`${SHOP_ICONS[kind]} ${g.SHOP_ITEMS[kind]}`, { size: 0.45 }), 0, 3.1, -0.45));
    hitBox(stall, 2, 3, 1.5);
    at(stall, x, 0, z);
    stage.add(stall);
    stalls[kind] = stall;
    stage.tappable(stall, () => pup.walkTo(x, z + 1.4, () => {
      const result = g.errandTake(state, kind);
      if (!result.ok) return ui.hint(result.hint);
      const item = produceMesh(kind);
      item.scale.setScalar(0.7);
      at(item, (state.basket.length - 2) * 0.22, 0, 0);
      basketItems.add(item);
      ui.sfx("pop");
      ui.say(result.ready ? "都拿齊了，去櫃台結帳！" : g.SHOP_ITEMS[kind]);
      refresh();
    }, V(x, 0, z)));
  });

  const till = group(at(box(2.6, 1.1, 1.1, "#4db6ac"), 0, 0.55, 0), at(box(0.6, 0.4, 0.4, "#37474f"), 0.6, 1.3, 0), at(label("💰 結帳", { size: 0.55 }), 0, 2.4, 0));
  const clerk = group(at(ball(0.45, "#f4a261"), 0, 1.7, -0.9), at(ball(0.35, "#e9c46a"), 0, 2.4, -0.9));
  till.add(clerk);
  hitBox(till, 2.8, 2.6, 1.6);
  at(till, 4, 0, 0.9);
  till.rotation.y = -Math.PI / 2;
  stage.add(till);
  stage.tappable(till, () => pup.walkTo(2.5, 0.9, () => {
    const result = g.errandCheckout(state);
    if (!result.ok) return ui.hint(result.hint);
    const bag = group(at(box(0.8, 0.9, 0.5, "#fff3e0"), 0, 0.45, 0));
    at(bag, 3.6, 1.2, 0.9);
    stage.add(bag);
    // 袋子放在櫃台上一下，再慢慢縮小消失
    stage.tween(1.4, t => bag.scale.setScalar(t < 0.6 ? 1 : Math.max(0.01, 1 - (t - 0.6) / 0.4)), () => bag.removeFromParent());
    basketItems.clear();
    ui.score(state.score);
    ui.good(`完成 ${state.score} 張清單！`);
    refresh();
    setTimeout(() => ui.say(`新清單：${state.list.map(item => g.SHOP_ITEMS[item]).join("、")}`), 1200);
  }, V(4, 0, 0.9)));

  function refresh() {
    const items = state.list.map(item => `<span class="${state.basket.includes(item) ? "done" : "now"}">${SHOP_ICONS[item]} ${g.SHOP_ITEMS[item]}</span>`);
    const ready = state.basket.length === state.list.length;
    showHints(ready
      ? [{ object: till, text: "去結帳" }]
      : state.list.filter(item => !state.basket.includes(item)).map(item => ({ object: stalls[item], text: `拿${g.SHOP_ITEMS[item]}` })));
    ui.guide(`<span>📝 清單</span>${items.join("")}<b>›</b><span class="${ready ? "now" : ""}">💰 結帳</span>`);
  }
  refresh();
  return {
    stage,
    intro: `看購物清單，點攤位拿東西。三樣都拿齊了，就去右邊櫃台結帳！第一張清單：${state.list.map(item => g.SHOP_ITEMS[item]).join("、")}。`,
    score: () => state.score,
    update() {}
  };
}

// ---------------- 擺餐桌 ----------------

const TABLE_ICONS = { plate: "🍽️", bowl: "🥣", chopsticks: "🥢", cup: "🥤" };
// 每樣餐具在餐墊上的位置
const TABLE_SLOTS = { plate: [-0.35, 0.1], bowl: [0.2, 0.2], cup: [0.35, -0.3], chopsticks: [0.62, 0.1] };

function tableware(kind, ghost = false) {
  let item;
  if (kind === "plate") item = group(at(cyl(0.33, 0.27, 0.05, "#5d9bd5", 24), 0, 0.025, 0), at(cyl(0.27, 0.27, 0.02, "#ffffff", 24), 0, 0.05, 0));
  else if (kind === "bowl") item = group(at(cyl(0.22, 0.13, 0.18, "#ffffff", 20), 0, 0.09, 0), at(cyl(0.225, 0.225, 0.03, "#3f7fc4", 20), 0, 0.17, 0));
  else if (kind === "cup") item = group(at(cyl(0.12, 0.1, 0.3, "#ffd166", 16), 0, 0.15, 0));
  else {
    item = group();
    [-0.05, 0.05].forEach(x => {
      const stick = at(cyl(0.02, 0.014, 0.6, "#b5651d", 8), x, 0.03, 0);
      stick.rotation.x = Math.PI / 2;
      item.add(stick);
    });
  }
  if (ghost) {
    // 淡淡的圖案：告訴小朋友這裡要放什麼
    const ghostMat = new THREE.MeshBasicMaterial({ color: "#ffffff", transparent: true, opacity: 0.45, depthWrite: false });
    item.traverse(part => { if (part.isMesh) { part.material = ghostMat; part.castShadow = false; } });
  }
  return item;
}

export function buildTable(container, ui) {
  const stage = new Stage(container, { cameraPos: [0, 10.5, 5], lookAt: [0, 0.8, -2.3], background: "#fde7d6" });
  room(stage, { floor: "#e9d2b0", wall: "#fff1e4" });
  const state = g.createTable();
  const pup = createPup(stage);
  at(pup, -1, 0, 0.5);
  const showHints = createHints(stage);

  // 餐具櫃：四疊餐具
  stage.add(at(counter(7), -2.9, 0, -3.6));
  const stacks = {};
  Object.keys(g.TABLE_ITEMS).forEach((kind, i) => {
    const x = -5.3 + i * 1.6;
    const stack = group();
    for (let n = 0; n < 3; n++) {
      const item = tableware(kind);
      if (kind === "chopsticks") at(item, n * 0.15 - 0.15, 0, 0); else at(item, 0, n * (kind === "plate" ? 0.06 : 0.2), 0);
      if (kind === "cup" || kind === "bowl") at(item, (n - 1) * 0.35, 0, 0);
      stack.add(item);
    }
    stack.add(at(label(`${TABLE_ICONS[kind]} ${g.TABLE_ITEMS[kind]}`, { size: 0.5 }), 0, 1.2, 0));
    hitBox(stack, 1.5, 1.6, 1.4);
    at(stack, x, 1.42, -3.6);
    stage.add(stack);
    stacks[kind] = stack;
    stage.tappable(stack, () => pup.walkTo(...standBefore(x, -3.6), () => {
      g.tablePick(state, kind);
      pup.carry(tableware(kind));
      ui.sfx("pop");
      refresh();
    }, V(x, 0, -3.6)));
  });

  // 餐桌與兩張餐墊
  const tableX = 3.2;
  const tableZ = -1.8;
  const table = group(at(box(4.4, 0.14, 2.4, "#b07d4f"), 0, 1.05, 0));
  [[-2, -1], [2, -1], [-2, 1], [2, 1]].forEach(([x, z]) => table.add(at(box(0.16, 1, 0.16, "#8d5f38"), x, 0.5, z)));
  [-1.1, 1.1].forEach(x => table.add(at(box(0.9, 1.4, 0.2, "#c79a6b"), x, 0.7, -1.6), at(box(0.9, 0.1, 0.8, "#c79a6b"), x, 0.55, -1.2)));
  at(table, tableX, 0, tableZ);
  stage.add(table);

  const mats = [-1.1, 1.1].map((dx, seat) => {
    const placemat = group(at(box(1.8, 0.02, 1.2, seat ? "#ffcad4" : "#bde0fe"), 0, 0.01, 0));
    placemat.userData.content = group();
    placemat.add(placemat.userData.content);
    placemat.add(at(label(`座位 ${seat + 1}`, { size: 0.42 }), 0, 1.3, -0.3));
    hitBox(placemat, 2, 1.2, 1.4, 0.4);
    at(placemat, tableX + dx, 1.13, tableZ + 0.4);
    stage.add(placemat);
    stage.tappable(placemat, () => pup.walkTo(tableX + dx, tableZ + 1.9, () => {
      const finished = state.seats.map(({ needs }) => needs);
      const result = g.tablePlace(state, seat);
      if (!result.ok) return result.hint && ui.hint(result.hint);
      const [sx, sz] = TABLE_SLOTS[result.item];
      const target = V(tableX + dx + sx, 1.14, tableZ + 0.4 + sz);
      if (result.event === "table") {
        // 先讓小朋友看到擺好的一整桌，再換新的一桌
        pup.putDown(target, held => { held.removeFromParent(); drawMats(finished); setTimeout(() => drawMats(), 900); });
        ui.score(state.score);
        ui.good(`擺好 ${state.score} 桌了！`);
      } else {
        pup.putDown(target, held => { held.removeFromParent(); drawMats(); });
        ui.sfx("pop");
      }
      refresh();
    }, V(tableX + dx, 0, tableZ)));
    return placemat;
  });

  // finished：剛擺好的一整桌（全部實心）；沒給就畫目前這桌，還沒擺的顯示淡淡圖案
  function drawMats(finished) {
    mats.forEach((placemat, seat) => {
      const content = placemat.userData.content;
      content.clear();
      const needs = finished ? finished[seat] : state.seats[seat].needs;
      needs.forEach(kind => {
        const [x, z] = TABLE_SLOTS[kind];
        content.add(at(tableware(kind, !finished && !state.seats[seat].placed.includes(kind)), x, 0.02, z));
      });
    });
  }

  function refresh() {
    const missing = g.tableMissing(state);
    const seatText = state.seats.map((seat, i) => `<span>座位${i + 1}</span>` + seat.needs.map(kind => `<span class="${seat.placed.includes(kind) ? "done" : "now"}">${TABLE_ICONS[kind]} ${g.TABLE_ITEMS[kind]}</span>`).join("")).join("<b>·</b>");
    ui.guide(seatText);
    if (state.holding) {
      const spot = missing.find(({ item }) => item === state.holding);
      showHints(spot ? [{ object: mats[spot.seat], text: `${g.TABLE_ITEMS[state.holding]}放這裡` }] : [{ object: stacks[missing[0].item], text: `換拿${g.TABLE_ITEMS[missing[0].item]}` }]);
    } else if (missing.length) {
      showHints([{ object: stacks[missing[0].item], text: `拿${g.TABLE_ITEMS[missing[0].item]}` }]);
    }
  }
  drawMats();
  refresh();
  return {
    stage,
    intro: "要吃飯囉！看餐墊上淡淡的圖案，點櫃子拿餐具，再點餐墊擺上去。兩個座位都擺好，就完成一桌！",
    score: () => state.score,
    debug: { state, stacks, mats },
    update() {}
  };
}

// ---------------- 捉迷藏 ----------------

function furniture(kind) {
  if (kind === "sofa") return group(at(box(2.8, 0.7, 1.2, "#e07a5f"), 0, 0.35, 0), at(box(2.8, 1, 0.3, "#c9644a"), 0, 0.9, -0.45), at(box(0.3, 0.9, 1.2, "#c9644a"), -1.4, 0.55, 0), at(box(0.3, 0.9, 1.2, "#c9644a"), 1.4, 0.55, 0));
  if (kind === "curtain") return group(at(box(2.6, 2.2, 0.1, "#bfe3ff"), 0, 2, -0.2), at(box(1.2, 3.2, 0.25, "#f2cc8f"), -0.75, 1.6, 0), at(box(1.2, 3.2, 0.25, "#f2cc8f"), 0.75, 1.6, 0), at(cyl(0.05, 0.05, 3, "#8d6e63", 8), 0, 3.25, 0));
  if (kind === "wardrobe") return group(at(box(2, 3, 1, "#a47148"), 0, 1.5, 0), at(box(0.04, 2.8, 1.02, "#7a5230"), 0, 1.5, 0), at(ball(0.07, "#f1c40f"), -0.15, 1.5, 0.52), at(ball(0.07, "#f1c40f"), 0.15, 1.5, 0.52));
  if (kind === "plant") {
    const plant = group(at(cyl(0.45, 0.35, 0.7, "#d35400", 16), 0, 0.35, 0));
    [[0, 1.3, 0, 0.6], [-0.4, 1, 0.1, 0.45], [0.4, 1.1, -0.1, 0.5], [0, 1.7, 0.1, 0.4]].forEach(([x, y, z, r]) => plant.add(at(ball(r, "#4caf50"), x, y, z)));
    return plant;
  }
  if (kind === "box") return group(at(box(1.6, 1.1, 1.4, "#c8a06a"), 0, 0.55, 0), at(box(1.6, 0.05, 0.6, "#b58b55"), 0, 1.25, 0.9), at(box(1.6, 0.05, 0.6, "#b58b55"), 0, 1.25, -0.9));
  return group(at(box(2.4, 0.1, 1.6, "#d64550"), 0, 1.1, 0), at(box(2.4, 1, 0.05, "#d64550"), 0, 0.6, 0.8), at(box(2.4, 1, 0.05, "#d64550"), 0, 0.6, -0.8), at(box(0.05, 1, 1.6, "#d64550"), -1.2, 0.6, 0), at(box(0.05, 1, 1.6, "#d64550"), 1.2, 0.6, 0));
}

export function buildSeek(container, ui) {
  const stage = new Stage(container, { background: "#fbe7c6" });
  room(stage, { floor: "#d9b99b", wall: "#fff6e0" });
  const spots = [
    { kind: "sofa", name: "沙發", icon: "🛋️", x: -4.2, z: -3.3, h: 1.5 },
    { kind: "curtain", name: "窗簾", icon: "🪟", x: -0.6, z: -4.4, h: 3.4 },
    { kind: "wardrobe", name: "衣櫃", icon: "🚪", x: 3.8, z: -3.9, h: 3.1 },
    { kind: "plant", name: "大盆栽", icon: "🪴", x: -4.5, z: 0.6, h: 2.1 },
    { kind: "box", name: "紙箱", icon: "📦", x: 4.3, z: 0.4, h: 1.4 },
    { kind: "table", name: "桌子", icon: "🍽️", x: 1.4, z: -0.8, h: 1.3 }
  ];
  const state = g.createSearch(spots.length);
  const pup = createPup(stage);
  at(pup, -1.8, 0, 2);
  const sister = createPup(stage, { blue: "#e8793b", light: "#f7dcb4", dark: "#a0522d", spot: "#c85f28", skin: "#f7dcb4" });
  sister.scale.setScalar(0.75);
  sister.visible = false;
  const showHints = createHints(stage);

  // 偶爾從躲的地方露出一截尾巴
  const tail = at(cyl(0.06, 0.12, 0.6, "#e8793b", 10), 0, 0.3, 0);
  tail.visible = false;
  stage.add(tail);

  const meshes = spots.map((spot, index) => {
    const mesh = furniture(spot.kind);
    mesh.add(at(label(`${spot.icon} ${spot.name}`, { size: 0.45 }), 0, spot.kind === "wardrobe" || spot.kind === "curtain" ? 2.9 : 2.2, 0.6));
    // 點擊範圍跟家具一樣高，前面的家具才不會擋住後面的
    hitBox(mesh, 2.6, spot.h, 1.8);
    at(mesh, spot.x, 0, spot.z);
    stage.add(mesh);
    stage.tappable(mesh, () => pup.walkTo(spot.x + (spot.x > 0 ? -0.4 : 0.4), spot.z + 1.5, () => look(index), V(spot.x, 0, spot.z)));
    return mesh;
  });

  const wiggle = (mesh, times = 3) => stage.tween(0.5, t => { mesh.rotation.z = Math.sin(t * Math.PI * 2 * times) * 0.05 * (1 - t); });
  let busy = false;

  function look(index) {
    // 妹妹正在跳出來時點的，等動畫結束再找，不要吃掉小朋友的點擊
    if (busy) return setTimeout(() => look(index), 300);
    const spot = spots[index];
    wiggle(meshes[index]);
    const result = g.searchLook(state, index);
    if (result.event === "found") {
      busy = true;
      tail.visible = false;
      refresh();
      at(sister, spot.x + (spot.x > 0 ? -1 : 1), 0, spot.z + 1.1);
      sister.rotation.y = Math.atan2(pup.position.x - sister.position.x, pup.position.z - sister.position.z);
      sister.visible = true;
      stage.tween(0.8, t => { sister.position.y = Math.abs(Math.sin(t * Math.PI * 2)) * 0.5; });
      ui.score(state.score);
      ui.good(`找到了！妹妹躲在${spot.name}！`);
      setTimeout(() => {
        stage.tween(0.3, t => sister.scale.setScalar(0.75 * (1 - t) + 0.01), () => { sister.visible = false; sister.scale.setScalar(0.75); busy = false; nextPeek = 4; refresh(); });
        ui.say("妹妹又躲起來了，快找找看！");
      }, 1500);
      return;
    }
    if (result.misses >= 2) {
      // 提示：躲的地方會發出笑聲、晃一晃
      wiggle(meshes[state.target], 5);
      ui.hint(`${spot.name}後面沒有。好像聽到「嘻嘻」的笑聲…`);
    } else ui.hint(`${spot.name}後面沒有，再找找看！`);
    refresh();
  }

  function refresh() {
    ui.guide(`<span class="now">🙈 妹妹躲起來了！點家具找找看</span>${state.misses >= 3 ? "<span>看箭頭</span>" : ""}`);
    showHints(state.misses >= 3 ? [{ object: meshes[state.target], text: "好像在這裡！" }] : []);
  }

  let nextPeek = 5;
  refresh();
  return {
    stage,
    intro: "妹妹躲起來了！點沙發、窗簾、衣櫃這些家具，布麗會過去找。仔細看，有時候會露出尾巴喔！",
    score: () => state.score,
    debug: { state, meshes },
    update(dt) {
      if (busy) return;
      nextPeek -= dt;
      const spot = spots[state.target];
      if (nextPeek <= 0 && !tail.visible) {
        at(tail, spot.x + (spot.x > 0 ? -1.1 : 1.1), 0.3, spot.z + 0.5);
        tail.visible = true;
        nextPeek = 1.2;
      } else if (nextPeek <= 0 && tail.visible) {
        tail.visible = false;
        nextPeek = 5;
      }
      if (tail.visible) tail.rotation.z = Math.sin(performance.now() / 90) * 0.6;
    }
  };
}

// ---------------- 尋寶 ----------------

function landmark(kind) {
  if (kind === "tree") {
    const tree = group(at(cyl(0.3, 0.4, 2.2, "#8d5524", 12), 0, 1.1, 0));
    [[0, 2.6, 0, 1.1], [-0.7, 2.2, 0.2, 0.8], [0.7, 2.3, -0.1, 0.8]].forEach(([x, y, z, r]) => tree.add(at(ball(r, "#3e9b45"), x, y, z)));
    return tree;
  }
  if (kind === "flowers") {
    const bed = group(at(box(2.2, 0.3, 1.2, "#6d4c41"), 0, 0.15, 0));
    ["#e91e63", "#ffeb3b", "#9c27b0", "#ff5722", "#03a9f4", "#ffffff"].forEach((c, i) => {
      const x = -0.8 + (i % 3) * 0.8;
      const z = i < 3 ? -0.25 : 0.25;
      bed.add(at(cyl(0.03, 0.03, 0.5, "#388e3c", 6), x, 0.55, z), at(ball(0.16, c), x, 0.85, z));
    });
    return bed;
  }
  if (kind === "rock") {
    const rock = new THREE.Mesh(new THREE.IcosahedronGeometry(0.9, 0), mat("#9e9e9e", { flatShading: true }));
    rock.castShadow = true;
    rock.scale.set(1.3, 0.8, 1);
    return group(at(rock, 0, 0.6, 0));
  }
  if (kind === "slide") {
    const slide = group(at(box(0.9, 2, 0.1, "#ef5350"), -0.8, 1, -0.4), at(box(0.9, 2, 0.1, "#ef5350"), -0.8, 1, 0.4), at(box(0.9, 0.1, 0.9, "#ffca28"), -0.8, 2, 0));
    const chute = at(box(2.4, 0.1, 0.9, "#42a5f5"), 0.4, 1.05, 0);
    chute.rotation.z = -0.7;
    slide.add(chute);
    return slide;
  }
  if (kind === "sandbox") {
    const sand = group(at(box(2.2, 0.3, 1.8, "#a1887f"), 0, 0.15, 0), at(box(2, 0.32, 1.6, "#f5deb3"), 0, 0.16, 0), at(cyl(0.2, 0.15, 0.3, "#29b6f6", 12), 0.5, 0.45, 0.2));
    return sand;
  }
  const house = group(at(box(1.6, 1.2, 1.4, "#e57373"), 0, 0.6, 0), at(box(0.6, 0.7, 0.05, "#3e2723"), 0, 0.4, 0.71));
  const roof = new THREE.Mesh(new THREE.ConeGeometry(1.25, 0.8, 4), mat("#6d4c41"));
  roof.rotation.y = Math.PI / 4;
  roof.castShadow = true;
  house.add(at(roof, 0, 1.6, 0));
  return house;
}

export function buildTreasure(container, ui) {
  const stage = new Stage(container, { background: "#bfe7ff" });
  room(stage, { floor: "#9ccc65", wall: "#dff3ff" });
  // 木頭圍籬
  for (let x = -7.5; x <= 7.5; x += 0.6) stage.add(at(box(0.4, 1.4, 0.1, "#d7a86e"), x, 0.7, -4.9));
  const spots = [
    { kind: "tree", name: "大樹", icon: "🌳", x: -4.8, z: -3.3, h: 3.6 },
    { kind: "flowers", name: "花圃", icon: "🌷", x: -1.6, z: -3.5, h: 1.2 },
    { kind: "rock", name: "大石頭", icon: "🪨", x: 1.4, z: -3.4, h: 1.4 },
    { kind: "slide", name: "溜滑梯", icon: "🛝", x: 4.6, z: -3.4, h: 2.2 },
    { kind: "sandbox", name: "沙坑", icon: "🏖️", x: -3.8, z: 0.8, h: 0.7 },
    { kind: "doghouse", name: "狗屋", icon: "🏠", x: 3.8, z: 0.8, h: 2 }
  ];
  const state = g.createSearch(spots.length);
  const pup = createPup(stage);
  at(pup, 0, 0, 1.5);
  const showHints = createHints(stage);

  const meshes = spots.map((spot, index) => {
    const mesh = landmark(spot.kind);
    mesh.add(at(label(`${spot.icon} ${spot.name}`, { size: 0.45 }), 0, spot.kind === "tree" ? 3.2 : 2.5, 0.3));
    hitBox(mesh, 2.6, spot.h, 2);
    at(mesh, spot.x, 0, spot.z);
    stage.add(mesh);
    stage.tappable(mesh, () => pup.walkTo(spot.x, spot.z + 1.9, () => dig(index), V(spot.x + (spot.x > 0 ? -1 : 1), 0, spot.z + 1.9)));
    return mesh;
  });

  let busy = false;
  function dig(index) {
    if (busy) return setTimeout(() => dig(index), 300);
    busy = true;
    const spot = spots[index];
    // 在小狗旁邊挖，鏡頭才看得到寶箱
    const hole = V(spot.x + (spot.x > 0 ? -1 : 1), 0, spot.z + 1.9);
    // 挖土：小狗點頭三下，土一顆顆冒出來
    const dirt = group();
    stage.add(dirt);
    ui.sfx("scrub");
    stage.tween(0.9, t => {
      pup.rotation.x = Math.abs(Math.sin(t * Math.PI * 3)) * 0.3;
      if (dirt.children.length < t * 8) dirt.add(at(ball(0.1 + Math.random() * 0.06, "#795548"), hole.x + (Math.random() - 0.5) * 0.8, 0.08, hole.z + (Math.random() - 0.5) * 0.5));
    }, () => {
      pup.rotation.x = 0;
      const result = g.searchLook(state, index);
      if (result.event === "found") {
        const chest = group(at(box(0.8, 0.5, 0.55, "#8d5524"), 0, 0.25, 0), at(box(0.84, 0.15, 0.59, "#f1c40f"), 0, 0.55, 0), at(ball(0.14, ["#e91e63", "#00bcd4", "#8bc34a", "#ffc107"][state.score % 4], { emissive: "#ffffff", emissiveIntensity: 0.2 }), 0, 0.72, 0));
        at(chest, hole.x, -0.6, hole.z);
        stage.add(chest);
        stage.tween(0.5, t => { chest.position.y = -0.6 + t * 0.6; });
        ui.score(state.score);
        ui.good(`挖到寶藏了！第 ${state.score} 個！`);
        busy = false;
        refresh();
        setTimeout(() => {
          stage.tween(0.4, t => { chest.scale.setScalar(Math.max(0.01, 1 - t)); dirt.scale.setScalar(Math.max(0.01, 1 - t)); }, () => { chest.removeFromParent(); dirt.removeFromParent(); });
          ui.say(`新的藏寶圖：寶藏在${spots[state.target].name}那裡！`);
        }, 1300);
      } else {
        ui.hint(`${spot.name}這裡沒有寶藏，看看藏寶圖！`);
        setTimeout(() => stage.tween(0.4, t => dirt.scale.setScalar(Math.max(0.01, 1 - t)), () => dirt.removeFromParent()), 1200);
        busy = false;
        refresh();
      }
    });
  }

  function refresh() {
    const target = spots[state.target];
    ui.guide(`<span>🗺️ 藏寶圖</span><span class="now">寶藏在 ${target.icon} ${target.name}</span>`);
    showHints(state.misses >= 1 ? [{ object: meshes[state.target], text: `寶藏在${target.name}` }] : []);
  }
  refresh();
  return {
    stage,
    intro: `看上面的藏寶圖，寶藏藏在哪裡，就點那個地方，布麗會去挖！第一個寶藏在${spots[state.target].name}。`,
    score: () => state.score,
    debug: { state, meshes },
    update() {}
  };
}

export const levels = { omelet: buildOmelet, dishes: buildDishes, clean: buildClean, errand: buildErrand, table: buildTable, recycle: buildRecycle, seek: buildSeek, treasure: buildTreasure };
