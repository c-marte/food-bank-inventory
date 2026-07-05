import { ReminderLine } from './ReminderLine';
import { TriageBar } from './TriageBar';
import { DecayTimeline } from './DecayTimeline';
import { MoveFirstZone } from './MoveFirstZone';
import { LowStockZone } from './LowStockZone';
import { PickupsQueue } from './PickupsQueue';
import { LotList } from './LotList';

/** The one surface: triage line, the clock, the outflow queue, the ledger. */
export function Dashboard() {
  return (
    <div className="space-y-4">
      <ReminderLine />

      {/* Focusing layer: what do I touch first? */}
      <TriageBar />

      {/* EXPLORATION: decay as a data-viz timeline, above the bucket list so
          both readings can be compared. */}
      <DecayTimeline />

      {/* The glance: decay-forward zones above everything else.
          items-start lets each card size to its content — no dead voids. */}
      <div className="grid items-start gap-4 md:grid-cols-2">
        <MoveFirstZone />
        <LowStockZone />
      </div>

      <PickupsQueue />
      <LotList />
    </div>
  );
}
