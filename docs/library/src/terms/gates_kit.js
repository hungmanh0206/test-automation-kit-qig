/* NHÓM 2c — máy soi CHÍNH CÁI KIT: tự kiểm toán, tra cứu, đóng gói và phát hành (9/2026).
   Nguồn: header của scripts/qa/{gate_index,rule_lookup,version_check,package_kit,verify_release}.js */
const TERMS_GATE3 = [

{ id:'g-gate_index', t:'gates:index', cat:'gate',
  def:'Sinh DANH MỤC GATE của kit từ chính source — trả lời được "kit có bao nhiêu gate, mỗi cái CHẶN gì, gọi ở đâu".',
  detail:'Quét source rồi suy mức từ code: exit 1 là CHẶN · ghi artifact là SINH · chỉ in là BÁO CÁO. Bảng hiện tại: 59 máy — 38 CHẶN, 15 SINH, 6 BÁO CÁO. Bản --check chặn khi bảng lệch source.',
  why:'Kit có hơn 30 npm script dạng gate và gần 60 file trong scripts/qa/, nhưng không chỗ nào trả lời được câu trên. Hệ quả không phải bất tiện: luận đề của kit là "luật cần MÁY", mà máy không LIỆT KÊ ĐƯỢC thì không kiểm toán được — không ai biết một gate đã âm thầm tụt thành cảnh báo, hay đã mất nơi gọi.',
  how:['npm run gates:index để sinh lại bảng.','npm run gates:index:check để chặn khi bảng lệch source.'],
  cmd:'npm run gates:index   ·   npm run gates:index:check',
  ex:'SINH và BÁO CÁO KHÔNG phải gate bị nới — chúng không kiểm vi phạm. bugs:checklist chỉ in brief bug lịch sử, còn việc CHẶN nằm ở dim:coverage chiều §20.',
  trap:'Bốn "phát hiện" đầu tiên khi mới dựng bảng đều là lỗi của BẢNG, không của kit — nên phải hiệu chuẩn danh mục trước khi tin số nó đưa ra.',
  src:'scripts/qa/gate_index.js', rel:['c-forcing-function','c-gate-real-content','g-policy_source_check','f-gate-catalog'] },

{ id:'g-library_drift', t:'library:drift', cat:'gate',
  def:'Chặn "thư viện thuật ngữ đã trôi khỏi repo" — đối chiếu chính trang này với source.',
  detail:'Kiểm những mệnh đề ĐỐI CHIẾU ĐƯỢC: toàn vẹn nội bộ (id trùng, rel gãy, thiếu trường) · mọi đường dẫn src có tồn tại · mọi npm run được nhắc có thật · mọi máy trong scripts/qa có mặt (hoặc miễn trừ kèm lý do) · số skill, số chiều coverage, số cột canonical, danh sách verdict status và tầng lỗi, ngưỡng rerun, slash command, phiên bản kit · bản build mới hơn nguồn và không gọi host ngoài.',
  why:'Trang là lớp DẪN XUẤT: nội dung viết tay, nguồn thì đổi liên tục. Ba lượt cập nhật gần nhất, lần nào cũng tìm ra fact đã cũ mà không có tín hiệu nào báo — công cụ test-management cũ vẫn được dạy như đường chính, số cột canonical ghi thừa, số chiều coverage ghi thiếu, bảng skill sót mục mới nhất, và hai chỗ rơi dấu nháy làm trang trắng trong khi build vẫn báo OK. Tức trang chỉ đúng vào lúc có người NHỚ RA phải cập nhật.',
  how:[
    'Miễn trừ khai ở .agent/config/library-drift.allow.json và BẮT BUỘC ghi lý do.',
    'Khối lạ trong allowlist bị chặn, và miễn trừ trỏ tới thứ không còn tồn tại cũng bị chặn.',
    'Không kiểm nội dung văn xuôi đúng hay sai — máy không đọc được ý nghĩa.'
  ],
  cmd:'npm run library:build   ·   npm run library:drift',
  ex:'Lượt chạy đầu tiên trả về 4 chỗ trôi: một lệnh không tồn tại, ba verdict status mới chưa có mặt, và một cái là lỗi của CHÍNH GATE — regex đếm cột bắt trúng "0 cột" trong bảng lỗi thường gặp.',
  trap:'Gate so theo VĂN BẢN, nên viết lại một con số cũ để kể lịch sử cũng bị bắt (đã xảy ra với đúng mục này). Diễn đạt tránh con số thay vì nới luật — cùng cách xử lý như luật một-công-cụ. Và nhớ: nguồn quyết luôn là repo, sửa trang cho khớp chứ đừng sửa ngược.',
  src:'scripts/qa/library_drift.js', rel:['c-canonical','g-gate_index','c-forcing-function','c-gate-real-content','g-skills_index'] },

{ id:'g-rule_lookup', t:'rule / rule:toc', cat:'gate',
  def:'Tra RULE_GLOBAL.md THEO MỤC, thay vì đọc cả file.',
  detail:'Đo 07/09/2026: RULE_GLOBAL.md có 465 dòng, 51.116 ký tự, khoảng 12.800 token — và đó là SÀN, vì 12% ký tự có dấu nên thực tế cao hơn.',
  why:'File này KHÔNG auto-load nên không ăn token mỗi phiên (thứ luôn-trong-ngữ-cảnh là CLAUDE.md, 13 dòng). Vấn đề nằm ở lúc CẦN tra: không có mục lục thì cách duy nhất là đọc cả file — 12,8k token cho một câu trả lời. Chính thước đo của kit (doc_budget) đặt ngưỡng đọc-thẳng ở 8.000, nên đọc cả file đã vượt 1,6 lần.',
  ex:'Tra riêng mục Security tốn 287 token — rẻ hơn 45 lần so với đọc cả file.',
  cmd:'npm run rule -- <tên mục>   ·   npm run rule:toc',
  src:'scripts/qa/rule_lookup.js', rel:['f-rule-global','g-doc_budget','c-canonical'] },

{ id:'g-version_check', t:'version:check', cat:'gate',
  def:'Chặn phát hành thiếu sót — kit phải có số phiên bản, không phải ngày tháng.',
  detail:'Kiểm phiên bản khai trong package.json, và khi chạy từ tag thì kiểm khớp tag. Kit hiện ở 2.0.0.',
  why:'Kit được phát cho nhiều dự án và sửa rất thường xuyên. Không có version thì ba chuyện xảy ra: không biết dự án nào đang ở bản nào (có bản vá quan trọng cũng không có đường thông báo) · không có mốc để quay lui · và bản phát ra không trả lời được câu hỏi duy nhất người nhận cần — nâng bản này có phải sửa gì trong lớp PROJECT không. Chỉ MAJOR/MINOR nói được điều đó; ngày tháng thì không.',
  cmd:'npm run version:check',
  src:'scripts/qa/version_check.js', rel:['f-kit-version','g-package_kit','g-verify_release','f-changelog'] },

{ id:'g-package_kit', t:'package:kit', cat:'gate',
  def:'Đóng gói bản phát hành SẠCH của kit vào dist/ — chỉ lớp GENERIC.',
  detail:'Nguyên tắc duy nhất: gói chỉ chứa lớp GENERIC theo kit-layers.md. Lớp PROJECT không được lọt.',
  why:'Hai lý do khác nhau và đều nghiêm trọng. Một là SECRET và PII: .env*, profiles/<TASK>/task.env, knowledge/**, outputs/** đều là dữ liệu công ty. Hai là ORACLE SAI: file quy ước DB chứa schema và bản đồ cột↔nhãn ĐO TỪ DB CỦA MỘT dự án cụ thể — phát cho dự án khác thì nó thành oracle sai, mà sai im lặng.',
  cmd:'npm run package:kit',
  trap:'Đây là lý do ranh giới GENERIC/PROJECT không phải chuyện gọn gàng mà là chuyện an toàn.',
  src:'scripts/qa/package_kit.js', rel:['f-kit-layers','r-security','g-verify_release','g-version_check'] },

{ id:'g-verify_release', t:'release:verify', cat:'gate',
  def:'Chứng minh bản phát hành chạy được từ con số 0 — đúng trải nghiệm của người nhận kit.',
  detail:'Giải nén gói vào thư mục sạch rồi npm ci và chạy thử. Đây là thước đo chính của cả luồng phát hành, không phải bước tạo Release.',
  why:'Mọi gate khác chạy TRONG repo: có .git, có node_modules, có lớp PROJECT. Người nhận kit thì không có gì trong số đó. Khoảng cách ấy đã sinh lỗi thật — hai gate từng crash vì gọi git ls-files vô điều kiện, và chỉ lộ ra khi giải nén vào thư mục sạch.',
  cmd:'npm run release:verify',
  ex:'Bài học đi kèm: gate nào dùng git phải chịu được trường hợp KHÔNG có .git — ba gate nay dùng chung một helper thay vì vá lần thứ ba.',
  src:'scripts/qa/verify_release.js', rel:['g-package_kit','g-version_check','c-gate-real-content','f-kit-layers'] }

];
