import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function sanitizePhoneNumberClient(phoneNumber: string): string {
  // Remove all non-alphanumeric characters and replace with underscores
  // Keep only digits, letters, and convert spaces/special chars to underscores
  return phoneNumber
    .replace(/[^\w\d]/g, '_')  // Replace non-word chars with underscore
    .replace(/_+/g, '_')       // Replace multiple underscores with single
    .replace(/^_|_$/g, '');    // Remove leading/trailing underscores
}
