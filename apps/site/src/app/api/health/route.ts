import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json({
    status: 'ok',
    service: 'erpchess-site',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  });
}
