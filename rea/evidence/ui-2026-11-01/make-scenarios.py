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

slug = sys.argv[1] if len(sys.argv) > 1 else 'thu-nghiem-ui'
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


def build(name: str, width: int, height: int, scheme: str, mobile: bool) -> None:
    acts = [
        {"step_id": "login_form", "locator": {"selector": "input[name=email]", "kind": "css"}, "state": "visible", "timeout_ms": 60000, "action": "wait_for"},
        {"step_id": "fill_user", "value": {"secret_id": "erp_user", "source": "secret"}, "locator": {"selector": "input[name=email]", "kind": "css"}, "timeout_ms": 10000, "action": "fill"},
        {"step_id": "fill_pass", "value": {"secret_id": "erp_pass", "source": "secret"}, "locator": {"selector": "input[name=password]", "kind": "css"}, "timeout_ms": 10000, "action": "fill"},
        {"step_id": "submit", "locator": {"selector": "button[type=submit]", "kind": "css"}, "timeout_ms": 15000, "action": "click"},
        {"step_id": "after_login", "duration_ms": 8000, "action": "wait_for_timeout"},
    ]
    for key, path in PAGES:
        acts.append({"step_id": f"go_{key}", "timeout_ms": 60000, "wait_until": "load", "destination": {"url": base + path}, "action": "goto"})
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
    print(name, len(PAGES), 'trang')


build('scenario-erpchess-desktop-light.json', 1440, 900, 'light', False)
build('scenario-erpchess-desktop-dark.json', 1440, 900, 'dark', False)
build('scenario-erpchess-mobile-light.json', 390, 844, 'light', True)
build('scenario-erpchess-mobile-dark.json', 390, 844, 'dark', True)
