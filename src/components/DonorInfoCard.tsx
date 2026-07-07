import { useMemo, type ReactNode } from 'react';
import { directionsUrl, locationForDonor } from '../data/geo';
import { donorProfileFor } from '../data/donorProfiles';
import { Icon } from '../ui/primitives';

/* ─────────────────────────────────────────────────────────
 * The DoorDash "store info" block — address, hours, website, phone, then a
 * short "From the owners" blurb — for known stores/caterers/restaurants.
 * Every field here is fictional-but-plausible seed data (see
 * data/donorProfiles.ts for the honesty rationale), same treatment as the
 * map pins already use. Renders nothing for a donor with no profile on
 * file (a freehand walk-in name, or a school food drive — not a storefront)
 * rather than showing empty or fabricated rows.
 * ───────────────────────────────────────────────────────── */

function InfoRow({
  icon,
  href,
  children,
}: {
  icon: 'pin' | 'clock' | 'globe' | 'phone';
  href?: string;
  children: ReactNode;
}) {
  const content = (
    <div className="flex items-center gap-3 py-2.5">
      <Icon name={icon} size={16} className="shrink-0 text-zinc-400" />
      <div className="min-w-0 flex-1 text-sm">{children}</div>
      {href && <Icon name="external" size={13} className="shrink-0 text-zinc-400" />}
    </div>
  );
  if (!href) return content;
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className="-mx-1 block rounded-md px-1 transition-colors hover:bg-zinc-50"
    >
      {content}
    </a>
  );
}

export function DonorInfoCard({ donorName }: { donorName: string }) {
  const profile = donorProfileFor(donorName);
  const donorLoc = useMemo(() => locationForDonor(donorName), [donorName]);
  const mapsUrl = useMemo(() => directionsUrl(donorLoc), [donorLoc]);

  if (!profile) return null;

  return (
    <div className="border-t border-zinc-200 px-3 py-1">
      <InfoRow icon="pin" href={mapsUrl}>
        <div className="text-zinc-900">{profile.address}</div>
        <div className="text-xs text-zinc-500">{profile.cityState}</div>
      </InfoRow>
      <div className="border-t border-zinc-100" />
      <InfoRow icon="clock">
        <span className="text-zinc-700">{profile.hours}</span>
      </InfoRow>
      <div className="border-t border-zinc-100" />
      <InfoRow icon="globe" href={`https://${profile.website}`}>
        <span className="truncate text-zinc-700">{profile.website}</span>
      </InfoRow>
      <div className="border-t border-zinc-100" />
      <InfoRow icon="phone" href={`tel:${profile.phone}`}>
        <span className="text-zinc-700">{profile.phone}</span>
      </InfoRow>

      <div className="border-t border-zinc-100 py-3">
        <h4 className="text-xs font-semibold text-zinc-950">From the owners</h4>
        <p className="mt-1 text-xs leading-relaxed text-zinc-500">{profile.about}</p>
      </div>
    </div>
  );
}
