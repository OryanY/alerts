// test/incidentHelpers.test.js
// Run with: npm test  (node --test)
// Characterization tests for the pure incident-building / rule-matching
// functions — these pin the behavior that writes to ServiceNow.

const { test, describe } = require('node:test');
const assert = require('node:assert/strict');

const helpers = require('../services/incident/incidentHelpers');
const { DEFAULT_INCIDENT_SETTINGS } = require('../services/incident/incidentSettingsDefaults');

const ALERT = {
    application: 'myapp',
    object_name: 'disk-c',
    node_name: 'srv-01',
    message: 'CPU high on node',
    operator: 'noc',
    network: 'corp',
    time_created: '2026-06-11 10:00:00'
};

const MAPPING = {
    _id: 'mapping-id',
    grafana_names: [{ value: 'myapp', type: 'exact' }],
    service_offering: 'Offering A',
    business_service: 'Service A',
    u_network: 'corp',
    assignment_group: 'Group A',
    u_system_failure: false,
    created_at: new Date(),
    updated_at: new Date()
};

describe('buildIncidentData', () => {
    test('mapping only → required fields + default templates + filler fields', () => {
        const data = helpers.buildIncidentData(MAPPING, {}, ALERT);

        assert.equal(data.service_offering, 'Offering A');
        assert.equal(data.business_service, 'Service A');
        assert.equal(data.u_network, 'corp');
        assert.equal(data.assignment_group, 'Group A');
        assert.equal(data.u_system_failure, false);

        // Templated content defaults
        assert.equal(data.short_description, 'קפצה התראה על: disk-c בניטור של - myapp');
        assert.equal(data.description, 'ההתראה:\n        CPU high on node');

        // Mandatory-field fillers
        assert.equal(data.u_perational_impact, 'בבדיקה');
        assert.equal(data.u_phone_voip, '1234');
        assert.equal(data.u_mobile_phone, '1234');
        assert.equal(data.u_computer_name, 'My Computer');

        // Mapping metadata must never leak into the payload
        assert.equal(data._id, undefined);
        assert.equal(data.grafana_names, undefined);
        assert.equal(data.created_at, undefined);
    });

    test('rule overrides win over mapping and templates', () => {
        const overrides = {
            assignment_group: 'Override Group',
            short_description: 'custom {{node_name}} alert',
            u_system_failure: 'true'
        };
        const data = helpers.buildIncidentData(MAPPING, overrides, ALERT);

        assert.equal(data.assignment_group, 'Override Group');
        assert.equal(data.short_description, 'custom srv-01 alert');
        assert.equal(data.u_system_failure, true);
    });

    test('literal fields are not template-substituted', () => {
        const mapping = { ...MAPPING, assignment_group: 'Group {{application}}' };
        const data = helpers.buildIncidentData(mapping, {}, ALERT);
        assert.equal(data.assignment_group, 'Group {{application}}');
    });

    test('non-literal mapping fields ARE template-substituted', () => {
        const mapping = { ...MAPPING, u_custom_note: 'node={{node_name}}' };
        const data = helpers.buildIncidentData(mapping, {}, ALERT);
        assert.equal(data.u_custom_note, 'node=srv-01');
    });

    test('missing required field throws', () => {
        const mapping = { ...MAPPING, assignment_group: '' };
        assert.throws(
            () => helpers.buildIncidentData(mapping, {}, ALERT),
            /Required field 'assignment_group' is missing/
        );
    });

    test('custom settings change templates, defaults and required fields without code changes', () => {
        const settings = {
            ...DEFAULT_INCIDENT_SETTINGS,
            required_fields: ['assignment_group', 'u_system_failure'],
            content_templates: { short_description: 'ALERT: {{message}}' },
            default_fields: { u_phone_voip: '9999' }
        };
        const mapping = { assignment_group: 'G', u_system_failure: true };
        const data = helpers.buildIncidentData(mapping, {}, ALERT, settings);

        assert.equal(data.short_description, 'ALERT: CPU high on node');
        assert.equal(data.u_phone_voip, '9999');
        assert.equal(data.u_mobile_phone, undefined);  // not in custom default_fields
        assert.equal(data.description, undefined);     // not in custom content_templates
        assert.equal(data.service_offering, undefined); // no longer required, not on mapping
    });

    test('empty-string default_fields values are skipped (field omitted)', () => {
        const settings = {
            ...DEFAULT_INCIDENT_SETTINGS,
            default_fields: { u_phone_voip: '' }
        };
        const data = helpers.buildIncidentData(MAPPING, {}, ALERT, settings);
        assert.equal(data.u_phone_voip, undefined);
    });
});

