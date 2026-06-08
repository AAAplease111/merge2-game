/**
 * Order.js - 订单系统 V2
 * 订单从易到难，只生成玩家已解锁生成器对应的物品
 * 主线订单 + 支线订单，难度分级
 */

class OrderSystem {
  constructor() {
    this.mainOrder = null;
    this.sideOrders = [];
    this.completedCount = 0;
    this.maxSideOrders = 3;
    this.difficultyLevel = 1;  // 当前难度等级
  }

  /** 生成主线订单 */
  generateMainOrder() {
    const available = this._getAvailableOrders('main');
    if (available.length === 0) return;

    // 根据难度选择
    const candidates = available.filter(o => o.minLevel <= gameState.level);
    if (candidates.length === 0) return;

    const template = candidates[Math.floor(Math.random() * candidates.length)];
    this.mainOrder = this._createOrder(template, 'main');
    return this.mainOrder;
  }

  /** 生成支线订单 */
  generateSideOrder() {
    if (this.sideOrders.length >= this.maxSideOrders) return null;

    const available = this._getAvailableOrders('side');
    const candidates = available.filter(o => o.minLevel <= gameState.level);
    if (candidates.length === 0) return null;

    const template = candidates[Math.floor(Math.random() * candidates.length)];
    const order = this._createOrder(template, 'side');
    this.sideOrders.push(order);
    return order;
  }

  /** 获取当前可用的订单模板 */
  _getAvailableOrders(type) {
    const templates = type === 'main' ? ORDER_TEMPLATES.main : ORDER_TEMPLATES.side;
    // 只返回玩家已解锁生成器对应物品链的订单
    const unlockedChains = gameState.unlockedChains;
    return templates.filter(t =>
      t.requires.every(r => unlockedChains.includes(r.type))
    );
  }

  /** 创建订单实例 */
  _createOrder(template, type) {
    return {
      id: 'order_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4),
      type: type,
      title: template.title,
      emoji: template.emoji,
      description: template.description,
      requires: template.requires.map(r => ({
        type: r.type,
        level: r.level,
        count: r.count,
        current: 0
      })),
      rewards: { ...template.rewards },
      completed: false,
      timeLimit: template.timeLimit || 0,
      difficulty: template.difficulty || 1
    };
  }

  /** 查找订单 */
  findOrder(orderId) {
    if (this.mainOrder && this.mainOrder.id === orderId) return this.mainOrder;
    return this.sideOrders.find(o => o.id === orderId) || null;
  }

  /** 提交物品到订单 */
  submitItem(orderId, row, col) {
    const order = this.findOrder(orderId);
    const item = grid.getItem(row, col);
    if (!order || !item || order.completed) return { success: false, reason: 'invalid' };

    // 找匹配的需求
    const req = order.requires.find(r =>
      r.type === item.type &&
      r.level === item.level &&
      r.current < r.count
    );
    if (!req) return { success: false, reason: 'no_match' };

    // 提交
    req.current++;
    grid.setItem(row, col, null);

    // 检查是否完成
    if (order.requires.every(r => r.current >= r.count)) {
      this._completeOrder(order);
    }

    return { success: true, order: order };
  }

  /** 完成订单 */
  _completeOrder(order) {
    order.completed = true;
    const r = order.rewards;
    gameState.coins += r.coins || 0;
    const leveledUp = gameState.addExp(r.exp || 0);
    if (r.diamonds) gameState.diamonds += r.diamonds;
    this.completedCount++;
    gameState.statistics.completedOrders++;

    // 主线订单完成后自动生成下一个
    if (order.type === 'main') {
      this.difficultyLevel++;
      setTimeout(() => this.generateMainOrder(), 500);
    }
  }

  /** 获取订单完成进度文本 */
  getProgressText(order) {
    if (!order) return '';
    return order.requires.map(r => {
      const name = ITEM_NAMES[r.type][r.level] || r.type;
      const emoji = ITEM_EMOJIS[r.type][r.level] || '❓';
      return `${emoji} ${name} ${r.current}/${r.count}`;
    }).join(' | ');
  }

