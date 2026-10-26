import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // Các gói nội bộ xuất thẳng mã nguồn TypeScript
  transpilePackages: ['@erpchess/domain', '@erpchess/i18n', '@erpchess/ui-tokens'],
  // Không tự sinh AGENTS.md khi chạy dev
  agentRules: false,
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
        ],
      },
    ];
  },
};

export default nextConfig;
