/**
 * UI.js - UI 渲染与交互 V3
 * 拖拽合成 + 点击订单卡片提交物品
 * 生成器消耗能量产出
 */

class UI {
  constructor() {
    this.initialized = false;
    this.energyTimer = null;
    this.saveTimer = null;

    // 拖拽状态
    this.dragItem = null;
    this.dragFrom = null;
    this.isDragging = false;
  }

  init() {
    if (this.initialized) return;
    this.initialized = true;

    this._renderAll();
    this._startTimers();
    this._bindGlobalEvents();

    if (!orderSystem.mainOrder) orderSystem.generateMainOrder();
    if (orderSystem.sideOrders.length === 0) orderSystem.generateSideOrder();
    this._renderOrders();

    console.log('UI init done');
  }

  _renderAll() {
    this._renderTopBar();
    this._renderGrid();
    this._renderOrders();
    this._renderGenerators();
  }

  // ===== 顶部状态栏 =====
  _renderTopBar() {
    var bar = document.getElementById('top-bar');
    if (!bar) return;
    var exp = gameState.getExpProgress();
    bar.innerHTML = '' +
      '<div class="top-bar-left">' +
      '<span class="level-badge">Lv.' + gameState.level + '</span>' +
      '<div class="exp-bar-container">' +
      '<div class="exp-bar" style="width:' + exp.pct + '%"></div>' +
      '<span class="exp-text">' + exp.current + '/' + exp.max + '</span>' +
      '</div></div>' +
      '<div class="top-bar-right">' +
      '<span class="resource energy-display">⚡ ' + gameState.energy + '/' + gameState.maxEnergy + '</span>' +
      '<span class="resource">🪙 ' + gameState.coins + '</span>' +
      '<span class="resource">💎 ' + gameState.diamonds + '</span>' +
      '</div>';
  }

  // ===== 棋盘（拖拽合成） =====
  _renderGrid() {
    var container = document.getElementById('grid-container');
    if (!container) return;
    container.innerHTML = '';

    for (var r = 0; r < grid.rows; r++) {
      for (var c = 0; c < grid.cols; c++) {
        var cell = document.createElement('div');
        cell.className = 'grid-cell';
        cell.dataset.row = r;
        cell.dataset.col = c;

        var item = grid.getItem(r, c);
        if (item) {
          cell.classList.add('has-item', 'level-' + item.level);
          cell.innerHTML = '' +
            '<div class="grid-item" draggable="true">' +
            '<span class="item-emoji">' + item.emoji + '</span>' +
            '<span class="item-level">Lv.' + item.level + '</span>' +
            '</div>';

          var gridItem = cell.querySelector('.grid-item');
          // 鼠标拖拽
          gridItem.addEventListener('dragstart', (function(ui, r, c, item) {
            return function(e) { ui._onDragStart(e, r, c, item); };
          })(this, r, c, item));
          gridItem.addEventListener('dragend', (function(ui) {
            return function(e) { ui._onDragEnd(e); };
          })(this));

          // 触摸拖拽（手机）
          gridItem.addEventListener('touchstart', (function(ui, r, c, item) {
            return function(e) { ui._onTouchStart(e, r, c, item); };
          })(this, r, c, item), { passive: false });
          gridItem.addEventListener('touchmove', (function(ui) {
            return function(e) { ui._onTouchMove(e); };
          })(this), { passive: false });
          gridItem.addEventListener('touchend', (function(ui, r, c) {
            return function(e) { ui._onTouchEnd(e, r, c); };
          })(this, r, c), { passive: false });
        }

        // 放置目标
        cell.addEventListener('dragover', function(e) { e.preventDefault(); cell.classList.add('drop-target'); });
        cell.addEventListener('dragleave', function() { cell.classList.remove('drop-target'); });
        cell.addEventListener('drop', (function(ui, r, c) {
          return function(e) { e.preventDefault(); cell.classList.remove('drop-target'); ui._onDrop(r, c); };
        })(this, r, c));

        container.appendChild(cell);
      }
    }
  }

