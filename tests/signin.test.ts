import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({ mode: 'live', capabilities: { auth: true } }));
vi.mock('@/components/workspace-provider', () => ({ useWorkspace: () => state }));
import SignIn from '@/app/(public)/signin/page';

describe('sign-in screen', () => {
  it('offers Google sign-in without an email field in live mode', () => {
    state.mode = 'live'; state.capabilities.auth = true;
    const html = renderToStaticMarkup(createElement(SignIn));
    expect(html).toContain('Continue with Google');
    expect(html).not.toContain('type="email"');
    expect(html).toContain('type="checkbox"');
    expect(html).toContain('required=""');
  });

  it('keeps test email links explicitly local', () => {
    state.mode = 'local';
    const html = renderToStaticMarkup(createElement(SignIn));
    expect(html).toContain('Create local sign-in link');
    expect(html).toContain('No email is sent.');
    expect(html).not.toContain('Continue with Google');
  });

  it('explains incomplete live setup instead of offering email sign-in', () => {
    state.mode = 'live'; state.capabilities.auth = false;
    const html = renderToStaticMarkup(createElement(SignIn));
    expect(html).toContain('Google sign-in is not configured');
    expect(html).not.toContain('<form');
  });
});
