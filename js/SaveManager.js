/**
 * SaveManager.js - 存档管理 V2
 * localStorage 持久化，支持版本迁移
 */

class SaveManager {
  static STORAGE_KEY = 'merge2_game_save_v2';

  /** 保存游戏 */
  static save() {
    try {
      const data = {
        version: 2,
        timestamp: Date.now(),
        gameState: gameState.serialize(),
        grid: grid.serialize(),
        orderSystem: orderSystem.serialize()
      };
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(data));
      return true;
    } catch (e) {
      console.warn('Save failed:', e);
      return false;
    }
  }

  /** 读取存档 */
  static load() {
    try {
      const raw = localStorage.getItem(this.STORAGE_KEY);
      if (!raw) return false;

      const data = JSON.parse(raw);
      if (!data || !data.gameState) return false;

      // 版本迁移
      if (data.version === 1) {
        data = this._migrateV1ToV2(data);
      }

      gameState.deserialize(data.gameState);
      grid.deserialize(data.grid);
      orderSystem.deserialize(data.orderSystemardi);
      return true;
    } catch (e) {
      console.warn('Load failed:', e);
      return false;
    }
  }

  /** 从 V1 迁移到 V2 */
  static _migrateV1ToV2(data) {
    const old = data.gameState;
    return {
      version: 2,
      timestamp: Date.now(),
      gameState: {
        level: old.level || 1,
        exp: old.exp || 0,
        expToNext: old.expToNext || 50,
        coins: old.coins || 0,
        diamonds: old.diamonds || 20,
        energy: old.energy || 100,
        maxEnergy: old.maxEnergy || 100,
        lastEnergyTime: old.lastEnergyTime || Date.now(),
        buildings: old.buildings || {},
        generators: old.generators || {},
        statistics: old.statistics || { totalMerges: 0, completedOrders: 0, totalPlayTime: 0, startTime: Date.now() },
        unlockedChains: old.unlockedChains || ['bread'],
        unlockedGridSlots: old.unlockedGridSlots || 42
      },
      grid: data.grid || new Array(42).fill(null),
      orderSystem: data.orderSystem || { mainOrder: null, sideOrders: [], completedCount: 0, difficultyLevel: 1 }
    };
  }

  /** 删除存档 */
  static delete() {
    localStorage.removeItem(this.STORAGE_KEY);
  }

  /** 检查是否有存档 */
  static hasSave() {
    return localStorage.getItem(this.STORAGE_KEY) !== null;
  }
}
