/* Thư viện thuật ngữ Test Automation Kit — logic trang (vanilla, không dependency ngoài) */
(function () {
  'use strict';
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  var BY_ID = {};
  TERMS.forEach(function (t) { BY_ID[t.id] = t; });

  /* ─────────── Theme ─────────── */
  var themeBtn = $('#themeBtn');
  function currentDark() {
    var set = document.documentElement.getAttribute('data-theme');
    if (set) return set === 'dark';
    return window.matchMedia('(prefers-color-scheme: dark)').matches;
  }
  function paintThemeBtn() { themeBtn.textContent = currentDark() ? '☀️ Sáng' : '🌙 Tối'; }
  themeBtn.addEventListener('click', function () {
    document.documentElement.setAttribute('data-theme', currentDark() ? 'light' : 'dark');
    paintThemeBtn(); drawGraph();
  });
  paintThemeBtn();

  /* ─────────── Điều hướng mode ─────────── */
  var panels = { graph: $('#p-graph'), az: $('#p-az'), guide: $('#p-guide'), readme: $('#p-readme'),
                 course: $('#p-course'),
                 flash: $('#p-flash'), chal: $('#p-chal'), info: $('#p-info') };
  function show(mode) {
    Object.keys(panels).forEach(function (k) { panels[k].hidden = k !== mode; });
    $$('.mode').forEach(function (b) { b.setAttribute('aria-selected', String(b.dataset.mode === mode)); });
    if (mode === 'graph') { fitGraph(); drawGraph(); }
    if (mode === 'flash' && !quiz.deck.length) newQuiz();
    if (mode === 'chal' && !$('#slots').children.length) renderChallenge(true);
    if (mode === 'guide' && !$('#guideFlow').children.length) renderGuide();
    if (mode === 'readme' && !$('#archList').children.length) renderReadme();
    if (mode === 'course' && !$('#cParts').children.length) renderCourse();
  }
  $$('.mode').forEach(function (b) { b.addEventListener('click', function () { show(b.dataset.mode); }); });

  /* ─────────── Drawer chi tiết ─────────── */
  var scrim = $('#scrim'), drawer = $('#drawer');
  /* Ẩn hẳn cả khối khi thuật ngữ không có trường đó, thay vì để nhãn trống lơ lửng. */
  function fill(secSel, txtSel, val) {
    $(secSel).hidden = !val;
    if (val) $(txtSel).textContent = val;
  }
  function openTerm(id) {
    var t = BY_ID[id]; if (!t) return;
    var c = CATS[t.cat];
    $('#dChip').textContent = c.label;
    $('#dChip').style.background = c.color + '22';
    $('#dChip').style.color = c.color;
    /* Chip phụ: skill hiện phase, trạng thái hiện loại + ánh xạ AIO hoặc có log Jira không. */
    var meta = t.phase || [t.kind, t.aio ? 'AIO: ' + t.aio : '', t.log].filter(Boolean).join(' · ');
    $('#dMeta').hidden = !meta;
    $('#dMeta').textContent = meta || '';
    $('#dTitle').textContent = t.t;
    $('#dLead').textContent = t.def;
    $('#dDetail').textContent = t.detail;
    fill('#secWhy', '#dWhy', t.why);
    fill('#secEx', '#dEx', t.ex);
    fill('#secTrap', '#dTrap', t.trap);
    fill('#secCmd', '#dCmd', t.cmd);
    var how = $('#dHow'); how.innerHTML = '';
    (t.how || []).forEach(function (h) { var li = document.createElement('li'); li.textContent = h; how.appendChild(li); });
    $('#secHow').hidden = !(t.how && t.how.length);
    $('#dSrc').textContent = t.src;
    var rel = $('#dRel'); rel.innerHTML = '';
    (t.rel || []).filter(function (r) { return BY_ID[r]; }).forEach(function (r) {
      var b = document.createElement('button');
      b.textContent = BY_ID[r].t;
      b.addEventListener('click', function () { openTerm(r); });
      rel.appendChild(b);
    });
    $('#dRelWrap').hidden = !rel.children.length;
    scrim.classList.add('on'); drawer.classList.add('on');
    G.select(id);
    drawer.scrollTop = 0;
  }
  function closeDrawer() { scrim.classList.remove('on'); drawer.classList.remove('on'); G.select(null); }
  scrim.addEventListener('click', closeDrawer);
  $('#dClose').addEventListener('click', closeDrawer);
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape') closeDrawer(); });

  /* ─────────── Bản đồ khái niệm (module graph3d) ─────────── */
  var G = makeGraph({
    canvas: $('#graph'), legend: $('#legend'),
    terms: TERMS, cats: CATS, byId: BY_ID,
    onPick: function (id) { openTerm(id); }
  });
  function drawGraph() { G.draw(); }
  function fitGraph() { G.fit(); }

  var btn3d = $('#z3d');
  function paint3dBtn() {
    var on = G.is3d();
    btn3d.textContent = on ? '3D' : '2D';
    btn3d.setAttribute('aria-pressed', String(on));
    btn3d.title = on ? 'Đang ở chế độ 3D — bấm để xem phẳng' : 'Đang ở chế độ phẳng — bấm để xem 3D';
    $('#ghint3d').textContent = on
      ? 'Kéo để quay khối, giữ Shift và kéo để di chuyển, cuộn để phóng to. Nút mờ và nhỏ hơn là ở phía xa; tự quay dừng ngay khi bạn kéo lần đầu.'
      : 'Kéo để di chuyển, cuộn để phóng to. Sáu cụm nằm trên một mặt phẳng, có quầng bao quanh.';
  }
  btn3d.addEventListener('click', function () { G.setMode(!G.is3d()); paint3dBtn(); });
  paint3dBtn();

  $('#zin').addEventListener('click', function () { G.zoomBy(1.25); });
  $('#zout').addEventListener('click', function () { G.zoomBy(1 / 1.25); });
  $('#zfit').addEventListener('click', function () { G.fit(); });

  /* ─────────── A–Z ─────────── */
  var azWrap = $('#azList'), q = $('#q'), catSel = $('#catSel');
  Object.keys(CATS).forEach(function (k) {
    var o = document.createElement('option'); o.value = k; o.textContent = CATS[k].label; catSel.appendChild(o);
  });
  /* Bỏ dấu để tìm kiếm. NFD tách được dấu thanh và dấu mũ, nhưng KHÔNG tách đ/Đ — đó là chữ cái
     riêng chứ không phải d cộng dấu. Thiếu bước thay này thì gõ không dấu vẫn không ra những từ có đ
     (Playwright bắt được: tìm "doc lap" không ra "độc lập"). */
  function norm(s) {
    return String(s).normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .replace(/đ/g, 'd').replace(/Đ/g, 'D').toLowerCase();
  }
  function renderAZ() {
    var kw = norm(q.value.trim()), cat = catSel.value;
    var list = TERMS.filter(function (t) {
      if (cat && t.cat !== cat) return false;
      if (!kw) return true;
      var hay = [t.t, t.def, t.detail, t.why, t.ex, t.trap, t.cmd, t.src].concat(t.how || []).join(' ');
      return norm(hay).indexOf(kw) >= 0;
    }).sort(function (a, b) { return a.t.localeCompare(b.t, 'vi'); });

    $('#azCount').textContent = list.length + ' / ' + TERMS.length + ' thuật ngữ';
    azWrap.innerHTML = '';
    if (!list.length) { azWrap.innerHTML = '<div class="empty">Không có thuật ngữ nào khớp.</div>'; $('#azBar').innerHTML = ''; return; }

    var groups = {};
    list.forEach(function (t) {
      var L = norm(t.t)[0].toUpperCase();
      if (!/[A-Z]/.test(L)) L = '#';
      (groups[L] = groups[L] || []).push(t);
    });
    var keys = Object.keys(groups).sort();
    $('#azBar').innerHTML = keys.map(function (L) { return '<a href="#az-' + L + '">' + L + '</a>'; }).join('');
    keys.forEach(function (L) {
      var sec = document.createElement('section');
      sec.className = 'azgroup'; sec.id = 'az-' + L;
      sec.innerHTML = '<div class="azletter"><b>' + L + '</b><i></i></div>';
      var grid = document.createElement('div'); grid.className = 'cards';
      groups[L].forEach(function (t) {
        var c = CATS[t.cat];
        var btn = document.createElement('button');
        btn.className = 'tcard'; btn.style.borderTopColor = c.color;
        btn.innerHTML = '<span class="chip" style="background:' + c.color + '22;color:' + c.color + '">' +
          c.label + '</span><h3></h3><p></p><p class="why"></p><span class="cfoot"></span>';
        btn.querySelector('h3').textContent = t.t;
        btn.querySelector('p').textContent = t.def;
        /* Dòng thứ hai lấy vế đầu của "vì sao cần" — để danh sách A–Z tự nó đã có nội dung,
           không phải mở drawer mới biết thuật ngữ này để làm gì. */
        var raw = t.why || t.detail || '';
        var cut = raw.indexOf('. ');
        var teaser = cut > 40 ? raw.slice(0, cut + 1) : raw;
        btn.querySelector('.why').textContent = teaser.length > 150 ? teaser.slice(0, 149) + '…' : teaser;
        btn.querySelector('.cfoot').textContent = t.src;
        btn.addEventListener('click', function () { openTerm(t.id); });
        grid.appendChild(btn);
      });
      sec.appendChild(grid); azWrap.appendChild(sec);
    });
  }
  q.addEventListener('input', renderAZ);
  catSel.addEventListener('change', renderAZ);
  renderAZ();

  /* ─────────── Flashcard ─────────── */
  var quiz = { deck: [], i: 0, score: 0, flipped: false };
  function newQuiz() {
    var pool = TERMS.slice();
    for (var i = pool.length - 1; i > 0; i--) { var j = Math.floor(Math.random() * (i + 1)); var t = pool[i]; pool[i] = pool[j]; pool[j] = t; }
    quiz = { deck: pool.slice(0, 10), i: 0, score: 0, flipped: false };
    renderQuiz();
  }
  function renderQuiz() {
    var box = $('#fcBox');
    if (quiz.i >= quiz.deck.length) {
      box.innerHTML = '<div class="score"><div class="big">' + quiz.score + '/' + quiz.deck.length + '</div>' +
        '<p>' + (quiz.score >= 8 ? 'Nắm chắc rồi.' : quiz.score >= 5 ? 'Ổn — xem lại vài thuật ngữ ở tab A–Z.' : 'Nên đọc lại tab A–Z trước khi thi lại.') + '</p>' +
        '<div class="fcbtns"><button class="btn pri" id="again">Bộ 10 thẻ mới</button></div></div>';
      $('#again').addEventListener('click', newQuiz);
      $('#fcProg').style.width = '100%';
      $('#fcPos').textContent = 'Xong';
      $('#fcScore').textContent = 'Điểm ' + quiz.score;
      return;
    }
    var t = quiz.deck[quiz.i], c = CATS[t.cat];
    $('#fcPos').textContent = 'Thẻ ' + (quiz.i + 1) + '/' + quiz.deck.length;
    $('#fcScore').textContent = 'Điểm ' + quiz.score;
    $('#fcProg').style.width = (quiz.i / quiz.deck.length * 100) + '%';
    box.innerHTML = '';
    var card = document.createElement('div'); card.className = 'fcard';
    var head = document.createElement('div'); head.className = 'fcq';
    head.textContent = 'Nhóm ' + c.label + ' — đây là thuật ngữ gì?';
    head.style.color = c.color;
    var def = document.createElement('div'); def.className = 'fcdef'; def.textContent = t.def;
    card.appendChild(head); card.appendChild(def);
    if (quiz.flipped) {
      var ans = document.createElement('div'); ans.className = 'fcans';
      var h = document.createElement('h3'); h.textContent = t.t;
      var p = document.createElement('p'); p.textContent = t.detail;
      ans.appendChild(h); ans.appendChild(p); card.appendChild(ans);
    }
    var btns = document.createElement('div'); btns.className = 'fcbtns';
    if (!quiz.flipped) {
      btns.innerHTML = '<button class="btn pri" id="flip">Lật thẻ</button>';
    } else {
      btns.innerHTML = '<button class="btn ok" id="yes">✓ Tôi đoán đúng</button>' +
        '<button class="btn no" id="no">✗ Chưa nhớ</button>' +
        '<button class="btn" id="more">Xem đầy đủ</button>';
    }
    card.appendChild(btns);
    box.appendChild(card);
    if (!quiz.flipped) $('#flip').addEventListener('click', function () { quiz.flipped = true; renderQuiz(); });
    else {
      $('#yes').addEventListener('click', function () { quiz.score++; quiz.i++; quiz.flipped = false; renderQuiz(); });
      $('#no').addEventListener('click', function () { quiz.i++; quiz.flipped = false; renderQuiz(); });
      $('#more').addEventListener('click', function () { openTerm(t.id); });
    }
  }
  $('#fcNew').addEventListener('click', newQuiz);

  /* ─────────── QA Challenge ─────────── */
  var locks = {}, picked = {};
  function renderChallenge(all) {
    var box = $('#slots'); box.innerHTML = '';
    CHALLENGE.forEach(function (dim) {
      if (all || !locks[dim.key] || !picked[dim.key]) {
        if (!locks[dim.key] || !picked[dim.key]) picked[dim.key] = dim.values[Math.floor(Math.random() * dim.values.length)];
      }
      var d = document.createElement('div');
      d.className = 'slot' + (locks[dim.key] ? ' locked' : '');
      d.innerHTML = '<span class="ic">' + dim.icon + '</span><div class="mid">' +
        '<div class="lb"></div><div class="vl"></div></div>' +
        '<button class="lockbtn" aria-pressed="' + (locks[dim.key] ? 'true' : 'false') +
        '" title="Khoá tiêu chí này">' + (locks[dim.key] ? '🔒' : '🔓') + '</button>';
      d.querySelector('.lb').textContent = dim.label;
      d.querySelector('.vl').textContent = picked[dim.key];
      d.querySelector('.lockbtn').addEventListener('click', function () {
        locks[dim.key] = !locks[dim.key]; renderChallenge(false);
      });
      box.appendChild(d);
    });
  }
  $('#roll').addEventListener('click', function () {
    CHALLENGE.forEach(function (dim) { if (!locks[dim.key]) picked[dim.key] = null; });
    renderChallenge(false);
  });

  /* ─────────── Tab Hướng dẫn ─────────── */
  function el(tag, cls, txt) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (txt != null) e.textContent = txt;
    return e;
  }
  function renderGuide() {
    var flow = $('#guideFlow');
    FLOW_STEPS.forEach(function (s) {
      var row = el('div', 'fstep');
      var rail = el('div', 'frail');
      rail.appendChild(el('span', 'fnum', s.n));
      var card = el('div', 'fcard2');
      var head = el('div', 'fhead');
      head.appendChild(el('h4', null, s.title));
      head.appendChild(el('span', 'who', s.who));
      card.appendChild(head);
      card.appendChild(el('p', 'fgoal', s.goal));
      if (s.out && s.out[0] !== '—') {
        var outs = el('div', 'fouts');
        outs.appendChild(el('b', null, 'Ra được'));
        s.out.forEach(function (o) { outs.appendChild(el('span', 'pill', o)); });
        card.appendChild(outs);
      }
      if (s.cmd) {
        var pre = el('pre', 'cmd'); pre.appendChild(el('code', null, s.cmd)); card.appendChild(pre);
      }
      if (s.gate) {
        var g = el('div', 'fgate');
        g.appendChild(el('b', null, 'Cổng chặn'));
        g.appendChild(el('span', null, s.gate));
        card.appendChild(g);
      }
      row.appendChild(rail); row.appendChild(card);
      flow.appendChild(row);
    });

    var setup = $('#guideSetup');
    SETUP_CARDS.forEach(function (s) {
      var c = el('div', 'scard');
      c.appendChild(el('span', 'sico', s.icon));
      c.appendChild(el('h4', null, s.title));
      var ul = el('ul');
      s.items.forEach(function (i) { var li = el('li'); li.appendChild(el('code', null, i)); ul.appendChild(li); });
      c.appendChild(ul);
      c.appendChild(el('p', 'snote', s.note));
      setup.appendChild(c);
    });

    var tb = $('#guideTrouble');
    TROUBLES.forEach(function (t) {
      var r = el('div', 'trow' + (t.hot ? ' hot' : ''));
      var a = el('div', 'tp'); a.appendChild(el('b', null, t.p)); r.appendChild(a);
      var b = el('div', 'tc'); b.appendChild(el('span', 'tlab', 'Nguyên nhân')); b.appendChild(el('span', null, t.c)); r.appendChild(b);
      var d = el('div', 'tf'); d.appendChild(el('span', 'tlab', 'Cách xử lý')); d.appendChild(el('span', null, t.f)); r.appendChild(d);
      tb.appendChild(r);
    });

    var ck = $('#guideCheck');
    CHECKLISTS.forEach(function (c) {
      var box = el('div', 'ckbox');
      var h = el('div', 'ckhead');
      h.appendChild(el('span', 'ckico', c.icon));
      h.appendChild(el('b', null, c.role));
      box.appendChild(h);
      c.rows.forEach(function (r) {
        var row = el('div', 'ckrow');
        row.appendChild(el('span', 'ckk', r[0]));
        row.appendChild(el('span', 'ckv', r[1]));
        box.appendChild(row);
      });
      ck.appendChild(box);
    });
  }

  /* ─────────── Tab Readme ─────────── */
  function renderReadme() {
    var arch = $('#archList');
    ARCH_LAYERS.forEach(function (a) {
      var r = el('div', 'arow');
      r.style.borderLeftColor = a.c;
      var k = el('div', 'akey', a.k); k.style.color = a.c;
      r.appendChild(k);
      r.appendChild(el('div', 'aval', a.d));
      arch.appendChild(r);
    });

    var tree = $('#treeBox');
    TREE.forEach(function (t) {
      var r = el('div', 'trow2 ' + t[3]);
      r.style.paddingLeft = (14 + t[0] * 22) + 'px';
      r.appendChild(el('code', null, t[1]));
      r.appendChild(el('span', 'tdesc', t[2]));
      tree.appendChild(r);
    });

    var out = $('#outList');
    OUTPUT_DIRS.forEach(function (o) {
      var c = el('div', 'scard');
      var h = el('h4'); h.appendChild(el('code', null, o[0])); c.appendChild(h);
      c.appendChild(el('p', 'snote', o[1]));
      out.appendChild(c);
    });

    var xr = $('#tmsList');   // danh sách mô hình TMS (AIO Tests)
    TMS_MODEL.forEach(function (x, i) {
      var r = el('div', 'xrow');
      r.appendChild(el('span', 'xn', String(i + 1)));
      var mid = el('div', 'xmid');
      mid.appendChild(el('b', null, x.k));
      mid.appendChild(el('span', 'xd', x.d));
      mid.appendChild(el('span', 'xnote', x.note));
      r.appendChild(mid);
      xr.appendChild(r);
    });

    var cl = $('#cmdList');
    CMD_GROUPS.forEach(function (g) {
      var box = el('div', 'cmdgrp');
      box.appendChild(el('b', 'cmdg', g.g));
      g.items.forEach(function (it) {
        var r = el('div', 'cmdrow');
        var pre = el('pre', 'cmd'); pre.appendChild(el('code', null, it[0]));
        r.appendChild(pre);
        r.appendChild(el('span', 'cmddesc', it[1]));
        box.appendChild(r);
      });
      cl.appendChild(box);
    });

    var pr = $('#pracList');
    PRACTICES.forEach(function (p) {
      var box = el('div', 'prbox ' + p.lv);
      box.appendChild(el('b', 'prhead', p.t));
      var ul = el('ul');
      p.items.forEach(function (i) { ul.appendChild(el('li', null, i)); });
      box.appendChild(ul);
      pr.appendChild(box);
    });
  }

  /* "Bạn sẽ dựng cái gì": cho thấy MỘT LẦN kit chặn trông ra sao, trước mọi lý thuyết.
     Người mới cần một hình ảnh cụ thể để bám vào, không cần thêm một đoạn định nghĩa. */
  function renderDemo() {
    var pre = $('#cDemo');
    if (!pre || !COURSE.demo) return;
    /* Tô màu theo dòng, KHÔNG dùng innerHTML trên nội dung gốc — nội dung do người viết,
       không được coi là markup. */
    COURSE.demo.split('\n').forEach(function (dong) {
      var lop = dong.indexOf('$ ') === 0 ? 'dlenh'
        : (dong.indexOf('✗') >= 0 || dong.indexOf('CHẶN') >= 0) ? 'dchan'
          : dong.indexOf('mã thoát') >= 0 ? 'dma' : 'dthuong';
      var l = el('span', lop, dong || ' ');
      pre.appendChild(l);
      pre.appendChild(document.createTextNode('\n'));
    });
  }

  /* Bốn mốc dừng được: thứ giữ người mới khỏi nản khi thấy tổng thời lượng.
     Mốc trọng tâm (⭐) tô nổi — đó là điểm dừng mà nhiều người sẽ dùng cả năm. */
  function renderMilestones() {
    var wrap = $('#cMoc');
    if (!wrap) return;
    COURSE.milestones.forEach(function (m, i) {
      var box = el('div', 'mcbox' + (m.trongTam ? ' key' : ''));
      var h = el('div', 'mchead');
      h.appendChild(el('b', null, m.ten));
      h.appendChild(el('span', 'mcdur', m.congDon));
      box.appendChild(h);
      box.appendChild(el('span', 'mcto', m.toiBai));
      box.appendChild(el('p', null, m.coGi));
      wrap.appendChild(box);
      if (i < COURSE.milestones.length - 1) wrap.appendChild(el('div', 'mcar', '→'));
    });
  }

  /* Lộ trình 8 phần: thanh giờ theo TỈ LỆ để thấy ngay phần nào nặng — bảng số không cho thấy điều đó. */
  function renderRoadmap() {
    var wrap = $('#cRoad');
    var gioMax = Math.max.apply(null, COURSE.parts.map(function (p) { return parseFloat(p.hours) || 0; }));
    COURSE.parts.forEach(function (p, i) {
      var gio = parseFloat(p.hours) || 0;
      var sao = p.lessons.filter(function (l) { return l.star; }).length;

      var box = el('div', 'rdpart');
      var head = el('div', 'rdhead');
      head.appendChild(el('span', 'rdnum', p.n));
      head.appendChild(el('b', null, p.title));
      box.appendChild(head);

      /* Thanh giờ: rộng theo tỉ lệ với phần nặng nhất. */
      var bar = el('div', 'rdbar');
      var fill = el('i');
      fill.style.width = (gioMax ? (gio / gioMax) * 100 : 0).toFixed(1) + '%';
      bar.appendChild(fill);
      box.appendChild(bar);

      var meta = el('div', 'rdmeta');
      meta.appendChild(el('span', null, gio + ' giờ'));
      meta.appendChild(el('span', null, p.lessons.length + ' bài'));
      if (sao) meta.appendChild(el('span', 'rdstar', '★ ' + sao + ' bài trọng tâm'));
      box.appendChild(meta);

      /* Chấm bài: mỗi bài một chấm, bấm được để nhảy tới. Nhìn một cái là thấy phần dài ngắn. */
      var dots = el('div', 'rddots');
      p.lessons.forEach(function (l) {
        var d = el('button', 'rddot' + (l.star ? ' star' : ''), l.n);
        d.title = 'Bài ' + l.n + ' — ' + l.title + ' (' + l.dur + ')';
        d.addEventListener('click', function () {
          var t = document.getElementById('bai-' + l.n);
          if (t) { t.scrollIntoView({ behavior: 'smooth', block: 'center' }); t.classList.add('nhay');
                   setTimeout(function () { t.classList.remove('nhay'); }, 1600); }
        });
        dots.appendChild(d);
      });
      box.appendChild(dots);

      wrap.appendChild(box);
      if (i < COURSE.parts.length - 1) wrap.appendChild(el('div', 'rdarrow', '→'));
    });
  }

  /* Vòng làm việc: 6 chặng nối nhau, mỗi chặng gắn CỔNG CHẶN của nó. Chặng cuối quay về chặng đầu. */
  function renderFlow() {
    var wrap = $('#cFlow');
    COURSE.workflow.forEach(function (w) {
      var box = el('div', 'wfstep');
      var h = el('div', 'wfhead');
      h.appendChild(el('span', 'wfnum', w.n));
      h.appendChild(el('b', null, w.stage));
      box.appendChild(h);

      var io = el('div', 'wfio');
      io.appendChild(el('span', 'wfin', w.input));
      io.appendChild(el('span', 'wfar', '↓'));
      io.appendChild(el('span', 'wfout', w.output));
      box.appendChild(io);

      var g = el('div', 'wfgate');
      g.appendChild(el('b', null, 'CỔNG'));
      g.appendChild(el('span', null, w.gate));
      box.appendChild(g);

      if (w.lessons) box.appendChild(el('span', 'cfile', w.lessons));
      wrap.appendChild(box);
    });
    var vong = el('p', 'wfloop');
    vong.appendChild(el('b', null, '↻ '));
    vong.appendChild(document.createTextNode(
      'Chặng ' + COURSE.workflow.length + ' quay về chặng 1 của task sau — đó là chỗ kit tốt lên thay vì chỉ chạy.'));
    wrap.appendChild(vong);
  }

  /* ─────────── Tab Tự dựng kit (dữ liệu sinh từ docs/COURSE.md) ─────────── */
  function renderCourse() {
    var allLessons = COURSE.parts.reduce(function (a, p) { return a.concat(p.lessons); }, []);
    var withLesson = allLessons.filter(function (l) { return l.href; }).length;
    var practices = allLessons.reduce(function (a, l) {
      return a + l.bullets.filter(function (b) { return b.kind === 'practice'; }).length;
    }, 0);
    var gates = allLessons.reduce(function (a, l) {
      return a + l.bullets.filter(function (b) { return b.kind === 'gate'; }).length;
    }, 0);

    var st = $('#cStats');
    [['bài', COURSE.lessonCount], ['phần', COURSE.parts.length],
     ['bài đã có bài giảng', withLesson], ['lượt thực hành', practices],
     ['gate tự xây', gates]].forEach(function (p) {
      var d = el('div');
      d.appendChild(el('b', null, String(p[1])));
      d.appendChild(el('span', null, p[0]));
      st.appendChild(d);
    });

    /* Định vị + câu hỏi cốt lõi: hai câu quyết định người đọc có phải đối tượng của khoá không. */
    var mt = $('#cMeta');
    [['Định vị', COURSE.positioning], ['Câu hỏi cốt lõi', COURSE.coreQuestion],
     ['Bắt buộc biết trước', COURSE.required], ['Không bắt buộc', COURSE.notRequired],
     ['Thời lượng', COURSE.total]].forEach(function (r) {
      if (!r[1]) return;
      var row = el('div', 'cmrow');
      row.appendChild(el('b', null, r[0]));
      row.appendChild(el('span', null, r[1]));
      mt.appendChild(row);
    });
    if (COURSE.warning) {
      var w = el('div', 'cwarn');
      w.appendChild(el('b', null, 'Nói thẳng'));
      w.appendChild(el('span', null, COURSE.warning));
      mt.appendChild(w);
    }

    /* Bảng so sánh với khoá khác — cột "tài liệu này" tô đậm để thấy ngay khác biệt. */
    if (COURSE.compare.length) {
      var cmpWrap = $('#cCompare');
      COURSE.compare.forEach(function (r) {
        var row = el('div', 'ccmp');
        row.appendChild(el('b', null, r.aspect));
        row.appendChild(el('span', 'cother', r.others));
        row.appendChild(el('span', 'cours', r.ours));
        cmpWrap.appendChild(row);
      });
    }

    /* Ba bug cài sẵn của app thực hành — đây là ĐỐI CHỨNG của cả tài liệu này, nên để nổi. */
    if (COURSE.practiceBugs.length) {
      var bw = $('#cBugs');
      COURSE.practiceBugs.forEach(function (b) {
        var box = el('div', 'cbug');
        var h = el('div', 'cbhead');
        h.appendChild(el('h4', null, b.bug));
        h.appendChild(el('span', 'chip', b.layer));
        box.appendChild(h);
        var bl = el('p', 'cbblind');
        bl.appendChild(el('b', null, 'Bộ kiểm mù vì: '));
        bl.appendChild(document.createTextNode(b.blind));
        box.appendChild(bl);
        box.appendChild(el('span', 'cfile', 'bắt được ở ' + b.where));
        bw.appendChild(box);
      });
    }

    renderDemo();
    renderMilestones();
    renderRoadmap();
    renderFlow();

    /* Cây thư mục: in NGUYÊN VĂN trong <pre> để giữ thụt lề — dùng textContent, không innerHTML,
       vì cây có ký tự │ ├ └ và chú thích do người viết, không được coi là markup. */
    if (COURSE.kitTree) {
      $('#cTree').textContent = COURSE.kitTree;
    }
    if (COURSE.sortRules.length) {
      var sw = $('#cSort');
      COURSE.sortRules.forEach(function (r) {
        var box = el('div', 'csort');
        box.appendChild(el('code', null, r.dir));
        box.appendChild(el('p', null, r.holds));
        var qq = el('p', 'csortq');
        qq.appendChild(el('b', null, 'Câu hỏi phân loại: '));
        qq.appendChild(document.createTextNode(r.question));
        box.appendChild(qq);
        sw.appendChild(box);
      });
    }

    /* Mục tiêu cấp khoá */
    if (COURSE.outcomes.length) {
      var ow = $('#cOutcomes');
      COURSE.outcomes.forEach(function (o) { ow.appendChild(el('li', null, o)); });
    }

    var wrap = $('#cParts');
    COURSE.parts.forEach(function (part) {
      var h = el('h3', 'subhead');
      h.appendChild(el('span', 'num', part.n));
      h.appendChild(document.createTextNode(part.title));
      if (part.hours) h.appendChild(el('span', 'cphours', part.hours));
      wrap.appendChild(h);
      if (part.xong) {
        var xg = el('p', 'pxong');
        xg.appendChild(el('b', null, 'Xong phần này bạn có: '));
        xg.appendChild(document.createTextNode(part.xong));
        wrap.appendChild(xg);
      }

      var grid = el('div', 'clessons');
      part.lessons.forEach(function (l) {
        /* Bài đã có bài giảng chi tiết thì viền vàng — người đọc thấy ngay chỗ nào mở được luôn.
           KHÔNG đặt thẻ <a>: trang là một file rời, đường dẫn tương đối tới repo sẽ chết. */
        var c = el('div', 'clesson' + (l.href ? ' ready' : '') + (l.star ? ' star' : ''));
        c.id = 'bai-' + l.n;
        var head = el('div', 'chead');
        head.appendChild(el('span', 'cnum', l.n));
        var t = el('h4', null, l.title);
        if (l.star) t.appendChild(el('span', 'cstar', '★'));
        head.appendChild(t);
        head.appendChild(el('span', 'cdur', l.dur));
        /* Class không dấu để selector CSS khỏi phải escape; chữ hiển thị vẫn giữ nguyên dấu. */
        var MA_MUC = { 'dễ': 'de', 'vừa': 'vua', 'khó': 'kho' };
        if (l.muc) head.appendChild(el('span', 'cmuc m-' + (MA_MUC[l.muc] || 'vua'), l.muc));
        c.appendChild(head);

        var have = el('p', 'chave');
        have.appendChild(el('b', null, 'Có gì trong tay: '));
        have.appendChild(document.createTextNode(l.have));
        c.appendChild(have);

        /* Bullet Thực hành / XÂY gate được tô khác: người đọc phân biệt ngay
           "bài này chỉ đọc" với "bài này phải gõ". */
        var ul = el('ul', 'cgoals');
        l.bullets.forEach(function (b) {
          var li = el('li', b.kind === 'point' ? null : 'c' + b.kind);
          if (b.kind === 'practice') li.appendChild(el('b', null, 'Thực hành: '));
          if (b.kind === 'gate') li.appendChild(el('b', null, 'XÂY gate: '));
          li.appendChild(document.createTextNode(b.text));
          ul.appendChild(li);
        });
        c.appendChild(ul);

        if (l.href) c.appendChild(el('span', 'cfile', 'docs/' + l.href));
        grid.appendChild(c);
      });
      wrap.appendChild(grid);
    });

    /* Bài giảng đã viết mà chưa có chỗ trong giáo trình — nêu thẳng thay vì để lẫn. */
    if (COURSE.orphans.length) {
      var orw = $('#cOrphans');
      COURSE.orphans.forEach(function (o) {
        var box = el('div', 'corphan');
        box.appendChild(el('h4', null, o.title));
        box.appendChild(el('p', null, o.what));
        var s = el('p', 'csuggest');
        s.appendChild(el('b', null, 'Được dạy ở: '));
        s.appendChild(document.createTextNode(o.suggest));
        box.appendChild(s);
        box.appendChild(el('span', 'cfile', 'docs/' + o.href));
        orw.appendChild(box);
      });
    }

    /* Quyết định thiết kế: phần trả lời "vì sao khoá dựng thế này", không phải nội dung dạy. */
    if (COURSE.decisions.length) {
      var dw = $('#cDecisions');
      COURSE.decisions.forEach(function (d) {
        var box = el('div', 'cdec');
        var hh = el('h4', null, null);
        hh.appendChild(el('span', 'cnum', d.n));
        hh.appendChild(document.createTextNode(d.title));
        box.appendChild(hh);
        box.appendChild(el('p', null, d.body));
        dw.appendChild(box);
      });
    }

    if (COURSE.deliverables.length) {
      var vw = $('#cDeliver');
      COURSE.deliverables.forEach(function (d) { vw.appendChild(el('li', null, d)); });
    }
  }

  /* ─────────── Số liệu ở header/info ─────────── */
  $$('[data-stat="terms"]').forEach(function (e) { e.textContent = TERMS.length; });
  $$('[data-stat="links"]').forEach(function (e) { e.textContent = G.relCount(); });
  Object.keys(CATS).forEach(function (k) {
    $$('[data-stat="cat-' + k + '"]').forEach(function (e) { e.textContent = TERMS.filter(function (t) { return t.cat === k; }).length; });
  });

  window.addEventListener('resize', function () { if (!panels.graph.hidden) G.resize(); });
  show('graph');
})();
