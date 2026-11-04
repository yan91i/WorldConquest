/* 国际化：中英双语文案、占位符替换、静态 DOM 回填、语言切换 */
(function (WC) {
  'use strict';

  var DICT = {
    zh: {
      // 标签栏
      'tab.overview': '概览',
      'tab.economy': '经济',
      'tab.military': '军事',
      'tab.tech': '科技',
      'tab.diplomacy': '外交',
      'tab.wars': '战争',
      'tab.ranking': '排行',
      // 顶栏提示
      'tip.treasury': '国库',
      'tip.gdp': '国内生产总值',
      'tip.pop': '人口',
      'tip.army': '常备兵力',
      'tip.stability': '稳定度',
      'tip.infamy': '恶名：越高越容易招致围剿',
      'tip.domination': '世界统治度',
      'speed.pause': '暂停 (空格)',
      'speed.slow': '慢速',
      'speed.normal': '正常 (1)',
      'speed.fast': '快速 (2)',
      'speed.fastest': '极快 (3)',
      'btn.sound': '音效',
      'btn.menu': '菜单',
      'btn.collapse': '收起',
      'btn.close': '关闭',
      'btn.cancel': '取消',
      'btn.restart': '重新开始',
      // 地图控件 / 战况
      'hud.battle': '战况',
      'map.zoomIn': '放大',
      'map.zoomOut': '缩小',
      'map.world': '全球视角',
      'map.home': '定位本国',
      // 开始界面
      'start.hint': '选择一个国家开始游戏：发展经济、扩充军备、征服整个世界。',
      'start.search': '搜索国家（中文 / English / 代码）…',
      'start.pick': '选择国家',
      'start.gdpSort': '按 GDP 排序',
      'start.random': '随机国家',
      'start.army': '兵力 {0}',
      'start.found': '找到 {0} 个国家',
      'start.all': '按 GDP 排序 · 共 {0} 个国家，可搜索全部',
      'start.empty': '没有匹配的国家。',
      'start.detail': ' · GDP {0} · 人口 {1} · 初始兵力 {2}',
      'start.welcome': '你已执掌 {0}，开始征服世界吧！',
      'loading': '正在构建世界…',
      // 菜单
      'menu.title': '菜单',
      'menu.nation': '国家',
      'menu.date': '日期',
      'menu.language': '语言',
      'menu.hint': '操作提示：滚轮缩放、拖拽平移、点击国家查看详情；空格暂停，1/2/3 切换速度。',
      'menu.continue': '继续游戏',
      'sound.placeholder': '当前版本未包含音频资源，音效开关仅为界面占位。',
      // 概览
      'ov.title': '国力一览',
      'k.treasury': '国库',
      'k.army': '常备兵力',
      'k.stability': '稳定度',
      'k.territories': '控制政权',
      'k.finance': '财政',
      'k.revenue': '日均税收',
      'k.admin': '行政开支',
      'k.milSpend': '军费支出',
      'k.balance': '日均结余',
      'k.standing': '世界地位',
      'k.gdpShare': 'GDP 占比',
      'k.terrShare': '政权占比',
      'k.armyRank': '兵力排名',
      'k.gdpRank': '经济排名',
      'k.infamy': '恶名',
      'k.events': '最近事件',
      'v.rank': '第 {0} / {1}',
      // 经济
      'eco.balance': '收支',
      'k.gdp': '国内生产总值',
      'k.gdpPerCapita': '人均 GDP',
      'k.pop': '人口',
      'eco.tax': '税制',
      'k.taxRate': '税率',
      'eco.taxHint': '税率越高短期收入越多，但会持续压低稳定度。',
      'eco.breakdown': '经济构成',
      'k.upkeep': '军队维护',
      'eco.territory': '疆域经济',
      'k.homeOut': '本土产出',
      'k.occOut': '占领区产出',
      'k.avgInt': '平均整合度',
      'eco.infra': '基建',
      'k.investCost': '投资成本',
      'eco.invest': '投资基础设施',
      'eco.investHint': '每次投资使本土经济产出永久提升约 1.2%。',
      // 军事
      'mil.cap': '可维持上限',
      'mil.share': '军费占比',
      'mil.alloc': '军费分配',
      'mil.shareLabel': '财政中军费占比',
      'mil.hint': '占比越高，国库盈余会自动转化为新部队；低于维护费时兵力萎缩。',
      'mil.recruit': '紧急征兵',
      'k.unitPrice': '单价',
      'mil.r10': '征召 ×10',
      'mil.r50': '征召 ×50',
      'mil.neighbors': '接壤国家军力',
      'mil.noNeighbors': '你没有陆地接壤的邻国。',
      // 科技
      'tech.dev': '发展指数',
      'tech.devHint': '发展指数由人均经济产出推导，代表工业化与技术水平。',
      'tech.indicators': '指标',
      'k.popScale': '人口规模',
      'k.terrCount': '领土数量',
      'v.units': '{0} 个单位',
      'tech.research': '科研投入',
      'tech.fund': '投入基建 / 科研',
      'tech.fundHint': '基建投入会提升本土经济产出，进而推高发展指数。',
      // 外交
      'dip.posture': '外交态势',
      'k.neighbors': '接壤国家',
      'k.atWar': '交战国',
      'k.truces': '停战条约',
      'k.alive': '存活政权',
      'dip.truceList': '停战期内的国家',
      'dip.noTruce': '当前没有停战协定。',
      'v.days': '{0} 天',
      'dip.targets': '可宣战的接壤邻国',
      'dip.noTargets': '暂时没有可宣战的目标。',
      'act.declare': '宣战',
      'dip.aiHint': '只有当对方兵力远低于你时，AI 才会认为进攻有利。',
      // 战争
      'war.mine': '我的战事',
      'war.peace': '你目前处于和平状态。',
      'war.others': '世界其他战事',
      'war.calm': '世界其他地区暂时太平。',
      'war.vs': '对',
      'war.day': '第 {0} 天',
      'act.attack': '进攻',
      'act.peace': '求和',
      // 排行
      'rank.byPower': '按国力',
      'rank.byGdp': '按 GDP',
      'rank.board': '列强榜',
      'v.divisions': '{0} 师',
      'rank.world': '世界统计',
      'k.worldGdp': '世界 GDP',
      'k.worldPop': '世界人口',
      'k.worldArmy': '世界兵力',
      'k.myGdpShare': '我的 GDP 占比',
      // 日志 / 标签
      'log.empty': '暂无事件记录。',
      'tag.mine': '你的领土',
      'tag.war': '交战中',
      'tag.truce': '停战中',
      'tag.neutral': '中立',
      'tip.mine': '你的领土',
      'tip.atWar': '交战中',
      'st.atWar': '交战中 {0}',
      'st.peace': '和平',
      'st.terr': '疆域 {0}',
      // 顶栏动态
      'tb.cap': '上限 {0}',
      'tb.perDay': '/日',
      'tb.victory': '胜利线 75%',
      // 国家面板
      'cp.mine': '本国领土',
      'cp.target': '目标地区',
      'cp.data': '地区数据',
      'k.worldGdpShare': '世界 GDP 占比',
      'k.integration': '整合度',
      'cp.controller': '控制方',
      'k.owner': '所属政权',
      'k.itsArmy': '其兵力',
      'k.itsStab': '其稳定度',
      'k.itsGdp': '其 GDP',
      'k.forceRatio': '与我军力比',
      'k.landBorder': '陆地接壤',
      'v.landYes': '是（可正面进攻）',
      'v.landNo': '否（跨海，战力 -50%）',
      'act.locate': '定位',
      'cp.attackHere': '进攻此地区',
      'cp.offerTruce': '提议停战',
      'cp.declareOn': '向 {0} 宣战',
      'cp.inTruce': '停战期内',
      // 战况 HUD
      'hud.worldCalm': '世界暂时太平。',
      'hud.atPeace': '你处于和平状态，以下是世界各地的战事：',
      // toast
      'toast.infraPoor': '国库不足，无法进行基建投资。',
      'toast.recruitPoor': '国库不足，需要 {0}。',
      'toast.recruitOk': '紧急征召 {0} 个师。',
      'toast.noNation': '该国已不复存在。',
      'toast.noTarget': '没有可进攻的目标。',
      'toast.attackOrder': '已下令进攻 {0} 地区的 {1}（{2}）。',
      'toast.peaceRefused': '{0} 拒绝了停战请求，他们认为胜券在握。',
      'toast.peaceOk': '你与 {0} 达成和约，战线冻结。',
      'toast.declared': '你已向 {0} 宣战！',
      // 宣战确认
      'dlg.declareTitle': '宣战确认',
      'k.target': '目标',
      'k.theirArmy': '其兵力',
      'k.ourArmy': '我军兵力',
      'k.ratio': '军力比',
      'dlg.declareHint': '宣战会降低双方稳定度，并冻结 3 年的停战期。',
      // 结局
      'end.win': '🌍 世界已被征服',
      'end.lose': '💀 帝国陨落',
      'es.days': '执政天数',
      'es.terr': '控制政权',
      'es.gdpShare': '全球 GDP 占比',
      'es.army': '兵力',
      // 事件日志
      'log.lead': '你成为了 {0} 的领袖，世界正等待被征服。',
      'log.declare': '⚔️ {0} 向 {1} 宣战！',
      'log.peace': '🕊️ {0} 与 {1} 缔结和约。',
      'log.capture': '🚩 {0} 攻占了 {1}（原属{2}）',
      'log.repelled': '⛔ 对 {0} 的攻势被击退，我军损失惨重。',
      'log.annexWar': '💀 {0} 全面崩溃，已被 {1} 吞并！',
      'log.annex': '💀 {0} 被 {1} 吞并。',
      'log.revoltFree': '🔥 {0} 爆发叛乱，重新独立！',
      'log.revoltLeave': '🔥 {0} 爆发叛乱，脱离你的统治！',
      'log.recruit': '🪖 紧急征召 {0} 个师，花费 {1}。',
      'log.invest': '🏗️ 投资基础设施建设，花费 {0}，经济产出提升。',
      'end.loseText': '你的国家已被彻底吞并，征服之路就此终结。',
      'end.winText': '你控制了全球 {0} 的政权与 {1} 的经济产出，世界已被征服！'
    },

    en: {
      'tab.overview': 'Overview',
      'tab.economy': 'Economy',
      'tab.military': 'Military',
      'tab.tech': 'Technology',
      'tab.diplomacy': 'Diplomacy',
      'tab.wars': 'Wars',
      'tab.ranking': 'Ranking',
      'tip.treasury': 'Treasury',
      'tip.gdp': 'Gross Domestic Product',
      'tip.pop': 'Population',
      'tip.army': 'Standing Army',
      'tip.stability': 'Stability',
      'tip.infamy': 'Infamy: the higher it is, the more likely a coalition forms',
      'tip.domination': 'World Domination',
      'speed.pause': 'Pause (Space)',
      'speed.slow': 'Slow',
      'speed.normal': 'Normal (1)',
      'speed.fast': 'Fast (2)',
      'speed.fastest': 'Fastest (3)',
      'btn.sound': 'Sound',
      'btn.menu': 'Menu',
      'btn.collapse': 'Collapse',
      'btn.close': 'Close',
      'btn.cancel': 'Cancel',
      'btn.restart': 'Restart',
      'hud.battle': 'Battlefront',
      'map.zoomIn': 'Zoom in',
      'map.zoomOut': 'Zoom out',
      'map.world': 'World view',
      'map.home': 'Locate home',
      'start.hint': 'Pick a nation to begin: grow the economy, build up the army, and conquer the world.',
      'start.search': 'Search nations (English / 中文 / code)…',
      'start.pick': 'Choose a nation',
      'start.gdpSort': 'Sorted by GDP',
      'start.random': 'Random nation',
      'start.army': 'Army {0}',
      'start.found': 'Found {0} nations',
      'start.all': 'Sorted by GDP · {0} nations in total, search to find any',
      'start.empty': 'No matching nations.',
      'start.detail': ' · GDP {0} · Pop {1} · Initial army {2}',
      'start.welcome': 'You now lead {0}. Time to conquer the world!',
      'loading': 'Building the world…',
      'menu.title': 'Menu',
      'menu.nation': 'Nation',
      'menu.date': 'Date',
      'menu.language': 'Language',
      'menu.hint': 'Controls: scroll to zoom, drag to pan, click a nation for details; Space pauses, 1/2/3 change speed.',
      'menu.continue': 'Resume',
      'sound.placeholder': 'Audio assets are not included in this build; the sound toggle is only decorative.',
      'ov.title': 'Nation Overview',
      'k.treasury': 'Treasury',
      'k.army': 'Standing Army',
      'k.stability': 'Stability',
      'k.territories': 'Territories Held',
      'k.finance': 'Finances',
      'k.revenue': 'Daily Revenue',
      'k.admin': 'Administration',
      'k.milSpend': 'Military Spending',
      'k.balance': 'Daily Balance',
      'k.standing': 'World Standing',
      'k.gdpShare': 'GDP Share',
      'k.terrShare': 'Territory Share',
      'k.armyRank': 'Army Rank',
      'k.gdpRank': 'Economy Rank',
      'k.infamy': 'Infamy',
      'k.events': 'Recent Events',
      'v.rank': '#{0} / {1}',
      'eco.balance': 'Cash Flow',
      'k.gdp': 'GDP',
      'k.gdpPerCapita': 'GDP per Capita',
      'k.pop': 'Population',
      'eco.tax': 'Taxation',
      'k.taxRate': 'Tax Rate',
      'eco.taxHint': 'Higher taxes raise short-term revenue but keep dragging stability down.',
      'eco.breakdown': 'Economy Breakdown',
      'k.upkeep': 'Army Upkeep',
      'eco.territory': 'Territory Economy',
      'k.homeOut': 'Home Output',
      'k.occOut': 'Occupied Output',
      'k.avgInt': 'Average Integration',
      'eco.infra': 'Infrastructure',
      'k.investCost': 'Investment Cost',
      'eco.invest': 'Invest in Infrastructure',
      'eco.investHint': 'Each investment permanently raises home output by about 1.2%.',
      'mil.cap': 'Sustainable Cap',
      'mil.share': 'Military Share',
      'mil.alloc': 'Military Budget',
      'mil.shareLabel': 'Military Share of Budget',
      'mil.hint': 'A higher share turns treasury surplus into new units; below upkeep your army shrinks.',
      'mil.recruit': 'Emergency Recruitment',
      'k.unitPrice': 'Unit Price',
      'mil.r10': 'Recruit ×10',
      'mil.r50': 'Recruit ×50',
      'mil.neighbors': 'Neighbor Forces',
      'mil.noNeighbors': 'You have no land neighbors.',
      'tech.dev': 'Development Index',
      'tech.devHint': 'The development index is derived from GDP per capita, reflecting industry and technology.',
      'tech.indicators': 'Indicators',
      'k.popScale': 'Population',
      'k.terrCount': 'Territories',
      'v.units': '{0} territories',
      'tech.research': 'Research Investment',
      'tech.fund': 'Fund Infrastructure / Research',
      'tech.fundHint': 'Infrastructure spending raises home output, which in turn lifts the development index.',
      'dip.posture': 'Diplomatic Posture',
      'k.neighbors': 'Neighbors',
      'k.atWar': 'At War',
      'k.truces': 'Truces',
      'k.alive': 'Nations Alive',
      'dip.truceList': 'Nations in Truce',
      'dip.noTruce': 'No active truces.',
      'v.days': '{0} days',
      'dip.targets': 'Neighbors Available for War',
      'dip.noTargets': 'No valid targets right now.',
      'act.declare': 'Declare War',
      'dip.aiHint': 'The AI only considers an attack worthwhile when it holds a clear advantage.',
      'war.mine': 'My Wars',
      'war.peace': 'You are currently at peace.',
      'war.others': 'Other Conflicts',
      'war.calm': 'The rest of the world is quiet.',
      'war.vs': 'vs',
      'war.day': 'Day {0}',
      'act.attack': 'Attack',
      'act.peace': 'Sue for Peace',
      'rank.byPower': 'By Power',
      'rank.byGdp': 'By GDP',
      'rank.board': 'Great Powers',
      'v.divisions': '{0} div.',
      'rank.world': 'World Statistics',
      'k.worldGdp': 'World GDP',
      'k.worldPop': 'World Population',
      'k.worldArmy': 'World Army',
      'k.myGdpShare': 'My GDP Share',
      'log.empty': 'No events yet.',
      'tag.mine': 'Your territory',
      'tag.war': 'At war',
      'tag.truce': 'In truce',
      'tag.neutral': 'Neutral',
      'tip.mine': 'Your territory',
      'tip.atWar': 'At war',
      'st.atWar': 'At war {0}',
      'st.peace': 'Peace',
      'st.terr': 'Territories {0}',
      'tb.cap': 'Cap {0}',
      'tb.perDay': '/day',
      'tb.victory': 'Victory line 75%',
      'cp.mine': 'Your Territory',
      'cp.target': 'Target Region',
      'cp.data': 'Region Data',
      'k.worldGdpShare': 'World GDP Share',
      'k.integration': 'Integration',
      'cp.controller': 'Controlled By',
      'k.owner': 'Owner',
      'k.itsArmy': 'Its Army',
      'k.itsStab': 'Its Stability',
      'k.itsGdp': 'Its GDP',
      'k.forceRatio': 'Force Ratio',
      'k.landBorder': 'Land Border',
      'v.landYes': 'Yes (direct assault)',
      'v.landNo': 'No (amphibious, −50% power)',
      'act.locate': 'Locate',
      'cp.attackHere': 'Attack This Region',
      'cp.offerTruce': 'Offer Truce',
      'cp.declareOn': 'Declare War on {0}',
      'cp.inTruce': 'In truce',
      'hud.worldCalm': 'The world is at peace.',
      'hud.atPeace': 'You are at peace. Here are the conflicts elsewhere in the world:',
      'toast.infraPoor': 'Not enough treasury for an infrastructure investment.',
      'toast.recruitPoor': 'Not enough treasury; {0} required.',
      'toast.recruitOk': 'Recruited {0} divisions.',
      'toast.noNation': 'That nation no longer exists.',
      'toast.noTarget': 'There is no valid target to attack.',
      'toast.attackOrder': 'Ordered an attack on {0} ({1} of {2}).',
      'toast.peaceRefused': '{0} rejected the ceasefire; they believe they are winning.',
      'toast.peaceOk': 'You and {0} have signed a peace deal; the front is frozen.',
      'toast.declared': 'You have declared war on {0}!',
      'dlg.declareTitle': 'Confirm Declaration of War',
      'k.target': 'Target',
      'k.theirArmy': 'Their Army',
      'k.ourArmy': 'Our Army',
      'k.ratio': 'Force Ratio',
      'dlg.declareHint': 'Declaring war lowers stability on both sides and freezes a 3-year truce.',
      'end.win': '🌍 The World Is Conquered',
      'end.lose': '💀 The Empire Has Fallen',
      'es.days': 'Days in Power',
      'es.terr': 'Territories',
      'es.gdpShare': 'Global GDP Share',
      'es.army': 'Army',
      'log.lead': 'You now lead {0}. The world awaits conquest.',
      'log.declare': '⚔️ {0} declared war on {1}!',
      'log.peace': '🕊️ {0} and {1} signed a peace treaty.',
      'log.capture': '🚩 {0} captured {1} (formerly {2})',
      'log.repelled': '⛔ The offensive against {0} was repelled with heavy losses.',
      'log.annexWar': '💀 {0} has collapsed and was annexed by {1}!',
      'log.annex': '💀 {0} was annexed by {1}.',
      'log.revoltFree': '🔥 {0} revolted and regained independence!',
      'log.revoltLeave': '🔥 {0} revolted and broke away from your rule!',
      'log.recruit': '🪖 Recruited {0} divisions for {1}.',
      'log.invest': '🏗️ Invested {0} in infrastructure; economic output increased.',
      'end.loseText': 'Your nation has been fully annexed. The conquest ends here.',
      'end.winText': 'You control {0} of the world\u2019s territories and {1} of its economy. The world is conquered!'
    }
  };

  function lookup(key) {
    var d = DICT[WC.lang] || DICT.zh;
    if (d && d[key] != null) return d[key];
    if (DICT.zh[key] != null) return DICT.zh[key];
    return key;
  }

  /** 占位符 {0}{1}…；支持国家对象（按语言取名）与 {money: 数值} 包装 */
  function argText(v) {
    if (v == null) return '';
    if (typeof v === 'object') {
      if (v.zh != null || v.name != null) return WC.cname(v);
      if (v.money != null) return WC.fmtMoneyU(v.money);
      if (v.num != null) return WC.fmtNum(v.num);
      if (v.int != null) return WC.fmtInt(v.int);
    }
    return String(v);
  }

  function fill(s, args) {
    if (!args || !args.length) return s;
    return s.replace(/\{(\d+)\}/g, function (m, i) {
      var v = args[+i];
      return v == null ? m : argText(v);
    });
  }

  WC.t = function (key) {
    return fill(lookup(key), Array.prototype.slice.call(arguments, 1));
  };
  /** 数组形式：tr('log.declare', [a, b]) */
  WC.tr = function (key, args) { return fill(lookup(key), args); };

  var I18N = {};
  I18N.dict = DICT;

  /** 回填带 data-i18n / data-i18n-title / data-i18n-ph 的静态节点 */
  I18N.apply = function () {
    var i, el, nodes;
    nodes = document.querySelectorAll('[data-i18n]');
    for (i = 0; i < nodes.length; i++) {
      el = nodes[i];
      el.textContent = WC.t(el.getAttribute('data-i18n'));
    }
    nodes = document.querySelectorAll('[data-i18n-title]');
    for (i = 0; i < nodes.length; i++) {
      el = nodes[i];
      el.setAttribute('title', WC.t(el.getAttribute('data-i18n-title')));
    }
    nodes = document.querySelectorAll('[data-i18n-ph]');
    for (i = 0; i < nodes.length; i++) {
      el = nodes[i];
      el.setAttribute('placeholder', WC.t(el.getAttribute('data-i18n-ph')));
    }
    document.documentElement.setAttribute('lang', WC.lang === 'zh' ? 'zh-CN' : 'en');
  };

  /** 切换语言并全量刷新界面 */
  I18N.set = function (lang) {
    lang = lang === 'zh' ? 'zh' : 'en';
    if (WC.lang === lang) return;
    WC.lang = lang;
    try { localStorage.setItem('wc.lang', lang); } catch (e) { void e; }
    I18N.apply();
    if (WC.Map && WC.Map.relabel) WC.Map.relabel();
    if (WC.UI && WC.UI.refreshLang) WC.UI.refreshLang();
  };

  WC.i18n = I18N;
  I18N.apply();
})(window.WC);
