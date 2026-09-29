/* NHÓM 1 — 6 nguyên tắc không-thương-lượng (nguồn: CLAUDE.md · RULE_GLOBAL.md) */
const TERMS_RULE = [

{ id:'r-security', t:'Bảo mật tuyệt đối', cat:'rule',
  def:'Không để lọt secret vào repo, và không để lọt thông tin khách hàng ra evidence hay Backlog.',
  detail:'Hai vế tách bạch. Vế thứ nhất là secret của hệ thống: token, password, cookie, API key, file service-account JSON — không được ghi vào file nào được commit. Vế thứ hai là PII của khách: email, số điện thoại, họ tên, địa chỉ. Được phép nhìn thấy trên màn khi test, nhưng mọi thứ rời khỏi máy (ảnh evidence, report, mô tả bug trên Backlog) đều phải che.',
  why:'Repo được đồng bộ qua GitLab/GitHub và evidence được đính thẳng lên Backlog, nơi rất nhiều người ngoài team QA đọc được. Một lần commit nhầm token là phải xoay vòng lại toàn bộ credential. Một ảnh chụp còn nguyên email khách là rò rỉ dữ liệu thật.',
  how:[
    'Creds để trong profiles/<TASK>/task.env, file này không commit.',
    'Trước khi push: npm run secret:scan (quét file đã track, tự chặn nếu thấy secret thật).',
    'Che PII trên ảnh bằng cách sửa giá trị element rồi mới chụp.',
    'Email/SĐT khách từ CRM hay DB: chỉ hiển thị trong phiên chat, tuyệt đối không xuất ra file.'
  ],
  ex:'Chụp màn danh sách đơn hàng: trước khi screenshot, set lại text các ô email thành "***@***" và số điện thoại thành "09**-***-***", rồi mới chụp.',
  trap:'Che bằng cách sửa textContent KHÔNG che được ô nhập liệu. Giá trị vẫn nằm ở input.value và hiện nguyên trên ảnh. Với input phải set .value.',
  src:'CLAUDE.md', rel:['g-secret_scan','c-mask-pii','f-task-env'] },

{ id:'r-uat', t:'UAT non-destructive · DB read-only', cat:'rule',
  def:'Không làm hỏng dữ liệu trên môi trường UAT, và không dùng câu lệnh DB để dựng dữ liệu cho test.',
  detail:'UAT là môi trường dùng chung: BA demo trên đó, Dev debug trên đó, QA khác cũng đang chạy trên đó. Vì vậy mỗi lượt thao tác có khả năng thay đổi dữ liệu đều phải xác nhận trước. Riêng database thì chỉ được đọc, đi qua guarded client tests/support/setup/db/uatDbClient.ts và chỉ chạy SELECT.',
  why:'Hai lý do khác nhau. Non-destructive là để không phá việc của người khác. DB read-only là vì dữ liệu dựng bằng UPDATE thẳng vào bảng có thể ở trạng thái mà luồng ứng dụng thật không bao giờ tạo ra được, test trên đó rất dễ đẻ ra "bug" không tồn tại.',
  how:[
    'Dựng state qua UI, qua API, qua factory hoặc test hook, không qua DB.',
    'DB chỉ dùng để verify khi UI/API không phân biệt được (soft-delete vs hard-delete, bản ghi mồ côi, field không render).',
    'Dữ liệu tự tạo phải đặt tên nhận diện được và có đường dọn.'
  ],
  ex:'Cần một đơn hàng ở trạng thái đã thanh toán: tạo đơn qua API rồi gọi luồng thanh toán thật, chứ không UPDATE thẳng cột status thành PAID.',
  trap:'Kết quả truy vấn DB không được tính là evidence. Muốn chứng minh thì phải có ảnh hoặc video màn hình.',
  src:'tests/support/setup/db/uatDbClient.ts', rel:['c-non-destructive','c-db-readonly','c-precondition','c-natural-setup'] },

{ id:'r-verify', t:'Verify thật trước khi kết luận', cat:'rule',
  def:'Phải chạy thật rồi mới phán kết quả; FAIL phải chạy lại 2–3 lần trước khi gọi là bug.',
  detail:'Ba mệnh lệnh gộp lại. Một, không được ghi TODO hay SKIP cho case mà mình chưa thử. Hai, case FAIL phải rerun tối thiểu 2 lần, tối đa 3, để loại khả năng chập chờn hoặc lỗi dựng dữ liệu. Ba, oracle. Tức cơ sở để nói đúng hay sai. Phải độc lập theo tài liệu, là một giá trị, một URL, một element cụ thể. Cấm lấy chính ứng dụng làm chuẩn để kiểm ứng dụng.',
  why:'Ba kiểu gian lận vô tình phổ biến nhất đều bị chặn ở đây: đánh SKIP cho case khó rồi coi như xong. Log bug cho một lần fail ngẫu nhiên khiến Dev mất buổi điều tra rồi trả lại. Và viết assertion so sánh dữ liệu app với chính nó nên test luôn xanh mà không chứng minh được gì.',
  how:[
    'Chưa chạy được thì ghi lý do cụ thể và thiếu capability gì, không ghi PASS.',
    'FAIL → rerun → nếu lật thành PASS thì đó là flaky, không phải bug.',
    'Trước khi viết expected, trả lời được câu: giá trị này lấy từ tài liệu nào, dòng nào.'
  ],
  ex:'Case kiểm tổng tiền: expected là 1.500.000 lấy từ công thức trong FSD, không phải "bằng con số đang hiển thị ở màn Chi tiết".',
  trap:'"Không phán được" KHÔNG được biến thành PASS. Đó là một trạng thái riêng, phải ghi rõ.',
  src:'.agent/config/verdict_taxonomy.json', rel:['c-oracle','c-tautology','c-rerun','s-BLOCKED_SETUP','c-flaky'] },

{ id:'r-evidence', t:'Evidence bắt buộc', cat:'rule',
  def:'Mọi case đã chạy. Kể cả case PASS — và mọi bước đều phải có ảnh hoặc video đúng màn.',
  detail:'Định dạng được chấp nhận: ảnh .png .jpg .jpeg .webp, video .mp4 .webm. Ảnh phải khoanh đỏ đúng element cần nhìn kèm nhãn ngắn, và phải che PII. Case phức tạp. Nghĩa là lỗi chỉ lộ ra qua một chuỗi thao tác. Thì bắt buộc quay video có banner mô tả từng bước.',
  why:'Evidence là thứ duy nhất khiến kết quả kiểm chứng được sau này. PASS cũng cần evidence vì nếu sau này phát hiện lỗi ở đúng chỗ đó, phải trả lời được lúc test màn hình trông thế nào. Ảnh chụp trơn thì người đọc phải tự dò, dev nhìn không ra chỗ sai sẽ trả bug về.',
  how:[
    'Khoanh đỏ: set outline cho element rồi thêm div nhãn định vị theo getBoundingClientRect(), sau đó mới chụp.',
    'Quay video: bật recordVideo khi mở context, chèn banner từng bước, dừng 2–3 giây mỗi bước cho người xem kịp đọc.',
    'Cần so sánh thì highlight cả trạng thái đúng lẫn trạng thái sai trên cùng một ảnh.'
  ],
  ex:'Bug "cây phân cấp hiện 2 nhánh ở OPS nhưng 1 nhánh ở LMS": ảnh phải khoanh cả hai, nhãn "OPS 2 cây (sai)" và "LMS 1 cây (đúng)".',
  trap:'File .json, .md, .txt, .log, .html, .csv và trace.zip đều KHÔNG phải evidence. Trace chỉ là công cụ debug tại chỗ.',
  src:'RULE_GLOBAL.md § Evidence', rel:['c-evidence','c-highlight','c-video-evidence','g-output_gate'] },

{ id:'r-scope', t:'Scope & isolation', cat:'rule',
  def:'Mỗi task có mã riêng, thư mục output riêng và file cấu hình riêng. Không giẫm lên nhau.',
  detail:'TASK_KEY và PROJECT_OUTPUT_DIR là bắt buộc, mọi artifact nằm gọn trong <PROJECT_OUTPUT_DIR>/tasks/<TASK_KEY>/. Credentials của task nằm ở profiles/<TASK_KEY>/task.env chứ không phải .env chung. Khi story khác đang chạy thì không được sửa file dùng chung: tests/support/**, helper, .env.',
  why:'Team chạy nhiều story song song, mỗi story một phiên làm việc. Không có ranh giới thì lượt chạy này ghi đè output của lượt kia, hoặc sửa một helper dùng chung làm gãy suite của người khác giữa chừng.',
  how:[
    'Tạo profile: npm run profile:create -- <TASK_KEY>.',
    'Echo PROJECT_OUTPUT_DIR, TASK_KEY, TASK_OUTPUT_DIR trước khi ghi file.',
    'Chạy song song cùng một TASK_KEY thì thêm RUN_ID để tách artifact.',
    'Chạy Playwright theo task: npm run test:task -- --project-output … --task …'
  ],
  ex:'Task CSDL-24395 chạy với TASK_ENV=profiles/CSDL-24395/task.env, output đổ vào outputs/<project>/tasks/CSDL-24395/.',
  trap:'Không được suy TASK_KEY từ ngữ cảnh của phiên trước. Sai mã task nghĩa là đọc nhầm creds và ghi nhầm chỗ, mà cả hai đều im lặng.',
  src:'CLAUDE.md', rel:['f-task-key','f-task-env','f-output-dir','f-kit-layers'] },

{ id:'r-nocheat', t:'Không gian lận để PASS', cat:'rule',
  def:'Không nới assertion, không sửa expected cho khớp build, không skip case để pass rate đẹp.',
  detail:'Cấm bốn hành vi: xoá hoặc làm lỏng assertion cho test hết đỏ. Đổi expected result khi chưa có requirement/API/design xác nhận. Skip case chỉ để tăng tỉ lệ pass. Và hardcode dữ liệu riêng của một task vào template dùng chung. Nguồn sự thật của testcase là Excel canonical và Google Sheet. Mỗi phase phải đọc lại artifact đó, không dựa vào trí nhớ hội thoại.',
  why:'Report tồn tại để phản ánh chất lượng thật. Một suite 100% xanh vì đã nới hết assertion còn nguy hiểm hơn suite 70% xanh trung thực, vì nó tạo cảm giác an toàn giả và bug đi thẳng ra production.',
  how:[
    'Expected sai thì đi hỏi BA/Dev để sửa tài liệu, rồi mới sửa testcase, theo thứ tự đó.',
    'Case không chạy được thì ghi đúng trạng thái của nó, không ghi PASS.',
    'Case vướng dữ liệu/môi trường mà không phải lỗi sản phẩm thì ghi PASS kèm comment giải thích trung thực.'
  ],
  ex:'Assertion so tổng tiền fail vì app tính sai → log bug, chứ không đổi expected thành con số app đang trả.',
  trap:'Chữa locator của assertion cũng là gian lận trá hình. Nó biến "so sai element" thành "so element nào cũng được". Locator healing chỉ được phép áp cho locator thao tác.',
  src:'CLAUDE.md', rel:['c-canonical','f-excel-canonical','g-design_gate','c-locator-healing','s-blocked-pass-note'] }

];
