/* Dữ liệu cho 2 tab tài liệu: Hướng dẫn (USER_GUIDE.md) và Readme (README.md + QUICKSTART.md).
   Cấu trúc hoá để render thành sơ đồ / thẻ / bảng thay vì đổ markdown thô. */

/* ── Luồng chính: 8 chặng, mỗi chặng là 1 thẻ trong stepper dọc ── */
const FLOW_STEPS = [
  { n:'0', k:'scope', title:'Xác định scope', who:'QA',
    goal:'Chốt task nào, phạm vi tới đâu, rủi ro module nào cao.',
    out:['risk register (suggest-only)','phạm vi module + chiều coverage bắt buộc'],
    cmd:'npm run profile:create -- <TASK_KEY>',
    gate:'Chưa rõ TASK_KEY và PROJECT_OUTPUT_DIR thì chưa chạy gì cả.' },

  { n:'1', k:'phase1', title:'Phase 1 — Sinh testcase', who:'AI Agent + QA',
    goal:'Đọc Backlog/tài liệu nguồn/Figma/Swagger, phân tích, hỏi cho rõ, rồi sinh bộ testcase.',
    out:['testcase Markdown','Excel canonical (7 cột bắt buộc)','phase1-summary.md','Setup Strategy contract (PRE-NN)','task.md'],
    cmd:'/phase1 <TASK_KEY>',
    gate:'Ambiguity Gate — còn chỗ mơ hồ thì DỪNG, gộp câu hỏi hỏi BA rồi mới gen.' },

  { n:'2', k:'review', title:'Review Phase 1', who:'QA Member + QA Lead',
    goal:'Coverage đủ chưa, rủi ro chấp nhận được chưa, case có execute được không.',
    out:['Final Decision','danh sách High/Critical gap cần BA/BE/UIUX trả lời'],
    cmd:'npm run design:gate -- --dir <test-cases/> --with-rows',
    gate:'Chưa review xong thì KHÔNG chạy Phase 2 — tránh execute trên expected sai.' },

  { n:'3', k:'publish', title:'Publish lên Google Sheet', who:'QA',
    goal:'Đưa testcase từ Excel canonical lên Google Sheet để cả team thấy và để Phase 2 kéo về.',
    out:['Case trên Google Sheet + folder theo nhóm chức năng','publish summary'],
    cmd:'node scripts/convert_excel/md_to_xlsx.js <testcase.md> <testcase.xlsx>  ·  upload qua Drive MCP',
    gate:'Dry-run trước — Sheet ghi đè toàn bộ mỗi lần sync. Publish thật chỉ sau khi QA xác nhận Excel.' },

  { n:'4', k:'wait', title:'Chờ Dev implement', who:'Dev',
    goal:'Tính năng phải có thật thì mới execute được.',
    out:['—'],
    gate:'Đây là điểm dừng có chủ ý, không phải thời gian chết: dùng để dựng precondition và chuẩn bị fixture.' },

  { n:'5', k:'phase2', title:'Phase 2 — Execute', who:'AI Agent + QA',
    goal:'Kéo testcase từ Google Sheet, dựng tiền điều kiện, chạy thật, thu evidence.',
    out:['Playwright results','evidence ảnh/video','execution-summary.md','testcase-status.json','expansion-plan.md'],
    cmd:'/phase2 <TASK_KEY>   (gate: /preflight <TASK_KEY>)',
    gate:'preflight_gate phải xanh trước. Execute KHÔNG chỉ bám chữ trong case — phải mở rộng 5 trục quanh nó theo risk band.' },

  { n:'5b', k:'push', title:'Đẩy kết quả lên Google Sheet', who:'QA',
    goal:'Tạo cycle, gắn trạng thái và evidence theo từng bước của case.',
    out:['sheet kết quả execution','evidence neo đúng bước'],
    cmd:'npm run merge:execution-status -- --task <TASK_KEY>',
    gate:'Chạy HAI gate trước khi ghi: chất lượng output, và kế hoạch mở rộng 5 trục. Task có case band high đã execute mà chưa có reports/expansion-plan.md thì CHẶN — gỡ bằng npm run expansion:plan.' },

  { n:'6', k:'triage', title:'Triage fail/skip', who:'QA',
    goal:'Phân loại từng FAIL: lỗi sản phẩm, lỗi API, lỗi setup, lỗi script, chập chờn hay hạ tầng.',
    out:['tầng lỗi cho từng case','danh sách bug ứng viên'],
    gate:'Rerun 2–3 lần trước. setup_failure và script_error KHÔNG log Backlog.' },

  { n:'7', k:'bug', title:'Log Backlog bug', who:'QA',
    goal:'Tạo sub-bug cho những lỗi sản phẩm đã xác nhận, gán đúng tầng FE/BE.',
    out:['Backlog sub-bug + evidence ảnh/video'],
    cmd:'npm run backlog:bug-report:dry-run -- …',
    gate:'output_gate soi trước khi push: đủ 4 phần mô tả, có evidence, case phức tạp phải có video.' },

  { n:'8', k:'rerun', title:'Re-run sau khi Dev fix', who:'QA',
    goal:'Xác nhận lỗi đã hết trên bản build mới.',
    out:['rerun report','evidence PASS','Backlog chuyển Done nếu PASS thật'],
    cmd:'/rerun <TASK_KEY>',
    gate:'Chỉ chuyển Done khi có evidence PASS. Kết quả rerun hết hạn nếu có deploy chen vào.' }
];

