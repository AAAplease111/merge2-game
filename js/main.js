/**
 * main.js - 游戏入口 V2
 */

(function() {
  'use strict';

  function initGame() {
    console.log('🎮 Merge-2 梦幻小镇 v2.0');

    // 尝试读取存档
    const hasSave = SaveManager.load();
    if (hasSave) {
      console.log('📂 读取存档成功');
    } else {
      console.log('🆕 新游戏');
      // 初始解锁面包店和菜篮
      gameState.unlockBuilding('bakery');
      gameState.unlockGenerator('basket');
      gameState.unlockChain('bread');

      // 初始送一些物品
      for (let i = 0; i < 4; i++) {
        const item = {
          id: generateId(),
          type: 'bread',
          level: 1,
          emoji: ITEM_EMOJIS.bread[1]
        };
        const pos = grid.placeItem(item);
        if (!pos) break;
      }

      // 生成初始订单
      orderSystem.generateMainOrder();
      orderSystem.generateSideOrder();
    }

    // 初始化 UI
    ui.init();

    // 绑定按钮事件
    document.getElementById('btn-shop').addEventListener('click', () => ui.openShop());
    document.getElementById('btn-save').addEventListener('click', () => {
      SaveManager.save();
      ui._showToast('💾 已保存');
    });
    document.getElementById('btn-reset').addEventListener('click', () => {
      if (confirm('确定要重置游戏吗？所有进度将丢失！')) {
        SaveManager.delete();
        location.reload();
      }
    });

    console.log('✅ 游戏已启动');
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initGame);
  } else {
    initGame();
  }
})();
