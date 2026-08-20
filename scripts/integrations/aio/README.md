# AIO Tests — tầng tích hợp (thay thế Xray)

Kit vốn nói chuyện với **Xray** (test = Jira issue). **AIO Tests** lưu test là **thực thể riêng của app**,
không phải issue — nên đây là tầng tích hợp riêng. Model canonical `scripts/lib/testcase` dùng chung,
chỉ khác tầng gọi API.

```
Excel canonical ──> publish_testcases_aio.js ──> AIO Case
Xray Test Repo  ──> migrate_testcases.js     ──> AIO Case + cây folder (một lần, để chuyển kho cũ)
Xray Execution  ──> migrate_execution.js     ──> AIO Cycle + Run + evidence (một lần)
Kết quả Phase 2 ──> push_execution_aio.js    ──> AIO Cycle + Run + evidence THEO BƯỚC (dùng hằng ngày)
AIO Case        ──> pull_testcases_aio.js    ──> test-cases/from-aio/*.xlsx (nguồn execute Phase 2)
```

`push_execution_aio.js` là bản thay cho `jira/push_test_execution.js`. **Đầu vào giữ nguyên**
(`<TASK_OUTPUT_DIR>/test-results/testcase-status.json`) nên Phase 2 không phải đổi cách ghi kết quả —
chỉ đích đến là khác.

## Lệnh

```bash
# đẩy testcase (MẶC ĐỊNH dry-run)
npm run aio:publish -- --file <x.xlsx> --story <JIRA-KEY> [--limit 5] [--folder-root <tên>]
npm run aio:publish:apply -- --file <x.xlsx> --story <JIRA-KEY>

# chuyển execution Xray → cycle AIO
npm run aio:migrate-exec -- --exec <XRAY-EXEC-KEY> [--folder "<Tên sprint>"]
npm run aio:migrate-exec:apply -- --exec <XRAY-EXEC-KEY> --folder "<Tên sprint>"

# VÒNG ĐỜI: TC rời khỏi Excel → Deprecated; quay lại → Published
npm run aio:deprecate-stale -- --story <JIRA-KEY> --file <x.xlsx>
npm run aio:deprecate-stale:apply -- --story <JIRA-KEY> --file <x.xlsx>

# KÉO testcase từ AIO về Excel canonical (nguồn cho Phase 2 khi TESTCASE_SOURCE=aio)
npm run aio:pull -- --story <JIRA-KEY>            # xem trước
npm run aio:pull:write -- --story <JIRA-KEY>      # ghi test-cases/from-aio/*.xlsx

# ĐỐI SOÁT di trú (chỉ đọc — đếm lại ở hai đầu, đừng tin log "XONG")
npm run aio:reconcile                                  # tất cả Test Execution
npm run aio:reconcile -- --exec SAPP-28132 --out <file.md>

# chuyển CẢ KHO testcase theo đúng cây Test Repository của Xray (một lần)
npm run aio:migrate-tc -- --story <JIRA-KEY>
npm run aio:migrate-tc:apply -- --story <JIRA-KEY>

# ĐẨY KẾT QUẢ EXECUTE (thay npm run jira:push-execution) — dùng sau mỗi lượt Phase 2
npm run aio:push-exec -- --task <TASK_KEY> [--folder "<Tên sprint>"] [--cycle-title "..."]
npm run aio:push-exec:apply -- --task <TASK_KEY> --folder "<Tên sprint>"
```

`aio:push-exec` chạy **hai gate trước khi ghi**: (1) chất lượng output, (2) **mở rộng 5 trục** — task có
case band *high* đã execute mà chưa có `reports/expansion-plan.md` thì CHẶN. Gate (2) đứng ở đây vì
`self-review --enforce` là bước người/agent tự chạy: bỏ qua nó rồi đẩy thẳng kết quả thì trước đây
không gì cản. Luật dùng chung `scripts/lib/expansion/plan_guard.js`. Gỡ bằng `npm run expansion:plan`
(vài giây, chỉ đọc Excel) hoặc `--qa-approved` nếu cố ý.

`aio:push-exec` chạy **gate chất lượng trước** (`output_gate.gateTestExecution`) y như bản Xray; muốn
bỏ qua có chủ ý thì thêm `--qa-approved`. Chạy lại cùng `--cycle-title` sẽ **dùng lại cycle cũ** và
**bỏ qua evidence đã có** (dedup theo từng bước), không đẻ cycle trùng.

