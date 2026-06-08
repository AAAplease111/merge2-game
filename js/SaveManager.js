/**
 * SaveManager.js - 存档管理
 * P0 版：localStorage
 */

const SAVE_KEY = 'merge2_save';

class SaveManager {
  /** 保存游戏 */
  static save() {
    try {
      const data = {
        version: 1,
        timestamp: Date.now(),
        state: gameState.serialize(),
        grid: grid.serialize(),
        orders: orderSystem.serialize()
      };
      localStorage.setItem(SAVE_KEY, JSON.stringify(data));
      return true;
    } catch (e) {
      console.warn('Save failed:', e);
      return false;
    }
  }

  /** 读取存档 */
  static load() {
    try {
      const raw = localStorage.getItem(SAVE_KEY);
      if (!raw) return false;
      const data = JSON.parse(raw);

      gameState.deserialize(data.state || {});
      grid.deserialize(data.grid || []);
      orderSystem.deserialize(data.orders || {});

      return true;
    } catch (e) {
      console.warn('Load failed:', e);
      return false;
    }
  }

  /** 删除存档 */
  static delete() {
    localStorage.removeItem(SAVE_KEY);
  }

  /** 检查是否有存档 */
  static hasSave() {
    return localStorage.getItem(SAVE_KEY) !== null;
  }

  /** 获取存档时间 */
  static getSaveTime() {
    try {
      const raw = localStorage.getItem(SAVE_KEY);
      if (!raw) return null;
      const data = JSON.parse(raw);
      return new Date(data.timestamp);
    } catch {
      return null;
    }
  }
}