  /** 检查订单是否全部完成 */
  isOrderComplete(order) {
    return order && order.completed;
  }

  /** 序列化 */
  serialize() {
    return {
      mainOrder: this.mainOrder ? JSON.parse(JSON.stringify(this.mainOrder)) : null,
      sideOrders: JSON.parse(JSON.stringify(this.sideOrders)),
      completedCount: this.completedCount,
      difficultyLevel: this.difficultyLevel
    };
  }

  /** 反序列化 */
  deserialize(data) {
    if (!data) return;
    this.mainOrder = data.mainOrder || null;
    this.sideOrders = data.sideOrders || [];
    this.completedCount = data.completedCount || 0;
    this.difficultyLevel = data.difficultyLevel || 1;
  }
}

// ===== 订单模板 =====

const ORDER_TEMPLATES = {
  main: [
    // === 第1章：面包店（Lv.1-2）===
    {
      title: '收集小麦',
      emoji: '🌾',
      description: '从菜篮收集一些小麦',
      minLevel: 1,
      difficulty: 1,
      requires: [{ type: 'bread', level: 1, count: 3 }],
      rewards: { coins: 30, exp: 20 }
    },
    {
      title: '研磨面粉',
      emoji: '🥣',
      description: '合成一些面粉',
      minLevel: 1,
      difficulty: 1,
      requires: [{ type: 'bread', level: 2, count: 2 }],
      rewards: { coins: 50, exp: 30 }
    },
    {
      title: '制作面包',
      emoji: '🍞',
      description: '烤制一个香喷喷的面包',
      minLevel: 2,
      difficulty: 2,
      requires: [{ type: 'bread', level: 4, count: 1 }],
      rewards: { coins: 100, exp: 60 }
    },

    // === 第2章：咖啡馆（Lv.3-4）===
    {
      title: '收集咖啡豆',
      emoji: '🫘',
      description: '收集一些咖啡豆',
      minLevel: 3,
      difficulty: 2,
      requires: [{ type: 'coffee', level: 1, count: 3 }],
      rewards: { coins: 60, exp: 35 }
    },
    {
      title: '冲泡咖啡',
      emoji: '☕',
      description: '冲泡两杯黑咖啡',
      minLevel: 3,
      difficulty: 2,
      requires: [{ type: 'coffee', level: 3, count: 2 }],
      rewards: { coins: 120, exp: 70 }
    },
    {
      title: '拿铁艺术',
      emoji: '🥛☕',
      description: '制作一杯拿铁',
      minLevel: 4,
      difficulty: 3,
      requires: [{ type: 'coffee', level: 4, count: 1 }],
      rewards: { coins: 200, exp: 100, diamonds: 2 }
    },

    // === 第3章：花店（Lv.5-6）===
    {
      title: '播种',
      emoji: '🌱',
      description: '收集一些种子',
      minLevel: 5,
      difficulty: 3,
      requires: [{ type: 'flower', level: 1, count: 4 }],
      rewards: { coins: 80, exp: 40 }
    },
    {
      title: '花束制作',
      emoji: '💐',
      description: '制作一束漂亮的花束',
      minLevel: 5,
      difficulty: 3,
      requires: [{ type: 'flower', level: 4, count: 1 }],
      rewards: { coins: 180, exp: 90, diamonds: 1 }
    },
    {
      title: '花园派对',
      emoji: '🌺',
      description: '布置一个花园',
      minLevel: 6,
      difficulty: 4,
      requires: [{ type: 'flower', level: 5, count: 1 }],
      rewards: { coins: 300, exp: 150, diamonds: 2 }
    },

    // === 第4章：工坊（Lv.7-8）===
    {
      title: '收集木材',
      emoji: '🪵',
      description: '收集一些木材',
      minLevel: 7,
      difficulty: 4,
      requires: [{ type: 'tool', level: 1, count: 3 }],
      rewards: { coins: 100, exp: 50 }
    },
    {
      title: '制作工具',
      emoji: '🔨',
      description: '制作一些工具',
      minLevel: 7,
      difficulty: 4,
      requires: [{ type: 'tool', level: 2, count: 2 }],
      rewards: { coins: 200, exp: 100 }
    },
    {
      title: '组装引擎',
      emoji: '⚡',
      description: '组装一个引擎',
      minLevel: 8,
      difficulty: 5,
      requires: [{ type: 'tool', level: 5, count: 1 }],
      rewards: { coins: 500, exp: 250, diamonds: 3 }
    },

    // === 第5章：裁缝店（Lv.9-10）===
    {
      title: '收集布料',
      emoji: '🧵',
      description: '收集一些布料',
      minLevel: 9,
      difficulty: 5,
      requires: [{ type: 'decor', level: 1, count: 3 }],
      rewards: { coins: 150, exp: 70 }
    },
    {
      title: '制作衣服',
      emoji: '👗',
      description: '制作一件漂亮衣服',
      minLevel: 9,
      difficulty: 5,
      requires: [{ type: 'decor', level: 2, count: 2 }],
      rewards: { coins: 300, exp: 150 }
    },
    {
      title: '璀璨珠宝',
      emoji: '💎',
      description: '制作一件珠宝',
      minLevel: 10,
      difficulty: 6,
      requires: [{ type: 'decor', level: 4, count: 1 }],
      rewards: { coins: 600, exp: 300, diamonds: 5 }
    }
  ],
  side: [
    // 简单支线
    {
      title: '收集小麦',
      emoji: '🌾',
      description: '收集一些小麦',
      minLevel: 1,
      difficulty: 1,
      requires: [{ type: 'bread', level: 1, count: 3 }],
      rewards: { coins: 25, exp: 10 }
    },
    {
      title: '研磨咖啡粉',
      emoji: '🟤',
      description: '研磨一些咖啡粉',
      minLevel: 3,
      difficulty: 1,
      requires: [{ type: 'coffee', level: 2, count: 2 }],
      rewards: { coins: 40, exp: 15 }
    },
    {
      title: '收集种子',
      emoji: '🌱',
      description: '收集一些花种',
      minLevel: 5,
      difficulty: 1,
      requires: [{ type: 'flower', level: 1, count: 4 }],
      rewards: { coins: 30, exp: 12 }
    },
    // 中等支线
    {
      title: '面包储备',
      emoji: '🍞',
      description: '准备一些面包',
      minLevel: 2,
      difficulty: 2,
      requires: [{ type: 'bread', level: 4, count: 1 }],
      rewards: { coins: 80, exp: 35 }
    },
    {
      title: '咖啡时间',
      emoji: '☕',
      description: '准备两杯咖啡',
      minLevel: 3,
      difficulty: 2,
      requires: [{ type: 'coffee', level: 3, count: 2 }],
      rewards: { coins: 100, exp: 45 }
    },
    {
      title: '花束装饰',
      emoji: '💐',
      description: '制作花束装饰房间',
      minLevel: 5,
      difficulty: 2,
      requires: [{ type: 'flower', level: 4, count: 1 }],
      rewards: { coins: 150, exp: 60 }
    },
    // 困难支线
    {
      title: '烘焙盛宴',
      emoji: '🎂',
      description: '制作一个蛋糕',
      minLevel: 2,
      difficulty: 3,
      requires: [{ type: 'bread', level: 6, count: 1 }],
      rewards: { coins: 300, exp: 120, diamonds: 2 }
    },
    {
      title: '特调大师',
      emoji: '🧋',
      description: '调制一杯特调咖啡',
      minLevel: 4,
      difficulty: 3,
      requires: [{ type: 'coffee', level: 5, count: 1 }],
      rewards: { coins: 350, exp: 140, diamonds: 2 }
    },
    {
      title: '花园景观',
      emoji: '🌳',
      description: '打造一个花园景观',
      minLevel: 6,
      difficulty: 3,
      requires: [{ type: 'flower', level: 6, count: 1 }],
      rewards: { coins: 400, exp: 160, diamonds: 3 }
    }
  ]
};

// 全局订单系统实例
const orderSystem = new OrderSystem();
