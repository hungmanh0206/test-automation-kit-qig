# SILENT_CATCH — moi cho `catch` tra ve gia tri rong trong `scripts/**`

> Sinh bang `scripts/` quet that, khong chep tay. Lam lai: xem `docs/v2.4.1/SILENT_CATCH.md` muc "Cach lam lai".

## Vi sao co tai lieu nay

Mot gate doc config bang `try { readFileSync } catch { return <rong> }` thi khi THIEU FILE no khong no.
No tat phep kiem roi di tiep, va bang van xanh. Do 10/10/2026 tren ban da dong goi: dung chuyen nay da lam
gate "ly do n/a da bi bac" khong bao gio chan, suot hai ban phat hanh.

Nhung khong phai cho nao cung sai. Doc mot artifact theo task khi chua chay luot nao thi thieu file la
BINH THUONG. Nen tai lieu nay phan loai tung cho, va noi ro cho nao GIU im lang co chu y.

## Quy tac phan nhom

| Nhom | Dau hieu | Quyet dinh mac dinh |
| --- | --- | --- |
| CONFIG-GATE | doc `.agent/config/**` ma mot gate CHAN dua vao | PHAI KEU |
| DOC-FILE | doc mot file khac | xet tung cho |
| ARTIFACT-TASK | doc artifact trong `<PROJECT_OUTPUT_DIR>/tasks/**` | GIU im lang |
| KNOWLEDGE | doc `knowledge/**` | GIU im lang |
| DONG-JSONL | parse MOT DONG cua file nhat ky nhieu dong | GIU im lang |
| PROBE-MOITRUONG | do nang luc may chay (docker, CDP) | GIU im lang |

## Bang day du

