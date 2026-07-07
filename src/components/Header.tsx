import { useStore } from '../store/useStore';
import { useUI, type View } from '../store/useUI';
import { Button, Icon } from '../ui/primitives';
import { weekdayDateLabel } from '../ui/format';
import { cn } from '../ui/cn';
// Labels only — "Inbound"/"Outbound" mirror each other on purpose (food in,
// food out). The underlying view ids ('intake'/'distribution') stay as-is;
// this is a copy change, not a routing change.
const MENU: { id: View; label: string; icon: 'inbox' | 'box' | 'arrow' }[] = [
  { id: 'intake', label: 'Inbound', icon: 'inbox' },
  { id: 'inventory', label: 'Inventory', icon: 'box' },
  { id: 'distribution', label: 'Outbound', icon: 'arrow' },
];

export function Header() {
  const { today, reset } = useStore();
  const { view, navigate } = useUI();

  return (
    <header>
      {/* Mobile: pinned to the bottom, laid out horizontally (position and
          container axis only — the icons inside never rotate). Desktop
          (sm+): the original left-edge, vertically-centered rail. */}
      <nav
        aria-label="Sections"
        className="fixed bottom-4 left-1/2 z-30 -translate-x-1/2 rounded-3xl border border-zinc-200 bg-white p-2 shadow-lg shadow-zinc-900/10 sm:bottom-auto sm:left-4 sm:top-1/2 sm:translate-x-0 sm:-translate-y-1/2"
      >
        <div className="flex flex-row gap-1 sm:flex-col">
          {MENU.map((item) => {
            const active = view === item.id;
            return (
              <button
                key={item.id}
                onClick={() => navigate(item.id)}
                aria-current={active ? 'page' : undefined}
                aria-label={item.label}
                className={cn(
                  'group relative flex h-10 w-10 items-center justify-center rounded-xl text-zinc-700 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-950',
                  active ? 'bg-zinc-100 text-zinc-950' : 'hover:bg-zinc-50',
                )}
              >
                <Icon name={item.icon} size={18} />
                <span className="pointer-events-none absolute left-[calc(100%+10px)] top-1/2 -translate-y-1/2 rounded-xl bg-zinc-800 px-3 py-1.5 text-sm font-medium text-white opacity-0 shadow-sm transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100">
                  {item.label}
                </span>
              </button>
            );
          })}
        </div>
      </nav>

      <div className="fixed right-4 top-4 z-30 flex items-center gap-2 rounded-full border border-zinc-200 bg-white/90 px-3 py-1.5 backdrop-blur"
      >
        <div className="nums text-xs font-medium text-zinc-500">
          {weekdayDateLabel(today)}
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={reset}
          title="Reset all data to the seeded demo state"
        >
          <Icon name="reset" size={14} />
          <span>Reset</span>
        </Button>
      </div>
    </header>
  );
}
