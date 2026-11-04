/* 通用工具：投影、数值格式化、颜色、随机 */
window.WC = window.WC || {};
(function (WC) {
  'use strict';

  // ---- 地图投影（等距圆柱，世界范围 -180..180 / 90..-90 -> 1000x500）----
  var MAP_W = 1000;
  var MAP_H = 500;
  WC.MAP_W = MAP_W;
  WC.MAP_H = MAP_H;
  WC.projX = function (lon) { return ((lon + 180) / 360) * MAP_W; };
  WC.projY = function (lat) { return ((90 - lat) / 180) * MAP_H; };

  // ---- 基础数学 ----
  WC.clamp = function (v, a, b) { return v < a ? a : (v > b ? b : v); };
  WC.lerp = function (a, b, t) { return a + (b - a) * t; };
  WC.rand = function (a, b) { return a + Math.random() * (b - a); };

  // ---- 确定性哈希（同一国家每次刷新颜色一致）----
  WC.hash = function (str) {
    var h = 2166136261;
    for (var i = 0; i < str.length; i++) {
      h ^= str.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return (h >>> 0);
  };

  // ---- 语言：默认按浏览器语言（zh* → 中文，其他 → 英文），手动选择会被记忆 ----
  WC.lang = (function () {
    try {
      var saved = localStorage.getItem('wc.lang');
      if (saved === 'zh' || saved === 'en') return saved;
    } catch (e) { void e; }
    var nav = (navigator.language || navigator.userLanguage || 'en').toLowerCase();
    return nav.indexOf('zh') === 0 ? 'zh' : 'en';
  })();

  /** 国家 / 政权名称（按当前语言） */
  WC.cname = function (c) {
    if (!c) return '';
    return WC.lang === 'zh' ? (c.zh || c.name || '') : (c.name || c.zh || '');
  };

  // ---- 时间：以 2026-01-01 为第 0 天 ----
  var START_MS = Date.UTC(2026, 0, 1);
  var MONTHS_EN = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
    'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  WC.MONTH_DAYS = 30;
  WC.YEAR_DAYS = 365;
  WC.dateOf = function (day) { return new Date(START_MS + day * 86400000); };
  WC.fmtDate = function (day) {
    var d = WC.dateOf(day);
    if (WC.lang === 'zh') {
      return d.getUTCFullYear() + '年' + (d.getUTCMonth() + 1) + '月' + d.getUTCDate() + '日';
    }
    return MONTHS_EN[d.getUTCMonth()] + ' ' + d.getUTCDate() + ', ' + d.getUTCFullYear();
  };
  WC.fmtDayMonth = function (day) {
    var d = WC.dateOf(day);
    if (WC.lang === 'zh') return (d.getUTCMonth() + 1) + '月' + d.getUTCDate() + '日';
    return MONTHS_EN[d.getUTCMonth()] + ' ' + d.getUTCDate();
  };

  // ---- 数值格式化 ----
  function trim(s) {
    return s.indexOf('.') >= 0 ? s.replace(/0+$/, '').replace(/\.$/, '') : s;
  }
  /** 输入单位百万美元 */
  WC.fmtMoney = function (m) {
    var v = m * 1e6;
    var sign = v < 0 ? '-' : '';
    v = Math.abs(v);
    if (WC.lang === 'zh') {
      if (v >= 1e12) return sign + trim((v / 1e12).toFixed(2)) + '万亿';
      if (v >= 1e8) return sign + trim((v / 1e8).toFixed(v / 1e8 >= 100 ? 0 : 1)) + '亿';
      if (v >= 1e4) return sign + trim((v / 1e4).toFixed(1)) + '万';
      return sign + Math.round(v).toString();
    }
    if (v >= 1e12) return sign + trim((v / 1e12).toFixed(2)) + 'T';
    if (v >= 1e9) return sign + trim((v / 1e9).toFixed(v / 1e9 >= 100 ? 0 : 1)) + 'B';
    if (v >= 1e6) return sign + trim((v / 1e6).toFixed(v / 1e6 >= 100 ? 0 : 1)) + 'M';
    if (v >= 1e3) return sign + trim((v / 1e3).toFixed(0)) + 'K';
    return sign + Math.round(v).toString();
  };
  /** 追加单位（美元） */
  WC.fmtMoneyU = function (m) { return WC.fmtMoney(m) + '$'; };

  WC.fmtNum = function (n) {
    var v = Math.abs(n);
    var sign = n < 0 ? '-' : '';
    if (WC.lang === 'zh') {
      if (v >= 1e8) return sign + trim((v / 1e8).toFixed(v / 1e8 >= 100 ? 0 : 1)) + '亿';
      if (v >= 1e4) return sign + trim((v / 1e4).toFixed(1)) + '万';
      if (v >= 1000) return sign + Math.round(v).toLocaleString('en-US');
      return sign + (Math.round(v * 10) / 10).toString();
    }
    if (v >= 1e12) return sign + trim((v / 1e12).toFixed(v / 1e12 >= 100 ? 0 : 1)) + 'T';
    if (v >= 1e9) return sign + trim((v / 1e9).toFixed(v / 1e9 >= 100 ? 0 : 1)) + 'B';
    if (v >= 1e6) return sign + trim((v / 1e6).toFixed(v / 1e6 >= 100 ? 0 : 1)) + 'M';
    if (v >= 1000) return sign + Math.round(v).toLocaleString('en-US');
    return sign + (Math.round(v * 10) / 10).toString();
  };

  WC.fmtInt = function (n) { return Math.round(n).toLocaleString('en-US'); };
  WC.fmtPct = function (p, d) { return (p * 100).toFixed(d == null ? 1 : d) + '%'; };

  // ---- 国旗 emoji ----
  WC.flag = function (iso2) {
    if (!iso2 || iso2.length !== 2 || !/^[A-Za-z]{2}$/.test(iso2)) return '🏳️';
    var base = 0x1f1e6;
    var a = iso2.toUpperCase();
    return String.fromCodePoint(base + a.charCodeAt(0) - 65, base + a.charCodeAt(1) - 65);
  };

  // ---- 政区配色（中立国家使用的低饱和政治地图色）----
  var PALETTE = [
    '#8d9b8f', '#9a9c86', '#7f949a', '#9c8f86', '#87958c',
    '#94908f', '#8a9484', '#9b9285', '#869089', '#938f9a',
    '#8f9a90', '#9a8d8b', '#7e8f93', '#97927f', '#8b9199'
  ];
  WC.neutralColor = function (id) {
    return PALETTE[WC.hash(id) % PALETTE.length];
  };

  // ---- 简易事件总线 ----
  WC.bus = (function () {
    var map = {};
    return {
      on: function (k, fn) { (map[k] = map[k] || []).push(fn); },
      emit: function (k, a, b) {
        var l = map[k];
        if (!l) return;
        for (var i = 0; i < l.length; i++) l[i](a, b);
      }
    };
  })();
})(window.WC);
