/**
 * UI.js - UI 渲染与交互 V2
 * 全面重写：点击拾取+点击放置合成、生成器冷却条、建筑面板
 */

class UI {
  constructor() {
    this.initialized = false;
    this.energyTimer = null;
    this.autoTimer = null;
    this.saveTimer = null;
    this.cooldownTimers = {};
  }

  init() {
    if (this.initialized) return;
    this.initialized = true;

    this._renderAll();
    this._startTimers();
    this._bindGlobalEvents();
    this._bindGridEvents();

    // 如果没有订单，生成
    if (!orderSystem.mainOrder) {
      orderSystem.generateMainOrder();
    }
    if (orderSystem.sideOrders.length === 0) {
      orderSystem.generateSideOrder();
    }
    this._renderOrders();

    console.log('✅ UI 初始化完成');
  }

  _renderAll() {
    this._renderTopBar();
    this._renderGrid();
    this._renderOrders();
    this._renderGenerators();
  }

  // ===== 顶部状态栏 =====

  _renderTopBar() {
    const bar = document.getElementById('top-bar');
    if (!bar) return;

    const exp = gameState.getExpProgress();
    bar.innerHTML = `
      <div class="top-bar-left">
        <span class="level-badge">Lv.${gameState.level}</span>
        <div class="exp-bar-container">
          <div class="exp-bar" style="width:${exp.pct}%"></div>
          <span class="exp-text">${exp.current}/${exp.max}</span>
        </div>
      </div>
      <div class="top-bar-right">
        <span class="resource energy-display">⚡ ${gameState.energy}/${gameState.maxEnergy}</span>
        <span class="resource">🪙 ${gameState.coins}</span>
        <span class="resource">💎 ${gameState.diamonds}</span>
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
          cell.classList.add('has-item', `level-${item.level}`);
          const isSelected = grid.selectedItem &&
            grid.selectedItem.row === r &&
            grid.selectedItem.col === c;
          if (isSelected) cell.classList.add('selected');

          cell.innerHTML = `
            <div class="grid-item">
              <span class="item-emoji">${item.emoji}</span>
              <span class="item-level">Lv.${item.level}</span>
            </div>
          `;
        }

        // 点击事件
        cell.addEventListener('click', (e) => {
          e.stopPropagation();
          this._onCellClick(r, c);
        });

        container.appendChild(cell);
      }
    }
  }

  _onCellClick(row, col) {
    const item = grid.getItem(row, col);
    const result = grid.toggleSelect(row, col);

    if (!result) {
      // 取消选中
      this._renderGrid();
      return;
    }

    switch (result.action) {
      case 'select':
        this._renderGrid();
        this._showItemMenu(row, col);
        break;
      case 'merge':
        if (result.result) {
          this._showMergeEffect(row, col);
          // 连锁合成
          if (result.result.chainMerges && result.result.chainMerges.length > 0) {
            for (const chain of result.result.chainMerges) {
              this._showMergeEffect(chain.pos.row, chain.pos.col);
            }
          }
          this._renderAll();
          this._autoSave();
        } else {
          this._renderGrid();
        }
        break;
      case 'swap':
        this._renderGrid();
        // 检查是否有合成机会
        this._checkAutoMerge();
        this._autoSave();
        break;
    }
  }

  /** 检查棋盘上是否有可以合成的相邻物品 */
  _checkAutoMerge() {
    let merged = false;
    for (let r = 0; r < grid.rows; r++) {
      for (let c = 0; c < grid.cols; c++) {
        const item = grid.getItem(r, c);
        if (!item) continue;
        const neighbors = grid.getNeighborItems(r, c);
        for (const n of neighbors) {
          if (grid.canMerge(item, n.item)) {
            const result = grid.merge(r, c, n.row, n.col);
            if (result) {
              this._showMergeEffect(r, c);
              merged = true;
              // 继续递归检查
              this._checkAutoMerge();
              return;
            }
          }
        }
      }
    }
    if (merged) this._renderAll();
  }

  // ===== 物品操作菜单 =====

  _showItemMenu(row, col) {
    const item = grid.getItem(row, col);
    if (!item) return;

    const modal = document.getElementById('item-menu');
    if (!modal) return;

    const name = ITEM_NAMES[item.type][item.level] || '未知物品';
    const emoji = item.emoji;

    // 检查哪些订单能接受这个物品
    const orderOptions = [];
    if (orderSystem.mainOrder && !orderSystem.mainOrder.completed) {
      const canSubmit = orderSystem.mainOrder.requires.some(r =>
        r.type === item.type && r.level === item.level && r.current < r.count
      );
      if (canSubmit) {
        orderOptions.push({ id: orderSystem.mainOrder.id, label: '📋 主线订单' });
      }
    }
    for (const so of orderSystem.sideOrders) {
      if (so.completed) continue;
      const canSubmit = so.requires.some(r =>
        r.type === item.type && r.level === item.level && r.current < r.count
      );
      if (canSubmit) {
        orderOptions.push({ id: so.id, label: `📌 ${so.title}` });
      }
    }

    let actionsHtml = '';
    if (orderOptions.length > 0) {
      actionsHtml += orderOptions.map(o =>
        `<button class="menu-btn submit-btn" data-order-id="${o.id}" data-row="${row}" data-col="${col}">${o.label} 提交</button>`
      ).join('');
    } else {
      actionsHtml += `<div class="menu-no-match">当前没有订单需要这个物品</div>`;
    }
    actionsHtml += `<button class="menu-btn cancel-btn" onclick="ui._hideItemMenu()">取消</button>`;

    modal.innerHTML = `
      <div class="menu-backdrop" onclick="ui._hideItemMenu()"></div>
      <div class="menu-content">
        <div class="menu-item-preview">
          <span class="menu-emoji">${emoji}</span>
          <span class="menu-name">${name} Lv.${item.level}</span>
        </div>
        <div class="menu-actions">
          ${actionsHtml}
        </div>
      </div>
    `;
    modal.classList.remove('hidden');

    // 绑定提交事件
    modal.querySelectorAll('.submit-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const orderId = btn.dataset.orderId;
        const row = parseInt(btn.dataset.row);
        const col = parseInt(btn.dataset.col);
        this._submitToOrder(orderId, row, col);
      });
    });
  }

  _hideItemMenu() {
    const modal = document.getElementById('item-menu');
    if (modal) modal.classList.add('hidden');
    grid.selectedItem = null;
    this._renderGrid();
  }

  _submitToOrder(orderId, row, col) {
    const result = orderSystem.submitItem(orderId, row, col);
    if (result.success) {
      this._hideItemMenu();

      // 检查订单是否完成
      if (result.order.completed) {
        this._showReward(result.order.rewards);
        // 支线订单完成后，过一会儿自动生成新支线
        if (result.order.type === 'side') {
          setTimeout(() => {
            orderSystem.generateSideOrder();
            this._renderOrders();
          }, 1000);
        }
      }

      this._renderAll();
      this._autoSave();
    } else {
      this._showToast('无法提交此物品');
    }
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
          ${mo.completed ? '<span class="order-done">✅</span>' : ''}
        </div>
        <div class="order-desc">${mo.description}</div>
        <div class="order-progress">${orderSystem.getProgressText(mo)}</div>
        <div class="order-reward">🪙 ${mo.rewards.coins} ⭐ ${mo.rewards.exp}${mo.rewards.diamonds ? ' 💎 +' + mo.rewards.diamonds : ''}</div>
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
        <div class="order-desc">${so.description}</div>
        <div class="order-progress">${orderSystem.getProgressText(so)}</div>
        <div class="order-reward">🪙 ${so.rewards.coins} ⭐ ${so.rewards.exp}${so.rewards.diamonds ? ' 💎 +' + so.rewards.diamonds : ''}</div>
      `;
      panel.appendChild(soDiv);
    }

