import { useMemo, useState } from 'react';
import type { Category, Config, InventoryLot, ISODate } from '../domain/types';
import { CATEGORY_LABELS } from '../domain/types';
import { daysUntil } from '../domain/dates';
import { getLotStatus } from '../domain/status';
import {
  FOOD_GROUPS,
  FOOD_GROUP_ICON,
  FOOD_GROUP_LABELS,
  foodGroupFor,
  type FoodGroup,
} from '../domain/foodGroups';
import { useStore } from '../store/useStore';
import { useUI } from '../store/useUI';
import { BetaPill, Card, Icon, SectionHeader, StatusBadge } from '../ui/primitives';
import { STATUS_META, fullDateLabel, shortDayLabel } from '../ui/format';
import { cn } from '../ui/cn';

/* ─────────────────────────────────────────────────────────
 * The three food groups (see domain/foodGroups.ts) drive this page's whole
 * layout: Hot foods and Canned foods get their own section regardless of
 * category; everything else (dairy, grains, protein, other, fresh produce)
 * is lower-urgency and shares one "Groceries or produce" catch-all. The
 * finer-grained category still shows per row (as an eyebrow tag) — this
 * groups by urgency, it doesn't erase the category information.
 * ───────────────────────────────────────────────────────── */

interface LotGroup {
  name: string;
  category: Category;
  foodGroup: FoodGroup;
  lots: InventoryLot[];
  totalInStock: number;
  urgency: number;
}

function buildGroups(
  lots: InventoryLot[],
  today: ISODate,
  config: Config,
  filter: FoodGroup | 'all',
  expiredOnly: boolean,
): LotGroup[] {
  let visible = filter === 'all' ? lots : lots.filter((l) => foodGroupFor(l) === filter);
  if (expiredOnly) {
    visible = visible.filter((l) => getLotStatus(l, today, config) === 'expired');
  }

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
    return {
      name,
      category: sorted[0].category,
      foodGroup: foodGroupFor(sorted[0]),
      lots: sorted,
      totalInStock,
      urgency,
    };
  });

  // Attention-worthy names float up; all-expired / empty groups sink.
  groups.sort((a, b) => a.urgency - b.urgency || a.name.localeCompare(b.name));
  return groups;
}

export function LotList() {
  const { lots, today, config } = useStore();
  const { openLot, expiredOnly, setExpiredOnly } = useUI();
  const [filter, setFilter] = useState<FoodGroup | 'all'>('all');

  const groups = useMemo(
    () => buildGroups(lots, today, config, filter, expiredOnly),
    [lots, today, config, filter, expiredOnly],
  );

  const totalLots =
    filter === 'all' ? lots.length : lots.filter((l) => foodGroupFor(l) === filter).length;

  const visibleGroups = filter === 'all' ? FOOD_GROUPS : [filter];

  return (
    <div className="space-y-4">
      <div>
        <div className="flex items-center gap-2">
          <h1 className="text-xl font-medium tracking-tight text-zinc-950">Inventory</h1>
          <BetaPill />
        </div>
        <p className="mt-0.5 text-sm text-zinc-500">
          Every lot on the shelf, grouped by handling urgency. Same-name lots
          from different donations are never merged — expiry dates differ.
        </p>
      </div>

      {/* Full-width pixel-art hero, matching the Intake page's treatment. */}
      <div className="overflow-hidden rounded-xl ring-1 ring-zinc-200">
        <img
          src="/inventory-hero.webp"
          alt="Illustration of a stocked shelving unit with a ladder"
          className="h-32 w-full object-cover object-[center_38%] sm:h-44"
        />
      </div>

      <Card className="p-4 sm:p-5">
        <SectionHeader>Full inventory</SectionHeader>

        {/* Filters: status first (the triage "expired" path lands here), then
            the three food groups. */}
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
          {FOOD_GROUPS.map((g) => (
            <FilterChip key={g} active={filter === g} onClick={() => setFilter(g)}>
              {FOOD_GROUP_LABELS[g]}
            </FilterChip>
          ))}
        </div>

        <div className="mt-4 space-y-5">
          {visibleGroups.map((g) => {
            const groupItems = groups.filter((lg) => lg.foodGroup === g);
            return (
              <div key={g}>
                <SectionHeader
                  right={<span className="nums text-xs text-zinc-400">{groupItems.length}</span>}
                >
                  <span className="inline-flex items-center gap-1.5">
                    {FOOD_GROUP_LABELS[g]}
                    <Icon name={FOOD_GROUP_ICON[g]} size={14} className="text-zinc-500" />
                  </span>
                </SectionHeader>

                {/* Indented under the header — only the group headers stay
                    left-aligned, so the three sections read as the page's
                    real structure and everything else is clearly nested
                    under one of them. */}
                <div className="mt-2.5 divide-y divide-zinc-100 pl-4">
                  {groupItems.length === 0 ? (
                    <p className="py-3 text-sm text-zinc-500">Nothing in this group.</p>
                  ) : (
                    groupItems.map((group) => (
                      <div key={group.name} className="py-2.5">
                        <div className="flex items-baseline justify-between gap-2">
                          <div className="flex min-w-0 items-baseline gap-2">
                            {/* Downgraded on purpose — the item name is the
                                least urgent fact in this row; status/expiry
                                (in each LotRow below) is what a shelf-keeper
                                actually needs first. */}
                            <span className="truncate text-xs font-medium text-zinc-500">
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
              </div>
            );
          })}
        </div>

        <p className="mt-3 border-t border-zinc-100 pt-3 text-xs text-zinc-400">
          {totalLots} lots · one row per donation — same-name lots are never merged.
        </p>
      </Card>
    </div>
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
