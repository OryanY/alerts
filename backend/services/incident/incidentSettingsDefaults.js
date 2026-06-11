// services/incident/incidentSettingsDefaults.js
// -------------------------------------------------------------------
// SINGLE SOURCE OF TRUTH for incident field configuration defaults.
//
// The live values are stored in the `incident_settings` Mongo collection
// and are editable from the UI (Incidents → Incident Defaults tab) —
// changing them does NOT require a code change or pod restart.
// The values below are only the fallback used when nothing has been
// saved yet (and the baseline that "Reset to defaults" restores).
// -------------------------------------------------------------------

const DEFAULT_INCIDENT_SETTINGS = Object.freeze({
    // ServiceNow fields that MUST be present on every incident payload.
    // Sourced from the system mapping unless a rule override provides them.
    required_fields: [
        'service_offering',
        'business_service',
        'u_network',
        'assignment_group',
        'u_system_failure'
    ],

    // Fields whose values are used verbatim — {{variable}} placeholders
    // inside them are NOT substituted (they are ServiceNow reference values).
    literal_fields: [
        'assignment_group',
        'service_offering',
        'business_service'
    ],

    // Alert fields that may be referenced as {{variable}} inside templates.
    template_variables: [
        'application',
        'object_name',
        'node_name',
        'message',
        'time_created',
        'operator',
        'network'
    ],

    // Templates applied when neither the mapping nor a rule override
    // provided the field. Supports {{variable}} substitution.
    content_templates: {
        short_description: 'קפצה התראה על: {{object_name}} בניטור של - {{application}}',
        description: 'ההתראה:\n        {{message}}'
    },

    // Mandatory-in-ServiceNow filler fields, applied only when missing.
    // (Values like "1234" are intentional placeholders — these SN fields
    // are mandatory but have no meaningful value for automated incidents.)
    default_fields: {
        u_perational_impact: 'בבדיקה', // intentional typo — matches the real ServiceNow field name
        u_phone_voip: '1234',
        u_mobile_phone: '1234',
        u_computer_name: 'My Computer'
    }
});

module.exports = { DEFAULT_INCIDENT_SETTINGS };
