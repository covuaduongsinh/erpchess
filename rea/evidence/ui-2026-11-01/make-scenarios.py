"""Sinh bốn kịch bản REA chụp giao diện erpchess (desktop/mobile x sáng/tối) cho các trang 25a-25f.

Dùng:
    python make-scenarios.py [slug-hoc-vien]      (mặc định: thu-nghiem-ui)

Điều kiện chạy kịch bản (chưa chạy được khi tài khoản thử chưa xác nhận email):
    1. Dựng bản build cục bộ:   pnpm --filter @erpchess/web build && pnpm --filter @erpchess/web preview --port 4173
    2. Nạp tài khoản thử từ tệp .env.test-account (ERP_TEST_EMAIL, ERP_TEST_PASSWORD), không in ra log:
           set -a; . ./.env.test-account; set +a
    3. Chạy từng kịch bản, kết quả vào thư mục riêng (capture.json bị .gitignore vì nặng):
           node D:/code/rea/scripts/rea.mjs capture-browser-scenario scenario-erpchess-desktop-light.json --format json > ../25f/desktop-light/capture.json
    4. Tách ảnh:  python extract-shots.py ../25f/desktop-light/capture.json ../25f/desktop-light

Kịch bản chế độ tối dùng color_scheme "dark": ứng dụng mặc định theo prefers-color-scheme nên không cần bấm
công tắc. Bí mật lấy từ biến môi trường, tệp kịch bản không chứa mật khẩu.
"""

import json
import pathlib
import sys

args = [a for a in sys.argv[1:] if not a.startswith('--')]
slug = args[0] if args else 'thu-nghiem-ui'
base = 'http://localhost:4173'
here = pathlib.Path(__file__).parent
template = json.loads((here / 'scenario.json').read_text(encoding='utf-8'))

# (tên ảnh, đường dẫn). Dùng bí danh không cần slug khi có; còn lại trỏ vào học viện thử.
A = f'/a/{slug}'
PAGES = [
    # 25a-25c: khung ứng dụng, Tổng quan, Quản trị
    ('tong_quan', '/dashboard'),
    ('hoc_vien', '/administration/students'),
    ('batch', '/batches'),
    ('nhom', f'{A}/groups'),
    ('cap_do', f'{A}/levels'),
    ('dia_diem', f'{A}/locations'),
    ('lead', f'{A}/leads'),
    ('hoc_phi', f'{A}/billing'),
    ('thong_bao', f'{A}/notifications'),
    ('thiet_lap', f'{A}/settings'),
    ('hlv', f'{A}/coaches'),
    # 25d: Học tập, Nội dung
    ('quiz', '/quiz/list'),
    ('bai_tap', '/assignment/exercise'),
    ('hoc_lieu', f'{A}/studies'),
    ('khoa_hoc', f'{A}/courses'),
    ('lop_hoc', f'{A}/classes'),
    ('luyen_tap', '/practice'),
    ('csdl_van', '/database'),
    ('bao_cao', f'{A}/reports'),
    ('chat', f'{A}/chat'),
    # 25e: Thi đấu và Bàn cờ
    ('khu_thi_dau', '/game-area'),
    ('giai_dau', '/tournaments'),
    ('simul', '/simul'),
    ('ban_co', '/analysis'),
    # 25f: hồ sơ và trang 404
    ('tuy_chon', '/preferences'),
    ('trang_404', '/duong-dan-khong-ton-tai'),
]


