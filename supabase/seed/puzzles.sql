-- Tự sinh bởi supabase/seed/to-sql.mjs từ puzzles.json — không sửa tay.
insert into public.puzzles (id, academy_id, title, fen, moves, rating, themes) values
  ('8ee0b541-3c75-51db-a046-02a318c864d0', null, 'Chiếu hết hàng cuối', '6k1/5ppp/8/8/8/8/5PPP/3R2K1 w - - 0 1', array['d1d8']::text[], 500, array['backRankMate', 'mateIn1']::text[]),
  ('a8e3afbd-0c9b-57d4-aec4-dd7c5ac61dd3', null, 'Chiếu hết ngạt thở', '6rk/6pp/7N/8/8/8/8/6K1 w - - 0 1', array['h6f7']::text[], 700, array['smotheredMate', 'mateIn1']::text[]),
  ('6b092b06-ed04-579b-a873-cb70c4531f6d', null, 'Chiếu hết kiểu Học trò', 'r1bqkb1r/pppp1ppp/2n2n2/4p2Q/2B1P3/8/PPPP1PPP/RNB1K1NR w KQkq - 4 4', array['h5f7']::text[], 450, array['opening', 'mateIn1']::text[]),
  ('b7fd99a2-8a33-50aa-ad56-aa88f4ebfcc9', null, 'Chiếu hết kiểu Kẻ ngốc', 'rnbqkbnr/pppp1ppp/8/4p3/6P1/5P2/PPPPP2P/RNBQKBNR b KQkq - 0 2', array['d8h4']::text[], 400, array['opening', 'mateIn1']::text[]),
  ('20e87e31-2c88-56b5-a625-bae5b3fee752', null, 'Xe chiếu hết, vua yểm trợ', '1k6/8/1K6/8/8/8/8/7R w - - 0 1', array['h1h8']::text[], 450, array['endgame', 'mateIn1']::text[]),
  ('1c23ecd4-6884-57df-aeb2-c4e33c29d9e1', null, 'Xe xiên vua để ăn hậu', '3q4/8/8/3k4/8/8/8/R5K1 w - - 0 1', array['a1d1', 'd5e6', 'd1d8']::text[], 800, array['skewer', 'rook']::text[]),
  ('e525171e-71a1-5984-a894-fa5043a06c5f', null, 'Hậu và xe chiếu hết', '6k1/5p1p/6p1/8/8/8/5PPP/3QR1K1 w - - 0 1', array['d1d4', 'f7f6', 'e1e7', 'g6g5', 'd4d8']::text[], 900, array['backRankMate', 'mateIn3']::text[]),
  ('bbe0b823-ff27-5ac8-aca9-e87a55120cbb', null, 'Mã chiếu hết ngạt thở (xe và hậu gần đó)', 'r5rk/6pp/7N/8/8/8/1Q4PP/6K1 w - - 0 1', array['h6f7']::text[], 1200, array['smotheredMate', 'mateIn1']::text[]),
  ('b11af20b-c70a-5a37-af88-789059cbcbde', null, 'Tốt phong cấp', '8/4P1k1/8/8/8/8/8/4K3 w - - 0 1', array['e7e8q']::text[], 450, array['promotion', 'endgame']::text[]),
  ('cfab1ed5-683b-5ea8-a848-81f4706006a2', null, 'Xe chiếu hết hành lang', '7k/6pp/8/8/8/8/8/R5K1 w - - 0 1', array['a1a8']::text[], 400, array['backRankMate', 'mateIn1']::text[]),
  ('e19faf34-4e29-5f75-a573-50868dc7fb90', null, 'Ăn xe không được bảo vệ (tàn cuộc)', '8/8/4k3/8/3pK3/8/3R4/3r4 w - - 0 1', array['d2d1', 'e6d6', 'd1d4']::text[], 1000, array['hangingPiece', 'endgame']::text[]),
  ('7c2c6386-2c78-5cdb-a33c-78f813f930ea', null, 'Hậu chiếu hết hàng cuối', '6k1/5ppp/8/6N1/8/8/5PPP/3Q2K1 w - - 0 1', array['d1d8']::text[], 1000, array['mateIn1']::text[]),
  ('1a56d56f-2839-5a64-aaae-913911ce125a', null, 'Hai xe chiếu hết hàng cuối', '3r2k1/5ppp/8/8/8/8/5PPP/3RR1K1 w - - 0 1', array['d1d8']::text[], 850, array['backRankMate', 'mateIn1']::text[])
on conflict (id) do update
  set title = excluded.title, fen = excluded.fen, moves = excluded.moves,
      rating = excluded.rating, themes = excluded.themes;
