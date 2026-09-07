/* NHÓM 4b — khái niệm đi kèm lớp máy mới, và tầng AIO Tests.
   Nguồn: header script trong scripts/qa/, scripts/lib/expansion/, scripts/integrations/aio/README.md. */
const TERMS_CONCEPT2 = [

{ id:'c-expansion-5truc', t:'Mở rộng 5 trục quanh case', cat:'concept',
  def:'Execute không chỉ bám chữ trong testcase — phải mở rộng ra năm hướng quanh nó.',
  detail:'Năm trục: ① field cùng khối với field đang test · ② cùng một giá trị nhưng hiển thị ở màn khác · ③ chuỗi lưu trữ form → payload → API → UI · ④ nhánh và biến thể · ⑤ trạng thái kế cận. Cộng thêm chiều ngược là spec:gap — thứ build có mà tài liệu không nhắc.',
  why:'Đo trên một task thật: 21/69 bug nằm ở trục 2, 13 bug ở trục 3, 42/69 ở trục 4 và 5. Toàn bộ số đó nằm NGOÀI phạm vi chữ nghĩa của testcase — nghĩa là chạy đúng y case vẫn lọt. Nguyên tắc kèm theo rất thẳng: bug do người ngoài tìm ra là lỗi của máy, và phải chỉ ra được lẽ ra máy bắt được ở đâu.',
  how:[
    'Độ sâu đi theo risk band, không mở đều cho mọi case.',
    'Chạy npm run expansion:plan trước để biết mở gì và tốn bao nhiêu.',
    'Kết quả mở rộng chỉ được PASS/FAIL khi có oracle_ref; không neo được thì ghi OBSERVATION.'
  ],
  ex:'Case kiểm ngày sinh ở tab A: mở trục 2 sang tab B thấy cùng giá trị hiển thị khác định dạng — một bug mà case gốc không đụng tới.',
  trap:'Mở rộng mà không có neo tài liệu rồi kết luận PASS là tự tạo oracle từ chính app. Nhất quán KHÔNG phải bằng chứng của đúng.',
  src:'scripts/lib/expansion/', rel:['c-observation','g-expansion_plan','g-cross_surface_diff','g-persistence_probe','g-fixture_matrix'] },

{ id:'c-observation', t:'OBSERVATION (không neo thì không phán)', cat:'concept',
  def:'Phát hiện khi mở rộng chỉ được PASS/FAIL nếu có oracle_ref; không có neo thì ghi là OBSERVATION.',
  detail:'oracle_ref là mã tham chiếu tới nguồn thật — BR- cho business rule, SM- cho bản đồ hệ thống, UI- cho hợp đồng giao diện.',
  why:'Mở rộng đi ra ngoài phạm vi tài liệu rất nhanh. Nếu vẫn cho phép kết luận PASS/FAIL ở đó thì oracle sẽ lặng lẽ trở thành "app đang làm thế nào" — đúng thứ mà kit cấm. OBSERVATION giữ được phát hiện mà không giả vờ là đã phán được.',
  ex:'Thấy hai màn cùng hiển thị một giá trị giống hệt nhau: nếu không có tài liệu nói phải giống thì đó là OBSERVATION, không phải PASS.',
  trap:'Nhất quán giữa hai nơi KHÔNG chứng minh cả hai đều đúng — có thể cùng sai.',
  src:'RULE_GLOBAL.md § Execute Results', rel:['c-expansion-5truc','c-oracle','c-tautology','g-expansion_audit'] },

{ id:'c-mutation', t:'Negative control (mutation)', cat:'concept',
  def:'Cố ý tiêm lỗi vào để đo xem bộ kiểm có phát hiện được không.',
  detail:'Khác mọi phép kiểm khác ở chỗ: chúng cố bắt thêm bug, còn cái này đo năng lực phát hiện của chính bộ kiểm.',
  why:'Không có nó thì "suite này bắt được bug" chỉ là giả định chưa bao giờ được thử. Tiêm sai mà suite vẫn xanh là bằng chứng — không phải nghi ngờ — rằng có vùng mù.',
  trap:'Đây cũng là cách duy nhất phát hiện assertion tautological đã lọt vào suite: assertion so app với chính nó thì tiêm lỗi kiểu gì nó cũng xanh.',
  src:'scripts/qa/mutation_check.js', rel:['g-mutation_check','c-tautology','c-forcing-function','c-leak'] },

{ id:'c-leak', t:'Rò bug (leak)', cat:'concept',
  def:'Bug lọt qua kit rồi bị người khác tìm ra — và phải phân biệt được ai đã tìm ra nó.',
  detail:'Nhãn auto-bug chỉ nói bug được TẠO qua tool của kit, không nói tool TÌM ra nó.',
  why:'Không tách được "ai phát hiện" thì mọi tranh luận về chất lượng kit đều là cảm tính — đã từng báo nhầm "bắt 8, lọt 13" trong khi thực tế QA tìm ra toàn bộ. Có số thì mới biết cải tiến nào thật sự có tác dụng.',
  src:'scripts/qa/leak_report.js', rel:['g-leak_report','g-mutation_check','c-expansion-5truc'] },

{ id:'c-spec-gap', t:'Chiều ngược (spec gap)', cat:'concept',
  def:'Hỏi ngược lại: build đang có gì mà tài liệu không hề nhắc tới.',
  detail:'Bổ sung cho chiều thuận "tài liệu khai gì, build có đủ không". Hai chiều gộp lại mới phủ kín.',
  why:'Chiều thuận bỏ trắng hai vùng nguy hiểm: section trên build mà catalog không khai thì vô hình với máy — không phải "đã kiểm và đúng" mà là "chưa ai nhìn"; và field mọc thêm ngoài tài liệu thì không ai hỏi nó từ đâu ra.',
  src:'scripts/qa/spec_gap_report.js', rel:['g-spec_gap_report','g-ui_conformance_check','c-visual-oracle','c-expansion-5truc'] },

{ id:'c-db-persistence', t:'DB Persistence (§23)', cat:'concept',
  def:'Chiều coverage kiểm bản ghi thật trong database sau khi CRUD.',
  detail:'Chỉ dùng ở những chỗ UI và API không phân biệt được: soft-delete với hard-delete, bản ghi mồ côi do cascade, field không render, ghi trùng, trường dẫn xuất lệch bản ghi gốc. Đi qua tầng dbVerify với adapter Postgres, chạy bằng role CHỈ ĐỌC.',
  why:'Có những lỗi mà nhìn từ ngoài hoàn toàn bình thường: bản ghi vẫn hiện, API vẫn trả đúng, nhưng trong bảng thì đã sinh ra bản ghi mồ côi hoặc ghi trùng. Chỉ đọc DB mới thấy.',
  how:[
    'Viết dạng db_readonly: SELECT … THÊM vào case mutation đã có, không đẻ testcase riêng.',
    'So sánh theo kiểu dữ liệu, không so chuỗi thô.',
    'Thời gian lưu ở UTC (đã đo được), nên so mốc giờ phải quy đổi.'
  ],
  trap:'DB không phải evidence, và tuyệt đối không dùng để DỰNG state.',
  src:'prompt_templates/phase1/dimensions/23_db_persistence.md', rel:['c-db-readonly','c-chieu-coverage','g-persistence_probe','r-uat'] },

{ id:'c-label-oracle', t:'Chữ hiển thị neo vào Figma', cat:'concept',
  def:'Nhãn và chữ trên màn phải đối chiếu với Figma, không phải với file tổng hợp ý định.',
  detail:'File tổng hợp yêu cầu chỉ nói ý định; Figma mới là bản chốt chữ thật sự sẽ hiển thị.',
  why:'Hai nguồn hay lệch nhau ở đúng phần chữ nghĩa — và log bug theo nguồn sai thì bị trả về. Đây cũng là lý do có figma_to_ui_contract: biến Figma thành thứ máy đọc được để assertion không thoái hoá thành "có hiện là được".',
  src:'knowledge/decisions/', rel:['g-figma_to_ui_contract','c-visual-oracle','c-oracle'] },

{ id:'c-one-tms', t:'Luật một-công-cụ (test-management)', cat:'concept',
  def:'Kit chỉ còn MỘT công cụ test-management là AIO Tests — và gate cấm mọi bề mặt còn nhắc tên công cụ trước đó.',
  detail:'Bản trước của luật này chỉ chặn việc dạy công cụ cũ như đường chính, và tha cho những dòng có nhãn legacy. Bản hiện tại cấm cả cái tên.',
  why:'Vì công cụ cũ đã bị bỏ hẳn — script xoá, biến môi trường xoá, dữ liệu đã di trú và đối soát đủ 2103/2103 lượt run. Từ lúc đó, mỗi câu còn nhắc nó là một đường mòn dẫn người hoặc agent đi lạc: đi tìm một lệnh không còn tồn tại, một biến môi trường đã bị xoá.',
  how:[
    'Gate nằm trong policy_source_check, quét prompt_templates · .agent · partial-rerun · docs/library/src · scripts · tests và 6 file tài liệu gốc.',
    'Thấy vi phạm thì xoá hoặc viết lại theo AIO, không để lại ghi chú legacy.',
    'KHÔNG soi CHANGELOG, outputs/, knowledge/ — đó là lịch sử, xoá đi là mất dấu.'
  ],
  ex:'Chính nguồn của trang này nằm trong phạm vi quét, và gate đã bắt đúng hai chỗ tôi nhắc tên cũ khi đang mô tả về chính luật này — phải viết lại mới qua.',
  trap:'Gate từng bỏ sót đuôi .sh và .html, báo ✓ trong khi vẫn có vi phạm thật. Đúng nguyên tắc: gate phải chạy trên nội dung thật mới tính là nghiệm thu.',
  src:'scripts/qa/policy_source_check.js', rel:['f-aio','g-policy_source_check','c-canonical','c-gate-real-content'] },

{ id:'c-aio-no-delete', t:'AIO không có API xoá', cat:'concept',
  def:'Dọn dẹp trên AIO Tests nghĩa là chuyển trạng thái Deprecated, không phải xoá.',
  detail:'Case rời khỏi Excel canonical thì chuyển Deprecated; quay lại thì chuyển Published.',
  why:'Ràng buộc của công cụ, nhưng hoá ra lại đúng hướng: giữ case nghĩa là giữ nguyên lịch sử các lượt chạy đã gắn vào nó. Xoá cho sạch là mất luôn phần lịch sử đó.',
  trap:'Vì không xoá được nên phải dry-run trước mọi lượt publish — đẩy nhầm thì không rút lại được.',
  src:'scripts/integrations/aio/README.md', rel:['f-aio','g-aio_deprecate_stale','sk-jira_testcase_publisher'] }

];
