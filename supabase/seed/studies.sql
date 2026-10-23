-- Tự sinh bởi supabase/seed/studies-to-sql.mjs từ studies.json — không sửa tay.
insert into public.studies (id, academy_id, title, description, visibility) values
  ('57b2e4a4-5a2e-535a-aafd-93c95e117655', null, 'Bàn cờ và toạ độ', 'Làm quen bàn cờ 64 ô và cách gọi tên từng ô.', 'public'),
  ('6e0fa5af-fede-5d27-a6d1-c45dd7a64499', null, 'Xe bắt quân', 'Xe đi thẳng theo hàng và cột. Hãy dùng xe bắt hết quân đen.', 'public'),
  ('d5c90222-92c0-52d2-aa4b-a7da632e1c04', null, 'Tượng bắt quân', 'Tượng đi chéo và không bao giờ đổi màu ô.', 'public'),
  ('ad2901b0-5ecd-532b-ac90-bd549dc8f37b', null, 'Chiếu hết 1 nước', 'Tìm nước chiếu hết ngay lập tức.', 'public'),
  ('2c78c8d9-bfaf-525c-adbc-f2622cdb72b7', null, 'Ván mẫu: bẫy ô f7', 'Một ván ngắn cho thấy vì sao phải bảo vệ ô f7 ngay từ khai cuộc.', 'public')
on conflict (id) do update
  set title = excluded.title, description = excluded.description, visibility = excluded.visibility;