  // ===== 鼠标拖拽 =====
  _onDragStart(e, row, col, item) {
    this.dragItem = item;
    this.dragFrom = { row: row, col: col };
    this.isDragging = true;
    e.dataTransfer.setData('text/plain', row + ',' + col);
    e.dataTransfer.effectAllowed = 'move';
    var cell = e.target.closest('.grid-cell');
    if (cell) cell.classList.add('dragging');
  }

  _onDragEnd(e) {
    this.isDragging = false;
    this._clearDragHighlights();
  }

  _clearDragHighlights() {
    var els = document.querySelectorAll('.grid-cell.dragging, .drop-target');
    for (var i = 0; i < els.length; i++) {
      els[i].classList.remove('dragging');
      els[i].classList.remove('drop-target');
    }
  }

  _onDrop(toRow, toCol) {
    if (!this.dragFrom) return;
    var from = this.dragFrom;
    this.isDragging = false;
    this.dragItem = null;
    this.dragFrom = null;
    this._clearDragHighlights();

    if (from.row === toRow && from.col === toCol) return;

    var item1 = grid.getItem(from.row, from.col);
    var item2 = grid.getItem(toRow, toCol);

    if (item1 && item2 && grid.canMerge(item1, item2)) {
      // 合成！
      var result = grid.merge(from.row, from.col, toRow, toCol);
      if (result) {
        this._showMergeEffect(toRow, toCol);
        this._renderAll();
        this._autoSave();
      }
    } else if (item1 && !item2) {
      // 拖到空位
      grid.swap(from.row, from.col, toRow, toCol);
      this._renderAll();
    } else if (item1 && item2) {
      // 交换
      grid.swap(from.row, from.col, toRow, toCol);
      this._renderAll();
    }
  }

  // ===== 触摸拖拽（手机端） =====
  _onTouchStart(e, row, col, item) {
    this._touchStartTime = Date.now();
    this._touchStartPos = { row: row, col: col, item: item };
    this._touchMoved = false;
    this._touchClientX = e.touches[0].clientX;
    this._touchClientY = e.touches[0].clientY;
    var self = this;
    this._touchDragTimer = setTimeout(function() { self._startTouchDrag(); }, 200);
  }

  _startTouchDrag() {
    if (!this._touchStartPos) return;
    this.isDragging = true;
    this.dragItem = this._touchStartPos.item;
    this.dragFrom = { row: this._touchStartPos.row, col: this._touchStartPos.col };

    var cell = document.querySelector(
      '.grid-cell[data-row="' + this._touchStartPos.row + '"][data-col="' + this._touchStartPos.col + '"]'
    );
    if (cell) cell.classList.add('dragging');

    var clone = document.createElement('div');
    clone.className = 'touch-drag-clone';
    clone.textContent = this.dragItem.emoji;
    clone.style.position = 'fixed';
    clone.style.fontSize = '32px';
    clone.style.pointerEvents = 'none';
    clone.style.zIndex = '9999';
    clone.style.transform = 'translate(-50%, -50%)';
    clone.style.left = this._touchClientX + 'px';
    clone.style.top = this._touchClientY + 'px';
    document.body.appendChild(clone);
    this._dragClone = clone;
  }

  _onTouchMove(e) {
    this._touchMoved = true;
    if (this._touchDragTimer) {
      clearTimeout(this._touchDragTimer);
      this._touchDragTimer = null;
    }
    if (this._dragClone) {
      var touch = e.touches[0];
      this._touchClientX = touch.clientX;
      this._touchClientY = touch.clientY;
      this._dragClone.style.left = touch.clientX + 'px';
      this._dragClone.style.top = touch.clientY + 'px';
    }
  }

