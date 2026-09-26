import test from "node:test";
import assert from "node:assert/strict";
import { missions, isCorrect, nextStep, completionSet } from "../gameEngine.js";

test("four complete life missions are available", () => {
  assert.equal(missions.length, 4);
  missions.forEach(mission => assert.equal(mission.steps.length, 4));
});

test("every step has exactly one correct choice", () => {
  missions.flatMap(mission => mission.steps).forEach(step => {
    assert.equal(step.choices.filter(choice => choice.correct).length, 1);
  });
});

test("answer checking and step bounds work", () => {
  const step = missions[0].steps[0];
  assert.equal(isCorrect(step, 0), true);
  assert.equal(isCorrect(step, 1), false);
  assert.equal(nextStep(3, 4), 4);
  assert.equal(nextStep(4, 4), 4);
});

test("completed missions remain unique", () => {
  assert.deepEqual(completionSet(["dishes"], "dishes"), ["dishes"]);
  assert.deepEqual(completionSet(["dishes"], "clean"), ["dishes", "clean"]);
});
