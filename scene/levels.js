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
    const held = pup.holding();
    const result = g.omeletUsePan(state);
    if (!result.ok) return ui.hint(result.hint);
    if (result.event === "add") {
      pup.release();
      stage.fly(held, V(stoveX - 0.3, 1.9, -3.6), { done: () => { held.removeFromParent(); rebuildFood(); } });
      ui.sfx("pop");
      if (state.pan.length === g.OMELET_RECIPE.length) ui.say("開始煎囉！變金黃色就翻面。");
    }
    if (result.event === "flip") {
      stage.tween(0.5, t => { food.rotation.x = t * Math.PI; food.position.y = 0.23 + Math.sin(t * Math.PI) * 1.2; }, () => { food.rotation.x = 0; });
      ui.sfx("good");
    }
    if (result.event === "serve" || result.event === "toss") {
      const piece = omelet;
      const target = result.event === "serve" ? V(4.9, 1.25 + Math.min(state.score, 12) * 0.07, -1.6) : V(stoveX + 2, 0.1, -1.8);
      if (piece) stage.fly(piece, target, { height: 2, duration: 0.6, done: () => {
        if (result.event === "serve" && state.score <= 12) { piece.rotation.set(0, 0, 0); plate.attach(piece); } else piece.removeFromParent();
      } });
      food.clear();
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
    const held = pup.holding();
    const result = g.dishesUseSink(state);
    if (!result.ok) return ui.hint(result.hint);
    if (result.event === "place") {
      pup.release();
      stage.fly(held, V(sinkX, 1.5, -3.6), { height: 0.6, done: () => { inSink.add(held); held.position.set(0, 0, 0); } });
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
    refresh();
  }, V(sinkX + 1.9, 0, -4.1)));

  stage.tappable(rack, () => pup.walkTo(...standBefore(4.3, -3.6), () => {
    const result = g.dishesUseRack(state);
    if (!result.ok) return ui.hint(result.hint);
    const dish = inSink.children[0];
    if (dish) {
      const slot = served % 6;
      stage.fly(dish, V(4.3 - 0.8 + slot * 0.32, 1.7, -3.6), { height: 1.6, done: () => {
        dish.rotation.set(0, 0, Math.PI / 2.4);
        rack.attach(dish);
        while (rack.children.filter(child => child.userData.clean).length > 6) rack.children.find(child => child.userData.clean).removeFromParent();
      } });
      dish.userData.clean = true;
    }
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

export function buildClean(container, ui) {
  const stage = new Stage(container, { background: "#d8f3e8" });
  room(stage, { floor: "#e7c9a0", wall: "#f0fff7" });
  const rug = cyl(4.5, 4.5, 0.03, "#b8e0d2", 40);
  rug.scale.z = 0.6;
  at(rug, 0, 0.015, 1);
  stage.add(rug);
  const state = g.createClean();
  const pup = createPup(stage);
  at(pup, 0, 0, 0.5);

  const binSpots = { toybox: [-4.8, -3.6], laundry: [0, -3.9], trash: [4.8, -3.6] };
  const binMeshes = {
    toybox: group(at(box(2, 1.1, 1.3, "#ff8c61"), 0, 0.55, 0), at(box(2.1, 0.12, 1.4, "#ffb38a"), 0, 1.15, 0), at(label("🧸 玩具箱", { size: 0.55 }), 0, 2, 0)),
    laundry: group(at(cyl(0.8, 0.65, 1.1, "#d9b77e", 20), 0, 0.55, 0), at(cyl(0.72, 0.72, 0.05, "#8a6d3b", 20), 0, 1.1, 0), at(label("🧺 洗衣籃", { size: 0.55 }), 0, 2, 0)),
    trash: group(at(cyl(0.6, 0.5, 1.1, "#7f8c8d", 20), 0, 0.55, 0), at(cyl(0.65, 0.65, 0.1, "#5f6c6d", 20), 0, 1.12, 0), at(label("🗑️ 垃圾桶", { size: 0.55 }), 0, 2, 0))
  };
  for (const [bin, mesh] of Object.entries(binMeshes)) {
    const [x, z] = binSpots[bin];
    hitBox(mesh, 2.2, 2.4, 1.6);
    at(mesh, x, 0, z);
    stage.add(mesh);
    stage.tappable(mesh, () => pup.walkTo(x, z + 1.4, () => {
      const held = pup.holding();
      const result = g.cleanDrop(state, bin);
      if (!result.ok) return ui.hint(result.hint);
      pup.release();
      stage.fly(held, V(x, 1.1, z), { height: 1, done: () => held.removeFromParent() });
      ui.score(state.score);
      ui.good(`${result.item.name}回家了！`);
      spawn(result.spawned, true);
      refresh();
    }, V(x, 0, z)));
  }

  // 散落的位置：格子隨機挑，避免重疊
  const spots = [];
  for (let x = -5; x <= 5; x += 2) for (let z = -1.2; z <= 3.6; z += 1.6) spots.push([x, z]);
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
    const mesh = group(messMesh(item.kind, item.id));
    messMeshes.set(item.id, mesh);
    mesh.children[0].scale.setScalar(1.4);
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

  function refresh() {
    if (state.holding) {
      showHints([{ object: binMeshes[state.holding.bin], text: `${state.holding.name}放這裡` }]);
    } else {
      const nearest = [...messMeshes.values()].sort((a, b) => a.position.distanceTo(pup.position) - b.position.distanceTo(pup.position))[0];
      showHints(nearest ? [{ object: nearest, text: "撿起來", height: 1.5 }] : []);
    }
    ui.guide(state.holding
      ? `<span class="now">拿著${state.holding.name}</span><b>›</b><span>送到${Object.values(g.CLEAN_BINS).join("／")}</span>`
      : `<span class="now">點地上的東西撿起來</span><b>›</b><span>🧸 玩具箱</span><span>🧺 洗衣籃</span><span>🗑️ 垃圾桶</span>`);
  }
  refresh();
  return {
    stage,
    intro: "點地上的東西，布麗會撿起來。玩具放玩具箱，衣服襪子放洗衣籃，垃圾丟垃圾桶！",
    score: () => state.score,
    update() {}
  };
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
    stage.fly(bag, V(-7, 0.5, 4), { duration: 1, height: 2, done: () => bag.removeFromParent() });
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

export const levels = { omelet: buildOmelet, dishes: buildDishes, clean: buildClean, errand: buildErrand };
