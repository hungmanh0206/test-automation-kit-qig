/* NHÓM 5 — trạng thái kết quả · tầng lỗi · quyết định phát hành
   (nguồn: .agent/config/verdict_taxonomy.json · scripts/qa/quality_decision.js) */
const TERMS_STATUS = [

/* ── Trạng thái case (khớp cột Status của testcase canonical) ── */
{ id:'s-PASS', t:'PASS', cat:'status', kind:'Trạng thái case', aio:'Passed',
  def:'Đã chạy thật, kết quả đúng kỳ vọng theo oracle độc lập.',
  detail:'executed = true · không log bug · lên Google Sheet là Passed. Vẫn bắt buộc có evidence, không được miễn vì "pass thì có gì mà chụp".',
  why:'Evidence của case PASS là thứ trả lời được câu hỏi sáu tuần sau: lúc test màn hình trông thế nào. Không có nó thì mọi PASS đều là lời khai không kiểm chứng được.',
  src:'.agent/config/verdict_taxonomy.json', rel:['c-oracle','r-evidence'] },

{ id:'s-FAIL', t:'FAIL', cat:'status', kind:'Trạng thái case', aio:'Failed',
  def:'Đã chạy thật, kết quả sai kỳ vọng — BẮT BUỘC kèm tầng lỗi.',
  detail:'executed = true · có thể log bug · lên Google Sheet là Failed. Trước khi log phải rerun 2–3 lần để loại chập chờn và lỗi do setup.',
  why:'FAIL không kèm tầng lỗi thì không hành động được. Không biết giao cho ai, không biết có phải bug hay không. Ràng buộc này biến "test đỏ" thành một kết luận có địa chỉ.',
  src:'.agent/config/verdict_taxonomy.json', rel:['c-failure-layer','c-rerun','sk-backlog_bug_reporter'] },

{ id:'s-SKIP', t:'SKIP', cat:'status', kind:'Trạng thái case', aio:'Not Run',
  def:'Không chạy, phải kèm lý do và đánh giá khả năng khắc phục.',
  detail:'executed = false · không log bug · lên Google Sheet là Not Run.',
  why:'SKIP không lý do là chỗ trốn phổ biến nhất: case khó thì đánh SKIP rồi coi như xong, và không ai biết phần đó chưa từng được kiểm.',
  src:'.agent/config/verdict_taxonomy.json', rel:['s-TODO','c-readiness','r-verify'] },

{ id:'s-BLOCKED_SETUP', t:'BLOCKED_SETUP', cat:'status', kind:'Trạng thái case', aio:'Blocked',
  def:'Readiness là "Needs hook" nhưng capability cần thiết chưa có.',
  detail:'executed = false · không log bug · lên Google Sheet là Blocked (giữ đúng bản chất, không bị ép thành "chưa chạy"). Phải nêu cụ thể thiếu cái gì: hook nào, mock nào, sandbox nào.',
  why:'Tách riêng khỏi SKIP vì nó là một yêu cầu gửi tới Dev, không phải một lời từ chối. Ghi rõ thiếu capability gì thì có đường xử lý. Ghi chung chung thì nằm im mãi.',
  src:'.agent/config/verdict_taxonomy.json', rel:['c-readiness','s-setup_failure','sk-precondition_setup_planner'] },

{ id:'s-SKIP_SETUP', t:'SKIP_SETUP', cat:'status', kind:'Trạng thái case', aio:'Not Run',
  def:'Readiness là "Manual-only", tiền điều kiện không tự dựng được.',
  detail:'executed = false · không log bug · lên Google Sheet là Not Run.',
  why:'Khác BLOCKED_SETUP ở chỗ đây không phải chờ ai làm gì cả: bản chất case này phải làm tay. Phân biệt được thì kế hoạch test biết phần nào cần người.',
  src:'.agent/config/verdict_taxonomy.json', rel:['c-readiness','s-BLOCKED_SETUP'] },

{ id:'s-TODO', t:'TODO', cat:'status', kind:'Trạng thái case', aio:'Not Run',
  def:'Chưa thực thi, đây là trạng thái mặc định trên Google Sheet (Not Run).',
  detail:'KHÔNG được dùng khi thực ra đã chạy được.',
  why:'Dùng sai TODO là cách phổ biến để giấu case chưa làm: trên Google Sheet nó trông y hệt case chưa tới lượt, nên không ai hỏi tới.',
  src:'.agent/config/verdict_taxonomy.json', rel:['s-SKIP','r-verify'] },

{ id:'s-PASS_WITH_DEVIATION', t:'PASS_WITH_DEVIATION', cat:'status', kind:'Trạng thái case', aio:'Passed',
  def:'Case PASS nhưng CHỈ pass sau khi lệch khỏi kịch bản đã viết.',
  detail:'Lệch nghĩa là: thêm wait, thêm retry, đổi locator, refresh, hoặc đi đường khác. executed = true · không log bug · lên Google Sheet là Passed.',
  why:'Đây là rủi ro ĐẶC THÙ CỦA AGENT: gặp trở ngại thì có xu hướng LÀM CHO NÓ CHẠY, và mỗi lần như vậy là một bug tiềm năng bị lấp. Deviation là TÍN HIỆU, không phải tiện lợi.',
  how:['Phải liệt kê từng deviation trong phần Actual.','Xếp case vào diện nghi vấn cần review.','KHÔNG được ghi PASS trơn.'],
  ex:'Phải thêm wait 3 giây mới thấy element → có thể app đang chậm thật, không phải test viết thiếu wait.',
  src:'.agent/config/verdict_taxonomy.json', rel:['s-PASS','r-nocheat','c-locator-healing','c-flaky'] },

{ id:'s-SUSPECT_REAL_BUG', t:'SUSPECT_REAL_BUG', cat:'status', kind:'Trạng thái case', aio:'Failed', log:'Log Backlog',
  def:'FAIL không ổn định (ví dụ 1/5 lần) mà CHƯA giải thích được CƠ CHẾ.',
  detail:'executed = true · log được Backlog · lên Google Sheet là Failed. Chỉ được đổi sang tầng lỗi flaky khi nêu được cơ chế cụ thể và cách chứng minh. Không nêu được thì giữ nguyên trạng thái này.',
  why:'Cơ chế triage flaky có thể đang CHÔN bug thật. Race condition, cache, và lệch timezone lúc chuyển ngày đều trông y hệt flaky. Retry 3 lần có 1 lần xanh là bị dán nhãn flaky rồi bỏ qua. Trạng thái này chặn đúng đường tắt đó.',
  trap:'Đây là ranh giới quan trọng: "rerun thấy xanh" KHÔNG phải lời giải thích. Lời giải thích là cơ chế.',
  src:'.agent/config/verdict_taxonomy.json', rel:['c-flaky','s-layer-flaky','c-rerun','c-tri'] },

{ id:'s-EXPANSION_FINDING', t:'EXPANSION_FINDING', cat:'status', kind:'Phát hiện mở rộng', log:'Log Backlog',
  def:'Phát hiện từ việc MỞ RỘNG quanh case (5 trục), không phải verdict của case gốc.',
  detail:'Dạng phát hiện: app tự mâu thuẫn với chính nó. Giá trị lệch giữa hai bề mặt, mắt đứt trong chuỗi lưu trữ, field thừa hoặc thiếu so tài liệu. executed = true · log được Backlog · CỐ Ý không map sang status run của công cụ test-management.',
  why:'Loại này không cần oracle ngoài: hai nơi cùng một nguồn mà hiển thị khác nhau thì chắc chắn một nơi sai. Còn lý do không trộn vào execution thì rất thực dụng. Trộn vào sẽ làm pass-rate mất nghĩa và triage lẫn lộn.',
  how:['Báo riêng ở reports/expansion-findings.md.'],
  src:'.agent/config/verdict_taxonomy.json', rel:['c-expansion-5truc','g-cross_surface_diff','g-persistence_probe','c-observation'] },

{ id:'s-blocked-pass-note', t:'PASS kèm note', cat:'status', kind:'Trạng thái case',
  def:'Case vướng dữ liệu hoặc môi trường mà KHÔNG phải lỗi sản phẩm thì ghi PASS kèm comment giải thích.',
  detail:'Không đánh FAIL đỏ. Comment phải trung thực về việc đã kiểm được tới đâu và vướng ở chỗ nào.',
  why:'FAIL đỏ cho một vướng mắc môi trường làm nhiễu thống kê defect và khiến người đọc tưởng sản phẩm có lỗi. Nhưng bỏ qua im lặng thì lại giấu mất phần chưa kiểm được, nên phải PASS kèm ghi chú, và ghi chú đó phải nói thật.',
  src:'knowledge/decisions/', rel:['sk-decision_recorder','s-PASS','c-false-positive'] },

/* ── Tầng lỗi (failureLayer — bắt buộc kèm khi FAIL) ── */
{ id:'s-product_bug', t:'product_bug', cat:'status', kind:'Tầng lỗi', log:'Log Backlog',
  def:'Lỗi thật của sản phẩm hoặc nghiệp vụ.',
  detail:'Log được Backlog. Phải ghi rõ tầng FE hay BE theo quy tắc phân tầng, và gán assignee theo đúng tầng đó.',
  why:'Đây là loại duy nhất cùng với api_bug đáng để Dev bỏ thời gian. Mọi loại còn lại mà log lên Backlog đều là tiếng ồn.',
  src:'.agent/config/verdict_taxonomy.json', rel:['c-failure-layer','sk-backlog_bug_reporter','s-api_bug'] },

{ id:'s-api_bug', t:'api_bug', cat:'status', kind:'Tầng lỗi', log:'Log Backlog',
  def:'Lỗi API hoặc hợp đồng dữ liệu — BE trả sai hoặc thiếu so với spec.',
  detail:'Log được Backlog. Đây là kết luận chỉ đưa ra sau khi đã đọc response thật, không suy từ màn hình.',
  why:'Phân biệt với product_bug ở tầng FE giúp bug đi thẳng tới người sửa được. Đọc response trước khi kết luận là bước rẻ nhất để không gán nhầm.',
  src:'.agent/config/verdict_taxonomy.json', rel:['c-failure-layer','c-khong-tin-be-mat','s-product_bug'] },

{ id:'s-setup_failure', t:'setup_failure', cat:'status', kind:'Tầng lỗi', log:'KHÔNG log',
  def:'Lỗi ở bước dựng tiền điều kiện, dữ liệu, xác thực, hook hoặc môi trường.',
  detail:'KHÔNG log Backlog. Đây là lỗi của phía test, không phải của sản phẩm.',
  why:'Log lên Backlog thì Dev mở ra, điều tra, phát hiện là do bên QA dựng dữ liệu sai, rồi trả về. Mất thời gian hai phía và làm nhiễu thống kê defect của sprint.',
  src:'.agent/config/verdict_taxonomy.json', rel:['c-precondition','s-BLOCKED_SETUP','c-natural-setup'] },

{ id:'s-script_error', t:'script_error', cat:'status', kind:'Tầng lỗi', log:'KHÔNG log',
  def:'Lỗi của chính script test: bắt sai element, click nhầm control, đọc giá trị sai vùng.',
  detail:'Triệu chứng nhận dạng rất đặc trưng: FAIL lặp lại ỔN ĐỊNH — rerun không cứu được, nhưng làm tay theo đúng các bước đó thì kết quả lại đúng. KHÔNG log Backlog, phải sửa script.',
  why:'Đây là loại dễ log nhầm thành bug nhất vì nó ổn định, mà ổn định thì trông rất giống lỗi thật. Cái phân biệt là phép thử làm tay.',
  ex:'Regex quét trên toàn trang bắt trúng một con số ở khu vực khác, rồi báo "tổng tiền sai".',
  src:'.agent/config/verdict_taxonomy.json', rel:['g-locator_lint','c-false-positive','c-flaky'] },

{ id:'s-infra', t:'infra', cat:'status', kind:'Tầng lỗi', log:'KHÔNG log',
  def:'Hạ tầng, CI hoặc timeout của môi trường.',
  detail:'Không log Backlog sản phẩm.',
  why:'Cần phân biệt với api_bug: infra là API chết hẳn hoặc mạng đứt. Api_bug là API sống và trả về, nhưng trả sai.',
  src:'.agent/config/verdict_taxonomy.json', rel:['s-api_bug','c-rerun-expiry'] },

{ id:'s-layer-flaky', t:'flaky (tầng lỗi)', cat:'status', kind:'Tầng lỗi', log:'KHÔNG log',
  def:'Chập chờn, pass sau khi retry.',
  detail:'Không log Backlog. Nếu lặp lại qua nhiều lượt chạy thì đưa vào quarantine và truy nguyên nhân gốc.',
  why:'Ghi đúng tầng này thay vì để chung với FAIL giúp phân biệt "sản phẩm có vấn đề" với "test có vấn đề" ngay trong số liệu.',
  src:'.agent/config/verdict_taxonomy.json', rel:['c-flaky','c-quarantine','c-tri'] },

{ id:'s-dependency', t:'dependency', cat:'status', kind:'Tầng lỗi', log:'KHÔNG log',
  def:'Phụ thuộc bên ngoài chưa sẵn sàng.',
  detail:'Không log Backlog sản phẩm. Ghi nhận là blocker và nêu rõ đang chờ cái gì, từ ai.',
  why:'Blocker không ghi rõ đối tượng chờ thì nó nằm im tới cuối sprint rồi mới lộ ra là chưa ai làm.',
  src:'.agent/config/verdict_taxonomy.json', rel:['c-readiness','s-BLOCKED_SETUP'] },

/* ── Quyết định phát hành (quality_decision) ── */
{ id:'s-GO', t:'GO', cat:'status', kind:'Quyết định phát hành',
  def:'Đủ điều kiện phát hành, không có tín hiệu chặn nào.',
  detail:'Gate xanh, coverage đạt, không có lỗ hổng ở band rủi ro cao, không có phát hiện bảo mật nghiêm trọng.',
  why:'Có tên gọi rõ ràng thì cuộc trao đổi cuối sprint gọn lại: không phải "chất lượng ổn không", mà "quyết định là gì".',
  src:'scripts/qa/quality_decision.js', rel:['g-quality_decision'] },

{ id:'s-GO_WITH_RISK', t:'GO_WITH_RISK', cat:'status', kind:'Quyết định phát hành',
  def:'Cho đi, nhưng kèm rủi ro đã được gọi tên.',
  detail:'Rủi ro phải ghi rõ là gì để người quyết định biết mình đang chấp nhận cái gì.',
  why:'Đây là trạng thái trung thực nhất trong đa số trường hợp thực tế. Không có nó thì mọi thứ bị ép về xanh hoặc đỏ, và phần "xanh nhưng có điều kiện" biến mất khỏi hồ sơ.',
  src:'scripts/qa/quality_decision.js', rel:['g-quality_decision','c-rbt'] },

{ id:'s-NEEDS_REVIEW', t:'NEEDS_REVIEW', cat:'status', kind:'Quyết định phát hành',
  def:'Tín hiệu mâu thuẫn, cần người xem trước khi chốt.',
  detail:'Thường do số test bị cách ly cao, hoặc coverage thiếu ở một chiều quan trọng.',
  why:'Máy không nên tự quyết khi dữ liệu tự mâu thuẫn. Trạng thái này chuyển quyết định về cho người một cách tường minh thay vì làm tròn về GO hoặc NO_GO.',
  src:'scripts/qa/quality_decision.js', rel:['g-quality_decision','c-quarantine'] },

{ id:'s-NO_GO', t:'NO_GO', cat:'status', kind:'Quyết định phát hành',
  def:'Không phát hành, có tín hiệu chặn thật.',
  detail:'Ví dụ: gate đỏ, có phát hiện bảo mật nghiêm trọng, hoặc bug còn mở ở band rủi ro cao.',
  why:'Phân biệt rõ với BLOCKED: NO_GO nghĩa là đã đo và thấy xấu. Đó là một kết luận, không phải một khoảng trống.',
  src:'scripts/qa/quality_decision.js', rel:['g-quality_decision','s-product_bug','s-BLOCKED'] },

{ id:'s-BLOCKED', t:'BLOCKED (quyết định)', cat:'status', kind:'Quyết định phát hành',
  def:'Không đủ dữ liệu để quyết, thiếu capability nên chưa đo được.',
  detail:'Khác NO_GO ở chỗ căn bản: NO_GO là đã đo và thấy xấu, BLOCKED là chưa đo được.',
  why:'Gộp hai thứ này lại là sai lầm hay gặp và tốn kém: "chưa biết" bị trình bày như "đã biết là tệ", hoặc tệ hơn, bị làm tròn thành "chắc ổn".',
  src:'scripts/qa/quality_decision.js', rel:['g-quality_decision','s-BLOCKED_SETUP','s-NO_GO'] }

];