  _onTouchEnd(e, origRow, origCol) {
    if (this._touchDragTimer) {
      clearTimeout(this._touchDragTimer);
      this._touchDragTimer = null;
    }

    if (this._dragClone) {
      document.body.removeChild(this._dragClone);
      this._dragClone = null;
    }

    if (this.isDragging && this.dragFrom) {
      var touch = e.changedTouches[0];
      var target = document.elementFromPoint(touch.clientX, touch.clientY);
      var targetCell = target ? target.closest('.grid-cell') : null;
      if (targetCell) {
        var toRow = parseInt(targetCell.dataset.row);
        var toCol = parseInt(targetCell.dataset.col);
        this._onDrop(toRow, toCol);
      } else {
        this.isDragging = false;
        this.dragItem = null;
        this.dragFrom = null;
        this._clearDragHighlights();
      }
      return;
    }
  }

  // ===== 订单面板（点击提交） =====
  _renderOrders() {
    var panel = document.getElementById('order-panel');
    if (!panel) return;
    panel.innerHTML = '';

    // 主线订单
    if (orderSystem.mainOrder) {
      var mo = orderSystem.mainOrder;
      panel.appendChild(this._createOrderCard(mo, true));
    } else {
      orderSystem.generateMainOrder();
      this._renderOrders();
      return;
    }

    // 支线订单
    for (var si = 0; si < orderSystem.sideOrders.length; si++) {
      panel.appendChild(this._createOrderCard(orderSystem.sideOrders[si], false));
    }

    // 添加支线按钮
    if (orderSystem.sideOrders.length < orderSystem.maxSideOrders) {
      var addBtn = document.createElement('button');
      addBtn.className = 'add-order-btn';
      addBtn.textContent = '+ 接取支线';
      var self = this;
      addBtn.onclick = function() {
        orderSystem.generateSideOrder();
        self._renderOrders();
      };
      panel.appendChild(addBtn);
    }
  }

  _createOrderCard(order, isMain) {
    var div = document.createElement('div');
    div.className = 'order-card' + (isMain ? ' main-order' : ' side-order') + (order.completed ? ' completed' : '');
    div.dataset.orderId = order.id;

    var html = '' +
      '<div class="order-header">' +
      '<span class="order-emoji">' + order.emoji + '</span>' +
      '<span class="order-title">' + order.title + '</span>' +
      '</div>';

    // 需求列表（可点击提交）
    html += '<div class="order-requires">';
    for (var ri = 0; ri < order.requires.length; ri++) {
      var req = order.requires[ri];
      var name = ITEM_NAMES[req.type][req.level] || req.type;
      var emoji = ITEM_EMOJIS[req.type][req.level] || '?';
      var done = req.current >= req.count;
      html += '<div class="order-req-item' + (done ? ' req-done' : '') + '" data-order-id="' + order.id + '" data-req-type="' + req.type + '" data-req-level="' + req.level + '">' +
        '<span class="req-emoji">' + emoji + '</span>' +
        '<span class="req-name">' + name + '</span>' +
        '<span class="req-count">' + req.current + '/' + req.count + '</span>' +
        (done ? '<span class="req-check"> OK</span>' : '');
      if (!done) {
        html += '<button class="req-submit-btn" data-order-id="' + order.id + '" data-req-type="' + req.type + '" data-req-level="' + req.level + '">提交</button>';
      }
      html += '</div>';
    }
    html += '</div>';

    // 奖励
    html += '<div class="order-reward">' +
      (order.rewards.coins ? '🪙+' + order.rewards.coins + ' ' : '') +
      (order.rewards.exp ? '⭐+' + order.rewards.exp + ' ' : '') +
      (order.rewards.diamonds ? '💎+' + order.rewards.diamonds : '') +
      '</div>';

    div.innerHTML = html;

    // 绑定提交按钮事件
    var self = this;
    var btns = div.querySelectorAll('.req-submit-btn');
    for (var bi = 0; bi < btns.length; bi++) {
      (function(btn) {
        btn.addEventListener('click', function(e) {
          e.stopPropagation();
          var orderId = btn.dataset.orderId;
          var reqType = btn.dataset.reqType;
          var reqLevel = parseInt(btn.dataset.reqLevel);
          self._submitToOrder(orderId, reqType, reqLevel);
        });
      })(btns[bi]);
    }

    return div;
  }

