window.__ModuleLoader__.load({
  id: 'dsh-freellmapi',
  factory(require) {
    const React = require('react');
    const h = React.createElement;
    const { useCallback, useEffect, useMemo, useRef, useState } = React;

    const NS = 'dsh-freellmapi';
    const PANEL_ID = 'dsh-freellmapi';
    const ROUTE = '/api/freellmapi/';

    const zh = {
      title: 'FreeLLMAPI',
      open: 'FreeLLMAPI',
      subtitle: '本地免费模型路由',
      status: '服务状态',
      running: '运行中',
      stopped: '未运行',
      listening: '端口在听',
      unreachable: '端口无响应',
      baseURL: '接口地址',
      pid: '进程号',
      managed: '由本插件启动',
      external: '外部启动',
      key: '统一密钥',
      keyOk: '已配置',
      keyMissing: '未配置',
      keyHint: '默认使用内置路由器首次启动时自己生成的密钥；你也可以在环境变量里指定一个覆盖它。',
      keySource: '来源',
      start: '启动',
      stop: '停止',
      refresh: '刷新',
      starting: '启动中…',
      stopping: '停止中…',
      models: '可用模型',
      modelsHint: '模型选择器里 {offered} / {total} 个',
      modelsEmpty: '服务未运行或没有读到模型目录。',
      search: '搜索模型',
      available: '可用',
      unavailable: '不可用',
      context: '{n}K 上下文',
      claimedNote: '路由器称 {n} 个可用',
      deadNote: '其中 {n} 个实测已失效',
      ownListNote: '用的是你勾选的清单',
      probeNow: '重新探测',
      probing: '探测中…',
      probedNote: '上次探测 {ago}',
      neverProbed: '还没探测过，数字来自路由器自己的标记。',
      agoNow: '刚刚',
      agoMin: '{n} 分钟前',
      agoHour: '{n} 小时前',
      agoDay: '{n} 天前',
      probeOk: '实测可用',
      probeDead: '实测失效',
      probeBusy: '暂时受限',
      enable: '启用',
      apply: '应用',
      reset: '跟随探测',
      enabledCount: '已选 {n} 个',
      settings: '设置',
      install: '内置路由器',
      installed: '已随插件安装',
      notInstalled: '未安装',
      installPath: '安装路径',
      srcBundled: '内置',
      srcEnv: '环境变量',
      proxy: '出站代理',
      proxyInherit: '跟随系统',
      proxyDirect: '强制直连',
      autoStart: '打开 DSH 时自动启动',
      probeToggle: '实测模型是否真能回答',
      maxTokens: '单次输出上限',
      timeout: '请求超时（毫秒）',
      save: '保存',
      saving: '保存中…',
      saved: '已保存',
      error: '出错',
      retry: '重试',
      bootNone: '没有已保存的设置。',
      summary: '本地路由，{models} 个模型可用。',
      summaryDown: '本地路由未运行。',
      entryGroup: '入口与可见性',
      cfgPlacement: '面板入口',
      placementAll: '全部',
      placementSidebar: '仅侧边栏',
      placementSettings: '仅设置页',
      sortLabel: '排序方式',
      sortDefault: '默认（已勾选在前）',
      sortName: '按名称',
      sortContext: '按上下文',
      sortStatus: '按可用状态',
      selectAll: '全选',
      selectNone: '全不选',
      selectUsable: '勾选可用 ({n})',
      listedCount: '列出 {n} 个',
      noneNote: '全不选之后要点「跟随探测」，不是「应用」——空清单的含义是交回给探测，不是什么都不给。',
      ranking: '排行',
      rankingHint: '按路由自己的评分排序，与 3001 面板同一套数字',
      rankingEmpty: '读不到路由数据库，评分暂不可用。模型列表仍然可用。',
      rankingNote: '稳定/速度/智能 三条都是 0–100；评分是三者按 0.5/0.25/0.25 合成的结果。',
      rankStability: '稳定',
      rankSpeed: '速度',
      rankIntelligence: '智能',
      rankScore: '评分',
      rankPlatforms: '平台',
      rankTools: '工具',
      rankVision: '视觉',
      rankRate: '{n} 请求/分钟',
      rankCtxMin: '{n}+',
      rankShowMore: '再看 {n} 个',
      rankScored: '共 {n} 个已评分',
      openConsole: '打开完整控制台',
      consoleHint: '浏览器里的 3001 面板：加 provider key、看用量、改路由策略',
      rankModel: '模型',
      rankShowing: '显示 {shown} / {total}',
      rankEnabledOf: '已启用 {n}',
      rankAllOn: '启用可见',
      rankAllOff: '停用可见',
      rankSortBy: '按{by}排序',
      rankSwitchOn: '启用这个模型',
      rankSwitchOff: '停用这个模型',
    };

    const en = {
      title: 'FreeLLMAPI',
      open: 'FreeLLMAPI',
      subtitle: 'Local free-model router',
      status: 'Status',
      running: 'Running',
      stopped: 'Not running',
      listening: 'Port answers',
      unreachable: 'Port does not answer',
      baseURL: 'Endpoint',
      pid: 'PID',
      managed: 'Started by this plugin',
      external: 'Started elsewhere',
      key: 'Unified key',
      keyOk: 'Configured',
      keyMissing: 'Missing',
      keyHint: 'Uses the key the bundled router generated on first start; set FREELLMAPI_API_KEY to override it.',
      keySource: 'Source',
      start: 'Start',
      stop: 'Stop',
      refresh: 'Refresh',
      starting: 'Starting…',
      stopping: 'Stopping…',
      models: 'Models',
      modelsHint: '{offered} of {total} in the picker',
      modelsEmpty: 'The server is not running, or no catalogue was read.',
      search: 'Search models',
      available: 'Available',
      unavailable: 'Unavailable',
      context: '{n}K context',
      claimedNote: 'the router claims {n}',
      deadNote: '{n} of them fail a real request',
      ownListNote: 'showing your own selection',
      probeNow: 'Re-probe',
      probing: 'Probing…',
      probedNote: 'last probe {ago}',
      neverProbed: 'Nothing has been probed yet; these numbers are the router’s own flags.',
      agoNow: 'just now',
      agoMin: '{n} min ago',
      agoHour: '{n} h ago',
      agoDay: '{n} d ago',
      probeOk: 'answers',
      probeDead: 'dead',
      probeBusy: 'rate-limited',
      enable: 'Enable',
      apply: 'Apply',
      reset: 'Follow probes',
      enabledCount: '{n} selected',
      settings: 'Settings',
      install: 'Bundled router',
      installed: 'Installed with the plugin',
      notInstalled: 'Not installed',
      installPath: 'Install path',
      srcBundled: 'bundled',
      srcEnv: 'environment',
      proxy: 'Outbound proxy',
      proxyInherit: 'Follow the system',
      proxyDirect: 'Always direct',
      autoStart: 'Start when DSH opens',
      probeToggle: 'Check which models really answer',
      maxTokens: 'Max output tokens',
      timeout: 'Request timeout (ms)',
      save: 'Save',
      saving: 'Saving…',
      saved: 'Saved',
      error: 'Error',
      retry: 'Retry',
      bootNone: 'No saved settings yet.',
      summary: 'Local router, {models} models available.',
      summaryDown: 'Local router is not running.',
      entryGroup: 'Entry and visibility',
      cfgPlacement: 'Panel entry',
      placementAll: 'Everywhere',
      placementSidebar: 'Sidebar only',
      placementSettings: 'Settings page only',
      sortLabel: 'Sort by',
      sortDefault: 'Default (ticked first)',
      sortName: 'Name',
      sortContext: 'Context size',
      sortStatus: 'Availability',
      selectAll: 'Select all',
      selectNone: 'Clear shown',
      selectUsable: 'Tick usable ({n})',
      listedCount: '{n} listed',
      noneNote: 'With nothing ticked, press "Follow probes" rather than "Apply" — an empty list means hand it back to the probes, not offer nothing.',
      ranking: 'Ranking',
      rankingHint: 'Ordered by the router’s own scores, the same numbers the :3001 panel shows',
      rankingEmpty: 'The router database could not be read, so there are no scores. The model list still works.',
      rankingNote: 'Stability, speed and intelligence are 0–100; the score combines them at 0.5 / 0.25 / 0.25.',
      rankStability: 'Stability',
      rankSpeed: 'Speed',
      rankIntelligence: 'Intelligence',
      rankScore: 'Score',
      rankPlatforms: 'Platforms',
      rankTools: 'tools',
      rankVision: 'vision',
      rankRate: '{n} req/min',
      rankCtxMin: '{n}+',
      rankShowMore: 'Show {n} more',
      rankScored: '{n} scored',
      openConsole: 'Open the full console',
      consoleHint: 'The :3001 panel in a browser: add provider keys, see usage, change routing',
      rankModel: 'Model',
      rankShowing: 'Showing {shown} of {total}',
      rankEnabledOf: '{n} enabled',
      rankAllOn: 'Enable shown',
      rankAllOff: 'Disable shown',
      rankSortBy: 'Sort by {by}',
      rankSwitchOn: 'Enable this model',
      rankSwitchOff: 'Disable this model',
    };

    const CSS = `
      .dflm { display: flex; flex-direction: column; gap: 16px; padding: 20px 22px 28px; overflow-y: auto; height: 100%; box-sizing: border-box; color: var(--dsw-alias-label-primary); }
      .dflm-head { display: flex; align-items: baseline; gap: 10px; flex-wrap: wrap; }
      .dflm-title { font-size: 18px; font-weight: 600; margin: 0; }
      .dflm-sub { font-size: 13px; color: var(--dsw-alias-label-secondary); }
      .dflm-card { border-radius: 12px; border: 1px solid var(--dsw-alias-border-secondary, var(--dsw-alias-border-l2)); background: var(--dsw-alias-bg-layer-1); padding: 14px 16px; display: flex; flex-direction: column; gap: 10px; }
      .dflm-row { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
      .dflm-row-label { font-size: 13px; color: var(--dsw-alias-label-secondary); min-width: 84px; }
      .dflm-value { font-size: 13px; word-break: break-all; }
      .dflm-dot { width: 8px; height: 8px; border-radius: 50%; flex: none; }
      .dflm-dot.on { background: var(--dsw-alias-state-success-primary, var(--color-green-500)); box-shadow: 0 0 0 3px color-mix(in srgb, var(--dsw-alias-state-success-primary, var(--color-green-500)) 16%, transparent); }
      .dflm-dot.off { background: var(--dsw-alias-label-tertiary, var(--color-neutral-500)); }
      .dflm-dot.warn { background: var(--dsw-alias-state-warn-primary, var(--color-amber-500)); }
      .dflm-btn { box-sizing: border-box; height: 32px; padding: 0 14px; border: none; border-radius: 16px; background: transparent; box-shadow: inset 0 0 0 1px var(--dsw-alias-border-secondary, var(--dsw-alias-border-l2)); color: var(--dsw-alias-label-primary); font: inherit; font-size: 13px; cursor: pointer; }
      .dflm-btn:hover:not(:disabled) { background: var(--dsw-alias-interactive-bg-hover, rgba(127,127,127,0.08)); }
      .dflm-btn:disabled { opacity: 0.5; cursor: default; }
      /* NOT --dsw-alias-brand-primary: in the dark theme that alias resolves
         to near-white (bluish-50), the inverse of light mode — white text on
         a white button. The GUI's own accent surfaces use this alias, which
         stays blue in both themes. */
      .dflm-btn.primary { background: var(--dsw-alias-button-primary-fill, var(--color-blue-500)); color: var(--dsw-alias-label-primary-foreground, #fff); }
      .dflm-input { box-sizing: border-box; height: 34px; padding: 0 12px; border-radius: 8px; border: 1px solid var(--dsw-alias-border-secondary, rgba(127,127,127,0.28)); background: transparent; color: inherit; font: inherit; font-size: 13px; min-width: 0; flex: 1; }
      .dflm-input:focus-visible { outline: 2px solid var(--dsw-alias-brand-primary); outline-offset: -1px; }
      .dflm-note { font-size: 12px; color: var(--dsw-alias-label-secondary); }
      .dflm-cfg-group { margin-top: 4px; padding-top: 12px; border-top: .5px solid var(--dsw-alias-border-secondary, rgba(127,127,127,0.28)); display: flex; flex-direction: column; gap: 6px; }
      .dflm-cfg-title { font-size: 13px; font-weight: 600; }
      .dflm-cfg-row { display: flex; align-items: center; gap: 8px; }
      /* appearance:none drops the native dropdown arrow, and this control has
       * no border, so it read as static text beside the count — the sort menu
       * was there the whole time, just nothing saying "click me". Draw the
       * arrow and reserve room for it. */
      .dflm-cfg-select { appearance: none; -webkit-appearance: none; box-sizing: border-box; height: 32px; margin-left: auto; padding: 0 28px 0 14px; border: none; border-radius: 16px; background-color: color-mix(in srgb, var(--dsw-alias-label-secondary) 10%, transparent); background-image: url("data:image/svg+xml;charset=utf-8,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='6' viewBox='0 0 10 6'%3E%3Cpath d='M1 1l4 4 4-4' fill='none' stroke='%237f8794' stroke-width='1.6' stroke-linecap='round'/%3E%3C/svg%3E"); background-repeat: no-repeat; background-position: right 10px center; color: var(--dsw-alias-label-primary); font: inherit; font-size: 13px; cursor: pointer; }
      /* A native <select> menu is drawn by Chromium/Windows, not by our box, so
         our tokens never reached it and it opened as a white system popup under
         a dark panel. Two things fix it: the color-scheme inherited from the
         surface (set at runtime — see useColorScheme) and these explicit colours
         for the popup rows. */
      .dflm select option { background-color: var(--dsw-alias-bg-layer-2, var(--dsw-alias-bg-layer-1, transparent)); color: var(--dsw-alias-label-primary); }
      .dflm-err { font-size: 13px; color: var(--dsw-alias-state-error-primary, var(--color-red-500)); }
      .dflm-models { display: flex; flex-direction: column; gap: 6px; max-height: 340px; overflow-y: auto; }
      .dflm-model { display: flex; align-items: baseline; gap: 8px; padding: 6px 10px; border-radius: 8px; background: transparent; box-shadow: inset 0 0 0 1px var(--dsw-alias-border-secondary, var(--dsw-alias-border-l2)); font-size: 13px; }
      .dflm-model-id { font-family: ui-monospace, monospace; font-size: 12px; }
      .dflm-model-meta { margin-left: auto; font-size: 12px; color: var(--dsw-alias-label-secondary); white-space: nowrap; }
      .dflm-model.dim { opacity: 0.5; }
      .dflm-badge { font-size: 11px; padding: 1px 7px; border-radius: 9px; background: color-mix(in srgb, var(--dsw-alias-label-secondary) 12%, transparent); }
      .dflm-toggle { display: inline-flex; align-items: center; gap: 8px; font-size: 13px; cursor: pointer; }
      .dflm-tabs { display: flex; gap: 6px; border-bottom: 1px solid var(--dsw-alias-border-secondary, rgba(127,127,127,0.22)); padding-bottom: 8px; }
      .dflm-tab { box-sizing: border-box; height: 28px; padding: 0 12px; border: none; border-radius: 14px; background: transparent; color: var(--dsw-alias-label-secondary); font: inherit; font-size: 13px; cursor: pointer; }
      .dflm-tab:hover { background: var(--dsw-alias-interactive-bg-hover, rgba(127,127,127,0.08)); }
      .dflm-tab.on { background: color-mix(in srgb, var(--dsw-alias-label-secondary) 14%, transparent); color: var(--dsw-alias-label-primary); font-weight: 600; }
      .dflm-settings { display: flex; flex-direction: column; gap: 12px; }
      .dflm-field { display: flex; flex-direction: column; gap: 6px; }
      .dflm-field-label { font-size: 13px; }
      /* The ranking table. Laid out like the :3001 table it mirrors — one row per
         model with the three axes as their own columns — because stacking the bars
         made them unreadable and left no room for the numbers beside them. */
      .dflm-rank { display: flex; flex-direction: column; gap: 6px; }
      .dflm-rank-tools { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; }
      .dflm-rank-tools .dflm-input { flex: 1 1 160px; min-width: 110px; }
      .dflm-chip { font-size: 11px; line-height: 1; padding: 4px 9px; border-radius: 999px; border: 1px solid var(--dsw-alias-border-1, rgba(127,127,127,0.3)); background: transparent; color: var(--dsw-alias-label-secondary); cursor: pointer; }
      .dflm-chip.on { background: color-mix(in srgb, var(--dsw-alias-brand-primary, var(--color-blue-500)) 16%, transparent); color: var(--dsw-alias-label-primary, inherit); border-color: transparent; }
      .dflm-when { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; }
      .dflm-grid { display: grid; grid-template-columns: 18px minmax(0, 1fr) 62px 62px 62px 44px 30px; gap: 6px; align-items: center; min-width: 0; }
      .dflm-rank-head { padding: 0 8px 2px; font-size: 10px; color: var(--dsw-alias-label-secondary); }
      .dflm-rank-head span { white-space: nowrap; }
      .dflm-rank-head .sort { background: none; border: 0; padding: 0; font: inherit; color: inherit; cursor: pointer; text-align: left; }
      .dflm-rank-head .sort.on { color: var(--dsw-alias-label-primary, inherit); font-weight: 600; }
      .dflm-rank-head .sort.on::after { content: ' ▾'; font-size: 9px; opacity: 0.7; }
      .dflm-rank-head .sort:disabled { cursor: default; opacity: 0.6; }
      .dflm-rank-body { display: flex; flex-direction: column; gap: 3px; }
      .dflm-rank-row { padding: 7px 8px; border-radius: 8px; background: transparent; box-shadow: inset 0 0 0 1px var(--dsw-alias-border-secondary, var(--dsw-alias-border-l2)); }
      .dflm-rank-row:hover { background: var(--dsw-alias-interactive-bg-hover, rgba(127,127,127,0.08)); }
      .dflm-rank-row.off { opacity: 0.5; }
      .dflm-rank-index { font-size: 10px; color: var(--dsw-alias-label-tertiary, var(--dsw-alias-label-secondary)); text-align: right; font-variant-numeric: tabular-nums; }
      .dflm-rank-id { display: flex; flex-direction: column; gap: 3px; min-width: 0; }
      .dflm-rank-name { font-size: 12px; font-weight: 600; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
      .dflm-rank-tags { display: flex; gap: 4px; flex-wrap: wrap; align-items: center; }
      .dflm-rank-tag { font-size: 10px; line-height: 1.5; padding: 0 5px; border-radius: 6px; background: color-mix(in srgb, var(--dsw-alias-label-secondary) 12%, transparent); color: var(--dsw-alias-label-secondary); white-space: nowrap; }
      .dflm-rank-tag.hot { background: color-mix(in srgb, var(--dsw-alias-state-success-primary, var(--color-green-500)) 16%, transparent); color: var(--dsw-alias-state-success-primary, var(--color-green-500)); }
      /* One axis: track and number side by side. The fill must be display:block —
         an inline span accepts neither width nor height, which is what made the
         first version's bars invisible. */
      .dflm-axis { display: flex; align-items: center; gap: 5px; min-width: 0; }
      .dflm-axis-track { flex: 1 1 auto; min-width: 8px; height: 6px; border-radius: 3px; background: color-mix(in srgb, var(--dsw-alias-label-secondary) 18%, transparent); overflow: hidden; }
      .dflm-axis-fill { display: block; height: 100%; border-radius: 3px; }
      .dflm-axis-fill.stability { background: var(--dsw-alias-state-success-primary, var(--color-green-500)); }
      .dflm-axis-fill.speed { background: var(--color-blue-500); }
      .dflm-axis-fill.intelligence { background: var(--color-violet-500); }
      .dflm-axis-num { flex: 0 0 auto; font-size: 10px; color: var(--dsw-alias-label-secondary); font-variant-numeric: tabular-nums; }
      .dflm-rank-score { font-size: 13px; font-weight: 600; font-variant-numeric: tabular-nums; text-align: right; }
      .dflm-switch { position: relative; width: 32px; height: 18px; padding: 0; border: 0; border-radius: 999px; background: color-mix(in srgb, var(--dsw-alias-label-secondary) 28%, transparent); cursor: pointer; transition: background 0.15s ease; }
      .dflm-switch[aria-checked="true"] { background: var(--dsw-alias-state-success-primary, var(--color-green-500)); }
      .dflm-switch::after { content: ""; position: absolute; top: 2px; left: 2px; width: 14px; height: 14px; border-radius: 50%; background: #fff; transition: transform 0.15s ease; }
      .dflm-switch[aria-checked="true"]::after { transform: translateX(14px); }
      .dflm-rank-foot { display: flex; align-items: center; gap: 8px; padding-top: 2px; }
    `;

    function insertStyles(css) {
      const el = document.createElement('style');
      el.dataset.plugin = PANEL_ID;
      el.textContent = css;
      document.head.appendChild(el);
      return () => {
        if (el.parentNode) el.parentNode.removeChild(el);
      };
    }

    /**
     * How long a panel request may wait before it is abandoned.
     *
     * `start` is the one action that is slow by design — the supervisor waits up
     * to 25s for the router to accept connections — so it gets its own ceiling.
     * Everything else answers from local state and should be well under a
     * second, which makes a short timeout the difference between a visible error
     * and a panel that never recovers.
     */
    const CALL_TIMEOUT_MS = 12_000;
    const START_TIMEOUT_MS = 40_000;

    async function call(action, payload) {
      const timeout = action === 'start' ? START_TIMEOUT_MS : CALL_TIMEOUT_MS;
      let response;
      try {
        response = await fetch(ROUTE, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ action, ...(payload || {}) }),
          signal: AbortSignal.timeout(timeout),
        });
      } catch (error) {
        // A host that never answers must not leave the caller waiting forever:
        // the panel's queue would stop draining and every later click would sit
        // behind a promise that never settles.
        if (error && error.name === 'TimeoutError') {
          throw new Error(`no answer from the host within ${Math.round(timeout / 1000)}s`);
        }
        throw error;
      }
      let data;
      try {
        data = await response.json();
      } catch {
        throw new Error(`HTTP ${response.status}`);
      }
      if (!response.ok || !data || data.ok !== true) {
        throw new Error((data && data.error) || `HTTP ${response.status}`);
      }
      return data;
    }

    function useTranslate(locale) {
      const [active, setActive] = useState(() => (locale ? locale.getSnapshot().active : 'en'));
      useEffect(() => {
        if (!locale) return undefined;
        setActive(locale.getSnapshot().active);
        return locale.subscribe(() => setActive(locale.getSnapshot().active));
      }, [locale]);
      return useMemo(() => {
        const dict = active === 'zh' ? zh : en;
        return (key, vars) => {
          const raw = dict[key];
          let text = typeof raw === 'string' ? raw : key;
          if (vars) for (const name of Object.keys(vars)) text = text.split(`{${name}}`).join(String(vars[name]));
          return text;
        };
      }, [active]);
    }

    const store = new Map();
    function usePersistent(key, initial) {
      // Seed the store on first render: a failed load reads it back to keep the
      // last good payload, and reading an unseeded key would throw instead.
      const [value, setValue] = useState(() => {
        if (store.has(key)) return store.get(key);
        store.set(key, initial);
        return initial;
      });
      const latest = useRef(value);
      latest.current = value;
      const set = useCallback(
        (next) => {
          const resolved = typeof next === 'function' ? next(latest.current) : next;
          store.set(key, resolved);
          setValue(resolved);
        },
        [key],
      );
      return [value, set];
    }

    /**
     * Where the entry lives: sidebar rail and plugin page (default), one of them,
     * or only the plugin page. localStorage, not the module Map above — the
     * choice has to survive a reload. Same shape dsh-disk-cleaner uses.
     */
    function makePref(key, allowed, fallback) {
      const read = () => {
        try {
          const saved = window.localStorage.getItem(key);
          return allowed.includes(saved) ? saved : fallback;
        } catch {
          return fallback;
        }
      };
      return {
        value: read(),
        listeners: new Set(),
        get() {
          return this.value;
        },
        set(next) {
          if (!allowed.includes(next) || next === this.value) return;
          this.value = next;
          try {
            window.localStorage.setItem(key, next);
          } catch {
            /* private mode: the choice just does not outlive the reload */
          }
          for (const listener of this.listeners) listener();
        },
        subscribe(listener) {
          this.listeners.add(listener);
          return () => this.listeners.delete(listener);
        },
      };
    }

    const placement = makePref('dflm.placement', ['all', 'sidebar', 'settings'], 'all');

    function usePrefValue(pref) {
      const [value, setValue] = useState(() => pref.get());
      useEffect(() => pref.subscribe(() => setValue(pref.get())), []);
      return value;
    }

    /**
     * A native <select> menu is painted by Chromium/Windows, not by our box, and
     * it takes its colours from `color-scheme` — which DSH never sets, so the
     * popup opened in the system light skin under a dark panel. The host's choice
     * is only observable through its tokens, so resolve the surface colour and
     * hand the browser the matching scheme, re-reading when the host flips.
     */
    function readScheme() {
      try {
        const host = document.querySelector('.dflm') || document.body;
        const probe = document.createElement('span');
        probe.style.cssText = 'position:absolute;left:-9999px;width:1px;height:1px;background:var(--dsw-alias-bg-layer-1, transparent)';
        host.appendChild(probe);
        const paint = getComputedStyle(probe).backgroundColor;
        probe.remove();
        const parts = /rgba?\(\s*(\d+)[,\s]+(\d+)[,\s]+(\d+)/.exec(paint);
        if (!parts) return 'light';
        const luminance = (0.2126 * Number(parts[1]) + 0.7152 * Number(parts[2]) + 0.0722 * Number(parts[3])) / 255;
        return luminance < 0.5 ? 'dark' : 'light';
      } catch {
        return 'light';
      }
    }

    function useColorScheme() {
      const [scheme, setScheme] = useState(readScheme);
      useEffect(() => {
        const sync = () => {
          const next = readScheme();
          setScheme((prev) => (prev === next ? prev : next));
        };
        const observer = new MutationObserver(sync);
        for (const node of [document.documentElement, document.body]) {
          if (node) observer.observe(node, { attributes: true, attributeFilter: ['class', 'style', 'data-theme', 'data-color-scheme'] });
        }
        const media = window.matchMedia('(prefers-color-scheme: dark)');
        media.addEventListener('change', sync);
        return () => {
          observer.disconnect();
          media.removeEventListener('change', sync);
        };
      }, []);
      return scheme;
    }

    /**
     * Register slot entries only while wanted() holds. A slot cannot be
     * registered conditionally, so the choice is made by mounting and
     * disposing the injection; deferred because the select is clicked
     * inside the very section that disposes it.
     */
    function bindWhile(wanted, make) {
      let live = false;
      let stops = [];
      let queued = false;
      const sync = () => {
        queued = false;
        const want = wanted();
        if (want === live) return;
        live = want;
        if (want) stops = make().filter((stop) => typeof stop === 'function');
        else for (const stop of stops.splice(0)) stop();
      };
      const schedule = () => {
        if (queued) return;
        queued = true;
        queueMicrotask(sync);
      };
      sync();
      const off = placement.subscribe(schedule);
      return () => {
        off();
        for (const stop of stops.splice(0)) stop();
      };
    }

    // `credentials.describe()` names its storage layer, not our vocabulary:
    // a key exported in the shell comes back as "user-env". Anything we do not
    // recognise is shown verbatim rather than swallowed, so a new source is
    // visible instead of silently mislabelled.
    function sourceLabel(t, source) {
      if (source === 'bundled-router') return t('srcBundled')
      if (source === 'missing') return source
      if (/env$/.test(source)) return t('srcEnv')
      return source
    }

    function dotClass(state) {
      if (state === 'on') return 'dflm-dot on';
      if (state === 'warn') return 'dflm-dot warn';
      return 'dflm-dot off';
    }

    /**
     * The whole panel is one fetch away from the truth: the host half owns the
     * status, and every control re-reads it rather than guessing locally.
     */
    function useRouter() {
      const [state, setState] = usePersistent('dflm.state', { loading: true });
      // Requests are queued, never dropped. The panel polls every 2.5s while a
      // probe runs, and a click that landed mid-poll used to be swallowed
      // silently: the button flashed its pending label and nothing was sent.
      // Serialising costs nothing here — one host, sub-second answers — and
      // keeps the order predictable. Status polls are the one exception: when
      // one is already waiting a second is pointless, so a poll joins it rather
      // than stacking behind it and letting the queue grow during a probe.
      const queue = useRef(Promise.resolve());
      const waitingStatus = useRef(0);
      const lastSeen = useRef('');
      /**
       * Put back the scores a lean reply left out.
       *
       * Only the polling path asks for lean, and only while a probe runs. The
       * client already has every rank from the last full read; dropping them
       * would make the bars blink out on each poll, which is worse than the
       * bytes being saved.
       */
      const mergeRanks = (data, patch) => {
        if (patch && patch.lean !== true) return data;
        const previous = store.get('dflm.state').data;
        const before = previous && previous.catalogue && previous.catalogue.models;
        const after = data && data.catalogue && data.catalogue.models;
        if (!Array.isArray(before) || !Array.isArray(after)) return data;
        const ranks = new Map();
        for (const row of before) {
          if (row && row.rank !== undefined) ranks.set(row.id, row.rank);
        }
        if (ranks.size === 0) return data;
        return {
          ...data,
          catalogue: {
            ...data.catalogue,
            models: after.map((row) => (row && row.rank === undefined && ranks.has(row.id) ? { ...row, rank: ranks.get(row.id) } : row)),
          },
        };
      };
      const load = useCallback(
        (action, payload) => {
          const name = action || 'status';
          if (name === 'status' && waitingStatus.current > 0) return queue.current;
          if (name === 'status') waitingStatus.current += 1;
          const run = async () => {
            try {
              const data = mergeRanks(await call(name, payload), payload);
              // Polling re-delivers a payload that is usually identical. Handing
              // React a fresh top-level object invalidated every downstream memo,
              // so 287 rows were re-filtered and re-sorted every 2.5s to render
              // the same pixels. Comparing the serialised form costs a string
              // compare and skips the whole tree.
              const seen = JSON.stringify(data);
              if (seen !== lastSeen.current) {
                lastSeen.current = seen;
                setState({ loading: false, data, error: '' });
              } else if (store.get('dflm.state').error !== '') {
                setState({ loading: false, data, error: '' });
              }
            } catch (error) {
              lastSeen.current = '';
              setState({ loading: false, data: store.get('dflm.state').data, error: String(error.message || error) });
            } finally {
              if (name === 'status') waitingStatus.current -= 1;
            }
          };
          queue.current = queue.current.then(run, run);
          return queue.current;
        },
        [setState],
      );
      useEffect(() => {
        if (store.get('dflm.state').data === undefined) load('status');
      }, [load]);
      // A probe pass takes tens of seconds and writes its verdicts one at a
      // time, so the panel has to keep asking while the server says one is
      // running. Without this, pressing the button returns immediately and the
      // numbers only move on the next manual refresh — which reads as a no-op.
      const probingNow = !!(state.data && state.data.probingNow);
      useEffect(() => {
        if (!probingNow) return undefined;
        const timer = setInterval(() => {
          // Lean on purpose: a probe poll only needs the verdicts, and the ranks
          // it does not carry are merged back from what the panel already has.
          void load('status', { lean: true });
        }, 2500);
        return () => clearInterval(timer);
      }, [probingNow, load]);
      // A probe pass ending is the moment the scores really changed, so take one
      // full read then — the poll above deliberately did not ask for them.
      const wasProbing = useRef(probingNow);
      useEffect(() => {
        const finished = wasProbing.current && !probingNow;
        wasProbing.current = probingNow;
        if (finished) void load('status');
      }, [probingNow, load]);
      return { state, load, setState };
    }

    function StatusCard({ t, state, load }) {
      const data = state.data || {};
      const server = data.server || {};
      const key = data.key || {};
      const catalogue = data.catalogue || {};
      const reachable = server.reachable === true;
      const [pending, setPending] = useState('');
      const act = async (action) => {
        setPending(action);
        await load(action);
        setPending('');
      };
      return h(
        'div',
        { className: 'dflm-card' },
        h(
          'div',
          { className: 'dflm-row' },
          h('span', { className: dotClass(reachable ? 'on' : 'warn') }),
          h('strong', { className: 'dflm-value' }, reachable ? t('running') : t('stopped')),
          h('span', { className: 'dflm-note' }, server.running ? t('managed') : t('external')),
          h(
            'span',
            { style: { marginLeft: 'auto', display: 'flex', gap: 8 } },
            h(
              'button',
              { className: 'dflm-btn', disabled: pending !== '' || reachable, onClick: () => act('start') },
              pending === 'start' ? t('starting') : t('start'),
            ),
            h(
              'button',
              { className: 'dflm-btn', disabled: pending !== '' || !server.running, onClick: () => act('stop') },
              pending === 'stop' ? t('stopping') : t('stop'),
            ),
            h('button', { className: 'dflm-btn', disabled: pending !== '', onClick: () => act('status') }, t('refresh')),
            // The panel is a viewer, not an editor: provider keys, usage and the
            // routing strategy all live in the browser dashboard. Keeping one
            // labelled door to it beats a half-reimplementation, and target=_blank
            // works in the browser and in Electron's renderer alike.
            catalogue.consoleUrl
              ? h(
                  'a',
                  {
                    className: 'dflm-btn',
                    href: catalogue.consoleUrl,
                    target: '_blank',
                    rel: 'noreferrer noopener',
                    title: t('consoleHint'),
                    style: { display: 'inline-flex', alignItems: 'center', textDecoration: 'none' },
                  },
                  t('openConsole'),
                )
              : null,
          ),
        ),
        h(
          'div',
          { className: 'dflm-row' },
          h('span', { className: 'dflm-row-label' }, t('baseURL')),
          h('span', { className: 'dflm-value' }, data.settings ? data.settings.baseURL : '—'),
        ),
        h(
          'div',
          { className: 'dflm-row' },
          h('span', { className: 'dflm-row-label' }, t('key')),
          h('span', { className: dotClass(key.configured ? 'on' : 'warn') }),
          h('span', { className: 'dflm-value' }, key.configured ? t('keyOk') : t('keyMissing')),
          key.configured && key.source ? h('span', { className: 'dflm-badge' }, sourceLabel(t, key.source)) : null,
        ),
        h('div', { className: 'dflm-note' }, t('keyHint')),
        server.pid !== null && server.pid !== undefined ? h('div', { className: 'dflm-note' }, `${t('pid')} ${server.pid}`) : null,
        server.lastError ? h('div', { className: 'dflm-err' }, server.lastError) : null,
        state.error ? h('div', { className: 'dflm-err' }, `${t('error')}: ${state.error}`) : null,
      );
    }

    function agoText(t, at) {
      if (!at) return t('neverProbed');
      const mins = Math.round((Date.now() - at) / 60000);
      if (mins < 1) return t('agoNow');
      if (mins < 60) return t('agoMin', { n: mins });
      if (mins < 1440) return t('agoHour', { n: Math.round(mins / 60) });
      return t('agoDay', { n: Math.round(mins / 1440) });
    }

    function probeLabel(t, probe) {
      if (!probe || probe.probed !== true) return '';
      if (probe.ok === true) return t('probeOk');
      // 429/502/timeout is a moment, not a fact: the model stays in the list.
      return `${probe.transient === true ? t('probeBusy') : t('probeDead')} ${probe.status || ''}`.trim();
    }

    // Availability rank for the "status" sort: a model that answered is first,
    // one the probe could not rule out (unprobed, 429, 502) next, one that came
    // back "model not found" last. The router's own flag is not a rank — it is
    // the number the whole panel exists to question.
    function statusRank(row) {
      const probe = row.probe;
      if (probe && probe.probed === true) {
        if (probe.ok === true) return 0;
        if (probe.transient !== true) return 2;
      }
      return 1;
    }

    function ModelList({ t, state, load }) {
      const catalogue = (state.data && state.data.catalogue) || undefined;
      const probingNow = !!(state.data && state.data.probingNow);
      const [filter, setFilter] = usePersistent('dflm.filter', '');
      const [sortKey, setSortKey] = usePersistent('dflm.sort', 'default');
      const rows = (catalogue && catalogue.models) || [];
      // The checked set is what the user is about to ask for; it starts from what
      // discovery offers now, so opening the panel never implies a change.
      const offeredIds = useMemo(() => rows.filter((row) => row.offered).map((row) => row.id).sort(), [rows]);
      const [draft, setDraft] = useState(undefined);
      const selected = draft === undefined ? offeredIds : draft;
      const dirty = useMemo(() => JSON.stringify([...selected].sort()) !== JSON.stringify(offeredIds), [selected, offeredIds]);
      const [pending, setPending] = useState('');
      const shown = useMemo(() => {
        const needle = filter.trim().toLowerCase();
        const list = needle === '' ? rows : rows.filter((row) => `${row.id} ${row.name}`.toLowerCase().includes(needle));
        const picked = new Set(selected);
        const byId = (a, b) => String(a.id).localeCompare(String(b.id));
        // Every mode leads with the rows the picker offers — sorting should
        // order what you can use, not bury it among 287 dead entries.
        if (sortKey === 'name') return [...list].sort((a, b) => Number(b.offered) - Number(a.offered) || String(a.name || a.id).localeCompare(String(b.name || b.id)) || byId(a, b));
        if (sortKey === 'context') return [...list].sort((a, b) => Number(b.offered) - Number(a.offered) || (b.contextWindow || 0) - (a.contextWindow || 0) || byId(a, b));
        if (sortKey === 'status') return [...list].sort((a, b) => Number(b.offered) - Number(a.offered) || statusRank(a) - statusRank(b) || byId(a, b));
        // default: what you ticked, then what the picker already offers
        return [...list].sort((a, b) => Number(picked.has(b.id)) - Number(picked.has(a.id)) || Number(b.offered) - Number(a.offered) || byId(a, b));
      }, [rows, filter, selected, sortKey]);
      const shownIds = useMemo(() => shown.map((row) => row.id), [shown]);
      const save = async (patch) => {
        setPending('apply');
        await load('save', { patch });
        setDraft(undefined);
        setPending('');
      };
      const toggle = (id) => {
        const picked = new Set(selected);
        if (picked.has(id)) picked.delete(id);
        else picked.add(id);
        setDraft([...picked]);
      };
      // Both act on the LISTED rows, not the whole catalogue: that is what makes
      // them useful with a search in the box ("qwen" then select all qwen).
      const selectShown = () => setDraft([...new Set([...selected, ...shownIds])]);
      const clearShown = () => {
        const gone = new Set(shownIds);
        setDraft(selected.filter((id) => !gone.has(id)));
      };
      // "Usable" means the row answered a real request when probed — the same
      // fact the 实测可用 tag shows. It deliberately does NOT mean "offered":
      // in your-own-list mode offered just echoes what is already ticked, and
      // mixing the two made this button tick things that fail on demand.
      const usableIds = useMemo(
        () => shown.filter((row) => row.probe && row.probe.probed === true && row.probe.ok === true).map((row) => row.id),
        [shown],
      );
      // Acts on the listed rows like the other two: after it, the listed rows
      // are exactly the usable ones. Union-with-existing would have left the
      // dead ones ticked whenever you had just pressed 全选, which is the case
      // that makes this button worth having.
      const selectUsable = () => {
        const listed = new Set(shownIds)
        setDraft([...new Set([...selected.filter((id) => !listed.has(id)), ...usableIds])])
      };
      return h(
        'div',
        { className: 'dflm-card' },
        h(
          'div',
          { className: 'dflm-row' },
          h('strong', {}, t('models')),
          h('span', { className: 'dflm-note' }, catalogue ? t('modelsHint', { offered: catalogue.offered ?? 0, total: catalogue.total }) : ''),
          h(
            'span',
            { style: { marginLeft: 'auto', display: 'flex', gap: 8 } },
            h(
              'button',
              {
                className: 'dflm-btn',
                // `load('probe')` answers as soon as the pass is armed, not when
                // it finishes; the server keeps saying probingNow until it does,
                // so that — not the request — is what the label tracks.
                disabled: pending !== '' || probingNow,
                onClick: async () => {
                  setPending('probe');
                  await load('probe', { force: true });
                  setPending('');
                },
              },
              pending === 'probe' || probingNow ? t('probing') : t('probeNow'),
            ),
            h(
              'button',
              {
                className: 'dflm-btn',
                disabled: pending !== '',
                onClick: async () => {
                  setPending('status');
                  await load('status');
                  setPending('');
                },
              },
              pending === 'status' ? t('saving') : t('refresh'),
            ),
          ),
        ),
        catalogue
          ? h(
              'div',
              { className: 'dflm-note' },
              catalogue.usingOwnList
                ? // The picker is showing a list the user typed, so the probe
                  // verdict and the router's flags are both beside the point.
                  // Saying "nothing has been probed" next to that reads as a bug.
                  t('ownListNote')
                : `${t('claimedNote', { n: catalogue.claimed })}${catalogue.dead ? ` · ${t('deadNote', { n: catalogue.dead })}` : ''} · ${agoText(t, catalogue.probedAt)}`,
            )
          : null,
        dirty
          ? h(
              'div',
              { className: 'dflm-row' },
              h('span', { className: 'dflm-badge' }, t('enabledCount', { n: selected.length })),
              // An empty list means "follow the probes", not "offer nothing", so
              // applying zero checks would silently re-enable everything. Use
              // "Follow probes" for that.
              h(
                'button',
                { className: 'dflm-btn primary', disabled: pending !== '' || selected.length === 0, onClick: () => save({ enabledModels: [...selected] }) },
                pending === 'apply' ? t('saving') : t('apply'),
              ),
              h('button', { className: 'dflm-btn', disabled: pending !== '', onClick: () => save({ enabledModels: [] }) }, t('reset')),
            )
          : null,
        dirty && selected.length === 0 ? h('div', { className: 'dflm-note' }, t('noneNote')) : null,
        rows.length === 0
          ? h('div', { className: 'dflm-note' }, state.data && state.data.catalogueError ? state.data.catalogueError : t('modelsEmpty'))
          : h(
              'div',
              { className: 'dflm-models' },
              h('input', {
                className: 'dflm-input',
                placeholder: t('search'),
                value: filter,
                onChange: (event) => setFilter(event.target.value),
              }),
              h(
                'div',
                { className: 'dflm-cfg-row' },
                h(
                  'select',
                  {
                    className: 'dflm-cfg-select',
                    value: sortKey,
                    'aria-label': t('sortLabel'),
                    // The pill pushes itself right with margin-left:auto; the
                    // count has to sit on the left of the same line.
                    style: { marginLeft: 0 },
                    onChange: (event) => setSortKey(event.target.value),
                  },
                  h('option', { value: 'default' }, t('sortDefault')),
                  h('option', { value: 'name' }, t('sortName')),
                  h('option', { value: 'context' }, t('sortContext')),
                  h('option', { value: 'status' }, t('sortStatus')),
                ),
                h('span', { className: 'dflm-note' }, t('listedCount', { n: shown.length })),
                h(
                  'span',
                  { style: { marginLeft: 'auto', display: 'flex', gap: 8 } },
                  // Usable first: with 287 rows this is the one people want, and
                  // burying it after 全选 makes them tick everything by mistake.
                  h(
                    'button',
                    { className: 'dflm-btn', disabled: pending !== '' || usableIds.length === 0, onClick: selectUsable },
                    t('selectUsable', { n: usableIds.length }),
                  ),
                  h('button', { className: 'dflm-btn', disabled: pending !== '', onClick: selectShown }, t('selectAll')),
                  h('button', { className: 'dflm-btn', disabled: pending !== '', onClick: clearShown }, t('selectNone')),
                ),
              ),
              shown.map((row) =>
                h(
                  'div',
                  { key: row.id, className: row.offered ? 'dflm-model' : 'dflm-model dim' },
                  h('input', {
                    type: 'checkbox',
                    checked: selected.includes(row.id),
                    onChange: () => toggle(row.id),
                    'aria-label': `${t('enable')} ${row.id}`,
                  }),
                  h('span', { className: 'dflm-model-id' }, row.id),
                  h('span', { className: 'dflm-note' }, row.name !== row.id ? row.name : ''),
                  h(
                    'span',
                    { className: 'dflm-model-meta' },
                    probeLabel(t, row.probe),
                    ' ',
                    row.contextWindow > 0 ? t('context', { n: Math.round(row.contextWindow / 1024) }) : row.available ? '' : t('unavailable'),
                  ),
                ),
              ),
            ),
      );
    }

    function SettingsCard({ t, state, load }) {
      const saved = (state.data && state.data.settings) || {};
      const install = (state.data && state.data.install) || {};
      const [draft, setDraft] = useState(() => ({
        baseURL: saved.baseURL || 'http://127.0.0.1:3001/v1',
        autoStart: saved.autoStart !== false,
        proxy: saved.proxy || 'inherit',
        defaultMaxTokens: saved.defaultMaxTokens || 8192,
        requestTimeoutMs: saved.requestTimeoutMs || 300000,
        probeModels: saved.probeModels !== false,
      }));
      const [dirty, setDirty] = useState(false);
      const [pending, setPending] = useState('');
      const [message, setMessage] = useState('');
      const seeded = useRef(state.data !== undefined);
      useEffect(() => {
        if (seeded.current || state.data === undefined) return;
        seeded.current = true;
        setDraft({
          baseURL: saved.baseURL || 'http://127.0.0.1:3001/v1',
          autoStart: saved.autoStart !== false,
          proxy: saved.proxy || 'inherit',
          defaultMaxTokens: saved.defaultMaxTokens || 8192,
          requestTimeoutMs: saved.requestTimeoutMs || 300000,
          probeModels: saved.probeModels !== false,
        });
      }, [state.data]);
      const edit = (patch) => {
        setDraft((current) => ({ ...current, ...patch }));
        setDirty(true);
        setMessage('');
      };
      const save = async () => {
        setPending('save');
        try {
          await load('save', { patch: draft });
          setDirty(false);
          setMessage(t('saved'));
        } catch (error) {
          setMessage(String(error.message || error));
        } finally {
          setPending('');
        }
      };
      return h(
        'div',
        { className: 'dflm-card dflm-settings' },
        h('strong', {}, t('settings')),
        h(
          'div',
          { className: 'dflm-row' },
          h('span', { className: 'dflm-row-label' }, t('install')),
          h('span', { className: dotClass(install.installed ? 'on' : 'warn') }),
          h('span', { className: 'dflm-value' }, install.installed ? t('installed') : t('notInstalled')),
        ),
        install.entry
          ? h(
              'div',
              { className: 'dflm-row' },
              h('span', { className: 'dflm-row-label' }, t('installPath')),
              h('span', { className: 'dflm-note', style: { wordBreak: 'break-all' } }, install.entry),
            )
          : null,
        h(
          'div',
          { className: 'dflm-field' },
          h('span', { className: 'dflm-field-label' }, t('baseURL')),
          h('input', {
            className: 'dflm-input',
            value: draft.baseURL,
            onChange: (event) => edit({ baseURL: event.target.value }),
          }),
        ),
        h(
          'div',
          { className: 'dflm-field' },
          h('span', { className: 'dflm-field-label' }, t('proxy')),
          h(
            'select',
            {
              className: 'dflm-input',
              value: draft.proxy,
              onChange: (event) => edit({ proxy: event.target.value }),
            },
            h('option', { value: 'inherit' }, t('proxyInherit')),
            h('option', { value: 'direct' }, t('proxyDirect')),
          ),
        ),
        h(
          'div',
          { className: 'dflm-row' },
          h(
            'label',
            { className: 'dflm-toggle' },
            h('input', {
              type: 'checkbox',
              checked: draft.autoStart,
              onChange: (event) => edit({ autoStart: event.target.checked }),
            }),
            t('autoStart'),
          ),
          h(
            'label',
            { className: 'dflm-toggle' },
            h('input', {
              type: 'checkbox',
              checked: draft.probeModels,
              onChange: (event) => edit({ probeModels: event.target.checked }),
            }),
            t('probeToggle'),
          ),
          h(
            'label',
            { className: 'dflm-toggle', style: { marginLeft: 'auto' } },
            t('maxTokens'),
            h('input', {
              className: 'dflm-input',
              style: { width: 96, flex: 'none' },
              value: draft.defaultMaxTokens,
              onChange: (event) => edit({ defaultMaxTokens: event.target.value }),
            }),
          ),
        ),
        h(
          'div',
          { className: 'dflm-row' },
          h(
            'button',
            { className: 'dflm-btn primary', disabled: !dirty || pending !== '', onClick: save },
            pending === 'save' ? t('saving') : t('save'),
          ),
          message ? h('span', { className: 'dflm-note' }, message) : null,
        ),
        h(EntryRows, { t }),
      );
    }

    /** Where the plugin's own surfaces appear. Lives in the settings card so it
     * is reachable from both the panel tab and the plugin page. */
    function EntryRows({ t }) {
      const where = usePrefValue(placement);
      return h(
        'div',
        { className: 'dflm-cfg-group', role: 'group', 'aria-label': t('entryGroup') },
        h('div', { className: 'dflm-cfg-title' }, t('entryGroup')),
        h(
          'div',
          { className: 'dflm-cfg-row' },
          h('span', { className: 'dflm-row-label' }, t('cfgPlacement')),
          h(
            'select',
            {
              className: 'dflm-cfg-select',
              value: where,
              'aria-label': t('cfgPlacement'),
              onChange: (event) => placement.set(event.target.value),
            },
            h('option', { value: 'all' }, t('placementAll')),
            h('option', { value: 'sidebar' }, t('placementSidebar')),
            h('option', { value: 'settings' }, t('placementSettings')),
          ),
        ),
      );
    }

    // One axis of the score, as the dashboard draws it: track and number. A
    // missing number renders as a dash with no fill — a model that has never
    // been called has no reliability, and drawing an empty bar at 0 would claim
    // it had been measured and found bad.
    function RankAxis({ kind, value, label }) {
      const known = typeof value === 'number' && Number.isFinite(value)
      const pct = known ? Math.max(0, Math.min(100, value)) : 0
      return h(
        'div',
        { className: 'dflm-axis', title: known ? `${label} ${Math.round(pct)}` : label },
        h(
          'span',
          { className: 'dflm-axis-track' },
          // The class comes from `kind`, never from the label: the label is
          // translated, the colour is not.
          known ? h('span', { className: `dflm-axis-fill ${kind}`, style: { width: pct + '%' } }) : null,
        ),
        h('span', { className: 'dflm-axis-num' }, known ? String(Math.round(pct)) : '—'),
      )
    }

    function rateLabel(rank) {
      const rpm = rank.rpmLimit || 0
      const rpd = rank.rpdLimit || 0
      if (rpm > 0) return `${rpm}/min`
      if (rpd > 0) return `${rpd}/day`
      return ''
    }

    // The dashboard writes 1M for 1048576 and 512K for 524288; rounding to whole
    // K would print 1024K beside a 1M label in the console, which reads as a bug.
    function contextLabel(tokens) {
      if (!(tokens > 0)) return ''
      const k = Math.round(tokens / 1024)
      return k >= 1024 ? `${Math.round((k / 1024) * 10) / 10}M` : `${k}K`
    }

    const RANK_SORTS = ['score', 'stability', 'speed', 'intelligence', 'name']

    /**
     * The dashboard's ranking table, drawn natively.
     *
     * The numbers come from the router's own scoring pass (lib/ranking.js), so
     * this is the same table as http://127.0.0.1:3001/models — not a copy that
     * drifts. What the dashboard has that this does not is the editor for
     * provider keys and routing policy; the console button below is the way
     * there, and that is why it exists.
     */
    function Ranking({ t, state, load }) {
      const catalogue = (state.data && state.data.catalogue) || undefined;
      const [filter, setFilter] = usePersistent('dflm.rankFilter', '');
      const [limit, setLimit] = usePersistent('dflm.rankLimit', 40);
      const [sort, setSort] = usePersistent('dflm.rankSort', 'score');
      const [onlyVision, setOnlyVision] = usePersistent('dflm.rankVision', false);
      const [onlyTools, setOnlyTools] = usePersistent('dflm.rankTools', false);
      const [minCtx, setMinCtx] = usePersistent('dflm.rankCtx', 0);
      const rows = (catalogue && catalogue.models) || [];
      // Enabled state is the picker's own: `offered` already means "what the
      // router is serving", whether that came from a probe or a saved list.
      const offeredIds = useMemo(() => rows.filter((row) => row.offered).map((row) => row.id).sort(), [rows]);
      const [draft, setDraft] = useState(undefined);
      const selected = draft === undefined ? offeredIds : draft;
      const picked = useMemo(() => new Set(selected), [selected]);
      const dirty = useMemo(() => JSON.stringify([...selected].sort()) !== JSON.stringify(offeredIds), [selected, offeredIds]);
      const [pending, setPending] = useState('');
      const save = async (patch) => {
        setPending('apply');
        await load('save', { patch });
        setDraft(undefined);
        setPending('');
      };
      const write = (next) => setDraft([...new Set(next)].sort());

      const scored = useMemo(() => rows.filter((row) => row.rank && row.rank.score !== undefined), [rows]);
      const ranked = useMemo(() => {
        const needle = filter.trim().toLowerCase();
        const list = scored.filter((row) => {
          if (needle !== '' && !`${row.id} ${row.name}`.toLowerCase().includes(needle)) return false;
          if (onlyVision && !row.rank.vision) return false;
          if (onlyTools && !row.rank.tools) return false;
          if (minCtx > 0 && (row.rank.contextWindow || 0) < minCtx) return false;
          return true;
        });
        const key = (row) => {
          if (sort === 'name') return String(row.id);
          if (sort === 'stability') return row.rank.stability;
          if (sort === 'speed') return row.rank.speedPct;
          if (sort === 'intelligence') return row.rank.intelligencePct;
          return row.rank.score;
        };
        // The score column is the default because that is the order the whole
        // feature exists to show. Ties fall back to the id so the list does not
        // reshuffle between identical polls.
        return [...list].sort((a, b) => {
          if (sort === 'name') return key(a).localeCompare(key(b));
          const delta = (Number(key(b)) || 0) - (Number(key(a)) || 0);
          return delta !== 0 ? delta : String(a.id).localeCompare(String(b.id));
        });
      }, [scored, filter, sort, onlyVision, onlyTools, minCtx]);
      const shown = useMemo(() => ranked.slice(0, limit), [ranked, limit]);
      const shownIds = useMemo(() => shown.map((row) => row.id), [shown]);
      const hidden = ranked.length - shown.length;
      const consoleUrl = catalogue && catalogue.consoleUrl;
      const enabledCount = shown.filter((row) => picked.has(row.id)).length;
      const sortHeader = (key, label) =>
        h(
          'button',
          {
            type: 'button',
            className: `sort${sort === key ? ' on' : ''}`,
            onClick: () => setSort(key),
            title: t('rankSortBy', { by: label }),
          },
          label,
        );
      return h(
        'div',
        { className: 'dflm-card' },
        h(
          'div',
          { className: 'dflm-row' },
          h('strong', {}, t('ranking')),
          h('span', { className: 'dflm-note' }, catalogue ? t('rankScored', { n: scored.length }) : ''),
          h(
            'span',
            { style: { marginLeft: 'auto', display: 'flex', gap: 8 } },
            // The dashboard is the only place with provider keys and routing
            // policy, so the panel keeps a door to it instead of reimplementing
            // half of it. target=_blank works in the browser and in Electron's
            // renderer alike; no host bridge needed.
            consoleUrl
              ? h(
                  'a',
                  {
                    className: 'dflm-btn',
                    href: consoleUrl,
                    target: '_blank',
                    rel: 'noreferrer noopener',
                    title: t('consoleHint'),
                    style: { display: 'inline-flex', alignItems: 'center', textDecoration: 'none' },
                  },
                  t('openConsole'),
                )
              : null,
            h(
              'button',
              {
                className: 'dflm-btn',
                disabled: pending !== '',
                onClick: async () => {
                  setPending('status');
                  await load('status');
                  setPending('');
                },
              },
              pending === 'status' ? t('saving') : t('refresh'),
            ),
          ),
        ),
        h('div', { className: 'dflm-note' }, t('rankingHint')),
        scored.length === 0
          ? h('div', { className: 'dflm-note' }, catalogue && catalogue.rankingError ? catalogue.rankingError : t('rankingEmpty'))
          : h(
              'div',
              { className: 'dflm-rank' },
              h(
                'div',
                { className: 'dflm-rank-tools' },
                h('input', {
                  className: 'dflm-input',
                  placeholder: t('search'),
                  value: filter,
                  onChange: (event) => setFilter(event.target.value),
                }),
                h(
                  'button',
                  { type: 'button', className: `dflm-chip${onlyVision ? ' on' : ''}`, 'aria-pressed': onlyVision, onClick: () => setOnlyVision(!onlyVision) },
                  t('rankVision'),
                ),
                h(
                  'button',
                  { type: 'button', className: `dflm-chip${onlyTools ? ' on' : ''}`, 'aria-pressed': onlyTools, onClick: () => setOnlyTools(!onlyTools) },
                  t('rankTools'),
                ),
                ...[32, 128, 1024].map((size) =>
                  h(
                    'button',
                    {
                      key: size,
                      type: 'button',
                      className: `dflm-chip${minCtx === size * 1024 ? ' on' : ''}`,
                      'aria-pressed': minCtx === size * 1024,
                      onClick: () => setMinCtx(minCtx === size * 1024 ? 0 : size * 1024),
                    },
                    t('rankCtxMin', { n: size >= 1024 ? `${size / 1024}M` : `${size}K` }),
                  ),
                ),
              ),
              h(
                'div',
                { className: 'dflm-grid dflm-rank-head' },
                h('span', {}, '#'),
                h('span', {}, t('rankModel')),
                sortHeader('stability', t('rankStability')),
                sortHeader('speed', t('rankSpeed')),
                sortHeader('intelligence', t('rankIntelligence')),
                sortHeader('score', t('rankScore')),
                h('span', {}, t('enable')),
              ),
              h(
                'div',
                { className: 'dflm-rank-body' },
                shown.map((row, index) =>
                  h(
                    'div',
                    { key: row.id, className: row.offered ? 'dflm-grid dflm-rank-row' : 'dflm-grid dflm-rank-row off' },
                    h('span', { className: 'dflm-rank-index' }, String(index + 1)),
                    h(
                      'div',
                      { className: 'dflm-rank-id' },
                      h('span', { className: 'dflm-rank-name', title: `${row.name || row.id} — ${row.id}` }, row.name || row.id),
                      h(
                        'div',
                        { className: 'dflm-rank-tags' },
                        (row.rank.platforms || []).slice(0, 3).map((platform) => h('span', { key: platform, className: 'dflm-rank-tag' }, platform)),
                        (row.rank.platforms || []).length > 3
                          ? h('span', { className: 'dflm-rank-tag' }, `+${row.rank.platforms.length - 3}`)
                          : null,
                        contextLabel(row.rank.contextWindow) !== ''
                          ? h('span', { className: 'dflm-rank-tag' }, contextLabel(row.rank.contextWindow))
                          : null,
                        rateLabel(row.rank) !== '' ? h('span', { className: 'dflm-rank-tag' }, rateLabel(row.rank)) : null,
                        row.rank.tools ? h('span', { className: 'dflm-rank-tag hot' }, t('rankTools')) : null,
                        row.rank.vision ? h('span', { className: 'dflm-rank-tag hot' }, t('rankVision')) : null,
                      ),
                    ),
                    h(RankAxis, { kind: 'stability', value: row.rank.stability, label: t('rankStability') }),
                    h(RankAxis, { kind: 'speed', value: row.rank.speedPct, label: t('rankSpeed') }),
                    h(RankAxis, { kind: 'intelligence', value: row.rank.intelligencePct, label: t('rankIntelligence') }),
                    h('span', { className: 'dflm-rank-score', title: t('rankScore') }, row.rank.score.toFixed(3)),
                    h('button', {
                      type: 'button',
                      className: 'dflm-switch',
                      role: 'switch',
                      // A switch is a checkbox, not a toggle button: the state
                      // it carries belongs in aria-checked. aria-pressed here
                      // left screen readers announcing a pressed button, and the
                      // CSS that paints the knob keys off the same attribute.
                      'aria-checked': picked.has(row.id),
                      'aria-label': `${t('enable')} ${row.id}`,
                      title: picked.has(row.id) ? t('rankSwitchOff') : t('rankSwitchOn'),
                      onClick: () => {
                        const next = new Set(selected);
                        if (next.has(row.id)) next.delete(row.id);
                        else next.add(row.id);
                        write([...next]);
                      },
                    }),
                  ),
                ),
              ),
              h(
                'div',
                { className: 'dflm-rank-foot' },
                h('span', { className: 'dflm-note' }, t('rankShowing', { shown: shown.length, total: ranked.length })),
                hidden > 0 ? h('button', { className: 'dflm-chip', onClick: () => setLimit(limit + 40) }, t('rankShowMore', { n: Math.min(hidden, 40) })) : null,
                h('span', { style: { marginLeft: 'auto', display: 'flex', gap: 6, alignItems: 'center' } },
                  h('span', { className: 'dflm-note' }, t('rankEnabledOf', { n: enabledCount })),
                  h('button', { className: 'dflm-chip', onClick: () => write([...selected, ...shownIds]) }, t('rankAllOn')),
                  h('button', { className: 'dflm-chip', onClick: () => write(selected.filter((id) => !shownIds.includes(id))) }, t('rankAllOff')),
                ),
              ),
              dirty
                ? h(
                    'div',
                    { className: 'dflm-row' },
                    h('span', { className: 'dflm-badge' }, t('enabledCount', { n: selected.length })),
                    h(
                      'button',
                      { className: 'dflm-btn primary', disabled: pending !== '' || selected.length === 0, onClick: () => save({ enabledModels: [...selected] }) },
                      pending === 'apply' ? t('saving') : t('apply'),
                    ),
                    h('button', { className: 'dflm-btn', disabled: pending !== '', onClick: () => save({ enabledModels: [] }) }, t('reset')),
                  )
                : null,
            ),
      );
    }

    // Four sections, one at a time. The panel used to stack them, which meant
    // "Settings" had no entry at all unless you scrolled — and the models list
    // is long enough that nobody did.
    const TABS = ['status', 'ranking', 'models', 'settings'];

    function Panel({ locale }) {
      const t = useTranslate(locale);
      const { state, load } = useRouter();
      const [tab, setTab] = usePersistent('dflm.tab', 'status');
      const scheme = useColorScheme();
      return h(
        'div',
        { className: 'dflm', style: { colorScheme: scheme } },
        h(
          'div',
          { className: 'dflm-head' },
          h('h2', { className: 'dflm-title' }, t('title')),
          h('span', { className: 'dflm-sub' }, t('subtitle')),
        ),
        h(
          'div',
          { className: 'dflm-tabs' },
          TABS.map((key) =>
            h(
              'button',
              {
                key,
                className: `dflm-tab${key === tab ? ' on' : ''}`,
                'aria-current': key === tab ? 'page' : undefined,
                onClick: () => setTab(key),
              },
              t(key),
            )),
        ),
        // h(), never a direct call: these cards own hooks, and calling them
        // inline appends those hooks to Panel's own list — switching tabs
        // changes the count and React aborts the render (blank panel).
        tab === 'ranking' ? h(Ranking, { t, state, load }) : null,
        tab === 'models' ? h(ModelList, { t, state, load }) : null,
        tab === 'settings' ? h(SettingsCard, { t, state, load }) : null,
        tab === 'status' ? h(StatusCard, { t, state, load }) : null,
      );
    }

    function PanelIcon({ size }) {
      // Same motif as icon.svg: one entry node fanning out to three models —
      // the router, not a star. currentColor keeps it on-theme in the sidebar.
      const s = size || 20;
      return h(
        'svg',
        { width: s, height: s, viewBox: '0 0 24 24', fill: 'none', 'aria-hidden': true },
        h('g', {
          stroke: 'currentColor',
          strokeWidth: 1.6,
          strokeLinecap: 'round',
          strokeLinejoin: 'round',
        },
          h('circle', { cx: 4.6, cy: 12, r: 2.1 }),
          h('circle', { cx: 19.4, cy: 5.4, r: 1.7 }),
          h('circle', { cx: 19.4, cy: 12, r: 1.7 }),
          h('circle', { cx: 19.4, cy: 18.6, r: 1.7 }),
          h('path', { d: 'M6.7 11.2 17.7 6.1' }),
          h('path', { d: 'M6.7 12 17.7 12' }),
          h('path', { d: 'M6.7 12.8 17.7 17.9' }),
        ),
      );
    }

    function BundleConfig({ locale, view }) {
      const t = useTranslate(locale);
      const { state, load } = useRouter();
      const where = usePrefValue(placement);
      const scheme = useColorScheme();
      if (view === 'summary') {
        const catalogue = state.data && state.data.catalogue;
        const server = (state.data && state.data.server) || {};
        if (server.reachable !== true) return h('span', {}, t('summaryDown'));
        return h('span', {}, t('summary', { models: catalogue ? catalogue.offered : 0 }));
      }
      return h(
        'div',
        { className: 'dflm', style: { padding: 0, height: 'auto', colorScheme: scheme } },
        h(StatusCard, { t, state, load }),
        // The plugin page is where DSH puts a plugin's own settings, and this
        // panel had none: everything lived in the sidebar, below a long model
        // list nobody scrolled past.
        h(SettingsCard, { t, state, load }),
        // Embedded, not linked: in "settings page only" the sidebar panel is
        // gone, and without the model list here the enabled-models picker
        // would have no way back.
        where === 'settings' ? h(ModelList, { t, state, load }) : null,
      );
    }

    return {
      inject: ['slots', 'locale'],
      // Every slot registration runs inside one try/catch. The host audits each
      // manifest plugin during boot and a single throw here takes the whole web
      // UI down with it ("web boot: 1 entry did not activate"), so a half-broken
      // panel must cost the panel only — never the client.
      apply(ctx) {
        try {
          const locale = ctx.get('locale');
          if (locale) {
            ctx.effect(() => locale.register(NS, 'zh', zh), 'dsh-freellmapi: locale zh');
            ctx.effect(() => locale.register(NS, 'en', en), 'dsh-freellmapi: locale en');
          }
          ctx.effect(() => insertStyles(CSS), 'dsh-freellmapi: styles');

          // The sidebar icon is the opt-out; hiding it leaves the panel reachable
          // from the plugin page, so the plugin never becomes unreachable.
          ctx.effect(
            () =>
              bindWhile(
                () => placement.get() !== 'settings',
                () => [
                  ctx.slots.inject('sidebar.panellist', () =>
                    ctx.slots.register({ name: 'sidebar.panellist', id: PANEL_ID, order: 54, label: () => 'FreeLLMAPI' }, (props) =>
                      h(PanelIcon, { size: props && props.size }),
                    ),
                  ),
                ],
              ),
            'dsh-freellmapi: sidebar entry',
          );

          // The panel view itself stays mounted: it is what the sidebar icon opens,
          // and a route other code can hold should not vanish because the icon did.
          ctx.slots.inject('main', () =>
            ctx.slots.register({ name: 'main', key: PANEL_ID }, () => h(Panel, { locale })),
          );

          ctx.effect(
            () =>
              bindWhile(
                () => placement.get() !== 'sidebar',
                () => [
                  ctx.slots.inject('plugins.bundle.config', () =>
                    ctx.slots.register({ name: 'plugins.bundle.config', key: 'dsh-freellmapi' }, (props) =>
                      h(BundleConfig, { locale, view: props && props.view }),
                    ),
                  ),
                ],
              ),
            'dsh-freellmapi: plugin page entry',
          );
        } catch (error) {
          // The host has already logged it; swallowing here is what keeps the
          // rest of the client alive. Without the panel the model lane still
          // works — it is a provider route, not a UI feature.
          console.error('[freellmapi] client failed to activate', error);
        }
      },
    };
  },
});
