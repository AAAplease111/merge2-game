/**
 * UI.js - UI 渲染与交互
 * P0 版：纯 DOM 操作，无框架
 */

class UI {
  constructor() {
    this.dragItem = null;       // 当前拖拽的物品
    this.dragFrom = null;       // { row, col }
    this.selectedCell = null;   // 当前选中的格子
    this.autoTimer = null;      // 自动生成器定时器
    this.energyTimer = null;    // 能量恢复定时器
    this.saveTimer = null;      // 自动存档定时器
  }

  /** 初始化 */
  init() {
    this._renderAll();
    this._startTimers();
    this._bindGlobalEvents();
  }

  /** 全量渲染 */
  _renderAll() {
    this._renderTopBar();
    this._renderGrid();
    this._renderOrders();
    this._renderGenerators();
    this._renderBuildings();
    this._renderShop();
  }

  // ===== 顶部状态栏 =====

  _renderTopBar() {
    const bar = document.getElementById('top-bar');
    if (!bar) return;

    const exp = gameState.getExpProgress();
    bar.innerHTML = `
      <div class="top-bar-left">
        <span class="level-badge">🏠 Lv.${gameState.level}</span>
        <div class="exp-bar-container">
          <div class="exp-bar" style="width:${exp.pct}%"></div>
          <span class="exp-text">${exp.current}/${exp.max}</span>
        </div>
      </div>
      <div class="top-bar-right">
        <span class="resource" title="金币">🪙 ${gameState.coins}</span>
        <span class="resource" title="钻石">💎 ${gameState.diamonds}</span>
        <span class="resource energy-display" title="能量">⚡ ${gameState.energy}/${gameState.maxEnergy}</span>
      </div>
    `;
  }

  // ===== 棋盘 =====

  _renderGrid() {
    const container = document.getElementById('grid-container');
    if (!container) return;
    container.innerHTML = '';

    for (let r = 0; r < grid.rows; r++) {
      for (let c = 0; c < grid.cols; c++) {
        const cell = document.createElement('div');
        cell.className = 'grid-cell';
        cell.dataset.row = r;
        cell.dataset.col = c;

        const item = grid.getItem(r, c);
        if (item) {
          cell.classList.add('has-item');
          cell.innerHTML = `<div class="grid-item level-${item.level}" data-type="${item.type}" data-level="${item.level}">
            <span class="item-emoji">${item.emoji}</span>
            <span class="item-level">Lv.${item.level}</span>
          </div>`;
          cell.draggable = true;

          // 拖拽事件
          cell.addEventListener('dragstart', (e) => this._onDragStart(e, r, c));
          cell.addEventListener('dragend', (e) => this._onDragEnd(e));
        }

        // 放置目标
        cell.addEventListener('dragover', (e) => e.preventDefault());
        cell.addEventListener('drop', (e) => this._onDrop(e, r, c));

        // 点击选中
        cell.addEventListener('click', () => this._onCellClick(r, c));

        container.appendChild(cell);
      }
    }
  }

  _onDragStart(e, row, col) {
    this.dragItem = grid.getItem(row, col);
    this.dragFrom = { row, col };
    e.dataTransfer.setData('text/plain', `${row},${col}`);
    e.dataTransfer.effectAllowed = 'move';
    setTimeout(() => e.target.classList.add('dragging'), 0);
  }

  _onDragEnd(e) {
    e.target.classList.remove('dragging');
  }

  _onDrop(e, toRow, toCol) {
    e.preventDefault();
    if (!this.dragFrom) return;

    const from = this.dragFrom;
    this.dragItem = null;
    this.dragFrom = null;

    if (from.row === toRow && from.col === toCol) return;

    const item1 = grid.getItem(from.row, from.col);
    const item2 = grid.getItem(toRow, toCol);

    if (item1 && item2 && grid.canMerge(item1, item2)) {
      // 合成！
      const result = grid.merge(from.row, from.col, toRow, toCol);
      if (result) {
        this._showMergeEffect(toRow, toCol);
        this._renderAll();
        this._autoSave();
      }
    } else if (item1 && !item2) {
      // 移动到空位
      grid.swap(from.row, from.col, toRow, toCol);
      this._renderAll();
      this._autoSave();
    } else {
      // 交换
      grid.swap(from.row, from.col, toRow, toCol);
      this._renderAll();
    }
  }

