import { missions, isCorrect, nextStep, completionSet } from "./gameEngine.js";

const app = document.querySelector("#app");
const homeButton = document.querySelector("#home-button");
const soundButton = document.querySelector("#sound-button");
let voiceOn = localStorage.getItem("bluey-voice") !== "off";
let activeMission = null;
let stepIndex = 0;
let locked = false;
let completed = JSON.parse(localStorage.getItem("bluey-completed") || "[]");

function speak(text) {
  if (!voiceOn || !("speechSynthesis" in window)) return;
  speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = "zh-TW";
  utterance.rate = 0.88;
  utterance.pitch = 1.12;
  speechSynthesis.speak(utterance);
}

function tone(success = true) {
  const AudioContext = window.AudioContext || window.webkitAudioContext;
  if (!AudioContext || !voiceOn) return;
  const ctx = new AudioContext();
  [0, success ? 4 : -2].forEach((offset, i) => {
    const oscillator = ctx.createOscillator();
    const gain = ctx.createGain();
    oscillator.frequency.value = 440 * Math.pow(2, offset / 12);
    gain.gain.setValueAtTime(.08, ctx.currentTime + i * .12);
    gain.gain.exponentialRampToValueAtTime(.001, ctx.currentTime + i * .12 + .18);
    oscillator.connect(gain).connect(ctx.destination);
    oscillator.start(ctx.currentTime + i * .12);
    oscillator.stop(ctx.currentTime + i * .12 + .2);
  });
}

function showHome() {
  activeMission = null;
  homeButton.classList.add("hidden");
  const view = document.querySelector("#home-template").content.cloneNode(true);
  const grid = view.querySelector("#mission-grid");
  missions.forEach((mission, index) => {
    const button = document.createElement("button");
    button.className = "mission-card";
    button.innerHTML = `<span class="mission-icon">${mission.icon}</span><span><h2>${mission.title}</h2><p>${mission.summary}</p></span><span class="mission-status" aria-label="${completed.includes(mission.id) ? "已完成" : "還沒完成"}">${completed.includes(mission.id) ? "⭐" : "›"}</span>`;
    button.addEventListener("click", () => startMission(index));
    grid.append(button);
  });
  app.replaceChildren(view);
  document.title = "布麗的生活任務";
}

function startMission(index) {
  activeMission = missions[index];
  stepIndex = 0;
  homeButton.classList.remove("hidden");
  renderStep();
}

function renderStep() {
  locked = false;
  const view = document.querySelector("#game-template").content.cloneNode(true);
  const stepData = activeMission.steps[stepIndex];
  view.querySelector("#game-kicker").textContent = `任務 ${stepIndex + 1} / ${activeMission.steps.length}`;
  view.querySelector("#game-title").textContent = activeMission.title;
  view.querySelector("#coach-title").textContent = stepData.title;
  view.querySelector("#coach-text").textContent = stepData.prompt;
  const dots = view.querySelector("#progress-dots");
  activeMission.steps.forEach((_, index) => {
    const dot = document.createElement("span");
    dot.className = `progress-dot ${index < stepIndex ? "done" : index === stepIndex ? "current" : ""}`;
    dots.append(dot);
  });
  const choices = document.createElement("div");
  choices.className = "choice-grid";
  stepData.choices.forEach((choice, choiceIndex) => {
    const button = document.createElement("button");
    button.className = "choice";
    button.innerHTML = `<span class="emoji" aria-hidden="true">${choice.emoji}</span><span class="label">${choice.label}</span>`;
    button.addEventListener("click", () => choose(button, choiceIndex));
    choices.append(button);
  });
  view.querySelector("#play-area").append(choices);
  view.querySelector("#repeat-button").addEventListener("click", () => speak(stepData.prompt));
  app.replaceChildren(view);
  document.title = `${activeMission.title}｜生活任務`;
  speak(stepData.prompt);
}

function choose(button, choiceIndex) {
  if (locked) return;
  const stepData = activeMission.steps[stepIndex];
  const feedback = document.querySelector("#feedback");
  if (!isCorrect(stepData, choiceIndex)) {
    button.animate([{ transform: "translateX(-5px)" }, { transform: "translateX(5px)" }, { transform: "none" }], { duration: 280 });
    feedback.className = "feedback gentle";
    feedback.textContent = "再想想看，沒關係，我們慢慢來。";
    tone(false);
    speak("再想想看，沒關係，我們慢慢來。" );
    return;
  }
  locked = true;
  button.classList.add("selected");
  feedback.className = "feedback good";
  feedback.textContent = `做得好！答案是「${stepData.answer}」。`;
  tone(true);
  speak(`做得好！答案是${stepData.answer}。`);
  const next = document.createElement("button");
  next.className = "primary";
  next.textContent = stepIndex === activeMission.steps.length - 1 ? "完成任務" : "下一步";
  next.addEventListener("click", advance);
  const row = document.createElement("div");
  row.className = "action-row";
  row.append(next);
  document.querySelector("#play-area").append(row);
}

function advance() {
  const next = nextStep(stepIndex, activeMission.steps.length);
  if (next >= activeMission.steps.length) return finishMission();
  stepIndex = next;
  renderStep();
}

function finishMission() {
  completed = completionSet(completed, activeMission.id);
  localStorage.setItem("bluey-completed", JSON.stringify(completed));
  const title = activeMission.title;
  const icon = activeMission.icon;
  app.innerHTML = `<section class="play-area celebration"><span class="big">${icon}</span><div class="stars">★★★</div><h2>任務完成！</h2><p>你完成了「${title}」，今天又學會一件生活本領。</p><div class="action-row"><button id="again" class="secondary">再玩一次</button><button id="to-home" class="primary">選其他任務</button></div></section>`;
  document.querySelector("#again").addEventListener("click", () => { stepIndex = 0; renderStep(); });
  document.querySelector("#to-home").addEventListener("click", showHome);
  tone(true);
  speak("任務完成！你今天又學會一件生活本領。");
}

homeButton.addEventListener("click", showHome);
soundButton.addEventListener("click", () => {
  voiceOn = !voiceOn;
  localStorage.setItem("bluey-voice", voiceOn ? "on" : "off");
  soundButton.textContent = voiceOn ? "🔊" : "🔇";
  soundButton.setAttribute("aria-label", voiceOn ? "關閉語音" : "開啟語音");
  if (!voiceOn && "speechSynthesis" in window) speechSynthesis.cancel();
  if (voiceOn) speak("語音已開啟");
});
soundButton.textContent = voiceOn ? "🔊" : "🔇";

if ("serviceWorker" in navigator) window.addEventListener("load", () => navigator.serviceWorker.register("./sw.js"));
showHome();
