import { useState } from 'react';
import { Button, Icon } from '../ui/primitives';
import { Sheet } from '../ui/Sheet';

export function DirectionsSheet({
  open,
  onClose,
  donorName,
  url,
}: {
  open: boolean;
  onClose: () => void;
  donorName: string;
  url: string;
}) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1200);
    } catch {
      setCopied(false);
    }
  };

  return (
    <Sheet open={open} onClose={onClose} title={`Directions to ${donorName}`}>
      <div className="space-y-2.5">
        <a href={url} target="_blank" rel="noreferrer">
          <Button className="w-full" size="lg">
            <Icon name="pin" size={14} /> Open in Google Maps
          </Button>
        </a>
        <Button className="w-full" variant="outline" size="lg" onClick={copy}>
          {copied ? 'Copied' : 'Copy link'}
        </Button>
        <p className="text-xs text-zinc-500">
          Google Maps will compute real travel time from your current location.
        </p>
      </div>
    </Sheet>
  );
}
