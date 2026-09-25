/**
 * Formats a phone number or ID into a valid WhatsApp JID
 * Examples:
 * - "08123456789" -> "628123456789@s.whatsapp.net"
 * - "+62 812-3456-789" -> "628123456789@s.whatsapp.net"
 * - "628123456789@s.whatsapp.net" -> "628123456789@s.whatsapp.net"
 * - "120363025123456789@g.us" -> "120363025123456789@g.us"
 */
export function formatToWhatsAppJid(target: string): string {
  const trimmed = target.trim();

  // If already a group JID or broadcast JID, return as is
  if (trimmed.endsWith('@g.us') || trimmed.endsWith('@broadcast') || trimmed.endsWith('@newsletter')) {
    return trimmed;
  }

  // If already formatted as user JID
  if (trimmed.endsWith('@s.whatsapp.net')) {
    return trimmed;
  }

  // Remove all non-numeric characters
  let cleanNumber = trimmed.replace(/\D/g, '');

  // Handle standard Indonesian prefix (08xx -> 628xx)
  if (cleanNumber.startsWith('0')) {
    cleanNumber = '62' + cleanNumber.slice(1);
  }

  return `${cleanNumber}@s.whatsapp.net`;
}

/**
 * Normalizes phone number strictly for pairing code (digits only)
 */
export function formatPhoneNumberForPairing(phone: string): string {
  let clean = phone.trim().replace(/\D/g, '');
  if (clean.startsWith('0')) {
    clean = '62' + clean.slice(1);
  }
  return clean;
}
