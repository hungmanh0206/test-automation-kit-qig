/* Bản đồ khái niệm 3D — canvas 2D + toán chiếu phối cảnh tự viết.
 *
 * Vì sao không dùng three.js: trang phải self-contained (CSP của Artifact chặn mọi host ngoài),
 * mà nhúng cả một thư viện WebGL vào một file HTML là quá nặng cho việc chỉ vẽ ~140 điểm và ~310 đoạn.
 * Vì sao canvas chứ không SVG: chế độ 3D vẽ lại toàn bộ mỗi frame khi quay; cập nhật 450 node DOM
 * mỗi frame thì tụt frame ngay, còn canvas chỉ là một lần fill.
 *
 * Bố cục: 6 cụm đặt ở 6 đỉnh khối tám mặt (octahedron) — khoảng cách giữa hai cụm kề nhau bằng
 * R·√2 nên không cụm nào chồng cụm nào. Trong mỗi cụm, các thuật ngữ rải ĐẦY một khối cầu nhỏ
 * bằng xoắn ốc góc vàng (bán kính ∝ ∛(thứ tự) để mật độ đều, không dồn ra vỏ).
 *
 * Chế độ phẳng dùng lại bố cục ellipse + phyllotaxis 2D cũ; chuyển chế độ là nội suy giữa hai bộ toạ độ.
 */
