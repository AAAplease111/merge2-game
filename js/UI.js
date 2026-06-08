/**
 * UI.js - UI 渲染与交互 V3
 * 拖拽合成 + 点击选中提交订单
 * 手机端：touch 事件模拟拖拽
 */

class UI {
  constructor() {
    this.initialized = false;
    this.energyTimer = null;
    this.autoTimer = null;
    this.saveTimer = null;
    this.cooldownTimer = null;

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
    const bar = document.getElementById('top-bar');
    if (!bar) return;
    const exp = gameState.getExpProgress();
    bar.innerHTML = [
      '<div class="top-bar-left">',
      '<span class="level-badge">Lv.' + gameState.level + '</span>',
      '<div class="exp-bar-container">',
      '<div class="exp-bar" style="width:' + exp.pct + '%"></div>',
      '<span class="exp-text">' + exp.current + '/' + exp.max + '</span>',
      '</div></div>',
      '<div class="top-bar-right">',
      '<span class="resource energy-display">⚡ ' + gameState.energy + '/' + gameState.maxEnergy + '</span>',
      '<span class="resource">🪙 ' + gameState.coins + '</span>',
      '<span class="resource">💎 ' + gameState.diamonds + '</span>',
      '</div>'
    ].join('');
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
          cell.classList.add('has-item', 'level-' + item.level);
          cell.innerHTML = '' +
            '<div class="grid-item" draggable="true">' +
            '<span class="item-emoji">' + item.emoji + '</span>' +
            '<span class="item-level">Lv.' + item.level + '</span>' +
            '</div>';

          const gridItem = cell.querySelector('.grid-item');
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

        // 点击选中（提交订单）
        cell.addEventListener('click', (function(ui, r, c) {
          return function(e) {
            if (ui.isDragging) return;
            ui._onCellClick(r, c);
          };
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
    var els = document.querySelectorAll('.grid-cell.dragging');
    for (var i = 0; i < els.length; i++) els[i].classList.remove('dragging');
    els = document.querySelectorAll('.drop-target');
    for (var i = 0; i < els.length; i++) els[i].classList.remove('drop-target');
  }

  _onDrop(toRow, toCol) {
    if (!this.dragFrom) return;
    var from = this.dragFrom;
    this.isDragging = false;
    this.dragItem = null;
    this.dragFrom = null;

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
    // 长按才触发拖拽，短按是点击
    this._touchStartTime = Date.now();
    this._touchStartPos = { row: row, col: col, item: item };
    this._touchMoved = false;
    this._touchDragTimer = setTimeout((function(ui) {
      return function() {
        ui._startTouchDrag();
      };
    })(this), 200);
  }

  _startTouchDrag() {
    if (!this._touchStartPos) return;
    this.isDragging = true;
    this.dragItem = this._touchStartPos.item;
    this.dragFrom = { row: this._touchStartPos.row, col: this._touchStartPos.col };

    // 创建视觉克隆
    var cell = document.querySelector(
      '.grid-cell[data-row="' + this._touchStartPos.row + '"][data-col="' + this._touchStartPos.col + '"]'
    );
    if (!cell) return;
    cell.classList.add('dragging');

    // 创建跟随手指的克隆
    var clone = document.createElement('div');
    clone.className = 'touch-drag-clone';
    clone.textContent = this.dragItem.emoji;
    clone.style.position = 'fixed';
    clone.style.fontSize = '36px';
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

    // 移除克隆
    if (this._dragClone) {
      document.body.removeChild(this._dragClone);
      this._dragClone = null;
    }

    // 如果拖拽过，找目标格子
    if (this.isDragging && this.dragFrom) {
      var touch = e.changedTouches[0];
      var target = document.elementFromPoint(touch.clientX, touch.clientY);
      var targetCell = target ? target.closest(".grid-cell") : null;
      if (targetCell) {
        var toRow = parseInt(targetCell.dataset.row);
        var toCol = parseInt(targetCell.dataset.col);
        this._onDrop(toRow, toCol);
      } else {
        // 拖到棋盘外，取消
        this.isDragging = false;
        this.dragItem = null;
        this.dragFrom = null;
        var els = document.querySelectorAll('.grid-cell.dragging');
        for (var i = 0; i < els.length; i++) els[i].classList.remove('dragging');
      }
      return;
    }

    // 没有拖拽，视为点击
    if (!this._touchMoved) {
      this._onCellClick(origRow, origCol);
    }
  }

  // ===== 点击选中（提交订单） =====
  _onCellClick(row, col) {
    var item = grid.getItem(row, col);
    if (!item) return;

    // 显示操作菜单
    this._showItemMenu(row, colAlgorithm);
  }

  _showItemMenu(row, col) {
    var item = grid.getItem(row, col);
    if (!item) return;

    var modal = document.getElementById('item-menu');
    if (!modal) return;

    var name = ITEM_NAMES[item.type][item.level] || '未知';
    var emoji = item.emoji;

    // 检查哪些订单能接受这个物品
    var orderOptions = [];
    if (orderSystem.mainOrder && !orderSystem.mainOrder.completed) {
      var canSubmit = false;
      for (var i = 0; i < orderSystem.mainOrder.requires.length; i++) {
        var r = orderSystem.mainOrder.requires[i];
        if (r.type === item.type && r.level === item.level && r.current < r.count) {
          canSubmit = true;
          break;
        }
      }
      if (canSubmit) orderOptions.push({ id: orderSystem.mainOrder.id, label: '主线订单' });
    }
    for (var si = 0; si < orderSystem.sideOrders.length; si++) {
      var so = orderSystem.sideOrders[si];
      if (so.completed) continue;
      var canSubmit = false;
      for (var j = 0; j < so.requires.length; j++) {
        var r = so.requires[j];
        if (r.type === item.type && r.level === item.level && r.current < r.count) {
          canSubmit = true;
          break;
        }
      }
      if (canSubmit) orderOptions.push({ id: so.id, label: so.title });
    }

    var html = '' +
      '<div class="menu-backdrop" onclick="ui._hideItemMenu()"></div>' +
      '<div class="menu-content">' +
      '<div class="menu-item-preview">' +
      '<span class="menu-emoji">' + emoji + '</span>' +
      '<span class="menu-name">' + name + ' Lv.' + item.level + '</span>' +
      '</div><div class="menu-actions">';

    if (orderOptions.length > 0) {
      for (var oi = 0; oi < orderOptions.length; oi++) {
        var opt = orderOptions[oi];
        html += '<button class="menu-btn submit-btn" data-order-id="' + opt.id + '" data-row="' + row + '" data-col="' + col + '">' + opt.label + ' 提交</button>';
      }
    } else {
      html += '<div class="menu-no-match">当前没有订单需要这个物品</div>';
    }
    html += '<button class="menu-btn cancel-btn" onclick="ui._hideItemMenu()">取消</button>';
    html += '</div></div>';

    modal.innerHTML = html;
    modal.classList.remove('hidden');

    // 绑定提交事件
    var btns = modal.querySelectorAll('.submit-btn');
    for (var bi = 0; bi < btns.length; bi++) {
      (function(ui, btn) {
        btn.addEventListener('click', function() {
          var orderId = btn.dataset.orderId;
          var row2 = parseInt(btn.dataset.row);
          var col2 = parseInt(btn.dataset.col);
          ui._submitToOrder(orderId, row2, col2);
        });
      })(this, btns[bi]);
    }
  }

  _hideItemMenu() {
    var modal = document.getElementById('item-menu');
    if (modal) modal.classList.add('hidden');
  }

  _submitToOrder(orderId, row, col) {
    var result = orderSystem.submitItem(orderId, row, col);
    if (result.success) {
      this._hideItemMenu();
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
      this._showToast('无法提交此物品');
    }
  }

  // ===== 订单面板 =====
  _renderOrders() {
    var panel = document.getElementById('order-panel');
    if (!panel) return;
    panel.innerHTML = '';

    // 主线订单
    if (orderSystem.mainOrder) {
      var mo = orderSystem.mainOrder;
      var moDiv = document.createElement('div');
      moDiv.className = 'order-card main-order' + (mo.completed ? ' completed' : '');
      var moHtml = '' +
        '<div class="order-header">' +
        '<span class="order-emoji">' + mo.emoji + '</span>' +
        '<span class="order-title">' + mo.title + '</span>' +
        (mo.completed ? '<span class="order-done">OK</span>' : '') +
        '</div>' +
        '<div class="order-desc">' + mo.description + '</div>' +
        '<div class="order-progress">' + orderSystem.getProgressText(mo) + '</div>' +
        '<div class="order-reward">' + mo.rewards.coins + 'g ' + mo.rewards.exp + 'xp' + (mo.rewards.diamonds ? ' di' + mo.rewards.diamonds : '') + '</div>';
      moDiv.innerHTML = moHtml;
      panel.appendChild(moDiv);
    } else {
      orderSystem.generateMainOrder();
      this._renderOrders();
      return;
    }

    // 支线订单
    for (var si = 0; si < orderSystem.sideOrders.length; si++) {
      var so = orderSystem.sideOrders[si];
      var soDiv = document.createElement('div');
      soDiv.className = 'order-card side-order' + (so.completed ? ' completed' : '');
      var soHtml = '' +
        '<div class="order-header">' +
        '<span class="order-emoji">' + so.emoji + '</span>' +
        '<span class="order-title">' + so.title + '</span>' +
        (so.completed ? '<span class="order-done">OK</span>' : '') +
        '</div>' +
        '<div class="order-desc">' + so.description + '</div>' +
        '<div class="order-progress">' + orderSystem.getProgressText(so) + '</div>' +
        '<div class="order-reward">' + so.rewards.coins + 'g ' + so.rewards.exp + 'xp' + (so.rewards.diamonds ? ' di' + so.rewards.diamonds : '') + '</div>';
      soDiv.innerHTML = soHtml;
      panel.appendChild(soDiv);
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
      div.title = gen.description;

      if (gen.unlocked) {
        var remaining = gen.remainingCooldown;
        var isOnCooldown = gen.onCooldown;
        div.innerHTML = '' +
          '<div class="gen-emoji">' + gen.emoji + '</div>' +
          '<div class="gen-name">' + gen.name + '</div>' +
          '<div class="gen-level">Lv.' + gen.level + '</div>' +
          (isOnCooldown
            ? '<div class="gen-cooldown" data-gen="' + gen.id + '">' + remaining + 's</div>'
            : '<div class="gen-ready">Ready</div>');
        div.onclick = (function(ui, genId) {
          return function() { ui._onGeneratorClick(genId); };
        })(this, gen.id);
        if (isOnCooldown) div.classList.add('on-cooldown');
      } else {
        var unlockInfo = gen.unlockBuilding
          ? (BUILDING_CONFIGS[gen.unlockBuilding] ? BUILDING_CONFIGS[gen.unlockBuilding].name : gen.unlockBuilding)
          : 'Lv.' + gen.unlockLevel;
        div.innerHTML = '' +
          '<div class="gen-emoji">LOCK</div>' +
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
    if (gen.onCooldown) {
      this._showToast('冷却中 ' + gen.remainingCooldown + 's');
      return;
    }

    var item = gen.use();
    if (!item) {
      this._showToast('生成器冷却中');
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
    html += '<h3>Store</h3>';

    // 能量
    html += '<div class="shop-section"><h4>Energy</h4>';
    html += '<div class="shop-item"><span>Buy 50 Energy</span><span class="shop-price">5 di</span><button onclick="ui._buyEnergy()"' + (gameState.diamonds < 5 ? ' disabled' : '') + '>Buy</button></div>';
    html += '<div class="shop-item"><span>Buy 120 Energy</span><span class="shop-price">10 di</span><button onclick="ui._buyEnergyLarge()"' + (gameState.diamonds < 10 ? ' disabled' : '') + '>Buy</button></div></div>';

    // 建筑
    html += '<div class="shop-section"><h4>Buildings</h4>';
    for (var id in BUILDING_CONFIGS) {
      var b = BUILDING_CONFIGS[id];
      var existing = gameState.buildings[id];
      var unlocked = existing && existing.unlocked;
      var level = existing ? existing.level : 0;
      var cost = gameState.getBuildingUpgradeCost(id, level + 1);

      html += '<div class="shop-item building-item">';
      html += '<span class="building-emoji">' + b.emoji + '</span>';
      html += '<span class="building-name">' + b.name + '</span>';
      html += '<span class="building-level">' + (unlocked ? 'Lv.' + level : 'LOCK') + '</span>';
      html += '<span class="building-desc">' + b.description + '</span>';
      if (unlocked && level < 5) {
        html += '<button onclick="ui._upgradeBuilding(\'' + id + '\')"' + (gameState.coins < cost ? ' disabled' : '') + '>Upgrade ' + cost + 'g</button>';
      } else if (!unlocked && gameState.level >= b.unlockLevel) {
        html += '<button onclick="ui._unlockBuilding(\'' + id + '\')">Unlock ' + b.unlockCost + 'g</button>';
      } else {
        html += '<span class="lock-info">Lv.' + b.unlockLevel + '</span>';
      }
      html += '</div>';
    }
    html += '</div>';

    // 生成器升级
    html += '<div class="shop-section"><h4>Generators</h4>';
    var gens = getAllGenerators();
    for (var gi = 0; gi < gens.length; gi++) {
      var gen = gens[gi];
      if (!gen.unlocked) continue;
      var cost = gen.upgradeCost;
      html += '<div class="shop-item">';
      html += '<span>' + gen.emoji + ' ' + gen.name + ' Lv.' + gen.level + '</span>';
      html += '<span class="gen-info">' + gen.cooldown + 's</span>';
      if (gen.level < 5) {
        html += '<button onclick="ui._upgradeGenerator(\'' + gen.id + '\')"' + (gameState.coins < cost ? ' disabled' : '') + '>Upgrade ' + cost + 'g</button>';
      } else {
        html += '<span class="max-level">MAX</span>';
      }
      html += '</div>';
    }
    html += '</div>';

    html += '<button onclick="ui.closeShop()" class="close-shop-btn">Close</button>';
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
      this._showToast('+50 Energy!');
      this.openShop();
      this._renderTopBar();
      this._autoSave();
    } else {
      this._showToast('Not enough diamonds!');
    }
  }

  _buyEnergyLarge() {
    if (gameState.diamonds < 10) return;
    gameState.diamonds -= 10;
    gameState.energy = Math.min(gameState.maxEnergy, gameState.energy + 120);
    this._showToast('+120 Energy!');
    this.openShop();
    this._renderTopBar();
    this._autoSave();
  }

  _unlockBuilding(buildingId) {
    var b = BUILDING_CONFIGS[buildingId];
    if (!b) return;
    if (gameState.coins < b.unlockCost) {
      this._showToast('Not enough coins!');
      return;
    }
    gameState.coins -= b.unlockCost;
    gameState.unlockBuilding(buildingId);
    // 解锁对应的生成器
    for (var genId in GENERATOR_CONFIGS) {
      var genConfig = GENERATOR_CONFIGS[genId];
      if (genConfig.unlockBuilding === buildingId) {
        gameState.unlockGenerator(genId);
        gameState.unlockChain(genConfig.chain);
        this._showToast(b.emoji + ' ' + b.name + ' unlocked! ' + genConfig.name + ' available!');
        break;
      }
    }
    this.openShop();
    this._autoSave();
  }

  _upgradeBuilding(buildingId) {
    if (gameState.upgradeBuilding(buildingId)) {
      this._showToast('Building upgraded!');
      this.openShop();
      this._autoSave();
    } else {
      this._showToast('Not enough coins!');
    }
  }

  _upgradeGenerator(genId) {
    var gen = new Generator(GENERATOR_CONFIGS[genId]);
    if (gen.upgrade()) {
      this._showToast(gen.name + ' upgraded!');
      this.openShop();
      this._autoSave();
    } else {
      this._showToast('Not enough coins or max level!');
    }
  }

  // ===== 特效 =====
  _showMergeEffect(row, col) {
    var cell = document.querySelector('.grid-cell[data-row="' + row + '"][data-col="' + col + '"]');
    if (!cell) return;
    cell.classList.add('merge-flash');
    var self = this;
    setTimeout(function() { cell.classList.remove('merge-flash'); }, 500);
  }

  _showProduceEffect(row, col) {
    var cell = document.querySelector('.grid-cell[data-row="' + row + '"][data-col="' + col + '"]');
    if (!cell) return;
    cell.classList.add('item-appear');
    var self = this;
    setTimeout(function() { cell.classList.remove('item-appear'); }, 400);
  }

  _showReward(rewards) {
    var toast = document.getElementById('reward-toast');
    if (!toast) return;
    var html = '' +
      '<div class="reward-content">' +
      '<div class="reward-title">Order Complete!</div>' +
      '<div class="reward-items">';
    if (rewards.coins) html += '<span>+' + rewards.coins + 'g</span>';
    if (rewards.exp) html += '<span>+' + rewards.exp + 'xp</span>';
    if (rewards.diamonds) html += '<span>+' + rewards.diamonds + 'di</span>';
    html += '</div></div>';
    toast.innerHTML = html;
    toast.classList.remove('hidden');
    toast.classList.add('reward-pop');
    var self = this;
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
    var self = this;
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
    }, 1000);

    this.cooldownTimer = setInterval(function() {
      self._renderGenerators();
    }, 1000);

    this.autoTimer = setInterval(function() {
      var gens = getAllGenerators();
      for (var gi = 0; gi < gens.length; gi++) {
        var gen = gens[gi];
        if (!gen.unlocked || gen.type !== 'auto') continue;
        if (gen.onCooldown) continue;
        var item = gen.use();
        if (item) {
          var pos = grid.placeItem(item);
          if (pos) {
            self._showProduceEffect(pos.row, pos.col);
            self._renderAll();
            self._autoSave();
          }
        }
      }
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
    document.addEventListener('click', function(e) {
      if (e.target.closest('.menu-content') || e.target.closest('.grid-cell')) return;
      self._hideItemMenu();
    });
    document.addEventListener('keydown', function(e) {
      if (e.key === 'Escape') {
        self._hideItemMenu();
        self.closeShop();
      }
    });
  }
}

var ui = new UI();

var BUILDING_CONFIGS = {
  bakery: {
    name: 'Bakery',
    emoji: 'BREAD',
    description: 'Unlocks Basket generator (Bread chain)',
    unlockLevel: 1,
    unlockCost: 0,
    effect: 'Shortens bread cooldown'
  },
  cafe: {
    name: 'Cafe',
    emoji: 'COFFEE',
    description: 'Unlocks Coffee Pot generator (Coffee chain)',
    unlockLevel: 3,
    unlockCost: 200,
    effect: 'Shortens coffee cooldown'
  },
  flower_shop: {
    name: 'Flower Shop',
    emoji: 'FLOWER',
    description: 'Unlocks Flower Bush auto generator (Flower chain)',
    unlockLevel: 5,
    unlockCost: 500,
    effect: 'Shortens flower cooldown'
  },
  workshop: {
    name: 'Workshop',
    emoji: 'TOOL',
    description: 'Unlocks Tool Box generator (Tool chain)',
    unlockLevel: 7,
    unlockCost: 1000,
    effect: 'Shortens tool cooldown'
  },
  tailor: {
    name: 'Tailor',
    emoji: 'DECOR',
    description: 'Unlocks Sewing Machine generator (Decor chain)',
    unlockLevel: 9,
    unlockCost: 2000,
    effect: 'Shortens decor cooldown'
  }
};
