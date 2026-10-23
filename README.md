# ERPChess

Nền tảng đào tạo cờ vua cho huấn luyện viên và học viện, chạy đồng bộ trên **web**, **máy tính** (Windows/macOS/Linux) và **điện thoại** (Android/iOS).

Kế hoạch tổng: [`docs/plans/00-ke-hoach-tong.md`](docs/plans/00-ke-hoach-tong.md). Mọi kế hoạch đều nằm trong `docs/plans/`.

## Cấu trúc

| Thư mục              | Vai trò                                          | Công nghệ                                    |
| -------------------- | ------------------------------------------------ | -------------------------------------------- |
| `apps/web`           | App chính trên trình duyệt                       | Vite, React 19, TanStack Router, Tailwind v4 |
| `apps/desktop`       | App máy tính, bọc bản build của `apps/web`       | Tauri 2                                      |
| `apps/mobile`        | App điện thoại                                   | Expo SDK 58, Expo Router                     |
| `apps/site`          | Trang giới thiệu, SEO                            | Next.js 16                                   |
| `packages/ui-tokens` | Màu, khoảng cách, font (bộ nhận diện Dương Sinh) | TypeScript + CSS `@theme`                    |
| `packages/i18n`      | Từ điển vi/en có kiểm tra khoá                   | i18next                                      |
| `packages/config`    | Preset tsconfig dùng chung                       | —                                            |

## Yêu cầu

- Node ≥ 22.19 và pnpm 11
- Rust (stable) để chạy app desktop; trên Windows cần thêm WebView2 (có sẵn trên Windows 10/11)

## Lệnh thường dùng

```bash
pnpm install
pnpm lint          # Biome
pnpm typecheck
pnpm test          # Vitest
pnpm build

pnpm --filter @erpchess/web dev        # http://localhost:5173
pnpm --filter @erpchess/site dev       # http://localhost:3000
pnpm --filter @erpchess/desktop dev    # mở cửa sổ Tauri, dùng dev server của web
pnpm --filter @erpchess/mobile start   # Expo dev server
```
