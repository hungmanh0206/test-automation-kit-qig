/* Gộp các nhóm thành một mảng duy nhất cho phần còn lại của trang dùng.
   Các file *_expansion / *_kit là lớp máy và khái niệm thế hệ sau — CÙNG cat với nhóm gốc,
   tách file chỉ để dễ sửa, không tạo thêm nhóm mới trên bản đồ (bản đồ 3D có đúng 6 cụm). */
const TERMS = [].concat(
  TERMS_RULE,
  TERMS_GATE, TERMS_GATE2, TERMS_GATE3, TERMS_GATE4, TERMS_GATE5,
  TERMS_SKILL,
  TERMS_CONCEPT, TERMS_CONCEPT2,
  TERMS_STATUS,
  TERMS_FLOW, TERMS_FLOW2
);
