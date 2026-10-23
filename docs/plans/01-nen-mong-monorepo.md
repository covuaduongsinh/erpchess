# Giai đoạn 1 — Nền móng monorepo

Kế hoạch tổng: [00-ke-hoach-tong.md](00-ke-hoach-tong.md)

## Mục tiêu

Có một monorepo chạy được, gồm 4 app khung và các gói dùng chung:
- `apps/web` (Vite)
- `apps/site` (Next.js)
- `apps/desktop` (Tauri 2)
- `apps/mobile` (Expo)

Cả 4 app hiển thị cùng một màn hình chào bằng tiếng Việt và tiếng Anh, lấy từ `@erpchess/i18n` và `@erpchess/ui-tokens`. Lệnh `pnpm lint`, `pnpm typecheck`, `pnpm test` và `pnpm build` đều xanh.

## Phiên bản (tra bằng `npm view` ngày 2026-10-23)

| Gói                    | Bản                                                  |
| ---------------------- | ---------------------------------------------------- |
| pnpm                   | 11.25                                                |
| turbo                  | 2.11                                                 |
| typescript             | 7.0 (nếu công cụ nào chưa tương thích thì hạ về 6.x) |
| @biomejs/biome         | 2.6                                                  |
| vitest                 | 5.0                                                  |
| vite                   | 8.3                                                  |
| react                  | 19.3 (khớp với bản Expo yêu cầu)                     |
| @tanstack/react-router | 1.170                                                |
| tailwindcss            | 4.3                                                  |
| next                   | 16.4                                                 |
| expo                   | SDK 58 (expo-router 58)                              |
| nativewind             | 4.2                                                  |
| @tauri-apps/cli / api  | 2.12                                                 |
| i18next                | 26                                                   |
| zod                    | 4.6                                                  |

Môi trường máy: Node v25.2, Rust 1.95.

## Các bước

1. **Gốc repo:** `package.json` (scripts gọi turbo), `pnpm-workspace.yaml`, `turbo.json`, `biome.json`, `tsconfig.base.json`, `.gitignore`, `.editorconfig`, `.npmrc`, `README.md`.
2. **`packages/config`:** các preset tsconfig (`base`, `react-library`, `vite-app`, `nextjs`) và preset Vitest.
3. **`packages/ui-tokens`:** token màu, spacing, radius, font dưới dạng TS. Xuất kèm biến CSS (`tokens.css`) cho Tailwind v4 `@theme` và object preset cho NativeWind. Có test.
4. **`packages/i18n`:** `createI18n(lang)` dùng i18next, có từ điển `vi` (mặc định) và `en`, cùng type-safe keys. Có test.
5. **`apps/web`:** Vite + React + TanStack Router (file-based routes) + Tailwind v4, trang `/` chào mừng, có nút đổi ngôn ngữ.
6. **`apps/desktop`:** Tauri 2 với `frontendDist` = `../web/dist` và `devUrl` = `http://localhost:5173`. Có icon mặc định và đặt identifier.
7. **`apps/site`:** Next.js App Router + Tailwind v4, trang landing.
8. **`apps/mobile`:** Expo Router + NativeWind, màn hình chào. Metro cấu hình cho monorepo.
9. **CI:** `.github/workflows/ci.yml` chạy pnpm install, lint, typecheck, test, build (web, site). Thêm job riêng `cargo check` cho desktop.
10. **Kiểm chứng:** chạy `pnpm install`, `lint`, `typecheck`, `test`, `build`; `cargo check` trong `apps/desktop/src-tauri`; `npx expo export --platform web` để thử bundle mobile.

## Điều chỉnh khi triển khai (2026-10-23)

- **TypeScript 6.0** thay vì 7.0: Expo SDK 58 chỉ hỗ trợ `typescript ~6.0.3`, nên cả repo dùng chung bản này.
- **React 19.3.0** được ghim đúng bản như Expo, để web, site và mobile dùng một bản React duy nhất.
- **Chưa dùng NativeWind:** bản ổn định 4.2 chỉ chạy với Tailwind v3, còn v5 (hỗ trợ Tailwind v4) mới ở RC. Mobile tạm dùng `StyleSheet` với token từ `@erpchess/ui-tokens`; sẽ cân nhắc lại khi NativeWind 5 ra bản ổn định.
- **Bỏ `.npmrc`:** pnpm 11 cài kiểu isolated mặc định và Expo 58 chạy tốt với kiểu này (đã kiểm bằng `expo export`), nên không cần `node-linker=hoisted`.
- **Biome 2.6** kiểm cả CSS (đã bật `tailwindDirectives`), Markdown và YAML; bỏ qua `pnpm-lock.yaml` và `pnpm-workspace.yaml`.
- **Bảng màu Dương Sinh:** `@erpchess/ui-tokens` dùng navy `#2B3990` làm màu chủ đạo, cam `#F7941D` cho CTA, font Roboto.
- **`routeTree.gen.ts`** của TanStack Router được commit vào repo để `typecheck` chạy được mà không phải build trước.

## Ngoài phạm vi

Supabase và đăng nhập thuộc Giai đoạn 2; bàn cờ thuộc Giai đoạn 3.
