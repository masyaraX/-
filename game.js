"use strict";

const canvas = document.querySelector("#gameCanvas");
const ctx = canvas.getContext("2d");

const ui = {
  wave: document.querySelector("#wave"),
  life: document.querySelector("#life"),
  money: document.querySelector("#money"),
  score: document.querySelector("#score"),
  combo: document.querySelector("#combo"),
  towerList: document.querySelector("#towerList"),
  skillList: document.querySelector("#skillList"),
  achievementList: document.querySelector("#achievementList"),
  battleStats: document.querySelector("#battleStats"),
  selectionInfo: document.querySelector("#selectionInfo"),
  upgradeBtn: document.querySelector("#upgradeBtn"),
  sellBtn: document.querySelector("#sellBtn"),
  startBtn: document.querySelector("#startBtn"),
  pauseBtn: document.querySelector("#pauseBtn"),
  speedBtn: document.querySelector("#speedBtn"),
  saveBtn: document.querySelector("#saveBtn"),
  mapSelect: document.querySelector("#mapSelect"),
  battleLog: document.querySelector("#battleLog"),
  toast: document.querySelector("#toast"),
  settingsBtn: document.querySelector("#settingsBtn"),
  settingsDialog: document.querySelector("#settingsDialog"),
  resetProgressBtn: document.querySelector("#resetProgressBtn"),
  volumeRange: document.querySelector("#volumeRange"),
  qualitySelect: document.querySelector("#qualitySelect"),
  fpsSelect: document.querySelector("#fpsSelect"),
  darkModeToggle: document.querySelector("#darkModeToggle")
};

const grid = { cols: 15, rows: 10, tile: 64 };
const storageKey = "tower-defense-web-save-v1";

const gameData = window.TD_GAME_DATA;
if (!gameData) {
  throw new Error("data/game-data.js を game.js より先に読み込んでください。");
}
const towerTypes = gameData.towerTypes;
const enemyTypes = gameData.enemyTypes;
const maps = gameData.maps;

const skills = [
  { id: "bomb", name: "爆撃", cd: 26, ready: 0, text: "全体に220ダメージ", run: () => damageAll(220, false) },
  { id: "meteor", name: "隕石", cd: 38, ready: 0, text: "最も進んだ敵へ大爆発", run: meteor },
  { id: "emp", name: "EMP", cd: 26, ready: 0, text: "敵を4秒停止", run: () => state.enemies.forEach((e) => e.stun = Math.max(e.stun, 4)) },
  { id: "time", name: "時間停止", cd: 50, ready: 0, text: "全敵を6秒停止", run: () => state.enemies.forEach((e) => e.stun = Math.max(e.stun, 6)) },
  { id: "money", name: "資金ボーナス", cd: 36, ready: 0, text: "+180G", run: () => state.money += 180 },
  { id: "heal", name: "回復", cd: 44, ready: 0, text: "Life +4", run: () => state.life = Math.min(30, state.life + 4) }
];

const achievements = [
  { id: "firstWin", name: "初勝利", done: false, test: () => state.wave > 5 },
  { id: "wave10", name: "10Wave", done: false, test: () => state.wave >= 10 },
  { id: "kills100", name: "100体撃破", done: false, test: () => state.kills >= 100 },
  { id: "combo50", name: "50コンボ", done: false, test: () => state.bestCombo >= 50 },
  { id: "perfect5", name: "5連続ノーダメージWave", done: false, test: () => state.perfectWaves >= 5 },
  { id: "lv5", name: "全タワーLv5", done: false, test: () => state.towers.some((t) => t.level >= 5) },
  { id: "noDamage", name: "ノーダメージ", done: false, test: () => state.wave >= 5 && state.life === 20 }
];

const state = {
  wave: 1,
  life: 20,
  money: 500,
  score: 0,
  kills: 0,
  combo: 0,
  comboTimer: 0,
  bestCombo: 0,
  perfectWaves: 0,
  leaksThisWave: 0,
  rushWindow: 0,
  mapTimer: 10,
  running: false,
  paused: false,
  speed: 1,
  selectedTowerType: towerTypes[0],
  selectedTower: null,
  map: maps[0],
  towers: [],
  enemies: [],
  projectiles: [],
  effects: [],
  spawnQueue: [],
  spawnTimer: 0,
  waveActive: false,
  lastSave: 0,
  audioReady: false,
  volume: 0.35,
  fps: 60,
  quality: "high",
  logs: []
};

let lastTime = 0;
let toastTimer = 0;
let audioContext;
let masterGain;

function pathPoints(map = state.map) {
  return map.path.map(([x, y]) => ({ x: x * grid.tile + grid.tile / 2, y: y * grid.tile + grid.tile / 2 }));
}

