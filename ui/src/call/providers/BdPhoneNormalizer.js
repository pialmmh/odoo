/**
 * Bangladesh-specific phone number normalizer. Produces a set of variants
 * that CRM lookup can match against Leads/Contacts/Accounts (which may
 * have been stored in any of these common forms).
 *
 * Variants, given "+8801711223344" / "8801711223344" / "01711223344" /
 * "1711223344":
 *    +8801711223344
 *    8801711223344
 *    01711223344
 *    1711223344
 */
export class BdPhoneNormalizer {
  normalize(phone) {
    if (!phone) return [];
    const digits = String(phone).replace(/\D/g, '');
    if (!digits) return [];

    let local;
    if (digits.startsWith('880')) local = digits.slice(3);
    else if (digits.startsWith('0')) local = digits.slice(1);
    else local = digits;

    if (!/^1\d{9}$/.test(local)) {
      // Not a BD mobile — fall back to raw digits.
      return [digits];
    }

    return [`+880${local}`, `880${local}`, `0${local}`, local];
  }
}
