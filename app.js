import { missions, createClock, tickClock, formatTime, starsFor, bestScores, GAME_SECONDS } from "./gameEngine.js";
import { levels } from "./scene/levels.js";

const app = document.querySelector("#app");
const homeButton = document.querySelector("#home-button");
const soundButton = document.querySelector("#sound-button");
let voiceOn = localStorage.getItem("bluey-voice") !== "off";
let best = readJSON("bluey-best", {});
let current = null;

function readJSON(key, fallback) {
  try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch { return fallback; }
}

function speak(text) {
  if (!voiceOn || !("speechSynthesis" in window)) return;
  speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = "zh-TW";
  utterance.rate = 0.95;
  utterance.pitch = 1.12;
  speechSynthesis.speak(utterance);
}

let audio = null;
const SOUNDS = { good: [0, 4, 7], soft: [0, -2], pop: [7], scrub: [12], water: [-5, -3], end: [0, 4, 7, 12] };
function tone(kind = "good") {
  const AudioContext = window.AudioContext || window.webkitAudioContext;
  if (!AudioContext || !voiceOn) return;
  audio ??= new AudioContext();
  SOUNDS[kind].forEach((offset, i) => {
    const oscillator = audio.createOscillator();
    const gain = audio.createGain();
    const start = audio.currentTime + i * 0.09;
    oscillator.type = kind === "scrub" ? "triangle" : "sine";
    oscillator.frequency.value = 440 * Math.pow(2, offset / 12);
    gain.gain.setValueAtTime(0.07, start);
    gain.gain.exponentialRampToValueAtTime(0.001, start + 0.16);
    oscillator.connect(gain).connect(audio.destination);
    oscillator.start(start);
    oscillator.stop(start + 0.18);
  });
}

function showHome() {
  stopGame();
  homeButton.classList.add("hidden");
  const view = document.querySelector("#home-template").content.cloneNode(true);
  const grid = view.querySelector("#mission-grid");
  missions.forEach(mission => {
    const button = document.createElement("button");
    button.className = "mission-card";
    const record = best[mission.id] ? `最佳：${best[mission.id]} ${mission.unit}` : "還沒玩過";
    button.innerHTML = `<span class="mission-icon">${mission.icon}</span><span><h2>${mission.title}</h2><p>${mission.summary}</p><small>${record}</small></span><span class="mission-status" aria-hidden="true">›</span>`;
    button.addEventListener("click", () => startMission(mission));
    grid.append(button);
  });
  app.replaceChildren(view);
  document.title = "布麗的生活任務";
}

function stopGame() {
  if (!current) return;
  current.level.stage.dispose();
  current.stopLoop?.();
  clearTimeout(current.hintTimer);
  current = null;
  if ("speechSynthesis" in window) speechSynthesis.cancel();
}

function startMission(mission) {
  stopGame();
  homeButton.classList.remove("hidden");
  const view = document.querySelector("#game-template").content.cloneNode(true);
  app.replaceChildren(view);
  document.title = `${mission.title}｜生活任務`;
  const $ = selector => app.querySelector(selector);
  $("#game-title").textContent = `${mission.icon} ${mission.title}`;
  $("#timer").textContent = formatTime(GAME_SECONDS);
  $("#score-unit").textContent = mission.unit;

  const session = { mission, clock: createClock(), playing: false };
  const ui = {
    guide: html => { $("#guide").innerHTML = html; },
    score: n => {
      $("#score").textContent = n;
      $("#score-box").animate([{ transform: "scale(1.3)" }, { transform: "none" }], { duration: 300 });
    },
    say: text => speak(text),
    sfx: kind => tone(kind),
    hint: text => { if (text) toast(text, "gentle"); tone("soft"); speak(text); },
    good: text => { toast(text, "good"); tone("good"); speak(text); }
  };
  function toast(text, kind) {
    const bubble = $("#toast");
    if (!bubble) return;
    bubble.textContent = text;
    bubble.className = `toast show ${kind}`;
    clearTimeout(session.hintTimer);
    session.hintTimer = setTimeout(() => bubble.classList.remove("show"), 2200);
  }

  session.level = levels[mission.id]($("#scene"), ui);
  current = session;

  $("#intro-title").textContent = mission.title;
  $("#intro-text").textContent = session.level.intro;
  $("#intro-best").textContent = best[mission.id] ? `目前最佳：${best[mission.id]} ${mission.unit}` : "";
  speak(session.level.intro);
  $("#start-button").addEventListener("click", () => {
    $("#intro").remove();
    countdown(session, $);
  });
  $("#repeat-button").addEventListener("click", () => speak(session.level.intro));
}