/* ── Chuẩn bị môi trường ── */
const SETUP_CARDS = [
  { icon:'⬢', title:'Node.js + dependencies',
    items:['npm install','npx playwright install'],
    note:'Playwright cần tải browser riêng, không nằm trong npm install.' },
  { icon:'⌨', title:'VS Code + AI chat extension',
    items:['Mở đúng thư mục root test-automation-kit_v2'],
    note:'Mở sai folder là nguyên nhân số một của lỗi "AI không tìm thấy file".' },
  { icon:'🔌', title:'MCP server',
    items:['Backlog / tài liệu nguồn','Figma','các nguồn tài liệu khác'],
    note:'Cấu hình ở .agent/config/mcp_config.md.' },
  { icon:'🔑', title:'Env và quyền truy cập',
    items:['.env.example → .env.local hoặc .env (giá trị TĨNH)','profiles/<TASK_KEY>/task.env (giá trị ĐỘNG theo task)'],
    note:'Creds của task nằm ở task.env, KHÔNG ở .env chung.' },
  { icon:'🔄', title:'Đồng bộ kit',
    items:['Pull bản mới nhất qua GitLab/GitHub','Đọc CHANGELOG.md sau mỗi lần pull'],
    note:'Hành vi lạ sau khi pull thì tra CHANGELOG trước khi nghi kit hỏng.' },
  { icon:'📋', title:'Thông tin bắt buộc mỗi lần chạy',
    items:['TASK_KEY','PROJECT_OUTPUT_DIR','link tài liệu nguồn'],
    note:'Thiếu một trong ba thì output đổ nhầm chỗ hoặc chạy trên nền sai.' },
  { icon:'⌘', title:'Slash command — điểm vào gõ được',
    items:['/phase1 · /phase2 · /rerun · /partial-rerun','/publish · /preflight · /gates','/explore · /ui-debug'],
    note:'Mỗi lệnh nạp đúng thứ tự file phải đọc và gate phải chạy — không phải tự nhớ. Không thay thế gate, chỉ dẫn đúng đường.' }
];

