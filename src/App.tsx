import { useRef } from 'react';
import { MotionConfig } from 'motion/react';
import { StoreProvider } from './store/useStore';
import { UIProvider, useUI } from './store/useUI';
import { Header } from './components/Header';
import { Home } from './components/Home';
import { PickupsQueue } from './components/PickupsQueue';
import { LotList } from './components/LotList';
import { ReminderLine } from './components/ReminderLine';
import { IntakeForm } from './components/IntakeForm';
import { RecordPickupSheet } from './components/RecordPickupSheet';
import { LotActionSheet } from './components/LotActionSheet';
import { Sheet } from './ui/Sheet';

function Shell() {
  const { view, sheet, closeSheet, openPickup } = useUI();

  // Sheets keep their last subject through the exit animation, so closing
  // doesn't blank the content mid-slide.
  const lastLotId = useRef<string | null>(null);
  if (sheet?.kind === 'lot') lastLotId.current = sheet.lotId;
  const lastPickupLotId = useRef<string | null>(null);
  if (sheet?.kind === 'pickup') lastPickupLotId.current = sheet.lotId ?? null;

  return (
    <div className="min-h-svh bg-zinc-50 text-zinc-950">
      <Header />
      <main className="mx-auto max-w-5xl space-y-4 px-4 py-6 sm:px-6">
        {/* Global: confirms and waste logs report here on any page. */}
        <ReminderLine />

        {view === 'home' && <Home />}
        {view === 'pickups' && <PickupsQueue />}
        {view === 'inventory' && <LotList />}
      </main>

      {/* The three mutations, anchored over whichever page is behind them. */}
      <Sheet
        open={sheet?.kind === 'intake'}
        onClose={closeSheet}
        title="Log a donation"
      >
        <IntakeForm onDone={closeSheet} />
      </Sheet>

      <RecordPickupSheet
        open={sheet?.kind === 'pickup'}
        onClose={closeSheet}
        initialLotId={lastPickupLotId.current}
      />

      <LotActionSheet
        open={sheet?.kind === 'lot'}
        lotId={lastLotId.current}
        onClose={closeSheet}
        onSendToPartner={(lotId) => openPickup(lotId)}
      />
    </div>
  );
}

export default function App() {
  return (
    <MotionConfig reducedMotion="user">
      <StoreProvider>
        <UIProvider>
          <Shell />
        </UIProvider>
      </StoreProvider>
    </MotionConfig>
  );
}
