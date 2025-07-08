import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function sanitizePhoneNumberClient(phoneNumber: string): string {
  // Remove all non-alphanumeric characters and replace with underscores
  // Keep only digits, letters, and convert spaces/special chars to underscores

  const firstSanitized = phoneNumber.replace(/[^\w\d]/g, '_')  // Replace non-word chars with underscore
  .replace(/_+/g, '_')       // Replace multiple underscores with single
  .replace(/^_|_$/g, '');    // Remove leading/trailing underscores
  const formattedToTelnyx = formatTelnyxNumberClient(firstSanitized)
  return formattedToTelnyx
}

// Ensure we always send +E.164
export function formatTelnyxNumberClient(raw: string) {
  // strip everything but digits
  const digits = raw.replace(/\D/g, "");
  // add + if it's missing
  return digits.startsWith("+" ) ? digits : `+${digits}`;
}