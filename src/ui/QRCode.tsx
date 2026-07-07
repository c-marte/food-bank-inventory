import { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { cn } from './cn';

/** Renders locally via the `qrcode` package — no network call, no third-party
 *  tracking pixel. Encodes the same real Google Maps link as "Get
 *  directions," so a volunteer can scan it straight to their phone. */
export function QRCodeImage({
  value,
  size = 64,
  className,
}: {
  value: string;
  size?: number;
  className?: string;
}) {
  const [src, setSrc] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    QRCode.toDataURL(value, {
      width: size * 2,
      margin: 0,
      color: { dark: '#18181b', light: '#ffffff' },
    })
      .then((url) => {
        if (active) setSrc(url);
      })
      .catch(() => {
        if (active) setSrc(null);
      });
    return () => {
      active = false;
    };
  }, [value, size]);

  if (!src) {
    return (
      <div
        className={cn('shrink-0 rounded-md bg-zinc-100', className)}
        style={{ width: size, height: size }}
        aria-hidden="true"
      />
    );
  }

  return (
    <img
      src={src}
      width={size}
      height={size}
      alt="QR code linking to directions"
      className={cn('shrink-0 rounded-md ring-1 ring-zinc-200', className)}
    />
  );
}