/* ── Lỗi thường gặp (USER_GUIDE §10) ── */
const TROUBLES = [
  { p:'AI không tìm thấy file', c:'Mở sai folder trong VS Code.', f:'Mở đúng root test-automation-kit_v2.' },
  { p:'Phase 1 thiếu requirement', c:'Link, token hoặc quyền chưa đủ; hoặc đọc sai phạm vi.', f:'Kiểm tra Backlog/tài liệu nguồn/Figma/Swagger và file .env.' },
  { p:'Excel không export được', c:'Thiếu dependency, hoặc bảng testcase sai format.', f:'Chạy npm install; kiểm tra bảng có cột TC ID.' },
  { p:'ui_conformance_check báo "thiếu HẾT cột"', c:'Gần như luôn là quên truyền TASK_ENV → không có creds → đứng ở màn login → mọi màn đọc ra 0 cột.', f:'Chạy lại với TASK_ENV=profiles/<TASK_KEY>/task.env. Gặp exit 2 thì ĐỪNG đọc report của lần đó.', hot:1 },
  { p:'design_gate chặn: thiếu requirements/ui_catalog.json', c:'Bộ có case hiển thị nhưng chưa có bản kiểm kê field/cột. Không có nó thì "thiếu một trường" không bao giờ lộ ra — mọi step vẫn xanh.', f:'Dựng catalog theo schema ở scripts/qa/README.md, lấy nhãn từ FSD/Figma KHÔNG lấy từ build. Task cũ thì chạy kèm --no-catalog và nêu lý do trong report.', hot:1 },
  { p:'gate:policy chặn dù mình không sửa rule', c:'Nó kiểm 5 thứ: core_rules khai canonical · danh sách đuôi evidence khớp code · file rule/prompt mồ côi · skill name lệch tên thư mục · lệnh gate ở workflow mà run_phase không nhắc.', f:'Đọc thông báo, nó nói thẳng phải nối file vào đâu. Thường là thêm một dòng vào bảng "Bản đồ prompt" của run_phase tương ứng.' },
  { p:'Phase 2 skip nhiều', c:'Auth, dữ liệu, API hoặc môi trường chưa sẵn sàng.', f:'Sửa setup/dữ liệu/nguyên nhân gốc rồi execute lại — đừng để nguyên rồi báo cáo.' },
  { p:'Evidence trắng', c:'Chụp sai thời điểm hoặc trang chưa render xong.', f:'Chụp lại sau khi trang ổn định; case phức tạp thì quay video.' },
  { p:'Fail không rõ nguyên nhân', c:'Chưa phân loại product / setup / data / automation.', f:'Rerun đúng case đó và đọc artifact liên quan.' },
  { p:'Backlog bug thiếu thông tin', c:'Chưa có expected, actual hoặc evidence đủ rõ.', f:'Bổ sung đủ 4 phần mô tả và đính ảnh/video.' },
  { p:'Re-run vẫn fail', c:'Bug chưa được fix thật, hoặc setup vẫn lỗi.', f:'Giữ bug mở, ghi actual mới kèm evidence mới.' },
  { p:'Ghi kết quả execution bị chặn: thiếu reports/expansion-plan.md', c:'Task có case band high đã execute nhưng chưa quyết định mở rộng 5 trục. Gate đứng ở ĐƯỜNG PUBLISH chứ không chỉ ở self-review, vì bỏ qua self-review rồi đẩy thẳng thì trước đây không gì cản.', f:'Chạy npm run expansion:plan (vài giây, chỉ đọc Excel). Cố ý bỏ qua thì thêm --qa-approved và nêu lý do.', hot:1 },
  { p:'Publish lên Sheet trả 2xx mà trường vẫn sai', c:'2xx chỉ chứng minh request được nhận, KHÔNG chứng minh mapping đúng — đã có lượt đổ nhầm cột mà log trông hoàn toàn bình thường.', f:'Sau MỖI lượt publish, mở Sheet và đối soát lại từng trường với Excel canonical — ít nhất là bộ cột và vài dòng đầu mỗi nhóm.', hot:1 },
  { p:'Ưu tiên bị tụt về Medium sau khi publish', c:'Giá trị "Highest" là thang cũ của Backlog; công cụ cũ map theo TÊN nên rơi về fallback. Đo được 14 case của một bộ bị tụt mà không ai biết.', f:'Dùng thang canonical của kit: Critical | High | Medium | Low | Lowest.' },
  { p:'Case cũ vẫn còn sau khi bỏ TC khỏi Excel', c:'Chưa chạy cleanup, hoặc chưa được QA duyệt.', f:'Đối chiếu Excel canonical với Sheet rồi đánh dấu Deprecated bằng tay — không xoá dòng, xoá là mất luôn lịch sử run. Xem trước rồi :apply — case chuyển Deprecated, không xoá (Sheet ghi đè toàn bộ mỗi lần sync).' },
  { p:'Tài liệu nguồn thay đổi', c:'Dùng nhầm Re-run.', f:'Chạy Partial Rerun Prepare Review, không phải Re-run.' },
  { p:'gate:policy chặn: còn nhắc công cụ test-management cũ', c:'Kit chỉ còn Google Sheet — script đã xoá, biến môi trường đã xoá, dữ liệu đã di trú đủ 2103/2103 lượt run. Mỗi câu còn nhắc công cụ trước đó là một đường mòn dẫn đi tìm lệnh không còn tồn tại.', f:'Xoá hoặc viết lại theo luồng Google Sheet. Đừng để lại ghi chú "legacy" — luật này cấm cả cái tên.' },
  { p:'gates:index:check chặn: bảng lệch source', c:'Thêm/sửa một máy trong scripts/qa/ mà chưa sinh lại danh mục gate.', f:'Chạy npm run gates:index. Nếu bảng báo sai mức (CHẶN/SINH/BÁO CÁO) thì soi lại — 4 "phát hiện" đầu tiên khi mới dựng bảng đều là lỗi của BẢNG, không của kit.' },
  { p:'Đọc RULE_GLOBAL tốn 12,8k token cho một câu hỏi', c:'File 465 dòng, không auto-load nhưng cũng không có mục lục nên phải đọc cả file.', f:'npm run rule:toc để xem mục, rồi npm run rule -- <mục>. Riêng mục Security chỉ 287 token.' }
];

