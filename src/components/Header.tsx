import { useStore } from '../store/useStore';
import { useUI, type View } from '../store/useUI';
import { Button, Icon } from '../ui/primitives';
import { weekdayDateLabel } from '../ui/format';
import { cn } from '../ui/cn';

const TABS: { id: View; label: string }[] = [
  { id: 'shelf', label: 'Shelf' },
  { id: 'intake', label: 'Intake' },
  { id: 'distribution', label: 'Distribution' },
];

/** Logo + date on the left, the three destinations in the middle, reset on the
 *  right. The standing picture (Shelf) plus the two verbs (Intake / Distribution).
 *  Tabs, not a sidebar — nav chrome scales with the destination count. */
export function Header() {
  const { today, reset, movements, deliveries } = useStore();
  const { view, navigate } = useUI();
  const pending = movements.filter((m) => m.status === 'open').length;
  const incoming = deliveries.filter((d) => d.status === 'expected').length;
  const badgeFor = (id: View) =>
    id === 'distribution' ? pending : id === 'intake' ? incoming : 0;

  return (
    <header className="sticky top-0 z-20 border-b border-zinc-200 bg-white/90 backdrop-blur">
      <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-x-4 gap-y-2 px-4 py-2.5 sm:px-6">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-md bg-zinc-950 text-white">
            <Icon name="check" size={16} />
          </div>
          <div className="nums text-xs font-medium text-zinc-500">
            {weekdayDateLabel(today)}
          </div>
        </div>

        <nav
          aria-label="Sections"
          className="order-3 -mx-1 flex w-full gap-1 sm:order-none sm:mx-0 sm:w-auto"
        >
          {TABS.map((tab) => {
            const active = view === tab.id;
            const badge = badgeFor(tab.id);
            return (
              <button
                key={tab.id}
                onClick={() => navigate(tab.id)}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  'relative h-9 rounded-md px-3 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-950',
                  active
                    ? 'bg-zinc-950 text-white'
                    : 'text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900',
                )}
              >
                {tab.label}
                {badge > 0 && (
                  <span
                    className={cn(
                      'nums ml-1.5 inline-flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[10px] font-bold',
                      active ? 'bg-white text-zinc-950' : 'bg-zinc-950 text-white',
                    )}
                  >
                    {badge}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

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
    </header>
  );
}