function makeGraph(opt) {
  'use strict';
  var cv = opt.canvas, ctx = cv.getContext('2d');
  var TERMS = opt.terms, CATS = opt.cats, BY_ID = opt.byId, onPick = opt.onPick;

  var ORDER = ['concept', 'gate', 'rule', 'flow', 'status', 'skill'];
  var R3 = 400, SPHERE = 46;                 // bán kính khối cầu cụm · hệ số bán kính cụm
  var RX = 690, RY = 310, SP = 32;           // bố cục phẳng (giữ nguyên bản cũ)
  var FOCAL = 1700;                          // tiêu cự — càng nhỏ phối cảnh càng mạnh

  var nodes = [], edges = [], neighbors = {}, hidden = {};
  var selected = null, hover = null;

  /* ── Dựng node & cạnh ── */
  var AXES = [[1,0,0], [-1,0,0], [0,1,0], [0,-1,0], [0,0,1], [0,0,-1]];
  ORDER.forEach(function (k, i) {
    var list = TERMS.filter(function (t) { return t.cat === k; });
    var a = AXES[i], hx = a[0] * R3, hy = a[1] * R3, hz = a[2] * R3;
    var cr = SPHERE * Math.cbrt(list.length + 1);
    // tâm cụm ở bố cục phẳng
    var ang2 = (i / ORDER.length) * Math.PI * 2;
    var fx = Math.cos(ang2) * RX, fy = Math.sin(ang2) * RY;

    nodes.push({ id: 'HUB_' + k, hub: true, cat: k, label: CATS[k].label, cr: cr,
                 x3: hx, y3: hy, z3: hz, x2: fx, y2: fy,
                 cr2: SP * Math.sqrt(list.length + 1) });

    list.forEach(function (t, j) {
      // xoắn ốc góc vàng trên cầu, bán kính ∝ ∛ để lấp đều thể tích
      var gold = Math.PI * (3 - Math.sqrt(5));
      var u = (j + 0.5) / list.length;
      var phi = Math.acos(1 - 2 * u), th = gold * j;
      var rr = cr * Math.cbrt(u);
      nodes.push({
        id: t.id, cat: k, label: t.t,
        x3: hx + rr * Math.sin(phi) * Math.cos(th),
        y3: hy + rr * Math.cos(phi),
        z3: hz + rr * Math.sin(phi) * Math.sin(th),
        x2: fx + Math.cos(j * 2.3999632297) * (SP * Math.sqrt(j + 1)),
        y2: fy + Math.sin(j * 2.3999632297) * (SP * Math.sqrt(j + 1))
      });
      edges.push({ s: 'HUB_' + k, t: t.id, hubEdge: true });
    });
  });
  var seen = {};
  TERMS.forEach(function (t) {
    (t.rel || []).forEach(function (r) {
      if (!BY_ID[r]) return;
      var key = t.id < r ? t.id + '|' + r : r + '|' + t.id;
      if (seen[key]) return; seen[key] = 1;
      edges.push({ s: t.id, t: r });
      (neighbors[t.id] = neighbors[t.id] || {})[r] = 1;
      (neighbors[r] = neighbors[r] || {})[t.id] = 1;
    });
  });
  var IDX = {}; nodes.forEach(function (n, i) { IDX[n.id] = i; });

  /* ── Camera ── */
  var yaw = 0.88, pitch = -0.52, zoom = 1, panX = 0, panY = 0;
  var morph = 1;                      // 1 = 3D · 0 = phẳng
  var morphTarget = 1, dragging = null, looping = false;
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var auto = !reduce;                 // tự quay nhẹ, dừng hẳn khi người dùng nắm quyền
  var W = 0, H = 0, dpr = 1;

  function sizeCanvas() {
    var r = cv.getBoundingClientRect();
    if (!r.width || !r.height) return false;
    dpr = Math.min(2, window.devicePixelRatio || 1);
    W = r.width; H = r.height;
    cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
    return true;
  }

  /* Toạ độ hiện tại của node theo mức nội suy giữa hai bố cục. */
  function px(n) { return n.x2 + (n.x3 - n.x2) * morph; }
  function py(n) { return n.y2 + (n.y3 - n.y2) * morph; }
  function pz(n) { return n.z3 * morph; }

  /* Quay quanh Y (yaw) rồi quanh X (pitch), sau đó chiếu phối cảnh.
     Ở chế độ phẳng thì góc quay được nhân theo morph nên tự về 0 → nhìn chính diện. */
  function project(n) {
    var x = px(n), y = py(n), z = pz(n);
    var cy = Math.cos(yaw * morph), sy = Math.sin(yaw * morph);
    var x1 = x * cy + z * sy, z1 = -x * sy + z * cy;
    var cp = Math.cos(pitch * morph), sp = Math.sin(pitch * morph);
    var y1 = y * cp - z1 * sp, z2 = y * sp + z1 * cp;
    var k = FOCAL / (FOCAL + z2);
    return { x: W / 2 + panX + x1 * k * zoom, y: H / 2 + panY + y1 * k * zoom, k: k, z: z2 };
  }

  function fit() {
    if (!sizeCanvas()) return;
    var minx = 1e9, maxx = -1e9, miny = 1e9, maxy = -1e9;
    var save = { zoom: zoom, panX: panX, panY: panY };
    zoom = 1; panX = 0; panY = 0;
    nodes.forEach(function (n) {
      if (hidden[n.cat]) return;
      var p = project(n);
      minx = Math.min(minx, p.x); maxx = Math.max(maxx, p.x);
      miny = Math.min(miny, p.y); maxy = Math.max(maxy, p.y);
    });
    if (minx > maxx) { zoom = save.zoom; panX = save.panX; panY = save.panY; return; }
    var pad = Math.min(66, W * 0.08);
    var z = Math.min((W - pad * 2) / (maxx - minx || 1), (H - pad * 2) / (maxy - miny || 1));
    zoom = Math.max(0.14, Math.min(1.7, z));
    panX = (W / 2 - (minx + maxx) / 2) * zoom;
    panY = (H / 2 - (miny + maxy) / 2) * zoom;
  }

  /* Lấy màu theo theme hiện tại — token nằm ở :root nên đọc lúc vẽ là luôn đúng. */
  function tok(name) {
    return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  }

  function draw() {
    if (!W || !H) { if (!sizeCanvas()) return; }
    var cInk = tok('--t1') || '#16161A', cLine = tok('--t3') || '#79736A';
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);

    var focus = hover || selected;
    var vis = [];
    nodes.forEach(function (n) {
      if (hidden[n.cat]) { n.sx = null; return; }
      var p = project(n);
      n.sx = p.x; n.sy = p.y; n.k = p.k; n.sz = p.z;
      vis.push(n);
    });
    vis.sort(function (a, b) { return b.sz - a.sz; });   // xa vẽ trước

    /* Quầng cụm — chỉ ở chế độ phẳng, vì trong không gian 3D một vòng tròn phẳng đọc rất sai. */
    if (morph < 0.35) {
      nodes.forEach(function (n) {
        if (!n.hub || hidden[n.cat]) return;
        var col = CATS[n.cat].color;
        ctx.beginPath();
        ctx.arc(n.sx, n.sy, (n.cr2 + 16) * zoom * n.k, 0, 6.2832);
        ctx.fillStyle = col + '14'; ctx.fill();
        ctx.strokeStyle = col + '3A'; ctx.lineWidth = 1; ctx.stroke();
      });
    }

    /* Cạnh — độ mờ theo độ sâu để mắt đọc được trước/sau. */
    edges.forEach(function (e) {
      var a = nodes[IDX[e.s]], b = nodes[IDX[e.t]];
      if (a.sx == null || b.sx == null) return;
      var lit = focus && (e.s === focus || e.t === focus);
      var depth = (a.k + b.k) / 2;
      var alpha = lit ? 0.9 : (focus ? 0.05 : 0.10 + 0.14 * Math.min(1, Math.max(0, (depth - 0.7) / 0.7)));
      ctx.beginPath();
      ctx.moveTo(a.sx, a.sy); ctx.lineTo(b.sx, b.sy);
      ctx.strokeStyle = lit ? CATS[(BY_ID[focus] || a).cat].color : cLine;
      ctx.globalAlpha = alpha;
      ctx.lineWidth = lit ? 1.9 : 0.9;
      ctx.stroke();
    });
    ctx.globalAlpha = 1;

    /* Node. Nhãn KHÔNG vẽ ngay tại đây mà gom lại vẽ ở lượt cuối — nếu vẽ xen kẽ thì nút ở gần
       che mất nhãn của cụm ở xa, mà nhãn cụm là thứ phải luôn đọc được (ảnh chụp cho thấy rõ). */
    var labelAll = zoom > 0.8;   // đủ gần thì hiện nhãn mọi thuật ngữ
    var labels = [];
    vis.forEach(function (n) {
      var near = !focus || n.id === focus ||
                 (neighbors[focus] && neighbors[focus][n.id]) ||
                 (n.hub && BY_ID[focus] && 'HUB_' + BY_ID[focus].cat === n.id);
      var col = CATS[n.cat].color;
      var rad = (n.hub ? 12 : (n.id === selected ? 8 : 5.2)) * n.k * Math.max(0.55, Math.min(1.5, zoom));
      ctx.globalAlpha = near ? Math.min(1, 0.45 + 0.55 * n.k) : 0.16;

      ctx.beginPath(); ctx.arc(n.sx, n.sy, rad, 0, 6.2832);
      ctx.fillStyle = col; ctx.fill();
      if (n.id === selected) { ctx.strokeStyle = cInk; ctx.lineWidth = 2.4; ctx.stroke(); }
      else if (n.hub) { ctx.strokeStyle = cInk; ctx.globalAlpha *= 0.3; ctx.lineWidth = 1.4; ctx.stroke(); }

      var showLabel = n.hub || n.id === focus || (focus && neighbors[focus] && neighbors[focus][n.id]) || labelAll;
      if (showLabel) {
        labels.push({ n: n, rad: rad, alpha: near ? Math.min(1, 0.55 + 0.45 * n.k) : 0.14 });
      }
    });

    /* Lượt cuối: nhãn, có viền cùng màu nền để đọc được khi nằm trên đám nút phía sau.
       Nhãn cụm vẽ sau cùng nên không bao giờ bị che. */
    var cBg = tok('--card') || '#FFFFFF';
    labels.sort(function (a, b) { return (a.n.hub ? 1 : 0) - (b.n.hub ? 1 : 0); });
    ctx.textAlign = 'center'; ctx.textBaseline = 'top';
    ctx.lineJoin = 'round';
    labels.forEach(function (L) {
      var n = L.n;
      ctx.globalAlpha = L.alpha;
      ctx.font = (n.hub ? '800 ' : '600 ') + (n.hub ? 13 : 10.5) + 'px ' +
                 "'Be Vietnam Pro', system-ui, sans-serif";
      var lb = n.label.length > 30 ? n.label.slice(0, 29) + '…' : n.label;
      ctx.strokeStyle = cBg; ctx.lineWidth = n.hub ? 4 : 3;
      ctx.strokeText(lb, n.sx, n.sy + L.rad + 4);
      ctx.fillStyle = cInk;
      ctx.fillText(lb, n.sx, n.sy + L.rad + 4);
    });
    ctx.globalAlpha = 1;
  }

  /* ── Vòng lặp: chỉ chạy khi thật sự có gì đang động ── */
  function needLoop() { return auto || Math.abs(morph - morphTarget) > 0.001 || !!dragging; }
  function loop() {
    if (auto && !dragging) yaw += 0.0016;
    if (Math.abs(morph - morphTarget) > 0.001) morph += (morphTarget - morph) * 0.12;
    else morph = morphTarget;
    draw();
    if (needLoop()) requestAnimationFrame(loop); else looping = false;
  }
  function kick() { if (!looping && needLoop()) { looping = true; requestAnimationFrame(loop); } else draw(); }

  /* ── Chuột / cảm ứng ── */
  function nodeAt(mx, my) {
    var best = null, bd = 15 * 15;
    nodes.forEach(function (n) {
      if (n.sx == null || n.hub) return;
      var dx = n.sx - mx, dy = n.sy - my, d = dx * dx + dy * dy;
      if (d < bd) { bd = d; best = n; }
    });
    return best;
  }
  cv.addEventListener('pointerdown', function (e) {
    var r = cv.getBoundingClientRect();
    dragging = { x: e.clientX, y: e.clientY, yaw: yaw, pitch: pitch, panX: panX, panY: panY,
                 mx: e.clientX - r.left, my: e.clientY - r.top, moved: false, shift: e.shiftKey };
    cv.setPointerCapture(e.pointerId); cv.classList.add('dragging');
  });
  cv.addEventListener('pointermove', function (e) {
    var r = cv.getBoundingClientRect();
    var mx = e.clientX - r.left, my = e.clientY - r.top;
    if (dragging) {
      var dx = e.clientX - dragging.x, dy = e.clientY - dragging.y;
      if (Math.abs(dx) + Math.abs(dy) > 4) { dragging.moved = true; auto = false; }
      if (dragging.shift || morph < 0.35) {          // phẳng thì kéo là di chuyển, không quay
        panX = dragging.panX + dx; panY = dragging.panY + dy;
      } else {
        yaw = dragging.yaw + dx * 0.006;
        pitch = Math.max(-1.35, Math.min(1.35, dragging.pitch + dy * 0.006));
      }
      draw(); return;
    }
    var h = nodeAt(mx, my);
    var id = h ? h.id : null;
    if (id !== hover) { hover = id; cv.style.cursor = id ? 'pointer' : 'grab'; draw(); }
  });
  function endPtr(e) {
    if (dragging && !dragging.moved) {
      var n = nodeAt(dragging.mx, dragging.my);
      if (n) onPick(n.id);
    }
    dragging = null; cv.classList.remove('dragging');
    try { cv.releasePointerCapture(e.pointerId); } catch (x) {}
    kick();
  }
  cv.addEventListener('pointerup', endPtr);
  cv.addEventListener('pointercancel', endPtr);
  cv.addEventListener('pointerleave', function () { if (!dragging && hover) { hover = null; draw(); } });
  cv.addEventListener('wheel', function (e) {
    e.preventDefault();
    var r = cv.getBoundingClientRect();
    var mx = e.clientX - r.left - W / 2, my = e.clientY - r.top - H / 2;
    var f = e.deltaY < 0 ? 1.13 : 1 / 1.13;
    var z2 = Math.max(0.14, Math.min(3.4, zoom * f));
    f = z2 / zoom;
    panX = mx - (mx - panX) * f; panY = my - (my - panY) * f;
    zoom = z2; draw();
  }, { passive: false });

  /* ── Legend = bộ lọc nhóm ── */
  var legend = opt.legend;
  Object.keys(CATS).forEach(function (k) {
    var b = document.createElement('button');
    b.className = 'lg'; b.setAttribute('aria-pressed', 'true');
    b.innerHTML = '<i class="dot" style="background:' + CATS[k].color + '"></i>' + CATS[k].label +
      ' <span style="color:var(--t3);font-weight:600">' +
      TERMS.filter(function (t) { return t.cat === k; }).length + '</span>';
    b.addEventListener('click', function () {
      hidden[k] = !hidden[k];
      b.setAttribute('aria-pressed', String(!hidden[k]));
      draw();
    });
    legend.appendChild(b);
  });

  fit(); kick();          // tự vẽ ngay khi dựng — không phụ thuộc nơi gọi có nhớ gọi fit hay không

  return {
    draw: draw,
    fit: function () { fit(); kick(); },
    /* Số cạnh THẬT giữa các khái niệm (không tính cạnh nối về tâm cụm) — dùng cho số liệu ở header. */
    relCount: function () { return edges.filter(function (e) { return !e.hubEdge; }).length; },
    select: function (id) { selected = id; draw(); },
    zoomBy: function (f) { zoom = Math.max(0.14, Math.min(3.4, zoom * f)); draw(); },
    /* Chuyển 3D ⇄ phẳng: nội suy toạ độ nên người xem thấy được hai bố cục là cùng một dữ liệu. */
    setMode: function (is3d) {
      morphTarget = is3d ? 1 : 0;
      if (reduce) morph = morphTarget;
      auto = is3d && !reduce;
      kick();
      setTimeout(function () { fit(); kick(); }, reduce ? 0 : 420);
    },
    is3d: function () { return morphTarget === 1; },
    autoOn: function () { return auto; },
    toggleAuto: function () { auto = !auto && morphTarget === 1; kick(); return auto; },
    resize: function () { sizeCanvas(); fit(); kick(); }
  };
}
