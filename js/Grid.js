/**
 * Grid.js - 棋盘系统
 * P0 版：6×7 棋盘，拖拽合成 + 连锁合成
 */

class Grid {
  constructor(rows = 6, cols = 7) {
    this.rows = rows;
    this.cols = cols;
    this.cells = new Array(rows * cols).fill(null);
  }

  /** 获取物品 */
  getItem(row, col) {
    if (row < 0 || row >= this.rows || col < 0 || col >= this.cols) return null;
    return this.cells[row * this.cols + col];
  }

  /** 放置物品 */
  setItem(row, col, item) {
    if (row < 0 || row >= this.rows || col < 0 || col >= this.cols) return;
    this.cells[row * this.cols + col] = item;
  }

  /** 查找第一个空位 */
  findEmptyCell() {
    for (let r = 0; r < this.rows; r++) {
      for (let c = 0; c < this.cols; c++) {
        if (!this.getItem(r, c)) return { row: r, col: c };
      }
    }
    return null;
  }

  /** 棋盘是否已满 */
  isFull() {
    return this.findEmptyCell() === null;
  }

  /** 检查两个物品是否可以合成 */
  canMerge(item1, item2) {
    if (!item1 || !item2) return false;
    return item1.type === item2.type &&
           item1.level === item2.level &&
           item1.level < ITEM_MAX_LEVELS[item1.type];
  }

  /** 执行合成 */
  merge(row1, col1, row2, col2) {
    const item = this.getItem(row1, col1);
    if (!item) return null;

    const newLevel = item.level + 1;
    const newItem = {
      id: generateId(),
      type: item.type,
      level: newLevel,
      emoji: ITEM_EMOJIS[item.type][newLevel]
    };

    this.setItem(row1, col1, newItem);
    this.setItem(row2, col2, null);

    // 统计
    gameState.statistics.totalMerges++;
    gameState.addExp(newLevel * 2);

    return { item: newItem, pos: { row: row1, col: col1 }, chainMerges: [] };
  }

  /** 尝试放置物品到棋盘 */
  placeItem(item) {
    const cell = this.findEmptyCell();
    if (!cell) return null;
    this.setItem(cell.row, cell.col, item);
    return cell;
  }

  /** 交换两个格子的物品 */
  swap(row1, col1, row2, col2) {
    const item1 = this.getItem(row1, col1);
    const item2 = this.getItem(row2, col2);
    this.setItem(row1, col1, item2);
    this.setItem(row2, col2, item1);
  }

  /** 获取相邻格子 */
  getNeighbors(row, col) {
    const dirs = [[-1,0],[1,0],[0,-1],[0,1]];
    return dirs
      .map(([dr, dc]) => ({ row: row + dr, col: col + dc }))
      .filter(({ row: r, col: c }) => r >= 0 && r < this.rows && c >= 0 && c < this.cols);
  }

  /** 检查某位置是否有可合成的邻居（用于连锁合成） */
  findMergeableNeighbor(row, col) {
    const item = this.getItem(row, col);
    if (!item) return null;
    const neighbors = this.getNeighbors(row, col);
    for (const n of neighbors) {
      const neighbor = this.getItem(n.row, n.col);
      if (this.canMerge(item, neighbor)) {
        return n;
      }
    }
    return null;
  }

  /** 序列化 */
  serialize() {
    return this.cells.map(c => c ? { ...c } : null);
  }

  /** 反序列化 */
  deserialize(data) {
    if (!data || !Array.isArray(data)) return;
    this.cells = data.map(c => c ? { ...c } : null);
  }
}

// 全局棋盘实例
const grid = new Grid();

// ===== 物品配置 =====

/** 物品类型 */
const ITEM_TYPES = {
  BREAD: 'bread',
  COFFEE: 'coffee',
  FLOWER: 'flower'
};

/** 每种物品的最高等级 */
const ITEM_MAX_LEVELS = {
  bread: 5,
  coffee: 5,
  flower: 5
};

/** 每种物品各等级的 emoji */
const ITEM_EMOJIS = {
  bread: ['', '🌾', '🥣', '🫓', '🍞', '🎂'],
  coffee: ['', '🫘', '🟤', '☕', '🥛☕', '🧋'],
  flower: ['', '🌱', '🌿', '🌸', '💐', '🌺']
};

/** 每种物品的名称 */
const ITEM_NAMES = {
  bread: ['', '小麦', '面粉', '面团', '面包', '蛋糕'],
  coffee: ['', '咖啡豆', '咖啡粉', '黑咖啡', '拿铁', '特调咖啡'],
  flower: ['', '种子', '幼苗', '花朵', '花束', '花园']
};

/** 生成唯一 ID */
let _idCounter = 0;
function generateId() {
  return 'item_' + (++_idCounter) + '_' + Date.now();
}
