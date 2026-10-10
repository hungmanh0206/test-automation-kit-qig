/* NHÓM 6b — điểm vào và hạ tầng phát hành của kit (9/2026).
   Nguồn: .claude/commands/*.md · scripts/qa/gate_index.js · package.json · docs/UPGRADE.md */
const TERMS_FLOW2 = [

{ id:'f-slash-commands', t:'Slash command (.claude/commands/)', cat:'flow',
  def:'Chín điểm vào gõ được thẳng trong phiên chat, thay cho việc tự nhớ đọc file nào trước.',
  detail:'/phase1 · /phase2 · /rerun · /partial-rerun · /publish · /preflight · /gates · /explore · /ui-debug. Mỗi file khai một description ngắn rồi liệt kê ĐÚNG THỨ TỰ những file phải đọc và những gate bắt buộc phải chạy, với $ARGUMENTS là mã task.',
  why:'Trước đó điểm vào là "đọc prompt_templates/run_phase1_template.md rồi đọc tiếp bốn workflow theo thứ tự". Tức là người dùng phải nhớ cả thứ tự lẫn tên file, và bỏ sót một bước thì không có gì báo. Đưa vào slash command là biến trình tự đó thành thứ gọi được bằng một dòng.',
  ex:'/phase1 CSDL-12345 sẽ nạp đúng chuỗi: run_phase1_template → scope planning → prepare context → generate tc, kèm hai gate bắt buộc.',
  trap:'Slash command KHÔNG thay thế gate, nó chỉ dẫn đúng đường. Gate vẫn là thứ chặn.',
  src:'.claude/commands/', rel:['f-phase1','f-phase2','f-rerun','f-skills-index','g-preflight_gate'] },

{ id:'f-gate-catalog', t:'Danh mục gate (tự sinh)', cat:'flow',
  def:'Bảng liệt kê mọi máy của kit kèm mức chặn, sinh tự động từ source.',
  detail:'Con số hiện tại: 87 máy — 60 CHẶN · 17 SINH (ghi artifact) · 10 BÁO CÁO (chỉ in). Mức được suy từ code chứ không khai tay: exit 1 là CHẶN, ghi artifact là SINH, chỉ in là BÁO CÁO. Bảng còn ghi mỗi máy được gọi từ đâu, và ghi ra .agent/config/GATES.md.',
  why:'Luận đề của kit là "luật cần MÁY". Nhưng máy mà không liệt kê được thì không kiểm toán được. Không ai biết một gate đã âm thầm tụt xuống thành cảnh báo, hay đã mất hết nơi gọi và thành mồ côi.',
  how:['Sinh lại: npm run gates:index.','Chặn khi bảng lệch source: npm run gates:index:check.'],
  trap:'SINH và BÁO CÁO không phải gate bị nới. Chúng không kiểm vi phạm, chỉ tạo dữ liệu cho máy khác chặn.',
  src:'scripts/qa/gate_index.js', rel:['g-gate_index','c-forcing-function','g-policy_source_check'] },

{ id:'f-kit-version', t:'Phiên bản kit (2.0.0)', cat:'flow',
  def:'Kit được phát hành theo MAJOR.MINOR.PATCH, không theo ngày.',
  detail:'Luồng phát hành có ba máy: version:check chặn phát hành thiếu sót · package:kit đóng gói chỉ lớp GENERIC vào dist/ · release:verify giải nén vào thư mục sạch rồi chạy thử.',
  why:'Kit phát cho nhiều dự án và sửa rất thường xuyên. Số phiên bản trả lời được câu duy nhất người nhận cần: nâng bản này có phải sửa gì trong lớp PROJECT không. Ngày tháng không trả lời được câu đó.',
  cmd:'npm run version:check   ·   npm run package:kit   ·   npm run release:verify',
  src:'package.json', rel:['g-version_check','g-package_kit','g-verify_release','f-kit-layers','f-changelog'] },

{ id:'f-upgrade-doc', t:'docs/UPGRADE.md', cat:'flow',
  def:'Hướng dẫn nâng bản kit cho dự án đang dùng bản cũ.',
  detail:'Đi cùng CHANGELOG: changelog nói ĐÃ ĐỔI GÌ, upgrade nói PHẢI LÀM GÌ ở lớp PROJECT khi nâng.',
  why:'Người nhận kit không cần biết mọi thay đổi bên trong, họ cần biết đúng phần phải tự sửa. Tách hai tài liệu ra khiến việc nâng bản thành một checklist thay vì một buổi đọc changelog.',
  src:'docs/UPGRADE.md', rel:['f-changelog','f-kit-version','f-kit-layers'] }

];
