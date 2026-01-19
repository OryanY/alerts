// services/incident/IncidentRuleEngine.js - Rule matching and pattern matching logic
/**
 * IncidentRuleEngine - Handles rule matching and pattern matching
 * Single Responsibility: Business logic for matching alerts to rules
 */
class IncidentRuleEngine {
    // Check if app name matches a pattern (exact, contains, or regex)
    matchesGrafanaPattern(applicationName, pattern) {
        const normalizedApp = applicationName.toLowerCase();
        const normalizedPattern = pattern.value.toLowerCase();

        switch (pattern.type) {
            case 'exact':
                return normalizedApp === normalizedPattern;

            case 'contains':
                return normalizedApp.includes(normalizedPattern);

            case 'regex':
                try {
                    const regex = new RegExp(normalizedPattern, 'i');
                    return regex.test(applicationName);
                } catch (e) {
                    console.warn(`Invalid regex pattern ${normalizedPattern}:`, e);
                    return false;
                }

            default:
                return normalizedApp === normalizedPattern;
        }
    }

    // Calculate how specific a rule is (higher score = more specific)
    calculateRuleSpecificity(rule) {
        const { conditions } = rule;
        let score = 0;

        const weights = { exact: 10, regex: 7, contains: 3 };

        Object.keys(conditions).forEach(key => {
            if (key.endsWith('_exact')) score += weights.exact;
            else if (key.endsWith('_regex')) score += weights.regex;
            else if (key.endsWith('_contains')) {
                score += weights.contains * (conditions[key]?.length || 1);
            }
        });

        // Boost specific (non-global) rules to prioritize them over global rules
        if (!rule.is_global) {
            score += 100;
        }

        return score;
    }

    // Check if a field value matches the conditions
    checkFieldConditions(value, conditions, fieldPrefix) {
        const results = [];

        // Check 'contains' conditions (array of terms)
        if (conditions[`${fieldPrefix}_contains`]?.length) {
            conditions[`${fieldPrefix}_contains`].forEach(term => {
                results.push(value && value.toLowerCase().includes(term.toLowerCase()));
            });
        }

        // Check 'exact' condition
        if (conditions[`${fieldPrefix}_exact`]) {
            results.push(value && value.toLowerCase() === conditions[`${fieldPrefix}_exact`].toLowerCase());
        }

        // Check 'regex' condition
        if (conditions[`${fieldPrefix}_regex`]) {
            try {
                const regex = new RegExp(conditions[`${fieldPrefix}_regex`], 'i');
                results.push(value && regex.test(value));
            } catch (e) {
                console.warn(`⚠️  Invalid regex in rule for ${fieldPrefix}:`, conditions[`${fieldPrefix}_regex`]);
                results.push(false);
            }
        }

        return results;
    }

    // Evaluate results based on AND/OR logic
    evaluateFieldResults(results, logicOperator) {
        if (results.length === 0) return null;

        if (logicOperator === 'AND' && results.length > 1) {
            return results.every(result => result === true);
        }
        return results.some(result => result === true);
    }

    // Check if an alert matches a rule
    doesAlertMatchRule(alertData, rule) {
        const { conditions, logic_operator = 'OR' } = rule;
        const { message, node_name, object_name, network, operator } = alertData;

        const conditionGroups = [];

        // Evaluate all field conditions
        ['message', 'node_name', 'object_name', 'operator'].forEach(field => {
            const value = alertData[field];
            const results = this.checkFieldConditions(value, conditions, field);
            const match = this.evaluateFieldResults(results, logic_operator);
            if (match !== null) conditionGroups.push(match);
        });

        // Network special handling
        const networkResults = this.checkFieldConditions(network, conditions, 'network');
        const networkMatch = this.evaluateFieldResults(networkResults, logic_operator);
        if (networkMatch !== null) {
            conditionGroups.push(networkMatch);
        } else if (conditions.network) {
            conditionGroups.push(network && network.toLowerCase().includes(conditions.network.toLowerCase()));
        }

        if (conditionGroups.length === 0) return false;

        return logic_operator === 'AND'
            ? conditionGroups.every(result => result === true)
            : conditionGroups.some(result => result === true);
    }

    // Find the most specific rule that matches this alert
    findBestMatch(alertData, rules) {
        const matches = this.findAllMatches(alertData, rules);
        return matches.length > 0 ? matches[0].rule : null;
    }

    // Find all rules that match, sorted by specificity
    findAllMatches(alertData, rules) {
        if (!rules || rules.length === 0) return [];

        // Filter to only matching rules and calculate scores
        const matches = rules
            .filter(rule => this.doesAlertMatchRule(alertData, rule))
            .map(rule => ({
                rule,
                score: this.calculateRuleSpecificity(rule),
                is_global: !!rule.is_global
            }));

        // Sort by specificity (highest score first)
        matches.sort((a, b) => b.score - a.score);

        return matches;
    }

    // Validate that regex patterns in conditions are valid
    validateRuleConditions(conditions) {
        const regexFields = [
            'message_regex',
            'node_name_regex',
            'object_name_regex',
            'network_regex',
            'operator_regex'
        ];

        regexFields.forEach(field => {
            if (conditions[field]) {
                try {
                    new RegExp(conditions[field]);
                } catch (e) {
                    throw new Error(`Invalid regex pattern in ${field}: ${e.message}`);
                }
            }
        });
    }
}

module.exports = { IncidentRuleEngine };
