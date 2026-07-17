"use strict";

window.TD_GAME_DATA = {
  towerTypes: [
    { id: "normal", name: "ノーマル", mark: "N", cost: 130, damage: 18, range: 125, rate: 0.95, color: "#42d392", type: "projectile", tags: ["ground", "air"], text: "安定した基礎火力" },
    { id: "sniper", name: "スナイパー", mark: "S", cost: 250, damage: 92, range: 255, rate: 3.2, color: "#45a6ff", type: "projectile", tags: ["ground", "air"], text: "遠距離・高装甲向き" },
    { id: "machine", name: "マシンガン", mark: "M", cost: 285, damage: 6, range: 110, rate: 0.18, color: "#f6c85f", type: "projectile", tags: ["ground", "air"], text: "近距離の削り役" },
    { id: "splash", name: "範囲攻撃", mark: "A", cost: 380, damage: 60, range: 145, rate: 2, color: "#ff9f43", type: "splash", splash: 64, tags: ["ground"], text: "集団処理に強い" },
    { id: "ice", name: "氷", mark: "I", cost: 280, damage: 15, range: 135, rate: 1.45, color: "#8be9fd", type: "ice", slow: 0.64, slowTime: 2.3, tags: ["ground", "air"], text: "減速で味方を支援" },
    { id: "poison", name: "毒", mark: "P", cost: 330, damage: 12, range: 135, rate: 1.35, color: "#a3e635", type: "poison", poison: 5, poisonTime: 7, tags: ["ground"], text: "高HPへ継続ダメージ" },
    { id: "laser", name: "レーザー", mark: "L", cost: 580, damage: 30, range: 205, rate: 0.78, color: "#ef5da8", type: "laser", tags: ["ground", "air"], text: "直線上を貫通" },
    { id: "missile", name: "ミサイル", mark: "R", cost: 680, damage: 138, range: 205, rate: 4.2, color: "#f43f5e", type: "missile", splash: 100, tags: ["ground", "air"], text: "広範囲の決定打" }
  ],

  enemyTypes: {
    normal: { name: "通常敵", hp: 100, speed: 58, reward: 12, color: "#f8fafc", armor: 0 },
    fast: { name: "高速敵", hp: 60, speed: 104, reward: 16, color: "#38bdf8", armor: 0 },
    heavy: { name: "重装敵", hp: 400, speed: 36, reward: 38, color: "#94a3b8", armor: 8 },
    flying: { name: "飛行敵", hp: 120, speed: 76, reward: 24, color: "#c084fc", armor: 0, flying: true },
    healer: { name: "回復敵", hp: 180, speed: 50, reward: 35, color: "#4ade80", armor: 0, healer: true },
    boss: { name: "ボス", hp: 10000, speed: 30, reward: 700, color: "#fb7185", armor: 16, boss: true, shield: 0.25 }
  },

  maps: [
    {
      id: "grass",
      name: "草原",
      difficulty: 1,
      buildLimit: 42,
      bg: "#29433a",
      gimmick: "設置上限が多く、初心者向け",
      path: [[0, 4], [3, 4], [3, 2], [7, 2], [7, 7], [11, 7], [11, 4], [14, 4]]
    },
    {
      id: "desert",
      name: "砂漠",
      difficulty: 2,
      buildLimit: 36,
      bg: "#4a3f2a",
      gimmick: "Wave報酬 +10%",
      path: [[0, 6], [2, 6], [2, 1], [6, 1], [6, 5], [9, 5], [9, 8], [14, 8]]
    },
    {
      id: "snow",
      name: "雪原",
      difficulty: 3,
      buildLimit: 34,
      bg: "#263f4f",
      gimmick: "敵の移動速度 -8%",
      path: [[0, 2], [4, 2], [4, 7], [6, 7], [6, 3], [10, 3], [10, 6], [14, 6]]
    },
    {
      id: "volcano",
      name: "火山",
      difficulty: 4,
      buildLimit: 30,
      bg: "#412726",
      gimmick: "火山弾が定期的に敵へ落下",
      path: [[0, 5], [2, 5], [2, 8], [5, 8], [5, 2], [8, 2], [8, 6], [12, 6], [12, 3], [14, 3]]
    },
    {
      id: "city",
      name: "都市",
      difficulty: 3,
      buildLimit: 38,
      bg: "#28323f",
      gimmick: "売却額 +20%",
      path: [[0, 7], [5, 7], [5, 5], [2, 5], [2, 2], [8, 2], [8, 8], [13, 8], [13, 4], [14, 4]]
    },
    {
      id: "space",
      name: "宇宙",
      difficulty: 5,
      buildLimit: 28,
      bg: "#18172e",
      gimmick: "レーザーとミサイルの射程 +15%",
      path: [[0, 1], [3, 1], [3, 8], [5, 8], [5, 3], [9, 3], [9, 6], [12, 6], [12, 2], [14, 2]]
    },
    {
      id: "maze",
      name: "迷宮",
      difficulty: 5,
      buildLimit: 26,
      bg: "#253526",
      gimmick: "高Wave報酬 +15%",
      path: [[0, 0], [0, 9], [2, 9], [2, 1], [4, 1], [4, 8], [6, 8], [6, 2], [8, 2], [8, 7], [10, 7], [10, 3], [12, 3], [12, 9], [14, 9]]
    }
  ]
};