Env: `AIO_API_TOKEN` (bắt buộc) · `AIO_PROJECT_KEY` (mặc định `JIRA_PROJECT_KEY`) · `AIO_BASE_URL` · `AIO_THROTTLE_MS`.

## Trạng thái di trú — ĐÃ ĐỐI SOÁT (20/08/2026)

Di trú kho cũ **đã chạy xong**, và quan trọng hơn: đã **đếm lại ở hai đầu** thay vì tin log "XONG".
Lệnh đối soát (chỉ đọc, chạy lại được bất cứ lúc nào): `npm run aio:reconcile` (thêm `--exec <KEY>` cho
một execution, `--out <file.md>` để ghi báo cáo).

| Đối tượng | Xray | AIO | Kết luận |
|---|---|---|---|
| Testcase | 1399 (10 task) | **1399 case** · 1399 có `automationKey` · tất cả `Published` | đủ |
| Cây folder | 103 folder theo task | **117 folder**, sâu **3 cấp** (giữ cấu trúc Test Repository) | đủ |
| Test Execution → Cycle | 15 | **15/15** có cycle tương ứng | đủ |
| Test Run | **2103** | **2103** · mỗi cycle có số case phân biệt = số run | đủ, không case nào bị chồng attempt |
| Trạng thái run | `Failed=47 Not Run=70 Passed=1986` | **giống hệt** | đủ |
| Test Plan → thư mục cycle | 2 (`[Test Plan] OPs/LMS Sprint 47`) | **2 thư mục** · 16/17 cycle nằm đúng thư mục | đủ (cycle ngoài thư mục là `Ad hoc` của hệ thống) |

Hai cycle "dôi" trên AIO là `Ad hoc` (cycle hệ thống của app) và `[SAPP-26523] Test Execution - 2026-08-19`
(lượt push thật để nghiệm thu tầng AIO) — không phải rác di trú.

**Vì sao phải đối soát chứ không tin log**: bản đầu của `migrate_execution.js` khớp case theo **tiêu đề** và
**mất 12 run** trong khi log vẫn báo "XONG" (563 run chỉ còn 552 tiêu đề phân biệt). Sau khi Xray đóng băng
(**sau 21/08/2026**) thì phát hiện thiếu cũng không còn nguồn để chạy lại — nên phép đếm hai đầu là một
**lệnh thường trực**, không phải script tạm.

**Còn dùng `migrate_*` khi nào**: chỉ khi Xray phát sinh thêm execution/test TRƯỚC ngày đóng băng. Sau đó
hai script này chỉ còn để đọc/đối chiếu.


## Ánh xạ mô hình

| Xray | AIO | Ghi chú |
|---|---|---|
| Test (Jira issue) | **Case** | mất tính issue: không JQL/assignee/sprint/workflow trên test |
| Test Repository folder | folder case | cây dựng **từ nhóm chức năng trong Excel** |
| Precondition (issue riêng) | field `precondition` | mất tính dùng chung; mã `[PRE-NN]` vẫn nằm trong text |
| Test Execution | **Cycle** | giữ được ngày gốc qua `startDate/endDate` |
| Test Run + step status | **Run** + run-step status | ánh xạ 1:1 |
| Evidence | attachment cấp run/step | |
| **Test Plan** | **thư mục cycle** | AIO KHÔNG có Test Plan |
| nhãn stale (cleanup) | caseStatus **Deprecated** | `aio:deprecate-stale` — giữ lịch sử run thay vì xoá |

Trạng thái: `PASSED→3 Passed` · `FAILED→4 Failed` · `TODO→1 Not Run` · `EXECUTING→2` · `BLOCKED→5`.

## Chín đặc tính của AIO đã đo — đừng phát hiện lại bằng cách mất dữ liệu

1. **KHÔNG có API xoá**: case · attachment · run-cuối-của-case · case-khỏi-cycle · cycle-hệ-thống.
   Sửa sai **chỉ làm được trên UI** ⇒ mọi script ở đây mặc định **dry-run**. Nhưng *cleanup* KHÁC *xoá*:
   vòng đời testcase làm bằng caseStatus `Deprecated` (`aio:deprecate-stale`), không cần API xoá.
