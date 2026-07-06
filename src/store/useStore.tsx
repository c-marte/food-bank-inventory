import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  type ReactNode,
} from 'react';
import type {
  Config,
  Delivery,
  DeliveryItem,
  InventoryLot,
  ISODate,
  OutboundMovement,
  Partner,
  TeamMember,
  WasteEvent,
} from '../domain/types';
import { todayISO } from '../domain/dates';
import { buildSeed } from '../data/seed';
import { markWaste as domainMarkWaste } from '../domain/waste';
import { receiveDelivery as domainReceiveDelivery } from '../domain/deliveries';
import { completeHandoff as domainCompleteHandoff } from '../domain/distribution';

// ---------------------------------------------------------------------------
// The single client-side store. One surface, one user (the shelf-keeper), two
// commit points: the DOCK (receive creates lots) and the HANDOFF (release
// decrements them). Everything between — expected deliveries, open movements —
// is a promise that reserves nothing. Derived values are pure functions
// computed at render; `today` is captured once so logic stays deterministic.
// ---------------------------------------------------------------------------

interface StoreState {
  lots: InventoryLot[];
  movements: OutboundMovement[];
  deliveries: Delivery[];
  partners: Partner[];
  team: TeamMember[];
  wasteEvents: WasteEvent[];
  config: Config;
  today: ISODate;
  lastReminder: string | null;
}

/** The editable (pre-commit) fields of an open movement. */
type MovementPatch = Partial<
  Pick<OutboundMovement, 'packed' | 'recipientId' | 'mode' | 'assigneeId' | 'note'>
>;

type Action =
  | { type: 'ADD_DONATION'; lot: InventoryLot }
  | { type: 'UPDATE_QUANTITY'; lotId: string; quantity: number }
  | { type: 'MARK_WASTE'; lotId: string; quantity: number; eventId: string }
  | { type: 'ADD_DELIVERY'; delivery: Delivery }
  | { type: 'RECEIVE_DELIVERY'; deliveryId: string; items: DeliveryItem[] }
  | { type: 'ADD_MOVEMENT'; movement: OutboundMovement }
  | { type: 'PATCH_MOVEMENT'; movementId: string; patch: MovementPatch }
  | { type: 'COMPLETE_HANDOFF'; movementId: string }
  | { type: 'DISMISS_REMINDER' }
  | { type: 'RESET' };

function freshState(today: ISODate): StoreState {
  const seed = buildSeed(today);
  return {
    lots: seed.lots,
    movements: seed.movements,
    deliveries: seed.deliveries,
    partners: seed.partners,
    team: seed.team,
    wasteEvents: seed.wasteEvents,
    config: seed.config,
    today,
    lastReminder: null,
  };
}

function reducer(state: StoreState, action: Action): StoreState {
  switch (action.type) {
    case 'ADD_DONATION':
      // Rule 1: always append a NEW lot. Never look up or merge by name.
      return { ...state, lots: [...state.lots, action.lot] };

    case 'UPDATE_QUANTITY':
      // Corrections / manual decrements only. Never merges. Clamped at zero.
      return {
        ...state,
        lots: state.lots.map((l) =>
          l.id === action.lotId
            ? { ...l, quantity: Math.max(0, action.quantity) }
            : l,
        ),
      };

    case 'MARK_WASTE': {
      // Pull it, toss it, record it. Partial allowed, clamped at on-hand.
      const res = domainMarkWaste(
        action.lotId,
        action.quantity,
        state.lots,
        state.today,
        action.eventId,
      );
      if (!res) return state; // unknown lot, empty lot, or bad quantity
      return {
        ...state,
        lots: res.lots,
        wasteEvents: [...state.wasteEvents, res.event],
        lastReminder: `Waste logged: ${res.wasted} ${res.event.unit} of ${res.event.lotName} pulled from the shelf.`,
      };
    }

    case 'ADD_DELIVERY':
      // A promise — captured from the phone call, before the food arrives.
      return { ...state, deliveries: [...state.deliveries, action.delivery] };

    case 'RECEIVE_DELIVERY': {
      // Commit point IN: verified items become NEW lots (rule 1 — never merge).
      const res = domainReceiveDelivery(
        action.deliveryId,
        action.items,
        state.deliveries,
        state.lots,
        state.today,
        () => crypto.randomUUID(),
      );
      if (!res) return state; // missing or already-received: no-op
      return {
        ...state,
        lots: res.lots,
        deliveries: state.deliveries.map((d) =>
          d.id === res.delivery.id ? res.delivery : d,
        ),
        lastReminder: res.reminder,
      };
    }

    case 'ADD_MOVEMENT':
      // A movement enters the pipeline (request / decay push / FEFO box).
      // Reserves nothing — first handoff wins the stock.
      return { ...state, movements: [...state.movements, action.movement] };

    case 'PATCH_MOVEMENT':
      // Pipeline progress before the commit: pack, match, assign. Only open
      // movements are editable; a released movement is history.
      return {
        ...state,
        movements: state.movements.map((m) =>
          m.id === action.movementId && m.status === 'open'
            ? { ...m, ...action.patch }
            : m,
        ),
      };

    case 'COMPLETE_HANDOFF': {
      // Commit point OUT (rule 2): decrement referenced lots, clamped;
      // expired ships 0; shortfall named in the reminder.
      const res = domainCompleteHandoff(
        action.movementId,
        state.movements,
        state.lots,
        state.partners,
        state.today,
      );
      if (!res) return state; // missing, unmatched, unpacked, or released
      return {
        ...state,
        lots: res.lots,
        movements: state.movements.map((m) =>
          m.id === res.movement.id ? res.movement : m,
        ),
        lastReminder: res.reminder,
      };
    }

    case 'DISMISS_REMINDER':
      return { ...state, lastReminder: null };

    case 'RESET':
      return freshState(state.today);

    default:
      return state;
  }
}

