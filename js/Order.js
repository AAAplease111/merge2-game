/**
 * Order.js - 订单系统
 * P0 版：主线订单 + 支线订单
 */

class OrderSystem {
  constructor() {
    this.mainOrder = null;
    this.sideOrders = [];  // 最多 3 个
    this.completedCount = 0;
  }

  /** 生成新主线订单 */
  generateMainOrder() {
    const templates = ORDER_TEMPLATES.main;
    // 按玩家等级选择合适的模板
    const available = templates.filter(t =>
      !t.minLevel || gameState.level >= t.minLevel
    );
    const template = available[Math.floor(Math.random() * available.length)];
    this.mainOrder = this._buildOrder(template, 'main');
    return this.mainOrder;
  }

  /** 生成支线订单 */
  generateSideOrder() {
    if (this.sideOrders.length >= 3) return null;
    const templates = ORDER_TEMPLATES.side;
    const template = templates[Math.floor(Math.random() * templates.length)];
    const order = this._buildOrder(template, 'side');
    this.sideOrders.push(order);
    return order;
  }

  /** 从模板构建订单 */
  _buildOrder(template, type) {
    return {
      id: 'order_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6),
      type: type,
      title: template.title,
      emoji: template.emoji,
      description: template.description || '',
      requires: template.requires.map(r => ({
        type: r.type,
        level: r.level,
        count: r.count,
        current: 0
      })),
      rewards: { ...template.rewards },
      completed: false,
      timeLimit: template.timeLimit || 0
    };
  }

  /** 查找订单 */
  findOrder(orderId) {
    if (this.mainOrder && this.mainOrder.id === orderId) return this.mainOrder;
    return this.sideOrders.find(o => o.id === orderId) || null;
  }

  /** 提交棋盘上的物品到订单 */
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
      completedCount: this.completedCount
    };
  }

  /** 反序列化 */
  deserialize(data) {
    if (!data) return;
    this.mainOrder = data.mainOrder || null;
    this.sideOrders = data.sideOrders || [];
    this.completedCount = data.completedCount || 0;
  }
}

// ===== 订单模板 =====

const ORDER_TEMPLATES = {
  main: [
    {
      title: '制作面包',
      emoji: '🍞',
      description: '收集材料，烤制一个香喷喷的面包',
      minLevel: 1,
      requires: [{ type: 'bread', level: 4, count: 1 }],
      rewards: { coins: 50, exp: 30 }
    },
    {
      title: '冲泡咖啡',
      emoji: '☕',
      description: '为小镇咖啡馆准备两杯黑咖啡',
      minLevel: 1,
      requires: [{ type: 'coffee', level: 3, count: 2 }],
      rewards: { coins: 80, exp: 40 }
    },
    {
      title: '装饰花束',
      emoji: '💐',
      description: '用花朵装饰小镇广场',
      minLevel: 3,
      requires: [{ type: 'flower', level: 4, count: 1 }],
      rewards: { coins: 70, exp: 35 }
    },
    {
      title: '烘焙盛宴',
      emoji: '🎂',
      description: '制作一个蛋糕庆祝节日',
      minLevel: 5,
      requires: [{ type: 'bread', level: 5, count: 1 }],
      rewards: { coins: 200, exp: 80, diamonds: 2 }
    },
    {
      title: '咖啡特调',
      emoji: '🧋',
      description: '调制一杯特调咖啡',
      minLevel: 5,
      requires: [{ type: 'coffee', level: 5, count: 1 }],
      rewards: { coins: 180, exp: 75, diamonds: 2 }
    },
    {
      title: '花园派对',
      emoji: '🌺',
      description: '准备一个花园举办派对',
      minLevel: 7,
      requires: [{ type: 'flower', level: 5, count: 1 }],
      rewards: { coins: 250, exp: 100, diamonds: 3 }
    }
  ],
  side: [
    {
      title: '收集小麦',
      emoji: '🌾',
      description: '收集一些小麦',
      requires: [{ type: 'bread', level: 1, count: 5 }],
      rewards: { coins: 25, exp: 10 }
    },
    {
      title: '研磨咖啡',
      emoji: '🟤',
      description: '研磨一些咖啡粉',
      requires: [{ type: 'coffee', level: 2, count: 3 }],
      rewards: { coins: 40, exp: 15 }
    },
    {
      title: '收集种子',
      emoji: '🌱',
      description: '收集一些花种',
      requires: [{ type: 'flower', level: 1, count: 4 }],
      rewards: { coins: 30, exp: 12 }
    },
    {
      title: '面团储备',
      emoji: '🫓',
      description: '准备一些面团',
      requires: [{ type: 'bread', level: 3, count: 2 }],
      rewards: { coins: 60, exp: 25 }
    }
  ]
};

// 全局订单系统实例
const orderSystem = new OrderSystem();
