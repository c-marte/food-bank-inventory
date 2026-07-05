import { useMemo, useState } from 'react';
import type { Category, LotStatus } from '../domain/types';
import { CATEGORIES, CATEGORY_LABELS } from '../domain/types';
import { addDays, daysUntil } from '../domain/dates';
import { getLotStatus } from '../domain/status';
import { useStore } from '../store/useStore';
import {
  Button,
  Chip,
  Field,
  Icon,
  StatusBadge,
  Stepper,
  inputClass,
} from '../ui/primitives';
import { fullDateLabel, shortDayLabel } from '../ui/format';
import { cn } from '../ui/cn';

const UNIT_CHIPS = ['cans', 'boxes', 'bags', 'lbs', 'gallons', 'units'];
const EXPIRY_CHIPS: { label: string; days: number }[] = [
  { label: '+3d', days: 3 },
  { label: '+1wk', days: 7 },
  { label: '+2wk', days: 14 },
  { label: '+1mo', days: 30 },
  { label: '+6mo', days: 180 },
  { label: '+1yr', days: 365 },
];

interface AddedSummary {
  name: string;
  quantity: number;
  unit: string;
  expiryDate: string;
  status: LotStatus;
}

/** The intake form, rendered inside the Log-donation sheet. Every submit
 *  creates a NEW lot (rule 1) and the dashboard updates behind the sheet.
 *  Stays open after a submit so several donations can be logged in a row. */
