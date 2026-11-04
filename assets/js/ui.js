/* 界面层：顶栏指标、标签面板、国家面板、战况、toast、开始/结局界面 */
(function (WC) {
  'use strict';

  var S = WC.State;
  var $ = function (id) { return document.getElementById(id); };
  var T = WC.t;
  var cname = function (c) { return WC.cname(c); };

  var UI = {};

  // ---------------- 界面状态 ----------------
  var selectedId = null;
  var activeTab = 'overview';
  var rankMetric = 'power';
  var soundOn = false;

  var snap = { day: -1, gdp: 0, pop: 0, stability: 0, dGdp: 0, dPop: 0, dStab: 0 };

  var lastRankAt = 0;
  var lastLogAt = 0;
  var lastLogDay = -1;
  var lastPanelAt = 0;
  var endShown = false;

  // 指针按下时锁定面板重绘，避免打断拖拽/点击
  var uiLock = 0;

  var TAB_TITLES = {
    overview: 'tab.overview', economy: 'tab.economy', military: 'tab.military',
    tech: 'tab.tech', diplomacy: 'tab.diplomacy', wars: 'tab.wars', ranking: 'tab.ranking'
  };

  // ---------------- 小工具 ----------------
  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function row(k, v, cls) {
    return '<div class="row"><span class="k">' + k + '</span>' +
      '<span class="v ' + (cls || '') + '">' + v + '</span></div>';
  }

  function barRow(val, cls, label) {
    var pct = WC.clamp(val, 0, 100);
    return '<div class="bar-row"><div class="bar ' + (cls || '') + '"><i style="width:' + pct + '%"></i></div>' +
      '<span class="num">' + (label != null ? label : Math.round(pct)) + '</span></div>';
  }

  function statBox(label, value, cls) {
    return '<div class="stat-box"><div class="lb">' + label + '</div>' +
      '<div class="vv ' + (cls || '') + '">' + value + '</div></div>';
  }

  function signed(v, fmt) {
    var f = fmt || WC.fmtMoneyU;
    return (v >= 0 ? '+' : '') + f(v);
  }

  function setSub(el, text, cls) {
    if (!el) return;
    el.textContent = text;
    el.className = 'sub ' + (cls || '');
  }

  // ---------------- 派生指标 ----------------
  function balanceOf(n) {
    var income = n.income || 0;
    return income - income * WC.CFG.ADMIN - (n.spent || 0);
  }

  function capOf(n) {
    var income = n.income || 0;
    var pool = income - income * WC.CFG.ADMIN;
    return Math.max(0, (n.milSpend * pool) / WC.CFG.UNIT_UPKEEP);
  }

  function infamyOf(n) {
    var v = (n.terrCount - 1) * 3.5 + S.warList(n.id).length * 6;
    return WC.clamp(v, 0, 100);
  }

  function dominationOf(n) {
    return n.terrCount / Math.max(1, S.world.count);
  }

  function devIndexOf(n) {
    var pc = (n.gdp * 1e6) / Math.max(1, n.pop);
    var lo = Math.log10(300), hi = Math.log10(80000);
    var v = (Math.log10(Math.max(300, pc)) - lo) / (hi - lo) * 100;
    return WC.clamp(v, 0, 100);
  }

  function neighborsOf(id) {
    var out = [];
    var m = S.adj[id] || {};
    for (var k in m) {
      var n = S.nation[k];
      if (n && n.alive) out.push(n);
    }
    return out;
  }

  function bestTarget(attacker, defender) {
    var best = null, bs = -1e18;
    for (var i = 0; i < defender._terrs.length; i++) {
      var t = defender._terrs[i];
      var ad = S.isAdj(attacker.id, t.id) ? 1 : 0.35;
      var sc = t.baseGdp * t.integration * ad;
      if (sc > bs) { bs = sc; best = t; }
    }
    return best;
  }

  function aliveCount() {
    var c = 0;
    for (var i = 0; i < S.nations.length; i++) if (S.nations[i].alive) c++;
    return c;
  }

  function tagHtml(ownerId) {
    var p = S.player();
    if (!p) return '';
    if (ownerId === p.id) return '<span class="tag mine">' + T('tag.mine') + '</span>';
    if (S.atWar(p.id, ownerId)) return '<span class="tag war">' + T('tag.war') + '</span>';
    if (S.hasTruce(p.id, ownerId)) return '<span class="tag truce">' + T('tag.truce') + '</span>';
    return '<span class="tag">' + T('tag.neutral') + '</span>';
  }

  // ---------------- 初始化 ----------------
  UI.init = function () {
    buildStartList('');
    bindStart();
    bindTopbar();
    bindTabrail();
    bindPanelDelegates();
    bindMap();
    bindKeyboard();
    bindUiLock();

    WC.bus.on('notify', function (item) {
      UI.toast(item.key ? WC.tr(item.key, item.args) : item.text, item.type);
    });

    $('panel-close').addEventListener('click', function () { closePanel(); });
    $('cp-close').addEventListener('click', function () { UI.select(null); });
    $('modal-close').addEventListener('click', function () { closeModal(); });
    $('modal-layer').addEventListener('click', function (e) {
      if (e.target === $('modal-layer')) closeModal();
    });

    requestAnimationFrame(function () {
      var l = $('loading');
      if (l) l.classList.add('hidden');
    });
  };

  function bindUiLock() {
    document.addEventListener('pointerdown', function (e) {
      var t = e.target;
      if (t && t.closest && t.closest('#panel, #cpanel, #battlehud, #modal, #startscreen')) uiLock++;
    }, true);
    var up = function () { uiLock = Math.max(0, uiLock - 1); };
    document.addEventListener('pointerup', up, true);
    document.addEventListener('pointercancel', up, true);
  }

  // ================================================================
  //  开始界面
  // ================================================================
  var pickedId = null;

  function resultItemHtml(c) {
    var n = S.nation[c.id];
    return '<button class="entry" data-pick="' + c.id + '">' +
      '<span class="flag">' + WC.flag(c.iso2) + '</span>' +
      '<span class="meta"><span class="nm">' + esc(cname(c)) + '</span>' +
      '<span class="sub2">' + esc(WC.lang === 'zh' ? c.name : c.zh) + '</span></span>' +
      '<span class="rt">' + WC.fmtMoneyU(c.gdp) + '<br>' + T('start.army', WC.fmtInt(n ? n.army : 0)) + '</span>' +
      '</button>';
  }

  function buildStartList(q) {
    var box = $('ss-results');
    q = (q || '').trim().toLowerCase();
    var list;
    if (q) {
      list = S.list.filter(function (c) {
        return c.zh.toLowerCase().indexOf(q) >= 0 ||
          c.name.toLowerCase().indexOf(q) >= 0 ||
          c.id.indexOf(q) >= 0;
      }).slice(0, 90);
      $('ss-foot-hint').textContent = T('start.found', list.length);
    } else {
      list = S.list.slice(0, 30);
      $('ss-foot-hint').textContent = T('start.all', S.list.length);
    }
    box.innerHTML = list.map(resultItemHtml).join('') ||
      '<div class="hint" style="grid-column:1/-1">' + T('start.empty') + '</div>';

    Array.prototype.forEach.call(box.querySelectorAll('[data-pick]'), function (btn) {
      btn.addEventListener('click', function () {
        markPicked(btn.getAttribute('data-pick'));
      });
    });
  }

  function markPicked(id) {
    pickedId = id;
    var c = S.byId[id], n = S.nation[id];
    $('ss-picked').innerHTML =
      '<span class="flag">' + WC.flag(c.iso2) + '</span>' +
      '<span class="meta"><span class="nm">' + esc(cname(c)) + '</span>' +
      '<span class="sub2">' + esc(WC.lang === 'zh' ? c.name : c.zh) + ' · ' + esc(c.continent) +
      T('start.detail', WC.fmtMoneyU(c.gdp), WC.fmtNum(c.pop), WC.fmtInt(n ? n.army : 0)) +
      '</span></span>';
    $('ss-picked').classList.remove('hidden');
    $('ss-start').disabled = false;
  }

  function bindStart() {
    $('ss-search').addEventListener('input', function (e) { buildStartList(e.target.value); });
    $('ss-random').addEventListener('click', function () {
      var pool = S.list.slice(0, 70);
      markPicked(pool[Math.floor(Math.random() * pool.length)].id);
      $('ss-results').scrollTop = 0;
    });
    $('ss-start').addEventListener('click', function () {
      if (pickedId) startGame(pickedId);
    });
  }

  function startGame(id) {
    S.setPlayer(id);
    S.speed = 1;
    highlightSpeed(1);

    $('startscreen').classList.add('hidden');
    $('topbar').classList.remove('hidden');
    $('tabrail').classList.remove('hidden');
    $('mapControls').classList.remove('hidden');

    openPanel('overview');
    UI.select(null);
    WC.Map.refresh();
    WC.Map.focus(id, 2.6);

    snap = { day: -1, gdp: 0, pop: 0, stability: 0, dGdp: 0, dPop: 0, dStab: 0 };
    endShown = false;
    UI.toast(T('start.welcome', cname(S.nation[id])), 'good');
    UI.render(true);
  }
  UI.startGame = startGame;

  // ================================================================
  //  顶栏
  // ================================================================
  function bindTopbar() {
    Array.prototype.forEach.call($('speedControls').querySelectorAll('.spd'), function (b) {
      b.addEventListener('click', function () {
        setSpeed(parseFloat(b.getAttribute('data-speed')));
      });
    });
    $('btn-sound').addEventListener('click', function () {
      soundOn = !soundOn;
      $('btn-sound').textContent = soundOn ? '🔊' : '🔇';
      UI.toast(T('sound.placeholder'), 'info');
    });
    $('btn-menu').addEventListener('click', openMenu);

    // 顶栏指标 hover 提示
    Array.prototype.forEach.call(document.querySelectorAll('.tb-stat[data-tip-key]'), function (el) {
      el.addEventListener('mouseenter', function (e) {
        showTip(T(el.getAttribute('data-tip-key')), e.clientX, e.clientY);
      });
      el.addEventListener('mousemove', function (e) { moveTip(e.clientX, e.clientY); });
      el.addEventListener('mouseleave', hideTip);
    });
  }

  /** 右上角菜单：信息 + 语言切换 + 操作 */
  function openMenu() {
    var langBtn = function (code, label) {
      return '<button class="btn-sm' + (WC.lang === code ? ' gold' : '') +
        '" data-mlang="' + code + '">' + label + '</button>';
    };
    openModal(T('menu.title'),
      '<div class="row"><span class="k">' + T('menu.nation') + '</span><span class="v">' + esc(cname(S.player())) + '</span></div>' +
      '<div class="row"><span class="k">' + T('menu.date') + '</span><span class="v">' + WC.fmtDate(S.day) + '</span></div>' +
      '<div class="row"><span class="k">' + T('menu.language') + '</span><span class="v">' +
      langBtn('zh', '中文') + ' ' + langBtn('en', 'English') + '</span></div>' +
      '<div class="hint">' + T('menu.hint') + '</div>',
      [
        { act: 'close', label: T('menu.continue'), cls: 'btn-ghost' },
        { act: 'restart', label: T('btn.restart'), cls: 'btn-danger' }
      ]);
  }

  function setSpeed(v) {
    S.speed = v;
    highlightSpeed(v);
  }
  UI.setSpeed = setSpeed;

  function highlightSpeed(v) {
    Array.prototype.forEach.call($('speedControls').querySelectorAll('.spd'), function (b) {
      b.classList.toggle('active', parseFloat(b.getAttribute('data-speed')) === v);
    });
  }

  function trackSnap(p) {
    if (snap.day === S.day) return;
    if (snap.day >= 0) {
      var d = Math.max(1, S.day - snap.day);
      snap.dGdp = (p.gdp - snap.gdp) / d;
      snap.dPop = (p.pop - snap.pop) / d;
      snap.dStab = (p.stability - snap.stability) / d;
    }
    snap.day = S.day;
    snap.gdp = p.gdp;
    snap.pop = p.pop;
    snap.stability = p.stability;
  }

  function renderTopbar() {
    var p = S.player();
    if (!p) return;
    $('tb-flag').textContent = WC.flag(p.iso2);
    $('tb-name').textContent = cname(p);
    $('tb-date').textContent = WC.fmtDate(S.day);

    var bal = balanceOf(p);
    $('tb-treasury').textContent = WC.fmtMoneyU(p.treasury);
    setSub($('tb-balance'), signed(bal), bal >= 0 ? 'pos' : 'neg');

    $('tb-gdp').textContent = WC.fmtMoneyU(p.gdp);
    setSub($('tb-growth'), signed(snap.dGdp, WC.fmtMoneyU) + T('tb.perDay'), snap.dGdp >= 0 ? 'pos' : 'neg');

    $('tb-pop').textContent = WC.fmtNum(p.pop);

    $('tb-manpower').textContent = WC.fmtInt(p.army);
    setSub($('tb-manpower-cap'), T('tb.cap', WC.fmtInt(capOf(p))), p.army > capOf(p) ? 'neg' : '');

    $('tb-stability').textContent = Math.round(p.stability);
    setSub($('tb-stability-trend'),
      (snap.dStab >= 0 ? '▲' : '▼') + Math.abs(snap.dStab).toFixed(2) + T('tb.perDay'),
      snap.dStab >= 0 ? 'pos' : 'neg');

    $('tb-infamy').textContent = Math.round(infamyOf(p));

    var dom = dominationOf(p);
    $('tb-domination').textContent = WC.fmtPct(dom, 1);
    setSub($('tb-domination-sub'), T('tb.victory'), 'gold');
  }

  // ================================================================
  //  标签栏 / 面板开关
  // ================================================================
  function bindTabrail() {
    Array.prototype.forEach.call($('tabrail').querySelectorAll('.tab-btn'), function (b) {
      b.addEventListener('click', function () {
        var t = b.getAttribute('data-tab');
        if (activeTab === t && !$('panel').classList.contains('hidden')) {
          closePanel();
          return;
        }
        openPanel(t);
      });
    });
  }

  function openPanel(tab) {
    activeTab = tab;
    $('panel-title').textContent = T(TAB_TITLES[tab] || tab);
    $('panel-body').innerHTML = renderTab(tab);
    $('panel').classList.remove('hidden');
    Array.prototype.forEach.call($('tabrail').querySelectorAll('.tab-btn'), function (b) {
      b.classList.toggle('active', b.getAttribute('data-tab') === tab);
    });
    lastPanelAt = Date.now();
  }
  UI.openPanel = openPanel;

  function closePanel() {
    $('panel').classList.add('hidden');
    Array.prototype.forEach.call($('tabrail').querySelectorAll('.tab-btn'), function (b) {
      b.classList.remove('active');
    });
  }

  // ================================================================
  //  面板内容
  // ================================================================
  function renderTab(tab) {
    var p = S.player();
    if (!p) return '';
    if (tab === 'economy') return tabEconomy(p);
    if (tab === 'military') return tabMilitary(p);
    if (tab === 'tech') return tabTech(p);
    if (tab === 'diplomacy') return tabDiplomacy(p);
    if (tab === 'wars') return tabWars(p);
    if (tab === 'ranking') return tabRanking(p);
    return tabOverview(p);
  }

  function headCard(p, extra) {
    return '<div style="display:flex;align-items:center;gap:12px">' +
      '<span style="font-size:34px;line-height:1">' + WC.flag(p.iso2) + '</span>' +
      '<div style="min-width:0"><div style="font-family:var(--font-d);font-weight:700;font-size:21px;color:var(--gold)">' + esc(cname(p)) + '</div>' +
      '<div style="color:var(--txt-dim);font-size:12px">' + esc(WC.lang === 'zh' ? p.name : p.zh) + ' · ' + esc(p.continent) + '</div></div></div>' +
      '<div style="margin-top:8px">' + (extra || '') + '</div>';
  }

  function statusTags(p) {
    var out = '';
    var wars = S.warList(p.id);
    if (wars.length) out += '<span class="tag war">' + T('st.atWar', wars.length) + '</span>';
    else out += '<span class="tag mine">' + T('st.peace') + '</span>';
    if (p.terrCount > 1) out += '<span class="tag gold">' + T('st.terr', p.terrCount) + '</span>';
    return out;
  }

  function tabOverview(p) {
    var alive = aliveCount();
    var rankArmy = 1, rankGdp = 1;
    var sortedA = S.nations.filter(function (n) { return n.alive; }).sort(function (a, b) { return b.army - a.army; });
    var sortedG = S.nations.filter(function (n) { return n.alive; }).sort(function (a, b) { return b.gdp - a.gdp; });
    for (var i = 0; i < sortedA.length; i++) if (sortedA[i].id === p.id) rankArmy = i + 1;
    for (var j = 0; j < sortedG.length; j++) if (sortedG[j].id === p.id) rankGdp = j + 1;

    var h = headCard(p, statusTags(p));
    h += '<h3 class="sec">' + T('ov.title') + '</h3>';
    h += '<div class="stat-grid">' +
      statBox(T('k.treasury'), WC.fmtMoneyU(p.treasury), 'gold') +
      statBox(T('k.army'), WC.fmtInt(p.army)) +
      statBox(T('k.stability'), Math.round(p.stability), p.stability < 35 ? 'red' : (p.stability > 65 ? 'green' : '')) +
      statBox(T('k.territories'), p.terrCount + ' / ' + S.world.count) +
      '</div>';
    h += '<h3 class="sec">' + T('k.stability') + '</h3>' + barRow(p.stability, p.stability < 35 ? 'red' : 'green');

    h += '<h3 class="sec">' + T('k.finance') + '</h3>';
    h += row(T('k.revenue'), WC.fmtMoneyU(p.income));
    h += row(T('k.admin'), '-' + WC.fmtMoneyU(p.income * WC.CFG.ADMIN), 'neg');
    h += row(T('k.milSpend'), '-' + WC.fmtMoneyU(p.spent), 'neg');
    h += row(T('k.balance'), signed(balanceOf(p)), balanceOf(p) >= 0 ? 'pos' : 'neg');

    h += '<h3 class="sec">' + T('k.standing') + '</h3>';
    h += row(T('k.gdpShare'), WC.fmtPct(p.gdp / Math.max(1, S.worldGdpNow()), 1), 'gold');
    h += row(T('k.terrShare'), WC.fmtPct(dominationOf(p), 1), 'gold');
    h += row(T('k.armyRank'), T('v.rank', rankArmy, alive));
    h += row(T('k.gdpRank'), T('v.rank', rankGdp, alive));
    h += row(T('k.infamy'), Math.round(infamyOf(p)) + ' / 100', infamyOf(p) > 60 ? 'neg' : '');

    h += '<h3 class="sec">' + T('k.events') + '</h3>' + logHtml(12);
    return h;
  }

  function tabEconomy(p) {
    var gdpHome = S.terr[p.id] ? S.terr[p.id].baseGdp * S.terr[p.id].integration : 0;
    var gdpTerr = Math.max(0, p.gdp - gdpHome);
    var ints = 0, cnt = 0;
    for (var i = 0; i < p._terrs.length; i++) {
      if (p._terrs[i].id === p.id) continue;
      ints += p._terrs[i].integration; cnt++;
    }
    var avgInt = cnt ? ints / cnt : 1;

    var h = headCard(p, statusTags(p));
    h += '<h3 class="sec">' + T('eco.balance') + '</h3>';
    h += row(T('k.treasury'), WC.fmtMoneyU(p.treasury), 'gold');
    h += row(T('k.balance'), signed(balanceOf(p)), balanceOf(p) >= 0 ? 'pos' : 'neg');
    h += row(T('k.gdp'), WC.fmtMoneyU(p.gdp));
    h += row(T('k.gdpPerCapita'), WC.fmtMoneyU((p.gdp * 1e6) / Math.max(1, p.pop) / 1e6), '');
    h += row(T('k.pop'), WC.fmtNum(p.pop));

    h += '<h3 class="sec">' + T('eco.tax') + '</h3>';
    h += '<div class="slider-block"><div class="sl-head"><span>' + T('k.taxRate') + '</span><b id="tax-val">' +
      Math.round(p.taxRate * 100) + '%</b></div>' +
      '<input type="range" id="tax-range" min="5" max="60" value="' + Math.round(p.taxRate * 100) + '"></div>';
    h += '<div class="hint">' + T('eco.taxHint') + '</div>';

    h += '<h3 class="sec">' + T('eco.breakdown') + '</h3>';
    h += row(T('k.revenue'), WC.fmtMoneyU(p.income));
    h += row(T('k.admin'), '-' + WC.fmtMoneyU(p.income * WC.CFG.ADMIN), 'neg');
    h += row(T('k.milSpend'), '-' + WC.fmtMoneyU(p.spent), 'neg');
    h += row(T('k.upkeep'), '-' + WC.fmtMoneyU(p.upkeep), 'neg');

    h += '<h3 class="sec">' + T('eco.territory') + '</h3>';
    h += row(T('k.homeOut'), WC.fmtMoneyU(gdpHome));
    h += row(T('k.occOut'), WC.fmtMoneyU(gdpTerr), gdpTerr > 0 ? 'pos' : '');
    h += row(T('k.avgInt'), WC.fmtPct(avgInt, 0));

    h += '<h3 class="sec">' + T('eco.infra') + '</h3>';
    h += row(T('k.investCost'), WC.fmtMoneyU(p.gdp * 0.006));
    h += '<div class="btn-row"><button class="btn-primary" data-act="invest"' +
      (p.treasury < p.gdp * 0.006 ? ' disabled' : '') +
      '>' + T('eco.invest') + '</button></div>';
    h += '<div class="hint">' + T('eco.investHint') + '</div>';
    return h;
  }

  function tabMilitary(p) {
    var cap = capOf(p);
    var h = headCard(p, statusTags(p));
    h += '<div class="stat-grid">' +
      statBox(T('k.army'), WC.fmtInt(p.army), 'gold') +
      statBox(T('mil.cap'), WC.fmtInt(cap), p.army > cap ? 'red' : 'green') +
      statBox(T('mil.share'), Math.round(p.milSpend * 100) + '%') +
      statBox(T('k.upkeep'), WC.fmtMoneyU(p.upkeep)) +
      '</div>';
    h += '<div class="bar-row"><div class="bar ' + (p.army > cap ? 'red' : '') + '"><i style="width:' +
      WC.clamp(cap > 0 ? p.army / cap * 100 : 0, 0, 100) + '%"></i></div>' +
      '<span class="num">' + (cap > 0 ? Math.round(p.army / cap * 100) : 0) + '%</span></div>';

    h += '<h3 class="sec">' + T('mil.alloc') + '</h3>';
    h += '<div class="slider-block"><div class="sl-head"><span>' + T('mil.shareLabel') + '</span><b id="mil-val">' +
      Math.round(p.milSpend * 100) + '%</b></div>' +
      '<input type="range" id="mil-range" min="0" max="90" value="' + Math.round(p.milSpend * 100) + '"></div>';
    h += '<div class="hint">' + T('mil.hint') + '</div>';

    h += '<h3 class="sec">' + T('mil.recruit') + '</h3>';
    h += row(T('k.unitPrice'), WC.fmtMoneyU(WC.CFG.RECRUIT_COST) + ' / ' + (WC.lang === 'zh' ? '师' : 'div.'));
    h += '<div class="btn-row">' +
      '<button class="btn-blue" data-act="recruit" data-val="10">' + T('mil.r10') + '</button>' +
      '<button class="btn-blue" data-act="recruit" data-val="50">' + T('mil.r50') + '</button>' +
      '</div>';

    var nb = neighborsOf(p.id).sort(function (a, b) { return b.army - a.army; }).slice(0, 8);
    h += '<h3 class="sec">' + T('mil.neighbors') + '</h3>';
    if (!nb.length) h += '<div class="hint">' + T('mil.noNeighbors') + '</div>';
    else h += nb.map(function (n) {
      var ratio = p.army / Math.max(1, n.army);
      return '<div class="rank-line' + (S.atWar(p.id, n.id) ? ' me' : '') + '">' +
        '<span class="rk">' + WC.flag(n.iso2) + '</span>' +
        '<span class="nm">' + esc(cname(n)) + '</span>' +
        '<span class="vv" style="color:' + (ratio >= 1 ? 'var(--green)' : 'var(--red)') + '">' +
        ratio.toFixed(2) + ' : 1</span></div>';
    }).join('');
    return h;
  }

  function tabTech(p) {
    var dev = devIndexOf(p);
    var pc = (p.gdp * 1e6) / Math.max(1, p.pop);
    var h = headCard(p, statusTags(p));
    h += '<h3 class="sec">' + T('tech.dev') + '</h3>';
    h += '<div style="font-family:var(--font-d);font-size:34px;font-weight:700;color:var(--gold)">' +
      Math.round(dev) + '<span style="font-size:15px;color:var(--txt-dim)"> / 100</span></div>';
    h += barRow(dev, 'gold');
    h += '<div class="hint">' + T('tech.devHint') + '</div>';

    h += '<h3 class="sec">' + T('tech.indicators') + '</h3>';
    h += row(T('k.gdpPerCapita'), WC.fmtMoneyU(pc / 1e6));
    h += row(T('k.popScale'), WC.fmtNum(p.pop));
    h += row(T('k.terrCount'), T('v.units', p.terrCount));

    h += '<h3 class="sec">' + T('tech.research') + '</h3>';
    h += row(T('k.investCost'), WC.fmtMoneyU(p.gdp * 0.006));
    h += '<div class="btn-row"><button class="btn-primary" data-act="invest"' +
      (p.treasury < p.gdp * 0.006 ? ' disabled' : '') + '>' + T('tech.fund') + '</button></div>';
    h += '<div class="hint">' + T('tech.fundHint') + '</div>';
    return h;
  }

  function tabDiplomacy(p) {
    var truces = [], targets = [];
    for (var i = 0; i < S.nations.length; i++) {
      var n = S.nations[i];
      if (!n.alive || n.id === p.id) continue;
      if (S.hasTruce(p.id, n.id) && !S.atWar(p.id, n.id)) truces.push(n);
      if (S.canDeclare(n.id) && S.isAdj(p.id, n.id)) targets.push(n);
    }
    truces.sort(function (a, b) { return (S.nation[p.id].truce[a.id] || 0) - (S.nation[p.id].truce[b.id] || 0); });
    targets.sort(function (a, b) { return (p.army / Math.max(1, a.army)) < (p.army / Math.max(1, b.army)) ? 1 : -1; });

    var h = headCard(p, statusTags(p));
    h += '<h3 class="sec">' + T('dip.posture') + '</h3>';
    h += row(T('k.neighbors'), neighborsOf(p.id).length);
    h += row(T('k.atWar'), S.warList(p.id).length);
    h += row(T('k.truces'), truces.length);
    h += row(T('k.alive'), aliveCount() + ' / ' + S.world.count);

    h += '<h3 class="sec">' + T('dip.truceList') + '</h3>';
    if (!truces.length) h += '<div class="hint">' + T('dip.noTruce') + '</div>';
    else h += truces.slice(0, 8).map(function (n) {
      var left = Math.max(0, (S.nation[p.id].truce[n.id] || 0) - S.day);
      return '<div class="rank-line"><span class="rk">' + WC.flag(n.iso2) + '</span>' +
        '<span class="nm">' + esc(cname(n)) + '</span>' +
        '<span class="vv" style="color:var(--purple)">' + T('v.days', left) + '</span></div>';
    }).join('');

    h += '<h3 class="sec">' + T('dip.targets') + '</h3>';
    if (!targets.length) h += '<div class="hint">' + T('dip.noTargets') + '</div>';
    else h += targets.slice(0, 8).map(function (n) {
      var ratio = p.army / Math.max(1, n.army);
      return '<div class="rank-line"><span class="rk">' + WC.flag(n.iso2) + '</span>' +
        '<span class="nm">' + esc(cname(n)) + '</span>' +
        '<span class="vv" style="color:' + (ratio >= 1.5 ? 'var(--green)' : 'var(--red)') + '">' + ratio.toFixed(2) + ':1</span>' +
        '<button class="btn-sm red" data-act="declare" data-val="' + n.id + '">' + T('act.declare') + '</button></div>';
    }).join('');
    h += '<div class="hint">' + T('dip.aiHint') + '</div>';
    return h;
  }

  function tabWars(p) {
    var mine = S.warList(p.id);
    var h = headCard(p, statusTags(p));
    h += '<h3 class="sec">' + T('war.mine') + '</h3>';
    if (!mine.length) h += '<div class="hint">' + T('war.peace') + '</div>';
    else h += mine.map(function (w) { return warCardHtml(w, p.id, true); }).join('');

    var others = [];
    for (var k in S.wars) {
      var w2 = S.wars[k];
      if (w2.a !== p.id && w2.b !== p.id) others.push(w2);
    }
    others.sort(function (a, b) { return b.days - a.days; });
    h += '<h3 class="sec">' + T('war.others') + '</h3>';
    if (!others.length) h += '<div class="hint">' + T('war.calm') + '</div>';
    else h += others.slice(0, 10).map(function (w) { return warCardHtml(w, p.id, false); }).join('');
    return h;
  }

  function tabRanking(p) {
    var metric = rankMetric;
    var arr = S.nations.filter(function (n) { return n.alive; }).sort(function (a, b) {
      return metric === 'gdp' ? b.gdp - a.gdp : S.nationalPower(b) - S.nationalPower(a);
    });
    var h = '<div class="btn-row" style="margin-top:0">' +
      '<button class="btn-sm' + (metric === 'power' ? ' gold' : '') + '" data-act="rank" data-val="power">' + T('rank.byPower') + '</button>' +
      '<button class="btn-sm' + (metric === 'gdp' ? ' gold' : '') + '" data-act="rank" data-val="gdp">' + T('rank.byGdp') + '</button>' +
      '</div>';
    h += '<h3 class="sec">' + T('rank.board') + '</h3>';
    h += arr.slice(0, 20).map(function (n, i) {
      var v = metric === 'gdp' ? WC.fmtMoneyU(n.gdp) : T('v.divisions', WC.fmtInt(n.army));
      return '<div class="rank-line' + (n.id === p.id ? ' me' : '') + '">' +
        '<span class="rk">' + (i + 1) + '</span>' +
        '<span class="nm">' + WC.flag(n.iso2) + ' ' + esc(cname(n)) + '</span>' +
        '<span class="vv">' + v + '</span></div>';
    }).join('');

    var st = S.worldStats();
    h += '<h3 class="sec">' + T('rank.world') + '</h3>';
    h += row(T('k.alive'), st.alive + ' / ' + S.world.count);
    h += row(T('k.worldGdp'), WC.fmtMoneyU(st.gdp));
    h += row(T('k.worldPop'), WC.fmtNum(st.pop));
    h += row(T('k.worldArmy'), T('v.divisions', WC.fmtInt(st.army)));
    h += row(T('k.myGdpShare'), WC.fmtPct(p.gdp / Math.max(1, st.gdp), 1), 'gold');
    return h;
  }

  function logHtml(limit) {
    if (!S.log.length) return '<div class="hint">' + T('log.empty') + '</div>';
    return S.log.slice(0, limit).map(function (l) {
      var txt = l.key ? WC.tr(l.key, l.args) : l.text;
      return '<div class="log-line ' + l.type + '"><time>' + WC.fmtDayMonth(l.day) + '</time>' +
        '<span>' + esc(txt) + '</span></div>';
    }).join('');
  }

  function warCardHtml(w, pid, withActions) {
    var A = S.nation[w.a], B = S.nation[w.b];
    if (!A || !B) return '';
    var ta = Math.max(0, A.army), tb = Math.max(0, B.army);
    var pa = Math.round(ta / Math.max(1, ta + tb) * 100);
    var mine = (w.a === pid || w.b === pid);
    var enemyId = w.a === pid ? w.b : w.a;
    var ft = '<span>' + WC.fmtInt(ta) + ' : ' + WC.fmtInt(tb) + '</span>';
    if (withActions && mine) {
      ft += '<span><button class="btn-sm gold" data-act="attack" data-val="' + enemyId + '">' + T('act.attack') + '</button> ' +
        '<button class="btn-sm" data-act="peace" data-val="' + enemyId + '">' + T('act.peace') + '</button></span>';
    } else {
      ft += '<span>' + T('v.days', w.days) + '</span>';
    }
    return '<div class="war-card' + (mine ? ' mine' : '') + '">' +
      '<div class="wc-top"><span>' + WC.flag(A.iso2) + ' ' + esc(cname(A)) +
      ' <span class="vs">' + T('war.vs') + '</span> ' + WC.flag(B.iso2) + ' ' + esc(cname(B)) + '</span>' +
      '<span class="wc-day">' + T('war.day', w.days) + '</span></div>' +
      '<div class="power-bar"><i class="side-a" style="width:' + pa + '%"></i>' +
      '<i class="side-b" style="width:' + (100 - pa) + '%"></i></div>' +
      '<div class="wc-ft">' + ft + '</div></div>';
  }

  // ---------------- 面板事件委托 ----------------
  function bindPanelDelegates() {
    $('panel-body').addEventListener('click', onPanelClick);
    $('cp-body').addEventListener('click', onPanelClick);
    $('battle-list').addEventListener('click', onPanelClick);

    function onPanelClick(e) {
      var b = e.target.closest ? e.target.closest('[data-act]') : null;
      if (!b) return;
      var act = b.getAttribute('data-act');
      var val = b.getAttribute('data-val');
      var p = S.player();
      if (!p) return;

      if (act === 'rank') { rankMetric = val; refreshPanel(true); }
      else if (act === 'invest') { doInvest(); }
      else if (act === 'recruit') { doRecruit(parseInt(val, 10)); }
      else if (act === 'declare') { confirmDeclare(val); }
      else if (act === 'attack') { doAttack(val); }
      else if (act === 'peace') { requestPeace(val); }
      else if (act === 'focus') { if (val) { UI.select(val); WC.Map.focus(val, 2.6); } }
      else if (act === 'closecp') { UI.select(null); }
    }

    // 滑杆
    $('panel-body').addEventListener('input', function (e) {
      var t = e.target;
      if (!t || t.tagName !== 'INPUT') return;
      if (t.id === 'tax-range') {
        S.setTax(parseInt(t.value, 10) / 100);
        $('tax-val').textContent = t.value + '%';
      } else if (t.id === 'mil-range') {
        S.setMilSpend(parseInt(t.value, 10) / 100);
        $('mil-val').textContent = t.value + '%';
      }
    });
  }

  function refreshPanel(force) {
    if (force) lastPanelAt = 0;
    if ($('panel').classList.contains('hidden')) return;
    if (uiLock > 0) return;
    var now = Date.now();
    if (!force && now - lastPanelAt < 700) return;
    lastPanelAt = now;
    var focused = document.activeElement;
    if (focused && focused.closest && focused.closest('#panel-body') &&
      focused.tagName === 'INPUT') return;
    $('panel-body').innerHTML = renderTab(activeTab);
  }

  // ---------------- 玩家动作 ----------------
  function doInvest() {
    var p = S.player();
    if (p.treasury < p.gdp * 0.006) { UI.toast(T('toast.infraPoor'), 'bad'); return; }
    S.invest();
    refreshPanel(true);
    UI.render(true);
  }

  function doRecruit(n) {
    var p = S.player();
    var cost = n * WC.CFG.RECRUIT_COST;
    if (p.treasury < cost) {
      UI.toast(T('toast.recruitPoor', { money: cost }), 'bad');
      return;
    }
    S.recruit(n);
    UI.toast(T('toast.recruitOk', n), 'good');
    refreshPanel(true);
    UI.render(true);
  }

  function doAttack(enemyId) {
    var p = S.player(), e = S.nation[enemyId];
    if (!e || !e.alive) { UI.toast(T('toast.noNation'), 'bad'); return; }
    var t = bestTarget(p, e);
    if (!t) { UI.toast(T('toast.noTarget'), 'bad'); return; }
    S.setOffensive(p.id, t.id);
    UI.toast(T('toast.attackOrder', t.id, e, S.byId[t.id]), 'war');
    refreshPanel(true);
    UI.render(true);
  }

  function requestPeace(enemyId) {
    var p = S.player(), e = S.nation[enemyId];
    var war = S.getWar(p.id, enemyId);
    if (!war || !e) return;
    var enemyWinning = e.army > p.army * 1.3 && war.days < 180 && e.stability > 40;
    if (enemyWinning) {
      UI.toast(T('toast.peaceRefused', e), 'bad');
      return;
    }
    S.makePeace(p.id, enemyId, false);
    UI.toast(T('toast.peaceOk', e), 'peace');
    refreshPanel(true);
    UI.render(true);
  }

  function confirmDeclare(targetId) {
    var p = S.player(), e = S.nation[targetId];
    if (!e || !S.canDeclare(targetId)) return;
    openModal(T('dlg.declareTitle'),
      '<div class="row"><span class="k">' + T('k.target') + '</span><span class="v">' + WC.flag(e.iso2) + ' ' + esc(cname(e)) + '</span></div>' +
      '<div class="row"><span class="k">' + T('k.theirArmy') + '</span><span class="v">' + WC.fmtInt(e.army) + '</span></div>' +
      '<div class="row"><span class="k">' + T('k.ourArmy') + '</span><span class="v">' + WC.fmtInt(p.army) + '</span></div>' +
      '<div class="row"><span class="k">' + T('k.ratio') + '</span><span class="v ' + (p.army >= e.army ? 'pos' : 'neg') + '">' +
      (p.army / Math.max(1, e.army)).toFixed(2) + ' : 1</span></div>' +
      '<div class="hint">' + T('dlg.declareHint') + '</div>',
      [
        { act: 'close', label: T('btn.cancel'), cls: 'btn-ghost' },
        { act: 'dowar', label: T('act.declare'), cls: 'btn-danger' }
      ],
      function (act) {
        if (act !== 'dowar') return;
        S.declareWar(p.id, e.id, false);
        UI.toast(T('toast.declared', e), 'war');
        closeModal();
        refreshPanel(true);
        UI.render(true);
      });
  }

  // ================================================================
  //  右侧国家面板
  // ================================================================
  UI.select = function (id) {
    selectedId = id;
    WC.Map.setSelected(id);
    renderCountryPanel();
  };
  UI.getSelected = function () { return selectedId; };

  function renderCountryPanel() {
    var box = $('cp-body'), panel = $('cpanel');
    if (!selectedId) { panel.classList.add('hidden'); return; }
    var c = S.byId[selectedId], t = S.terr[selectedId];
    if (!c || !t) { panel.classList.add('hidden'); return; }
    panel.classList.remove('hidden');

    var p = S.player();
    var owner = S.nation[t.ownerId];
    var isMine = p && t.ownerId === p.id;
    $('cp-title').textContent = isMine ? T('cp.mine') : T('cp.target');

    var h = '<div style="display:flex;align-items:center;gap:10px">' +
      '<span style="font-size:30px;line-height:1">' + WC.flag(c.iso2) + '</span>' +
      '<div style="min-width:0">' +
      '<div style="font-family:var(--font-d);font-weight:700;font-size:18px">' + esc(cname(c)) + '</div>' +
      '<div style="color:var(--txt-dim);font-size:11.5px">' + esc(WC.lang === 'zh' ? c.name : c.zh) + ' · ' + esc(c.continent) + '</div>' +
      '</div></div>';
    h += '<div style="margin-top:8px">' + tagHtml(t.ownerId) + '</div>';

    h += '<h3 class="sec">' + T('cp.data') + '</h3>';
    h += row('GDP', WC.fmtMoneyU(t.baseGdp * t.integration));
    h += row(T('k.pop'), WC.fmtNum(t.basePop * t.integration));
    h += row(T('k.worldGdpShare'), WC.fmtPct(t.baseGdp / Math.max(1, S.world.gdp), 2));
    h += row(T('k.integration'), WC.fmtPct(t.integration, 0));

    if (!isMine && owner) {
      h += '<h3 class="sec">' + T('cp.controller') + '</h3>';
      h += row(T('k.owner'), WC.flag(owner.iso2) + ' ' + esc(cname(owner)));
      h += row(T('k.itsArmy'), WC.fmtInt(owner.army));
      h += row(T('k.itsStab'), Math.round(owner.stability));
      h += row(T('k.itsGdp'), WC.fmtMoneyU(owner.gdp));
      h += row(T('k.forceRatio'), p ? (p.army / Math.max(1, owner.army)).toFixed(2) + ' : 1' : '—',
        p && p.army >= owner.army ? 'pos' : 'neg');
      h += row(T('k.landBorder'), p && S.isAdj(p.id, t.id) ? T('v.landYes') : T('v.landNo'));
    }

    // 行动
    var acts = '<div class="btn-row"><button class="btn-ghost" data-act="focus" data-val="' + selectedId + '">' + T('act.locate') + '</button>';
    if (p && !isMine && owner) {
      var war = S.getWar(p.id, t.ownerId);
      if (war) {
        acts += '<button class="btn-primary" data-act="attack" data-val="' + t.ownerId + '">' + T('cp.attackHere') + '</button>';
        acts += '<button class="btn-ghost" data-act="peace" data-val="' + t.ownerId + '">' + T('cp.offerTruce') + '</button>';
      } else if (S.canDeclare(t.ownerId)) {
        acts += '<button class="btn-danger" data-act="declare" data-val="' + t.ownerId + '">' + T('cp.declareOn', cname(owner)) + '</button>';
      } else {
        acts += '<button class="btn-ghost" disabled>' + T('cp.inTruce') + '</button>';
      }
    }
    acts += '</div>';
    h += acts;

    box.innerHTML = h;
  }

  // ================================================================
  //  战况 HUD
  // ================================================================
  function renderBattleHud() {
    var p = S.player();
    var hud = $('battlehud');
    if (!p) { hud.classList.add('hidden'); return; }
    hud.classList.remove('hidden');

    var mine = S.warList(p.id);
    var html = '';
    if (mine.length) {
      html = mine.slice(0, 6).map(function (w) { return warCardHtml(w, p.id, true); }).join('');
    } else {
      var others = [];
      for (var k in S.wars) {
        var w = S.wars[k];
        if (w.a !== p.id && w.b !== p.id) others.push(w);
      }
      others.sort(function (a, b) { return b.days - a.days; });
      if (!others.length) {
        html = '<div class="hint" style="padding:2px 2px 6px">' + T('hud.worldCalm') + '</div>';
      } else {
        html = '<div class="hint" style="padding:2px 2px 4px">' + T('hud.atPeace') + '</div>' +
          others.slice(0, 4).map(function (w) { return warCardHtml(w, p.id, false); }).join('');
      }
    }
    $('battle-list').innerHTML = html;
  }

  // ================================================================
  //  地图
  // ================================================================
  function bindMap() {
    var tip = $('maptip');
    WC.Map.init($('map'), {
      onClick: function (id) {
        if (id) { UI.select(id); UI.render(true); }
        else UI.select(null);
      },
      onHover: function (id, e) {
        if (!id) { tip.classList.add('hidden'); return; }
        var c = S.byId[id], t = S.terr[id], o = S.nation[t.ownerId];
        var p = S.player();
        var extra = '';
        if (p) {
          if (t.ownerId === p.id) extra = ' · <b>' + T('tip.mine') + '</b>';
          else if (S.atWar(p.id, t.ownerId)) extra = ' · <b style="color:#ffa8b6">' + T('tip.atWar') + '</b>';
        }
        tip.innerHTML = WC.flag(c.iso2) + ' <b>' + esc(cname(c)) + '</b>' +
          (t.ownerId !== id && o ? ' <span style="color:#98a8bb">' + (WC.lang === 'zh' ? '（' : ' (') + esc(cname(o)) + (WC.lang === 'zh' ? '）' : ')') + '</span>' : '') + extra;
        tip.classList.remove('hidden');
        tip.style.left = e.clientX + 'px';
        tip.style.top = e.clientY + 'px';
      }
    });

    var svg = $('map');
    svg.addEventListener('dblclick', function (e) {
      var id = e.target && e.target.getAttribute ? e.target.getAttribute('data-id') : null;
      if (id) WC.Map.focus(id, 2.6);
    });
    svg.addEventListener('pointerleave', function () {
      tip.classList.add('hidden');
      if (!uiLock) UI.render(true); // 保持面板同步
    });
    svg.addEventListener('pointerdown', function () { tip.classList.add('hidden'); });

    $('btnZoomIn').onclick = function () { WC.Map.zoomBy(1.5); };
    $('btnZoomOut').onclick = function () { WC.Map.zoomBy(1 / 1.5); };
    $('btnFitWorld').onclick = function () { WC.Map.fitWorld(); };
    $('btnHome').onclick = function () {
      var p = S.player();
      if (p) { UI.select(p.id); WC.Map.focus(p.id, 2.6); }
    };

    window.addEventListener('resize', function () { WC.Map.onResize(); });
  }

  // ---------------- 键盘 ----------------
  function bindKeyboard() {
    window.addEventListener('keydown', function (e) {
      if (e.target && /INPUT|TEXTAREA/.test(e.target.tagName)) return;
      if (!S.playerId) return;
      if (e.code === 'Space') { e.preventDefault(); setSpeed(S.speed > 0 ? 0 : 1); return; }
      if (e.key === '1') setSpeed(1);
      else if (e.key === '2') setSpeed(2);
      else if (e.key === '3') setSpeed(4);
      else if (e.key === 'Escape') {
        if (!$('modal-layer').classList.contains('hidden')) closeModal();
        else if (!$('cpanel').classList.contains('hidden')) UI.select(null);
        else closePanel();
      }
    });
  }

  // ================================================================
  //  提示气泡 / Toast / 模态
  // ================================================================
  function showTip(text, x, y) {
    var el = $('tooltip');
    el.textContent = text;
    el.classList.remove('hidden');
    moveTip(x, y);
  }
  function moveTip(x, y) {
    var el = $('tooltip');
    if (el.classList.contains('hidden')) return;
    var w = el.offsetWidth, h = el.offsetHeight;
    var left = Math.min(x + 12, window.innerWidth - w - 10);
    var top = y + 18;
    if (top + h > window.innerHeight - 8) top = y - h - 12;
    el.style.left = Math.max(8, left) + 'px';
    el.style.top = Math.max(8, top) + 'px';
  }
  function hideTip() { $('tooltip').classList.add('hidden'); }

  UI.toast = function (text, type) {
    var wrap = $('toasts');
    var d = document.createElement('div');
    d.className = 'toast ' + (type || 'info');
    d.textContent = text;
    wrap.appendChild(d);
    while (wrap.children.length > 4) wrap.removeChild(wrap.firstChild);
    setTimeout(function () {
      d.classList.add('out');
      setTimeout(function () { if (d.parentNode) d.parentNode.removeChild(d); }, 320);
    }, 3800);
  };

  var modalHandler = null;

  function openModal(title, body, actions, handler) {
    $('modal-title').textContent = title;
    $('modal-body').innerHTML = body;
    $('modal-actions').innerHTML = (actions || []).map(function (a) {
      return '<button class="' + (a.cls || 'btn-ghost') + '" data-mact="' + a.act + '">' + a.label + '</button>';
    }).join('');
    modalHandler = handler || null;
    $('modal-layer').classList.remove('hidden');
  }
  function closeModal() {
    $('modal-layer').classList.add('hidden');
    $('modal-actions').innerHTML = '';
    $('modal-body').innerHTML = '';
    modalHandler = null;
  }

  // ================================================================
  //  结局
  // ================================================================
  function renderEnd() {
    var o = S.over, p = S.player();
    if (!o || !p || endShown) return;
    endShown = true;
    $('end-title').textContent = o.win ? T('end.win') : T('end.lose');
    $('end-text').textContent = o.key ? WC.tr(o.key, o.args) : (o.text || '');
    var share = p.gdp / Math.max(1, S.worldGdpNow());
    $('end-stats').innerHTML =
      '<div class="es"><em>' + T('es.days') + '</em><b>' + S.day + '</b></div>' +
      '<div class="es"><em>' + T('es.terr') + '</em><b>' + p.terrCount + '</b></div>' +
      '<div class="es"><em>' + T('es.gdpShare') + '</em><b>' + WC.fmtPct(share, 1) + '</b></div>' +
      '<div class="es"><em>' + T('es.army') + '</em><b>' + WC.fmtInt(p.army) + '</b></div>';
    $('endscreen').classList.remove('hidden');
    S.speed = 0;
    highlightSpeed(0);
  }

  // ================================================================
  //  渲染入口
  // ================================================================
  UI.render = function (force) {
    var p = S.player();
    if (!p) return;
    trackSnap(p);
    renderTopbar();

    var now = Date.now();
    if (force || now - lastRankAt > 800) {
      lastRankAt = now;
      refreshPanel(false);
      renderCountryPanel();
      renderBattleHud();
      updateBadges();
    }
    if (force || (lastLogDay !== S.day && now - lastLogAt > 600)) {
      lastLogAt = now;
      lastLogDay = S.day;
      if (activeTab === 'overview' && force) refreshPanel(true);
    }
    if (S.over) renderEnd();
  };

  function updateBadges() {
    var p = S.player();
    if (!p) return;
    var wars = S.warList(p.id).length;
    var wb = $('war-badge');
    wb.textContent = wars;
    wb.classList.toggle('hidden', wars === 0);
  }

  /** 语言切换后全量重绘动态界面 */
  UI.refreshLang = function () {
    if (!$('startscreen').classList.contains('hidden')) {
      buildStartList($('ss-search') ? $('ss-search').value : '');
      if (pickedId) markPicked(pickedId);
    }
    var p = S.player();
    if (!p) return;
    renderTopbar();
    if (!$('panel').classList.contains('hidden')) {
      $('panel-title').textContent = T(TAB_TITLES[activeTab] || activeTab);
      $('panel-body').innerHTML = renderTab(activeTab);
      lastPanelAt = Date.now();
    }
    renderCountryPanel();
    renderBattleHud();
    updateBadges();
    if (S.over) { endShown = false; renderEnd(); }
  };

  // 模态层按钮
  UI._bindModal = function () {
    $('modal-actions').addEventListener('click', function (e) {
      var b = e.target.closest ? e.target.closest('[data-mact]') : null;
      if (!b) return;
      var act = b.getAttribute('data-mact');
      if (act === 'close') { closeModal(); return; }
      if (act === 'restart') { window.location.reload(); return; }
      if (modalHandler) modalHandler(act);
    });

    // 菜单里的语言切换按钮
    $('modal-body').addEventListener('click', function (e) {
      var b = e.target.closest ? e.target.closest('[data-mlang]') : null;
      if (!b) return;
      var code = b.getAttribute('data-mlang');
      if (code === WC.lang) return;
      WC.i18n.set(code);
      openMenu();
    });
  };
  UI._bindModal();

  window.WC.UI = UI;
})(window.WC);
