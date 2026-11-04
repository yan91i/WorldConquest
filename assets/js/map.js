/* SVG 世界地图：投影渲染、平移缩放、拾取、着色 */
(function (WC) {
  'use strict';

  var S = WC.State;
  var NS = 'http://www.w3.org/2000/svg';

  var svg, worldG, labelG, markerG, gridG, ocean;
  var cam = { x: 0, y: 0, w: 1000, h: 500 };
  var paths = {};     // id -> path 元素
  var labels = {};     // id -> text 元素
  var lastFill = {};
  var selectedId = null;
  var hoverId = null;
  var dragging = false;
  var moved = 0;
  var downPt = null;
  var downCam = null;
  var cbs = {};
  var tween = null;
  var sizeW = 1, sizeH = 1;

  var COLORS = {
    player: '#2b6ed6',
    playerTerr: '#3c86e8',
    enemy: '#c0454d',
    neutral: '#8d9b8f',
    selected: '#f0c04a'
  };
  WC.MAP_COLORS = COLORS;

  function el(tag, attrs) {
    var e = document.createElementNS(NS, tag);
    if (attrs) for (var k in attrs) e.setAttribute(k, attrs[k]);
    return e;
  }

  function buildPath(c) {
    var d = '';
    for (var r = 0; r < c.rings.length; r++) {
      var ring = c.rings[r];
      for (var i = 0; i < ring.length; i += 2) {
        var x = WC.projX(ring[i]).toFixed(1);
        var y = WC.projY(ring[i + 1]).toFixed(1);
        d += (i === 0 ? 'M' : 'L') + x + ' ' + y;
      }
      d += 'Z';
    }
    return d;
  }

  function computeBBox(c) {
    var minX = 1e9, minY = 1e9, maxX = -1e9, maxY = -1e9;
    for (var r = 0; r < c.rings.length; r++) {
      var ring = c.rings[r];
      for (var i = 0; i < ring.length; i += 2) {
        var x = WC.projX(ring[i]), y = WC.projY(ring[i + 1]);
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
    c._bb = { x: minX, y: minY, w: Math.max(2, maxX - minX), h: Math.max(2, maxY - minY) };
  }

  var Map_ = {
    init: function (svgEl, callbacks) {
      svg = svgEl;
      cbs = callbacks || {};
      svg.setAttribute('preserveAspectRatio', 'none');
      worldG = el('g', { id: 'world' });
      gridG = el('g', { id: 'grid', 'pointer-events': 'none' });
      labelG = el('g', { id: 'labels', 'pointer-events': 'none' });
      markerG = el('g', { id: 'markers', 'pointer-events': 'none' });
      svg.appendChild(gridG);
      svg.appendChild(worldG);
      svg.appendChild(labelG);
      svg.appendChild(markerG);

      // 经纬网
      for (var lon = -150; lon <= 150; lon += 30) {
        gridG.appendChild(el('line', {
          x1: WC.projX(lon), y1: 0, x2: WC.projX(lon), y2: WC.MAP_H,
          stroke: 'rgba(255,255,255,.06)', 'stroke-width': 0.6
        }));
      }
      for (var lat = -60; lat <= 60; lat += 30) {
        gridG.appendChild(el('line', {
          x1: 0, y1: WC.projY(lat), x2: WC.MAP_W, y2: WC.projY(lat),
          stroke: 'rgba(255,255,255,.06)', 'stroke-width': 0.6
        }));
      }
      gridG.appendChild(el('rect', {
        x: 0, y: 0, width: WC.MAP_W, height: WC.MAP_H,
        fill: 'none', stroke: 'rgba(255,255,255,.10)', 'stroke-width': 0.8
      }));

      // 政区
      S.list.forEach(function (c) {
        computeBBox(c);
        var p = el('path', {
          class: 'country',
          d: buildPath(c),
          'data-id': c.id,
          'fill-rule': 'evenodd'
        });
        paths[c.id] = p;
        worldG.appendChild(p);

        var txt = el('text', {
          class: 'clabel',
          x: WC.projX(c.label[0]).toFixed(1),
          y: WC.projY(c.label[1]).toFixed(1),
          'text-anchor': 'middle',
          'dominant-baseline': 'middle',
          'data-id': c.id
        });
        txt.textContent = WC.cname(c);
        labels[c.id] = txt;
        labelG.appendChild(txt);
      });

      bindEvents();
      Map_.resize();
    },

    on: function (k, fn) { cbs[k] = fn; },

    /** 语言切换后重写所有地名的文字 */
    relabel: function () {
      for (var i = 0; i < S.list.length; i++) {
        var c = S.list[i];
        if (labels[c.id]) labels[c.id].textContent = WC.cname(c);
      }
      Map_.applyCam();
    },

    resize: function () {
      var r = svg.getBoundingClientRect();
      sizeW = Math.max(1, r.width);
      sizeH = Math.max(1, r.height);
      var ar = sizeW / sizeH;
      if (ar >= 2) { cam.h = WC.MAP_H; cam.w = WC.MAP_H * ar; }
      else { cam.w = WC.MAP_W; cam.h = WC.MAP_W / ar; }
      cam.x = (WC.MAP_W - cam.w) / 2;
      cam.y = (WC.MAP_H - cam.h) / 2;
      Map_.applyCam();
    },

    /** 窗口尺寸变化：保持视野中心与缩放比例 */
    onResize: function () {
      var cx = cam.x + cam.w / 2;
      var cy = cam.y + cam.h / 2;
      var upx = cam.w / sizeW;
      var r = svg.getBoundingClientRect();
      sizeW = Math.max(1, r.width);
      sizeH = Math.max(1, r.height);
      cam.w = upx * sizeW;
      cam.h = cam.w * (sizeH / sizeW);
      cam.x = cx - cam.w / 2;
      cam.y = cy - cam.h / 2;
      Map_.applyCam();
    },

    camera: function () { return cam; },
    pxPerUnit: function () { return sizeW / cam.w; },

    applyCam: function (skipLabels) {
      cam.w = WC.clamp(cam.w, 22, 3600);
      cam.h = cam.w * (sizeH / sizeW);
      clampCam();
      svg.setAttribute('viewBox', cam.x + ' ' + cam.y + ' ' + cam.w + ' ' + cam.h);
      var scale = sizeW / cam.w;
      var fs = Math.max(0.9, 11 / scale);
      svg.style.setProperty('--label-size', fs + 'px');
      if (!skipLabels) updateLabels();
    },

    worldCenter: function () { return { x: WC.MAP_W / 2, y: WC.MAP_H / 2 }; },

    fitWorld: function () { Map_.resize(); },

    focus: function (id, factor) {
      var c = S.byId[id];
      if (!c || !c._bb) return;
      var pad = factor || 2.4;
      var aspect = sizeW / sizeH;
      var tw = Math.max(c._bb.w * pad, c._bb.h * pad * aspect, 46);
      var target = {
        x: c._bb.x + c._bb.w / 2 - tw / 2,
        y: c._bb.y + c._bb.h / 2 - (tw / aspect) / 2,
        w: tw,
        h: tw / aspect
      };
      animateTo(target);
    },

    zoomBy: function (f) {
      var u = 0.5, v = 0.5;
      zoomAt(u, v, f);
    },

    setSelected: function (id) {
      if (selectedId && paths[selectedId]) paths[selectedId].classList.remove('selected');
      selectedId = id;
      if (id && paths[id]) paths[id].classList.add('selected');
    },

    getSelected: function () { return selectedId; },

    refresh: function () {
      var pid = S.playerId;
      for (var i = 0; i < S.list.length; i++) {
        var c = S.list[i];
        var t = S.terr[c.id];
        if (!t) continue;
        var p = paths[c.id];
        var fill;
        if (t.ownerId === pid) {
          fill = t.id === pid ? COLORS.player : COLORS.playerTerr;
        } else if (pid && S.atWar(pid, t.ownerId)) {
          fill = COLORS.enemy;
        } else {
          fill = WC.neutralColor(t.ownerId);
        }
        if (lastFill[c.id] !== fill) {
          p.style.fill = fill;
          lastFill[c.id] = fill;
        }
      }
      updateMarkers();
    },

    setHover: function (id) {
      if (hoverId === id) return;
      if (hoverId && paths[hoverId]) paths[hoverId].classList.remove('hover');
      hoverId = id;
      if (id && paths[id]) paths[id].classList.add('hover');
    }
  };

  function updateLabels() {
    var scale = sizeW / cam.w;
    var vis = [];
    for (var i = 0; i < S.list.length; i++) {
      var c = S.list[i];
      var bb = c._bb;
      var w = bb.w * scale, h = bb.h * scale;
      if (w < 26 || h < 9) { labels[c.id].style.display = 'none'; continue; }
      var x = (WC.projX(c.label[0]) - cam.x) * scale;
      var y = (WC.projY(c.label[1]) - cam.y) * scale;
      if (x < -40 || y < -20 || x > sizeW + 40 || y > sizeH + 20) {
        labels[c.id].style.display = 'none';
        continue;
      }
      var tw = Math.min(w * 1.1, 150);
      vis.push({
        id: c.id, x: x, y: y, area: w * h,
        rx: x - tw / 2, ry: y - 7, rw: tw, rh: 14
      });
    }
    vis.sort(function (a, b) { return b.area - a.area; });
    var placed = [];
    for (var j = 0; j < vis.length; j++) {
      var v = vis[j];
      var ok = true;
      for (var k = 0; k < placed.length; k++) {
        var q = placed[k];
        if (!(v.rx + v.rw < q.rx || v.rx > q.rx + q.rw || v.ry + v.rh < q.ry || v.ry > q.ry + q.rh)) {
          ok = false; break;
        }
      }
      if (ok) {
        placed.push(v);
        labels[v.id].style.display = '';
      } else {
        labels[v.id].style.display = 'none';
      }
    }
  }

  function updateMarkers() {
    var frag = document.createDocumentFragment();
    for (var k in S.wars) {
      var w = S.wars[k];
      for (var side in w.press) {
        var tid = w.press[side];
        if (!tid) continue;
        var c = S.byId[tid];
        if (!c) continue;
        var isPlayer = S.nation[side] && S.nation[side].isPlayer;
        var circle = el('circle', {
          cx: WC.projX(c.label[0]).toFixed(1),
          cy: WC.projY(c.label[1]).toFixed(1),
          r: 4,
          class: 'marker' + (isPlayer ? ' mine' : '')
        });
        frag.appendChild(circle);
      }
    }
    markerG.textContent = '';
    markerG.appendChild(frag);
  }

  function clampCam() {
    if (cam.w >= WC.MAP_W) cam.x = (WC.MAP_W - cam.w) / 2;
    else cam.x = WC.clamp(cam.x, -cam.w * 0.35, WC.MAP_W - cam.w * 0.65);
    if (cam.h >= WC.MAP_H) cam.y = (WC.MAP_H - cam.h) / 2;
    else cam.y = WC.clamp(cam.y, -cam.h * 0.35, WC.MAP_H - cam.h * 0.65);
  }

  function zoomAt(u, v, f) {
    var mx = cam.x + u * cam.w;
    var my = cam.y + v * cam.h;
    var nw = WC.clamp(cam.w / f, 22, 3600);
    var k = nw / cam.w;
    cam.w = nw;
    cam.h = cam.h * k;
    cam.x = mx - u * cam.w;
    cam.y = my - v * cam.h;
    Map_.applyCam();
  }

  function animateTo(target) {
    if (tween) cancelAnimationFrame(tween);
    var from = { x: cam.x, y: cam.y, w: cam.w, h: cam.h };
    var t0 = performance.now();
    var dur = 420;
    function step(now) {
      var t = WC.clamp((now - t0) / dur, 0, 1);
      var e = 1 - Math.pow(1 - t, 3);
      cam.x = WC.lerp(from.x, target.x, e);
      cam.y = WC.lerp(from.y, target.y, e);
      cam.w = WC.lerp(from.w, target.w, e);
      cam.h = WC.lerp(from.h, target.h, e);
      Map_.applyCam(t < 1);
      if (t < 1) tween = requestAnimationFrame(step);
      else { tween = null; Map_.applyCam(); }
    }
    tween = requestAnimationFrame(step);
  }

  function toUnit(clientX, clientY) {
    var r = svg.getBoundingClientRect();
    var u = (clientX - r.left) / Math.max(1, r.width);
    var v = (clientY - r.top) / Math.max(1, r.height);
    return { u: u, v: v, x: cam.x + u * cam.w, y: cam.y + v * cam.h };
  }

  function bindEvents() {
    var activePointers = 0;
    var downId = null;

    svg.addEventListener('pointerdown', function (e) {
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      activePointers++;
      if (activePointers > 1) {            // 多指操作交由触摸手势处理
        dragging = false;
        svg.classList.remove('dragging');
        return;
      }
      dragging = true;
      moved = 0;
      downPt = { x: e.clientX, y: e.clientY };
      downCam = { x: cam.x, y: cam.y };
      downId = e.target && e.target.getAttribute ? e.target.getAttribute('data-id') : null;
      if (tween) { cancelAnimationFrame(tween); tween = null; }
      try { svg.setPointerCapture(e.pointerId); } catch (err) { void err; }
      svg.classList.add('dragging');
    });

    svg.addEventListener('pointermove', function (e) {
      if (dragging) {
        var dx = e.clientX - downPt.x;
        var dy = e.clientY - downPt.y;
        moved = Math.max(moved, Math.hypot(dx, dy));
        var scale = sizeW / cam.w;
        cam.x = downCam.x - dx / scale;
        cam.y = downCam.y - dy / scale;
        Map_.applyCam(true);
        return;
      }
      if (activePointers > 0) return;
      var p = e.target && e.target.getAttribute ? e.target.getAttribute('data-id') : null;
      if (p !== hoverId) {
        Map_.setHover(p);
        if (cbs.onHover) cbs.onHover(p, e);
      }
    });

    function endDrag(e) {
      if (e.pointerId !== undefined || e.type === 'pointerup') activePointers = Math.max(0, activePointers - 1);
      if (!dragging) return;
      dragging = false;
      svg.classList.remove('dragging');
      try { svg.releasePointerCapture(e.pointerId); } catch (err) { void err; }
      if (moved < 5) {
        if (cbs.onClick) cbs.onClick(downId, e);
      } else {
        Map_.applyCam();
      }
    }
    svg.addEventListener('pointerup', endDrag);
    svg.addEventListener('pointercancel', function (e) {
      activePointers = 0;
      if (dragging) { dragging = false; svg.classList.remove('dragging'); Map_.applyCam(); }
      void e;
    });

    svg.addEventListener('wheel', function (e) {
      e.preventDefault();
      var p = toUnit(e.clientX, e.clientY);
      var f = Math.pow(1.0016, -e.deltaY);
      zoomAt(p.u, p.v, f);
    }, { passive: false });

    // 双指缩放
    var pinch = null;
    svg.addEventListener('touchstart', function (e) {
      if (e.touches.length === 2) {
        pinch = {
          d: Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY),
          w: cam.w,
          cx: (e.touches[0].clientX + e.touches[1].clientX) / 2,
          cy: (e.touches[0].clientY + e.touches[1].clientY) / 2
        };
      }
    }, { passive: true });
    svg.addEventListener('touchmove', function (e) {
      if (pinch && e.touches.length === 2) {
        e.preventDefault();
        var d = Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY);
        var p = toUnit(pinch.cx, pinch.cy);
        cam.w = pinch.w;
        cam.h = pinch.w * (sizeH / sizeW);
        zoomAt(p.u, p.v, d / pinch.d);
      }
    }, { passive: false });
    svg.addEventListener('touchend', function () { pinch = null; }, { passive: true });
  }

  WC.Map = Map_;
})(window.WC);
