import { useMemo, useState } from 'react';
import type { Category, Config, InventoryLot, ISODate } from '../domain/types';
import { CATEGORIES, CATEGORY_LABELS } from '../domain/types';
import { daysUntil } from '../domain/dates';
import { getLotStatus } from '../domain/status';
import { useStore } from '../store/useStore';
import { useUI } from '../store/useUI';
import { Card, Icon, SectionHeader, StatusBadge, TierMark } from '../ui/primitives';
import { STATUS_META, fullDateLabel, shortDayLabel } from '../ui/format';
import { cn } from '../ui/cn';

interface LotGroup {
  name: string;
  category: Category;
  lots: InventoryLot[];
  totalInStock: number;
  urgency: number;
}

function buildGroups(
  lots: InventoryLot[],
  today: ISODate,
  config: Config,
  filter: Category | 'all',
  showEmpty: boolean,
  expiredOnly: boolean,
): LotGroup[] {
  let visible = filter === 'all' ? lots : lots.filter((l) => l.category === filter);
  if (expiredOnly) {
    visible = visible.filter((l) => getLotStatus(l, today, config) === 'expired');
  }
  if (!showEmpty) visible = visible.filter((l) => l.quantity > 0);

  const byName = new Map<string, InventoryLot[]>();
  for (const lot of visible) {
    const arr = byName.get(lot.name) ?? [];
    arr.push(lot);
    byName.set(lot.name, arr);
  }

  const groups: LotGroup[] = [...byName.entries()].map(([name, ls]) => {
    const sorted = [...ls].sort(
      (a, b) => a.expiryDate.localeCompare(b.expiryDate) || a.id.localeCompare(b.id),
    );
    const totalInStock = sorted
      .filter((l) => getLotStatus(l, today, config) !== 'expired')
      .reduce((sum, l) => sum + l.quantity, 0);
    const actionable = sorted.filter(
      (l) => l.quantity > 0 && getLotStatus(l, today, config) !== 'expired',
    );
    const urgency = actionable.length
      ? daysUntil(actionable[0].expiryDate, today)
      : Infinity;
    return { name, category: sorted[0].category, lots: sorted, totalInStock, urgency };
  });

  // Attention-worthy names float up; all-expired / empty groups sink.
  groups.sort((a, b) => a.urgency - b.urgency || a.name.localeCompare(b.name));
  return groups;
}

