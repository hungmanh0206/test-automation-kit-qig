/* NHÓM 2e — máy ĐO (perf · security · lighthouse · load · dashboard) và máy soát TÀI LIỆU NGUỒN
   (docs:index · docs:cite · docs:health), cộng ba cửa vào/ra dữ liệu (aio:pull · gdoc:read · sync:gitlab)
   và bảng trả lời preflight:lanes.

   Vì sao gom một nhóm: đây đều là máy đã có trong danh mục GATES.md nhưng CHƯA có mục trong thư viện.
   Rà ngày 18/09/2026: 80 máy trong danh mục, 68 có mục, 12 không. Thiếu mục nghĩa là người đọc tra
   không ra, và một máy tra không ra thì coi như không có.
   Nguồn: header của chính từng script + .agent/config/GATES.md. */
const TERMS_GATE5 = [

/* ── Máy soát tài liệu nguồn ─────────────────────────────────────────────── */

{ id:'g-docs_index', t:'docs:index / docs:cite', cat:'gate',
  def:'Mỗi neo yêu cầu (BR-xx, AC-x.x, US-xx) phải TRA NGƯỢC được về file tài liệu, kèm số dòng.',
  detail:'docs:index lập chỉ mục neo cho một task; docs:cite tra một neo ra file và số dòng; --verify so cả bộ testcase với chỉ mục, và --enforce thì exit 1. Chỉ mục CHỈ lấy tài liệu được docs:health gọi là lành, vì trích dẫn cần số dòng mà file do bộ đổi cũ sinh ra dồn cả trang vào một dòng.',
  why:'Kit đã bắt mọi phán PASS/FAIL kèm oracle_ref, và đã có máy kiểm. Nhưng máy đó chỉ kiểm HÌNH DẠNG chuỗi: viết BR-07 hay AC-9.9 đều qua cửa như nhau, kể cả khi tài liệu không hề có mục đó. Đó đúng là cách sinh ra một kết luận nghe rất có căn cứ mà không neo vào đâu cả.',
  how:['Không đoán: neo nào tài liệu không có thì nói là không có. Cấm tìm gần đúng rồi gợi ý neo khác — gợi ý sai ở đây dẫn thẳng tới việc đổi expected cho khớp một luật không tồn tại.','Chạy SAU khi tài liệu đã lành, không chạy trên bản fetch cũ.'],
  cmd:'npm run docs:index -- --task <KEY> --write   ·   npm run docs:cite -- --task <KEY> --cite BR-07',
  ex:'Bộ testcase thật của SAPP-26878 có 76 neo, tra ngược được cả 76. Bơm thêm 3 neo bịa thì cả ba bị gọi tên và --enforce exit 1.',
  trap:'Cảnh báo MƠ HỒ của bản đầu báo oan 26 chỗ, bản hai 18, bản ba còn 8 mới là thật. Hai lần đầu đều đếm nhầm: US-xx là tên TRANG chứ không phải luật, và testcase viết "US-02 … BR-09" vẫn đúng.',
  src:'scripts/phase1/docs_index.js', rel:['c-oracle','c-tautology','g-docs_health','c-tin-hieu-sach-gia'] },

{ id:'g-docs_health', t:'docs:health', cat:'gate',
  def:'Trả lời "tài liệu tôi đang đọc có còn đúng không" bằng một lệnh — bốn phép đo, mỗi phép ứng với một sự cố đã xảy ra.',
  detail:'LỆCH BẢN: version trên Confluence khác version lúc fetch. RỖNG: thân tài liệu dưới ngưỡng, tức fetch hỏng mà không báo. MẤT BẢNG: nguồn có <table> mà file không còn dòng bảng nào. CÒN ENTITY: chữ vẫn ở dạng &agrave; thay vì à. Mặc định KHÔNG chặn — lệch bản là chuyện bình thường của dự án đang chạy, chặn ở đây biến tín hiệu hữu ích thành tiếng ồn bị tắt. Có --strict cho ai muốn chặn có chủ đích.',
  why:'Cả bốn đều KHÔNG phát hiện được bằng cách mở file ra đọc. File vẫn có chữ, vẫn có tiêu đề, đọc vào vẫn hợp lý. Mắt người không phân biệt được "tài liệu nói thế" với "tài liệu CÒN nói thế".',
  how:['Entity không phải chuyện thẩm mỹ: tr&ecirc;n không khớp khi tìm "trên", nên tài liệu nằm đó mà tra cứu không ra.'],
  cmd:'npm run docs:health -- --task <KEY>',
  ex:'Soát SAPP-26878: 14/23 trang đã bị sửa sau ngày fetch · 2 file fetch về rỗng (72 và 91 byte) · 13 file mất sạch bảng · 10.555 chỗ còn entity.',
  trap:'Bản đầu của chính máy này nói dối: chỉ nhận khuôn "Page ID:" nên bỏ sót nguyên một thư mục 16 file mà vẫn in tín hiệu sạch. Và câu "không có tài liệu Confluence nào" từng in ra cho 11 task thực tế đang có 68 file lành — nay nói rõ là THIẾU ID kèm số tài liệu thật.',
  src:'scripts/phase1/docs_health.js', rel:['c-tin-hieu-sach-gia','g-docs_index','c-bo-doi-confluence'] },

/* ── Máy đo ──────────────────────────────────────────────────────────────── */

{ id:'g-perf', t:'perf', cat:'gate',
  def:'Biến mục Performance/SLA thành ĐO THẬT: đo một người dùng, so ngưỡng catalog, ra verdict.',
  detail:'Loại A — single-user. Mỗi metric đo N lần (mặc định 3) rồi lấy MEDIAN, vì UAT nhiễu. Verdict là ADVISORY: WARN/FAIL để điều tra, KHÔNG tự thành product bug cứng; không có ngưỡng thì N/A. Cờ --deep chạy RUN RIÊNG với coverage động và Performance.getMetrics qua CDP, vì coverage/profiler làm LỆCH timing nên không được trộn vào median.',
  why:'"Trang chậm" là câu không kiểm được. Chỉ khi tách ra "chậm với một người" hay "chỉ chậm khi đông người" thì mới chọn đúng loại phép đo — và hai thứ đó có nguyên nhân khác hẳn nhau.',
  how:['Throttle CPU/mạng là ĐIỀU KIỆN ĐO, phải ghi vào report chứ không được giấu.'],
  cmd:'TASK_ENV=profiles/<TASK>/task.env node scripts/qa/perf_check.js --catalog <...>',
  src:'scripts/qa/perf_check.js', rel:['g-load','g-lighthouse','sk-perf_check','c-flaky'] },

{ id:'g-load', t:'load', cat:'gate',
  def:'Wrapper mỏng cho k6 — Loại B: load, stress, soak với nhiều VU.',
  detail:'k6 là binary ngoài, không phải npm dependency; thiếu k6 thì SKIP sạch. never-auto: phải có --confirm-nonprod, và target trông giống prod thì từ chối, không có cờ nào mở prod. Cap mặc định khiêm tốn 5 VU / 30s.',
  why:'Load test tạo TẢI THẬT và có thể làm nghẽn chính UAT đang dùng chung. Nên nó không được phép chạy tự động.',
  how:['Script khai stages/scenarios mà wrapper vẫn truyền --vus/--duration thì k6 ĐÈ lên, ramp biến mất.'],
  cmd:'node scripts/qa/load_check.js --confirm-nonprod',
  trap:'Bản cũ của wrapper luôn truyền --vus/--duration nên mọi profile ramping bị làm PHẲNG mà không báo gì — stress/spike/soak chạy ra load thường, report vẫn ghi PASS. Đo được: script khai stages 1→4 VU, chạy kèm --vus 5 thì k6 giữ đúng 5/5 VU suốt run.',
  src:'scripts/qa/load_check.js', rel:['g-perf','sk-load_check','c-tin-hieu-sach-gia'] },

{ id:'g-lighthouse', t:'lighthouse', cat:'gate',
  def:'Điểm Performance / Accessibility / SEO / Best-practices thật, chạy qua CDP.',
  detail:'Opt-in nặng: playwright-lighthouse và lighthouse KHÔNG phải core dep, thiếu thì bỏ qua sạch và exit 0. Verdict ADVISORY theo đúng dải điểm chuẩn của Lighthouse (≥90 PASS · 50–89 WARN · <50 FAIL) — khuyến cáo, không tự thành product bug. never-auto, cần --confirm-nonprod.',
  why:'UAT nhiễu, nhất là nhóm Performance. Lấy điểm Lighthouse làm SLA cứng là bịa ra một ngưỡng không ai cam kết.',
  how:['App xác thực bằng token trong localStorage thì Lighthouse điều hướng lại có thể mất auth — điểm lúc đó phản ánh trang /login, không phải trang bạn định đo.'],
  cmd:'node scripts/qa/lighthouse_check.js --url <...> --no-login --confirm-nonprod',
  src:'scripts/qa/lighthouse_check.js', rel:['g-perf','g-accessibility_check','sk-lighthouse_check'] },

{ id:'g-security', t:'security', cat:'gate',
  def:'Phần xác định được của mục Security thành đo thật — read-only, không phá.',
  detail:'Chỉ GET, không mutate. Control xác định (headers · trạng thái khi chưa auth · trạng thái authz · transport) ra PASS/FAIL; dò lộ dữ liệu nhạy cảm là heuristic nên chỉ ra FINDING để người review, không PASS/FAIL cứng. Report MASK mọi PII và secret.',
  why:'Ranh giới an toàn là điều kiện để máy này được phép tồn tại trong kit: KHÔNG fuzzing, KHÔNG khai thác SQLi/XSS làm đổi dữ liệu, KHÔNG brute-force. Những thứ đó cần tool chuyên, opt-in, và có người phê duyệt.',
  how:['never-auto: chạy không có --confirm-nonprod thì phải bị từ chối. Chính CI có một phép kiểm chứng minh nó từ chối đúng.'],
  cmd:'node scripts/qa/security_check.js --catalog <...> --confirm-nonprod',
  src:'scripts/qa/security_check.js', rel:['sk-security_check','r-security','g-accessibility_check'] },

{ id:'g-dashboard', t:'dashboard', cat:'gate',
  def:'Gộp dữ liệu ĐÃ CÓ thành một trang HTML tĩnh — không thu thập lại, không thêm dependency.',
  detail:'Đọc knowledge/historical_execution/ (độ phủ và pass/fail theo task và module), knowledge/bugs/ (rủi ro theo module), và flaky-triage.md của từng task. Xuất reports/dashboard.html theo SAPP Academy Design System.',
  why:'Trạng thái của một bộ kiểm nằm rải ở nhiều store. Không có chỗ gộp thì mỗi lần ai hỏi "đang thế nào" lại phải đi đọc tay, và câu trả lời phụ thuộc người đọc.',
  how:['Chạy được cả khi knowledge/ rỗng: phải exit 0 và báo trung thực "0 bug, snapshot làm dữ liệu" chứ không âm thầm coi như không có rủi ro.'],
  cmd:'npm run dashboard',
  src:'scripts/qa/dashboard_generate.js', rel:['f-knowledge','g-learn_report','f-results-json'] },

/* ── Cửa vào / ra dữ liệu ────────────────────────────────────────────────── */

{ id:'g-aio_pull', t:'aio:pull', cat:'gate',
  def:'Kéo testcase TỪ AIO Tests về Excel canonical local, để Phase 2 execute đúng bản đã qua review.',
  detail:'Ghi ra thư mục RIÊNG test-cases/from-aio/, không đụng Excel người viết ở test-cases/. Cột, tên sheet và định dạng "1. … 2. …" giữ nguyên để parser canonical đọc được mà không cần biết nguồn nào.',
  why:'Phase 2 mặc định KHÔNG đọc Excel người viết, mà đọc bản kéo về từ test-management — nơi testcase đã qua review và sửa. Thiếu bản kéo về thì đặt TEST_MANAGEMENT_TOOL=aio xong Phase 2 vẫn đang chạy trên bản nháp.',
  cmd:'npm run aio:pull   ·   npm run aio:pull:write',
  src:'scripts/integrations/aio/pull_testcases_aio.js', rel:['f-aio','f-excel-canonical','g-aio_verify_fields'] },

{ id:'g-gdoc_read', t:'gdoc:read', cat:'gate',
  def:'Đọc nội dung Google Docs làm nguồn requirement.',
  detail:'Một trong các cửa vào của Phase 1, cạnh Jira, Confluence, Figma và Swagger.',
  why:'Spec của dự án không nằm một chỗ. Có cửa đọc riêng thì mới nói được "đã đọc gì" thay vì "đã xem qua".',
  how:['Tài liệu nhiều tab: thiếu includeTabsContent thì chỉ đọc tab đầu và mất phần lớn spec — đã đo 18,5 KB so với 345 KB.','Spec BA bổ sung thường nằm ở phần tô màu hoặc suggested, phải đọc backgroundColor của textRun.'],
  cmd:'npm run gdoc:read',
  src:'scripts/integrations/google_doc/doc_reader.js', rel:['sk-requirements_analyzer','c-tin-hieu-sach-gia','g-docs_health'] },

{ id:'g-sync_gitlab', t:'sync:gitlab', cat:'gate',
  def:'Đẩy main sang nhánh GitLab, TRỪ những đường dẫn khai trong cấu hình strip.',
  detail:'Không merge cây GitLab ngược vào main. Tree đẩy lên là tree của main trừ phần strip, hai cha là origin/main và main để lịch sử liền và lần sau vẫn fast-forward. Không chạm index hay working-tree thật.',
  why:'Nhánh GitLab cố ý không chứa vài file mà main có, nên hai cây phân kỳ vĩnh viễn. Trước 24/08/2026 việc này làm tay, và nó hỏng theo kiểu tệ nhất: quên strip MỘT lần là file quay lại nhánh GitLab, không có gì báo.',
  how:['Danh sách strip là CẤU HÌNH đọc được (.agent/config/gitlab_strip.json), không phải trí nhớ của người chạy.'],
  cmd:'npm run sync:gitlab',
  src:'scripts/utils/sync_gitlab.js', rel:['r-security','c-tin-hieu-sach-gia'] },

{ id:'g-preflight_lanes', t:'preflight:lanes', cat:'gate',
  def:'In ra lane nào đã đủ biến môi trường để chạy, lane nào còn thiếu gì. KHÔNG chặn.',
  detail:'Bảy lane khai trong .agent/config/env_lanes.json, suy từ code chứ không bịa: grep đúng những script đọc biến đó. Có requiredOneOf cho quan hệ thay thế, ví dụ OPS nhận token HOẶC cặp user và password.',
  why:'Tester sau bàn giao báo "phải có token LMS và OPS mới test được". Đo lại thì CODE ĐÃ ĐÚNG — gỡ sạch biến OPS_ và LMS_ rồi chạy preflight ở cả hai mode đều exit 0. Cái sai là TÀI LIỆU: .env.example có 79 biến, 15 biến OPS_/LMS_ nằm ngay khối đầu, và 0 dòng nói lane nào cần biến nào.',
  how:['Đây là BẢNG TRẢ LỜI, không phải cổng. Thiếu lane nào chỉ nghĩa là lane đó chưa dùng được.','Chỉ hai biến thật sự bắt buộc: PROJECT_OUTPUT_DIR và TASK_KEY.'],
  cmd:'npm run preflight:lanes',
  src:'.agent/config/env_lanes.json', rel:['g-preflight_gate','f-task-env','c-tin-hieu-sach-gia'] },

];