/* ── Checklist ── */
const CHECKLISTS = [
  { role:'QA Member', icon:'✅', rows:[
    ['Phase 1', 'testcase Markdown · Excel canonical · phase1-summary.md · task.md'],
    ['Publish Backlog', 'QA confirmation · publish summary · mirror created hoặc dry-run rõ ràng'],
    ['Review Phase 1', 'coverage % · Final Decision · High/Critical gap rõ ràng'],
    ['Phase 2', 'execution summary · pass/fail/skip · evidence · phân tầng lỗi · testcase-status.json'],
    ['Đẩy kết quả lên Sheet', 'Cycle đã tạo · evidence neo đúng bước · đúng thư mục cycle của sprint'],
    ['Backlog bug', 'mô tả 4 phần · evidence ảnh/video · expected và actual rõ'],
    ['Re-run', 'rerun report · evidence PASS/FAIL · Backlog Done nếu PASS thật']
  ]},
  { role:'QA Lead', icon:'🔎', rows:[
    ['Có đủ testcase để test chưa?', 'reports/phase1-summary.md'],
    ['Coverage có đạt không?', 'reports/phase1-summary.md'],
    ['Có gap cần BA/BE/UIUX trả lời không?', 'reports/phase1-summary.md · task.md'],
    ['Test đã execute thật chưa?', 'reports/execution-summary.md'],
    ['Bug có đáng log Backlog không?', 'execution-summary.md · evidence · testcase liên quan'],
    ['Bug đã fix thật chưa?', 'rerun report · Backlog status · evidence PASS']
  ]}
];

/* ── README: kiến trúc theo tầng ── */
const ARCH_LAYERS = [
  { k:'Phase 1', c:'#4F46E5', d:'Đọc requirement/design/API rồi sinh testcase Markdown + Excel + coverage report + Setup Strategy contract (PRE-NN) + Precondition Execution Matrix. Excel là source of truth khi gen và publish.' },
  { k:'Testcase Publish (Google Sheet)', c:'#4338CA', d:'Step riêng trong Phase 1: sau khi QA xác nhận Excel thì tạo/cập nhật case trên Google Sheet, nhóm bằng folder 2 cấp, TC ID ở automationKey. Mặc định dry-run.' },
  { k:'Phase 2', c:'#2A6FDB', d:'Đọc testcase từ nguồn canonical (mặc định kéo từ Google Sheet), chạy Precondition Resolution Pass, sinh/cập nhật Playwright spec, execute thật rồi thu evidence.' },
  { k:'Setup Layer', c:'#0E9AA7', d:'tests/support/setup/ — factory, hook, fixture, mock, cleanup, contract dùng chung để dựng tiền điều kiện. Không dựng state bằng DB; DB chỉ read-only verify qua guarded client.' },
  { k:'Rerun', c:'#1F8A5B', d:'Chạy lại case fail hoặc bug Backlog đã fix. Không dùng để đồng bộ tài liệu nguồn mới.' },
  { k:'Partial Rerun', c:'#7C5CD6', d:'Nhánh phụ độc lập xử lý thay đổi tài liệu nguồn và execute subset bị ảnh hưởng. Không được gọi từ Main Flow.' },
  { k:'Shared Services', c:'#D64545', d:'Backlog testcase publisher, Backlog bug reporter, Google Sheet, Excel converter, runtime config và helper dùng chung.' },
  { k:'Outputs', c:'#79736A', d:'Requirement artifacts, testcase, execution results, evidence và reports — lưu theo từng task.' }
];