  _submitToOrder(orderId, reqType, reqLevel) {
    // 从棋盘找匹配的物品
    var found = null;
    for (var r = 0; r < grid.rows; r++) {
      for (var c = 0; c < grid.cols; c++) {
        var item = grid.getItem(r, c);
        if (item && item.type === reqType && item.level === reqLevel) {
          found = { row: r, col: c };
          break;
        }
      }
      if (found) break;
    }

    if (!found) {
      this._showToast('棋盘上没有匹配的物品');
      return;
    }

    var result = orderSystem.submitItem(orderId, found.row, found.col);
    if (result.success) {
      if (result.order.completed) {
        this._showReward(result.order.rewards);
        if (result.order.type === 'side') {
          var self = this;
          setTimeout(function() {
            orderSystem.generateSideOrder();
            self._renderOrders();
          }, 1000);
        }
      }
      this._renderAll();
      this._autoSave();
    } else {
      this._showToast('无法提交');
    }
  }

  // ===== 生成器栏 =====
  _renderGenerators() {
    var bar = document.getElementById('generator-bar');
    if (!bar) return;
    bar.innerHTML = '';

    var generators = getAllGenerators();
    for (var gi = 0; gi < generators.length; gi++) {
      var gen = generators[gi];
      var div = document.createElement('div');
      div.className = 'generator-btn' + (gen.unlocked ? ' unlocked' : ' locked');

      if (gen.unlocked) {
        var canUse = gameState.energy >= 5;
        div.innerHTML = '' +
          '<div class="gen-emoji">' + gen.emoji + '</div>' +
          '<div class="gen-name">' + gen.name + '</div>' +
          '<div class="gen-level">Lv.' + gen.level + '</div>' +
          '<div class="gen-energy">⚡5</div>';
        if (!canUse) div.classList.add('no-energy');
        div.onclick = (function(ui, genId) {
          return function() { ui._onGeneratorClick(genId); };
        })(this, gen.id);
      } else {
        var unlockInfo = gen.unlockBuilding
          ? (BUILDING_CONFIGS[gen.unlockBuilding] ? BUILDING_CONFIGS[gen.unlockBuilding].name : gen.unlockBuilding)
          : 'Lv.' + gen.unlockLevel;
        div.innerHTML = '' +
          '<div class="gen-emoji">🔒</div>' +
          '<div class="gen-name">' + gen.name + '</div>' +
          '<div class="gen-lock-info">' + unlockInfo + '</div>';
      }

      bar.appendChild(div);
    }
  }

  _onGeneratorClick(genId) {
    var gen = new Generator(GENERATOR_CONFIGS[genId]);
    if (!gen.unlocked) {
      this._showToast('需要先解锁对应建筑');
      return;
    }
    if (gameState.energy < 5) {
      this._showToast('能量不足！');
      return;
    }

    var item = gen.use();
    if (!item) {
      this._showToast('能量不足！');
      return;
    }

    var pos = grid.placeItem(item);
    if (!pos) {
      this._showToast('棋盘已满！');
      return;
    }

    this._showProduceEffect(pos.row, pos.col);
    this._renderAll();
    this._autoSave();
  }

