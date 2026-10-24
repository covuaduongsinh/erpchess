import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // Các gói nội bộ xuất thẳng mã nguồn TypeScript
  transpilePackages: ['@erpchess/i18n', '@erpchess/ui-tokens'],
  // Không tự sinh AGENTS.md khi chạy dev
  agentRules: false,
};

export default nextConfig;