/* ── README: cây thư mục (depth = mức thụt) ── */
const TREE = [
  [0,'.agent/','cấu hình, workflow, skill, rule của agent','dir'],
  [1,'config/','project_context · risk_model · verdict_taxonomy · kit-layers · impact-map','dir'],
  [1,'workflows/','entry + step của phase1 (01–04), phase2 (01–04), rerun (01–03)','dir'],
  [1,'skills/','22 skill theo phase1 / phase2 / shared','dir'],
  [1,'rules/','core_rules · qa_instincts · locator_strategy · playwright_fe/api','dir'],
  [0,'prompt_templates/','prompt chạy từng phase','dir'],
  [1,'phase1/dimensions/','15 chương chiều coverage — mở đúng chiều task cần, không nạp cả 15','dir'],
  [0,'scripts/qa/','công cụ QA chạy thật + toàn bộ gate máy-kiểm','dir'],
  [0,'tests/','spec Playwright','dir'],
  [1,'support/setup/','setup layer dùng chung (factory/hook/fixture/mock/cleanup)','dir'],
  [1,'mobile-web/','spec mobile-web qua device emulation','dir'],
  [1,'load/','script k6 (opt-in)','dir'],
  [0,'knowledge/','bộ nhớ học: domain · system · decisions · setup_recipes · environment · metrics','warn'],
  [0,'profiles/<TASK_KEY>/task.env','env động theo task, nạp qua TASK_ENV','warn'],
  [0,'outputs/<PROJECT>/tasks/<TASK_KEY>/','toàn bộ artifact của một task','dir'],
  [0,'partial-rerun/','nhánh phụ độc lập — xoá đi Main Flow vẫn chạy','dir'],
  [0,'exploratory/','nhánh phụ never-auto, charter-based','dir'],
  [0,'CLAUDE.md · RULE_GLOBAL.md · README.md · USER_GUIDE.md · QUICKSTART.md','tài liệu gốc','file']
];

/* ── README: output của một task ── */
const OUTPUT_DIRS = [
  ['requirements/','Backlog, tài liệu nguồn, Figma, Swagger hoặc tài liệu đầu vào đã fetch. Chứa cả ui_catalog.json và dimension_manifest.json.'],
  ['test-cases/','Testcase Markdown, Excel canonical và snapshot ngữ cảnh. Có from-sheet/ khi Phase 2 kéo bản Sheet về.'],
  ['test-results/','Playwright JSON, HTML report, screenshot, video, trace.'],
  ['reports/','phase1-summary · execution-summary · publish summary · bug log · rerun report.'],
  ['change/','Artifact của nhánh Requirement Change Management nếu có gọi.'],
  ['logs/','Log local đã sanitize.']
];

/* ── README: mô hình Google Sheet ── */
const TMS_MODEL = [
  { k:'Case', d:'Một dòng testcase trong Google Sheet. Nối tới Task cha bằng backlogRequirementIDs; TC ID nằm ở automationKey.', note:'caseStatus (Draft/Under Review/Published/Deprecated) là vòng đời biên soạn, KHÔNG phải kết quả chạy.' },
  { k:'Folder', d:'Tổ chức case theo nhóm chức năng: cây 2 cấp <root>/<nhóm>, dựng TỪ Excel.', note:'Google Sheet không có Test Set — team chạy cả bộ cùng lúc nên cũng không cần.' },
  { k:'precondition', d:'Tiền điều kiện — là FIELD trong case, không còn issue dùng chung.', note:'Sinh từ Setup Strategy contract ở Phase 1; mã [PRE-NN] giữ trong text để tra chéo.' },
  { k:'Thư mục cycle', d:'Gom các lần chạy của một sprint. Sheet không có khái niệm Test Plan.', note:'Truyền --folder "<Tên sprint>"; kit tự tạo thư mục nếu chưa có.' },
  { k:'Cycle', d:'Một lần chạy toàn bộ testcase. Cùng --cycle-title thì dùng lại cycle cũ, không đẻ trùng.', note:'Run + run-step nhận Passed / Failed / Blocked / Not Run; evidence neo được xuống TỪNG BƯỚC.' }
];