2. `PUT .../detail` **ghi đè toàn phần**, không phải patch ⇒ luôn dùng `mergePut()`.
3. `tags` gửi lên trả **200 nhưng không lưu** (thử `[{ID,name}]`, `[{name}]`, `[ID]`) ⇒ TC ID để ở
   **`automationKey`**, không dùng tag.
4. `scriptType` **bắt buộc** khi case có steps (spec không đánh dấu required).
5. Upload attachment **phải có MIME**; thiếu → `400 Unsupported attachment type`. Dùng `MIME_BY_EXT`
   của `scripts/qa/lib/output_rules.js` (1 nguồn, chung với uploader Jira).
6. **Rate limit** trả **body rỗng** chứ không phải 429 ⇒ client coi rỗng là lỗi tạm và retry.
7. `key` (`PROJ-TC-3`) khác `ID` nội bộ (`3`), **URL của UI dùng ID** ⇒ log cả hai khi đối soát.
8. `POST .../testcase/{key}` lên case **đã có trong cycle** KHÔNG dùng lại run cũ mà **đẻ run mới**
   (attempt), run cũ vẫn còn (đo: 3898 → 3957). Gọi vô điều kiện khi chạy lại ⇒ chồng tầng run **và**
   nhân đôi evidence (run mới luôn rỗng attachment nên dedup không ăn). Phải kiểm tra membership trước.
9. `/testcycle/{cy}/testcase` và `/testcycle/{cy}/testrun` trả **cùng một bản ghi**; `key` nằm ở
   `.testCase.key`, **không** ở `.key`. Đọc `.key` sẽ ra `undefined` mà không báo lỗi.

## Điểm bất đối xứng UI vs API

UI làm được 3 việc API không có: **gỡ case khỏi cycle** (⋮ → *Remove Case*, hoặc Bulk → *Remove cases*),
**xoá attachment**, và nhờ đó **xoá cycle**. Nghĩa là vẫn có đường lùi — nhưng phải làm tay.

## Evidence theo bước

Evidence cũ trong Xray nằm ở **cấp run**, và Xray **không lưu** evidence thuộc bước nào (đo: 0/154 step
có evidence, mỗi run 1 ảnh cho 3–5 bước). Không cứu được từ dữ liệu Xray cũ — nhưng từ **lượt execute
mới** thì `push_execution_aio.js` làm được. Đã đo trên API:

* `POST .../testrun/{id}/testrunstep/{stepId}/attachment` → **200**, ảnh nằm đúng ở
  `testRunSteps[i].attachments`, **không** rớt xuống cấp run.
* `POST .../testrun/{id}` (cập nhật trạng thái) **không xoá** attachment đã có ⇒ chạy lại an toàn.

Script neo evidence xuống bước **chỉ khi thật sự biết bước nào**, theo 3 nhánh:

| Dữ liệu trong `testcase-status.json` | Evidence gắn ở |
|---|---|
| `steps[i].evidence` (Phase 2 chụp theo bước) | đúng bước `i` |
| case FAIL + `failedStep` hợp lệ | bước hỏng |
| còn lại | cấp run |

Không có thông tin thì để cấp run — **không đoán** vị trí bước.

Hai chỗ evidence từng rơi mất trong im lặng, nay đã chặn (phát hiện ở lượt chạy thật SAPP-26523):

* Có `steps[].evidence` thì nhánh cấp-run bị bỏ hẳn ⇒ **video cấp case không bao giờ được đẩy** —
  đúng thứ gate BẮT BUỘC với case chuỗi thao tác. Nay evidence cấp case luôn lên cấp run.
* Automation thường chạy **nhiều bước hơn** số bước khai trong case (thêm bước mở màn/đăng nhập).
  Trước đây phần dôi bị cắt theo số bước của case; nay đưa về cấp run kèm dòng báo `ⓘ`.

`push_execution_aio.js` còn tự **loại case mang cờ `carriedOver`** — kết quả kế thừa từ lượt chạy
trước do `EvidenceRecorder` gộp shard cũ trên đĩa (đã gặp: chạy 3 case, status ra 51 case PASSED).
Muốn đẩy vẫn được bằng `--include-carried-over`; đẩy đúng tập vừa chạy thì dùng `--only`.

Kèm theo: gate `output_gate` vốn đã đòi *"mỗi step phải có evidence riêng"*, nhưng trên Xray luật đó
**không có đường thoả**. Đây là lần đầu nó thực thi được.
