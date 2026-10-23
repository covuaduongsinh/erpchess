-- INSERT … RETURNING trên studies bị chặn: policy SELECT gọi private.study_readable_by, hàm này tra lại
-- bảng studies nên không thấy dòng vừa chèn trong cùng lệnh. Kiểm thẳng trên cột của dòng thay vì tra lại.
drop policy "studies: đọc theo phạm vi hiển thị" on public.studies;

create policy "studies: đọc theo phạm vi hiển thị"
  on public.studies for select to authenticated
  using (
    visibility = 'public'
    or created_by = (select auth.uid())
    or (visibility = 'academy' and private.is_member(academy_id))
  );