| Nhom | Quyet dinh | Cho | Ly do |
| --- | --- | --- | --- |
| DOC-FILE | SUA | `scripts/qa/gate_index.js:50` | Source khai ma thieu thi roi khoi bang, va vi bang dung tu cung phep quet nen hai phia cung co lai va van "khop". Nay readKhai() CHAN o --check. |
| DOC-FILE | SUA | `scripts/qa/prompt_budget.js:81` | File KHAI trong load_map.json ma thieu => 0 token => ngan sach bao DAT oan. Nay docKhai() KEU va CHAN. |
| ARTIFACT-TASK | GIU | `scripts/qa/dimension_coverage.js:171` | Artifact theo task, chua chay luot nao thi chua co. Thieu la BINH THUONG. |
| ARTIFACT-TASK | GIU | `scripts/qa/lighthouse_check.js:67` | Artifact theo task, chua chay luot nao thi chua co. Thieu la BINH THUONG. |
| ARTIFACT-TASK | GIU | `scripts/qa/load_check.js:58` | Artifact theo task, chua chay luot nao thi chua co. Thieu la BINH THUONG. |
| ARTIFACT-TASK | GIU | `scripts/qa/risk_gate.js:40` | Artifact theo task, chua chay luot nao thi chua co. Thieu la BINH THUONG. |
| ARTIFACT-TASK | GIU | `scripts/qa/risk_score.js:54` | Artifact theo task, chua chay luot nao thi chua co. Thieu la BINH THUONG. |
| ARTIFACT-TASK | GIU | `scripts/qa/self_review.js:182` | Artifact theo task, chua chay luot nao thi chua co. Thieu la BINH THUONG. |
| ARTIFACT-TASK | GIU | `scripts/utils/auth/session_cache.js:32` | Artifact theo task, chua chay luot nao thi chua co. Thieu la BINH THUONG. |
| ARTIFACT-TASK | GIU | `scripts/utils/auth/session_cache.js:50` | Artifact theo task, chua chay luot nao thi chua co. Thieu la BINH THUONG. |
| ARTIFACT-TASK | GIU | `scripts/utils/cleanup/cleanup_manifest.js:28` | Artifact theo task, chua chay luot nao thi chua co. Thieu la BINH THUONG. |
| ARTIFACT-TASK | GIU | `scripts/utils/evidence/manifest.js:62` | Artifact theo task, chua chay luot nao thi chua co. Thieu la BINH THUONG. |
| DOC-FILE | GIU | `scripts/lib/expansion/plan_guard.js:43` | Doc file da biet ton tai (vua liet ke thu muc) hoac file tuy chon cua mot buoc sau. |
| DOC-FILE | GIU | `scripts/qa/ci_scope_check.js:64` | Doc file da biet ton tai (vua liet ke thu muc) hoac file tuy chon cua mot buoc sau. |
| DOC-FILE | GIU | `scripts/qa/dashboard_generate.js:172` | Doc file da biet ton tai (vua liet ke thu muc) hoac file tuy chon cua mot buoc sau. |
| DOC-FILE | GIU | `scripts/qa/dimension_coverage.js:176` | Doc file da biet ton tai (vua liet ke thu muc) hoac file tuy chon cua mot buoc sau. |
| DOC-FILE | GIU | `scripts/qa/explore_charter.js:49` | Doc file da biet ton tai (vua liet ke thu muc) hoac file tuy chon cua mot buoc sau. |
| DOC-FILE | GIU | `scripts/qa/learn_report.js:34` | Doc file da biet ton tai (vua liet ke thu muc) hoac file tuy chon cua mot buoc sau. |
| DOC-FILE | GIU | `scripts/qa/learn_task.js:87` | Doc file da biet ton tai (vua liet ke thu muc) hoac file tuy chon cua mot buoc sau. |
| DOC-FILE | GIU | `scripts/qa/lib/evidence_quality.js:46` | Doc file da biet ton tai (vua liet ke thu muc) hoac file tuy chon cua mot buoc sau. |
| DOC-FILE | GIU | `scripts/qa/lib/secret_patterns.js:72` | Doc file da biet ton tai (vua liet ke thu muc) hoac file tuy chon cua mot buoc sau. |
| DOC-FILE | GIU | `scripts/qa/load_check.js:86` | Doc file da biet ton tai (vua liet ke thu muc) hoac file tuy chon cua mot buoc sau. |
| DOC-FILE | GIU | `scripts/qa/load_check.js:97` | Doc file da biet ton tai (vua liet ke thu muc) hoac file tuy chon cua mot buoc sau. |
| DOC-FILE | GIU | `scripts/qa/load_check.js:109` | Doc file da biet ton tai (vua liet ke thu muc) hoac file tuy chon cua mot buoc sau. |
| DOC-FILE | GIU | `scripts/qa/load_check.js:152` | Doc file da biet ton tai (vua liet ke thu muc) hoac file tuy chon cua mot buoc sau. |
| DOC-FILE | GIU | `scripts/qa/quality_decision.js:45` | Doc file da biet ton tai (vua liet ke thu muc) hoac file tuy chon cua mot buoc sau. |
| DOC-FILE | GIU | `scripts/qa/risk_score.js:45` | Doc file da biet ton tai (vua liet ke thu muc) hoac file tuy chon cua mot buoc sau. |
| DOC-FILE | GIU | `scripts/qa/scope_anchor.js:49` | Doc file da biet ton tai (vua liet ke thu muc) hoac file tuy chon cua mot buoc sau. |
| DOC-FILE | GIU | `scripts/qa/scope_anchor.js:50` | Doc file da biet ton tai (vua liet ke thu muc) hoac file tuy chon cua mot buoc sau. |
| DOC-FILE | GIU | `scripts/qa/self_review.js:500` | Doc file da biet ton tai (vua liet ke thu muc) hoac file tuy chon cua mot buoc sau. |
| DOC-FILE | GIU | `scripts/qa/traceability_matrix.js:36` | Doc file da biet ton tai (vua liet ke thu muc) hoac file tuy chon cua mot buoc sau. |
| DOC-FILE | GIU | `scripts/qa/traceability_matrix.js:96` | Doc file da biet ton tai (vua liet ke thu muc) hoac file tuy chon cua mot buoc sau. |
| DOC-FILE | GIU | `scripts/utils/evidence/manifest.js:14` | Doc file da biet ton tai (vua liet ke thu muc) hoac file tuy chon cua mot buoc sau. |
| DOC-FILE | GIU | `scripts/utils/sync_gitlab.js:106` | Doc file da biet ton tai (vua liet ke thu muc) hoac file tuy chon cua mot buoc sau. |
| DONG-JSONL | GIU | `scripts/qa/load_check.js:292` | Bo mot DONG hong trong file nhat ky nhieu dong. Keu tung dong se lap cho moi ban ghi cu. |
| DONG-JSONL | GIU | `scripts/qa/metrics_collect.js:103` | Bo mot DONG hong trong file nhat ky nhieu dong. Keu tung dong se lap cho moi ban ghi cu. |
| DONG-JSONL | GIU | `scripts/qa/reliability_index.js:41` | Bo mot DONG hong trong file nhat ky nhieu dong. Keu tung dong se lap cho moi ban ghi cu. |
| DONG-JSONL | GIU | `scripts/qa/self_review.js:189` | Bo mot DONG hong trong file nhat ky nhieu dong. Keu tung dong se lap cho moi ban ghi cu. |
| KNOWLEDGE | GIU | `scripts/qa/self_review.js:238` | knowledge/ cua du an moi la rong (G2.3 cua v2.5.0 lo phan nay). Thieu la trang thai dau tien, khong phai loi. |
| PROBE-MOITRUONG | GIU | `scripts/qa/load_check.js:155` | Do mot nang luc cua may chay (docker, CDP). Khong co la mot KET QUA hop le, khong phai loi doc file. |
| PROBE-MOITRUONG | GIU | `scripts/qa/perf_check.js:115` | Do mot nang luc cua may chay (docker, CDP). Khong co la mot KET QUA hop le, khong phai loi doc file. |

## Tong

- Tong so cho: **41**
- Da SUA cho phai keu: **2**
- GIU im lang co chu y: **39**
- Nhom CONFIG-GATE con lai: **0**. Hai cho cu (`na_reasons_rejected.json` va `risk_model.json`)
  nay di qua `scripts/qa/lib/config_load.js`, noi chi co ba nuoc: co file thi dung, thieu thi KEU
  ro phep kiem nao chua duoc gac, JSON hong thi CHAN.

## Cach lam lai

```bash
grep -rnE "catch *\([a-z0-9_]*\) *\{ *return (\[\]|\{\}|null|''|0|false)" scripts/
```

`tests/fe/infra/config-presence.spec.ts` gac phan quan trong: moi config GENERIC ma script co doc
phai duoc git track VA nam trong danh sach dong goi cua `package_kit.js`.
