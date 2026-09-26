import test from "node:test";
import assert from "node:assert/strict";
import * as g from "../gameEngine.js";

const fixedRand = () => 0.3;

test("four timed missions are available", () => {
  assert.deepEqual(g.missions.map(m => m.id), ["omelet", "dishes", "clean", "errand"]);
  assert.equal(g.GAME_SECONDS, 180);
});

test("clock counts down to zero and stops", () => {
  const clock = g.createClock(2);
  g.tickClock(clock, 1.5);
  assert.equal(clock.over, false);
  g.tickClock(clock, 1);
  assert.equal(clock.left, 0);
  assert.equal(clock.over, true);
  assert.equal(g.formatTime(180), "3:00");
  assert.equal(g.formatTime(59.2), "1:00");
  assert.equal(g.formatTime(0), "0:00");
});

test("best scores keep the highest per mission", () => {
  const table = g.bestScores({ omelet: 5 }, "omelet", 3);
  assert.equal(table.omelet, 5);
  assert.equal(g.bestScores(table, "dishes", 2).dishes, 2);
  assert.equal(g.bestScores(null, "omelet", 4).omelet, 4);
  assert.deepEqual([0, 1, 4, 8].map(g.starsFor), [0, 1, 2, 3]);
});

test("omelet needs ingredients in order, a flip, then serving", () => {
  const s = g.createOmelet();
  assert.equal(g.omeletUsePan(s).ok, false);
  g.omeletPick(s, "egg");
  assert.match(g.omeletUsePan(s).hint, /餅皮/);
  for (const item of g.OMELET_RECIPE) {
    g.omeletPick(s, item);
    assert.equal(g.omeletUsePan(s).event, "add");
  }
  assert.equal(g.omeletStatus(s), "cooking");
  assert.equal(g.omeletUsePan(s).ok, false);
  g.omeletTick(s, g.COOK_SECONDS);
  assert.equal(g.omeletUsePan(s).event, "flip");
  g.omeletTick(s, g.COOK_SECONDS);
  assert.equal(g.omeletUsePan(s).event, "serve");
  assert.equal(s.score, 1);
  assert.equal(g.omeletStatus(s), "filling");
});

test("an omelet left too long burns and does not score", () => {
  const s = g.createOmelet();
  for (const item of g.OMELET_RECIPE) { g.omeletPick(s, item); g.omeletUsePan(s); }
  g.omeletTick(s, g.COOK_SECONDS + g.BURN_SECONDS);
  assert.equal(g.omeletStatus(s), "burnt");
  assert.equal(g.omeletUsePan(s).event, "toss");
  assert.equal(s.score, 0);
});

test("dishes go sink, scrub, rinse, rack", () => {
  const s = g.createDishes();
  assert.equal(g.dishesUseSink(s).ok, false);
  g.dishesPickDirty(s);
  assert.equal(g.dishesUseSink(s).event, "place");
  assert.equal(g.dishesRinse(s).ok, false);
  for (let i = 0; i < g.SCRUBS_NEEDED; i++) assert.equal(g.dishesUseSink(s).event, "scrub");
  assert.equal(g.dishesUseRack(s).ok, false);
  assert.equal(g.dishesRinse(s).event, "rinse");
  assert.equal(g.dishesUseRack(s).event, "rack");
  assert.equal(s.score, 1);
  assert.equal(g.dishesStatus(s), "empty");
});

test("cleaning sorts items into the right bin and refills the floor", () => {
  const s = g.createClean(fixedRand);
  assert.equal(s.floor.length, g.FLOOR_SIZE);
  const item = s.floor[0];
  g.cleanPick(s, item.id);
  assert.equal(s.floor.length, g.FLOOR_SIZE - 1);
  const wrong = Object.keys(g.CLEAN_BINS).find(bin => bin !== item.bin);
  assert.equal(g.cleanDrop(s, wrong).ok, false);
  const result = g.cleanDrop(s, item.bin);
  assert.equal(result.ok, true);
  assert.equal(s.score, 1);
  assert.equal(s.floor.length, g.FLOOR_SIZE);
  assert.ok(!s.floor.some(mess => mess.id === item.id));
});

test("errand only accepts listed items and checks out a full basket", () => {
  const s = g.createErrand(fixedRand);
  assert.equal(new Set(s.list).size, g.LIST_SIZE);
  const offList = Object.keys(g.SHOP_ITEMS).find(item => !s.list.includes(item));
  assert.equal(g.errandTake(s, offList).ok, false);
  assert.equal(g.errandCheckout(s).ok, false);
  const results = s.list.map(item => g.errandTake(s, item));
  assert.equal(results.at(-1).ready, true);
  assert.equal(g.errandTake(s, s.list[0]).ok, false);
  assert.equal(g.errandCheckout(s).event, "checkout");
  assert.equal(s.score, 1);
  assert.equal(s.basket.length, 0);
});
