/**
 * Generator.js - 生成器系统 V3
 * 点击消耗能量产出物品，无冷却
 * 升级提升高等级产出概率
 */

const GENERATOR_ENERGY_COST = 5;  // 每次点击消耗 5 能量

class Generator {
  constructor(config) {
    this.id = config.id;
    this.name = config.name;
    this.emoji = config.emoji;
    this.type = config.type;         // 'click' | 'auto'
    this.chain = config.chain;       // 对应的物品链
    this.produceTable = config.produceTable;
    this.unlockLevel = config.unlockLevel || 1;
    this.unlockBuilding = config.unlockBuilding || null;
    this.description = config.description || '';
  }

  /** 当前等级 */
  get level() {
    const g = gameState.generators[this.id];
    return g ? g.level : 1;
  }

  /** 是否已解锁 */
  get unlocked() {
    if (this.unlockBuilding) {
      const b = gameState.buildings[this.unlockBuilding];
      return b && b.unlocked;
    }
    return gameState.generators[this.id] !== undefined;
  }

  /** 使用生成器（消耗能量） */
  use() {
    if (!this.unlocked) return null;
    // 消耗能量
    if (!gameState.spendEnergy(GENERATOR_ENERGY_COST)) return null;
    const g = gameState.generators[this.id];
    g.uses++;
    // 产出物品
    return this.rollItem();
  }

  /** 概率产出物品 */
  rollItem() {
    const roll = Math.random();
    let cumulative = 0;
    for (const entry of this.produceTable) {
      cumulative += entry.probability;
      if (roll <= cumulative) {
        const level = entry.level || 1;
        return {
          id: generateId(),
          type: this.chain,
          level: level,
          emoji: ITEM_EMOJIS[this.chain][level]
        };
      }
    }
    // fallback
    return {
      id: generateId(),
      type: this.chain,
      level: 1,
      emoji: ITEM_EMOJIS[this.chain][1]
    };
  }

  /** 获取升级花费 */
  get upgradeCost() {
    return gameState.getGeneratorUpgradeCost(this.level);
  }

  /** 是否可升级 */
  get canUpgrade() {
    return this.unlocked && this.level < 5 && gameState.coins >= this.upgradeCost;
  }

  /** 升级 */
  upgrade() {
    if (!this.canUpgrade) return false;
    gameState.coins -= this.upgradeCost;
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
    type: 'click',
    chain: 'bread',
    unlockLevel: 1,
    unlockBuilding: 'bakery',
    description: '产出小麦（面包链）',
    produceTable: [
      { probability: 0.85, level: 1 },
      { probability: 0.12, level: 2 },
      { probability: 0.03, level: 3 }
    ]
  },
  coffee_pot: {
    id: 'coffee_pot',
    name: '咖啡壶',
    emoji: '☕',
    type: 'click',
    chain: 'coffee',
    unlockLevel: 3,
    unlockBuilding: 'cafe',
    description: '产出咖啡豆（咖啡链）',
    produceTable: [
      { probability: 0.80, level: 1 },
      { probability: 0.15, level: 2 },
      { probability: 0.05, level: 3 }
    ]
  },
  flower_bush: {
    id: 'flower_bush',
    name: '花丛',
    emoji: '🌸',
    type: 'click',
    chain: 'flower',
    unlockLevel: 5,
    unlockBuilding: 'flower_shop',
    description: '产出种子（花链）',
    produceTable: [
      { probability: 0.90, level: 1 },
      { probability: 0.08, level: 2 },
      { probability: 0.02, level: 3 }
    ]
  },
  tool_box: {
    id: 'tool_box',
    name: '工具箱',
    emoji: '🧰',
    type: 'click',
    chain: 'tool',
    unlockLevel: 7,
    unlockBuilding: 'workshop',
    description: '产出木材（工具链）',
    produceTable: [
      { probability: 0.75, level: 1 },
      { probability: 0.20, level: 2 },
      { probability: 0.05, level: 3 }
    ]
  },
  sewing_machine: {
    id: 'sewing_machine',
    name: '缝纫机',
    emoji: '🪡',
    type: 'click',
    chain: 'decor',
    unlockLevel: 9,
    unlockBuilding: 'tailor',
    description: '产出布料（装饰链）',
    produceTable: [
      { probability: 0.70, level: 1 },
      { probability: 0.22, level: 2 },
      { probability: 0.08, level: 3 }
    ]
  }
};

/** 获取所有生成器实例 */
function getAllGenerators() {
  return Object.values(GENERATOR_CONFIGS).map(g => new Generator(g));
}

/** 获取已解锁的生成器 */
function getUnlockedGenerators() {
  return getAllGenerators().filter(g => g.unlocked);
}
