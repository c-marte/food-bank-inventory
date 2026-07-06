import { useEffect, useState } from 'react';
import { daysUntil } from '../domain/dates';
import { getAvailability, validateRequestItems } from '../domain/distribution';
import { useStore } from '../store/useStore';
import { Sheet } from '../ui/Sheet';
import { Button, Chip, Field, Icon, Stepper } from '../ui/primitives';
import { fullDateLabel } from '../ui/format';
import { cn } from '../ui/cn';

/**
 * Log a request — a movement enters the pipeline BORN MATCHED (the caller told
 * us who they are). It still flows Pack → Handoff; nothing reserves stock
 * until the handoff commits (rule 2). Kitchens default to us delivering;
 * families default to picking up at the bank.
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
  const { lots, partners, today, config, addMovement } = useStore();
  const [recipientId, setRecipientId] = useState(partners[0]?.id ?? '');
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
      setRecipientId(partners[0]?.id ?? '');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, initialLotId, partners]);

  const availability = getAvailability(lots, today, config);
  const items = Object.entries(sel)
    .filter(([, q]) => q > 0)
    .map(([lotId, quantity]) => ({ lotId, quantity }));
  const totalUnits = items.reduce((s, i) => s + i.quantity, 0);

  const kitchens = partners.filter((p) => p.kind === 'meal_program');
  const families = partners.filter((p) => p.kind === 'family');

  function submit() {
    const err = validateRequestItems(items, lots, today, config);
    if (err) {
      setError(err);
      return;
    }
    const recipient = partners.find((p) => p.id === recipientId);
    addMovement({
      lines: items,
      packed: false,
      recipientId,
      // Default trip direction by recipient kind; adjustable at handoff.
      mode: recipient?.kind === 'meal_program' ? 'we_go' : 'they_come',
      note: 'requested',
    });
    onClose();
  }

  return (
    <Sheet open={open} onClose={onClose} title="Log a request">
      <div className="space-y-5">
        <Field label="Who's asking?">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <span className="eyebrow w-16 shrink-0 text-[10px] font-bold text-zinc-400">
                Kitchens
              </span>
              {kitchens.map((p) => (
                <Chip
                  key={p.id}
                  selected={recipientId === p.id}
                  onClick={() => setRecipientId(p.id)}
                >
                  {p.name}
                </Chip>
              ))}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="eyebrow w-16 shrink-0 text-[10px] font-bold text-zinc-400">
                Families
              </span>
              {families.map((p) => (
                <Chip
                  key={p.id}
                  selected={recipientId === p.id}
                  onClick={() => setRecipientId(p.id)}
                >
                  {p.name}
                </Chip>
              ))}
            </div>
          </div>
        </Field>

        <Field label="What they need">
          <p className="mb-2 text-xs text-zinc-500">
            Non-expired stock only, soonest expiry first. Nothing comes off the
            shelf until the handoff.
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
                          d <= 1
                            ? 'text-red-700'
                            : d <= config.expiringSoonWindowByTier[lot.tier]
                              ? 'text-amber-700'
                              : 'text-zinc-400',
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
                    ariaLabel={`Request ${lot.name}`}
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
            <Icon name="arrow" size={15} /> Add to pipeline
          </Button>
          <span className="nums text-xs text-zinc-500">
            {items.length === 0
              ? 'Select at least one lot.'
              : `${items.length} lot${items.length === 1 ? '' : 's'} · ${totalUnits} units · enters at Pack`}
          </span>
        </div>
      </div>
    </Sheet>
  );
}