  _onCellClick(row, col) {
    const item = grid.getItem(row, col);
    if (!item) return;

    // 如果之前有选中的格子，取消选中
    if (this.selectedCell) {
      const prev = document.querySelector(`.grid-cell[data-row="${this.selectedCell.row}"][data-col="${this.selectedCell.col}"]`);
      if (prev) prev.classList.remove('selected');
    }

    this.selectedCell = { row, col };
    const cell = document.querySelector(`.grid-cell[data-row="${row}"][data-col="${col}"]`);
    if (cell) cell.classList.add('selected');

    // 显示操作菜单
    this._showItemMenu(row, col, item);
  }

  _showItemMenu(row, col, item) {
    const menu = document.getElementById('item-menu');
    if (!menu) return;

    const name = ITEM_NAMES[item.type][item.level] || item.type;
    menu.innerHTML = `
      <div class="menu-backdrop" onclick="ui._hideItemMenu()"></div>
      <div class="menu-content">
        <div class="menu-item-preview">
          <span class="menu-emoji">${item.emoji}</span>
          <span class="menu-name">${name} Lv.${item.level}</span>
        </div>
        <div class="menu-actions">
          <button onclick="ui._submitToOrder(${row},${col})" class="menu-btn submit-btn">
            📋 提交到订单
          </button>
          <button onclick="ui._hideItemMenu()" class="menu-btn cancel-btn">
            ✖ 取消
          </button>
        </div>
      </div>
    `;
    menu.classList.remove('hidden');
  }

  _hideItemMenu() {
    const menu = document.getElementById('item-menu');
    if (menu) menu.classList.add('hidden');
    if (this.selectedCell) {
      const cell = document.querySelector(`.grid-cell[data-row="${this.selectedCell.row}"][data-col="${this.selectedCell.col}"]`);
      if (cell) cell.classList.remove('selected');
      this.selectedCell = null;
    }
  }

  _submitToOrder(row, col) {
    const item = grid.getItem(row, col);
    if (!item) return;

    // 先试主线订单
    if (orderSystem.mainOrder && !orderSystem.mainOrder.completed) {
      const result = orderSystem.submitItem(orderSystem.mainOrder.id, row, col);
      if (result.success) {
        this._hideItemMenu();
        this._renderAll();
        this._autoSave();
        if (result.order.completed) {
          this._showReward(result.order.rewards);
        }
        return;
      }
    }

    // 再试支线订单
    for (const order of orderSystem.sideOrders) {
      if (order.completed) continue;
      const result = orderSystem.submitItem(order.id, row, col);
      if (result.success) {
        this._hideItemMenu();
        this._renderAll();
        this._autoSave();
        if (result.order.completed) {
          this._showReward(result.order.rewards);
        }
        return;
      }
    }

    // 没有匹配的订单
    this._showToast('没有匹配的订单需求');
  }

  // ===== 订单面板 =====

