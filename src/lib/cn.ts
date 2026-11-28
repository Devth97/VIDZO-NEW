import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

/** Merge class names the way shadcn/ui and Magic UI components expect. */
export const cn = (...inputs: ClassValue[]) => twMerge(clsx(inputs));