function countdown(session, $) {
  const overlay = $("#countdown");
  overlay.classList.remove("hidden");
  const steps = ["3", "2", "1", "開始！"];
  steps.forEach((text, i) => setTimeout(() => {
    if (current !== session) return;
    overlay.textContent = text;
    tone(i === steps.length - 1 ? "good" : "pop");
    if (i === steps.length - 1) {
      speak("開始！");
      setTimeout(() => overlay.classList.add("hidden"), 500);
      play(session, $);
    }
  }, i * 750));
}

function play(session, $) {
  session.playing = true;
  session.level.stage.enabled = true;
  let shown = "";
  session.stopLoop = session.level.stage.onUpdate(dt => {
    if (!session.playing) return;
    tickClock(session.clock, dt);
    session.level.update(dt);
    const text = formatTime(session.clock.left);
    if (text !== shown) {
      shown = text;
      $("#timer").textContent = text;
      $("#timer-box").classList.toggle("hurry", session.clock.left <= 30);
      if (text === "0:30") speak("還有三十秒！");
    }
    if (session.clock.over) finish(session, $);
  });
}

function finish(session, $) {
  session.playing = false;
  session.level.stage.enabled = false;
  const score = session.level.score();
  const previous = best[session.mission.id] || 0;
  best = bestScores(best, session.mission.id, score);
  localStorage.setItem("bluey-best", JSON.stringify(best));
  const stars = starsFor(score);
  const result = $("#result");
  result.innerHTML = `
    <div class="result-card">
      <p class="eyebrow">時間到！</p>
      <span class="big">${session.mission.icon}</span>
      <h2>${score} ${session.mission.unit}</h2>
      <div class="stars" aria-label="${stars} 顆星">${"★".repeat(stars)}<span>${"★".repeat(3 - stars)}</span></div>
      <p>${score > previous && previous > 0 ? "🎉 打破紀錄了！" : score > 0 ? "做得真好，謝謝你幫忙！" : "沒關係，再試一次會更熟練！"}</p>
      <div class="action-row"><button id="again" class="primary">再玩一次</button><button id="to-home" class="secondary">選其他任務</button></div>
    </div>`;
  result.classList.remove("hidden");
  $("#again").addEventListener("click", () => startMission(session.mission));
  $("#to-home").addEventListener("click", showHome);
  tone("end");
  speak(`時間到！你完成了${score}${session.mission.unit}。`);
}

homeButton.addEventListener("click", showHome);
soundButton.addEventListener("click", () => {
  voiceOn = !voiceOn;
  localStorage.setItem("bluey-voice", voiceOn ? "on" : "off");
  soundButton.textContent = voiceOn ? "🔊" : "🔇";
  soundButton.setAttribute("aria-label", voiceOn ? "關閉聲音" : "開啟聲音");
  if (!voiceOn && "speechSynthesis" in window) speechSynthesis.cancel();
  if (voiceOn) speak("聲音已開啟");
});
soundButton.textContent = voiceOn ? "🔊" : "🔇";

if ("serviceWorker" in navigator) window.addEventListener("load", () => navigator.serviceWorker.register("./sw.js"));
// 自動化測試用：網址加上 ?debug 才會開放
if (new URLSearchParams(location.search).has("debug")) window.__game = () => current;
showHome();