describe('replaceTemplateVariables', () => {
    test('substitutes known variables, with or without spaces', () => {
        assert.equal(
            helpers.replaceTemplateVariables('{{application}} / {{ node_name }}', ALERT),
            'myapp / srv-01'
        );
    });

    test('unknown variables are left untouched; missing values become empty', () => {
        assert.equal(helpers.replaceTemplateVariables('{{nope}}', ALERT), '{{nope}}');
        assert.equal(helpers.replaceTemplateVariables('[{{network}}]', { ...ALERT, network: undefined }), '[]');
    });
});

describe('normalizeGrafanaAlert', () => {
    test('replaces % in message and lowercases object_name', () => {
        const out = helpers.normalizeGrafanaAlert({ ...ALERT, message: 'disk 90% full', object_name: 'DISK-C' });
        assert.equal(out.message, 'disk 90 percent  full');
        assert.equal(out.object_name, 'disk-c');
    });

    test('conditional rewrite: vmwere + esx → virtu_cyber', () => {
        const hit = helpers.normalizeGrafanaAlert({ ...ALERT, application: 'vmwere', object_name: 'ESX-host-1' });
        assert.equal(hit.application, 'virtu_cyber');

        const miss = helpers.normalizeGrafanaAlert({ ...ALERT, application: 'vmwere', object_name: 'other', message: 'no match' });
        assert.equal(miss.application, 'vmwere');
    });

    test('unconditional rewrite: l-twix → twix', () => {
        const out = helpers.normalizeGrafanaAlert({ ...ALERT, application: 'l-twix' });
        assert.equal(out.application, 'twix');
    });
});

describe('rule matching', () => {
    const rule = (conditions, extra = {}) => ({ rule_name: 'r', conditions, ...extra });

    test('contains / exact / regex conditions', () => {
        assert.equal(helpers.doesAlertMatchRule(ALERT, rule({ message_contains: ['cpu'] })), true);
        assert.equal(helpers.doesAlertMatchRule(ALERT, rule({ node_name_exact: 'SRV-01' })), true);
        assert.equal(helpers.doesAlertMatchRule(ALERT, rule({ message_regex: '^CPU' })), true);
        assert.equal(helpers.doesAlertMatchRule(ALERT, rule({ message_contains: ['memory'] })), false);
    });

    test('AND requires all field groups to match', () => {
        const conditions = { message_contains: ['cpu'], node_name_exact: 'other' };
        assert.equal(helpers.doesAlertMatchRule(ALERT, rule(conditions, { logic_operator: 'AND' })), false);
        assert.equal(helpers.doesAlertMatchRule(ALERT, rule(conditions, { logic_operator: 'OR' })), true);
    });

    test('invalid regex never matches (and does not throw)', () => {
        assert.equal(helpers.doesAlertMatchRule(ALERT, rule({ message_regex: '(' })), false);
    });

    test('specificity: exact=10, regex=7, contains=3/term, non-global +100', () => {
        assert.equal(helpers.calculateRuleSpecificity({ is_global: true, conditions: { message_exact: 'x' } }), 10);
        assert.equal(helpers.calculateRuleSpecificity({ is_global: true, conditions: { message_regex: 'x' } }), 7);
        assert.equal(helpers.calculateRuleSpecificity({ is_global: true, conditions: { message_contains: ['a', 'b'] } }), 6);
        assert.equal(helpers.calculateRuleSpecificity({ is_global: false, conditions: { message_exact: 'x' } }), 110);
    });

    test('findAllMatches sorts matches by score, highest first', () => {
        const weak = rule({ message_contains: ['cpu'] }, { rule_name: 'weak', is_global: true });
        const strong = rule({ node_name_exact: 'srv-01' }, { rule_name: 'strong', is_global: false });
        const matches = helpers.findAllMatches(ALERT, [weak, strong]);
        assert.equal(matches.length, 2);
        assert.equal(matches[0].rule.rule_name, 'strong');
        assert.equal(matches[1].rule.rule_name, 'weak');
    });
});

describe('grafana pattern validation', () => {
    test('valid patterns are sanitized to lowercase objects', () => {
        const out = helpers.validateGrafanaPatterns(['MyApp']);
        assert.deepEqual(out, [{ value: 'myapp', type: 'exact' }]);
    });

    test('invalid exact pattern and invalid regex throw', () => {
        assert.throws(() => helpers.validateGrafanaPatterns([{ value: 'has space', type: 'exact' }]));
        assert.throws(() => helpers.validateGrafanaPatterns([{ value: '(', type: 'regex' }]));
        assert.throws(() => helpers.validateGrafanaPatterns([]));
    });
});