# Chế độ có dữ liệu (`--data`): sáu trang chính, mỗi trang có thể bấm thêm một nút/tab trước khi chụp.
# (tên ảnh, đường dẫn, bộ chọn CSS cần bấm sau khi tải — hoặc None)
DATA_PAGES = [
    ('tong_quan', '/dashboard', None),
    ('hoc_vien_danh_sach', '/administration/students', "button[aria-label='Danh sách']"),
    ('hoc_vien_luoi', '/administration/students', "button[aria-label='Lưới']"),
    ('batch', '/batches', None),
    ('quiz', '/quiz/list', None),
    ('quiz_bxh', '/quiz/list', "[role=tab]:nth-of-type(3)"),
    ('giai_dau', '/tournaments', None),
    ('tong_quan_diem_danh', '/dashboard', "[role=tablist][aria-label='Thống kê theo ngày'] button:nth-child(2)"),
    ('khu_thi_dau', '/game-area', None),
    ('khu_thi_dau_lich_su', '/game-area', "[role=tab]:nth-of-type(2)"),
    ('khu_thi_dau_dang_dau', '/game-area', "[role=tab]:nth-of-type(3)"),
    ('lop_hoc', f'{A}/classes', None),
    ('lop_hoc_quy', f'{A}/classes', "button:text-is('Quý')"),
    ('bai_tap', '/assignment/exercise', None),
    ('giam_gia', f'{A}/billing/discounts', None),
    ('cap_do', f'{A}/levels', None),
    ('cap_do_sua', f'{A}/levels', "button:has-text('Cơ bản')"),
    ('hoc_phi_goi', f'{A}/billing/plans', None),
    ('lich', f'{A}/calendar', None),
    ('dia_diem', f'{A}/locations', None),
    ('lead', f'{A}/leads', None),
    ('thiet_lap', f'{A}/settings', None),
    ('nhom', f'{A}/groups', None),
    ('choi_co', f'{A}/play', None),
    ('simul', '/simul', None),
]
DATA = '--data' in sys.argv
# `--only=a,b`: chỉ giữ các trang này (chụp bổ sung nhanh, không chụp lại cả bộ)
ONLY = next((a.split('=', 1)[1].split(',') for a in sys.argv if a.startswith('--only=')), None)
if ONLY:
    DATA_PAGES = [p for p in DATA_PAGES if p[0] in ONLY]


def build(name: str, width: int, height: int, scheme: str, mobile: bool) -> None:
    acts = [
        {"step_id": "login_form", "locator": {"selector": "input[name=email]", "kind": "css"}, "state": "visible", "timeout_ms": 60000, "action": "wait_for"},
        {"step_id": "fill_user", "value": {"secret_id": "erp_user", "source": "secret"}, "locator": {"selector": "input[name=email]", "kind": "css"}, "timeout_ms": 10000, "action": "fill"},
        {"step_id": "fill_pass", "value": {"secret_id": "erp_pass", "source": "secret"}, "locator": {"selector": "input[name=password]", "kind": "css"}, "timeout_ms": 10000, "action": "fill"},
        {"step_id": "submit", "locator": {"selector": "button[type=submit]", "kind": "css"}, "timeout_ms": 15000, "action": "click"},
        {"step_id": "after_login", "duration_ms": 8000, "action": "wait_for_timeout"},
    ]
    pages = [(k, p, None) for k, p in PAGES] if not DATA else DATA_PAGES
    for key, path, click in pages:
        acts.append({"step_id": f"go_{key}", "timeout_ms": 60000, "wait_until": "load", "destination": {"url": base + path}, "action": "goto"})
        if click:
            acts.append({"step_id": f"click_{key}", "locator": {"selector": click, "kind": "css"}, "timeout_ms": 15000, "action": "click"})
        acts.append({"step_id": f"shot_{key}", "duration_ms": 6000, "action": "wait_for_timeout"})
        if mobile and key == 'tong_quan':
            # Ảnh drawer của sidebar trên màn hẹp
            acts.append({"step_id": "open_drawer", "locator": {"selector": "button[aria-label='Mở menu']", "kind": "css"}, "timeout_ms": 10000, "action": "click"})
            acts.append({"step_id": "shot_drawer", "duration_ms": 1500, "action": "wait_for_timeout"})
    scenario = dict(template)
    scenario['actions'] = acts
    scenario['start_url'] = {"url": base + "/login"}
    env = dict(template['environment'])
    env['locale'] = 'vi-VN'
    env['color_scheme'] = scheme
    env['viewport'] = {"device_scale_factor": 1, "width": width, "height": height}
    scenario['environment'] = env
    scenario['secrets'] = [
        {"secret_id": "erp_user", "environment_variable": "ERP_TEST_EMAIL"},
        {"secret_id": "erp_pass", "environment_variable": "ERP_TEST_PASSWORD"},
    ]
    (here / name).write_text(json.dumps(scenario, indent=1, ensure_ascii=False) + '\n', encoding='utf-8')
    print(name, len(DATA_PAGES if DATA else PAGES), 'trang')


pre = 'scenario-erpchess-data-' if DATA else 'scenario-erpchess-'
build(pre + 'desktop-light.json', 1440, 900, 'light', False)
build(pre + 'desktop-dark.json', 1440, 900, 'dark', False)
build(pre + 'mobile-light.json', 390, 844, 'light', True)
build(pre + 'mobile-dark.json', 390, 844, 'dark', True)
