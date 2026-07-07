// ---------------------------------------------------------------------------
// Store info for known donors — address, hours, website, phone. Same rule as
// the map pins in geo.ts: these businesses are fictional (or a real chain's
// name reused for a fictional seeded instance), so the contact details are
// fictional-but-plausible too, not a claim about any real business.
//   - Address: a plausible street in the same fictional South End setting
//     the map pins already use.
//   - Hours: plain reference text, never a computed "Open now" — this app
//     has no real-time clock logic anywhere else, so it doesn't start
//     claiming to know what's open right now here either.
//   - Website: an *.example.com domain — the IANA-reserved domain that
//     exists specifically for illustrative, non-real use. Clicking it goes
//     somewhere real and harmless, and unambiguously reads as a placeholder.
//   - Phone: a 555-exchange number, the standard fictional-phone-number
//     convention (same one already used for Ray the courier in seed.ts).
// Only for known stores/caterers/restaurants — a school food drive isn't a
// storefront, so it deliberately has no profile here.
// ---------------------------------------------------------------------------

export interface DonorProfile {
  address: string;
  cityState: string;
  hours: string;
  website: string;
  phone: string;
  about: string;
}

export const DONOR_PROFILES: Record<string, DonorProfile> = {
  'Stop & Shop': {
    address: '1721 Washington St',
    cityState: 'Boston, MA',
    hours: 'Mon–Sun 7am–10pm',
    website: 'stopandshop.example.com',
    phone: '+16175550118',
    about: 'Grocery rescue partner — surplus bread, produce, and dairy donated most mornings.',
  },
  "Sal's Catering": {
    address: '84 Union Park St',
    cityState: 'Boston, MA',
    hours: 'Mon–Sat 8am–8pm',
    website: 'salscatering.example.com',
    phone: '+16175550175',
    about: 'Event catering — leftover trays from weddings and corporate events, usually same-day.',
  },
  'Riverside Bakery': {
    address: '212 Riverway',
    cityState: 'Boston, MA',
    hours: 'Tue–Sun 6am–3pm',
    website: 'riversidebakery.example.com',
    phone: '+16175550193',
    about: "Day-old bread and pastries — whatever didn't sell by closing.",
  },
};

export function donorProfileFor(name: string): DonorProfile | undefined {
  return DONOR_PROFILES[name];
}
