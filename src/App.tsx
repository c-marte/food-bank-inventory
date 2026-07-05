import { useState } from 'react';
import { MotionConfig } from 'motion/react';
import { StoreProvider } from './store/useStore';
import { Header } from './components/Header';
import { Dashboard } from './components/Dashboard';
import { IntakeForm } from './components/IntakeForm';
import { Sheet } from './ui/Sheet';

function Shell() {
  const [intakeOpen, setIntakeOpen] = useState(false);

  return (
    <div className="min-h-svh bg-zinc-50 text-zinc-950">
      <Header onLogDonation={() => setIntakeOpen(true)} />
      <main className="mx-auto max-w-5xl px-4 py-6 sm:px-6">
        <Dashboard />
      </main>

      {/* Food in — the intake hero, anchored over the dashboard so the truth
          updates visibly behind it the moment a lot is logged. */}
      <Sheet
        open={intakeOpen}
        onClose={() => setIntakeOpen(false)}
        title="Log a donation"
      >
        <IntakeForm onDone={() => setIntakeOpen(false)} />
      </Sheet>
    </div>
  );
}

export default function App() {
  return (
    <MotionConfig reducedMotion="user">
      <StoreProvider>
        <Shell />
      </StoreProvider>
    </MotionConfig>
  );
}