function setupUi() {
  ui.mapSelect.innerHTML = maps.map((map) => `<option value="${map.id}">${map.name} 難度${map.difficulty}</option>`).join("");
  ui.towerList.innerHTML = "";
  towerTypes.forEach((tower) => {
    const button = document.createElement("button");
    button.className = "tower-card";
    button.type = "button";
    button.dataset.id = tower.id;
    button.innerHTML = `
      <span class="tower-mark" style="background:${tower.color}">${tower.mark}</span>
      <span class="tower-meta">
        <strong>${tower.name}</strong>
        <span class="cost">${tower.cost}G</span>
        <span class="tower-stats">${tower.text}<br>${towerSummary(tower, 1)}</span>
      </span>
    `;
    button.addEventListener("click", () => {
      state.selectedTowerType = tower;
      state.selectedTower = null;
      renderTowerList();
      refreshSelection();
    });
    ui.towerList.appendChild(button);
  });

  ui.skillList.innerHTML = "";
  skills.forEach((skill) => {
    const card = document.createElement("div");
    card.className = "skill-card";
    card.innerHTML = `<strong>${skill.name}</strong><span>${skill.text}</span><progress max="${skill.cd}" value="${skill.cd}"></progress><button type="button">発動</button>`;
    card.querySelector("button").addEventListener("click", () => useSkill(skill));
    skill.el = card;
    ui.skillList.appendChild(card);
  });

  ui.startBtn.addEventListener("click", startWave);
  ui.pauseBtn.addEventListener("click", togglePause);
  ui.speedBtn.addEventListener("click", toggleSpeed);
  ui.saveBtn.addEventListener("click", () => saveGame(true));
  ui.upgradeBtn.addEventListener("click", upgradeSelected);
  ui.sellBtn.addEventListener("click", sellSelected);
  ui.mapSelect.addEventListener("change", changeMap);
  ui.settingsBtn.addEventListener("click", () => ui.settingsDialog.showModal());
  ui.resetProgressBtn.addEventListener("click", resetProgress);
  ui.volumeRange.addEventListener("input", () => {
    state.volume = Number(ui.volumeRange.value);
    if (masterGain) masterGain.gain.value = state.volume;
  });
  ui.qualitySelect.addEventListener("change", () => state.quality = ui.qualitySelect.value);
  ui.fpsSelect.addEventListener("change", () => state.fps = Number(ui.fpsSelect.value));
  ui.darkModeToggle.addEventListener("change", () => document.body.classList.toggle("light", !ui.darkModeToggle.checked));

  canvas.addEventListener("pointerdown", handleCanvasPointer);
  window.addEventListener("resize", draw);
  renderTowerList();
  renderAchievements();
}

function initAudio() {
  if (state.audioReady) return;
  audioContext = new (window.AudioContext || window.webkitAudioContext)();
  masterGain = audioContext.createGain();
  masterGain.gain.value = state.volume;
  masterGain.connect(audioContext.destination);
  state.audioReady = true;
}

function beep(freq, duration = 0.08, type = "sine") {
  if (!state.audioReady || !audioContext) return;
  const osc = audioContext.createOscillator();
  const gain = audioContext.createGain();
  osc.type = type;
  osc.frequency.value = freq;
  gain.gain.setValueAtTime(0.001, audioContext.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.25, audioContext.currentTime + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.001, audioContext.currentTime + duration);
  osc.connect(gain);
  gain.connect(masterGain);
  osc.start();
  osc.stop(audioContext.currentTime + duration);
}

function renderTowerList() {
  [...ui.towerList.children].forEach((el) => {
    el.classList.toggle("selected", el.dataset.id === state.selectedTowerType.id && !state.selectedTower);
  });
}

function renderAchievements() {
  ui.achievementList.innerHTML = "";
  achievements.forEach((a) => {
    const el = document.createElement("div");
    el.className = `achievement ${a.done ? "done" : ""}`;
    el.textContent = `${a.done ? "✓" : "□"} ${a.name}`;
    ui.achievementList.appendChild(el);
  });
}

function handleCanvasPointer(event) {
  initAudio();
  const rect = canvas.getBoundingClientRect();
  const x = (event.clientX - rect.left) * (canvas.width / rect.width);
  const y = (event.clientY - rect.top) * (canvas.height / rect.height);
  const existing = state.towers.find((tower) => distance(tower.x, tower.y, x, y) < 26);
  if (existing) {
    state.selectedTower = existing;
    renderTowerList();
    refreshSelection();
    return;
  }

  const cell = {
    col: Math.floor(x / grid.tile),
    row: Math.floor(y / grid.tile)
  };
  placeTower(cell.col, cell.row);
}

