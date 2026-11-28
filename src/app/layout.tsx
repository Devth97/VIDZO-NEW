import type { Metadata, Viewport } from 'next';
import { WorkspaceProvider } from '@/components/workspace-provider';
import { mode } from '@/lib/server/config';
import './layers.css';
import '@astryxdesign/core/astryx.css';
import '@astryxdesign/theme-stone/theme.css';
import './globals.css';
import './editorial.css';
import './creation.css';
import './creative-workspace.css';
import './creative-entry.css';
import './astryx-theme.css';
import './tailwind.css';
import './playful.css';
import './magic.css';
import './review.css';
import './video-showcase.css';
import './reference-workflow.css';
import { DesignSystem } from '@/components/design-system';

export const metadata: Metadata = { title: { default: 'VIDZO — Original product ads, directed by you', template: '%s · VIDZO' }, description: 'Plan a distinct product ad from an authorized reference. Your product, your creative direction, clear approvals and upfront credit quotes.' };
export const viewport: Viewport = { width: 'device-width', initialScale: 1, themeColor: '#F7F5F0' };
export const dynamic = 'force-dynamic';

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return <html lang="en"><body><DesignSystem><WorkspaceProvider mode={mode()}>{children}</WorkspaceProvider></DesignSystem></body></html>;
}
