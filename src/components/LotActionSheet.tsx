import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { daysUntil, relativeDayLabel } from '../domain/dates';
import { getLotStatus } from '../domain/status';
import { useStore } from '../store/useStore';
import { Sheet } from '../ui/Sheet';
import { Button, Icon, StatusBadge, Stepper, TierChip, TierMark } from '../ui/primitives';
import { fullDateLabel } from '../ui/format';
import { CATEGORY_LABELS } from '../domain/types';
import { cn } from '../ui/cn';
import { SPRING } from '../ui/motion';

/* ─────────────────────────────────────────────────────────
 * LOT ACTION SHEET — the verb layer.
 *
 * Every lot, everywhere it appears, opens this same sheet. Three verbs map to
 * the three physical realities:
 *   move it  → Send to partner (opens Record pickup prefilled; expired never ships)
 *   pull it  → Mark as waste (partial allowed; records a WasteEvent)
 *   fix it   → Adjust quantity (the correction)
 * ───────────────────────────────────────────────────────── */

type Mode = 'menu' | 'waste' | 'adjust';

export function LotActionSheet({
  lotId,
  open,
  onClose,
  onSendToPartner,
}: {
  lotId: string | null;
  open: boolean;
  onClose: () => void;
  onSendToPartner: (lotId: string) => void;
}) {
  const { lots, today, config, markWaste, updateLotQuantity } = useStore();
  const [mode, setMode] = useState<Mode>('menu');
  const [wasteQty, setWasteQty] = useState(1);
  const [adjustQty, setAdjustQty] = useState(0);

  const lot = lotId ? lots.find((l) => l.id === lotId) : undefined;

  // Fresh slate whenever the sheet opens on a lot.
  useEffect(() => {
    if (open && lot) {
      setMode('menu');
      setWasteQty(lot.quantity > 0 ? lot.quantity : 1); // default: pull it all
      setAdjustQty(lot.quantity);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, lotId]);

  if (!lot) return null;

  const status = getLotStatus(lot, today, config);
  const d = daysUntil(lot.expiryDate, today);
  const empty = lot.quantity === 0;
  const expired = status === 'expired';

  return (
    <Sheet open={open} onClose={onClose} title={lot.name}>
      <div className="space-y-5">
        {/* Identity block */}
        <div className="flex items-center gap-3">
          <TierChip tier={lot.tier} size={48} />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <StatusBadge status={status} />
              <TierMark tier={lot.tier} showLabel />
              <span className="eyebrow text-[10px] font-bold text-zinc-400">
                {CATEGORY_LABELS[lot.category]}
              </span>
            </div>
            <div className="nums mt-1 text-sm text-zinc-600">
              <b className="text-zinc-950">
                {empty ? '0 remaining' : `${lot.quantity} ${lot.unit}`}
              </b>
              {' · '}expires {fullDateLabel(lot.expiryDate)} (
              {relativeDayLabel(d).toLowerCase()})
            </div>
          </div>
        </div>

        <AnimatePresence mode="wait" initial={false}>
          {mode === 'menu' && (
            <motion.div
              key="menu"
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={SPRING.reflow}
              className="space-y-2"
            >
              {/* Verb 1: move it */}
              <VerbButton
                icon="arrow"
                title="Send to partner"
                sub={
                  expired
                    ? 'Expired food never ships.'
                    : empty
                      ? 'Nothing left to send.'
                      : 'Record a pickup with this lot pre-selected.'
                }
                disabled={expired || empty}
                emphasis
                onClick={() => onSendToPartner(lot.id)}
              />
              {/* Verb 2: pull it */}
              <VerbButton
                icon="trash"
                title="Mark as waste"
                sub={
                  empty
                    ? 'Nothing on the shelf to pull.'
                    : expired
                      ? 'Pulled and tossed — record it so spoilage is measured.'
                      : 'Spoiled early? Record what you pulled.'
                }
                disabled={empty}
                danger={expired}
                onClick={() => setMode('waste')}
              />
              {/* Verb 3: fix it */}
              <VerbButton
                icon="edit"
                title="Adjust quantity"
                sub="Correct a miscount. Doesn't record waste."
                onClick={() => setMode('adjust')}
              />
            </motion.div>
          )}

          {mode === 'waste' && (
            <motion.div
              key="waste"
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={SPRING.reflow}
              className="rounded-xl border border-red-200 bg-red-50/60 p-4"
            >
              <div className="text-sm font-semibold text-zinc-950">
                How many {lot.unit} did you pull?
              </div>
              <p className="mt-0.5 text-xs text-zinc-500">
                Partial is fine — half the {lot.unit} can still be good. This
                updates the shelf and logs the waste.
              </p>
              <div className="mt-3 flex flex-wrap items-center gap-3">
                <Stepper
                  value={wasteQty}
                  min={1}
                  max={lot.quantity}
                  onChange={setWasteQty}
                  ariaLabel="Waste quantity"
                />
                <button
                  onClick={() => setWasteQty(lot.quantity)}
                  className={cn(
                    'h-8 rounded-full border px-3 text-xs font-medium transition-colors',
                    wasteQty === lot.quantity
                      ? 'border-zinc-950 bg-zinc-950 text-white'
                      : 'border-zinc-300 text-zinc-600 hover:border-zinc-500',
                  )}
                >
                  All {lot.quantity}
                </button>
              </div>
              <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-red-100 pt-3">
                <Button
                  variant="danger"
                  onClick={() => {
                    markWaste(lot.id, wasteQty);
                    onClose();
                  }}
                >
                  <Icon name="trash" size={14} /> Confirm — {wasteQty} {lot.unit}{' '}
                  pulled &amp; tossed
                </Button>
                <Button variant="ghost" onClick={() => setMode('menu')}>
                  Back
                </Button>
              </div>
            </motion.div>
          )}

          {mode === 'adjust' && (
            <motion.div
              key="adjust"
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={SPRING.reflow}
              className="rounded-xl border border-zinc-200 bg-zinc-50 p-4"
            >
              <div className="text-sm font-semibold text-zinc-950">
                Set the correct count
              </div>
              <p className="mt-0.5 text-xs text-zinc-500">
                For miscounts only — pickups and waste have their own records.
              </p>
              <div className="mt-3">
                <Stepper
                  value={adjustQty}
                  min={0}
                  max={999}
                  onChange={setAdjustQty}
                  ariaLabel="Corrected quantity"
                />
              </div>
              <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-zinc-200 pt-3">
                <Button
                  onClick={() => {
                    updateLotQuantity(lot.id, adjustQty);
                    onClose();
                  }}
                >
                  <Icon name="check" size={14} /> Save count
                </Button>
                <Button variant="ghost" onClick={() => setMode('menu')}>
                  Back
                </Button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </Sheet>
  );
}

function VerbButton({
  icon,
  title,
  sub,
  onClick,
  disabled,
  emphasis,
  danger,
}: {
  icon: 'arrow' | 'trash' | 'edit';
  title: string;
  sub: string;
  onClick: () => void;
  disabled?: boolean;
  emphasis?: boolean;
  danger?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={cn(
        'flex w-full items-center gap-3 rounded-xl border p-3.5 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-950',
        disabled
          ? 'cursor-not-allowed border-zinc-200 opacity-45'
          : emphasis
            ? 'border-zinc-950 bg-zinc-950 text-white hover:bg-zinc-800'
            : danger
              ? 'border-red-300 bg-white hover:bg-red-50'
              : 'border-zinc-300 bg-white hover:bg-zinc-50',
      )}
    >
      <span
        className={cn(
          'flex h-9 w-9 shrink-0 items-center justify-center rounded-lg',
          emphasis && !disabled
            ? 'bg-white/15 text-white'
            : danger
              ? 'bg-red-50 text-red-600'
              : 'bg-zinc-100 text-zinc-700',
        )}
      >
        <Icon name={icon} size={16} />
      </span>
      <span className="min-w-0 flex-1">
        <span
          className={cn(
            'block text-sm font-semibold',
            emphasis && !disabled ? 'text-white' : danger ? 'text-red-700' : 'text-zinc-950',
          )}
        >
          {title}
        </span>
        <span
          className={cn(
            'block text-xs',
            emphasis && !disabled ? 'text-zinc-300' : 'text-zinc-500',
          )}
        >
          {sub}
        </span>
      </span>
      {!disabled && (
        <Icon
          name="chevron"
          size={16}
          className={emphasis ? 'text-zinc-400' : 'text-zinc-300'}
        />
      )}
    </button>
  );
}
