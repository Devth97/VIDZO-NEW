import { ShieldCheck, Receipt, Undo2, ScanLine, Users, Image as ImageIcon, Lock, Smartphone, ListChecks } from 'lucide-react';

/** A slow ticker of things the studio really does today, in the spirit of Arcads' tool strip. */
const items = [
  { Icon: ShieldCheck, label: 'Your direction stays yours' },
  { Icon: Receipt, label: 'A quote before you spend' },
  { Icon: Undo2, label: 'Redo a scene, not the whole story' },
  { Icon: ScanLine, label: 'Reference analysis' },
  { Icon: ListChecks, label: 'Frame-by-frame approvals' },
  { Icon: Users, label: 'Character sheets' },
  { Icon: ImageIcon, label: 'Your product photos and logo' },
  { Icon: Smartphone, label: 'Vertical 9:16 for Reels and Shorts' },
  { Icon: Lock, label: 'Private storage, no public gallery' },
];

export function FeatureTicker() {
  const row = (copy?: boolean) => <ul className="ticker-row" aria-hidden={copy || undefined}>{items.map(({ Icon, label }) => <li key={label}><Icon size={16}/>{label}</li>)}</ul>;
  return <section className="feature-ticker" aria-label="What the studio does" tabIndex={0}><div className="ticker-track">{row()}{row(true)}</div></section>;
}