export function IntakeForm({ onDone }: { onDone?: () => void }) {
  const { addDonation, today, config } = useStore();

  const [name, setName] = useState('');
  const [category, setCategory] = useState<Category | null>(null);
  const [quantity, setQuantity] = useState(1);
  const [unit, setUnit] = useState('units');
  const [received, setReceived] = useState(today);
  const [expiry, setExpiry] = useState('');
  const [added, setAdded] = useState<AddedSummary | null>(null);
  const [sessionCount, setSessionCount] = useState(0);

  const expiryDays = expiry ? daysUntil(expiry, today) : null;
  const pastExpiry = expiryDays !== null && expiryDays < 0;
  const previewStatus = useMemo(() => {
    if (!expiry) return null;
    return getLotStatus(
      { id: '', name, category: category ?? 'other', quantity, unit, receivedDate: received, expiryDate: expiry },
      today,
      config,
    );
  }, [expiry, name, category, quantity, unit, received, today, config]);

  const canSubmit = name.trim().length > 0 && category !== null && quantity > 0 && expiry !== '';

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit || !category) return;

    const cleanUnit = unit.trim() || 'units';
    addDonation({
      name: name.trim(),
      category,
      quantity,
      unit: cleanUnit,
      receivedDate: received,
      expiryDate: expiry,
    });

    setAdded({
      name: name.trim(),
      quantity,
      unit: cleanUnit,
      expiryDate: expiry,
      status: getLotStatus(
        { id: '', name, category, quantity, unit: cleanUnit, receivedDate: received, expiryDate: expiry },
        today,
        config,
      ),
    });
    setSessionCount((n) => n + 1);

    // Reset for the next donation. Keep unit as a sensible sticky default.
    setName('');
    setCategory(null);
    setQuantity(1);
    setReceived(today);
    setExpiry('');
  }

  return (
    <div>
      <p className="mb-4 text-sm text-zinc-500">
        Every donation is saved as its own lot with its own expiry date.
        {sessionCount > 0 && (
          <span className="text-zinc-700">
            {' '}
            You've logged {sessionCount} this session.
          </span>
        )}
      </p>

      {added && (
        <div
          role="status"
          aria-live="polite"
          className="mb-4 flex items-start gap-3 rounded-lg border border-emerald-300 bg-emerald-50 px-4 py-3"
        >
          <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-600 text-white">
            <Icon name="check" size={13} />
          </span>
          <p className="flex-1 text-sm text-emerald-900">
            Added{' '}
            <span className="font-semibold">
              {added.quantity} {added.unit} of {added.name}
            </span>
            , expiring {fullDateLabel(added.expiryDate)}.{' '}
            <span className="inline-flex translate-y-0.5">
              <StatusBadge status={added.status} />
            </span>
          </p>
          <button
            onClick={() => setAdded(null)}
            aria-label="Dismiss"
            className="-m-1 shrink-0 rounded p-1 text-emerald-500 hover:text-emerald-800"
          >
            <Icon name="x" size={16} />
          </button>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-5">
        <Field label="Food name" htmlFor="name">
          <input
            id="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Canned black beans"
            autoComplete="off"
            className={inputClass}
          />
        </Field>

        <Field label="Category">
          <div className="flex flex-wrap gap-2">
            {CATEGORIES.map((c) => (
              <Chip
                key={c}
                selected={category === c}
                onClick={() => setCategory(c)}
              >
                {CATEGORY_LABELS[c]}
              </Chip>
            ))}
          </div>
        </Field>

        <div className="flex flex-wrap items-start gap-x-8 gap-y-5">
          <Field label="Quantity">
            <Stepper
              value={quantity}
              min={1}
              max={9999}
              onChange={setQuantity}
              ariaLabel="Quantity"
            />
          </Field>

          <Field label="Unit">
            <div className="flex flex-wrap items-center gap-2">
              <input
                value={unit}
                onChange={(e) => setUnit(e.target.value)}
                className={cn(inputClass, 'h-11 w-28')}
                aria-label="Unit"
              />
              <div className="flex flex-wrap gap-1.5">
                {UNIT_CHIPS.map((u) => (
                  <button
                    key={u}
                    type="button"
                    onClick={() => setUnit(u)}
                    className={cn(
                      'h-8 rounded-full border px-2.5 text-xs font-medium transition-colors',
                      unit === u
                        ? 'border-zinc-950 bg-zinc-950 text-white'
                        : 'border-zinc-300 text-zinc-600 hover:border-zinc-500',
                    )}
                  >
                    {u}
                  </button>
                ))}
              </div>
            </div>
          </Field>
        </div>

        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
          <Field label="Received date" htmlFor="received">
            <input
              id="received"
              type="date"
              value={received}
              onChange={(e) => setReceived(e.target.value)}
              className={inputClass}
            />
          </Field>

          <Field label="Expiry date" htmlFor="expiry">
            <input
              id="expiry"
              type="date"
              value={expiry}
              onChange={(e) => setExpiry(e.target.value)}
              className={cn(inputClass, pastExpiry && 'border-red-400 focus:border-red-500')}
            />
          </Field>
        </div>

        {/* Relative quick-set for expiry — the speed lever. */}
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="eyebrow mr-1 text-[11px] font-semibold text-zinc-400">
            Quick set
          </span>
          {EXPIRY_CHIPS.map((c) => {
            const target = addDays(today, c.days);
            return (
              <button
                key={c.label}
                type="button"
                onClick={() => setExpiry(target)}
                className={cn(
                  'nums h-8 rounded-full border px-2.5 text-xs font-medium transition-colors',
                  expiry === target
                    ? 'border-zinc-950 bg-zinc-950 text-white'
                    : 'border-zinc-300 text-zinc-600 hover:border-zinc-500',
                )}
              >
                {c.label}
              </button>
            );
          })}
        </div>

        {/* Live status preview + past-date warning */}
        {previewStatus && expiryDays !== null && (
          <div className="flex items-center gap-2 text-sm">
            <span className="text-zinc-500">This lot will be</span>
            <StatusBadge status={previewStatus} />
            <span className="nums text-zinc-500">
              ({shortDayLabel(expiryDays)})
            </span>
          </div>
        )}
        {pastExpiry && (
          <p
            role="alert"
            className="flex items-center gap-2 rounded-md border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-800"
          >
            <Icon name="alert" size={15} className="shrink-0 text-red-600" />
            This date is in the past — this lot will show as expired.
          </p>
        )}

        <div className="flex flex-wrap items-center gap-3 border-t border-zinc-100 pt-4">
          <Button type="submit" size="lg" disabled={!canSubmit}>
            <Icon name="plus" size={16} /> Add donation
          </Button>
          {onDone && (
            <Button type="button" variant="outline" size="lg" onClick={onDone}>
              Done
            </Button>
          )}
          {!canSubmit && (
            <span className="text-xs text-zinc-400">
              Name, category, and expiry are required.
            </span>
          )}
        </div>
      </form>
    </div>
  );
}
