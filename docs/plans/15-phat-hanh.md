# Giai đoạn 14 — Phát hành (Release, Deployment, Packaging & Monitoring)

## Bối cảnh

- **Mục tiêu:** Hoàn thiện hạ tầng đóng gói, tự động cập nhật, cấu hình triển khai và giám sát cho toàn bộ 4 ứng dụng trong monorepo ERPChess:
  1. `apps/web`: Web SPA (Vite + React 19 + TanStack Router).
  2. `apps/site`: Landing page & xác minh chứng chỉ (Next.js 16).
  3. `apps/desktop`: Desktop app (Tauri 2 — Windows MSI/NSIS, macOS DMG, Linux AppImage/deb).
  4. `apps/mobile`: Mobile app (Expo SDK + Expo Router cho Android & iOS).
- **Kế hoạch tổng (`docs/plans/00-ke-hoach-tong.md` L230-236):**
  - Web và site: Vercel (cấu hình deploy, environment, rewrite, headers, analytics / monitoring).
  - Desktop: Tauri bundle MSI/DMG/AppImage, updater configuration (`tauri-plugin-updater`), icons, manifest.
  - Mobile: EAS Build/Submit, EAS Update, app config (`app.json` / `eas.json`), icons/splash, deep linking.
  - Giám sát: Error handling / Telemetry / Health check trên các app.
- **Có sẵn trong repo:**
  - `apps/web/vercel.json`: Đã có rewrite SPA và COOP/COEP headers cho Arasan WASM engine.
  - `apps/desktop/src-tauri`: Cấu hình Tauri 2 cơ bản (`tauri.conf.json`), icons, Cargo.toml. CI đã có job `Tauri cargo check`.
  - `apps/mobile`: Cấu hình Expo cơ bản (`app.json`), assets icons/splash. CI đã có bước `export:web`.
  - `apps/site`: Next.js 16 với các route `/verify/[code]` và `/pay/[token]`.
- **Chia 2 PR hợp lý:**
  - **PR 14a — Đóng gói Desktop (Tauri) và Mobile (EAS, Expo Updates) kèm GitHub Actions Release:**
    - Hoàn thiện cấu hình `tauri.conf.json` (bundle targets NSIS/MSI, auto-updater plugin, capabilities).
    - Cấu hình `eas.json` cho Expo, cấu hình Expo Updates, deep link `erpchess://`.
    - Workflow GitHub Actions `.github/workflows/release-desktop.yml` tự động build và upload release asset cho desktop khi tạo tag.
  - **PR 14b — Cấu hình triển khai Web & Site (Vercel), Giám sát lỗi (Telemetry/Health) và Sổ tay vận hành:**
    - Cấu hình `apps/site`: robots.txt, sitemap, security headers, health check endpoint `/api/health`.
    - Cấu hình `apps/web`: Global Error Boundary kèm telemetry / error logging handler.
    - Sổ tay vận hành `docs/ops/deployment-guide.md` và checklist phát hành `docs/ops/release-checklist.md`.
    - Cập nhật sổ cái `rea/ledger.md`.

---

## Chi tiết các PR

### PR 14a — Đóng gói Desktop & Mobile kèm Release Workflows

1. **Desktop (`apps/desktop`):**
   - Nâng cấp `apps/desktop/src-tauri/tauri.conf.json`:
     - Version `1.0.0`, mô tả ứng dụng, bản quyền.
     - Cấu hình bundle Windows: hỗ trợ cả NSIS installer (`.exe`) và MSI (`.msi`).
     - Tích hợp cấu hình updater (`plugins.updater`): endpoint kiểm tra cập nhật, public key xác thực.
     - Khai báo capabilities cho updater và notification trong `src-tauri/capabilities/default.json`.
   - Cập nhật `apps/desktop/package.json`: thêm script `bundle` (`tauri build`).
2. **Mobile (`apps/mobile`):**
   - Tạo `apps/mobile/eas.json`:
     - Profile `development` (dev-client).
     - Profile `preview` (internal testing APK/IPA).
     - Profile `production` (Google Play AAB, Apple App Store).
   - Bổ sung cấu hình trong `apps/mobile/app.json`:
     - Cấu hình updates OTA (`updates.url`, `runtimeVersion`).
     - Cấu hình deep links `erpchess://` và association.
