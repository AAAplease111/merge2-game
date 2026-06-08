/**
 * GameState.js - 游戏状态管理
 * V2 版：全面精进，支持多物品链、生成器冷却、建筑系统
 */

class GameState {
  constructor() {
    this.level = 1;
    this.exp = 0;
    this.expToNext = 50;
    this.coins = 200;        // 初始送 200 金币
    this.diamonds = 50;      // 初始送 50 钻石（方便测试）
    this.energy = 100;
    this.maxEnergy = 100;
    this.lastEnergyTime = Date.now();
    this.buildings = {};     // { bakery: { level: 1, unlocked: true }, ... }
    this.generators = {};    // { basket: { level: 1, uses: 0, cooldownUntil: 0 }, ... }
    this.statistics = {
      totalMerges: 0,
      completedOrders: 0,
      totalPlayTime: 0,
      startTime: Date.now()
    };
    this.unlockedChains = ['bread']; // 初始只有面包链
    this.maxGridSlots = 42;  // 6x7
    this.unlockedGridSlots = 42;
  }

  /** 增加经验，自动升级 */
  addExp(amount) {
    this.exp += amount;
    let leveledUp = false;
    while (this.exp >= this.expToNext) {
      this.exp -= this.expToNext;
      this.level++;
      this.expToNext = Math.floor(this.expToNext * 1.2 + 10);
      leveledUp = true;
    }
    return leveledUp;
  }

  /** 获取升级所需经验 */
  getExpProgress() {
    return { current: this.exp, max: this.expToNext, pct: Math.min(100, Math.floor(this.exp / this.expToNext * 100)) };
  }

  /** 能量恢复（每 3 秒 1 点，更快了） */
  tickEnergy() {
    const now = Date.now();
    const elapsed = now - this.lastEnergyTime;
    const recovered = Math.floor(elapsed / 3000);
    if (recovered > 0) {
      this.energy = Math.min(this.maxEnergy, this.energy + recovered);
      this.lastEnergyTime = now - (elapsed % 3000);
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
    if (this.diamonds < 5) return false                                                                      ;
    this.diamonds -= 5;
    this.energy = Math.min(this.maxEnergy, this.energy + 50);
    return true;
  }

  /** 解锁物品链 */
  unlockChain(chainId) {
    if (this.unlockedChains.includes(chainId)) return false;
    this.unlockedChains.push(chainId);
    return true;
  }

  /** 检查物品链是否已解锁 */
  isChainUnlocked(chainId) {
    return this.unlockedChains.includes(chainId);
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
    return Math.floor(80 * Math.pow(1.4, level - 1));
  }

  /** 解锁生成器 */
  unlockGenerator(genId) {
    if (this.generators[genId]) return false;
    this.generators[genId] = { level: 1, uses: 0, cooldownUntil: 0 };
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
    return Math.floor(40 * Math.pow(1.35, level - 1));
  }

  /** 序列化存档 */
  serialize() {
    return {
      version: 2,
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
      statistics: this.statistics,
      unlockedChains: this.unlockedChains,
      unlockedGridSlots: this.unlockedGridSlots
    };
  }

  /** 反序列化存档 */
  deserialize(data) {
    if (!data) return;
    this.level = data.level || 1;
    this.exp = data.exp || 0;
    this.expToNext = data.expToNext || 50;
    this.coins = data.coins || 200;
    this.diamonds = data.diamonds || 50;
    this.energy = data.energy || 100;
    this.maxEnergy = data.maxEnergy || 100;
    this.lastEnergyTime = data.lastEnergyTime || Date.now();
    this.buildings = data.buildings || {};
    this.generators = data.generators || {};
    this.statistics = data.statistics || { totalMerges: 0, completedOrders: 0, totalPlayTime: 0, startTime: Date.now() };
    this.unlockedChains = data.unlockedChains || ['bread'];
    this.unlockedGridSlots = data.unlockedGridSlots || 42;
  }
}

// 全局单例
const gameState = new GameState();