const STORAGE_KEY = 'food-bank-inventory:v6';

interface PersistShape {
  today: ISODate;
  data: Pick<
    StoreState,
    | 'lots'
    | 'movements'
    | 'deliveries'
    | 'partners'
    | 'team'
    | 'wasteEvents'
    | 'config'
  >;
}

/** Load persisted state, but only if it was seeded TODAY. On a new day we
 *  re-seed fresh so an async reviewer always opens to live, populated zones. */
function loadInitial(today: ISODate): StoreState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const saved = JSON.parse(raw) as PersistShape;
      if (saved.today === today && saved.data?.lots) {
        return {
          ...saved.data,
          movements: saved.data.movements ?? [],
          deliveries: saved.data.deliveries ?? [],
          team: saved.data.team ?? [],
          wasteEvents: saved.data.wasteEvents ?? [],
          today,
          lastReminder: null,
        };
      }
    }
  } catch {
    /* ignore corrupt storage */
  }
  return freshState(today);
}

interface StoreValue extends StoreState {
  addDonation: (input: Omit<InventoryLot, 'id'>) => void;
  updateLotQuantity: (lotId: string, quantity: number) => void;
  markWaste: (lotId: string, quantity: number) => void;
  addDelivery: (delivery: Omit<Delivery, 'id' | 'status'>) => void;
  receiveDelivery: (deliveryId: string, items: DeliveryItem[]) => void;
  /** A movement enters the pipeline. Doors: request (born matched), decay
   *  push (born unmatched), FEFO box (born packed). */
  addMovement: (
    input: Omit<OutboundMovement, 'id' | 'status' | 'createdDate'>,
  ) => void;
  patchMovement: (movementId: string, patch: MovementPatch) => void;
  completeHandoff: (movementId: string) => void;
  dismissReminder: () => void;
  reset: () => void;
}

const StoreContext = createContext<StoreValue | null>(null);

export function StoreProvider({ children }: { children: ReactNode }) {
  const today = useMemo(() => todayISO(), []);
  const initial = useMemo(() => loadInitial(today), [today]);
  const [state, dispatch] = useReducer(reducer, initial);

  // Mirror to localStorage (same-day persistence; new day re-seeds on load).
  useEffect(() => {
    const payload: PersistShape = {
      today: state.today,
      data: {
        lots: state.lots,
        movements: state.movements,
        deliveries: state.deliveries,
        partners: state.partners,
        team: state.team,
        wasteEvents: state.wasteEvents,
        config: state.config,
      },
    };
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
    } catch {
      /* ignore quota / private-mode errors */
    }
  }, [state]);

  const value: StoreValue = {
    ...state,
    addDonation: (input) =>
      dispatch({
        type: 'ADD_DONATION',
        lot: { ...input, id: crypto.randomUUID() },
      }),
    updateLotQuantity: (lotId, quantity) =>
      dispatch({ type: 'UPDATE_QUANTITY', lotId, quantity }),
    markWaste: (lotId, quantity) =>
      dispatch({
        type: 'MARK_WASTE',
        lotId,
        quantity,
        eventId: crypto.randomUUID(),
      }),
    addDelivery: (delivery) =>
      dispatch({
        type: 'ADD_DELIVERY',
        delivery: { ...delivery, id: crypto.randomUUID(), status: 'expected' },
      }),
    receiveDelivery: (deliveryId, items) =>
      dispatch({ type: 'RECEIVE_DELIVERY', deliveryId, items }),
    addMovement: (input) =>
      dispatch({
        type: 'ADD_MOVEMENT',
        movement: {
          ...input,
          id: crypto.randomUUID(),
          status: 'open',
          createdDate: state.today,
        },
      }),
    patchMovement: (movementId, patch) =>
      dispatch({ type: 'PATCH_MOVEMENT', movementId, patch }),
    completeHandoff: (movementId) =>
      dispatch({ type: 'COMPLETE_HANDOFF', movementId }),
    dismissReminder: () => dispatch({ type: 'DISMISS_REMINDER' }),
    reset: () => dispatch({ type: 'RESET' }),
  };

  return (
    <StoreContext.Provider value={value}>{children}</StoreContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useStore(): StoreValue {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error('useStore must be used within a StoreProvider');
  return ctx;
}
