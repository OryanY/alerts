// utils/ruleSpecificity.js
// Client-side mirror of backend/services/incident/incidentHelpers.js's
// calculateRuleSpecificity — used only to *display* a rule's score next to
// another rule's score in RuleCard.jsx so an analyst can see which one would
// win a real overlap. This is a pure, single-rule scoring formula (Exact=10,
// Regex=7, Contains=3 per value, +100 if the rule is specific/not global) with
// no alert-matching logic, so mirroring it here carries none of the drift risk
// of duplicating doesAlertMatchRule/findAllMatches — if this formula ever
// changes, update both places together.
export function calculateRuleSpecificity(rule) {
  const conditions = rule?.conditions || {};
  let score = 0;
  Object.keys(conditions).forEach((key) => {
    if (key.endsWith('_exact')) score += 10;
    else if (key.endsWith('_regex')) score += 7;
    else if (key.endsWith('_contains')) score += 3 * (conditions[key]?.length || 1);
  });
  if (!rule?.is_global) score += 100;
  return score;
}