export function LotList() {
  const { lots, today, config } = useStore();
  const { openLot, expiredOnly, setExpiredOnly } = useUI();
  const [filter, setFilter] = useState<Category | 'all'>('all');
  const [showEmpty, setShowEmpty] = useState(true);

  const groups = useMemo(
    () => buildGroups(lots, today, config, filter, showEmpty, expiredOnly),
    [lots, today, config, filter, showEmpty, expiredOnly],
  );

  const totalLots = filter === 'all' ? lots.length : lots.filter((l) => l.category === filter).length;

  return (
    <Card className="p-4 sm:p-5">
      <SectionHeader
        right={
          <button
            onClick={() => setShowEmpty((v) => !v)}
            className="inline-flex items-center gap-1.5 text-xs font-medium text-zinc-500 hover:text-zinc-800"
          >
            <span
              className={cn(
                'flex h-4 w-4 items-center justify-center rounded border',
                showEmpty ? 'border-zinc-950 bg-zinc-950 text-white' : 'border-zinc-300',
              )}
            >
              {showEmpty ? <Icon name="check" size={11} /> : null}
            </span>
            Show empty
          </button>
        }
      >
        Full inventory
      </SectionHeader>

      {/* Filters: status first (the triage "expired" path lands here), then category. */}
      <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
        <button
          onClick={() => setExpiredOnly(!expiredOnly)}
          aria-pressed={expiredOnly}
          className={cn(
            'inline-flex h-8 shrink-0 items-center gap-1.5 rounded-full border px-3 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-950',
            expiredOnly
              ? 'border-red-600 bg-red-600 text-white'
              : 'border-red-200 bg-white text-red-700 hover:border-red-400',
          )}
        >
          <Icon name="x" size={12} /> Expired only
        </button>
        <span className="my-1 w-px shrink-0 bg-zinc-200" aria-hidden />
        <FilterChip active={filter === 'all'} onClick={() => setFilter('all')}>
          All
        </FilterChip>
        {CATEGORIES.map((c) => (
          <FilterChip key={c} active={filter === c} onClick={() => setFilter(c)}>
            {CATEGORY_LABELS[c]}
          </FilterChip>
        ))}
      </div>

      <div className="mt-1 divide-y divide-zinc-100">
        {groups.length === 0 ? (
          <p className="py-6 text-sm text-zinc-500">No lots in this category.</p>
        ) : (
          groups.map((group) => (
            <div key={group.name} className="py-2.5">
              <div className="flex items-baseline justify-between gap-2">
                <div className="flex min-w-0 items-baseline gap-2">
                  <span className="truncate font-semibold text-zinc-950">
                    {group.name}
                  </span>
                  <span className="eyebrow text-[10px] text-zinc-400">
                    {CATEGORY_LABELS[group.category]}
                  </span>
                </div>
                <span className="nums shrink-0 text-xs text-zinc-500">
                  {group.totalInStock} in stock
                  {group.lots.length > 1 ? ` · ${group.lots.length} lots` : ''}
                </span>
              </div>

              <ul className="mt-1.5 space-y-0.5">
                {group.lots.map((lot) => (
                  <LotRow
                    key={lot.id}
                    lot={lot}
                    today={today}
                    config={config}
                    onOpen={() => openLot(lot.id)}
                  />
                ))}
              </ul>
            </div>
          ))
        )}
      </div>

      <p className="mt-3 border-t border-zinc-100 pt-3 text-xs text-zinc-400">
        {totalLots} lots · one row per donation — same-name lots are never merged.
      </p>
    </Card>
  );
}

function FilterChip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        'h-8 shrink-0 rounded-full border px-3 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-950',
        active
          ? 'border-zinc-950 bg-zinc-950 text-white'
          : 'border-zinc-300 bg-white text-zinc-600 hover:border-zinc-500',
      )}
    >
      {children}
    </button>
  );
}

function LotRow({
  lot,
  today,
  config,
  onOpen,
}: {
  lot: InventoryLot;
  today: ISODate;
  config: Config;
  onOpen: () => void;
}) {
  const status = getLotStatus(lot, today, config);
  const d = daysUntil(lot.expiryDate, today);
  const empty = lot.quantity === 0;

  // The whole row opens the lot's verb layer — send / waste / adjust all live
  // in the one action sheet, same as everywhere else in the app.
  return (
    <li>
      <button
        onClick={onOpen}
        className={cn(
          'group flex w-full items-center gap-2.5 rounded-md px-2 py-1.5 text-left transition-colors hover:bg-zinc-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-950',
          empty && 'opacity-55',
        )}
        aria-label={`${lot.name}, ${empty ? 'empty' : `${lot.quantity} ${lot.unit}`}. Open actions.`}
      >
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <StatusBadge status={status} />
            <TierMark tier={lot.tier} size={13} />
            <span className="nums text-[13px] text-zinc-500">
              exp {fullDateLabel(lot.expiryDate)}
              <span className={cn('ml-1.5 font-semibold', STATUS_META[status].text)}>
                {shortDayLabel(d)}
              </span>
            </span>
          </div>
          <div className="nums mt-1 text-xs text-zinc-500">
            {empty ? (
              <span className="text-zinc-400">0 remaining</span>
            ) : (
              <>
                {lot.quantity} <span className="text-zinc-400">{lot.unit}</span>
              </>
            )}
          </div>
        </div>
        <Icon
          name="chevron"
          size={15}
          className="shrink-0 text-zinc-200 transition-colors group-hover:text-zinc-500"
        />
      </button>
    </li>
  );
}
