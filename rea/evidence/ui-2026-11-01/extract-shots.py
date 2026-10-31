"""Tách ảnh chụp màn hình (base64) từ capture.json của REA ra tệp PNG.

Dùng: python extract-shots.py <capture.json> <thư mục ra>
Chỉ ghi các bước có tên bắt đầu bằng "shot_".
"""

import base64
import json
import pathlib
import sys

src, out = pathlib.Path(sys.argv[1]), pathlib.Path(sys.argv[2])
out.mkdir(parents=True, exist_ok=True)
steps = json.loads(src.read_text(encoding="utf-8"))["normalized_result"]["steps"]
for step in steps:
    shot = step.get("artifacts", {}).get("screenshot", {})
    if shot.get("state") != "captured" or not step["step_id"].startswith("shot_"):
        continue
    (out / f"{step['step_id']}.png").write_bytes(base64.b64decode(shot["value"]["data_base64"]))
    print(step["step_id"], step["after_url"]["url"])
