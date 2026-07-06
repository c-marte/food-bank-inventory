import { useEffect, useState } from 'react';
import type { Category, DeliveryItem, PerishTier } from '../domain/types';
import { CATEGORIES, CATEGORY_LABELS, TIERS, TIER_LABELS } from '../domain/types';
import { makeDeliveryItem } from '../domain/deliveries';
import { useStore } from '../store/useStore';
import { Sheet } from '../ui/Sheet';
import { Button, Icon, Stepper, TierChip, inputClass } from '../ui/primitives';
import { weekdayDateLabel } from '../ui/format';
import { cn } from '../ui/cn';

/**
 * The dock — the one human checkpoint. The promise is pre-loaded, but the
 * category was inferred silently and the date is only a guess. Both render
 * with a visible GUESSED marker until the volunteer confirms them (or edits
 * them, which confirms implicitly) — so the checkpoint is something you can
 * SEE, not just something the architecture claims exists. Confirm CREATES one
 * new lot per line (rule 1).
 */
interface DockItem extends DeliveryItem {
  categoryGuessed: boolean;
  expiryGuessed: boolean;
}

function toDockItem(it: DeliveryItem): DockItem {
  // Every promised line arrives with an inferred category and a guessed date —
  // neither has been checked against the physical item yet.
  return { ...it, categoryGuessed: true, expiryGuessed: true };
}

