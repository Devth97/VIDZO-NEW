'use client';
import type { ReactNode } from 'react';
import { Theme } from '@astryxdesign/core';
import { stoneTheme } from '@astryxdesign/theme-stone/built';

/** Astryx provides accessible primitives; VIDZO's beige/olive palette overrides its tokens in astryx-theme.css. Light only. */
export function DesignSystem({ children }: { children: ReactNode }) {
  return <Theme theme={stoneTheme} mode="light">{children}</Theme>;
}
