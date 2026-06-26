// Build a free wa.me deep link (no paid API): opens the customer's WhatsApp
// chat with the message prefilled. The operator just hits send.

/** Keep only digits. AR mobiles already include the "9" (e.g. 549381...). */
export function normalizePhone(phone: string): string {
  return (phone ?? "").replace(/\D/g, "");
}

/**
 * Returns a https://wa.me/<digits>?text=<encoded> link, or null if the phone
 * has no usable digits.
 */
export function waMeLink(phone: string, text: string): string | null {
  const digits = normalizePhone(phone);
  if (digits.length < 6) return null;
  const query = text ? `?text=${encodeURIComponent(text)}` : "";
  return `https://wa.me/${digits}${query}`;
}
