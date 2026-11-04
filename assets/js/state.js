/* 游戏核心状态与规则：经济 / 军事 / 战争 / AI */
(function (WC) {
  'use strict';

  // ---------- 平衡参数 ----------
  var CFG = {
    ADMIN: 0.15,          // 行政开支占财政收入比例
    UNIT_UPKEEP: 0.5,     // 每单位兵力每日维护费（百万美元）
    UNIT_COST: 1400,      // 新募单位成本（百万美元）
    BASE_TREASURY: 0.05,  // 初始国库 = GDP * 该比例
    GDP_GROWTH: 0.00008,  // GDP 自然日增长
    K: 0.075,             // 每日战斗损耗系数
    RECRUIT_COST: 2800,   // 现钱紧急征兵单价
    INTEGRATION: 0.0025,  // 占领区整合速度
    TRUCE_DAYS: 1095,     // 停战期 3 年
    AI_PERIOD: 30,        // AI 决策周期（天）
    WAR_COST: 0.15        // 战时额外消耗 = 兵力 * 该系数
  };
  WC.CFG = CFG;

  var S = {
    list: [],
    byId: {},
    nation: {},
    nations: [],
    terr: {},
    wars: {},          // key -> war
    adj: {},           // id -> {id:true}
    day: 0,
    speed: 1,
    playerId: null,
    world: { gdp: 0, pop: 0, count: 0 },
    log: [],
    over: null,
    dirty: false
  };
  WC.State = S;

  // ---------- 工具 ----------
  S.terrsOf = function (id) {
    var n = S.nation[id];
    return n ? n._terrs : [];
  };

  function pairKey(a, b) { return a < b ? a + '|' + b : b + '|' + a; }
  S.pairKey = pairKey;

  S.getWar = function (a, b) { return S.wars[pairKey(a, b)] || null; };
  S.atWar = function (a, b) { return !!S.wars[pairKey(a, b)]; };
  S.isAdj = function (a, b) { return !!(S.adj[a] && S.adj[a][b]); };
  S.hasTruce = function (a, b) {
    var t = S.nation[a] && S.nation[a].truce[b];
    return !!(t && t > S.day);
  };

  /** 记录事件：文案以 key + 参数保存，渲染时按当前语言输出 */
  S.logEvent = function (key, args, type, notify) {
    var item = { day: S.day, key: key, args: args || [], type: type || 'info' };
    S.log.unshift(item);
    if (S.log.length > 200) S.log.pop();
    WC.bus.emit('log', item);
    if (notify) WC.bus.emit('notify', item);
  };

  // ---------- 初始化 ----------
  S.init = function () {
    var list = WC.COUNTRIES;
    S.list = list;
    S.byId = {};
    S.nation = {};
    S.nations = [];
    S.terr = {};
    S.wars = {};
    S.adj = {};
    S.day = 0;
    S.log = [];
    S.over = null;

    list.forEach(function (c) {
      S.byId[c.id] = c;
      var incomeBase = (c.gdp * 0.22 / WC.YEAR_DAYS) * 0.85; // 参考日可用财力
      var army = Math.max(2, Math.round(incomeBase * 0.086));
      var n = {
        id: c.id,
        zh: c.zh,
        name: c.name,
        iso2: c.iso2,
        continent: c.continent,
        subregion: c.subregion,
        isPlayer: false,
        alive: true,
        army: army,
        treasury: c.gdp * CFG.BASE_TREASURY,
        stability: WC.clamp(62 + WC.rand(-8, 8), 30, 85),
        taxRate: WC.clamp(0.22 + WC.rand(-0.04, 0.04), 0.05, 0.6),
        milSpend: 0.35,
        aggression: WC.rand(0.05, 0.55),
        truce: {},
        lastWarDay: -9999,
        _terrs: [],
        pop: 0, gdp: 0, income: 0, upkeep: 0, spent: 0, armyStart: army
      };
      S.nation[c.id] = n;
      S.nations.push(n);
      S.terr[c.id] = {
        id: c.id,
        ownerId: c.id,
        baseGdp: c.gdp,
        basePop: c.pop,
        integration: 1,
        since: 0
      };
      n._terrs.push(S.terr[c.id]);
    });

    computeAdjacency();
    recomputeAll();
  };

  function recomputeAll() {
    S.world.gdp = 0; S.world.pop = 0; S.world.count = 0;
    S.nations.forEach(function (n) {
      S.terr[n.id].baseGdp = S.byId[n.id].gdp; // 保证基准
    });
    S.list.forEach(function (c) {
      S.world.gdp += c.gdp;
      S.world.pop += c.pop;
      S.world.count++;
    });
    S.nations.forEach(recompute);
  }

  function recompute(n) {
    var gdp = 0, pop = 0;
    for (var i = 0; i < n._terrs.length; i++) {
      var t = n._terrs[i];
      gdp += t.baseGdp * t.integration;
      pop += t.basePop * t.integration;
    }
    n.gdp = gdp;
    n.pop = pop;
    n.terrCount = n._terrs.length;
  }
  S.recompute = recompute;

  // ---------- 邻接关系（陆地/近海接壤近似）----------
  function computeAdjacency() {
    var CELL = 1.0;   // 网格边长（度）
    var STEP = 0.5;   // 边界采样步长（度）
    var cells = {};   // "gx,gy" -> { id: true }

    S.list.forEach(function (c) {
      var set = {};
      for (var r = 0; r < c.rings.length; r++) {
        var ring = c.rings[r];
        var len = ring.length;
        for (var i = 0; i < len; i += 2) {
          var lon = ring[i], lat = ring[i + 1];
          var nx = ring[(i + 2) % len], ny = ring[(i + 3) % len];
          var d = Math.hypot(nx - lon, ny - lat);
          var steps = Math.min(60, Math.max(1, Math.ceil(d / STEP)));
          for (var s = 0; s <= steps; s++) {
            var t = s / steps;
            var gx = Math.floor((lon + (nx - lon) * t) / CELL);
            var gy = Math.floor((lat + (ny - lat) * t) / CELL);
            set[gx + ',' + gy] = true;
          }
        }
      }
      c._cells = set;
      for (var k in set) (cells[k] = cells[k] || {})[c.id] = true;
    });

    S.list.forEach(function (c) { S.adj[c.id] = {}; });

    function link(a, b2) {
      if (a === b2) return;
      S.adj[a][b2] = true;
      S.adj[b2][a] = true;
    }

    for (var key in cells) {
      var parts = key.split(',');
      var bx = parseInt(parts[0], 10), by = parseInt(parts[1], 10);
      var here = Object.keys(cells[key]);
      // 同一格内互相接壤
      for (var i2 = 0; i2 < here.length; i2++) {
        for (var j2 = i2 + 1; j2 < here.length; j2++) link(here[i2], here[j2]);
      }
      // 相邻格（非传递，最多约 1.4 个网格 ≈ 150km 的邻接容差）
      for (var dx = -1; dx <= 1; dx++) {
        for (var dy = -1; dy <= 1; dy++) {
          if (dx === 0 && dy === 0) continue;
          if (dx < 0 || (dx === 0 && dy < 0)) continue;   // 避免重复
          var nb = cells[(bx + dx) + ',' + (by + dy)];
          if (!nb) continue;
          var them = Object.keys(nb);
          for (var a3 = 0; a3 < here.length; a3++) {
            for (var b3 = 0; b3 < them.length; b3++) link(here[a3], them[b3]);
          }
        }
      }
    }

    S.list.forEach(function (c) { delete c._cells; });
  }

  // ---------- 选择玩家 ----------
  S.setPlayer = function (id) {
    var n = S.nation[id];
    if (!n) return;
    n.isPlayer = true;
    n.stability = Math.max(n.stability, 55);
    S.playerId = id;
    S.logEvent('log.lead', [n], 'good');
  };

  // ---------- 每日结算 ----------
  S.tick = function () {
    if (S.over) return;
    S.day++;
    economyTick();
    warTick();
    growthTick();
    if (S.day % CFG.AI_PERIOD === 0) aiTick();
    if (S.day % 30 === 0) checkCollapse();
    checkEnd();
    S.dirty = true;
  };

  function economyTick() {
    var atWar;
    for (var i = 0; i < S.nations.length; i++) {
      var n = S.nations[i];
      if (!n.alive) continue;
      recompute(n);
      atWar = false;
      for (var w in S.wars) {
        var war = S.wars[w];
        if ((war.a === n.id || war.b === n.id) && war.days > 0) { atWar = true; break; }
      }
      var eff = 0.6 + n.stability / 250;                 // 稳定度对经济的影响
      var income = (n.gdp * n.taxRate / WC.YEAR_DAYS) * eff;
      var admin = income * CFG.ADMIN;
      var pool = income - admin;
      var milBudget = pool * n.milSpend;
      var upkeep = n.army * CFG.UNIT_UPKEEP;
      if (atWar) milBudget += n.army * CFG.WAR_COST;      // 战时额外拨款
      var spent = Math.max(milBudget, upkeep);
      var surplus = milBudget - upkeep;
      if (surplus > 0) {
        n.army += surplus / CFG.UNIT_COST;
      } else {
        n.army = Math.max(0, n.army - Math.min(n.army, -surplus / (CFG.UNIT_COST * 4)));
      }
      n.army = Math.max(0, n.army);
      n.income = income;
      n.upkeep = upkeep;
      n.spent = spent;
      n.atWar = atWar;
      n.treasury += pool - spent;
      if (n.treasury < 0) {                              // 财政破产
        n.treasury = 0;
        n.stability -= 0.08;
        n.milSpend = Math.max(0.05, n.milSpend - 0.004);
      }
      // 稳定度向目标漂移
      var target = 68 - Math.max(0, n.taxRate - 0.2) * 140 - (atWar ? 14 : 0) + (n.treasury > 0 ? 4 : -18);
      n.stability += (target - n.stability) * 0.012;
      n.stability = WC.clamp(n.stability, 0, 100);
    }
  }

  function growthTick() {
    for (var id in S.terr) {
      var t = S.terr[id];
      t.baseGdp *= (1 + CFG.GDP_GROWTH);
      if (t.integration < 1) t.integration = Math.min(1, t.integration + CFG.INTEGRATION);
    }
  }

  // ---------- 战争 ----------
  S.declareWar = function (aId, bId, silent) {
    if (aId === bId) return false;
    if (S.atWar(aId, bId)) return false;
    var a = S.nation[aId], b = S.nation[bId];
    if (!a || !b || !a.alive || !b.alive) return false;
    var key = pairKey(aId, bId);
    S.wars[key] = {
      key: key, a: aId, b: bId, start: S.day, days: 0,
      press: {}, lost: {}, gained: {}
    };
    S.wars[key].press[aId] = null;
    S.wars[key].press[bId] = null;
    a.truce[bId] = 0; b.truce[aId] = 0;
    a.lastWarDay = S.day; b.lastWarDay = S.day;
    a.stability -= 2; b.stability -= 4;
    var playerHit = a.isPlayer || b.isPlayer;
    if (!silent) S.logEvent('log.declare', [a, b], 'war', playerHit);
    WC.bus.emit('war', { a: aId, b: bId });
    return true;
  };

  S.makePeace = function (aId, bId, silent) {
    var key = pairKey(aId, bId);
    if (!S.wars[key]) return false;
    delete S.wars[key];
    var a = S.nation[aId], b = S.nation[bId];
    if (a) { a.truce[bId] = S.day + CFG.TRUCE_DAYS; a.stability += 3; }
    if (b) { b.truce[aId] = S.day + CFG.TRUCE_DAYS; b.stability += 3; }
    if (!silent) S.logEvent('log.peace', [a, b], 'peace', a.isPlayer || b.isPlayer);
    return true;
  };

  /** 设定某国的进攻方向（terrId 为 null 表示停止进攻） */
  S.setOffensive = function (nationId, terrId) {
    var t = S.terr[terrId];
    if (!t) return false;
    var enemy = t.ownerId;
    var war = S.getWar(nationId, enemy);
    if (!war) return false;
    war.press[nationId] = terrId;
    return true;
  };

  function warTick() {
    for (var key in S.wars) {
      var war = S.wars[key];
      war.days++;
      resolveSide(war, war.a, war.b);
      resolveSide(war, war.b, war.a);
      if (!S.nation[war.a].alive || !S.nation[war.b].alive) {
        delete S.wars[key];
        continue;
      }
      // 战争疲劳
      S.nation[war.a].stability -= 0.012;
      S.nation[war.b].stability -= 0.012;
    }
  }

  function resolveSide(war, atkId, defId) {
    var terrId = war.press[atkId];
    if (!terrId) return;
    var A = S.nation[atkId], D = S.nation[defId];
    var t = S.terr[terrId];
    if (!A || !D || !A.alive || !D.alive || !t || t.ownerId !== defId) {
      war.press[atkId] = null;
      return;
    }
    var logistics = S.isAdj(atkId, terrId) ? 1 : 0.5;
    var defBonus = 1 + (D.stability / 100) * 0.25;
    var aPower = A.army * logistics * WC.rand(0.9, 1.1);
    var dPower = D.army * defBonus * WC.rand(0.9, 1.1);
    var aLoss = Math.min(A.army, (dPower * CFG.K) / logistics);
    var dLoss = Math.min(D.army, aPower * CFG.K);
    A.army -= aLoss;
    D.army -= dLoss;
    A.warLosses = (A.warLosses || 0) + aLoss;
    D.warLosses = (D.warLosses || 0) + dLoss;

    // 守军崩溃 → 全面吞并
    if (D.army <= 2 && A.army > 2) {
      annexAll(A, D);
      return;
    }
    // 进攻得手 → 占领该政区
    if (D.army < A.army * 0.35 || D.army <= 2) {
      captureTerritory(A, D, terrId);
      war.press[atkId] = null;
      war.gained[D.id] = (war.gained[D.id] || 0) + 1;
      var playerInvolved = A.isPlayer || D.isPlayer;
      if (playerInvolved) {
        S.logEvent('log.capture', [A, S.byId[terrId], D], A.isPlayer ? 'good' : 'bad', true);
      }
      if (D._terrs.length === 0) {
        D.alive = false;
        D.army = 0;
        for (var kk in S.wars) {
          var ww = S.wars[kk];
          if (ww.a === D.id || ww.b === D.id) delete S.wars[kk];
        }
        return;
      }
      // 顺势推进下一个目标
      var next = pickTerritory(A, D);
      if (next) war.press[atkId] = next.id;
    } else if (A.army < D.army * 0.3) {
      war.press[atkId] = null;   // 攻势受挫
      A.stability -= 1.5;
      if (A.isPlayer) S.logEvent('log.repelled', [D], 'bad', true);
    }
  }

  function captureTerritory(A, D, terrId) {
    var t = S.terr[terrId];
    transferTerritory(terrId, A.id);
    A.stability -= 1.5; D.stability -= 5;
  }

  function annexAll(A, D) {
    var list = D._terrs.slice();
    for (var i = 0; i < list.length; i++) transferTerritory(list[i].id, A.id);
    D.alive = false;
    D.army = 0;
    var pl = A.isPlayer || D.isPlayer;
    if (pl) S.logEvent('log.annexWar', [D, A], A.isPlayer ? 'good' : 'bad', true);
    else S.logEvent('log.annex', [D, A], 'info');
    for (var k in S.wars) {
      var w = S.wars[k];
      if (w.a === D.id || w.b === D.id) delete S.wars[k];
    }
  }

  function transferTerritory(terrId, newOwner) {
    var t = S.terr[terrId];
    var old = S.nation[t.ownerId];
    if (old) {
      var i = old._terrs.indexOf(t);
      if (i >= 0) old._terrs.splice(i, 1);
      recompute(old);
    }
    t.ownerId = newOwner;
    t.integration = 0.55;
    t.since = S.day;
    var nn = S.nation[newOwner];
    if (nn && nn._terrs.indexOf(t) < 0) nn._terrs.push(t);
    if (nn) recompute(nn);
    if (old) recompute(old);
  }
  S.transferTerritory = transferTerritory;

  function pickTerritory(A, D) {
    var best = null, bestScore = -1e18;
    for (var i = 0; i < D._terrs.length; i++) {
      var t = D._terrs[i];
      var adj = S.isAdj(A.id, t.id) ? 1 : 0.35;
      var score = (t.baseGdp * t.integration) * adj;
      if (score > bestScore) { bestScore = score; best = t; }
    }
    return best;
  }

  // ---------- 叛乱 ----------
  function checkCollapse() {
    S.nations.forEach(function (n) {
      if (!n.alive) return;
      if (n.stability < 22 && n._terrs.length > 1 && Math.random() < 0.14) {
        // 最不稳定的占领区发生叛乱
        var cand = n._terrs.filter(function (t) { return t.id !== n.id; });
        if (!cand.length) return;
        var t = cand[Math.floor(Math.random() * cand.length)];
        var original = S.nation[t.id];
        if (original && original.alive) {
          transferTerritory(t.id, original.id);
          if (n.isPlayer) S.logEvent('log.revoltFree', [S.byId[t.id]], 'bad');
        } else {
          transferTerritory(t.id, t.id);
          if (n.isPlayer) S.logEvent('log.revoltLeave', [S.byId[t.id]], 'bad');
        }
        n.stability += 6;
      }
      if (n._terrs.length === 0) n.alive = false;
    });
  }

  // ---------- AI ----------
  function aiTick() {
    S.nations.forEach(function (n) {
      if (!n.alive || n.isPlayer) return;
      var war = currentWar(n.id);
      // 军费策略
      if (war) n.milSpend = WC.clamp(0.5 + n.aggression * 0.4, 0.4, 0.9);
      else n.milSpend = WC.clamp(0.22 + n.aggression * 0.35, 0.12, 0.6);
      // 经济策略：国库充裕则减税
      if (n.treasury > n.gdp * 0.12) n.taxRate = WC.clamp(n.taxRate - 0.01, 0.08, 0.55);
      else if (n.stability < 40) n.taxRate = WC.clamp(n.taxRate - 0.015, 0.08, 0.55);
      else n.taxRate = WC.clamp(n.taxRate + 0.006, 0.08, 0.55);

      if (war) {
        // 推进攻势
        if (!war.press[n.id]) {
          var foeId = war.a === n.id ? war.b : war.a;
          var foe = S.nation[foeId];
          if (foe && foe.alive) {
            var t = pickTerritory(n, foe);
            if (t) war.press[n.id] = t.id;
          }
        }
        // 求和判断
        var foe2 = S.nation[war.a === n.id ? war.b : war.a];
        if (foe2 && foe2.alive) {
          var losing = n.army < n.armyStart * 0.4 || n.army < foe2.army * 0.5;
          if (losing && war.days > 60 && Math.random() < 0.35) {
            S.makePeace(n.id, foe2.id, false);
          }
        }
        return;
      }

      if (S.day - n.lastWarDay < CFG.TRUCE_DAYS) return;
      if (n.army < n.armyStart * 0.7) return;
      if (Math.random() > n.aggression) return;
      // 寻找可欺负的邻居
      var best = null, bestScore = 0;
      for (var adjId in S.adj[n.id]) {
        var foe3 = S.nation[adjId];
        if (!foe3 || !foe3.alive) continue;
        if (S.hasTruce(n.id, adjId)) continue;
        var ratio = n.army / Math.max(4, foe3.army);
        if (ratio > 1.5 && ratio > bestScore) { bestScore = ratio; best = adjId; }
      }
      if (best) S.declareWar(n.id, best, false);
    });
  }

  function currentWar(id) {
    for (var k in S.wars) {
      var w = S.wars[k];
      if ((w.a === id || w.b === id) && w.days > 3) return w;
    }
    return null;
  }
  S.currentWar = currentWar;

  // ---------- 玩家动作 ----------
  S.setTax = function (v) {
    var n = S.nation[S.playerId];
    if (n) n.taxRate = WC.clamp(v, 0.05, 0.6);
  };
  S.setMilSpend = function (v) {
    var n = S.nation[S.playerId];
    if (n) n.milSpend = WC.clamp(v, 0, 0.9);
  };
  S.recruit = function (count) {
    var n = S.nation[S.playerId];
    if (!n) return false;
    var cost = count * CFG.RECRUIT_COST;
    if (n.treasury < cost) return false;
    n.treasury -= cost;
    n.army += count;
    S.logEvent('log.recruit', [count, { money: cost }], 'info');
    return true;
  };
  S.invest = function () {
    var n = S.nation[S.playerId];
    if (!n) return false;
    var cost = n.gdp * 0.006;
    if (n.treasury < cost) return false;
    n.treasury -= cost;
    var home = S.terr[n.id];
    home.baseGdp *= 1.012;
    recompute(n);
    S.logEvent('log.invest', [{ money: cost }], 'good');
    return true;
  };

  // ---------- 结局判定 ----------
  function checkEnd() {
    var p = S.nation[S.playerId];
    if (!p) return;
    if (!p.alive) {
      S.over = { win: false, key: 'end.loseText', args: [] };
      return;
    }
    var gdpShare = p.gdp / Math.max(1, worldGdpNow());
    var countShare = p._terrs.length / S.world.count;
    if (gdpShare >= 0.6 || countShare >= 0.75) {
      S.over = {
        win: true,
        key: 'end.winText',
        args: [WC.fmtPct(countShare, 1), WC.fmtPct(gdpShare, 1)]
      };
    }
  }

  function worldGdpNow() {
    var s = 0;
    S.nations.forEach(function (n) { if (n.alive) s += n.gdp; });
    return s;
  }
  S.worldGdpNow = worldGdpNow;

  // ---------- 查询辅助 ----------
  S.player = function () { return S.nation[S.playerId]; };

  S.warList = function (id) {
    var out = [];
    for (var k in S.wars) {
      var w = S.wars[k];
      if (w.a === id || w.b === id) out.push(w);
    }
    return out;
  };

  S.enemies = function (id) {
    return S.warList(id).map(function (w) { return w.a === id ? w.b : w.a; });
  };

  S.nationalPower = function (n) {
    return n.army + n.gdp / 40000;
  };

  /** 谁能被宣战（存活、非自己、不在停战期、不在战争中） */
  S.canDeclare = function (id) {
    var n = S.nation[id];
    var p = S.player();
    if (!p || !n || !n.alive || id === p.id) return false;
    if (S.atWar(p.id, id)) return false;
    if (S.hasTruce(p.id, id)) return false;
    return true;
  };

  S.worldStats = function () {
    var gdp = worldGdpNow(), pop = 0, alive = 0, army = 0;
    S.nations.forEach(function (n) {
      if (!n.alive) return;
      alive++; pop += n.pop; army += n.army;
    });
    return { gdp: gdp, pop: pop, alive: alive, army: army };
  };
})(window.WC);