    // 添加支线订单按钮
    if (orderSystem.sideOrders.length < orderSystem.maxSideOrders) {
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
        const remaining = gen.remainingCooldown;
        const isOnCooldown = gen.onCooldown;
        div.innerHTML = `
          <div class="gen-emoji">${gen.emoji}</div>
          <div class="gen-name">${gen.name}</div>
          <div class="gen-level">Lv.${gen.level}</div>
          ${isOnCooldown
            ? `<div class="gen-cooldown" data-gen="${gen.id}">⏳ ${remaining}s</div>`
            : `<div class="gen-ready">✅ 就绪</div>`
          }
        `;
        div.onclick = () => this._onGeneratorClick(gen.id);
        if (isOnCooldown) div.classList.add('on-cooldown');
      } else {
        const unlockInfo = gen.unlockBuilding
          ? `🏪 ${BUILDING_CONFIGS[gen.unlockBuilding]?.name || gen.unlockBuilding}`
          : `Lv.${gen.unlockLevel} 解锁`;
        div.innerHTML = `
          <div class="gen-emoji">🔒</div>
          <div class="gen-name">${gen.name}</div>
          <div class="gen-lock-info">${unlockInfo}</div>
        `;
      }

      bar.appendChild(div);
    }
  }

  _onGeneratorClick(genId) {
    const gen = new Generator(GENERATOR_CONFIGS[genId]);
    if (!gen.unlocked) {
      this._showToast(`需要先解锁 ${gen.unlockBuilding ? BUILDING_CONFIGS[gen.unlockBuilding]?.name : '对应建筑'}`);
      return;
    }

    if (gen.onCooldown) {
      this._showToast(`冷却中 ⏳ ${gen.remainingCooldown}s`);
      return;
    }

    // 点击生成器不消耗能量（经典设计）
    const item = gen.use();
    if (!item) {
      this._showToast('生成器冷却中');
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

  // ===== 商店弹窗 =====

  openShop() {
    const modal = document.getElementById('shop-modal');
    if (!modal) return;

    const buildings = BUILDING_CONFIGS;
    let html = '<div class="shop-content">';
    html += '<h3>🏪 商店</h3>';

    // === 能量购买 ===
    html += '<div class="shop-section"><h4>⚡ 能量</h4>';
    html += `<div class="shop-item">
      <span>购买 50 能量</span>
      <span class="shop-price">💎 5</span>
      <button onclick="ui._buyEnergy()" ${gameState.diamonds < 5 ? 'disabled' : ''}>购买</button>
    </div>`;
    html += `<div class="shop-item">
      <span>购买 120 能量</span>
      <span class="shop-price">💎 10</span>
      <button onclick="ui._buyEnergyLarge()" ${gameState.diamonds < 10 ? 'disabled' : ''}>购买</button>
    </div></div>`;

    // === 建筑 ===
    html += '<div class="shop-section"><h4>🏗️ 建筑</h4>';
    for (const [id, b] of Object.entries(buildings)) {
      const existing = gameState.buildings[id];
      const unlocked = existing && existing.unlocked;
      const level = existing ? existing.level : 0;
      const cost = gameState.getBuildingUpgradeCost(id, level + 1);

      html += `<div class="shop-item building-item">
        <span class="building-emoji">${b.emoji}</span>
        <span class="building-name">${b.name}</span>
        <span class="building-level">${unlocked ? `Lv.${level}` : '🔒'}</span>
        <span class="building-desc">${b.description}</span>
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

    // === 生成器升级 ===
    html += '<div class="shop-section"><h4>🔧 生成器升级</h4>';
    const gens = getAllGenerators();
    for (const gen of gens) {
      if (!gen.unlocked) continue;
      const cost = gen.upgradeCost;
      html += `<div class="shop-item">
        <span>${gen.emoji} ${gen.name} Lv.${gen.level}</span>
        <span class="gen-info">冷却 ${gen.cooldown}s</span>
        ${gen.level < 5
          ? `<button onclick="ui._upgradeGenerator('${gen.id}')" ${gameState.coins < cost ? 'disabled' : ''}>
              升级 🪙${cost}
             </button>`
          : '<span class="max-level">MAX</span>'
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
      this.openShop();
      this._renderTopBar();
      this._autoSave();
    } else {
      this._showToast('钻石不足！');
    }
  }

  _buyEnergyLarge() {
    if (gameState.diamonds < 10) return;
    gameState.diamonds -= 10;
    gameState.energy = Math.min(gameState.maxEnergy, gameState.energy + 120);
    this._showToast('⚡ +120 能量！');
    this.openShop();
    this._renderTopBar();
    this._autoSave();
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
    // 解锁对应的生成器
    for (const [genId, genConfig] of Object.entries(GENERATOR_CONFIGS)) {
      if (genConfig.unlockBuilding === buildingId) {
        gameState.unlockGenerator(genId);
        // 解锁对应的物品链
        gameState.unlockChain(genConfig.chain);
        this._showToast(`${b.emoji} ${b.name} 已解锁！解锁了 ${genConfig.name}！`);
        break;
      }
    }
    this.openShop();
    this._autoSave();
  }

  _upgradeBuilding(buildingId) {
    if (gameState.upgradeBuilding(buildingId)) {
      this._showToast('🏗️ 建筑升级成功！生成器效率提升！');
      this.openShop();
      this._autoSave();
    } else {
      this._showToast('金币不足！');
    }
  }

  _upgradeGenerator(genId) {
    const gen = new Generator(GENERATOR_CONFIGS[genId]);
    if (gen.upgrade()) {
      this._showToast(`🔧 ${gen.name} 升级成功！冷却缩短！`);
      this.openShop();
      this._autoSave();
    } else {
      this._showToast('金币不足或已达最高级！');
    }
  }

  // ===== 特效 =====

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

  // ===== 定时器 =====

  _startTimers() {
    // 能量恢复（每秒检查）
    this.energyTimer = setInterval(() => {
      gameState.tickEnergy();
      this._renderTopBar();
    }, 1000);

    // 生成器冷却更新（每秒）
    this.cooldownTimer = setInterval(() => {
      this._renderGenerators();
    }, 1000);

    // 自动生成器（每秒检查）
    this.autoTimer = setInterval(() => {
      const gens = getAllGenerators();
      for (const gen of gens) {
        if (!gen.unlocked || gen.type !== 'auto') continue;
        if (gen.onCooldown) continue;
        const item = gen.use();
        if (item) {
          const pos = grid.placeItem(item);
          if (pos) {
            this._showProduceEffect(pos.row, pos.col);
            this._renderAll();
            this._autoSave();
          }
        }
      }
    }, 1000);

    // 自动存档（每 30 秒）
    this.saveTimer = setInterval(() => {
      this._autoSave();
    }, 30000);
  }

  _autoSave() {
    SaveManager.save();
  }

  _bindGlobalEvents() {
    // 点击空白处关闭菜单
    document.addEventListener('click', (e) => {
      if (e.target.closest('.menu-content') || e.target.closest('.grid-cell')) return;
      this._hideItemMenu();
    });
  }

  _bindGridEvents() {
    // 键盘快捷键
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        this._hideItemMenu();
        this.closeShop();
      }
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
    description: '解锁菜篮生成器（面包链）',
    unlockLevel: 1,
    unlockCost: 0,
    effect: '缩短面包产出冷却'
  },
  cafe: {
    name: '咖啡馆',
    emoji: '☕',
    description: '解锁咖啡壶生成器（咖啡链）',
    unlockLevel: 3,
    unlockCost: 200,
    effect: '缩短咖啡产出冷却'
  },
  flower_shop: {
    name: '花店',
    emoji: '💐',
    description: '解锁花丛自动生成器（花链）',
    unlockLevel: 5,
    unlockCost: 500,
    effect: '缩短花丛产出间隔'
  },
  workshop: {
    name: '工坊',
    emoji: '🔧',
    description: '解锁工具箱生成器（工具链）',
    unlockLevel: 7,
    unlockCost: 1000,
    effect: '缩短工具产出冷却'
  },
  tailor: {
    name: '裁缝店',
    emoji: '👗',
    description: '解锁缝纫机生成器（装饰链）',
    unlockLevel: 9,
    unlockCost: 2000,
    effect: '缩短装饰产出冷却'
  }
};
