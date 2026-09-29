/* NHÓM 4b — khái niệm đi kèm lớp máy mới, và tầng Google Sheet.
   Nguồn: header script trong scripts/qa/, scripts/lib/expansion/, scripts/integrations/aio/README.md. */
const TERMS_CONCEPT2 = [

{ id:'c-expansion-5truc', t:'Mở rộng 5 trục quanh case', cat:'concept',
  def:'Execute không chỉ bám chữ trong testcase, phải mở rộng ra năm hướng quanh nó.',
  detail:'Năm trục: ① field cùng khối với field đang test · ② cùng một giá trị nhưng hiển thị ở màn khác · ③ chuỗi lưu trữ form → payload → API → UI · ④ nhánh và biến thể · ⑤ trạng thái kế cận. Cộng thêm chiều ngược là spec:gap, thứ build có mà tài liệu không nhắc.',
  why:'Đo trên một task thật: 21/69 bug nằm ở trục 2, 13 bug ở trục 3, 42/69 ở trục 4 và 5. Toàn bộ số đó nằm NGOÀI phạm vi chữ nghĩa của testcase, nghĩa là chạy đúng y case vẫn lọt. Nguyên tắc kèm theo rất thẳng: bug do người ngoài tìm ra là lỗi của máy, và phải chỉ ra được lẽ ra máy bắt được ở đâu.',
  how:[
    'Độ sâu đi theo risk band, không mở đều cho mọi case.',
    'Chạy npm run expansion:plan trước để biết mở gì và tốn bao nhiêu.',
    'Kết quả mở rộng chỉ được PASS/FAIL khi có oracle_ref. Không neo được thì ghi OBSERVATION.'
  ],
  ex:'Case kiểm ngày sinh ở tab A: mở trục 2 sang tab B thấy cùng giá trị hiển thị khác định dạng, một bug mà case gốc không đụng tới.',
  trap:'Mở rộng mà không có neo tài liệu rồi kết luận PASS là tự tạo oracle từ chính app. Nhất quán KHÔNG phải bằng chứng của đúng.',
  src:'scripts/lib/expansion/', rel:['c-observation','g-expansion_plan','g-cross_surface_diff','g-persistence_probe','g-fixture_matrix'] },

{ id:'c-observation', t:'OBSERVATION (không neo thì không phán)', cat:'concept',
  def:'Phát hiện khi mở rộng chỉ được PASS/FAIL nếu có oracle_ref. Không có neo thì ghi là OBSERVATION.',
  detail:'oracle_ref là mã tham chiếu tới nguồn thật — BR- cho business rule, SM- cho bản đồ hệ thống, UI- cho hợp đồng giao diện.',
  why:'Mở rộng đi ra ngoài phạm vi tài liệu rất nhanh. Nếu vẫn cho phép kết luận PASS/FAIL ở đó thì oracle sẽ lặng lẽ trở thành "app đang làm thế nào", đúng thứ mà kit cấm. OBSERVATION giữ được phát hiện mà không giả vờ là đã phán được.',
  ex:'Thấy hai màn cùng hiển thị một giá trị giống hệt nhau: nếu không có tài liệu nói phải giống thì đó là OBSERVATION, không phải PASS.',
  trap:'Nhất quán giữa hai nơi KHÔNG chứng minh cả hai đều đúng, có thể cùng sai.',
  src:'RULE_GLOBAL.md § Execute Results', rel:['c-expansion-5truc','c-oracle','c-tautology','g-expansion_audit'] },

{ id:'c-mutation', t:'Negative control (mutation)', cat:'concept',
  def:'Cố ý tiêm lỗi vào để đo xem bộ kiểm có phát hiện được không.',
  detail:'Khác mọi phép kiểm khác ở chỗ: chúng cố bắt thêm bug, còn cái này đo năng lực phát hiện của chính bộ kiểm.',
  why:'Không có nó thì "suite này bắt được bug" chỉ là giả định chưa bao giờ được thử. Tiêm sai mà suite vẫn xanh là bằng chứng, không phải nghi ngờ, rằng có vùng mù.',
  trap:'Đây cũng là cách duy nhất phát hiện assertion tautological đã lọt vào suite: assertion so app với chính nó thì tiêm lỗi kiểu gì nó cũng xanh.',
  src:'scripts/qa/mutation_check.js', rel:['g-mutation_check','c-tautology','c-forcing-function','c-leak'] },

{ id:'c-leak', t:'Rò bug (leak)', cat:'concept',
  def:'Bug lọt qua kit rồi bị người khác tìm ra, và phải phân biệt được ai đã tìm ra nó.',
  detail:'Nhãn auto-bug chỉ nói bug được TẠO qua tool của kit, không nói tool TÌM ra nó.',
  why:'Không tách được "ai phát hiện" thì mọi tranh luận về chất lượng kit đều là cảm tính. Đã từng báo nhầm "bắt 8, lọt 13" trong khi thực tế QA tìm ra toàn bộ. Có số thì mới biết cải tiến nào thật sự có tác dụng.',
  src:'scripts/qa/leak_report.js', rel:['g-leak_report','g-mutation_check','c-expansion-5truc'] },

{ id:'c-spec-gap', t:'Chiều ngược (spec gap)', cat:'concept',
  def:'Hỏi ngược lại: build đang có gì mà tài liệu không hề nhắc tới.',
  detail:'Bổ sung cho chiều thuận "tài liệu khai gì, build có đủ không". Hai chiều gộp lại mới phủ kín.',
  why:'Chiều thuận bỏ trắng hai vùng nguy hiểm: section trên build mà catalog không khai thì vô hình với máy, không phải "đã kiểm và đúng" mà là "chưa ai nhìn"; và field mọc thêm ngoài tài liệu thì không ai hỏi nó từ đâu ra.',
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
  why:'Hai nguồn hay lệch nhau ở đúng phần chữ nghĩa, và log bug theo nguồn sai thì bị trả về. Đây cũng là lý do có figma_to_ui_contract: biến Figma thành thứ máy đọc được để assertion không thoái hoá thành "có hiện là được".',
  src:'knowledge/decisions/', rel:['g-figma_to_ui_contract','c-visual-oracle','c-oracle'] },

{ id:'c-one-tms', t:'Luật một-công-cụ (test-management)', cat:'concept',
  def:'Kit chỉ còn MỘT công cụ test-management là Google Sheet, và gate cấm mọi bề mặt còn nhắc tên công cụ trước đó.',
  detail:'Bản trước của luật này chỉ chặn việc dạy công cụ cũ như đường chính, và tha cho những dòng có nhãn legacy. Bản hiện tại cấm cả cái tên.',
  why:'Vì công cụ cũ đã bị bỏ hẳn. Script xoá, biến môi trường xoá, dữ liệu đã di trú và đối soát đủ 2103/2103 lượt run. Từ lúc đó, mỗi câu còn nhắc nó là một đường mòn dẫn người hoặc agent đi lạc: đi tìm một lệnh không còn tồn tại, một biến môi trường đã bị xoá.',
  how:[
    'Gate nằm trong policy_source_check, quét prompt_templates · .agent · partial-rerun · docs/library/src · scripts · tests và 6 file tài liệu gốc.',
    'Thấy vi phạm thì xoá hoặc viết lại theo luồng Google Sheet, không để lại ghi chú legacy.',
    'KHÔNG soi CHANGELOG, outputs/, knowledge/ — đó là lịch sử, xoá đi là mất dấu.'
  ],
  ex:'Chính nguồn của trang này nằm trong phạm vi quét, và gate đã bắt đúng hai chỗ tôi nhắc tên cũ khi đang mô tả về chính luật này, phải viết lại mới qua.',
  trap:'Gate từng bỏ sót đuôi .sh và .html, báo ✓ trong khi vẫn có vi phạm thật. Đúng nguyên tắc: gate phải chạy trên nội dung thật mới tính là nghiệm thu.',
  src:'scripts/qa/policy_source_check.js', rel:['f-sheet','g-policy_source_check','c-canonical','c-gate-real-content'] },

{ id:'c-sheet-ghi-de', t:'Sheet ghi đè toàn bộ mỗi lần sync', cat:'concept',
  def:'Dọn dẹp trên Google Sheet nghĩa là chuyển trạng thái Deprecated, không phải xoá.',
  detail:'Case rời khỏi Excel canonical thì chuyển Deprecated. Quay lại thì chuyển Published.',
  why:'Ràng buộc của công cụ, nhưng hoá ra lại đúng hướng: giữ case nghĩa là giữ nguyên lịch sử các lượt chạy đã gắn vào nó. Xoá cho sạch là mất luôn phần lịch sử đó.',
  trap:'Vì không xoá được nên phải dry-run trước mọi lượt publish, đẩy nhầm thì không rút lại được.',
  src:'.agent/skills/shared/backlog_testcase_publisher/SKILL.md', rel:['f-sheet','sk-backlog_testcase_publisher'] },

/* ── Bốn khái niệm rút ra từ đợt sửa dụng cụ đo tháng 9/2026 ─────────────── */

{ id:'c-tin-hieu-sach-gia', t:'Tín hiệu sạch-giả', cat:'concept',
  def:'Máy đo in ra "không có vấn đề" trong khi nó chưa hề nhìn tới phần lớn dữ liệu.',
  detail:'Nguy hiểm hơn không có máy, vì không có máy thì người ta còn đi kiểm tay; có máy báo sạch thì không ai kiểm nữa. Ba dạng đã gặp trong kit này: máy chỉ nhận MỘT khuôn dữ liệu rồi bỏ qua khuôn khác mà vẫn in sạch · câu tóm tắt đọc ra nghĩa mạnh hơn thứ máy thật sự đo · và phép so bằng THỜI GIAN thay vì bằng NỘI DUNG.',
  why:'Bốn lần đo sai trong repo này đều cùng một hình dạng: dụng cụ hỏng, và mọi "phát hiện" của nó là báo oan hoặc bỏ sót. Con số "13 task không có tài liệu lành" hoá ra sai hẳn; số thật là 2.',
  how:['Mỗi máy mới phải có ĐỐI CHỨNG ÂM: bơm vào một mẫu sai đã biết, máy phải gọi đúng tên nó.','Câu máy in ra phải nói đúng thứ nó đo. "Không có tài liệu nguồn nào" khác hẳn "không đọc được id của tài liệu nào".','Nghi ngờ mọi phép đo trả về 0 vi phạm ngay lượt đầu.'],
  ex:'Một máy soát tài liệu bản đầu chỉ nhận MỘT khuôn id nên bỏ sót nguyên một thư mục 16 file, mà vẫn in tín hiệu sạch.',
  src:'scripts/qa/mutation_check.js', rel:['c-gate-real-content','g-mutation_check','c-oracle'] },

{ id:'c-noi-dung-khong-phai-thoi-gian', t:'So nội dung, đừng so thời gian', cat:'concept',
  def:'Câu hỏi "bản sinh ra có khớp nguồn không" phải trả lời bằng cách dựng lại rồi đối chiếu, không bằng dấu thời gian.',
  detail:'Hai cách lấy thời gian làm proxy đều đã hỏng trong repo này. Theo mtime: git không giữ mtime nên sau khi clone, thứ tự checkout quyết định tất cả, và bản build luôn bị coi là CŨ hơn nguồn trên CI. Theo thời điểm commit: hết đỏ oan nhưng sinh lỗi ngược — commit một file nguồn mà output không đổi làm bản build trông như cũ mãi mãi.',
  why:'Cả hai đều đang đo một thứ KHÁC với thứ cần biết. Thời gian chỉ tương quan với nội dung, và tương quan thì gãy ở đúng những lúc đáng tin nhất.',
  how:['Ghép lại trong bộ nhớ rồi so, không ghi gì ra đĩa.','Dùng chính đường ghép thật, đừng nhân bản logic sang gate — hai bản sẽ trôi khỏi nhau.','Điều kiện cần: quá trình dựng phải TẤT ĐỊNH. Hai lượt phải cho ra byte giống nhau.'],
  ex:'library:drift đổi sang build.js --check: ghép trong bộ nhớ rồi đối chiếu nội dung. Trước đó cây làm việc báo đúng còn hai worktree vừa checkout và log CI đều báo oan.',
  src:'docs/library/build.js', rel:['g-library_drift','c-tin-hieu-sach-gia','c-crlf-cua-doc'] },

{ id:'c-crlf-cua-doc', t:'Chuẩn hoá xuống dòng ở CỬA ĐỌC', cat:'concept',
  def:'Đổi CRLF về LF một lần ngay lúc đọc file, thay vì vá từng biểu thức chính quy.',
  detail:'Git áp core.autocrlf nên bản checkout trên Windows là CRLF, còn blob và CI là LF. Mọi regex phụ thuộc \n đều vỡ ở máy mà vẫn xanh ở CI — đúng loại lỗi khó nhất để tin.',
  why:'Một file có 281 chỗ dùng \n và 0 chỗ phòng CRLF thì vá từng chỗ là sai cách: chỉ cần bỏ sót một chỗ là lỗi vẫn còn, mà lại khó thấy hơn. Chuẩn hoá một dòng ở cửa đọc phủ hết.',
  how:['Chuẩn hoá ở MỌI cửa đọc, kể cả cửa chỉ đọc để đếm.','Nội dung đi qua JSON.stringify thì \r sống sót thành escape, khiến bản build trên Windows KHÁC bản build trên Linux dù nguồn y hệt.'],
  ex:'Một gốc lỗi, ba biểu hiện cùng ngày: parser giáo trình đọc ra 0 chặng, bản build lệch theo hệ điều hành, và gate đếm được 0 khối mã trong khi sàn là 78.',
  src:'docs/library/src/course_parse.js', rel:['c-noi-dung-khong-phai-thoi-gian','g-library_drift','c-tin-hieu-sach-gia'] },

{ id:'c-bo-doi-tai-lieu', t:'Bộ đổi tài liệu ăn mất bảng', cat:'concept',
  def:'Gỡ thẻ HTML bằng một biểu thức chính quy làm mất sạch bảng và khối mã, mà file vẫn trông bình thường.',
  detail:'Cách làm cũ là replace thẻ bằng dấu cách rồi gộp khoảng trắng. Kết quả: cả trang thành một dòng, không còn dòng bảng nào, và khối CDATA bị ăn trọn khi ruột không có dấu lớn hơn — tức mất luôn AC viết bằng Gherkin trong macro code.',
  why:'Ở tài liệu dự án này thì điều kiện chấp nhận NẰM TRONG BẢNG. File fetch về vẫn có heading, vẫn có chữ, nên không ai nghi ngờ. Đo trên 12 trang thật: giữ được bảng 0/12, dòng Given/When/Then 0/66.',
  how:['Tách bộ đổi ra module dùng chung rồi test nó, thay vì để trong thân script CLI — phần nằm trong thân script không export gì thì không có cách nào phủ test.','Test phải chốt HAI vế: bộ đổi giữ được bảng, VÀ các fetcher thực sự gọi nó. Thiếu vế hai thì ai cũng có thể viết lại một dòng gỡ thẻ mà test vẫn xanh.'],
  ex:'Sau khi sửa: bảng 12/12, Given/When/Then 66/66, không trang nào còn bị gộp một dòng.',
  src:'scripts/integrations/google_doc/utils.js', rel:['g-docs_index','c-tin-hieu-sach-gia','sk-requirements_analyzer'] },

];
