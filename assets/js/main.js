/* 启动与主循环 */
(function (WC) {
  'use strict';
  var S = WC.State;
  var acc = 0;
  var last = 0;
  var lastUi = 0;

  function loop(now) {
    requestAnimationFrame(loop);
    if (!last) { last = now; return; }
    var dt = Math.min(250, now - last);
    last = now;

    if (S.speed > 0 && S.playerId && !S.over) {
      acc += dt;
      var interval = 420 / S.speed;
      var guard = 0;
      while (acc >= interval && guard++ < 60) { acc -= interval; S.tick(); }
    }

    if (S.dirty) {
      S.dirty = false;
      WC.Map.refresh();
    }

    if (S.playerId && now - lastUi > 110) {
      lastUi = now;
      WC.UI.render(false);
    }
  }

  function boot() {
    S.init();
    WC.UI.init();
    WC.Map.refresh();
    $('btnRestart').addEventListener('click', function () { window.location.reload(); });
    requestAnimationFrame(loop);
  }

  function $(id) { return document.getElementById(id); }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})(window.WC);
