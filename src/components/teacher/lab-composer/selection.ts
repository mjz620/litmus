/**
 * Keep a <select>'s stored value reconciled with the options it currently
 * offers.
 *
 * The Composer captured these ids once at mount and refreshed them only when a
 * draft was loaded, so adding or removing a rule, objective, or piece of
 * equipment mid-session left the stored id pointing at something that no
 * longer existed. A <select> whose value matches no option displays its first
 * entry, so a teacher saw a valid-looking choice while the id behind it was
 * stale or empty — and "Add direction" then failed with "a related item is
 * missing" against a dropdown that plainly showed an item.
 *
 * Returns an id that is genuinely on offer, or an empty string so the
 * dependent control stays disabled. It never returns a value that looks
 * selectable but is not.
 */
export function reconciledSelection(
  current: string,
  available: readonly string[]
): string {
  return available.includes(current) ? current : (available[0] ?? "");
}