  _renderOrders() {
    const panel = document.getElementById('order-panel');
    if (!panel) return;
    panel.innerHTML = '';

    // 主线订单
    if (orderSystem.mainOrder) {
      const mo = orderSystem.mainOrder;
      const moDiv = document.createElement('div');
      moDiv.className = `order-card main-order ${mo.completed ? 'completed' : ''}`;
      moDiv.innerHTML = `
        <div class="order-header">
          <span class="order-emoji">${mo.emoji}</span>
          <span class="order-title">${mo.title}</span>
          ${mo.completed ? '<span class="order-done">✅ 已完成</span>' : ''}
        </div>
        <div class="order-desc">${mo.description || ''}</div>
        <div class="order-progress">${orderSystem.getProgressText(mo)}</div>
        <div class="order-reward">🪙 ${mo.rewards.coins} 💎 ${mo.rewards.diamonds || 0} ⭐ ${mo.rewards.exp}</div>
      `;
      panel.appendChild(moDiv);
    } else {
      // 没有主线订单时生成一个
      orderSystem.generateMainOrder();
      this._renderOrders();
      return;
    }

    // 支线订单
    for (const so of orderSystem.sideOrders) {
      const soDiv = document.createElement('div');
      soDiv.className = `order-card side-order ${so.completed ? 'completed' : ''}`;
      soDiv.innerHTML = `
        <div class="order-header">
          <span class="order-emoji">${so.emoji}</span>
          <span class="order-title">${so.title}</span>
          ${so.completed ? '<span class="order-done">✅</span>' : ''}
        </div>
        <div class="order-progress">${orderSystem.getProgressText(so)}</div>
        <div class="order-reward">🪙 ${so.rewards.coins} ⭐ ${so.rewards.exp}</div>
      `;
      panel.appendChild(soDiv);
    }

    // 添加支线订单按钮
    if (orderSystem.sideOrders.length < 3) {
      const addBtn = document.createElement('button');
      addBtn.className = 'add-order-btn';
      addBtn.textContent = '+ 接取支线';
      addBtn.onclick = () => {
        orderSystem.generateSideOrder();
        this._renderOrders();
      };
      panel.appendChild(addBtn);
    }
  }

  // ===== 生成器栏 =====

  _renderGenerators() {
    const bar = document.getElementById('generator-bar');
    if (!bar) return;
    bar.innerHTML = '';

    const generators = getAllGenerators();
    for (const gen of generators) {
      const div = document.createElement('div');
      div.className = `generator-btn ${gen.unlocked ? 'unlocked' : 'locked'}`;
      div.title = gen.description;

      if (gen.unlocked) {
        const autoRemaining = gen.type === 'auto' ? gen.getAutoRemaining() : 0;
        div.innerHTML = `
          <div class="gen-emoji">${gen.emoji}</div>
          <div class="gen-name">${gen.name}</div>
          <div class="gen-level">Lv.${gen.savedLevel}</div>
          ${gen.type === 'auto' ? `<div class="gen-auto-timer" data-gen="${gen.id}">${this._formatTime(autoRemaining)}</div>` : ''}
          ${gen.type === 'normal' ? `<div class="gen-cost">⚡${gen.energyCost}</div>` : ''}
        `;
        div.onclick = () => this._onGeneratorClick(gen.id);
      } else {
        div.innerHTML = `
          <div class="gen-emoji">🔒</div>
          <div class="gen-name">${gen.name}</div>
          <div class="gen-lock-info">Lv.${gen.unlockLevel} 解锁</div>
        `;
      }

      bar.appendChild(div);
    }
  }

  _onGeneratorClick(genId) {
    const gen = new Generator(GENERATOR_CONFIGS[genId]);
    if (!gen.unlocked) {
      this._showToast(`需要达到 Lv.${gen.unlockLevel} 解锁`);
      return;
    }
    if (gen.type === 'auto') return; // 自动产出

    const item = gen.produce();
    if (!item) {
      this._showToast('能量不足！⚡');
      return;
    }

    const pos = grid.placeItem(item);
    if (!pos) {
      this._showToast('棋盘已满！📦');
      return;
    }

    this._showProduceEffect(pos.row, pos.col);
    this._renderAll();
    this._autoSave();
  }

  // ===== 建筑面板 =====

  _renderBuildings() {
    // 建筑在商店弹窗中显示
  }

  _renderShop() {
    // 商店弹窗，点击时渲染
  }

  // ===== 弹窗与特效 =====

