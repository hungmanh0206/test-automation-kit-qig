/* Dữ liệu thư viện — nguồn: chính repo test-automation-kit_v2.
   Mỗi entry: id · t (thuật ngữ) · cat · def (1 câu) · detail · src (file trong repo) · rel (id liên quan) */

const CATS = {
  rule:    { label: 'Nguyên tắc',            color: '#FFB700', desc: '6 điều không-thương-lượng, đọc trước mọi việc.' },
  gate:    { label: 'Gate máy-kiểm',         color: '#D64545', desc: 'Script chặn thật — sai chuẩn là không push được.' },
  skill:   { label: 'Skill',                 color: '#2A6FDB', desc: '21 năng lực agent gọi theo phase.' },
  concept: { label: 'Khái niệm QA',          color: '#1F8A5B', desc: 'Tư duy nền: oracle, flaky, evidence, risk…' },
  status:  { label: 'Trạng thái & phân tầng',color: '#7C5CD6', desc: 'Verdict, tầng lỗi, quyết định phát hành.' },
  flow:    { label: 'Quy trình & artifact',  color: '#0E9AA7', desc: 'Phase, file cấu hình, sản phẩm đầu ra.' }
};

/* Bộ sinh đề luyện tập — mỗi trục là một chiều thật của kit */
const CHALLENGE = [
  { key:'layer', label:'Tầng test', icon:'🎯', values:[
    'UI E2E (Playwright)','API contract (Swagger)','Cross-module integration','Regression ripple',
    'Visual conformance','Performance (single-user)','Load / soak (k6)','Security basic (read-only)','Accessibility (axe-core)'] },
  { key:'dim', label:'Chiều coverage', icon:'🧭', values:[
    'Field-level validation','UI display · filter · empty state','API coverage','E2E đầu-cuối','Export / Import file',
    'Resilience & concurrency','Side-effect & notification','Cross-layer guard (403/409)','Design token (Figma)',
    'Display/field conformance','Business logic & công thức','BE response mapping','Security (IDOR, session)',
    'Performance & SLA','Change impact / regression'] },
  { key:'risk', label:'Band rủi ro', icon:'🔥', values:[
    'High — phải sâu, có negative + boundary','Medium — phủ luồng chính + 1 nhánh lỗi','Low — smoke là đủ'] },
  { key:'oracle', label:'Nguồn oracle', icon:'📐', values:[
    'FSD (Google Doc, nhiều tab)','Figma (design token, layout)','Swagger / API docs',
    'Business rule đã confirm trong knowledge/domain/','Bảng mapping field ↔ property','Spec bổ sung tô màu / suggested trong GDoc'] },
  { key:'constraint', label:'Ràng buộc bắt buộc', icon:'⛓️', values:[
    'UAT non-destructive — xác nhận trước mỗi lượt chạm','DB read-only, precondition dựng qua UI/API',
    'Evidence phải là video (chuỗi thao tác)','Mask PII toàn bộ evidence','Chỉ chạy non-prod, never-auto',
    'Không sửa file dùng chung (story khác đang chạy)','Mobile-web viewport'] },
  { key:'trap', label:'Bẫy phải né', icon:'🕳️', values:[
    'Oracle tautological (app == app)','Kết luận bug khi chưa rerun 2–3 lần','Dựng precondition bằng DB rồi báo bug ma',
    'FAIL ổn định do script_error, không phải product bug','Evidence chụp trơn, không highlight',
    'Quên truyền TASK_ENV → đọc ra 0 cột, tưởng app hỏng','Fixture hai nguồn cùng giá trị, không phân biệt được gì',
    'Đọc GDoc thiếu tab → mất phần lớn spec'] }
];