3. **Release CI Workflow (`.github/workflows/release-desktop.yml`):**
   - Kích hoạt khi có tag `v*` (ví dụ `v1.0.0`).
   - Ma trận build: Windows (`windows-latest`), Linux (`ubuntu-latest`), macOS (`macos-latest`).
   - Tự động đóng gói và đính kèm binary vào GitHub Release.
4. **Kiểm thử:**
   - Chạy `cargo check --manifest-path apps/desktop/src-tauri/Cargo.toml`.
   - Chạy `pnpm --filter @erpchess/mobile export:web`.
   - `pnpm lint`, `pnpm typecheck`, `pnpm test`.

---

### PR 14b — Cấu hình Web/Site (Vercel), Giám sát lỗi và Sổ tay vận hành

1. **Site (`apps/site`):**
   - Tạo endpoint `/api/health` trả về trạng thái service và timestamp.
   - Thêm `robots.txt` và `sitemap.ts` (SEO cho các trang công khai).
   - Bổ sung security headers trong `next.config.ts` (X-Frame-Options, X-Content-Type-Options, Referrer-Policy).
2. **Web (`apps/web`):**
   - Component `AppErrorBoundary`: bắt lỗi runtime React, hiển thị màn hình báo lỗi thân thiện kèm nút thử lại / quay về trang chủ.
   - Telemetry / Error reporting client: module `src/lib/telemetry.ts` ghi nhận log lỗi (sẵn sàng kết nối Sentry DSN khi cấu hình biến môi trường).
   - Kiểm tra và tinh chỉnh `vercel.json` đảm bảo rewrite SPA và COOP/COEP headers tối ưu.
3. **Tài liệu vận hành (`docs/ops/`):**
   - `docs/ops/deployment-guide.md`: Hướng dẫn triển khai Supabase, Vercel, LiveKit, EAS, Tauri release.
   - `docs/ops/release-checklist.md`: Checklist kiểm thử và xác nhận chất lượng trước khi ra mắt.
4. **Kiểm thử & Bàn giao:**
   - Chạy đầy đủ CI 3 job xanh.
   - Cập nhật sổ cái `rea/ledger.md` và mục "Kết quả" trong file này.

---

## Kiểm chứng

- **Mỗi PR:**
  - `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build`.
  - `pnpm --filter @erpchess/mobile export:web`.
  - CI GitHub Actions 3 job xanh (Arasan, Lint/Typecheck/Test/Build, Tauri cargo check).
- **Cuối giai đoạn:**
  - Hoàn tất toàn bộ 14 giai đoạn của ERPChess.
  - Sổ cái cập nhật đầy đủ.

---

## Rủi ro và ghi chú

- **Không chứa mã GPL:** Mọi plugin, thư viện bundle đều tuân thủ MIT / Apache 2.0.
- **Tauri bundle trên Windows runner:** Runner GitHub Actions Windows có sẵn MSVC và WiX Toolset, cho phép build cả NSIS và MSI mượt mà.
- **Tương thích COOP/COEP trên Vercel:** Web app yêu cầu `Cross-Origin-Opener-Policy: same-origin` và `Cross-Origin-Embedder-Policy: require-corp` để Web Worker dùng `SharedArrayBuffer` cho engine Arasan WASM. `vercel.json` đã có sẵn và cần kiểm tra kỹ các route tĩnh/media.

---

## Kết quả

- **PR 14a (Đóng gói Desktop & Mobile):** PR #31 đã được merge vào `main`.
  - Cấu hình đóng gói Tauri v1.0.0 cho Windows (NSIS, MSI), Linux (AppImage, deb), macOS (dmg).
  - Cấu hình EAS Build (`eas.json`) với 3 profiles và cấu hình Expo Updates (`app.json`).
  - Workflow GitHub Actions release đa nền tảng `.github/workflows/release-desktop.yml`.
- **PR 14b (Web/Site Vercel, Telemetry/Health & Sổ tay vận hành):** Đang chuẩn bị merge.
  - Cấu hình Security headers và rewrite trên Vercel cho Web & Site.
  - Endpoint giám sát `/api/health`, `robots.txt`, `sitemap.ts` cho Site.
  - Error Boundary `AppErrorBoundary` và module `telemetry.ts` cho Web app.
  - Sổ tay vận hành `docs/ops/deployment-guide.md` và `docs/ops/release-checklist.md`.