export function ReceiveDeliverySheet({
  deliveryId,
  open,
  onClose,
}: {
  deliveryId: string | null;
  open: boolean;
  onClose: () => void;
}) {
  const { deliveries, today, receiveDelivery } = useStore();
  const delivery = deliveryId ? deliveries.find((d) => d.id === deliveryId) : undefined;
  const [items, setItems] = useState<DockItem[]>([]);

  useEffect(() => {
    if (open && delivery) {
      setItems(delivery.items.map(toDockItem));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, deliveryId]);

  if (!delivery) return null;

  const kept = items.filter((it) => it.name.trim() !== '' && it.quantity > 0);
  const unconfirmed = kept.reduce(
    (n, it) => n + (it.categoryGuessed ? 1 : 0) + (it.expiryGuessed ? 1 : 0),
    0,
  );

  function patch(id: string, p: Partial<DockItem>) {
    setItems((its) => its.map((it) => (it.id === id ? { ...it, ...p } : it)));
  }

  function confirm() {
    receiveDelivery(delivery!.id, items);
    onClose();
  }

  return (
    <Sheet open={open} onClose={onClose} title={`Receive · ${delivery.donorName}`}>
      <div className="space-y-4">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-zinc-500">
          <span className="inline-flex items-center gap-1.5">
            <Icon name="clock" size={14} />
            {weekdayDateLabel(delivery.expectedDate)}
          </span>
          {delivery.note && <span className="text-zinc-400">· {delivery.note}</span>}
        </div>

        <div className="rounded-lg border border-amber-200 bg-amber-50/60 px-3 py-2 text-xs text-amber-800">
          Check counts against the dock, and{' '}
          <b>verify each best-before date against the printed label</b>. Amber
          fields are only guesses — confirm or correct each one. Toss anything
          unusable before receiving.
        </div>

        <ul className="space-y-2">
          {items.map((it) => (
            <li key={it.id} className="rounded-xl border border-zinc-200 p-3">
              <div className="flex items-center gap-2">
                <TierChip tier={it.tier} size={32} />
                <input
                  value={it.name}
                  onChange={(e) => patch(it.id, { name: e.target.value })}
                  className={cn(inputClass, 'h-9 flex-1')}
                  aria-label="Item name"
                />
                <button
                  onClick={() => setItems((its) => its.filter((x) => x.id !== it.id))}
                  aria-label={`Toss ${it.name}`}
                  title="Toss — don't log this"
                  className="shrink-0 rounded-md p-1.5 text-zinc-400 hover:bg-red-50 hover:text-red-600"
                >
                  <Icon name="trash" size={16} />
                </button>
              </div>

              <div className="mt-2 flex flex-wrap items-center gap-2">
                <GuessWrap guessed={it.categoryGuessed}>
                  <select
                    value={it.category}
                    onChange={(e) =>
                      patch(it.id, {
                        category: e.target.value as Category,
                        categoryGuessed: false,
                      })
                    }
                    className={cn(
                      'h-9 rounded-md border bg-white px-2 text-sm text-zinc-800 outline-none focus:border-zinc-950',
                      it.categoryGuessed ? 'border-amber-300' : 'border-zinc-300',
                    )}
                  >
                    {CATEGORIES.map((c) => (
                      <option key={c} value={c}>
                        {CATEGORY_LABELS[c]}
                      </option>
                    ))}
                  </select>
                  {it.categoryGuessed && (
                    <ConfirmButton
                      label="Category looks right"
                      onClick={() => patch(it.id, { categoryGuessed: false })}
                    />
                  )}
                </GuessWrap>

                <select
                  value={it.tier}
                  onChange={(e) => patch(it.id, { tier: e.target.value as PerishTier })}
                  aria-label="Handling"
                  className="h-9 rounded-md border border-zinc-300 bg-white px-2 text-sm text-zinc-800 outline-none focus:border-zinc-950"
                >
                  {TIERS.map((t) => (
                    <option key={t} value={t}>
                      {TIER_LABELS[t]}
                    </option>
                  ))}
                </select>

                <Stepper
                  size="sm"
                  value={it.quantity}
                  min={0}
                  max={9999}
                  onChange={(n) => patch(it.id, { quantity: n })}
                  ariaLabel={`${it.name} count`}
                />
                <input
                  value={it.unit}
                  onChange={(e) => patch(it.id, { unit: e.target.value })}
                  aria-label="Unit"
                  className={cn(inputClass, 'h-9 w-24')}
                />
              </div>

              <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
                <span
                  className={cn(
                    'eyebrow inline-flex items-center gap-1 font-bold',
                    it.expiryGuessed ? 'text-amber-700' : 'text-emerald-700',
                  )}
                >
                  <Icon name={it.expiryGuessed ? 'alert' : 'check'} size={12} />
                  Best-before
                </span>
                <input
                  type="date"
                  value={it.expiryDate}
                  onChange={(e) =>
                    patch(it.id, { expiryDate: e.target.value, expiryGuessed: false })
                  }
                  className={cn(
                    inputClass,
                    'h-9 w-44',
                    it.expiryGuessed
                      ? 'border-amber-300 focus:border-amber-500'
                      : 'border-emerald-300 focus:border-emerald-500',
                  )}
                  aria-label={`${it.name} best-before date`}
                />
                {it.expiryGuessed ? (
                  <ConfirmButton
                    label="Date checks out"
                    onClick={() => patch(it.id, { expiryGuessed: false })}
                  />
                ) : (
                  <span className="text-zinc-400">verified</span>
                )}
              </div>
            </li>
          ))}
        </ul>

        <button
          onClick={() =>
            setItems((its) => [
              ...its,
              {
                ...makeDeliveryItem(today, () => crypto.randomUUID()),
                categoryGuessed: false,
                expiryGuessed: false,
              },
            ])
          }
          className="inline-flex items-center gap-1.5 text-sm font-medium text-zinc-600 hover:text-zinc-950"
        >
          <Icon name="plus" size={14} /> Add a surprise item
        </button>

        <div className="flex flex-wrap items-center gap-3 border-t border-zinc-100 pt-4">
          <Button size="lg" onClick={confirm} disabled={kept.length === 0}>
            <Icon name="check" size={16} /> Receive {kept.length} lot
            {kept.length === 1 ? '' : 's'}
          </Button>
          <span className="text-xs text-zinc-400">
            {unconfirmed > 0
              ? `${unconfirmed} guessed field${unconfirmed === 1 ? '' : 's'} still unconfirmed`
              : 'Everything verified'}
          </span>
        </div>
      </div>
    </Sheet>
  );
}

/** Wraps a guessed control so the amber ring reads as one unit with its
 *  confirm affordance, instead of two disconnected controls. */
function GuessWrap({ guessed, children }: { guessed: boolean; children: React.ReactNode }) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-md',
        guessed && 'ring-1 ring-amber-200',
      )}
    >
      {children}
    </span>
  );
}

function ConfirmButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      title={label}
      aria-label={label}
      className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md text-amber-600 hover:bg-amber-100"
    >
      <Icon name="check" size={16} />
    </button>
  );
}