  // ===== 商店 =====
  openShop() {
    var modal = document.getElementById('shop-modal');
    if (!modal) return;

    var html = '<div class="shop-content">';
    html += '<h3>🏪 商店</h3>';

    // 能量
    html += '<div class="shop-section"><h4>⚡ 能量</h4>';
    html += '<div class="shop-item"><span>购买 50 能量</span><span class="shop-price">💎5</span><button onclick="ui._buyEnergy()"' + (gameState.diamonds < 5 ? ' disabled' : '') + '>购买</button></div>';
    html += '<div class="shop-item"><span>购买 120 能量</span><span class="shop-price">💎10</span><button onclick="ui._buyEnergyLarge()"' + (gameState.diamonds < 10 ? ' disabled' : '') + '>购买</button></div></div>';

    // 建筑
    html += '<div class="shop-section"><h4>🏗️ 建筑</h4>';
    for (var id in BUILDING_CONFIGS) {
      var b = BUILDING_CONFIGS[id];
      var existing = gameState.buildings[id];
      var unlocked = existing && existing.unlocked;
      var level = existing ? existing.level : 0;
      var cost = gameState.getBuildingUpgradeCost(id, level + 1);

      html += '<div class="shop-item building-item">';
      html += '<span class="building-emoji">' + b.emoji + '</span>';
      html += '<span class="building-name">' + b.name + '</span>';
      html += '<span class="building-level">' + (unlocked ? 'Lv.' + level : '🔒') + '</span>';
      html += '<span class="building-desc">' + b.description + '</span>';
      if (unlocked && level < 5) {
        html += '<button onclick="ui._upgradeBuilding(\'' + id + '\')"' + (gameState.coins < cost ? ' disabled' : '') + '>升级 🪙' + cost + '</button>';
      } else if (!unlocked && gameState.level >= b.unlockLevel) {
        html += '<button onclick="ui._unlockBuilding(\'' + id + '\')">解锁 🪙' + b.unlockCost + '</button>';
      } else {
        html += '<span class="lock-info">需要 Lv.' + b.unlockLevel + '</span>';
      }
      html += '</div>';
    }
    html += '</div>';

    // 生成器升级
    html += '<div class="shop-section"><h4>🔧 生成器升级</h4>';
    var gens = getAllGenerators();
    for (var gi = 0; gi < gens.length; gi++) {
      var gen = gens[gi];
      if (!gen.unlocked) continue;
      var cost = gen.upgradeCost;
      html += '<div class="shop-item">';
      html += '<span>' + gen.emoji + ' ' + gen.name + ' Lv.' + gen.level + '</span>';
      if (gen.level < 5) {
        html += '<button onclick="ui._upgradeGenerator(\'' + gen.id + '\')"' + (gameState.coins < cost ? ' disabled' : '') + '>升级 🪙' + cost + '</button>';
      } else {
        html += '<span class="max-level">MAX</span>';
      }
      html += '</div>';
    }
    html += '</div>';

    html += '<button onclick="ui.closeShop()" class="close-shop-btn">关闭</button>';
    html += '</div>';

    modal.innerHTML = html;
    modal.classList.remove('hidden');
  }

  closeShop() {
    var modal = document.getElementById('shop-modal');
    if (modal) modal.classList.add('hidden');
    this._renderAll();
  }

  _buyEnergy() {
    if (gameState.buyEnergy()) {
      this._showToast('+50 能量！');
      this.openShop();
      this._renderAll();
      this._autoSave();
    } else {
      this._showToast('钻石不足！');
    }
  }

  _buyEnergyLarge() {
    if (gameState.diamonds < 10) return;
    gameState.diamonds -= 10;
    gameState.energy = Math.min(gameState.maxEnergy, gameState.energy + 120);
    this._showToast('+120 能量！');
    this.openShop();
    this._renderAll();
    this._autoSave();
  }

  _unlockBuilding(buildingId) {
    var b = BUILDING_CONFIGS[buildingId];
    if (!b) return;
    if (gameState.coins < b.unlockCost) {
      this._showToast('金币不足！');
      return;
    }
    gameState.coins -= b.unlockCost;
    gameState.unlockBuilding(buildingId);
    for (var genId in GENERATOR_CONFIGS) {
      var genConfig = GENERATOR_CONFIGS[genId];
      if (genConfig.unlockBuilding === buildingId) {
        gameState.unlockGenerator(genId);
        gameState.unlockChain(genConfig.chain);
        this._showToast(b.emoji + ' ' + b.name + ' 已解锁！');
        break;
      }
    }
    this.openShop();
    this._autoSave();
  }

  _upgradeBuilding(buildingId) {
    if (gameState.upgradeBuilding(buildingId)) {
      this._showToast('建筑升级成功！');
      this.openShop();
      this._autoSave();
    } else {
      this._showToast('金币不足！');
    }
  }

