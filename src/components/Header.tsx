import { useStore } from '../store/useStore';
import { Button, Icon } from '../ui/primitives';
import { weekdayDateLabel } from '../ui/format';

/** One surface, one user. The header carries the brand, the date, and the
 *  single primary action — logging food in. No roles, no simulated auth:
 *  in production, sign-in would land the shelf-keeper here directly. */
export function Header({ onLogDonation }: { onLogDonation: () => void }) {
  const { today, reset } = useStore();

  return (
    <header className="sticky top-0 z-20 border-b border-zinc-200 bg-white/90 backdrop-blur">
      <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-md bg-zinc-950 text-white">
            <Icon name="check" size={16} />
          </div>
          <div className="leading-tight">
            <div className="text-sm font-bold tracking-tight text-zinc-950">
              Shelf
              <span className="hidden text-zinc-400 sm:inline"> · pantry inventory</span>
            </div>
            <div className="nums text-xs text-zinc-500">
              {weekdayDateLabel(today)}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button onClick={onLogDonation}>
            <Icon name="plus" size={15} />
            Log donation
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={reset}
            title="Reset all data to the seeded demo state"
          >
            <Icon name="reset" size={14} />
            <span className="hidden sm:inline">Reset</span>
          </Button>
        </div>
      </div>
    </header>
  );
}
