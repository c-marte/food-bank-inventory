import { createContext, useCallback, useContext, useState, type ReactNode } from 'react';

// ---------------------------------------------------------------------------
// Shell state: which spoke is visible, and which (single) sheet is open.
// Hub-and-spoke IA — Home is status + entry points; Pickups and Inventory are
// the working pages; mutations are sheets launched from anywhere.
// ---------------------------------------------------------------------------

export type View = 'home' | 'pickups' | 'inventory';

export type SheetState =
  | null
  | { kind: 'intake' }
  | { kind: 'pickup'; lotId?: string }
  | { kind: 'lot'; lotId: string }
  | { kind: 'expect' }
  | { kind: 'receive'; deliveryId: string };

interface UIValue {
  view: View;
  navigate: (view: View) => void;
  sheet: SheetState;
  openIntake: () => void;
  /** Optional lotId prefills the pickup with that lot (the "send to partner" verb). */
  openPickup: (lotId?: string) => void;
  openLot: (lotId: string) => void;
  openExpect: () => void;
  openReceive: (deliveryId: string) => void;
  closeSheet: () => void;
  /** Inventory page filter, presettable from the triage "already expired" path. */
  expiredOnly: boolean;
  setExpiredOnly: (v: boolean) => void;
}

const UIContext = createContext<UIValue | null>(null);

export function UIProvider({ children }: { children: ReactNode }) {
  const [view, setView] = useState<View>('home');
  const [sheet, setSheet] = useState<SheetState>(null);
  const [expiredOnly, setExpiredOnly] = useState(false);

  const navigate = useCallback((next: View) => {
    setView(next);
    if (next !== 'inventory') setExpiredOnly(false);
    window.scrollTo({ top: 0 });
  }, []);

  const value: UIValue = {
    view,
    navigate,
    sheet,
    openIntake: () => setSheet({ kind: 'intake' }),
    openPickup: (lotId) => setSheet({ kind: 'pickup', lotId }),
    openLot: (lotId) => setSheet({ kind: 'lot', lotId }),
    openExpect: () => setSheet({ kind: 'expect' }),
    openReceive: (deliveryId) => setSheet({ kind: 'receive', deliveryId }),
    closeSheet: () => setSheet(null),
    expiredOnly,
    setExpiredOnly,
  };

  return <UIContext.Provider value={value}>{children}</UIContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export function useUI(): UIValue {
  const ctx = useContext(UIContext);
  if (!ctx) throw new Error('useUI must be used within a UIProvider');
  return ctx;
}
