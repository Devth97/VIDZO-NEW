'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { AlertTriangle, Clock, RefreshCw, ShieldCheck, Wrench, Eye, PenLine } from 'lucide-react';
import { ErrorMessage } from '../ui';
import { deliveryTarget, quoteProblem, totalSeconds, upscaleDisclosure } from '@/lib/domain/project';
import type { Pricing } from '@/lib/domain/pricing';
import type { Project, Quote, Wallet } from '@/lib/domain/schema';
import { describeQuote } from './shared';

const clipScope = (q: Quote) => q.scope === 'video' || q.scope === 'scene';
const remaining = (ms: number) => { const s = Math.max(0, Math.ceil(ms / 1000)); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; };

/** One line per quoted item, named the way the studio names it. */
function taskLabel(p: Project, t: Quote['tasks'][number]) {
  const i = p.scenes.findIndex(s => s.id === t.sceneId);
  const scene = i >= 0 ? `Scene ${i + 1} · ${p.scenes[i].title || 'Untitled'}` : '';
  if (t.kind === 'frame') return `${scene} — storyboard frame`;
  if (t.kind === 'clip') return `${scene} — ${t.seconds} s clip`;
  if (t.kind === 'character') return `Identity sheet — ${p.candidates.find(c => c.id === t.candidateId)?.name || 'original identity'}`;
  return 'Final assembly — your approved clips, exact logo and CTA';
}

/**
 * Everything a buyer needs before spending: what is produced, the most it can cost, what happens on
 * failure, and when the offer lapses. A quote that expired or no longer matches the project cannot be confirmed.
 */
export function QuoteReview({ quote, project, pricing, wallet, demo, busy, error, onConfirm, onRefresh }: {
  quote: Quote; project: Project; pricing: Pricing | null; wallet: Wallet; demo: boolean; busy: boolean; error: string;
  onConfirm: () => void; onRefresh: () => void;
}) {
  const [now, setNow] = useState(() => Date.now());
  const [opened] = useState(project);
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(t); }, []);
  // The server re-derives every quote before spending. Here, flag expiry, and a mismatch only once the
  // project has actually changed since the quote arrived, so a client/server difference can never trap the user.
  const problem = now >= quote.expiresAt ? 'This quote expired. Get a fresh one; nothing was held.'
    : pricing && project !== opened ? quoteProblem(project, quote, pricing, now) : null;
  const short = wallet.available < quote.credits;
  const clips = clipScope(quote);
  const scenesAfter = project.scenes.length;
  // Focus starts on the summary, not the spend button: Enter alone must never confirm a charge.
  return <div className="quote-review" role="group" tabIndex={-1} data-autofocus aria-label="Quote summary">
    <div className="notice"><ShieldCheck size={18}/><span>{demo ? 'Explore mode: simulated credits, placeholder outputs, no provider calls.' : quote.illustrative ? 'Local test backend: placeholder pricing and labelled placeholder outputs. No provider is called.' : 'You will never be charged more than this without new consent.'}</span></div>

    <section aria-labelledby="quote-deliverable"><h3 id="quote-deliverable" className="quote-heading">What this produces</h3>
      <dl className="quote-list">
        <div className="quote-detail"><dt>Work</dt><dd>{describeQuote(quote)}</dd></div>
        {(clips || quote.scope === 'export') && <div className="quote-detail"><dt>Finished ad</dt><dd>{totalSeconds(project)} s · 9:16 vertical · {scenesAfter} scene{scenesAfter === 1 ? '' : 's'}</dd></div>}
        {(clips || quote.scope === 'export') && <div className="quote-detail"><dt>Delivery format</dt><dd>{deliveryTarget.label}</dd></div>}
        <div className="quote-detail"><dt>Model</dt><dd>{quote.model}</dd></div>
        <div className="quote-detail"><dt>Native output</dt><dd>{quote.nativeResolution}</dd></div>
      </dl>
      {clips && <p className="small-text muted quote-note">{upscaleDisclosure(quote.nativeResolution)}</p>}
      <ul className="quote-items" aria-label="Quoted items">{quote.tasks.map(t => <li key={t.taskId}><span>{taskLabel(project, t)}</span><strong>{t.credits} cr</strong></li>)}</ul>
    </section>

    <section aria-labelledby="quote-ceiling" className="quote-ceiling"><h3 id="quote-ceiling" className="quote-heading">Your spending ceiling</h3>
      <p className="quote-max"><strong>{quote.credits}</strong><span>maximum credits{pricing && !quote.illustrative ? '' : ' · placeholder rate'}</span></p>
      <dl className="quote-wallet">
        <div><dt>Available now</dt><dd>{wallet.available}</dd></div>
        <div><dt>Already held</dt><dd>{wallet.held}</dd></div>
        <div><dt>Available after hold</dt><dd className={short ? 'is-short' : ''}>{short ? '—' : wallet.available - quote.credits}</dd></div>
      </dl>
      <p className="small-text muted">Confirming holds these credits; nothing is spent yet. Each item settles only when it is delivered, and anything not delivered is released.</p>
    </section>

    <section aria-labelledby="quote-outcomes"><h3 id="quote-outcomes" className="quote-heading">If something goes wrong</h3>
      <ul className="quote-outcomes">
        <li><Wrench size={16} aria-hidden="true"/><div><strong>Technical failure</strong><span>Automatic retries, at most two, at no extra cost. If an item still fails, its credits are released.</span></div></li>
        <li><Eye size={16} aria-hidden="true"/><div><strong>Quality concern</strong><span>Wrong product, distorted logo or identity: report it for review before any paid redraw.</span></div></li>
        <li><PenLine size={16} aria-hidden="true"/><div><strong>Creative change</strong><span>A new idea after delivery is a paid redraw with its own quote. Other approved scenes keep their work.</span></div></li>
      </ul>
    </section>

    <p className={'quote-expiry' + (problem ? ' is-stale' : '')} role={problem ? 'alert' : undefined}>
      {problem ? <><AlertTriangle size={15}/>{problem}</> : <><Clock size={15}/>Quote valid for <strong>{remaining(quote.expiresAt - now)}</strong><span className="muted">· until {new Date(quote.expiresAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}</span></>}
    </p>
    <ErrorMessage message={error}/>
    {problem
      ? <button className="button primary full" onClick={onRefresh} disabled={busy}><RefreshCw size={16}/>Get a fresh quote</button>
      : <button className="button primary full" onClick={onConfirm} disabled={busy || short}>{busy ? 'Submitting…' : short ? 'Not enough credits' : quote.credits === 0 ? 'Confirm · no credits' : `Hold up to ${quote.credits} credits and start`}</button>}
    {short && !problem && <Link className="text-button" href="/wallet">Add credits to your wallet</Link>}
    <p className="small-text muted quote-note">{quote.retryPolicy}</p>
  </div>;
}
