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

/**
 * Formats a phone number or WhatsApp JID to clean human-readable international format
 * Examples:
 * - "6281234567890@s.whatsapp.net" -> "+62 812-3456-7890"
 * - "08123456789" -> "+62 812-345-6789"
 * - "+62812345678" -> "+62 812-345-678"
 */
export function formatPhoneNumber(phone: string): string {
  if (!phone) return '';
  let clean = phone.replace(/@s\.whatsapp\.net|@lid|@g\.us/g, '').replace(/\D/g, '');

  if (clean.startsWith('0')) {
    clean = '62' + clean.slice(1);
  }

  // Indonesian mobile numbers (starts with 628)
  if (clean.startsWith('628')) {
    const prefix = clean.slice(0, 5); // e.g. 62812
    const p1 = `+${prefix.slice(0, 2)} ${prefix.slice(2)}`;
    const rest = clean.slice(5);
    if (rest.length <= 4) {
      return `${p1}-${rest}`;
    } else if (rest.length <= 7) {
      return `${p1}-${rest.slice(0, 3)}-${rest.slice(3)}`;
    } else {
      return `${p1}-${rest.slice(0, 4)}-${rest.slice(4)}`;
    }
  }

  // Indonesian landline or other codes (starts with 62)
  if (clean.startsWith('62') && clean.length >= 9) {
    const area = clean.slice(0, 4);
    const rest = clean.slice(4);
    return `+${area.slice(0, 2)} ${area.slice(2)}-${rest.slice(0, 4)}-${rest.slice(4)}`;
  }

  return clean ? `+${clean}` : phone;
}
