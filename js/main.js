/**
 * main.js - 游戏入口
 * P0 版：初始化游戏，绑定事件
 */

(function() {
  'use strict';

  /** 游戏初始化 */
  function initGame() {
    console.log('🎮 Merge-2 二合游戏 v0.1 (P0)');

    // 尝试读取存档
    const hasSave = SaveManager.load();
    if (hasSave) {
      console.log('📂 读取存档成功');
    } else {
      console.log('🆕 新游戏');
      // 初始解锁
      gameState.unlockBuilding('bakery');
      gameState.unlockGenerator('basket');
      // 初始送一些物品
      for (let i = 0; i < 3; i++) {
        grid.placeItem({
          id: generateId(),
          type: 'bread',
          level: 1,
          emoji: '🌾'
        });
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

  // DOM 加载完成后初始化
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initGame);
  } else {
    initGame();
  }
})();
