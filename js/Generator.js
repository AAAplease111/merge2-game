/**
 * Generator.js - 生成器系统 V2
 * 每个生成器有独立冷却，产出对应物品链
 * 生成器升级后冷却缩短、产出高等级概率提升
 */

class Generator {
  constructor(config) {
    this.id = config.id;
    this.name = config.name;
    this.emoji = config.emoji;
    this.type = config.type;         // 'click' | 'auto'
    this.chain = config.chain;       // 对应的物品链
    this.baseCooldown = config.baseCooldown || 0;  // 冷却时间（秒）
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

  /** 当前冷却时间（秒），随等级缩短 */
  get cooldown() {
    return Math.max(1, Math.floor(this.baseCooldown * Math.pow(0.85, this.level - 1)));
  }

  /** 当前剩余冷却时间（秒） */
  get remainingCooldown() {
    const g = gameState.generators[this.id];
    if (!g || !g.cooldownUntil) return 0;
    const now = Date.now();
    if (now >= g.cooldownUntil) return 0;
    return Math.ceil((g.cooldownUntil - now) / 1000);
  }

  /** 是否冷却中 */
  get onCooldown() {
    return this.remainingCooldown > 0;
  }

  /** 使用生成器 */
  use() {
    if (!this.unlocked || this.onCooldown) return null;
    const g = gameState.generators[this.id];
    g.uses++;
    // 设置冷却
    g.cooldownUntil = Date.now() + this.cooldown * 1000;
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
    baseCooldown: 2,  // 2 秒冷却
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
    baseCooldown: 3,
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
    type: 'auto',
    chain: 'flower',
    baseCooldown: 15,  // 15 秒自动产出
    unlockLevel: 5,
    unlockBuilding: 'flower_shop',
    description: '自动产出种子（花链）',
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
    baseCooldown: 5,
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
    baseCooldown: 6,
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
