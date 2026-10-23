import { formatScore, type Score, whiteWinPercent } from '@erpchess/engine';

/** Thanh đánh giá dọc: phần trắng = cơ hội thắng của Trắng, đặt theo hướng nhìn bàn cờ. */
export function EvalBar({
  score,
  orientation,
  label,
}: {
  score: Score | null;
  orientation: 'w' | 'b';
  label: string;
}) {
  const white = score ? whiteWinPercent(score) : 50;
  const text = score ? formatScore(score) : '…';
  return (
    <div className="relative w-6">
      {/* Cho trình đọc màn hình; phần vẽ bên dưới chỉ để nhìn */}
      <meter
        className="sr-only"
        aria-label={label}
        aria-valuetext={text}
        min={0}
        max={100}
        value={white}
      />
      <div
        aria-hidden
        className={`flex h-full overflow-hidden rounded-sm bg-text ${
          orientation === 'w' ? 'flex-col-reverse' : 'flex-col'
        }`}
      >
        <div
          className="bg-white transition-[height] duration-300"
          style={{ height: `${white}%` }}
        />
        <span
          className={`absolute left-0 w-full text-center text-[10px] font-bold ${
            white >= 50 ? 'text-text' : 'text-white'
          } ${(white >= 50) === (orientation === 'w') ? 'bottom-1' : 'top-1'}`}
        >
          {text.replace(/^\+/, '')}
        </span>
      </div>
    </div>
  );
}
