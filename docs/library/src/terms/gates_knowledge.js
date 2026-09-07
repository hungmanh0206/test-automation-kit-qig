/* NHÓM 2d — máy quản lý bộ nhớ học (knowledge/) và vòng học.
   Trước đây phần này chỉ được nói qua nhóm Skill; nay có mục riêng vì mỗi store có luật kiểm riêng.
   Nguồn: header scripts/qa/{domain_rules,system_map,decisions,howto_store,learn_*,knowledge_backup,
   seed_knowledge_from_jira,skills_index}.js + danh mục gate tự sinh. */
const TERMS_GATE4 = [

{ id:'g-domain_rules', t:'domain:check / domain:index', cat:'gate',
  def:'Quản lý knowledge/domain/ — business rule đã XÁC NHẬN, tức nền của mọi oracle.',
  detail:'Kiểm schema, kiểm PII, kiểm trace về testcase và phát hiện rule đã cũ. Có cờ --enforce để chặn thật. Kèm domain:trace-back đi chiều ngược: từ testcase tự thêm covered_by vào rule.',
  why:'Kit CẤM oracle tautological — expected phải trích từ spec hoặc business rule, không suy từ app. Nhưng nếu không lưu "đúng là gì" ở đâu cả thì agent buộc phải suy từ app, tức chính điều bị cấm. Store này là chỗ để lưu.',
  how:['Mỗi rule bắt buộc có source và examples dạng {input, expected} cụ thể.','covered_by trỏ tới TC nào đang phủ — BA đổi rule là biết ngay phải sửa case nào.'],
  cmd:'npm run domain:check   ·   npm run domain:index   ·   npm run domain:trace-back',
  src:'scripts/qa/domain_rules.js', rel:['sk-domain_recorder','c-oracle','c-tautology','f-knowledge'] },

{ id:'g-system_map', t:'system:check / system:index', cat:'gate',
  def:'Quản lý knowledge/system/ — bản đồ hệ thống đã xác nhận, và nó SINH RA nghĩa vụ test.',
  detail:'Ba store: state_machine (entity có state nào, chuyển state nào hợp pháp) · permission_matrix (role nào được làm action nào) · shared_surface (API, component, bảng hoặc job dùng chung bởi từ hai module trở lên). Có --enforce.',
  why:'Khác knowledge/domain ở chỗ nó không chỉ lưu cái đúng mà còn suy ra việc phải làm: cặp state không khai nghĩa là phải có case chứng minh bị chặn, ô ngoài vùng allow nghĩa là phải trả 403. Nhờ đó câu "hệ thống cho phép làm X, bug hay đúng thiết kế" trả lời được bằng trích dẫn.',
  cmd:'npm run system:check   ·   npm run system:index   ·   node scripts/qa/system_map.js --impact "<surface>"',
  ex:'--impact cho một API dùng chung sẽ liệt kê những module phải regression khi sửa API đó.',
  src:'scripts/qa/system_map.js', rel:['sk-system_mapper','c-change-impact','f-knowledge','c-oracle'] },

{ id:'g-decisions', t:'decisions:check / decisions:index', cat:'gate',
  def:'Quản lý knowledge/decisions/ — LÝ DO của những quyết định QA đã chốt.',
  detail:'Sáu loại: false_positive · by_design · risk_override · blocked_pass · wont_fix · test_approach. Trường rationale để trống là CHẶN. Riêng false_positive phải do Dev, BA, QA Lead hoặc PO chốt. Bản check nêu tên bug đã bị Rejected mà chưa có lý do, và quyết định đã quá expires_at.',
  why:'Kit đã lưu được "cái đúng" ở domain/, "hệ thống được phép làm gì" ở system/, "cái đã sai" ở bugs/ — nhưng không lưu VÌ SAO đã kết luận như thế. Thiếu nó thì task sau log lại đúng bug đã bị Rejected, hoặc đánh FAIL đỏ oan case đã chốt là vướng môi trường.',
  how:['BẮT BUỘC tra trước khi log bug: node scripts/qa/decisions.js --check "<triệu chứng>"'],
  cmd:'npm run decisions:check   ·   npm run decisions:index',
  src:'scripts/qa/decisions.js', rel:['sk-decision_recorder','c-false-positive','f-knowledge','sk-jira_bug_reporter'] },

{ id:'g-howto_store', t:'howto:check / howto:find', cat:'gate',
  def:'Quản lý hai store trả lời câu "LÀM SAO tới được trạng thái đó".',
  detail:'setup_recipes/ ghi các bước để có state X kèm CẠM BẪY đã vấp và cách verify. environment/ ghi quirk hạ tầng, auth hoặc env khiến test thất bại một cách khó hiểu. Có --enforce.',
  why:'Đo thật: 59% tri thức tích luỹ thuộc loại "làm sao dựng được state" — loại trước đây không có chỗ chứa nên mất sau mỗi task. Phần pitfalls đặc biệt giá trị vì đó là thứ chỉ biết sau khi đã vấp.',
  how:['Tra bằng npm run howto:find -- "<mô tả precondition>" — khớp trên goal, applies_when và tags.','Kết quả in kèm used_by (bằng chứng đã chạy được); KHÔNG có điểm tin cậy, người đọc tự quyết.'],
  cmd:'npm run howto:check   ·   npm run howto:index   ·   npm run howto:find -- "<mô tả>"',
  trap:'Trường method KHÔNG có giá trị db — dựng state bằng DB là điều kit cấm.',
  src:'scripts/qa/howto_store.js', rel:['c-precondition','f-knowledge','c-readiness','r-uat'] },

{ id:'g-learn_task', t:'learn / learn:backfill', cat:'gate',
  def:'Biến kết quả execute của một task thành learning data — mắt xích học từng bị đứt.',
  detail:'Thu KPI và snapshot theo module rồi ghi vào knowledge/. Bản backfill nạp lại từ các task đã chạy trước đó.',
  why:'Mỗi task học được vài điều, nhưng nếu chỉ nằm trong kết quả một lượt chạy thì tuần sau mất sạch. Đây là chỗ nối giữa "đã chạy" và "kit khá lên".',
  cmd:'TASK_ENV=… npm run learn   ·   npm run learn:backfill',
  src:'scripts/qa/learn_task.js', rel:['sk-learning_recorder','f-knowledge','g-metrics_collect','g-reliability_index'] },

{ id:'g-learn_reporter', t:'learn_reporter (Playwright reporter)', cat:'gate',
  def:'Reporter tự động thu learning data sau MỖI lần chạy test — không có npm script.',
  detail:'Đăng ký ở playwright.config.js nên nó chạy kèm mọi lượt test, không phải gọi tay.',
  why:'Việc thu dữ liệu học mà phải nhớ gọi thì sớm muộn sẽ quên. Gắn vào reporter nghĩa là nó xảy ra mặc định — đúng nguyên tắc forcing function: đừng dựa vào việc người ta nhớ.',
  src:'scripts/qa/learn_reporter.js', rel:['g-learn_task','g-metrics_collect','c-forcing-function','f-results-json'] },

{ id:'g-learn_report', t:'learn:report', cat:'gate',
  def:'Trả lời câu "chạy task này thì đã HỌC được gì, và còn thiếu gì".',
  detail:'Sinh reports/learning-summary.md.',
  why:'Dữ liệu học nằm im trong knowledge/ thì không ai đọc. Bản tóm này để agent kể ngay trong hội thoại thay vì bắt người dùng tự mở file — nếu phải mở file thì việc đó sẽ không xảy ra.',
  cmd:'TASK_ENV=… npm run learn:report -- --task <TASK_KEY> --write',
  src:'scripts/qa/learn_report.js', rel:['g-learn_task','f-knowledge','sk-learning_recorder'] },

{ id:'g-learn_bugs', t:'learn:bugs / learn:bugs:apply', cat:'gate',
  def:'Nối mắt xích còn đứt: bug đã log Jira → knowledge/bugs/.',
  detail:'Kéo bug từ Jira theo nhãn rồi ghi vào store, kèm tham chiếu root_causes và cập nhật index.',
  why:'Bug đã log nhưng không nạp về knowledge thì vòng học hở: risk_score không thấy module đó hay vỡ, và bugs_checklist không có gì để đối chiếu ở lượt sinh case sau.',
  cmd:'TASK_ENV=… npm run learn:bugs:apply',
  src:'scripts/qa/learn_bugs.js', rel:['g-bugs_checklist','g-risk_score','f-knowledge','g-bug_tc_matcher'] },

{ id:'g-seed_knowledge', t:'seed:knowledge', cat:'gate',
  def:'Nạp knowledge từ lịch sử Jira — suggest-only, mặc định dry-run.',
  detail:'Dùng một lần khi mới dựng bộ nhớ cho dự án: quét lịch sử để có dữ liệu ban đầu thay vì bắt đầu từ rỗng.',
  why:'Kho knowledge rỗng thì mọi máy đọc nó đều vô dụng ở những tuần đầu. Seed từ lịch sử có thật rẻ hơn nhiều so với chờ tích luỹ dần.',
  cmd:'npm run seed:knowledge   ·   npm run seed:knowledge:apply -- --since <YYYY-MM-DD>',
  trap:'Suggest-only: nó chỉ đề xuất. Để máy tự ghi thì knowledge nhiễm suy đoán, mà nhiễm rồi không tách lại được.',
  src:'scripts/qa/seed_knowledge_from_jira.js', rel:['f-knowledge','c-suggest-only','g-risk_score'] },

{ id:'g-knowledge_backup', t:'knowledge:backup', cat:'gate',
  def:'Sao lưu và khôi phục những store knowledge KHÔNG nạp lại được từ nguồn máy.',
  detail:'Đích lưu khai bằng KNOWLEDGE_BACKUP_DIR và phải nằm NGOÀI repo. Có --verify để kiểm bundle và --restore để khôi phục.',
  why:'knowledge/ không được commit vì là dữ liệu công ty, đối xử như .env. Nhưng trong đó có 15 file ghi tay mà không nguồn máy nào sinh lại được — mất là mất hẳn. self_review sẽ nhắc nếu chưa cấu hình đích lưu hoặc bundle đã quá 7 ngày.',
  cmd:'npm run knowledge:backup   ·   -- --verify <bundle>   ·   -- --restore <bundle>',
  src:'scripts/qa/knowledge_backup.js', rel:['f-knowledge','g-self_review','r-security'] },

{ id:'g-skills_index', t:'skills:index', cat:'gate',
  def:'Sinh bảng tra skill từ frontmatter của mọi SKILL.md; bản :check chặn khi bảng lệch.',
  detail:'Quét .agent/skills/**/SKILL.md rồi dựng bảng tên, nhóm, đường dẫn và mô tả "dùng khi nào".',
  why:'Skill của kit nằm ở .agent/skills/** chứ không phải nơi harness tự phát hiện, nên bảng này là cách duy nhất agent biết có skill nào. Sinh tự động để bảng không bao giờ lệch với thực tế thư mục — cùng lý do với danh mục gate.',
  cmd:'npm run skills:index   ·   npm run skills:index:check',
  src:'scripts/qa/skills_index.js', rel:['f-skills-index','g-gate_index','c-canonical','f-slash-commands'] }

];
