export const CONDITION_OPERATORS = {
    contains: { label: 'Contains', icon: '🔍' },
    equals: { label: 'Equals', icon: '=' },
    regex: { label: 'Regex Pattern', icon: '🎯' },
};

export const CONDITION_FIELDS = {
    message: { label: 'Alert Message', icon: '💬', placeholder: 'CPU usage high' },
    node_name: { label: 'Node Name', icon: '🖥️', placeholder: 'db-prod-01' },
    object_name: { label: 'Object Name', icon: '🎯', placeholder: 'eck' },
    network: { label: 'Network', icon: '🌐', placeholder: 'nh' },
    operator: { label: 'Operator', icon: '👤', placeholder: 'matok' },
};

export const EXCLUDED_MAPPING_FIELDS = [
    '_id',
    'grafana_names',
    'service_offering',
    'business_service',
    'u_network',
    'u_impact_technology',
    'assignment_group',
    'u_system_failure',
    'created_at',
    'updated_at',
];
