import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

/**
 * Standard Shadcn UI utility function to safely merge Tailwind CSS class names
 */
export function cn(...inputs) {
  return twMerge(clsx(inputs));
}
