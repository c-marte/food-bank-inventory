import { useEffect, useState } from 'react';
import type { Category, DeliveryItem } from '../domain/types';
import { CATEGORIES, CATEGORY_LABELS } from '../domain/types';
import { makeDeliveryItem } from '../domain/deliveries';
import { useStore } from '../store/useStore';
import { Sheet } from '../ui/Sheet';
import { Button, Icon, Stepper, inputClass } from '../ui/primitives';
import { foodEmoji } from '../ui/foodEmoji';
import { weekdayDateLabel } from '../ui/format';
import { cn } from '../ui/cn';

/**
 * The dock — the one human checkpoint. The promise is pre-loaded; the volunteer
 * verifies counts against what's physically here, verifies the printed
 * best-before date (the app's guess is only a guess), tosses anything
 * unusable, adds surprises, then confirms. Confirm CREATES one new lot per
 * line (rule 1). "Automate the transcription, keep the human at verification."
 */
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
  const [items, setItems] = useState<DeliveryItem[]>([]);

  useEffect(() => {
    if (open && delivery) {
      // Local editable copy — nothing commits until confirm.
      setItems(delivery.items.map((it) => ({ ...it })));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, deliveryId]);

  if (!delivery) return null;

  const kept = items.filter((it) => it.name.trim() !== '' && it.quantity > 0);

  function patch(id: string, p: Partial<DeliveryItem>) {
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
          <b>verify each best-before date against the printed label</b>. Toss
          anything unusable before confirming.
        </div>

        <ul className="space-y-2">
          {items.map((it) => (
            <li key={it.id} className="rounded-xl border border-zinc-200 p-3">
              <div className="flex items-center gap-2">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-zinc-50 text-lg ring-1 ring-zinc-200">
                  {foodEmoji(it.name)}
                </span>
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
                <select
                  value={it.category}
                  onChange={(e) => patch(it.id, { category: e.target.value as Category })}
                  className="h-9 rounded-md border border-zinc-300 bg-white px-2 text-sm text-zinc-800 outline-none focus:border-zinc-950"
                >
                  {CATEGORIES.map((c) => (
                    <option key={c} value={c}>
                      {CATEGORY_LABELS[c]}
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

              <label className="mt-2 flex flex-wrap items-center gap-2 text-xs">
                <span className="eyebrow inline-flex items-center gap-1 font-bold text-amber-700">
                  <Icon name="alert" size={12} /> Best-before
                </span>
                <input
                  type="date"
                  value={it.expiryDate}
                  onChange={(e) => patch(it.id, { expiryDate: e.target.value })}
                  className={cn(inputClass, 'h-9 w-44 border-amber-300 focus:border-amber-500')}
                  aria-label={`${it.name} best-before date`}
                />
                <span className="text-zinc-400">check the label</span>
              </label>
            </li>
          ))}
        </ul>

        <button
          onClick={() =>
            setItems((its) => [
              ...its,
              makeDeliveryItem(today, () => crypto.randomUUID()),
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
            Creates {kept.length === 0 ? 'no' : kept.length} new lot
            {kept.length === 1 ? '' : 's'} on the shelf.
          </span>
        </div>
      </div>
    </Sheet>
  );
}
