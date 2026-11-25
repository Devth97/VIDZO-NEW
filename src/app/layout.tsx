import type { Metadata, Viewport } from 'next';
import { WorkspaceProvider } from '@/components/workspace-provider';
import './globals.css';
export const metadata: Metadata = { title: { default: 'Vidzo — Your next great ad starts here', template: '%s · Vidzo' }, description: 'Turn an authorized reference into a distinctly original product ad. Your brand, clear approvals, upfront costs.' };
export const viewport: Viewport = { width: 'device-width', initialScale: 1, themeColor: '#F7F5F0' };
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return <html lang="en"><body><WorkspaceProvider demo={process.env.VIDZO_MODE !== 'live'}>{children}</WorkspaceProvider></body></html>;
}