/* ── README: lệnh hay dùng, gom nhóm ── */
const CMD_GROUPS = [
  { g:'Cài đặt & chạy test', items:[
    ['npm install','Cài dependencies'],
    ['npx playwright install','Tải browser cho Playwright'],
    ['npm run test:task -- --project-output <DIR> --task <TASK_KEY>','Chạy Playwright giới hạn trong một task (ưu tiên dùng cái này thay vì npm test)'],
    ['npm run test:mobile-web','Chạy spec mobile-web qua device emulation'],
    ['CROSS_BROWSER=1 npx playwright test --project=firefox-desktop','Lane cross-browser, chạy nightly hoặc thủ công']
  ]},
  { g:'Gate bắt buộc', items:[
    ['npm run preflight','Kiểm input và config đủ trước khi chạy phase'],
    ['npm run design:gate -- --dir <test-cases/> --with-rows','Soi thiết kế bộ testcase'],
    ['npm run gate:output -- --status <status.json>','Soi output trước khi push Sheet/Backlog'],
    ['npm run self-review -- --task <TASK_KEY>  ·  /gates <TASK_KEY>','Checklist gộp trước khi finalize'],
    ['npm run gate:policy','Một nguồn policy · file mồ côi · tên skill · đuôi evidence'],
    ['npm run self-review:enforce -- --task <TASK_KEY>','Bản chặn thật của checklist gộp'],
    ['npm run inventory:gate','Chống CI xanh giả (0 test vẫn PASSED)'],
    ['npm run ci:scope','CI generic KHÔNG được tự chạm UAT'],
    ['npm run json:check','Mọi .json đang track có parse được không'],
    ['npm run secret:scan  ·  npm run audit:ci','Quét secret · audit dependency']
  ]},
  { g:'Đo chất lượng thật', items:[
    ['TASK_ENV=… node scripts/qa/ui_conformance_check.js --catalog <ui_catalog.json>','Kiểm kê cột/field vs tài liệu — exit 0 khớp · 1 lệch · 2 KHÔNG ĐO ĐƯỢC'],
    ['npm run accessibility -- --catalog <ui_catalog.json>','axe-core trên trang đã login'],
    ['npm run perf -- --catalog <perf_catalog.json>','Web vitals + API SLA, verdict advisory'],
    ['npm run security -- --catalog <…> --confirm-nonprod','Security cơ bản, chỉ GET, non-prod'],
    ['npm run load -- --script tests/load/example.load.js --confirm-nonprod','Load/stress/soak qua k6'],
    ['npm run lint:locator  ·  npm run lint:locator:enforce','Kỷ luật định vị element']
  ]},
  { g:'Coverage & rủi ro', items:[
    ['TASK_ENV=… npm run dim:coverage  ·  -- --enforce','Đếm case theo 20 chiều coverage'],
    ['npm run risk  ·  npm run risk:gate','Risk register · gate độ sâu theo band'],
    ['npm run bugs:checklist','Mỗi bug từng xảy ra đã có case đứng canh chưa (§20)'],
    ['npm run trace:matrix -- --task <TASK_KEY>','Ma trận REQ → TC → AUTO → EXEC → BUG'],
    ['npm run dep:graph -- --task <TASK_KEY>','Đồ thị phụ thuộc, gộp traceability + impact-map'],
    ['npm run quality:decision -- --task <TASK_KEY>','GO / GO_WITH_RISK / NEEDS_REVIEW / NO_GO / BLOCKED']
  ]},
  { g:'Mở rộng 5 trục & chống lọt bug', items:[
    ['npm run expansion:plan','Quyết TRƯỚC: case nào mở trục nào, tốn bao nhiêu — gỡ chặn cho bước ghi kết quả execution'],
    ['npm run expansion:audit','Đo độ phủ 5 trục trên mọi task đã execute'],
    ['npm run xsurf:diff','Trục 2 — cùng giá trị, khác nơi hiển thị (trục rò nhiều nhất)'],
    ['npm run probe:persist','Trục 3 — form → payload → API → UI'],
    ['npm run fixture:matrix','Trục 4+5 — nhánh/biến thể × trạng thái kế cận'],
    ['npm run mutation:check','Negative control: tiêm lỗi xem bộ kiểm có đỏ không'],
    ['npm run leak:report','Kit đang rò bao nhiêu và rò kiểu gì']
  ]},
  { g:'Tài liệu → oracle máy đọc được', items:[
    ['npm run spec:extract','Bảng field trong FSD → screens.json → ui_catalog.json'],
    ['npm run spec:gap','Chiều NGƯỢC: build có mà tài liệu không nhắc'],
    ['npm run ui:contract','Figma → knowledge/system/UI-*.json'],
    ['TASK_ENV=… npm run docs:budget  ·  -- --contract','Đo tài liệu trước khi đọc; bắt bản cũ thiếu nội dung']
  ]},
  { g:'Nhánh dò tự do (exploratory)', items:[
    ['npm run explore:charter','Chọn vùng dò bằng dữ liệu, không theo vùng mình quen'],
    ['npm run explore:check  ·  npm run explore:check:enforce','Kiểm ràng buộc của phiên dò'],
    ['npm run explore:close','Đóng vòng học của phiên dò']
  ]},
  { g:'Backlog & Google Sheet', items:[
    ['npm run integration:check','Kiểm kết nối Backlog'],
    ['node scripts/convert_excel/md_to_xlsx.js <md> <xlsx>','Dựng Excel canonical từ testcase Markdown'],
    ['(Drive MCP)','Upload Excel lên Google Sheet sau khi QA duyệt · tải bản mới nhất về canonical local'],
    ['npm run backlog:bug-report:dry-run -- …','Xem trước bug sẽ tạo'],
    ['npm run merge:execution-status -- --task <KEY>','Ghép kết quả execute vào bộ canonical']
  ]},
  { g:'Kit: tự kiểm toán & phát hành', items:[
    ['npm run gates:index  ·  npm run gates:index:check','Danh mục gate tự sinh — 76 máy, 52 CHẶN; :check chặn khi bảng lệch source'],
    ['npm run rule -- <mục>  ·  npm run rule:toc','Tra RULE_GLOBAL theo mục (287 token) thay vì đọc cả file (12,8k)'],
    ['npm run version:check','Chặn phát hành thiếu số phiên bản; kiểm khớp tag'],
    ['npm run package:kit','Đóng gói dist/ CHỈ lớp GENERIC — không để lọt secret hay oracle của dự án khác'],
    ['npm run release:verify','Giải nén vào thư mục sạch rồi npm ci — đúng trải nghiệm người nhận']
  ]},
  { g:'Bộ nhớ học', items:[
    ['TASK_ENV=… npm run learn','Thu learning data của một task'],
    ['TASK_ENV=… npm run learn:bugs:apply','Nạp bug Backlog vào knowledge sau khi log'],
    ['npm run domain:check  ·  npm run system:check','Kiểm business rule · bản đồ hệ thống'],
    ['node scripts/qa/decisions.js --check "<triệu chứng>"','Tra quyết định cũ TRƯỚC khi log bug'],
    ['npm run knowledge:backup','Sao lưu knowledge ghi tay ra ngoài repo'],
    ['npm run dashboard','Sinh QA Dashboard theo dự án trước DS']
  ]}
];

