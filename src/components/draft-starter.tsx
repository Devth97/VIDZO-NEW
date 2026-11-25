'use client';
import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowRight, Film, Plus } from 'lucide-react';

/** Names stay in this tab, never in a URL, analytics event or generation request. */
export function DraftStarter() {
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const field = useRef<HTMLInputElement>(null);
  const router = useRouter();
  return <form className="draft-starter" aria-label="Start an ad draft" action="/projects?new=1" method="post" onSubmit={event => {
    event.preventDefault(); if (busy) return; setBusy(true);
    try { sessionStorage.setItem('vidzo:starting-draft', name.trim().slice(0,100) || 'Untitled ad project'); } catch { /* The studio can still create a draft when storage is unavailable. */ }
    router.push('/projects?new=1');
  }}>
    <div className="draft-starter-top"><span><Film size={14}/>AD PROJECT</span><span>10–15 SEC · 9:16</span></div>
    <label htmlFor="draft-start-name">What are you making? <span>Project name · optional</span></label>
    <input ref={field} id="draft-start-name" name="projectName" maxLength={100} value={name} onChange={event => setName(event.target.value)} placeholder="e.g. A new skincare collection" autoComplete="off" aria-describedby="draft-start-help"/>
    <div className="draft-suggestions" aria-label="Project name ideas">{['Product reveal','New collection','Seasonal offer'].map(idea => <button type="button" key={idea} onClick={() => {setName(idea);field.current?.focus();}}><Plus size={12}/>{idea}</button>)}</div>
    <div className="draft-starter-bottom"><p id="draft-start-help">Add your reference and product files<br/>inside your private studio.</p><button type="submit" className="button primary" disabled={busy}>{busy ? 'Opening studio…' : 'Start a free draft'}<ArrowRight size={16}/></button></div>
  </form>;
}
