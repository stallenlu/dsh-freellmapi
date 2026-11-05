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
    };

    const CSS = `
      .dflm { display: flex; flex-direction: column; gap: 16px; padding: 20px 22px 28px; overflow-y: auto; height: 100%; box-sizing: border-box; color: var(--dsw-alias-label-primary); }
      .dflm-head { display: flex; align-items: baseline; gap: 10px; flex-wrap: wrap; }
      .dflm-title { font-size: 18px; font-weight: 600; margin: 0; }
      .dflm-sub { font-size: 13px; color: var(--dsw-alias-label-secondary); }
      .dflm-card { border-radius: 12px; background: var(--dsw-alias-bg-module-platform, var(--dsw-alias-bg-layer-2)); padding: 14px 16px; display: flex; flex-direction: column; gap: 10px; }
      .dflm-row { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
      .dflm-row-label { font-size: 13px; color: var(--dsw-alias-label-secondary); min-width: 84px; }
      .dflm-value { font-size: 13px; word-break: break-all; }
      .dflm-dot { width: 8px; height: 8px; border-radius: 50%; flex: none; }
      .dflm-dot.on { background: #2e9e5b; box-shadow: 0 0 0 3px rgba(46,158,91,0.16); }
      .dflm-dot.off { background: #9aa0a6; }
      .dflm-dot.warn { background: #c9861c; }
      .dflm-btn { box-sizing: border-box; height: 32px; padding: 0 14px; border: none; border-radius: 16px; background: var(--dsw-alias-bg-layer-3, rgba(127,127,127,0.14)); color: var(--dsw-alias-label-primary); font: inherit; font-size: 13px; cursor: pointer; }
      .dflm-btn:hover:not(:disabled) { background: var(--dsw-alias-bg-layer-4, rgba(127,127,127,0.22)); }
      .dflm-btn:disabled { opacity: 0.5; cursor: default; }
      .dflm-btn.primary { background: var(--dsw-alias-brand-primary); color: #fff; }
      .dflm-input { box-sizing: border-box; height: 34px; padding: 0 12px; border-radius: 8px; border: 1px solid var(--dsw-alias-border-secondary, rgba(127,127,127,0.28)); background: transparent; color: inherit; font: inherit; font-size: 13px; min-width: 0; flex: 1; }
      .dflm-input:focus-visible { outline: 2px solid var(--dsw-alias-brand-primary); outline-offset: -1px; }
      .dflm-note { font-size: 12px; color: var(--dsw-alias-label-secondary); }
      .dflm-err { font-size: 13px; color: #c0392b; }
      .dflm-models { display: flex; flex-direction: column; gap: 6px; max-height: 340px; overflow-y: auto; }
      .dflm-model { display: flex; align-items: baseline; gap: 8px; padding: 6px 10px; border-radius: 8px; background: var(--dsw-alias-bg-layer-3, rgba(127,127,127,0.10)); font-size: 13px; }
      .dflm-model-id { font-family: ui-monospace, monospace; font-size: 12px; }
      .dflm-model-meta { margin-left: auto; font-size: 12px; color: var(--dsw-alias-label-secondary); white-space: nowrap; }
      .dflm-model.dim { opacity: 0.5; }
      .dflm-badge { font-size: 11px; padding: 1px 7px; border-radius: 9px; background: var(--dsw-alias-bg-layer-4, rgba(127,127,127,0.2)); }
      .dflm-toggle { display: inline-flex; align-items: center; gap: 8px; font-size: 13px; cursor: pointer; }
      .dflm-tabs { display: flex; gap: 6px; border-bottom: 1px solid var(--dsw-alias-border-secondary, rgba(127,127,127,0.22)); padding-bottom: 8px; }
      .dflm-tab { box-sizing: border-box; height: 28px; padding: 0 12px; border: none; border-radius: 14px; background: transparent; color: var(--dsw-alias-label-secondary); font: inherit; font-size: 13px; cursor: pointer; }
      .dflm-tab:hover { background: var(--dsw-alias-bg-layer-3, rgba(127,127,127,0.12)); }
      .dflm-tab.on { background: var(--dsw-alias-bg-layer-4, rgba(127,127,127,0.2)); color: var(--dsw-alias-label-primary); font-weight: 600; }
      .dflm-settings { display: flex; flex-direction: column; gap: 12px; }
      .dflm-field { display: flex; flex-direction: column; gap: 6px; }
      .dflm-field-label { font-size: 13px; }
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

    async function call(action, payload) {
      const response = await fetch(ROUTE, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ action, ...(payload || {}) }),
      });
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
      const busy = useRef(false);
      const load = useCallback(
        async (action, payload) => {
          if (busy.current) return;
          busy.current = true;
          try {
            const data = await call(action || 'status', payload);
            setState({ loading: false, data, error: '' });
          } catch (error) {
            setState({ loading: false, data: store.get('dflm.state').data, error: String(error.message || error) });
          } finally {
            busy.current = false;
          }
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
          void load('status');
        }, 2500);
        return () => clearInterval(timer);
      }, [probingNow, load]);
      return { state, load, setState };
    }

    function StatusCard({ t, state, load }) {
      const data = state.data || {};
      const server = data.server || {};
      const key = data.key || {};
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

    function ModelList({ t, state, load }) {
      const catalogue = (state.data && state.data.catalogue) || undefined;
      const probingNow = !!(state.data && state.data.probingNow);
      const [filter, setFilter] = usePersistent('dflm.filter', '');
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
        return [...list].sort((a, b) => Number(picked.has(b.id)) - Number(picked.has(a.id)) || Number(b.offered) - Number(a.offered) || String(a.id).localeCompare(String(b.id)));
      }, [rows, filter, selected]);
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
      );
    }

    // Three sections, one at a time. The panel used to stack them, which meant
    // "Settings" had no entry at all unless you scrolled — and the models list
    // is long enough that nobody did.
    const TABS = ['status', 'models', 'settings'];

    function Panel({ locale }) {
      const t = useTranslate(locale);
      const { state, load } = useRouter();
      const [tab, setTab] = usePersistent('dflm.tab', 'status');
      return h(
        'div',
        { className: 'dflm' },
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
        tab === 'models' ? ModelList({ t, state, load }) : null,
        tab === 'settings' ? SettingsCard({ t, state, load }) : null,
        tab === 'status' ? StatusCard({ t, state, load }) : null,
      );
    }

    function PanelIcon() {
      return h(
        'svg',
        { width: 20, height: 20, viewBox: '0 0 20 20', fill: 'none', 'aria-hidden': true },
        h('path', {
          d: 'M10 2.4 12.3 7l5.1.7-3.7 3.6.9 5.1-4.6-2.4-4.6 2.4.9-5.1L2.6 7.7 7.7 7 10 2.4Z',
          stroke: 'currentColor',
          strokeWidth: 1.5,
          strokeLinejoin: 'round',
        }),
      );
    }

    function BundleConfig({ locale, view }) {
      const t = useTranslate(locale);
      const { state, load } = useRouter();
      if (view === 'summary') {
        const catalogue = state.data && state.data.catalogue;
        const server = (state.data && state.data.server) || {};
        if (server.reachable !== true) return h('span', {}, t('summaryDown'));
        return h('span', {}, t('summary', { models: catalogue ? catalogue.offered : 0 }));
      }
      return h(
        'div',
        { className: 'dflm', style: { padding: 0, height: 'auto' } },
        StatusCard({ t, state, load }),
        // The plugin page is where DSH puts a plugin's own settings, and this
        // panel had none: everything lived in the sidebar, below a long model
        // list nobody scrolled past. The models list stays there.
        SettingsCard({ t, state, load }),
      );
    }

    return {
      inject: ['slots', 'locale'],
      apply(ctx) {
        const locale = ctx.get('locale');
        if (locale) {
          ctx.effect(() => locale.register(NS, 'zh', zh), 'dsh-freellmapi: locale zh');
          ctx.effect(() => locale.register(NS, 'en', en), 'dsh-freellmapi: locale en');
        }
        ctx.effect(() => insertStyles(CSS), 'dsh-freellmapi: styles');

        ctx.slots.inject('sidebar.panellist', () =>
          ctx.slots.register({ name: 'sidebar.panellist', id: PANEL_ID, order: 54, label: () => 'FreeLLMAPI' }, (props) =>
            h(PanelIcon, { size: props && props.size }),
          ),
        );

        ctx.slots.inject('main', () =>
          ctx.slots.register({ name: 'main', key: PANEL_ID }, () => h(Panel, { locale })),
        );

        ctx.slots.inject('plugins.bundle.config', () =>
          ctx.slots.register({ name: 'plugins.bundle.config', key: 'dsh-freellmapi' }, (props) =>
            h(BundleConfig, { locale, view: props && props.view }),
          ),
        );
      },
    };
  },
});