  _showMergeEffect(row, col) {
    const cell = document.querySelector(`.grid-cell[data-row="${row}"][data-col="${col}"]`);
    if (!cell) return;
    cell.classList.add('merge-flash');
    setTimeout(() => cell.classList.remove('merge-flash'), 500);
  }

  _showProduceEffect(row, col) {
    const cell = document.querySelector(`.grid-cell[data-row="${row}"][data-col="${col}"]`);
    if (!cell) return;
    cell.classList.add('item-appear');
    setTimeout(() => cell.classList.remove('item-appear'), 400);
  }

  _showReward(rewards) {
    const toast = document.getElementById('reward-toast');
    if (!toast) return;
    toast.innerHTML = `
      <div class="reward-content">
        <div class="reward-title">🎉 订单完成！</div>
        <div class="reward-items">
          ${rewards.coins ? `<span>🪙 +${rewards.coins}</span>` : ''}
          ${rewards.exp ? `<span>⭐ +${rewards.exp}</span>` : ''}
          ${rewards.diamonds ? `<span>💎 +${rewards.diamonds}</span>` : ''}
        </div>
      </div>
    `;
    toast.classList.remove('hidden');
    toast.classList.add('reward-pop');
    setTimeout(() => {
      toast.classList.add('hidden');
      toast.classList.remove('reward-pop');
    }, 2000);
  }

  _showToast(message) {
    const toast = document.getElementById('toast');
    if (!toast) return;
    toast.textContent = message;
    toast.classList.remove('hidden');
    toast.classList.add('toast-pop');
    setTimeout(() => {
      toast.classList.add('hidden');
      toast.classList.remove('toast-pop');
    }, 1500);
  }

  // ===== 商店弹窗 =====

  openShop() {
    const modal = document.getElementById('shop-modal');
    if (!modal) return;

    const buildings = BUILDING_CONFIGS;
    let html = '<div class="shop-content">';
    html += '<h3>🏪 商店</h3>';

    // 能量购买
    html += '<div class="shop-section"><h4>⚡ 能量</h4>';
    html += `<div class="shop-item">
      <span>购买 50 能量</span>
      <span>💎 10</span>
      <button onclick="ui._buyEnergy()" ${gameState.diamonds < 10 ? 'disabled' : ''}>购买</button>
    </div></div>`;

    // 建筑
    html += '<div class="shop-section"><h4>🏗️ 建筑</h4>';
    for (const [id, b] of Object.entries(buildings)) {
      const existing = gameState.buildings[id];
      const unlocked = existing && existing.unlocked;
      const level = existing ? existing.level : 0;
      const cost = gameState.getBuildingUpgradeCost(id, level + 12);

      html += `<div class="shop-item building-item">
        <span>${b.emoji} ${b.name}</span>
        <span>${unlocked ? `Lv.${level}` : '🔒 未解锁'}</span>
        <span>${b.description}</span>
        ${unlocked && level < 5
          ? `<button onclick="ui._upgradeBuilding('${id}')" ${gameState.coins < cost ? 'disabled' : ''}>
              升级 🪙${cost}
             </button>`
          : !unlocked && gameState.level >= b.unlockLevel
            ? `<button onclick="ui._unlockBuilding('${id}')">解锁 🪙${b.unlockCost}</button>`
            : `<span class="lock-info">Lv.${b.unlockLevel} 解锁</span>`
        }
      </div>`;
    }
    html += '</div>';

    // 生成器升级
    html += '<div class="shop-section"><h4>🔧 生成器升级</h4>';
    const gens = getAllGenerators();
    for (const gen of gens) {
      if (!gen.unlocked) continue;
      const cost = gameState.getGeneratorUpgradeCost(gen.savedLevel);
      html += `<div class="shop-item">
        <span>${gen.emoji} ${gen.name} Lv.${gen.savedLevel}</span>
        ${gen.savedLevel < gen.maxLevel
          ? `<button onclick="ui._upgradeGenerator('${gen.id}')" ${gameState.coins < cost ? 'disabled' : ''}>
              升级 🪙${cost}
             </button>`
          : '<span>MAX</span>'
        }
      </div>`;
    }
    html += '</div>';

    html += `<button onclick="ui.closeShop()" class="close-shop-btn">关闭</button>`;
    html += '</div>';

    modal.innerHTML = html;
    modal.classList.remove('hidden');
  }

