'use client';
import { useCallback, useEffect, useState } from 'react';
import { Check, FlaskConical, Receipt } from 'lucide-react';
import { useWorkspace } from '@/components/workspace-provider';
import { ErrorMessage, Modal } from '@/components/ui';
import type { Order, Payment } from '@/components/backend';
import type { Pricing } from '@/lib/domain/pricing';
import { rupees, type Wallet } from '@/lib/domain/schema';

const kindText = { reserve: 'Held for a job', settle: 'Spent on finished work', release: 'Released back', purchase: 'Purchased', adjust: 'Adjustment' } as const;

declare global { interface Window { Razorpay?: new (opts: Record<string, unknown>) => { open(): void } } }

export default function WalletPage() {
  const { backend, mode, setWallet, notify } = useWorkspace();
  const [data, setData] = useState<{ wallet: Wallet; payments: Payment[]; pricing: Pricing | null }>();
  const [error, setError] = useState(''), [busy, setBusy] = useState(false), [order, setOrder] = useState<Order>(), [pending, setPending] = useState(false);
  const load = useCallback(async () => { try { const d = await backend.wallet(); setData(d); setWallet(d.wallet); } catch (e) { setError((e as Error).message); } }, [backend, setWallet]);
  useEffect(() => { void load(); }, [load]);
  // After checkout the wallet updates only when the signed webhook confirms capture; poll briefly.
  useEffect(() => { if (!pending) return; let n = 0; const t = setInterval(() => { n++; void load(); if (n > 20) { clearInterval(t); setPending(false); } }, 3000); return () => clearInterval(t); }, [pending, load]);

  async function buy(packId: string) {
    setBusy(true); setError('');
    try {
      const o = await backend.order(packId);
      if (o.simulated) { setOrder(o); return; }
      if (!window.Razorpay) {
        await new Promise<void>((resolve, reject) => { const s = document.createElement('script'); s.src = 'https://checkout.razorpay.com/v1/checkout.js'; s.onload = () => resolve(); s.onerror = () => reject(new Error('The payment window could not load. Check your connection.')); document.body.appendChild(s); });
      }
      new window.Razorpay!({ key: o.keyId, order_id: o.orderId, amount: o.amount, currency: o.currency, name: 'Vidzo', description: `${o.credits} credits`,
        handler: () => { setPending(true); notify('Payment received by the provider. Credits appear once it is confirmed.'); },
        modal: { ondismiss: () => setBusy(false) } }).open();
    } catch (e) { setError((e as Error).message); } finally { setBusy(false); }
  }
  async function simulate(outcome: 'captured' | 'failed') {
    if (!order || !backend.simulatePayment) return;
    setBusy(true);
    try { const r = await backend.simulatePayment(order.orderId, outcome); notify(outcome === 'captured' ? `Test webhook processed: ${r.outcome}.` : 'Test failure recorded. No credits added.'); setOrder(undefined); await load(); } catch (e) { setError((e as Error).message); } finally { setBusy(false); }
  }

  const w = data?.wallet, pr = data?.pricing;
  return <div className="page-container">
    <div className="page-heading"><div><p className="eyebrow">WALLET</p><h1>Credits, clearly accounted<span className="serif-dot">.</span></h1><p>Every hold, settlement and release is recorded in an append-only ledger.</p></div></div>
    {mode === 'demo' && <p className="notice warning">Explore mode credits are simulated and start at 300. They have no cash value and cannot be bought here.</p>}
    {mode === 'local' && <p className="notice"><FlaskConical size={16}/>Local test backend: purchases create real order and ledger records, but payment is simulated through a correctly signed test webhook. No money moves.</p>}
    <ErrorMessage message={error}/>
    <div className="stats-grid"><div className="stat-card"><span>Available</span><strong>{w?.available ?? '—'}</strong><small>Ready to use</small></div><div className="stat-card"><span>Held</span><strong>{w?.held ?? '—'}</strong><small>Reserved for running jobs</small></div><div className="stat-card"><span>Spent</span><strong>{w?.spent ?? '—'}</strong><small>Settled for finished work</small></div></div>
    {pending && <p className="notice" role="status">Waiting for the payment provider to confirm capture. Pending payments never add credits; this page refreshes automatically.</p>}
    {mode !== 'demo' && <section className="projects-section"><div className="section-head"><h2>Add credits</h2>{pr?.illustrative && <span className="badge">Pilot pricing · placeholder</span>}</div>
      {pr ? <div className="grid-two">{pr.packs.map(p => <article key={p.id} className="panel pack-card"><h3>{p.credits} credits</h3><p className="pack-price">{rupees(p.paise / 100)}</p><p className="small-text muted">{rupees(p.paise / 100 / p.credits)} per credit · INR</p><button className="button primary full" disabled={busy} onClick={() => void buy(p.id)}>{busy ? 'Opening…' : `Buy ${p.credits} credits`}</button></article>)}</div>
        : <p className="notice warning">Credit packs are unavailable until pricing is configured from measured costs.</p>}
    </section>}
    <section className="projects-section"><h2>Ledger</h2>
      {w?.operations.length ? <div className="table-wrap"><table className="price-table"><thead><tr><th scope="col">When</th><th scope="col">Entry</th><th scope="col">Credits</th><th scope="col">Reference</th></tr></thead><tbody>{w.operations.map(o => <tr key={o.id + o.kind}><td>{new Date(o.at).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}</td><td>{kindText[o.kind]}</td><td>{o.kind === 'purchase' || o.kind === 'release' ? '+' : o.kind === 'reserve' ? '−' : ''}{o.amount}</td><td className="mono">{o.id.slice(0, 18)}</td></tr>)}</tbody></table></div>
        : <div className="empty-state panel"><Receipt size={26}/><p>No credit activity yet.</p></div>}
    </section>
    {mode !== 'demo' && <section className="projects-section"><h2>Payments</h2>
      {data?.payments.length ? <div className="table-wrap"><table className="price-table"><thead><tr><th scope="col">Date</th><th scope="col">Pack</th><th scope="col">Amount</th><th scope="col">Status</th></tr></thead><tbody>{data.payments.map(p => <tr key={p.id}><td>{new Date(p.createdAt).toLocaleDateString('en-IN')}</td><td>{p.credits} credits</td><td>{rupees(p.amountPaise / 100)}</td><td>{p.status === 'captured' ? <><Check size={13}/> Paid</> : p.status === 'failed' ? 'Failed · no credits added' : 'Pending confirmation'}{p.simulated ? ' (test)' : ''}</td></tr>)}</tbody></table></div>
        : <p className="muted small-text">No payments yet.</p>}</section>}
    <Modal open={Boolean(order)} close={() => setOrder(undefined)} title="Test payment (local backend)">
      <p className="small-text">Order <span className="mono">{order?.orderId}</span> for {order?.credits} credits ({order && rupees(order.amount / 100)}) was created. Choose what the simulated payment provider reports. Credits are added only by the signed webhook path.</p>
      <div className="inline-actions" style={{ marginTop: 20 }}><button className="button primary" disabled={busy} onClick={() => void simulate('captured')}>Simulate captured payment</button><button className="button secondary" disabled={busy} onClick={() => void simulate('failed')}>Simulate failure</button></div>
    </Modal>
  </div>;
}
