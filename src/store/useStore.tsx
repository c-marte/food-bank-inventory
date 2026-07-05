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
  InventoryLot,
  ISODate,
  Partner,
  PickupRequest,
  RequestItem,
  WasteEvent,
} from '../domain/types';
import { todayISO } from '../domain/dates';
import { buildSeed } from '../data/seed';
import { confirmRequest as domainConfirmRequest } from '../domain/requests';
import { markWaste as domainMarkWaste } from '../domain/waste';

// ---------------------------------------------------------------------------
// The single client-side store. One surface, one user (the shelf-keeper), two
// mutations: food in (ADD_DONATION) and food out (CONFIRM). Every derived
// value (statuses, zones, availability) is a pure function computed at render,
// never written back. `today` is captured once at app start and lives in state
// so logic stays deterministic and testable.
// ---------------------------------------------------------------------------

interface StoreState {
  lots: InventoryLot[];
  requests: PickupRequest[];
  partners: Partner[];
  wasteEvents: WasteEvent[];
  config: Config;
  today: ISODate;
  lastReminder: string | null;
}

type Action =
  | { type: 'ADD_DONATION'; lot: InventoryLot }
  | { type: 'UPDATE_QUANTITY'; lotId: string; quantity: number }
  | { type: 'ADD_REQUEST'; request: PickupRequest }
  | { type: 'CONFIRM'; requestId: string }
  | { type: 'MARK_WASTE'; lotId: string; quantity: number; eventId: string }
  | { type: 'DISMISS_REMINDER' }
  | { type: 'RESET' };

function freshState(today: ISODate): StoreState {
  const seed = buildSeed(today);
  return {
    lots: seed.lots,
    requests: seed.requests,
    partners: seed.partners,
    wasteEvents: [],
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

    case 'ADD_REQUEST':
      return { ...state, requests: [...state.requests, action.request] };

    case 'CONFIRM': {
      // Rule 2: confirm decrements. Delegates to the pure domain function.
      const res = domainConfirmRequest(
        action.requestId,
        state.lots,
        state.requests,
        state.partners,
        state.today,
        state.config,
      );
      if (!res) return state; // missing or already-confirmed: no-op
      return {
        ...state,
        lots: res.lots,
        requests: state.requests.map((r) =>
          r.id === res.request.id ? res.request : r,
        ),
        lastReminder: res.reminder,
      };
    }

    case 'MARK_WASTE': {
      // The third verb: pull it, toss it, record it. Delegates to the pure
      // domain function; partial waste allowed, clamped at what's on hand.
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

    case 'DISMISS_REMINDER':
      return { ...state, lastReminder: null };

    case 'RESET':
      return freshState(state.today);

    default:
      return state;
  }
}

const STORAGE_KEY = 'food-bank-inventory:v3';

interface PersistShape {
  today: ISODate;
  data: Pick<
    StoreState,
    'lots' | 'requests' | 'partners' | 'wasteEvents' | 'config'
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
  createRequest: (partnerId: string, items: RequestItem[]) => PickupRequest;
  confirmRequest: (requestId: string) => void;
  markWaste: (lotId: string, quantity: number) => void;
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
        requests: state.requests,
        partners: state.partners,
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
    createRequest: (partnerId, items) => {
      const request: PickupRequest = {
        id: crypto.randomUUID(),
        partnerId,
        items,
        status: 'requested',
      };
      dispatch({ type: 'ADD_REQUEST', request });
      return request;
    },
    confirmRequest: (requestId) => dispatch({ type: 'CONFIRM', requestId }),
    markWaste: (lotId, quantity) =>
      dispatch({
        type: 'MARK_WASTE',
        lotId,
        quantity,
        eventId: crypto.randomUUID(),
      }),
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
