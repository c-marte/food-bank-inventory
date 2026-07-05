import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import type { ISODate } from '../domain/types';
import { parseDonation, type ParsedItem } from '../domain/parseDonation';
import { Button, Icon } from '../ui/primitives';
import { cn } from '../ui/cn';

// ---------------------------------------------------------------------------
// The capture layer. Speech-to-text and photo-OCR are SIMULATED (a typewriter
// transcript, a canned "read"); the parse that turns their text into draft
// lines is REAL (parseDonation). Everything it produces is a draft the human
// verifies at the dock — capture never bypasses the checkpoint.
// ---------------------------------------------------------------------------

const DICTATE_EXAMPLE =
  '6 trays of baked ziti, 24 turkey sandwiches good till tomorrow, and 8 bowls of garden salad';

const PHOTO_SAMPLES = [
  {
    id: 'label',
    label: 'Catering label',
    kind: 'label' as const,
    lines: ['SAL’S CATERING', 'EVENT OVERAGE', '12 loaves wheat bread', '15 bunches bananas (4 days)', '6 gal whole milk'],
    text: '12 loaves wheat bread, 15 bunches bananas good for 4 days, 6 gallons whole milk',
  },
  {
    id: 'note',
    label: 'Handwritten list',
    kind: 'note' as const,
    lines: ['donation — thx!', 'a dozen eggs', '10 cans black beans', '2 gallons milk', '5 jars peanut butter'],
    text: 'a dozen eggs, 10 cans black beans, 2 gallons of milk, 5 jars peanut butter',
  },
];

export function CaptureBar({
  today,
  onItems,
}: {
  today: ISODate;
  onItems: (items: ParsedItem[]) => void;
}) {
  const [mode, setMode] = useState<'idle' | 'dictate' | 'photo'>('idle');
  const [listening, setListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [reading, setReading] = useState<string | null>(null);
  const [added, setAdded] = useState<number | null>(null);
  const timer = useRef<number | null>(null);

  useEffect(() => () => { if (timer.current) window.clearInterval(timer.current); }, []);

  function reset() {
    setListening(false);
    setReading(null);
    if (timer.current) window.clearInterval(timer.current);
  }

  // Simulated dictation: stream the example in like live speech-to-text.
  function toggleMic() {
    if (listening) {
      reset();
      return;
    }
    setTranscript('');
    setAdded(null);
    setListening(true);
    let i = 0;
    window.setTimeout(() => {
      timer.current = window.setInterval(() => {
        i += 2;
        setTranscript(DICTATE_EXAMPLE.slice(0, i));
        if (i >= DICTATE_EXAMPLE.length) {
          if (timer.current) window.clearInterval(timer.current);
          setListening(false);
        }
      }, 28);
    }, 400);
  }

  function commit(items: ParsedItem[]) {
    if (items.length === 0) return;
    onItems(items);
    setAdded(items.length);
    setMode('idle');
    reset();
  }

  // Simulated OCR: "read" the sample, then run the real parser on its text.
  function readPhoto(sample: (typeof PHOTO_SAMPLES)[number]) {
    setReading(sample.id);
    window.setTimeout(() => {
      commit(parseDonation(sample.text, today));
    }, 1200);
  }

  return (
    <div className="rounded-xl border border-zinc-200 bg-zinc-50/70 p-3">
      <div className="flex items-center justify-between gap-2">
        <div className="eyebrow text-[11px] font-bold text-zinc-500">
          Quick capture
        </div>
        {added != null && (
          <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-700">
            <Icon name="check" size={13} /> Added {added} — verify below
          </span>
        )}
      </div>

      {mode === 'idle' && (
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => { setMode('dictate'); setAdded(null); }}>
            <Icon name="mic" size={15} /> Dictate
          </Button>
          <Button variant="outline" size="sm" onClick={() => { setMode('photo'); setAdded(null); }}>
            <Icon name="camera" size={15} /> Photo of manifest
          </Button>
          <span className="text-xs text-zinc-400">
            Turn a call or a slip into draft items.
          </span>
        </div>
      )}

      <AnimatePresence mode="wait">
        {mode === 'dictate' && (
          <motion.div
            key="dictate"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div className="mt-3 flex items-start gap-3">
              <button
                onClick={toggleMic}
                aria-label={listening ? 'Stop dictation' : 'Start dictation'}
                className={cn(
                  'relative flex h-12 w-12 shrink-0 items-center justify-center rounded-full transition-colors',
                  listening ? 'bg-red-600 text-white' : 'bg-zinc-950 text-white hover:bg-zinc-800',
                )}
              >
                {listening && (
                  <motion.span
                    className="absolute inset-0 rounded-full bg-red-500"
                    initial={{ opacity: 0.5, scale: 1 }}
                    animate={{ opacity: 0, scale: 1.8 }}
                    transition={{ repeat: Infinity, duration: 1.1, ease: 'easeOut' }}
                  />
                )}
                <Icon name="mic" size={20} className="relative" />
              </button>
              <div className="min-w-0 flex-1">
                <textarea
                  value={transcript}
                  onChange={(e) => setTranscript(e.target.value)}
                  placeholder={listening ? 'Listening…' : 'Tap the mic, or type what the donor said…'}
                  rows={2}
                  className="w-full resize-none rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-950 outline-none focus:border-zinc-950"
                />
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <Button size="sm" onClick={() => commit(parseDonation(transcript, today))} disabled={transcript.trim() === ''}>
                    <Icon name="check" size={14} /> Parse into items
                  </Button>
                  <button onClick={() => { reset(); setMode('idle'); }} className="text-xs text-zinc-500 hover:text-zinc-900">
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          </motion.div>
        )}

        {mode === 'photo' && (
          <motion.div
            key="photo"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div className="mt-3 grid grid-cols-2 gap-2">
              {PHOTO_SAMPLES.map((s) => (
                <button
                  key={s.id}
                  onClick={() => readPhoto(s)}
                  disabled={reading != null}
                  className={cn(
                    'relative overflow-hidden rounded-lg border p-3 text-left transition-transform',
                    s.kind === 'note'
                      ? 'rotate-[-1deg] border-amber-200 bg-amber-50'
                      : 'border-zinc-300 bg-white',
                    reading == null && 'hover:-translate-y-0.5',
                  )}
                >
                  <div
                    className={cn(
                      'space-y-0.5',
                      s.kind === 'note'
                        ? 'font-[cursive] text-[13px] leading-tight text-amber-900'
                        : 'font-mono text-[10px] uppercase leading-tight text-zinc-700',
                    )}
                  >
                    {s.lines.map((l, i) => (
                      <div key={i} className={i === 0 ? 'font-bold' : ''}>{l}</div>
                    ))}
                  </div>
                  {reading === s.id && (
                    <>
                      <motion.div
                        className="absolute inset-x-0 h-8 bg-gradient-to-b from-emerald-400/0 via-emerald-400/40 to-emerald-400/0"
                        initial={{ top: '-2rem' }}
                        animate={{ top: '100%' }}
                        transition={{ repeat: Infinity, duration: 1.1, ease: 'linear' }}
                      />
                      <div className="absolute bottom-1 right-1 rounded bg-zinc-950/80 px-1.5 py-0.5 text-[10px] font-medium text-white">
                        Reading…
                      </div>
                    </>
                  )}
                  <div className="eyebrow mt-2 text-[9px] font-bold text-zinc-400">
                    {s.label}
                  </div>
                </button>
              ))}
            </div>
            <button onClick={() => { reset(); setMode('idle'); }} className="mt-2 text-xs text-zinc-500 hover:text-zinc-900">
              Cancel
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