  closeShop() {
    const modal = document.getElementById('shop-modal');
    if (modal) modal.classList.add('hidden');
    this._renderAll();
  }

  _buyEnergy() {
    if (gameState.buyEnergy()) {
      this._showToast('⚡ +50 能量！');
      this.openShop(); // 刷新
      this._renderTopBar();
      this._autoSave();
    } else {
      this._showToast('钻石不足！');
    }
  }

  _unlockBuilding(buildingId) {
    const b = BUILDING_CONFIGS[buildingId];
    if (!b) return;
    if (gameState.coins < b.unlockCost) {
      this._showToast('金币不足！');
      return;
    }
    gameState.coins -= b.unlockCost;
    gameState.unlockBuilding(buildingId);
    this._showToast(`${b.emoji} ${b.name} 已解锁！`);
    this.openShop();
    this._autoSave();
  }

  _upgradeBuilding(buildingId) {
    if (gameState.upgradeBuilding(buildingId)) {
      this._showToast('🏗️ 建筑升级成功！');
      this.openShop();
      this._autoSave();
    } else {
      this._showToast('金币不足！');
    }
  }

  _upgradeGenerator(genId) {
    const gen = new Generator(GENERATOR_CONFIGS[genId]);
    if (gen.upgrade()) {
      this._showToast(`🔧 ${gen.name} 升级成功！`);
      this.openShop();
      this._autoSave();
    } else {
      this._showToast('金币不足或已达最高级！');
    }
  }

  // ===== 定时器 =====

  _startTimers() {
    // 能量恢复（每秒检查）
    this.energyTimer = setInterval(() => {
      gameState.tickEnergy();
      this._renderTopBar();
    }, 1000);

    // 自动生成器（每秒检查）
    this.autoTimer = setInterval(() => {
      const gens = getAllGenerators();
      for (const gen of gens) {
        if (!gen.unlocked || gen.type !== 'auto') continue;
        const item = gen.checkAutoProduce();
        if (item) {
          const pos = grid.placeItem(item);
          if (pos) {
            this._showProduceEffect(pos.row, pos.col);
            this._renderAll();
            this._autoSave();
          }
        }
      }
      // 更新自动生成器定时器显示
      this._renderGenerators();
    }, 1000);

    // 自动存档（每 30 秒）
    this.saveTimer = setInterval(() => {
      this._autoSave();
    }, 30000);
  }

  _autoSave() {
    SaveManager.save();
  }

  _formatTime(ms) {
    if (ms <= 0) return '就绪';
    const s = Math.ceil(ms / 1000);
    return `${s}s`;
  }

  _bindGlobalEvents() {
    // 点击空白处关闭菜单
    document.addEventListener('click', (e) => {
      if (e.target.closest('.menu-content') || e.target.closest('.grid-cell')) return;
      this._hideItemMenu();
    });
  }
}

// 全局 UI 实例
const ui = new UI();

// ===== 建筑配置 =====

const BUILDING_CONFIGS = {
  bakery: {
    name: '面包店',
    emoji: '🥖',
    description: '解锁菜篮生成器',
    unlockLevel: 1,
    unlockCost: 0,
    effect: '提升面包产出效率'
  },
  cafe: {
    name: '咖啡馆',
    emoji: '☕',
    description: '解锁咖啡壶生成器',
    unlockLevel: 3,
    unlockCost: 200,
    effect: '提升咖啡产出效率'
  },
  flower_shop: {
    name: '花店',
    emoji: '💐',
    description: '解锁花丛自动生成器',
    unlockLevel: 5,
    unlockCost: 500,
    effect: '缩短花丛产出间隔'
  }
};