function placeTower(col, row) {
  if (!inBounds(col, row)) return;
  if (isPathCell(col, row)) return notify("進路上には設置できません");
  if (state.towers.length >= state.map.buildLimit) return notify("このマップの設置上限です");
  if (state.towers.some((tower) => tower.col === col && tower.row === row)) return notify("ここには既にタワーがあります");
  const type = state.selectedTowerType;
  if (state.money < type.cost) return notify("資金が足りません");
  state.money -= type.cost;
  const tower = {
    id: crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`,
    typeId: type.id,
    level: 1,
    col,
    row,
    x: col * grid.tile + grid.tile / 2,
    y: row * grid.tile + grid.tile / 2,
    cooldown: 0,
    kills: 0
  };
  state.towers.push(tower);
  state.selectedTower = tower;
  beep(550, 0.06, "square");
  refreshSelection();
  log(`${type.name}を設置`);
}

function startWave() {
  initAudio();
  if (state.life <= 0) resetGame();
  if (state.waveActive) return notify("Wave進行中です");
  if (state.rushWindow > 0) {
    const rushBonus = Math.round(40 + state.wave * 12 + state.rushWindow * 8);
    state.money += rushBonus;
    state.score += rushBonus * 8;
    addFloatingText(canvas.width / 2, 72, `Rush +${rushBonus}G`, "#f6c85f", 20);
    log(`早送りボーナス +${rushBonus}G`);
  }
  state.rushWindow = 0;
  state.leaksThisWave = 0;
  state.running = true;
  state.paused = false;
  state.waveActive = true;
  state.spawnQueue = buildWave(state.wave);
  state.spawnTimer = 0;
  ui.pauseBtn.textContent = "一時停止";
  log(`Wave ${state.wave} 開始`);
  beep(330, 0.1, "triangle");
}

function buildWave(wave) {
  const count = Math.min(1000, 8 + wave * 3 + Math.floor(wave ** 1.18));
  const queue = [];
  for (let i = 0; i < count; i++) {
    let type = "normal";
    if (wave % 10 === 0 && i === count - 1) type = "boss";
    else if (wave > 3 && i % 7 === 0) type = "fast";
    else if (wave > 5 && i % 9 === 0) type = "heavy";
    else if (wave > 7 && i % 11 === 0) type = "flying";
    else if (wave > 9 && i % 13 === 0) type = "healer";
    const elite = wave > 4 && (i + wave) % Math.max(5, 13 - Math.floor(wave / 8)) === 0;
    queue.push({ typeId: type, elite });
  }
  return queue;
}

function spawnEnemy(entry) {
  const typeId = typeof entry === "string" ? entry : entry.typeId;
  const elite = typeof entry === "object" && !!entry.elite;
  const base = enemyTypes[typeId];
  const scale = 1 + state.wave * 0.14 + state.map.difficulty * 0.05;
  const eliteScale = elite ? 1.85 : 1;
  const mapSpeed = state.map.id === "snow" ? 0.92 : 1;
  const points = pathPoints();
  state.enemies.push({
    typeId,
    name: elite ? `精鋭${base.name}` : base.name,
    maxHp: Math.round(base.hp * scale * eliteScale),
    hp: Math.round(base.hp * scale * eliteScale),
    speed: base.speed * (1 + state.wave * 0.012) * mapSpeed * (elite ? 0.92 : 1),
    reward: Math.round(base.reward * (1 + state.wave * 0.04) * (elite ? 2.4 : 1)),
    armor: base.armor + (elite ? 4 : 0),
    elite,
    flying: !!base.flying,
    healer: !!base.healer,
    boss: !!base.boss,
    shield: base.shield || 0,
    color: base.color,
    x: points[0].x,
    y: points[0].y,
    segment: 0,
    progress: 0,
    slow: 1,
    slowTime: 0,
    poisonTime: 0,
    poisonDamage: 0,
    stun: 0
  });
}

function togglePause() {
  if (!state.running) return;
  state.paused = !state.paused;
  ui.pauseBtn.textContent = state.paused ? "再開" : "一時停止";
}

function toggleSpeed() {
  state.speed = state.speed === 1 ? 2 : state.speed === 2 ? 4 : 1;
  ui.speedBtn.textContent = `倍速 x${state.speed}`;
}

function update(dt) {
  if (!state.running || state.paused) return;
  const step = dt * state.speed;
  state.comboTimer = Math.max(0, state.comboTimer - step);
  if (state.comboTimer <= 0) state.combo = 0;
  state.rushWindow = Math.max(0, state.rushWindow - step);
  updateMapGimmick(step);
  updateSkills(step);
  spawnTick(step);
  updateEnemies(step);
  updateTowers(step);
  updateProjectiles(step);
  updateEffects(step);
  checkWaveEnd();
  checkAchievements();
  state.lastSave += step;
  if (state.lastSave >= 30) saveGame(false);
}

function spawnTick(dt) {
  if (!state.waveActive || state.spawnQueue.length === 0) return;
  state.spawnTimer -= dt;
  if (state.spawnTimer <= 0) {
    spawnEnemy(state.spawnQueue.shift());
    state.spawnTimer = Math.max(0.12, 0.85 - state.wave * 0.008);
  }
}

function updateEnemies(dt) {
  const points = pathPoints();
  for (let i = state.enemies.length - 1; i >= 0; i--) {
    const enemy = state.enemies[i];
    if (enemy.stun > 0) enemy.stun -= dt;
    if (enemy.slowTime > 0) enemy.slowTime -= dt;
    else enemy.slow = 1;
    if (enemy.poisonTime > 0) {
      enemy.poisonTime -= dt;
      enemy.hp -= enemy.poisonDamage * dt;
    }
    if (enemy.healer) healNearby(enemy, dt);
    if (enemy.hp <= 0) {
      killEnemy(enemy, i);
      continue;
    }
    if (enemy.stun > 0) continue;
    let remaining = enemy.speed * enemy.slow * dt;
    let reachedGoal = false;
    while (remaining > 0 && !reachedGoal) {
      const from = points[enemy.segment];
      const to = points[enemy.segment + 1];
      if (!to) {
        reachedGoal = true;
        break;
      }
      const segLength = distance(from.x, from.y, to.x, to.y);
      const left = segLength - enemy.progress;
      if (remaining >= left) {
        enemy.segment += 1;
        enemy.progress = 0;
        remaining -= left;
        reachedGoal = enemy.segment >= points.length - 1;
      } else {
        enemy.progress += remaining;
        remaining = 0;
      }
    }
    if (reachedGoal) {
      state.life -= enemy.boss ? 5 : 1;
      state.leaksThisWave += enemy.boss ? 5 : 1;
      state.enemies.splice(i, 1);
      log(`${enemy.name}がゴール到達`);
      beep(130, 0.16, "sawtooth");
      if (state.life <= 0) gameOver();
      continue;
    }
    const currentFrom = points[enemy.segment];
    const currentTo = points[enemy.segment + 1];
    const currentLength = distance(currentFrom.x, currentFrom.y, currentTo.x, currentTo.y);
    const t = Math.min(1, enemy.progress / currentLength);
    enemy.x = lerp(currentFrom.x, currentTo.x, t);
    enemy.y = lerp(currentFrom.y, currentTo.y, t);
  }
}

function healNearby(enemy, dt) {
  state.enemies.forEach((other) => {
    if (other !== enemy && distance(enemy.x, enemy.y, other.x, other.y) < 90) {
      other.hp = Math.min(other.maxHp, other.hp + 10 * dt);
    }
  });
}

function killEnemy(enemy, index) {
  state.enemies.splice(index, 1);
  state.combo += 1;
  state.comboTimer = Math.min(4.5, 2.4 + state.combo * 0.015);
  state.bestCombo = Math.max(state.bestCombo, state.combo);
  const multiplier = comboMultiplier();
  const scoreGain = Math.round((enemy.reward * 10 + state.wave * 5) * multiplier);
  const moneyBonus = state.combo > 0 && state.combo % 10 === 0 ? Math.round(12 + state.combo * 0.8) : 0;
  state.money += enemy.reward;
  state.money += moneyBonus;
  state.score += scoreGain;
  state.kills += 1;
  state.effects.push({ x: enemy.x, y: enemy.y, radius: 4, max: enemy.boss ? 70 : 34, color: enemy.color, life: 0.35 });
  addFloatingText(enemy.x, enemy.y - 22, `x${state.combo}`, "#f6c85f", Math.min(22, 12 + state.combo / 7));
  if (moneyBonus) addFloatingText(enemy.x, enemy.y - 42, `+${moneyBonus}G`, "#42d392", 15);
  beep(enemy.boss ? 90 : 220, 0.05, "triangle");
}

function updateTowers(dt) {
  state.towers.forEach((tower) => {
    tower.cooldown -= dt;
    const type = getTowerType(tower);
    if (tower.cooldown > 0) return;
    const target = findTarget(tower, type);
    if (!target) return;
    fireTower(tower, type, target);
    tower.cooldown = Math.max(0.08, type.rate * (1 - (tower.level - 1) * 0.055));
  });
}

function findTarget(tower, type) {
  const range = towerRange(type, tower.level);
  return state.enemies
    .filter((enemy) => type.tags.includes(enemy.flying ? "air" : "ground") && distance(tower.x, tower.y, enemy.x, enemy.y) <= range)
    .sort((a, b) => routeValue(b) - routeValue(a))[0];
}

function fireTower(tower, type, target) {
  const critChance = Math.min(0.32, 0.05 + tower.level * 0.035 + state.combo * 0.001);
  const critical = Math.random() < critChance;
  const damage = towerDamage(type, tower.level) * (critical ? 1.75 : 1);
  if (type.type === "laser") {
    const angle = Math.atan2(target.y - tower.y, target.x - tower.x);
    state.enemies.forEach((enemy) => {
      const projection = pointLineDistance(enemy.x, enemy.y, tower.x, tower.y, angle);
      if (projection.dist < 18 && projection.forward > 0 && projection.forward < towerRange(type, tower.level)) {
        applyDamage(enemy, damage, type, tower, critical);
      }
    });
    state.effects.push({ kind: "beam", x: tower.x, y: tower.y, x2: target.x, y2: target.y, color: type.color, life: 0.12 });
  } else {
    state.projectiles.push({
      x: tower.x,
      y: tower.y,
      target,
      speed: type.type === "missile" ? 280 : 560,
      damage,
      typeId: type.id,
      color: type.color,
      splash: type.splash || 0,
      critical,
      tower
    });
  }
  beep(type.type === "missile" ? 180 : 640, 0.025, type.type === "laser" ? "sawtooth" : "square");
}

function updateProjectiles(dt) {
  for (let i = state.projectiles.length - 1; i >= 0; i--) {
    const p = state.projectiles[i];
    if (!state.enemies.includes(p.target) || p.target.hp <= 0) {
      state.projectiles.splice(i, 1);
      continue;
    }
    const d = distance(p.x, p.y, p.target.x, p.target.y);
    const move = p.speed * dt;
    if (d <= move) {
      const type = towerTypes.find((t) => t.id === p.typeId);
      if (p.splash > 0) {
        state.enemies.forEach((enemy) => {
        if (distance(enemy.x, enemy.y, p.target.x, p.target.y) <= p.splash) applyDamage(enemy, p.damage, type, p.tower, p.critical);
        });
        state.effects.push({ x: p.target.x, y: p.target.y, radius: 8, max: p.splash, color: p.color, life: 0.22 });
      } else {
        applyDamage(p.target, p.damage, type, p.tower, p.critical);
      }
      state.projectiles.splice(i, 1);
    } else {
      p.x += ((p.target.x - p.x) / d) * move;
      p.y += ((p.target.y - p.y) / d) * move;
    }
  }
}

function applyDamage(enemy, amount, type, tower, critical = false) {
  let damage = Math.max(1, amount - enemy.armor);
  if (enemy.shield) damage *= 1 - enemy.shield;
  enemy.hp -= damage;
  if (critical || damage > 70) {
    addFloatingText(enemy.x, enemy.y - 18, `${critical ? "CRIT " : ""}${Math.round(damage)}`, critical ? "#ff5f68" : "#ffffff", critical ? 18 : 13);
  }
  if (type.type === "ice") {
    enemy.slow = type.slow;
    enemy.slowTime = type.slowTime;
  }
  if (type.type === "poison") {
    enemy.poisonDamage = Math.max(enemy.poisonDamage, type.poison * (1 + (tower.level - 1) * 0.18));
    enemy.poisonTime = Math.max(enemy.poisonTime, type.poisonTime);
  }
}

function updateEffects(dt) {
  state.effects = state.effects.filter((effect) => {
    effect.life -= dt;
    if (effect.kind === "text") {
      effect.y -= 30 * dt;
      effect.x += effect.drift * dt;
    }
    if (effect.radius) effect.radius = lerp(effect.radius, effect.max, 0.25);
    return effect.life > 0;
  });
}

function updateMapGimmick(dt) {
  if (state.map.id !== "volcano" || !state.waveActive) return;
  state.mapTimer -= dt;
  if (state.mapTimer > 0) return;
  state.mapTimer = 9 + Math.random() * 5;
  const target = state.enemies[Math.floor(Math.random() * state.enemies.length)];
  if (!target) return;
  state.enemies.forEach((enemy) => {
    if (distance(enemy.x, enemy.y, target.x, target.y) < 120) enemy.hp -= 180 + state.wave * 12;
  });
  state.effects.push({ x: target.x, y: target.y, radius: 12, max: 130, color: "#fb923c", life: 0.45 });
  addFloatingText(target.x, target.y - 36, "火山弾", "#fb923c", 20);
}

function addFloatingText(x, y, text, color, size = 14) {
  state.effects.push({
    kind: "text",
    x,
    y,
    text,
    color,
    size,
    drift: (Math.random() - 0.5) * 18,
    life: 0.75
  });
}

function comboMultiplier() {
  return Math.min(3, 1 + state.combo * 0.035);
}

function checkWaveEnd() {
  if (!state.waveActive || state.spawnQueue.length || state.enemies.length) return;
  state.waveActive = false;
  if (state.leaksThisWave === 0) {
    state.perfectWaves += 1;
    const perfectBonus = 70 + state.perfectWaves * 18;
    state.money += perfectBonus;
    state.score += perfectBonus * 10;
    addFloatingText(canvas.width / 2, 120, `Perfect +${perfectBonus}G`, "#42d392", 22);
  } else {
    state.perfectWaves = 0;
  }
  state.wave += 1;
  let bonus = 90 + state.wave * 18;
  if (state.map.id === "desert") bonus = Math.round(bonus * 1.1);
  if (state.map.id === "maze" && state.wave >= 10) bonus = Math.round(bonus * 1.15);
  state.money += bonus;
  state.score += bonus * 5;
  state.rushWindow = 8;
  saveGame(false);
  log(`Waveクリア +${bonus}G`);
  notify(`Wave ${state.wave - 1} クリア / 次Wave早押しボーナス`);
}

function checkAchievements() {
  let changed = false;
  achievements.forEach((achievement) => {
    if (!achievement.done && achievement.test()) {
      achievement.done = true;
      changed = true;
      log(`実績解除: ${achievement.name}`);
    }
  });
  if (changed) renderAchievements();
}

function upgradeSelected() {
  const tower = state.selectedTower;
  if (!tower) return;
  if (tower.level >= 5) return notify("最大Lvです");
  const cost = upgradeCost(tower);
  if (state.money < cost) return notify("資金が足りません");
  state.money -= cost;
  tower.level += 1;
  beep(820, 0.09, "triangle");
  log(`${getTowerType(tower).name} Lv${tower.level}`);
  refreshSelection();
}

function sellSelected() {
  const tower = state.selectedTower;
  if (!tower) return;
  const index = state.towers.indexOf(tower);
  if (index < 0) return;
  const cityBonus = state.map.id === "city" ? 1.2 : 1;
  state.money += Math.round(getTowerType(tower).cost * (0.55 + tower.level * 0.08) * cityBonus);
  state.towers.splice(index, 1);
  state.selectedTower = null;
  refreshSelection();
}

function refreshSelection() {
  if (state.selectedTower) {
    const type = getTowerType(state.selectedTower);
    const next = state.selectedTower.level >= 5 ? "MAX" : `${upgradeCost(state.selectedTower)}G`;
    ui.selectionInfo.innerHTML = `<strong>${type.name} Lv${state.selectedTower.level}</strong><br>${towerSummary(type, state.selectedTower.level)}<br>次Lv: ${next}`;
    ui.upgradeBtn.disabled = state.selectedTower.level >= 5;
    ui.sellBtn.disabled = false;
  } else {
    const type = state.selectedTowerType;
    ui.selectionInfo.innerHTML = `<strong>${type.name}</strong><br>${type.text}<br>価格 ${type.cost}G<br>${towerSummary(type, 1)}`;
    ui.upgradeBtn.disabled = true;
    ui.sellBtn.disabled = true;
  }
}

function useSkill(skill) {
  initAudio();
  if (skill.ready > 0) return notify("クールタイム中です");
  if (!state.waveActive || state.paused) return notify("Wave中のみ発動できます");
  if (!canUseSkill(skill)) return notify("今は効果対象がありません");
  skill.run();
  skill.ready = skill.cd;
  log(`${skill.name} 発動`);
  beep(440, 0.12, "sine");
}

function updateSkills(dt) {
  skills.forEach((skill) => {
    skill.ready = Math.max(0, skill.ready - dt);
  });
}

function damageAll(amount, includeBoss) {
  state.enemies.forEach((enemy) => {
    if (includeBoss || !enemy.boss) enemy.hp -= amount;
  });
  state.effects.push({ x: canvas.width / 2, y: canvas.height / 2, radius: 20, max: 460, color: "#ff9f43", life: 0.35 });
}

function meteor() {
  const target = state.enemies.sort((a, b) => routeValue(b) - routeValue(a))[0];
  if (!target) return;
  state.enemies.forEach((enemy) => {
    if (distance(enemy.x, enemy.y, target.x, target.y) < 145) enemy.hp -= 650;
  });
  state.effects.push({ x: target.x, y: target.y, radius: 12, max: 145, color: "#f97316", life: 0.45 });
}

function draw() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  drawMap();
  drawTowers();
  drawEnemies();
  drawProjectiles();
  drawEffects();
  drawPlacementPreview();
  refreshHud();
}

function drawMap() {
  ctx.fillStyle = state.map.bg;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.strokeStyle = "rgba(255,255,255,0.08)";
  ctx.lineWidth = 1;
  for (let x = 0; x <= grid.cols; x++) {
    ctx.beginPath();
    ctx.moveTo(x * grid.tile, 0);
    ctx.lineTo(x * grid.tile, canvas.height);
    ctx.stroke();
  }
  for (let y = 0; y <= grid.rows; y++) {
    ctx.beginPath();
    ctx.moveTo(0, y * grid.tile);
    ctx.lineTo(canvas.width, y * grid.tile);
    ctx.stroke();
  }
  const points = pathPoints();
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.strokeStyle = "#8a7350";
  ctx.lineWidth = 46;
  ctx.beginPath();
  points.forEach((p, i) => i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y));
  ctx.stroke();
  ctx.strokeStyle = "#c7a66b";
  ctx.lineWidth = 30;
  ctx.stroke();
  ctx.lineCap = "butt";
  ctx.fillStyle = "#42d392";
  ctx.fillRect(points[0].x - 22, points[0].y - 22, 44, 44);
  ctx.fillStyle = "#ff5f68";
  const end = points[points.length - 1];
  ctx.fillRect(end.x - 22, end.y - 22, 44, 44);
}

function drawTowers() {
  state.towers.forEach((tower) => {
    const type = getTowerType(tower);
    if (state.selectedTower === tower) {
      ctx.beginPath();
      ctx.fillStyle = "rgba(66, 211, 146, 0.1)";
      ctx.strokeStyle = "rgba(66, 211, 146, 0.65)";
      ctx.arc(tower.x, tower.y, towerRange(type, tower.level), 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }
    ctx.beginPath();
    ctx.fillStyle = type.color;
    ctx.arc(tower.x, tower.y, 22, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#081015";
    ctx.font = "bold 15px Segoe UI";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(type.mark, tower.x, tower.y - 2);
    ctx.fillStyle = "#fff";
    ctx.font = "10px Segoe UI";
    ctx.fillText(`Lv${tower.level}`, tower.x, tower.y + 14);
  });
}

function drawEnemies() {
  state.enemies.forEach((enemy) => {
    ctx.beginPath();
    ctx.fillStyle = enemy.color;
    ctx.arc(enemy.x, enemy.y, enemy.boss ? 24 : enemy.flying ? 16 : 14, 0, Math.PI * 2);
    ctx.fill();
    if (enemy.flying) {
      ctx.strokeStyle = "#ffffff";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(enemy.x - 18, enemy.y);
      ctx.lineTo(enemy.x + 18, enemy.y);
      ctx.stroke();
    }
    if (enemy.elite) {
      ctx.strokeStyle = "#f6c85f";
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(enemy.x, enemy.y, enemy.boss ? 30 : 21, 0, Math.PI * 2);
      ctx.stroke();
    }
    if (enemy.stun > 0) {
      ctx.strokeStyle = "#facc15";
      ctx.lineWidth = 3;
      ctx.strokeRect(enemy.x - 18, enemy.y - 18, 36, 36);
    }
    const width = enemy.boss ? 54 : 34;
    ctx.fillStyle = "rgba(0,0,0,0.55)";
    ctx.fillRect(enemy.x - width / 2, enemy.y - 29, width, 5);
    ctx.fillStyle = enemy.hp / enemy.maxHp > 0.45 ? "#42d392" : "#ff5f68";
    ctx.fillRect(enemy.x - width / 2, enemy.y - 29, width * Math.max(0, enemy.hp / enemy.maxHp), 5);
  });
}

function drawProjectiles() {
  state.projectiles.forEach((p) => {
    ctx.beginPath();
    ctx.fillStyle = p.color;
    ctx.arc(p.x, p.y, p.splash ? 6 : 4, 0, Math.PI * 2);
    ctx.fill();
  });
}

function drawEffects() {
  state.effects.forEach((effect) => {
    ctx.save();
    ctx.globalAlpha = Math.max(0, effect.life * 2.6);
    if (effect.kind === "text") {
      ctx.fillStyle = effect.color;
      ctx.font = `bold ${effect.size}px Segoe UI`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.lineWidth = 4;
      ctx.strokeStyle = "rgba(0,0,0,0.55)";
      ctx.strokeText(effect.text, effect.x, effect.y);
      ctx.fillText(effect.text, effect.x, effect.y);
    } else if (effect.kind === "beam") {
      ctx.strokeStyle = effect.color;
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.moveTo(effect.x, effect.y);
      ctx.lineTo(effect.x2, effect.y2);
      ctx.stroke();
    } else {
      ctx.strokeStyle = effect.color;
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.arc(effect.x, effect.y, effect.radius, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.restore();
  });
}

function drawPlacementPreview() {
  if (state.selectedTower) return;
  const type = state.selectedTowerType;
  ctx.fillStyle = type.color;
  ctx.globalAlpha = 0.12;
  ctx.fillRect(0, 0, 0, 0);
  ctx.globalAlpha = 1;
}

function refreshHud() {
  ui.wave.textContent = state.wave;
  ui.life.textContent = Math.max(0, state.life);
  ui.money.textContent = `${state.money}G`;
  ui.score.textContent = state.score;
  ui.combo.textContent = state.combo > 0 ? `${state.combo} x${comboMultiplier().toFixed(1)}` : "0";
  ui.startBtn.textContent = state.waveActive ? "進行中" : state.rushWindow > 0 ? `次Wave +${Math.round(40 + state.wave * 12 + state.rushWindow * 8)}G` : "開始";
  ui.startBtn.disabled = state.waveActive;
  ui.pauseBtn.disabled = !state.running || state.life <= 0;
  ui.battleStats.innerHTML = `
    <div class="stat-card"><strong>${state.bestCombo}</strong>Best Combo</div>
    <div class="stat-card"><strong>${state.perfectWaves}</strong>Perfect Streak</div>
    <div class="stat-card"><strong>${state.map.buildLimit - state.towers.length}</strong>残り設置数</div>
    <div class="stat-card"><strong>${state.map.name}</strong>${state.map.gimmick}</div>
  `;
  skills.forEach((skill) => {
    if (!skill.el) return;
    const progress = skill.el.querySelector("progress");
    const button = skill.el.querySelector("button");
    progress.value = skill.cd - skill.ready;
    const usable = canUseSkill(skill);
    skill.el.classList.toggle("unavailable", !usable && skill.ready <= 0);
    button.disabled = skill.ready > 0 || !usable;
    button.textContent = skill.ready > 0 ? `${skill.ready.toFixed(0)}s` : usable ? "発動" : "待機";
  });
}

function gameLoop(time) {
  const targetFrame = 1000 / state.fps;
  if (time - lastTime >= targetFrame) {
    const dt = Math.min(0.05, (time - lastTime) / 1000 || 0);
    lastTime = time;
    update(dt);
    draw();
  }
  requestAnimationFrame(gameLoop);
}

function changeMap() {
  if (state.waveActive || state.enemies.length) {
    ui.mapSelect.value = state.map.id;
    return notify("Wave中はマップ変更できません");
  }
  state.map = maps.find((map) => map.id === ui.mapSelect.value) || maps[0];
  state.towers = [];
  state.selectedTower = null;
  log(`${state.map.name}へ移動`);
  refreshSelection();
}

function saveGame(manual) {
  const data = {
    wave: state.wave,
    life: state.life,
    money: state.money,
    score: state.score,
    kills: state.kills,
    bestCombo: state.bestCombo,
    perfectWaves: state.perfectWaves,
    mapId: state.map.id,
    towers: state.towers,
    achievements: achievements.map((a) => ({ id: a.id, done: a.done })),
    settings: {
      volume: state.volume,
      fps: state.fps,
      quality: state.quality,
      dark: ui.darkModeToggle.checked
    }
  };
  localStorage.setItem(storageKey, JSON.stringify(data));
  state.lastSave = 0;
  if (manual) notify("保存しました");
}

function loadGame() {
  const raw = localStorage.getItem(storageKey);
  if (!raw) return;
  try {
    const data = JSON.parse(raw);
    state.wave = data.wave || 1;
    state.life = data.life || 20;
    state.money = data.money ?? 500;
    state.score = data.score || 0;
    state.kills = data.kills || 0;
    state.bestCombo = data.bestCombo || 0;
    state.perfectWaves = data.perfectWaves || 0;
    state.map = maps.find((map) => map.id === data.mapId) || maps[0];
    state.towers = (data.towers || []).map((tower) => ({ ...tower, cooldown: 0 }));
    (data.achievements || []).forEach((saved) => {
      const found = achievements.find((a) => a.id === saved.id);
      if (found) found.done = saved.done;
    });
    if (data.settings) {
      state.volume = data.settings.volume ?? state.volume;
      state.fps = data.settings.fps ?? state.fps;
      state.quality = data.settings.quality || state.quality;
      ui.volumeRange.value = state.volume;
      ui.fpsSelect.value = String(state.fps);
      ui.qualitySelect.value = state.quality;
      ui.darkModeToggle.checked = data.settings.dark !== false;
      document.body.classList.toggle("light", !ui.darkModeToggle.checked);
    }
    ui.mapSelect.value = state.map.id;
  } catch {
    localStorage.removeItem(storageKey);
  }
}

function resetGame() {
  state.wave = 1;
  state.life = 20;
  state.money = 500;
  state.score = 0;
  state.kills = 0;
  state.combo = 0;
  state.comboTimer = 0;
  state.bestCombo = 0;
  state.perfectWaves = 0;
  state.leaksThisWave = 0;
  state.rushWindow = 0;
  state.towers = [];
  state.enemies = [];
  state.projectiles = [];
  state.spawnQueue = [];
  state.waveActive = false;
  state.running = false;
  state.paused = false;
}

function resetProgress() {
  const ok = window.confirm("保存データ、Wave、資金、タワー、実績をすべてリセットします。よろしいですか？");
  if (!ok) return;
  localStorage.removeItem(storageKey);
  resetGame();
  achievements.forEach((achievement) => achievement.done = false);
  skills.forEach((skill) => skill.ready = 0);
  state.selectedTowerType = towerTypes[0];
  state.selectedTower = null;
  state.map = maps[0];
  ui.mapSelect.value = state.map.id;
  renderTowerList();
  renderAchievements();
  refreshSelection();
  log("進捗をリセットしました");
  notify("進捗をリセットしました");
}

function gameOver() {
  state.running = false;
  state.waveActive = false;
  state.enemies = [];
  state.spawnQueue = [];
  notify(`Game Over: Wave ${state.wave}`);
  log("ゲームオーバー");
  saveGame(false);
}

function log(text) {
  state.logs.unshift(text);
  state.logs = state.logs.slice(0, 12);
  ui.battleLog.innerHTML = state.logs.map((entry) => `<li>${entry}</li>`).join("");
}

function notify(text) {
  ui.toast.textContent = text;
  ui.toast.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => ui.toast.classList.remove("show"), 1400);
}

function getTowerType(tower) {
  return towerTypes.find((type) => type.id === tower.typeId);
}

function upgradeCost(tower) {
  return Math.round(getTowerType(tower).cost * (0.65 + tower.level * 0.42));
}

function towerDamage(type, level) {
  return type.damage * (1 + (level - 1) * 0.24);
}

function towerRange(type, level) {
  const rangeBoost = state.map.id === "space" && (type.id === "laser" || type.id === "missile") ? 1.15 : 1;
  return type.range * (1 + (level - 1) * 0.08) * rangeBoost;
}

function towerRate(type, level) {
  return Math.max(0.08, type.rate * (1 - (level - 1) * 0.055));
}

function towerDps(type, level) {
  if (type.type === "ice") return towerDamage(type, level) / towerRate(type, level);
  if (type.type === "poison") return (towerDamage(type, level) + type.poison * type.poisonTime * 0.45) / towerRate(type, level);
  if (type.type === "splash" || type.type === "missile") return towerDamage(type, level) / towerRate(type, level);
  return towerDamage(type, level) / towerRate(type, level);
}

function towerSummary(type, level) {
  const dps = towerDps(type, level).toFixed(1);
  const range = Math.round(towerRange(type, level));
  const rate = towerRate(type, level).toFixed(2);
  const extra = type.splash ? ` / 爆風${type.splash}` : type.slow ? ` / 減速${Math.round((1 - type.slow) * 100)}%` : type.poison ? ` / 毒${type.poisonTime}s` : "";
  return `DPS ${dps} / 射程 ${range} / 間隔 ${rate}s${extra}`;
}

function canUseSkill(skill) {
  if (!state.waveActive || state.paused) return false;
  if (skill.id === "money") return true;
  if (skill.id === "heal") return state.life < 30;
  return state.enemies.length > 0;
}

function isPathCell(col, row) {
  const points = state.map.path;
  for (let i = 0; i < points.length - 1; i++) {
    const [x1, y1] = points[i];
    const [x2, y2] = points[i + 1];
    if (x1 === x2 && col === x1 && between(row, y1, y2)) return true;
    if (y1 === y2 && row === y1 && between(col, x1, x2)) return true;
  }
  return false;
}

function inBounds(col, row) {
  return col >= 0 && col < grid.cols && row >= 0 && row < grid.rows;
}

function routeValue(enemy) {
  return enemy.segment * 10000 + enemy.progress;
}

function pointLineDistance(px, py, x, y, angle) {
  const dx = px - x;
  const dy = py - y;
  const forward = dx * Math.cos(angle) + dy * Math.sin(angle);
  const side = Math.abs(-Math.sin(angle) * dx + Math.cos(angle) * dy);
  return { dist: side, forward };
}

function distance(x1, y1, x2, y2) {
  return Math.hypot(x2 - x1, y2 - y1);
}

function lerp(a, b, t) {
  return a + (b - a) * t;
}

function between(value, a, b) {
  return value >= Math.min(a, b) && value <= Math.max(a, b);
}

setupUi();
loadGame();
refreshSelection();
draw();
requestAnimationFrame(gameLoop);
