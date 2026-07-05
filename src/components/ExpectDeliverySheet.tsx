import { useEffect, useState } from 'react';
import type { Category, DeliveryItem, DeliveryKind, ISODate } from '../domain/types';
import { CATEGORIES, CATEGORY_LABELS } from '../domain/types';
import { addDays } from '../domain/dates';
import { categoryDefaultExpiry } from '../domain/deliveries';
import type { ParsedItem } from '../domain/parseDonation';
import { KNOWN_DONORS } from '../data/seed';
import { useStore } from '../store/useStore';
import { Sheet } from '../ui/Sheet';
import { Button, Chip, Field, Icon, Stepper, inputClass } from '../ui/primitives';
import { CaptureBar } from './CaptureBar';
import { cn } from '../ui/cn';

/**
 * Capture a delivery as a PROMISE — the 10-second phone-call manifest, before
 * the food arrives. Rough by design: name + rough count is enough. Expiry is
 * guessed from category here and VERIFIED at the dock. Creates an 'expected'
 * delivery that lands in Incoming.
 */
interface Row {
  id: string;
  name: string;
  category: Category;
  quantity: number;
  unit: string;
  /** Optional hint from capture ("good till tomorrow"); else the dock uses the
   *  category default. Carried through so the dock pre-fills it for verifying. */
  expiryDate?: ISODate;
}

const WHEN_CHIPS = [
  { label: 'Today', days: 0 },
  { label: 'Tomorrow', days: 1 },
  { label: 'In 2 days', days: 2 },
];

function blankRow(): Row {
  return { id: crypto.randomUUID(), name: '', category: 'other', quantity: 1, unit: 'units' };
}

export function ExpectDeliverySheet({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const { today, addDelivery } = useStore();
  const [donorName, setDonorName] = useState('');
  const [kind, setKind] = useState<DeliveryKind>('individual');
  const [expectedDate, setExpectedDate] = useState(today);
  const [note, setNote] = useState('');
  const [rows, setRows] = useState<Row[]>([blankRow()]);

  useEffect(() => {
    if (open) {
      setDonorName('');
      setKind('individual');
      setExpectedDate(today);
      setNote('');
      setRows([blankRow()]);
    }
  }, [open, today]);

  const validRows = rows.filter((r) => r.name.trim() !== '' && r.quantity > 0);
  const canSubmit = donorName.trim() !== '' && validRows.length > 0;

  function patch(id: string, p: Partial<Row>) {
    setRows((rs) => rs.map((r) => (r.id === id ? { ...r, ...p } : r)));
  }

  function applyCaptured(parsed: ParsedItem[]) {
    const captured: Row[] = parsed.map((p) => ({
      id: crypto.randomUUID(),
      name: p.name,
      category: p.category,
      quantity: p.quantity,
      unit: p.unit,
      expiryDate: p.expiryDate,
    }));
    setRows((rs) => {
      const kept = rs.filter((r) => r.name.trim() !== '');
      return [...kept, ...captured];
    });
  }

  function submit() {
    if (!canSubmit) return;
    const items: DeliveryItem[] = validRows.map((r) => ({
      id: crypto.randomUUID(),
      name: r.name.trim(),
      category: r.category,
      quantity: r.quantity,
      unit: r.unit.trim() || 'units',
      expiryDate: r.expiryDate ?? categoryDefaultExpiry(r.category, today),
    }));
    addDelivery({
      donorName: donorName.trim(),
      kind,
      expectedDate,
      note: note.trim() || undefined,
      items,
    });
    onClose();
  }

  return (
    <Sheet open={open} onClose={onClose} title="Expect a delivery">
      <div className="space-y-5">
        <CaptureBar today={today} onItems={applyCaptured} />

        <Field label="Donor">
          <input
            value={donorName}
            onChange={(e) => setDonorName(e.target.value)}
            placeholder="Who's donating?"
            className={cn(inputClass, 'mb-2')}
          />
          <div className="flex flex-wrap gap-2">
            {KNOWN_DONORS.map((donor) => (
              <Chip
                key={donor.name}
                selected={donorName === donor.name}
                onClick={() => {
                  setDonorName(donor.name);
                  setKind(donor.kind);
                }}
              >
                {donor.name}
              </Chip>
            ))}
          </div>
        </Field>

        <Field label="Arriving">
          <div className="flex flex-wrap items-center gap-2">
            {WHEN_CHIPS.map((w) => {
              const target = addDays(today, w.days);
              return (
                <Chip
                  key={w.label}
                  selected={expectedDate === target}
                  onClick={() => setExpectedDate(target)}
                >
                  {w.label}
                </Chip>
              );
            })}
            <input
              type="date"
              value={expectedDate}
              onChange={(e) => setExpectedDate(e.target.value)}
              className={cn(inputClass, 'h-11 w-40')}
            />
            <input
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="e.g. by 3pm"
              className={cn(inputClass, 'h-11 flex-1 min-w-[8rem]')}
            />
          </div>
        </Field>

        <Field label="What's coming (rough is fine)">
          <p className="mb-2 text-xs text-zinc-500">
            You'll verify exact counts and dates at the dock when it arrives.
          </p>
          <ul className="space-y-2">
            {rows.map((row) => (
              <li key={row.id} className="rounded-lg border border-zinc-200 p-2.5">
                <div className="flex items-center gap-2">
                  <input
                    value={row.name}
                    onChange={(e) => patch(row.id, { name: e.target.value })}
                    placeholder="Item name"
                    className={cn(inputClass, 'h-10 flex-1')}
                  />
                  {rows.length > 1 && (
                    <button
                      onClick={() => setRows((rs) => rs.filter((r) => r.id !== row.id))}
                      aria-label="Remove line"
                      className="shrink-0 rounded-md p-1.5 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-900"
                    >
                      <Icon name="x" size={16} />
                    </button>
                  )}
                </div>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <select
                    value={row.category}
                    onChange={(e) => patch(row.id, { category: e.target.value as Category })}
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
                    value={row.quantity}
                    min={1}
                    max={9999}
                    onChange={(n) => patch(row.id, { quantity: n })}
                    ariaLabel={`${row.name || 'Item'} quantity`}
                  />
                  <input
                    value={row.unit}
                    onChange={(e) => patch(row.id, { unit: e.target.value })}
                    aria-label="Unit"
                    className={cn(inputClass, 'h-9 w-24')}
                  />
                </div>
              </li>
            ))}
          </ul>
          <button
            onClick={() => setRows((rs) => [...rs, blankRow()])}
            className="mt-2 inline-flex items-center gap-1.5 text-sm font-medium text-zinc-600 hover:text-zinc-950"
          >
            <Icon name="plus" size={14} /> Add item
          </button>
        </Field>

        <div className="flex flex-wrap items-center gap-3 border-t border-zinc-100 pt-4">
          <Button size="lg" onClick={submit} disabled={!canSubmit}>
            <Icon name="inbox" size={16} /> Add to incoming
          </Button>
          {!canSubmit && (
            <span className="text-xs text-zinc-400">
              Add a donor and at least one item.
            </span>
          )}
        </div>
      </div>
    </Sheet>
  );
}
