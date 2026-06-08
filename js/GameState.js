/**
 * GameState.js - 游戏状态管理（经济系统 + 存档）
 * P0 版：localStorage 持久化
 */

class GameState {
  constructor() {
    this.level = 1;
    this.exp = 0;
    this.expToNext = 100;
    this.coins = 0;
    this.diamonds = 5;      // 初始送 5 钻石
    this.energy = 100;
    this.maxEnergy = 100;
    this.lastEnergyTime = Date.now();
    this.buildings = {};    // { bakery: { level: 1, unlocked: true }, ... }
    this.generators = {};   // { basket: { level: 1 }, ... }
    this.statistics = {
      totalMerges: 0,
      completedOrders: 0,
      totalPlayTime: 0,
      startTime: Date.now()
    };
  }

  /** 增加经验，自动升级 */
  addExp(amount) {
    this.exp += amount;
    let leveledUp = false;
    while (this.exp >= this.expToNext) {
      this.exp -= this.expToNext;
      this.level++;
      this.expToNext = Math.floor(this.expToNext * 1.25);
      leveledUp = true;
    }
    return leveledUp;
  }

  /** 获取升级所需经验 */
  getExpProgress() {
    return { current: this.exp, max: this.expToNext, pct: Math.min(100, Math.floor(this.exp / this.expToNext * 100)) };
  }

  /** 能量恢复（每 5 秒 1 点） */
  tickEnergy() {
    const now = Date.now();
    const elapsed = now - this.lastEnergyTime;
    const recovered = Math.floor(elapsed / 5000);
    if (recovered > 0) {
      this.energy = Math.min(this.maxEnergy, this.energy + recovered);
      this.lastEnergyTime = now - (elapsed % 5000);
    }
  }

  /** 消耗能量 */
  spendEnergy(amount) {
    if (this.energy < amount) return false;
    this.energy -= amount;
    return true;
  }

  /** 购买能量 */
  buyEnergy() {
    if (this.diamonds < 10) return false;
    this.diamonds -= 10;
    this.energy = Math.min(this.maxEnergy, this.energy + 50);
    return true;
  }

  /** 解锁建筑 */
  unlockBuilding(buildingId) {
    if (this.buildings[buildingId]) return false;
    this.buildings[buildingId] = { level: 1, unlocked: true };
    return true;
  }

  /** 升级建筑 */
  upgradeBuilding(buildingId) {
    const b = this.buildings[buildingId];
    if (!b || !b.unlocked) return false;
    const cost = this.getBuildingUpgradeCost(buildingId, b.level);
    if (this.coins < cost) return false;
    this.coins -= cost;
    b.level++;
    return true;
  }

  /** 建筑升级花费 */
  getBuildingUpgradeCost(buildingId, level) {
    return Math.floor(100 * Math.pow(1.5, level - 1));
  }

  /** 解锁生成器 */
  unlockGenerator(genId) {
    if (this.generators[genId]) return false;
    this.generators[genId] = { level: 1 };
    return true;
  }

  /** 升级生成器 */
  upgradeGenerator(genId) {
    const g = this.generators[genId];
    if (!g || g.level >= 5) return false;
    const cost = this.getGeneratorUpgradeCost(g.level);
    if (this.coins < cost) return false;
    this.coins -= cost;
    g.level++;
    return true;
  }

  /** 生成器升级花费 */
  getGeneratorUpgradeCost(level) {
    return Math.floor(50 * Math.pow(1.4, level - 1));
  }

  /** 序列化存档 */
  serialize() {
    return {
      version: 1,
      timestamp: Date.now(),
      level: this.level,
      exp: this.exp,
      expToNext: this.expToNext,
      coins: this.coins,
      diamonds: this.diamonds,
      energy: this.energy,
      maxEnergy: this.maxEnergy,
      lastEnergyTime: this.lastEnergyTime,
      buildings: this.buildings,
      generators: this.generators,
      statistics: this.statistics
    };
  }

  /** 反序列化存档 */
  deserialize(data) {
    this.level = data.level || 1;
    this.exp = data.exp || 0;
    this.expToNext = data.expToNext || 100;
    this.coins = data.coins || 0;
    this.diamonds = data.diamonds || 5;
    this.energy = data.energy || 100;
    this.maxEnergy = data.maxEnergy || 100;
    this.lastEnergyTime = data.lastEnergyTime || Date.now();
    this.buildings = data.buildings || {};
    this.generators = data.generators || {};
    this.statistics = data.statistics || { totalMerges: 0, completedOrders: 0, totalPlayTime: 0, startTime: Date.now() };
  }
}

// 全局单例
const gameState = new GameState();
