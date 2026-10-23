-- Sửa lộ dữ liệu (phát hiện bởi pgTAP 02_assignments_rls): policy cũ cho mọi người xem được bài tập
-- đọc TOÀN BỘ assignment_targets, nên học viên/phụ huynh thấy cả học viên khác được giao bài
-- (và view assignment_progress mở rộng ra họ). Giờ chỉ thấy dòng giao liên quan tới mình.

alter policy "assignment_targets: theo quyền xem bài tập" on public.assignment_targets
  rename to "assignment_targets: staff thấy hết, học viên/phụ huynh chỉ thấy dòng của mình";

alter policy "assignment_targets: staff thấy hết, học viên/phụ huynh chỉ thấy dòng của mình"
  on public.assignment_targets
  using (
    private.has_role(private.assignment_academy(assignment_id), '{owner,coach}')
    or student_id = (select auth.uid())
    or (student_id is not null and private.is_parent_of(student_id))
    or (
      group_id is not null
      and (private.in_group(group_id, (select auth.uid())) or private.child_in_group(group_id))
    )
  );
