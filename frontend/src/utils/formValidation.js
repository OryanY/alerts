// utils/formValidation.js
// Small shared validation helpers used by RuleForm and MappingForm — the two
// forms validate different domain objects (conditions vs. patterns) but share
// the same "is this a valid regex" and "does an equivalent item already exist
// elsewhere, excluding the one being edited" shapes.

// Returns an error string if `value` isn't a valid regex, else null.
export function regexError(value) {
  try {
    new RegExp(value);
    return null;
  } catch (e) {
    return `Invalid regex — ${e.message}`;
  }
}

// Returns the first item in `items` for which `matches(item)` is true,
// excluding the item whose _id equals `excludeId` (the one being edited).
export function findDuplicate(items, matches, excludeId) {
  return (items || []).find(
    (item) => String(item._id) !== String(excludeId) && matches(item)
  );
}
