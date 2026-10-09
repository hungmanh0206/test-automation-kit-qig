/* NHÓM 2b — lớp máy chống-lọt-bug thế hệ sau (8–9/2026) + tầng Google Sheet.
   Vì sao tách file: nhóm này ra đời từ một chương trình riêng — đo "kit đang rò kiểu gì" rồi dựng máy cho
   TỪNG kiểu rò, thay vì thêm quy định. Nguồn: header của chính các script trong scripts/qa/. */
const TERMS_GATE2 = [

/* ── Mở rộng 5 trục quanh case ── */
{ id:'g-expansion_plan', t:'expansion_plan', cat:'gate',
  def:'Quyết TRƯỚC khi chạy: case nào mở rộng trục nào, và tốn bao nhiêu.',
  detail:'Đọc Excel canonical, chia case theo risk band rồi ra kế hoạch mở rộng kèm ước lượng chi phí. Band lấy từ hai cột đã có — Mức độ rủi ro và Ưu tiên, và luôn lấy cái NẶNG HƠN trong hai cột.',
  why:'Mở rộng 5 trục cho MỌI case thì suite dài ra và evidence nhân lên. Đo thật: một task đang có 1021 file, 136 MB evidence, và chính đống artifact đó làm không ai đọc báo cáo nữa. Nên độ sâu phải đi theo band, và chi phí phải hiện ra TRƯỚC khi chạy chứ không phải phát hiện sau khi đầy ổ.',
  how:['Chạy vài giây, chỉ đọc Excel, không cần môi trường.','Kết quả ghi ra reports/expansion-plan.md.'],
  cmd:'npm run expansion:plan',
  ex:'Case Minor nhưng Ưu tiên High vẫn được xếp band cao, vì đó vẫn là đường tiền hoặc đường chính, không được soi mỏng.',
  trap:'Lỗi đo được 21/08/2026: thang Ưu tiên của công cụ cũ có 5 mức và thiếu "critical" thì case ưu tiên cao nhất bị rank 0. Thử bỏ cột Mức độ rủi ro thì 28 case Critical tụt từ band high xuống low, tức từ 5 trục còn 1. Sai đúng chiều nguy hiểm nhất.',
  src:'scripts/qa/expansion_plan.js', rel:['c-expansion-5truc','c-rbt','g-expansion_audit','f-severity'] },

{ id:'g-expansion_audit', t:'expansion_audit', cat:'gate',
  def:'Đo độ phủ 5 trục trên MỌI task đã execute, để quyết định siết gate bằng SỐ chứ không bằng cảm tính.',
  detail:'Quét các task đã chạy, đếm xem mỗi trục có artefact chứng minh hay không, và quan trọng hơn là artefact đó có proven khác 0 không.',
  why:'Câu hỏi "siết cái này thành chặn thì đỏ bao nhiêu task" không trả lời được bằng cảm tính. Đo 19/08/2026 trên 9 task với 1014 case: chỉ 1 task đủ 5 artefact, 7 task được 0/5. Mà chính task "đủ 5/5" đó lại có 3/7 báo cáo proven = 0. Nghĩa là chấm theo "có file hay không" sẽ dạy cả hệ thống đẻ ra file rỗng cho qua chuyện.',
  cmd:'npm run expansion:audit',
  trap:'Đây là ví dụ mẫu của nguyên tắc siết gate phải quyết bằng số đo: đếm task sẽ đỏ, soi proven, ước chi phí, rồi mới chọn điểm chặn.',
  src:'scripts/qa/expansion_audit.js', rel:['c-expansion-5truc','g-expansion_plan','c-gate-real-content','c-advisory'] },

{ id:'g-cross_surface_diff', t:'cross_surface_diff', cat:'gate',
  def:'Trục 2. Cùng một giá trị nhưng hiển thị khác nhau ở hai nơi.',
  detail:'So cùng một dữ liệu giữa các màn, các tab, các bảng. Mỗi màn xét riêng đều "đúng" nên không phép kiểm đơn lẻ nào chạm tới lớp lỗi này.',
  why:'Đây là trục rò NHIỀU NHẤT: đo trên một task thật có 21/69 bug thuộc lớp này, và trước đó kit không có gì bắt được. Lý do là mỗi màn tự nó không sai, chỉ khi đặt cạnh nhau mới lộ.',
  ex:'Tab này hiện ngày sinh thô 2001-05-20, tab kia hiện 20/05/2001. Cả hai màn xét riêng đều không có gì để bắt lỗi.',
  cmd:'npm run xsurf:diff',
  src:'scripts/qa/cross_surface_diff.js', rel:['c-expansion-5truc','c-visual-oracle','g-ui_conformance_check'] },

{ id:'g-persistence_probe', t:'persistence_probe', cat:'gate',
  def:'Trục 3. Giá trị nhập vào có sống sót qua chuỗi form → payload → đọc lại API → UI không.',
  detail:'Bám theo một giá trị qua cả bốn chặng thay vì chỉ kiểm điểm đầu và điểm cuối.',
  why:'Một lớp bug rất đắt mà test theo case gần như không bắt được. Đo trên một task thật có 13 bug thuộc trục này. Mỗi bug đều "đúng" ở vài chặng, nên nhìn từng chặng riêng lẻ thì thấy hoàn toàn bình thường.',
  cmd:'npm run probe:persist',
  src:'scripts/qa/persistence_probe.js', rel:['c-expansion-5truc','c-db-persistence','s-api_bug'] },

{ id:'g-fixture_matrix', t:'fixture_matrix', cat:'gate',
  def:'Trục 4 và 5. Nhánh/biến thể × trạng thái kế cận. Đo xem đang thiếu ô dữ liệu nào.',
  detail:'Dựng ma trận các tổ hợp cần thử rồi đánh dấu ô nào đã có fixture, ô nào chưa dựng nổi.',
  why:'Hai trục rò nhiều thứ hai — 42/69 bug của một task thật, và lý do rất tầm thường: KHÔNG CÓ DỮ LIỆU ĐỂ THỬ. Case viết ra cho "đơn đã thanh toán rồi hủy" mà không ai dựng nổi fixture đó thì case chìm vào SKIP rồi biến mất khỏi báo cáo. Không đo được mình đang thiếu ô nào thì mãi không biết phải dựng gì.',
  cmd:'npm run fixture:matrix',
  src:'scripts/qa/fixture_matrix.js', rel:['c-expansion-5truc','c-precondition','s-SKIP','sk-test_data_generator'] },

/* ── Đo năng lực của chính bộ kiểm ── */
{ id:'g-mutation_check', t:'mutation_check', cat:'gate',
  def:'Negative control. Cố ý tiêm lỗi vào rồi xem bộ kiểm có ĐỎ lên không.',
  detail:'Mọi máy khác đều cố bắt thêm bug. Máy này đo năng lực phát hiện của chính bộ kiểm. Tiêm sai mà suite vẫn xanh nghĩa là vùng mù đã được CHỨNG MINH, không còn là phỏng đoán.',
  why:'Trước khi có nó, câu "cover đầy đủ mà vẫn lọt bug" chỉ có thể phỏng đoán, vì kit đang GIẢ ĐỊNH suite bắt được bug mà chưa bao giờ chứng minh điều đó. Đây là thứ quan trọng nhất trong cả nhóm.',
  cmd:'npm run mutation:check',
  ex:'Đổi một hằng số trong công thức tính tiền rồi chạy suite: suite vẫn xanh nghĩa là không có case nào thật sự kiểm công thức đó.',
  src:'scripts/qa/mutation_check.js', rel:['c-mutation','g-leak_report','c-forcing-function','c-tautology'] },

{ id:'g-leak_report', t:'leak_report', cat:'gate',
  def:'Đo kit đang rò bao nhiêu bug và rò theo kiểu gì, làm mốc so sánh cho mọi cải tiến sau.',
  detail:'Tách bạch "bug được tạo qua tool của kit" với "bug do tool TÌM ra". Hai chuyện đó khác hẳn nhau.',
  why:'Nhãn auto-bug chỉ chứng minh bug được TẠO qua tool, KHÔNG chứng minh tool tìm ra nó. Không tách được "ai phát hiện" thì mọi tranh luận "kit lọt nhiều hay ít" đều là cảm tính, và đã xảy ra thật: từng báo nhầm "bắt 8, lọt 13" trong khi thực tế QA tìm ra toàn bộ.',
  cmd:'npm run leak:report',
  src:'scripts/qa/leak_report.js', rel:['g-mutation_check','c-leak','f-knowledge'] },

/* ── Biến tài liệu thành oracle máy đọc được ── */
{ id:'g-spec_extract', t:'spec_extract', cat:'gate',
  def:'Bóc bảng field trong FSD thành screens.json, rồi thành ui_catalog.json.',
  detail:'Đọc bảng markdown trong tài liệu đặc tả, trích tên field và ràng buộc, sinh ra catalog mà ui_conformance_check dùng được.',
  why:'ui_conformance_check chỉ đối chiếu được những màn mà NGƯỜI chịu khai tay vào catalog. Đo 19/08/2026: một task có 28 nhóm chức năng nhưng catalog chỉ có 5 màn, tức 23 nhóm không có gì kiểm. Khai tay không bao giờ đuổi kịp.',
  cmd:'npm run spec:extract',
  src:'scripts/qa/spec_extract.js', rel:['f-ui-catalog','g-ui_conformance_check','g-spec_gap_report','c-visual-oracle'] },

{ id:'g-spec_gap_report', t:'spec_gap_report', cat:'gate',
  def:'Chiều NGƯỢC — build có mà tài liệu không hề nhắc tới.',
  detail:'ui_conformance_check chỉ hỏi được một chiều: tài liệu khai gì, build có đủ không. Máy này hỏi chiều còn lại.',
  why:'Chiều thuận bỏ trắng hai vùng: section trên build mà catalog không khai thì mọi field trong đó vô hình với máy, không phải "đã kiểm và đúng" mà là "chưa ai nhìn tới"; và field mọc thêm ngoài tài liệu thì không ai đặt câu hỏi nó từ đâu ra.',
  cmd:'npm run spec:gap',
  src:'scripts/qa/spec_gap_report.js', rel:['g-spec_extract','g-ui_conformance_check','c-spec-gap','f-ui-catalog'] },

{ id:'g-figma_to_ui_contract', t:'figma_to_ui_contract', cat:'gate',
  def:'Biến thiết kế Figma thành oracle máy đọc được, lưu ở knowledge/system/UI-*.json.',
  detail:'Trích token, nhãn và cấu trúc từ Figma thành hợp đồng giao diện mà assertion có thể so vào.',
  why:'Đây là fix gốc của bất đối xứng oracle. Backend có Swagger nên assertion viết được là total = 540000, sai là đỏ ngay. Frontend chỉ có Figma. Là hình ảnh, máy không đọc được, nên assertion thoái hoá thành toBeVisible(), tức gần như không kiểm gì.',
  cmd:'npm run ui:contract',
  src:'scripts/qa/figma_to_ui_contract.js', rel:['c-visual-oracle','c-oracle','f-ui-catalog','c-label-oracle'] },

{ id:'g-bugs_checklist', t:'bugs_checklist', cat:'gate',
  def:'Biến kho bug lịch sử thành checklist ngay lúc SINH CASE (chiều §20 Error Guessing).',
  detail:'Đọc knowledge/bugs/ rồi đối chiếu: mỗi lỗi từng xảy ra đã có case nào đứng canh chưa.',
  why:'Đo 20/08/2026: kho có 58 bug thật, nhưng nơi DUY NHẤT đọc nó ở khâu sinh case chỉ dùng để nâng risk cho module hay vỡ. Không prompt nào bắt "mỗi lỗi từng xảy ra phải có TC canh". Lỗi đã lọt một lần thì đường lọt đó còn mở cho tới khi có case đứng canh.',
  cmd:'npm run bugs:checklist',
  src:'scripts/qa/bugs_checklist.js', rel:['c-chieu-coverage','f-knowledge','g-risk_score','g-bug_tc_matcher'] },

/* ── Nhánh dò tự do ── */
{ id:'g-explore_charter', t:'explore_charter', cat:'gate',
  def:'Chọn vùng dò bằng DỮ LIỆU, không bằng cảm tính.',
  detail:'Gợi ý vùng đáng dò từ các nguồn sẵn có trong kit thay vì để người tự chọn.',
  why:'Runbook cũ bắt đầu bằng "lập charter theo scope user nêu". Nhưng người, và cả agent. Hay chọn vùng mình QUEN, tức vùng đã test nhiều và đã an toàn. Trong khi kit đang có sẵn bốn nguồn nói rõ chỗ nào đáng nghi mà chưa ai dò tới.',
  cmd:'npm run explore:charter',
  src:'scripts/qa/explore_charter.js', rel:['g-explore_session','c-rbt','g-leak_report'] },

{ id:'g-explore_session', t:'explore_session', cat:'gate',
  def:'Máy cho nhánh exploratory, kiểm phiên dò và đóng vòng học.',
  detail:'Ép các ràng buộc của nhánh dò: phải có bước tái hiện, evidence là ảnh hoặc video, không PII, draft KHÔNG được tính vào coverage, đủ 4 file output.',
  why:'Trước đây exploratory/ toàn văn bản, mọi rule chỉ là lời dặn, không có gì kiểm. Nhánh dò tự do mà không có ràng buộc thì kết quả không dùng lại được, và tệ hơn là draft lọt vào số coverage làm đẹp báo cáo một cách giả tạo.',
  cmd:'npm run explore:check   ·   npm run explore:check:enforce   ·   npm run explore:close',
  src:'scripts/qa/explore_session.js', rel:['g-explore_charter','r-evidence','c-mask-pii','c-chieu-coverage'] },

{ id:'g-manual_run_check', t:'manual_run_check', cat:'gate',
  def:'Máy cho nhánh chạy tay, gác ranh giới của lợi khai [manual].',
  detail:'Làm đúng hai việc. Một, case chạy tay mà bộ canonical khai [api], [factory], [test_hook], [ui] hay [pre_existing] thì CHẶN. Hai, ủy quyền phần chất lượng output cho output_gate mode test-execution, nên không có danh sách luật thứ hai về evidence hay verdict.',
  why:'Kit đã biết đánh dấu case không tự động hoá được rồi DẮNG ở đó: Phase 2 ghi SKIP_SETUP, và case nằm mãi ở đó. SKIP_SETUP là lời khai chưa chạy, không phải một kết luận. Nhưng mở nhánh chạy tay mà không có cửa thì nó thành đường lách: case nào viết automation khó thì đẩy sang chạy tay, và coverage automation tụt mà không ai thấy.',
  how:['Chỉ đọc, không cần môi trường.','Kết quả đi qua khuôn testcase-status.json dùng chung với Phase 2.'],
  cmd:'npm run manual:check   ·   npm run manual:check:enforce',
  src:'scripts/qa/manual_run_check.js', rel:['g-explore_session','r-evidence','c-mask-pii'] },

/* ── Vệ sinh hạ tầng ── */
{ id:'g-ci_scope_check', t:'ci_scope_check', cat:'gate',
  def:'Máy đứng sau luật "CI generic KHÔNG được tự chạm UAT".',
  detail:'Kiểm phạm vi những gì CI được phép chạy, khai ở một nguồn duy nhất là ci_scope.json.',
  why:'Không phải giả định mà là chuyện đã xảy ra: một commit quét 46 spec theo task cộng 8 spec DB vào repo, trong khi job nightly chạy playwright test TRẦN — cả suite, với credentials UAT sẵn trong env. Nghĩa là từ commit đó, mỗi đêm CI tự động thao tác lên UAT mà không ai chủ ý.',
  cmd:'npm run ci:scope',
  trap:'Spec theo task thì không track vào repo. Nightly chỉ chạy tests/fe/infra.',
  src:'scripts/qa/ci_scope_check.js', rel:['r-uat','c-non-destructive','r-scope','g-test_inventory_gate'] },

{ id:'g-json_check', t:'json_check', cat:'gate',
  def:'Kiểm MỌI file .json đang được track có parse được không.',
  detail:'Tự tìm file theo danh sách track của git thay vì đọc một danh sách viết tay.',
  why:'Trước đây cả hai CI hardcode đúng ba đường dẫn, trong đó có một file thuộc knowledge/. Khi knowledge/ bị bỏ track vì là dữ liệu công ty, job static ĐỎ ở mọi lần push vì không tìm thấy file, đỏ không liên quan gì tới nội dung được push. Danh sách viết tay là thứ chắc chắn sẽ mục.',
  cmd:'npm run json:check',
  src:'scripts/qa/json_check.js', rel:['g-preflight_gate','f-knowledge','g-audit_ci'] }

];
