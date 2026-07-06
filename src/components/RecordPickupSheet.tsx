import { useEffect, useState } from 'react';
import { daysUntil } from '../domain/dates';
import {
  getPartnerAvailability,
  validateRequestItems,
} from '../domain/requests';
import { useStore } from '../store/useStore';
import { Sheet } from '../ui/Sheet';
import { Button, Chip, Field, Icon, Stepper } from '../ui/primitives';
import { fullDateLabel } from '../ui/format';
import { cn } from '../ui/cn';

/**
 * Staff records an incoming pickup request (partners call or text at this
 * scale — the pantry types). Creates a 'requested' PickupRequest that lands
 * in the Pickups queue; quantities only decrement at confirm (rule 2).
 * Availability = non-expired lots with quantity > 0, soonest expiry first,
 * each capped at what's on hand — straight from the domain layer.
 */
export function RecordPickupSheet({
  open,
  onClose,
  initialLotId,
}: {
  open: boolean;
  onClose: () => void;
  /** When set, that lot arrives pre-selected at its full on-hand quantity —
   *  the "send to partner" verb from the lot action sheet. */
  initialLotId?: string | null;
}) {
  const { lots, partners, today, config, createRequest } = useStore();
  const [partnerId, setPartnerId] = useState(partners[0]?.id ?? '');
  const [sel, setSel] = useState<Record<string, number>>({});
  const [error, setError] = useState<string | null>(null);

  // Fresh slate each time the sheet opens; prefill when launched from a lot.
  useEffect(() => {
    if (open) {
      const prefill = initialLotId
        ? lots.find((l) => l.id === initialLotId)
        : undefined;
      setSel(prefill && prefill.quantity > 0 ? { [prefill.id]: prefill.quantity } : {});
      setError(null);
      setPartnerId(partners[0]?.id ?? '');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, initialLotId, partners]);

  const availability = getPartnerAvailability(lots, today, config);
  const items = Object.entries(sel)
    .filter(([, q]) => q > 0)
    .map(([lotId, quantity]) => ({ lotId, quantity }));
  const totalUnits = items.reduce((s, i) => s + i.quantity, 0);

  function submit() {
    const err = validateRequestItems(items, lots, today, config);
    if (err) {
      setError(err);
      return;
    }
    createRequest(partnerId, items);
    onClose();
  }

  return (
    <Sheet open={open} onClose={onClose} title="Record a pickup request">
      <div className="space-y-5">
        <Field label="Partner">
          <div className="flex flex-wrap gap-2">
            {partners.map((p) => (
              <Chip
                key={p.id}
                selected={partnerId === p.id}
                onClick={() => setPartnerId(p.id)}
              >
                {p.name}
              </Chip>
            ))}
          </div>
        </Field>

        <Field label="Lots to pick up">
          <p className="mb-2 text-xs text-zinc-500">
            Non-expired stock only, soonest expiry first. Quantities are capped
            at what's on hand and come off the shelf when you confirm.
          </p>
          <ul className="divide-y divide-zinc-100 rounded-md border border-zinc-200">
            {availability.map((lot) => {
              const d = daysUntil(lot.expiryDate, today);
              const qty = sel[lot.id] ?? 0;
              return (
                <li
                  key={lot.id}
                  className={cn(
                    'flex flex-wrap items-center gap-x-3 gap-y-1.5 px-3 py-2',
                    qty > 0 && 'bg-zinc-50',
                  )}
                >
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-medium text-zinc-950">
                      {lot.name}
                    </div>
                    <div className="nums text-xs text-zinc-500">
                      exp {fullDateLabel(lot.expiryDate)}
                      <span
                        className={cn(
                          'ml-1.5 font-semibold',
                          d <= 1 ? 'text-red-700' : d <= config.expiringSoonWindowByTier[lot.tier] ? 'text-amber-700' : 'text-zinc-400',
                        )}
                      >
                        {d}d
                      </span>
                      <span className="ml-2 text-zinc-400">
                        {lot.quantity} {lot.unit} on hand
                      </span>
                    </div>
                  </div>
                  <Stepper
                    size="sm"
                    value={qty}
                    min={0}
                    max={lot.quantity}
                    onChange={(n) => {
                      setSel((prev) => ({ ...prev, [lot.id]: n }));
                      setError(null);
                    }}
                    ariaLabel={`Pick up ${lot.name}`}
                  />
                </li>
              );
            })}
          </ul>
        </Field>

        {error && (
          <p role="alert" className="text-sm font-medium text-red-700">
            {error}
          </p>
        )}

        <div className="flex flex-wrap items-center gap-3 border-t border-zinc-100 pt-4">
          <Button size="lg" onClick={submit} disabled={items.length === 0}>
            <Icon name="arrow" size={15} /> Add to pickups
          </Button>
          <span className="nums text-xs text-zinc-500">
            {items.length === 0
              ? 'Select at least one lot.'
              : `${items.length} lot${items.length === 1 ? '' : 's'} · ${totalUnits} units`}
          </span>
        </div>
      </div>
    </Sheet>
  );
}
