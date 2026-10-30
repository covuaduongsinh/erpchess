import { fetchMasterbasePgn, MASTERBASE_PAGE_SIZE } from '@erpchess/api';
import { useErpClient, useMasterbase } from '@erpchess/api/react';
import { masterbaseFilter } from '@erpchess/chess-core';
import { useState } from 'react';
import { useT } from '../../lib/use-t';
import { Button, Card, ErrorText, Spinner } from '../ui';

/**
 * Masterbase (Giai đoạn 23b): ván cao thủ, lọc theo thế cờ đang có trên bàn, ván dưới 20 nước,
 * Elo cả hai bên trên 2500. Chọn một ván để nạp vào bàn phân tích.
 */
export function MasterbasePanel({
  fen,
  onLoadPgn,
}: {
  fen: string;
  onLoadPgn: (pgn: string) => void;
}) {
  const { t } = useT();
  const client = useErpClient();
  const [byPosition, setByPosition] = useState(true);
  const [under20Moves, setUnder20Moves] = useState(false);
  const [elo2500, setElo2500] = useState(false);
  const [page, setPage] = useState(0);
  const [loadingId, setLoadingId] = useState<number | null>(null);
  const [loadError, setLoadError] = useState<unknown>(null);

  const filter = masterbaseFilter({ fen, byPosition, under20Moves, elo2500 });
  const query = useMasterbase({ ...filter, page });
  const total = query.data?.total ?? 0;
  const pages = Math.max(1, Math.ceil(total / MASTERBASE_PAGE_SIZE));
  // Đổi thế cờ hoặc bộ lọc thì về trang đầu
  const filterKey = `${filter.position}|${filter.maxPlies}|${filter.minElo}`;
  const [lastKey, setLastKey] = useState(filterKey);
  if (lastKey !== filterKey) {
    setLastKey(filterKey);
    setPage(0);
  }

  async function open(id: number) {
    setLoadingId(id);
    setLoadError(null);
    try {
      onLoadPgn(await fetchMasterbasePgn(client, id));
    } catch (err) {
      setLoadError(err);
    } finally {
      setLoadingId(null);
    }
  }

  const toggles: Array<[string, boolean, (v: boolean) => void]> = [
    [t('masterbase.byPosition'), byPosition, setByPosition],
    [t('masterbase.under20'), under20Moves, setUnder20Moves],
    [t('masterbase.elo2500'), elo2500, setElo2500],
  ];

  return (
    <Card title={t('masterbase.title')}>
      <div className="flex flex-wrap gap-1">
        {toggles.map(([label, on, set]) => (
          <button
            key={label}
            type="button"
            aria-pressed={on}
            onClick={() => set(!on)}
            className="rounded-full border border-text-muted/30 px-3 py-1 text-xs aria-pressed:border-primary aria-pressed:bg-primary aria-pressed:text-text-on-primary"
          >
            {label}
          </button>
        ))}
      </div>

      {query.isPending ? (
        <Spinner />
      ) : query.error ? (
        <ErrorText error={query.error} />
      ) : total === 0 ? (
        <p className="text-sm text-text-muted">{t('masterbase.none')}</p>
      ) : (
        <>
          <p className="text-xs text-text-muted">
            {t('masterbase.count', { count: total.toLocaleString() })}
          </p>
          <div className="-mx-2 overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="text-left text-text-muted">
                <tr>
                  <th className="px-2 py-1">{t('masterbase.white')}</th>
                  <th className="px-2 py-1">{t('masterbase.black')}</th>
                  <th className="px-2 py-1">{t('masterbase.result')}</th>
                  <th className="px-2 py-1">{t('masterbase.date')}</th>
                  <th className="px-2 py-1">ECO</th>
                </tr>
              </thead>
              <tbody>
                {query.data?.rows.map((g) => (
                  <tr key={g.id} className="border-t border-text-muted/10">
                    <td className="px-2 py-1">
                      <button
                        type="button"
                        onClick={() => void open(g.id)}
                        disabled={loadingId !== null}
                        title={t('masterbase.open')}
                        className="text-left text-primary hover:underline disabled:opacity-60"
                      >
                        {g.white || '?'}
                        {g.whiteElo ? ` (${g.whiteElo})` : ''}
                      </button>
                    </td>
                    <td className="px-2 py-1">
                      {g.black || '?'}
                      {g.blackElo ? ` (${g.blackElo})` : ''}
                    </td>
                    <td className="px-2 py-1 font-semibold">{g.result}</td>
                    <td className="px-2 py-1 whitespace-nowrap">{g.date}</td>
                    <td className="px-2 py-1">{g.eco}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex items-center justify-between gap-2">
            <Button
              variant="ghost"
              className="text-xs"
              disabled={page === 0 || query.isFetching}
              onClick={() => setPage((p) => p - 1)}
            >
              ◀
            </Button>
            <span className="text-xs text-text-muted">
              {t('masterbase.page', { page: page + 1, pages })}
            </span>
            <Button
              variant="ghost"
              className="text-xs"
              disabled={page + 1 >= pages || query.isFetching}
              onClick={() => setPage((p) => p + 1)}
            >
              ▶
            </Button>
          </div>
        </>
      )}
      <ErrorText error={loadError} />
      <p className="text-[11px] text-text-muted">{t('masterbase.license')}</p>
    </Card>
  );
}