  _upgradeGenerator(genId) {
    var gen = new Generator(GENERATOR_CONFIGS[genId]);
    if (gen.upgrade()) {
      this._showToast(gen.name + ' 升级成功！');
      this.openShop();
      this._autoSave();
    } else {
      this._showToast('金币不足或已达最高等级！');
    }
  }

  // ===== 特效 =====
  _showMergeEffect(row, col) {
    var cell = document.querySelector('.grid-cell[data-row="' + row + '"][data-col="' + col + '"]');
    if (!cell) return;
    cell.classList.add('merge-flash');
    setTimeout(function() { cell.classList.remove('merge-flash'); }, 500);
  }

  _showProduceEffect(row, col) {
    var cell = document.querySelector('.grid-cell[data-row="' + row + '"][data-col="' + col + '"]');
    if (!cell) return;
    cell.classList.add('item-appear');
    setTimeout(function() { cell.classList.remove('item-appear'); }, 400);
  }

  _showReward(rewards) {
    var toast = document.getElementById('reward-toast');
    if (!toast) return;
    var html = '' +
      '<div class="reward-content">' +
      '<div class="reward-title">🎉 订单完成！</div>' +
      '<div class="reward-items">';
    if (rewards.coins) html += '<span>🪙+' + rewards.coins + '</span>';
    if (rewards.exp) html += '<span>⭐+' + rewards.exp + '</span>';
    if (rewards.diamonds) html += '<span>💎+' + rewards.diamonds + '</span>';
    html += '</div></div>';
    toast.innerHTML = html;
    toast.classList.remove('hidden');
    toast.classList.add('reward-pop');
    setTimeout(function() {
      toast.classList.add('hidden');
      toast.classList.remove('reward-pop');
    }, 2000);
  }

  _showToast(message) {
    var toast = document.getElementById('toast');
    if (!toast) return;
    toast.textContent = message;
    toast.classList.remove('hidden');
    toast.classList.add('toast-pop');
    setTimeout(function() {
      toast.classList.add('hidden');
      toast.classList.remove('toast-pop');
    }, 1500);
  }

  // ===== 定时器 =====
  _startTimers() {
    var self = this;
    this.energyTimer = setInterval(function() {
      gameState.tickEnergy();
      self._renderTopBar();
      self._renderGenerators();
    }, 1000);

    this.saveTimer = setInterval(function() {
      self._autoSave();
    }, 30000);
  }

  _autoSave() {
    SaveManager.save();
  }

  _bindGlobalEvents() {
    var self = this;
    document.addEventListener('keydown', function(e) {
      if (e.key === 'Escape') {
        self.closeShop();
      }
    });
  }
}

var ui = new UI();

var BUILDING_CONFIGS = {
  bakery: {
    name: '面包店',
    emoji: '🥖',
    description: '解锁菜篮生成器（面包链）',
    unlockLevel: 1,
    unlockCost: 0,
    effect: '缩短面包链冷却'
  },
  cafe: {
    name: '咖啡馆',
    emoji: '☕',
    description: '解锁咖啡壶生成器（咖啡链）',
    unlockLevel: 3,
    unlockCost: 200,
    effect: '缩短咖啡链冷却'
  },
  flower_shop: {
    name: '花店',
    emoji: '💐',
    description: '解锁花丛生成器（花链）',
    unlockLevel: 5,
    unlockCost: 500,
    effect: '缩短花链冷却'
  },
  workshop: {
    name: '工坊',
    emoji: '🔧',
    description: '解锁工具箱生成器（工具链）',
    unlockLevel: 7,
    unlockCost: 1000,
    effect: '缩短工具链冷却'
  },
  tailor: {
    name: '裁缝店',
    emoji: '👗',
    description: '解锁缝纫机生成器（装饰链）',
    unlockLevel: 9,
    unlockCost: 2000,
    effect: '缩短装饰链冷却'
  }
};