/* ── README: best practice, phân 3 mức ── */
const PRACTICES = [
  { lv:'do', t:'Nên làm', items:[
    'Dùng PROJECT_OUTPUT_DIR và TASK_KEY cho mọi output; echo ra trước khi ghi file.',
    'Dùng RUN_ID khi chạy song song nhiều session cùng một TASK_KEY.',
    'Chạy từng story theo phase rời nhau: Phase 1 → chờ Dev → Phase 2 → chờ fix → Re-run.',
    'Ưu tiên npm run test:task* thay vì gọi npm test trực tiếp.',
    'Giữ testcase đủ precondition, test data, steps, expected và ý đồ assertion.',
    'Review coverage bằng requirement/risk gate, không chỉ đếm số lượng testcase.',
    'Dùng dry-run trước khi tạo Backlog bug thật.'
  ]},
  { lv:'warn', t:'Thận trọng', items:[
    'Không commit .env, .env.local, token, password, cookie, private key hay service-account JSON.',
    'Không hardcode URL, credential, project key, module name hay output path theo một task cụ thể.',
    'Không sửa .env chung khi có session khác đang chạy — truyền env theo command.',
    'Không sửa shared helper/config/spec core khi story khác đang execute, trừ khi đã xác nhận đây là thay đổi chung.'
  ]},
  { lv:'never', t:'Không bao giờ', items:[
    'Không skip testcase chỉ để tăng pass rate.',
    'Không sửa expected result khi chưa có requirement/API/design xác nhận.',
    'Không dựng precondition bằng câu lệnh DB.',
    'Không xoá case — case rời Excel chỉ chuyển caseStatus sang Deprecated (công cụ cũng không có API xoá).'
  ]}
];
