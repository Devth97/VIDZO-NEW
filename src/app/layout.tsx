import type { Metadata, Viewport } from 'next';
import { WorkspaceProvider } from '@/components/workspace-provider';
import { mode } from '@/lib/server/config';
import './globals.css';
import './editorial.css';

export const metadata: Metadata = { title: { default: 'VIDZO — Original product ads, directed by you', template: '%s · VIDZO' }, description: 'Plan a distinct product ad from an authorized reference. Your product, your creative direction, clear approvals and upfront credit quotes.' };
export const viewport: Viewport = { width: 'device-width', initialScale: 1, themeColor: '#F7F5F0' };
export const dynamic = 'force-dynamic';

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return <html lang="en"><body><WorkspaceProvider mode={mode()}>{children}</WorkspaceProvider></body></html>;
}
