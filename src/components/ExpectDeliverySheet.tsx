import { useEffect, useState } from 'react';
import type {
  DeliveryItem,
  DeliveryKind,
  ISODate,
  TransportMode,
} from '../domain/types';
import { addDays } from '../domain/dates';
import { categoryDefaultExpiry } from '../domain/deliveries';
import { guessCategory, type ParsedItem } from '../domain/parseDonation';
import { inferTier } from '../domain/tier';
import { KNOWN_DONORS } from '../data/seed';
import { useStore } from '../store/useStore';
import { Sheet } from '../ui/Sheet';
import { Button, Chip, Field, Icon, Stepper, TeamAvatar, inputClass } from '../ui/primitives';
import { CaptureBar } from './CaptureBar';
import { cn } from '../ui/cn';

/**
 * Capture a delivery as a PROMISE — the 10-second phone-call manifest, before
 * the food arrives. Genuinely rough: just name + count. Category is inferred
 * silently (never asked here); expiry is guessed from category. Precision —
 * confirming the category, verifying the printed date — happens ONCE, at the
 * dock, not twice. Creates an 'expected' delivery that lands in Incoming.
 */
interface Row {
  id: string;
  name: string;
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
  return { id: crypto.randomUUID(), name: '', quantity: 1, unit: 'units' };
}

export function ExpectDeliverySheet({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const { today, team, addDelivery } = useStore();
  const [donorName, setDonorName] = useState('');
  const [kind, setKind] = useState<DeliveryKind>('individual');
  const [expectedDate, setExpectedDate] = useState(today);
  const [mode, setMode] = useState<TransportMode>('they_come');
  const [assigneeId, setAssigneeId] = useState<string | undefined>();
  const [note, setNote] = useState('');
  const [estimatedWindow, setEstimatedWindow] = useState('');
  const [latestWindow, setLatestWindow] = useState('');
  const [rows, setRows] = useState<Row[]>([blankRow()]);

  useEffect(() => {
    if (open) {
      setDonorName('');
      setKind('individual');
      setExpectedDate(today);
      setMode('they_come');
      setAssigneeId(undefined);
      setNote('');
      setEstimatedWindow('');
      setLatestWindow('');
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
    const items: DeliveryItem[] = validRows.map((r) => {
      const category = guessCategory(r.name);
      return {
        id: crypto.randomUUID(),
        name: r.name.trim(),
        category,
        tier: inferTier(r.name, category),
        quantity: r.quantity,
        unit: r.unit.trim() || 'units',
        expiryDate: r.expiryDate ?? categoryDefaultExpiry(category, today),
      };
    });
    addDelivery({
      donorName: donorName.trim(),
      kind,
      expectedDate,
      mode,
      assigneeId,
      note: note.trim() || undefined,
      estimatedWindow: mode === 'they_come' ? estimatedWindow.trim() || undefined : undefined,
      latestWindow: mode === 'they_come' ? latestWindow.trim() || undefined : undefined,
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
                  // Catering surplus is almost always our trip out to collect.
                  setMode(donor.kind === 'catering' ? 'we_go' : 'they_come');
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

        <Field label="The trip — who moves it?">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
            <span className="inline-flex rounded-lg border border-zinc-300 bg-zinc-100 p-0.5">
              {(
                [
                  ['they_come', 'They drop off'],
                  ['we_go', 'We pick up'],
                ] as [TransportMode, string][]
              ).map(([value, label]) => (
                <button
                  key={value}
                  onClick={() => setMode(value)}
                  className={cn(
                    'h-9 rounded-md px-3 text-sm font-medium transition-colors',
                    mode === value
                      ? 'bg-white text-zinc-950 shadow-sm ring-1 ring-black/5'
                      : 'text-zinc-500 hover:text-zinc-800',
                  )}
                >
                  {label}
                </button>
              ))}
            </span>

            <span className="inline-flex items-center gap-1.5">
              <span className="eyebrow text-[10px] font-bold text-zinc-400">
                {mode === 'we_go' ? 'Driver' : 'Receiver'}
              </span>
              {team.map((t) => {
                const active = t.id === assigneeId;
                return (
                  <button
                    key={t.id}
                    onClick={() => setAssigneeId(active ? undefined : t.id)}
                    className={cn(
                      'flex h-9 items-center gap-1.5 rounded-full border pl-1.5 pr-3 text-xs font-medium transition-colors',
                      active
                        ? 'border-zinc-950 bg-zinc-950 text-white'
                        : 'border-zinc-300 text-zinc-600 hover:border-zinc-500',
                    )}
                  >
                    <TeamAvatar id={t.id} name={t.name} size={20} />
                    {t.name.split(' ')[0]}
                  </button>
                );
              })}
            </span>
          </div>
        </Field>

        {mode === 'they_come' && (
          <Field
            label="Arrival window (optional)"
            hint={
              <p className="mt-1 text-xs text-zinc-400">
                Only if the donor gave you one, in their own words — we don't
                track or compute this.
              </p>
            }
          >
            <div className="flex flex-wrap gap-2">
              <input
                value={estimatedWindow}
                onChange={(e) => setEstimatedWindow(e.target.value)}
                placeholder="Estimated, e.g. 7:45 PM"
                className={cn(inputClass, 'h-11 flex-1 min-w-[9rem]')}
              />
              <input
                value={latestWindow}
                onChange={(e) => setLatestWindow(e.target.value)}
                placeholder="Latest, e.g. 8:15 PM"
                className={cn(inputClass, 'h-11 flex-1 min-w-[9rem]')}
              />
            </div>
          </Field>
        )}

        <Field label="What's coming (rough is fine)">
          <p className="mb-2 text-xs text-zinc-500">
            Just a name and a rough count — you'll confirm the category and
            verify the printed date once, at the dock.
          </p>
          <ul className="divide-y divide-zinc-100">
            {rows.map((row) => (
              <li key={row.id} className="flex items-center gap-2 py-2">
                <input
                  value={row.name}
                  onChange={(e) => patch(row.id, { name: e.target.value })}
                  placeholder="Item name"
                  className={cn(inputClass, 'h-10 flex-1')}
                />
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
                  placeholder="units"
                  className={cn(inputClass, 'h-9 w-20 text-center text-zinc-500')}
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