-- Thay toàn bộ hoạt động của các study này (thứ tự có thể đổi giữa các lần sinh)
delete from public.study_activities where study_id in ('57b2e4a4-5a2e-535a-aafd-93c95e117655', '6e0fa5af-fede-5d27-a6d1-c45dd7a64499', 'd5c90222-92c0-52d2-aa4b-a7da632e1c04', 'ad2901b0-5ecd-532b-ac90-bd549dc8f37b', '2c78c8d9-bfaf-525c-adbc-f2622cdb72b7');
insert into public.study_activities (id, study_id, position, kind, title, payload, points) values
  ('25aaf0eb-14bd-52ce-abcc-e0fa0c8d6473', '57b2e4a4-5a2e-535a-aafd-93c95e117655', 0, 'explanation', 'Bàn cờ', '{"body":"# Bàn cờ\nBàn cờ có **64 ô** xen kẽ sáng và tối, xếp thành 8 hàng và 8 cột.\n\n- Các **cột** đánh chữ từ *a* đến *h*, tính từ trái sang phải phía Trắng.\n- Các **hàng** đánh số từ *1* đến *8*, hàng 1 ở gần Trắng.\n- Tên một ô gồm chữ cột rồi số hàng, ví dụ **e4**.\n\nĐặt bàn sao cho ô ở góc dưới bên phải mỗi người là ô sáng."}'::jsonb, 0),
  ('873ebb87-a75c-5716-a221-2dbba6f8f31d', '57b2e4a4-5a2e-535a-aafd-93c95e117655', 1, 'mcq', 'Số ô', '{"question":"Bàn cờ có bao nhiêu ô?","options":["32","64","81","100"],"correct":1}'::jsonb, 10),
  ('2ab8c2ab-3b33-5170-a4b5-19f9ebf1d81c', '57b2e4a4-5a2e-535a-aafd-93c95e117655', 2, 'mcq', 'Đặt bàn', '{"question":"Ô ở góc dưới bên phải của mỗi người chơi có màu gì?","options":["Sáng","Tối"],"correct":0}'::jsonb, 10),
  ('1cc16c32-2735-5af6-a837-0760279ac784', '57b2e4a4-5a2e-535a-aafd-93c95e117655', 3, 'mcq', 'Gọi tên ô', '{"question":"Xe trắng đang đứng ở ô nào?","fen":"4k3/8/8/8/3R4/8/8/4K3 w - - 0 1","options":["d4","e4","d5","4d"],"correct":0}'::jsonb, 10),
  ('75bd6a0a-21ad-5660-a82b-6216d6399142', '6e0fa5af-fede-5d27-a6d1-c45dd7a64499', 0, 'explanation', 'Cách đi của xe', '{"body":"# Xe\nXe đi **thẳng** theo hàng ngang hoặc cột dọc, bao nhiêu ô cũng được, miễn là không có quân nào chắn đường.\n\nXe bắt quân bằng cách đi vào đúng ô của quân đối phương."}'::jsonb, 0),
  ('fee89ddd-eb25-51e5-ab84-9f5850704f76', '6e0fa5af-fede-5d27-a6d1-c45dd7a64499', 1, 'capture', 'Hai tốt', '{"fen":"8/8/8/p3p3/8/8/8/R7 w - - 0 1"}'::jsonb, 10),
  ('7ae4dc35-13f3-5712-adcc-4f63bc5fe74e', '6e0fa5af-fede-5d27-a6d1-c45dd7a64499', 2, 'capture', 'Đổi hướng', '{"fen":"8/1p6/8/8/5p2/8/8/1R6 w - - 0 1"}'::jsonb, 10),
  ('b2f2ad95-beb4-5579-af45-9654ff3fed00', '6e0fa5af-fede-5d27-a6d1-c45dd7a64499', 3, 'capture', 'Lên rồi sang', '{"fen":"3p4/8/8/8/8/8/3R2p1/8 w - - 0 1"}'::jsonb, 10),
  ('800530e3-025e-5b8c-ad57-59270efc4334', 'd5c90222-92c0-52d2-aa4b-a7da632e1c04', 0, 'explanation', 'Cách đi của tượng', '{"body":"# Tượng\nTượng đi theo **đường chéo**, bao nhiêu ô cũng được nếu không bị chắn.\n\nVì luôn đi chéo nên tượng ở ô tối mãi mãi chỉ đi trên ô tối, tượng ở ô sáng chỉ đi trên ô sáng."}'::jsonb, 0),
  ('cf97dd9e-1916-55bc-aecf-d1b43025f4ba', 'd5c90222-92c0-52d2-aa4b-a7da632e1c04', 1, 'capture', 'Một nước', '{"fen":"8/8/8/8/8/2p5/8/B7 w - - 0 1"}'::jsonb, 10),
  ('3e76ecfa-ee5e-5cac-a549-761f54d4ea46', 'd5c90222-92c0-52d2-aa4b-a7da632e1c04', 2, 'capture', 'Hai đường chéo', '{"fen":"8/6p1/8/8/3p4/8/8/B7 w - - 0 1"}'::jsonb, 10),
  ('a2632b10-4f40-5663-aec8-625eee1cba9a', 'd5c90222-92c0-52d2-aa4b-a7da632e1c04', 3, 'capture', 'Ba quân', '{"fen":"8/8/8/4p3/8/2p5/8/2B5 w - - 0 1"}'::jsonb, 10),
  ('371f6c22-e5d7-5fe6-a262-d823fb330118', 'ad2901b0-5ecd-532b-ac90-bd549dc8f37b', 0, 'explanation', 'Chiếu hết là gì?', '{"body":"# Chiếu hết\nVua bị **chiếu** khi đang bị quân đối phương tấn công.\n\nNếu vua bị chiếu mà không thể:\n- chạy sang ô an toàn,\n- chặn đường chiếu,\n- bắt quân đang chiếu,\n\nthì đó là **chiếu hết** và ván cờ kết thúc."}'::jsonb, 0),
  ('025996a3-4946-54d2-a8a8-fb6af6040cfc', 'ad2901b0-5ecd-532b-ac90-bd549dc8f37b', 1, 'puzzle', 'Hàng cuối', '{"fen":"6k1/5ppp/8/8/8/8/5PPP/3R2K1 w - - 0 1","moves":["d1d8"]}'::jsonb, 10),
  ('ebbb7aba-a13a-5d8b-adbe-e44771198989', 'ad2901b0-5ecd-532b-ac90-bd549dc8f37b', 2, 'puzzle', 'Hành lang', '{"fen":"7k/6pp/8/8/8/8/8/R5K1 w - - 0 1","moves":["a1a8"]}'::jsonb, 10),
  ('bd6c6546-ef52-530b-a126-6e9bb03fa142', 'ad2901b0-5ecd-532b-ac90-bd549dc8f37b', 3, 'puzzle', 'Hậu ở hàng cuối', '{"fen":"6k1/5ppp/8/6N1/8/8/5PPP/3Q2K1 w - - 0 1","moves":["d1d8"]}'::jsonb, 10),
  ('f20259ff-cbf0-5a4b-aad3-a1107539a497', 'ad2901b0-5ecd-532b-ac90-bd549dc8f37b', 4, 'puzzle', 'Ngạt thở', '{"fen":"6rk/6pp/7N/8/8/8/8/6K1 w - - 0 1","moves":["h6f7"]}'::jsonb, 10),
  ('b10eb89e-5add-5a51-a527-019ac87f6746', '2c78c8d9-bfaf-525c-adbc-f2622cdb72b7', 0, 'game', 'Ván 4 nước', '{"pgn":"[Event \"Ván mẫu ERPChess\"]\n[White \"Trắng\"]\n[Black \"Đen\"]\n[Result \"1-0\"]\n\n1. e4 e5 2. Bc4 { Tượng nhắm thẳng vào f7, ô chỉ có vua đen bảo vệ. } Nc6 3. Qh5 { Hậu cũng nhắm f7 và cả tốt e5. } Nf6?? { Đen phát triển quân nhưng quên mối đe doạ. Nên đi 3... g6 hoặc 3... Qe7. } (3... g6 4. Qf3 Nf6 { Đen chặn được và phát triển quân. }) 4. Qxf7# { Hậu được tượng c4 bảo vệ nên vua đen không bắt được. } 1-0"}'::jsonb, 10),
  ('5f327956-82f6-53cf-a0f0-cc567e51047b', '2c78c8d9-bfaf-525c-adbc-f2622cdb72b7', 1, 'mcq', 'Rút kinh nghiệm', '{"question":"Sau 1. e4 e5 2. Bc4 Nc6 3. Qh5, nước nào giúp Đen tránh bị chiếu hết?","options":["3... Nf6","3... g6","3... a6","3... Nd4"],"correct":1}'::jsonb, 10);
