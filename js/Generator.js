/**
 * Generator.js - 生成器系统
 * P0 版：菜篮（点击）、咖啡壶（点击）、花丛（自动）
 */

class Generator {
  constructor(config) {
    this.id = config.id;
    this.name = config.name;
    this.emoji = config.emoji;
    this.type = config.type;         // 'normal' | 'auto'
    this.level = 1;
    this.maxLevel = 5;
    this.baseEnergyCost = config.energyCost || 1;
    this.produceTable = config.produceTable;
    this.autoInterval = config.autoInterval || 0; // ms
    this.lastAutoTime = Date.now();
    this.unlockLevel = config.unlockLevel || 1;
    this.description = config.description || '';
  }

  /** 当前能量消耗 */
  get energyCost() {
    return Math.max(1, this.baseEnergyCost - Math.floor((this.level - 1) / 2));
  }

  /** 是否已解锁 */
  get unlocked() {
    return gameState.generators[this.id] !== undefined;
  }

  /** 获取存档中的等级 */
  get savedLevel() {
    const g = gameState.generators[this.id];
    return g ? g.level : 1;
  }

  /** 点击产出 */
  produce() {
    if (this.type === 'normal') {
      if (!gameState.spendEnergy(this.energyCost)) return null;
    }
    return this.rollItem();
  }

  /** 概率产出物品 */
  rollItem() {
    const roll = Math.random();
    let cumulative = 0;
    for (const entry of this.produceTable) {
      cumulative += entry.probability;
      if (roll <= cumulative) {
        return {
          id: generateId(),
          type: entry.type,
          level: 1,
          emoji: ITEM_EMOJIS[entry.type][1]
        };
      }
    }
    // fallback
    const entry = this.produceTable[0];
    return {
      id: generateId(),
      type: entry.type,
      level: 1,
      emoji: ITEM_EMOJIS[entry.type][1]
    };
  }

  /** 自动产出检测 */
  checkAutoProduce() {
    if (this.type !== 'auto') return null;
    const now = Date.now();
    if (now - this.lastAutoTime >= this.autoInterval) {
      this.lastAutoTime = now;
      return this.rollItem();
    }
    return null;
  }

  /** 获取自动产出剩余时间（ms） */
  getAutoRemaining() {
    if (this.type !== 'auto') return 0;
    const elapsed = Date.now() - this.lastAutoTime;
    return Math.max(0, this.autoInterval - elapsed);
  }

  /** 升级 */
  upgrade() {
    if (!this.unlocked || this.savedLevel >= this.maxLevel) return false;
    const cost = gameState.getGeneratorUpgradeCost(this.savedLevel);
    if (gameState.coins < cost) return false;
    gameState.coins -= cost;
    gameState.generators[this.id].level++;
    return true;
  }
}

// ===== 生成器配置 =====

const GENERATOR_CONFIGS = {
  basket: {
    id: 'basket',
    name: '菜篮',
    emoji: '🧺',
    type: 'normal',
    energyCost: 1,
    unlockLevel: 1,
    description: '点击产出小麦或咖啡豆',
    produceTable: [
      { type: 'bread', probability: 0.9 },
      { type: 'coffee', probability: 0.1 }
    ]
  },
  coffee_pot: {
    id: 'coffee_pot',
    name: '咖啡壶',
    emoji: '☕',
    type: 'normal',
    energyCost: 1,
    unlockLevel: 3,
    description: '点击产出咖啡豆或花朵种子',
    produceTable: [
      { type: 'coffee', probability: 0.85 },
      { type: 'flower', probability: 0.15 }
    ]
  },
  flower_bush: {
    id: 'flower_bush',
    name: '花丛',
    emoji: '🌸',
    type: 'auto',
    energyCost: 0,
    autoInterval: 30000, // 30 秒
    unlockLevel: 5,
    description: '每 30 秒自动产出花朵种子',
    produceTable: [
      { type: 'flower', probability: 1.0 }
    ]
  }
};

/** 获取已解锁的生成器列表 */
function getUnlockedGenerators() {
  return Object.values(GENERATOR_CONFIGS)
    .filter(g => g.unlockLevel <= gameState.level || gameState.generators[g.id])
    .map(g => new Generator(g));
}

/** 获取所有生成器实例 */
function getAllGenerators() {
  return Object.values(GENERATOR_CONFIGS).map(g => new Generator(g));
}
