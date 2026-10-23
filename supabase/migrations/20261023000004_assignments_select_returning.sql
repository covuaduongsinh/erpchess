-- Sửa (phát hiện bởi smoke test, pgTAP cũ bỏ sót): INSERT … RETURNING vào assignments bị RLS chặn.
-- Policy SELECT cũ gọi can_view_assignment(id) → tra lại bảng assignments theo id; hàm STABLE dùng
-- snapshot trước câu INSERT nên không thấy dòng vừa thêm. Dùng thẳng cột academy_id của dòng.

alter policy "assignments: staff, học viên được giao, phụ huynh của học viên đọc"
  on public.assignments
  using (
    private.has_role(academy_id, '{owner,coach}')
    or private.is_assigned(id, (select auth.uid()))
    or exists (
      select 1 from public.parent_links pl
      where pl.parent_id = (select auth.uid())
        and private.is_assigned(id, pl.student_id)
    )
  );
