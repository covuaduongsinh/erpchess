import type { ClassroomRoom, RoomPeer, RoomSnapshot } from '@erpchess/api';
import { Card } from '../ui';

export type ClassroomRosterProps = {
  peers: RoomPeer[];
  snapshot: RoomSnapshot;
  runner: boolean;
  room: ClassroomRoom | null;
  currentUserId: string;
};

export function ClassroomRoster({
  peers,
  snapshot,
  runner,
  room,
  currentUserId,
}: ClassroomRosterProps) {
  const currentController = snapshot.controller;
  const isCoachOnly = !currentController;

  return (
    <Card title={`Thành viên (${peers.length})`}>
      <div className="flex flex-col gap-2">
        {runner && !isCoachOnly && (
          <div className="flex justify-end -mt-1 pb-1 border-b border-gray-100">
            <button
              type="button"
              onClick={() => room?.setController(null)}
              className="text-xs font-medium text-amber-700 hover:text-amber-800 underline decoration-dotted"
              title="Thu lại toàn bộ quyền đi cờ về HLV"
            >
              Thu quyền về HLV
            </button>
          </div>
        )}
        {peers.length === 0 ? (
          <p className="text-xs text-text-muted py-2 text-center">
            Chưa có thành viên nào trong phòng.
          </p>
        ) : (
          <ul className="flex flex-col divide-y divide-gray-100 text-sm">
            {peers.map((peer) => {
              const isMe = peer.userId === currentUserId;
              const hasTurn = currentController === peer.userId;

              return (
                <li
                  key={peer.userId}
                  className={`flex items-center justify-between py-2 px-1 rounded-md transition-colors ${
                    hasTurn ? 'bg-green/10' : 'hover:bg-gray-50'
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div
                      className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                        peer.runner ? 'bg-primary text-white' : 'bg-emerald-100 text-emerald-800'
                      }`}
                      aria-hidden="true"
                    >
                      {peer.name.slice(0, 1).toUpperCase()}
                    </div>
                    <div className="flex flex-col min-w-0">
                      <span className="truncate text-xs font-medium text-gray-900">
                        {peer.name}{' '}
                        {isMe && <span className="text-text-muted font-normal">(bạn)</span>}
                      </span>
                      <span className="text-[10px] text-text-muted">
                        {peer.runner ? 'Huấn luyện viên' : 'Học viên'}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    {/* Badge trạng thái quyền đi quân */}
                    {hasTurn && (
                      <span className="flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-800">
                        <span>♟️</span>
                        <span>Đang đi cờ</span>
                      </span>
                    )}

                    {/* Nút trao/thu quyền dành riêng cho HLV */}
                    {runner && !peer.runner && (
                      <div>
                        {hasTurn ? (
                          <button
                            type="button"
                            onClick={() => room?.setController(null)}
                            className="rounded-md border border-red-200 bg-red-50 px-2 py-1 text-[11px] font-medium text-red-700 hover:bg-red-100"
                            title="Hủy quyền đi cờ của học viên này"
                          >
                            Hủy quyền ✕
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => room?.setController(peer.userId)}
                            className="rounded-md border border-gray-200 bg-white px-2 py-1 text-[11px] font-medium text-primary hover:bg-primary/10"
                            title="Cho phép học viên này thao tác trên bàn cờ"
                          >
                            Cho đi cờ ♟
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}

        {/* Chú thích quyền đi quân */}
        <div className="mt-2 rounded-lg bg-gray-50 p-2 text-[11px] text-text-muted">
          {isCoachOnly ? (
            <p>
              🛡️ <strong>Chế độ mặc định:</strong> Chỉ HLV phụ trách mới có quyền thao tác trên bàn
              cờ.
            </p>
          ) : (
            <p className="text-emerald-800">
              ♟️ Học viên{' '}
              <strong>
                {peers.find((p) => p.userId === currentController)?.name ?? 'được chọn'}
              </strong>{' '}
              đang có quyền đi quân trên bàn cờ chính.
            </p>
          )}
        </div>
      </div>
    </Card>
  );
}
