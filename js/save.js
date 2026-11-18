/* ============================================================
   save.js — 存档内核（schema 2）
   单机持久化：Electron 走 userData 下的 JSON 文件，浏览器走 localStorage。
   职责：读档 / 迁移 / 去抖落盘 / 原子写入 IPC / 重置。
   设计约束：
     ① 旧版扁平结构（heartbeat_v2_save）必须无损迁移，旧键保留一版便于回退；
     ② 任何异常都不允许把游戏卡死——读失败就建空档，写失败就留住脏标记；
     ③ 落盘去抖 300ms，磁盘上永远是完整文件（主进程用 rename 原子替换）。
   ============================================================ */
(function () {
  'use strict';

  const SCHEMA = 2;
  const APP_ID = 'heartbeat-poem';
  const KEY_V2 = 'heartbeat_save_v2';   // 新键
  const KEY_V1 = 'heartbeat_v2_save';   // 旧键：只读，迁移后不删
  const WRITE_DEBOUNCE = 300;

  const native = window.NativeSave || null;   // preload 注入；纯浏览器为 null
  let state = null;
  let dirty = false;
  let timer = 0;
  let nativePath = null;                       // 读档时缓存，供 UI 同步显示

  /* ---------- 空档 ---------- */
  function blank() {
    const now = new Date().toISOString();
    return {
      schema: SCHEMA,
      app: APP_ID,
      createdAt: now,
      updatedAt: now,
      profile: {
        endings: {}, wk2: false, foundSnow: {}, poems: [],
        firstClearAt: null, playthroughs: 0, totalPlayMs: 0
      },
      progress: { step: 0, chapterId: '', day: '第 0 天', scene: 'SC-65', vars: {}, flags: {} },
      slots: [null, null, null],
      settings: {
        quality: 'cinema', drift: true, particles: true,
        grain: true, scope: false, volume: 0.85
      }
    };
  }

  /* ---------- 旧版 → schema 2 ----------
     旧结构是扁平的一坨：vars/flags/endings/foundSnow/poems/wk2/settings/saves。
     这里逐字段搬运，不猜、不合并、不丢；saves 从 {i,...} 转成 {step,...}。 */
  function migrateV1(o) {
    const s = blank();
    if (o.endings && typeof o.endings === 'object') s.profile.endings = o.endings;
    if (o.foundSnow && typeof o.foundSnow === 'object') s.profile.foundSnow = o.foundSnow;
    if (Array.isArray(o.poems)) s.profile.poems = o.poems;
    s.profile.wk2 = !!o.wk2;
    if (o.settings && typeof o.settings === 'object') Object.assign(s.settings, o.settings);
    if (Array.isArray(o.saves)) {
      s.slots = [0, 1, 2].map(i => {
        const x = o.saves[i];
        if (!x) return null;
        return {
          slot: i + 1,
          savedAt: x.date || null,
          playMs: 0,
          step: typeof x.i === 'number' ? x.i : 0,
          chapterId: x.chapter || '',
          day: x.day || '',
          vars: x.vars || {},
          flags: x.flags || {}
        };
      });
    }
    if (o.vars) s.progress.vars = o.vars;
    if (o.flags) s.progress.flags = o.flags;
    return s;
  }

  /* ---------- 读 ---------- */
  async function readRaw() {
    if (native) return native.read();                       // 主进程负责 主文件 → .bak
    try {
      return localStorage.getItem(KEY_V2) || localStorage.getItem(KEY_V1);
    } catch (e) { return null; }
  }

  const VSave = {};
  VSave.SCHEMA = SCHEMA;

  /* 运行时只读视图：engine 的 save() 从 VSave.state 取当前档再回写 */
  Object.defineProperty(VSave, 'state', { get: () => state });

  VSave.load = async function () {
    if (native && !nativePath) {
      try { nativePath = await native.path(); } catch (e) { nativePath = null; }
    }
    let raw = null;
    try { raw = await readRaw(); } catch (e) { raw = null; }

    let parsed = null;
    if (raw) { try { parsed = JSON.parse(raw); } catch (e) { parsed = null; } }

    if (!parsed || typeof parsed !== 'object') {
      state = blank();
      dirty = true;                                        // 建档落盘
      VSave.markDirty();
      return state;
    }

    const migrated = !(parsed.schema >= SCHEMA);
    state = migrated ? migrateV1(parsed) : normalize(parsed);
    if (migrated) { dirty = true; VSave.markDirty(); }      // 迁移后立刻回写
    return state;
  };

  /* 补齐缺失字段：旧文件、手工改坏、版本升级都可能少字段 */
  function normalize(o) {
    const b = blank();
    const s = Object.assign(b, o);
    s.profile = Object.assign(b.profile, o.profile || {});
    s.progress = Object.assign(b.progress, o.progress || {});
    s.settings = Object.assign(b.settings, o.settings || {});
    if (!Array.isArray(s.slots)) s.slots = [null, null, null];
    while (s.slots.length < 3) s.slots.push(null);
    s.slots = s.slots.slice(0, 3).map((x, i) => x && Object.assign({ slot: i + 1 }, x));
    return s;
  }

  /* ---------- 写（去抖） ---------- */
  VSave.markDirty = function () {
    dirty = true;
    clearTimeout(timer);
    timer = setTimeout(() => { VSave.flush(); }, WRITE_DEBOUNCE);
  };

  VSave.flush = async function () {
    if (!dirty || !state) return;
    dirty = false;
    state.updatedAt = new Date().toISOString();
    let json;
    try { json = JSON.stringify(state); }
    catch (e) { dirty = true; return; }

    try {
      if (native) await native.write(json);
      else localStorage.setItem(KEY_V2, json);
    } catch (e) {
      dirty = true;                                      // 写失败：留住，下次再写
      if (window.VGame && VGame.toast) VGame.toast('存档写入失败：磁盘空间或权限不足');
    }
  };

  /* ---------- 重置 ---------- */
  VSave.reset = async function () {
    clearTimeout(timer);
    state = blank();
    dirty = false;
    try {
      if (native) await native.reset();
      else localStorage.removeItem(KEY_V2);
    } catch (e) { /* 删不掉也不能崩 */ }
  };

  /* ---------- 统计 ---------- */
  VSave.addPlayMs = function (ms) {
    if (!state || !(ms > 0)) return;
    state.profile.totalPlayMs = (state.profile.totalPlayMs || 0) + Math.round(ms);
    VSave.markDirty();
  };

  VSave.markFinish = function () {
    if (!state) return;
    const p = state.profile;
    if (!p.firstClearAt) p.firstClearAt = new Date().toISOString();
    p.playthroughs = (p.playthroughs || 0) + 1;
    VSave.markDirty();
  };

  VSave.path = function () {
    return nativePath || 'localStorage: ' + KEY_V2;
  };

  /* 只读快照，供 UI 展示 */
  VSave.summary = function () {
    if (!state) return null;
    const p = state.profile;
    return {
      endings: Object.keys(p.endings || {}).length,
      poems: (p.poems || []).length,
      snow: Object.keys(p.foundSnow || {}).length,
      wk2: !!p.wk2,
      playthroughs: p.playthroughs || 0,
      totalPlayMs: p.totalPlayMs || 0,
      firstClearAt: p.firstClearAt
    };
  };

  window.VSave = VSave;
})();
