import type { Metadata, Viewport } from 'next';
import { WorkspaceProvider } from '@/components/workspace-provider';
import { mode } from '@/lib/server/config';
import './globals.css';

export const metadata: Metadata = { title: { default: 'Vidzo — Proven concepts. Your brand. Reimagined.', template: '%s · Vidzo' }, description: 'Turn an authorized reference into a distinctly original product ad. Your product, clear approvals, upfront credit quotes.' };
export const viewport: Viewport = { width: 'device-width', initialScale: 1, themeColor: '#F7F5F0' };
export const dynamic = 'force-dynamic';

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return <html lang="en"><body><WorkspaceProvider mode={mode()}>{children}</WorkspaceProvider></body></html>;
}
