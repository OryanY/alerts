// config/swagger.js - OpenAPI/Swagger specification
const swaggerSpec = {
    openapi: '3.0.0',
    info: {
        title: 'Alert Management API',
        version: '5.0.0',
        description: 'Backend API for managing Grafana alerts and creating ServiceNow incidents',
        contact: {
            name: 'Development Team'
        }
    },
    servers: [
        {
            url: '/api',
            description: 'API Base Path'
        }
    ],
    tags: [
        { name: 'Health', description: 'Health check endpoints' },
        { name: 'Config', description: 'Application configuration' },
        { name: 'Alerts', description: 'Alert data and filtering' },
        { name: 'Incidents', description: 'Incident creation and management' },
        { name: 'System Mappings', description: 'Grafana to ServiceNow field mappings' },
        { name: 'Incident Rules', description: 'Override rules for incident creation' }
    ],
    paths: {
        '/health': {
            get: {
                tags: ['Health'],
                summary: 'Health check',
                description: 'Returns server health status and uptime',
                responses: {
                    '200': {
                        description: 'Server is healthy',
                        content: {
                            'application/json': {
                                schema: {
                                    type: 'object',
                                    properties: {
                                        success: { type: 'boolean', example: true },
                                        status: { type: 'string', example: 'healthy' },
                                        uptime: { type: 'number', example: 12345.67 },
                                        timestamp: { type: 'string', format: 'date-time' }
                                    }
                                }
                            }
                        }
                    }
                }
            }
        },
        '/config': {
            get: {
                tags: ['Config'],
                summary: 'Get application configuration',
                description: 'Returns shifts, duration thresholds, timezone, and feature flags',
                responses: {
                    '200': { description: 'Configuration object' }
                }
            }
        },
        '/alerts': {
            get: {
                tags: ['Alerts'],
                summary: 'List alerts with filtering',
                description: 'Returns paginated alert data with optional filters',
                parameters: [
                    { name: 'startDate', in: 'query', schema: { type: 'string', format: 'date' }, description: 'Start date (YYYY-MM-DD)' },
                    { name: 'endDate', in: 'query', schema: { type: 'string', format: 'date' }, description: 'End date (YYYY-MM-DD)' },
                    { name: 'application', in: 'query', schema: { type: 'string' }, description: 'Filter by application name' },
                    { name: 'limit', in: 'query', schema: { type: 'integer', default: 100 }, description: 'Max results' },
                    { name: 'offset', in: 'query', schema: { type: 'integer', default: 0 }, description: 'Pagination offset' }
                ],
                responses: {
                    '200': { description: 'List of alerts' }
                }
            }
        },
        '/incidents/assignment-groups': {
            get: {
                tags: ['Incidents'],
                summary: 'List assignment groups',
                description: 'Returns all cached assignment groups from ServiceNow',
                responses: {
                    '200': { description: 'List of assignment groups' }
                }
            }
        },
        '/incidents/assignment-groups/sync': {
            get: {
                tags: ['Incidents'],
                summary: 'Sync assignment groups from ServiceNow',
                description: 'Fetches latest assignment groups from ServiceNow and updates local cache',
                responses: {
                    '200': { description: 'Sync successful with count' }
                }
            }
        },
        '/incidents/incident': {
            get: {
                tags: ['Incidents'],
                summary: 'Create incident (GET)',
                description: 'Creates incident from alert data. GET method for webhook compatibility. Redirects to ServiceNow on success.',
                parameters: [
                    { name: 'application', in: 'query', required: true, schema: { type: 'string' }, description: '* Required - Application name' },
                    { name: 'object_name', in: 'query', required: true, schema: { type: 'string' }, description: '* Required - Object name' },
                    { name: 'node_name', in: 'query', required: true, schema: { type: 'string' }, description: '* Required - Node/server name' },
                    { name: 'message', in: 'query', required: true, schema: { type: 'string' }, description: '* Required - Alert message' },
                    { name: 'operator', in: 'query', required: true, schema: { type: 'string' }, description: '* Required - Operator name' },
                    { name: 'time_created', in: 'query', schema: { type: 'string' }, description: 'Alert creation time' },
                    { name: 'network', in: 'query', schema: { type: 'string' }, description: 'Network identifier' },
                    { name: 'user', in: 'query', schema: { type: 'string' }, description: 'User identifier' }
                ],
                responses: {
                    '302': { description: 'Redirect to ServiceNow incident' },
                    '404': { description: 'No system mapping found' }
                }
            },
            post: {
                tags: ['Incidents'],
                summary: 'Create incident (POST)',
                description: 'Creates incident from alert data via POST body',
                requestBody: {
                    required: true,
                    content: {
                        'application/json': {
                            schema: {
                                $ref: '#/components/schemas/AlertQuery'
                            }
                        }
                    }
                },
                responses: {
                    '200': { description: 'Incident created successfully' },
                    '404': { description: 'No system mapping found' }
                }
            }
        },
        '/incidents/incident/simulate': {
            post: {
                tags: ['Incidents'],
                summary: 'Simulate incident creation',
                description: 'Simulates incident creation without actually creating it. Returns the payload that would be sent.',
                requestBody: {
                    required: true,
                    content: {
                        'application/json': {
                            schema: {
                                $ref: '#/components/schemas/AlertQuery'
                            }
                        }
                    }
                },
                responses: {
                    '200': { description: 'Simulation result with payload and rules applied' }
                }
            }
        },
        '/incidents/system-mappings': {
            get: {
                tags: ['System Mappings'],
                summary: 'List all system mappings',
                responses: { '200': { description: 'List of system mappings' } }
            },
            post: {
                tags: ['System Mappings'],
                summary: 'Create system mapping',
                requestBody: {
                    required: true,
                    content: {
                        'application/json': {
                            schema: {
                                $ref: '#/components/schemas/SystemMapping'
                            }
                        }
                    }
                },
                responses: {
                    '201': { description: 'Mapping created' },
                    '409': { description: 'Mapping already exists' }
                }
            }
        },
        '/incidents/system-mappings/{id}': {
            put: {
                tags: ['System Mappings'],
                summary: 'Update system mapping',
                parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
                requestBody: {
                    content: {
                        'application/json': {
                            schema: { $ref: '#/components/schemas/SystemMapping' }
                        }
                    }
                },
                responses: { '200': { description: 'Updated' } }
            },
            delete: {
                tags: ['System Mappings'],
                summary: 'Delete system mapping',
                parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
                responses: { '200': { description: 'Deleted' } }
            }
        },
        '/incidents/incident-rules': {
            get: {
                tags: ['Incident Rules'],
                summary: 'List all incident rules',
                parameters: [{ name: 'application', in: 'query', schema: { type: 'string' }, description: 'Filter by application' }],
                responses: { '200': { description: 'List of rules' } }
            },
            post: {
                tags: ['Incident Rules'],
                summary: 'Create incident rule',
                requestBody: {
                    required: true,
                    content: {
                        'application/json': {
                            schema: { $ref: '#/components/schemas/IncidentRule' }
                        }
                    }
                },
                responses: { '201': { description: 'Rule created' } }
            }
        },
        '/incidents/incident-rules/{id}': {
            put: {
                tags: ['Incident Rules'],
                summary: 'Update incident rule',
                parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
                requestBody: {
                    content: {
                        'application/json': {
                            schema: { $ref: '#/components/schemas/IncidentRule' }
                        }
                    }
                },
                responses: { '200': { description: 'Updated' } }
            },
            delete: {
                tags: ['Incident Rules'],
                summary: 'Delete incident rule',
                parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
                responses: { '200': { description: 'Deleted' } }
            }
        },
        '/incidents/incident-rules/{id}/toggle': {
            patch: {
                tags: ['Incident Rules'],
                summary: 'Enable/disable incident rule',
                parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
                requestBody: {
                    required: true,
                    content: {
                        'application/json': {
                            schema: {
                                type: 'object',
                                required: ['enabled'],
                                properties: {
                                    enabled: { type: 'boolean', description: 'Set to true to enable, false to disable' }
                                }
                            }
                        }
                    }
                },
                responses: { '200': { description: 'Toggled' } }
            }
        },
        '/incidents/incident-logs': {
            get: {
                tags: ['Incidents'],
                summary: 'Get incident history logs',
                description: 'Returns audit trail of all created incidents',
                parameters: [
                    { name: 'limit', in: 'query', schema: { type: 'integer', default: 50 } },
                    { name: 'skip', in: 'query', schema: { type: 'integer', default: 0 } },
                    { name: 'search', in: 'query', schema: { type: 'string' } }
                ],
                responses: { '200': { description: 'List of incident logs' } }
            }
        }
    },
    components: {
        schemas: {
            AlertQuery: {
                type: 'object',
                required: ['application', 'object_name', 'node_name', 'message', 'operator'],
                properties: {
                    application: { type: 'string', maxLength: 100, description: '* REQUIRED - Grafana application name' },
                    object_name: { type: 'string', maxLength: 100, description: '* REQUIRED - Object identifier' },
                    node_name: { type: 'string', maxLength: 100, description: '* REQUIRED - Node/server name' },
                    message: { type: 'string', maxLength: 500, description: '* REQUIRED - Alert message content' },
                    operator: { type: 'string', maxLength: 50, description: '* REQUIRED - Operator/source' },
                    time_created: { type: 'string', description: 'ISO timestamp or empty' },
                    network: { type: 'string', maxLength: 50, description: 'Network identifier' },
                    user: { type: 'string', description: 'User identifier' }
                }
            },
            SystemMapping: {
                type: 'object',
                required: ['grafana_names', 'service_offering', 'business_service', 'u_network', 'u_impact_technology', 'assignment_group'],
                properties: {
                    grafana_names: {
                        type: 'array',
                        minItems: 1,
                        description: '* REQUIRED - Array of Grafana app names or match objects',
                        items: {
                            oneOf: [
                                { type: 'string' },
                                {
                                    type: 'object',
                                    required: ['value', 'type'],
                                    properties: {
                                        value: { type: 'string' },
                                        type: { type: 'string', enum: ['exact', 'contains', 'regex'] }
                                    }
                                }
                            ]
                        }
                    },
                    service_offering: { type: 'string', description: '* REQUIRED - ServiceNow service offering' },
                    business_service: { type: 'string', description: '* REQUIRED - ServiceNow business service' },
                    u_network: { type: 'string', description: '* REQUIRED - Network field' },
                    u_impact_technology: { type: 'string', description: '* REQUIRED - Impact technology' },
                    assignment_group: { type: 'string', description: '* REQUIRED - Assignment group sys_id' },
                    u_system_failure: { type: 'boolean', default: false, description: 'System failure flag' }
                }
            },
            IncidentRule: {
                type: 'object',
                required: ['rule_name', 'conditions'],
                properties: {
                    system_mapping_id: { type: 'string', nullable: true, description: 'Link to system mapping (null for global rules)' },
                    is_global: { type: 'boolean', default: false, description: 'If true, applies to all mappings' },
                    rule_name: { type: 'string', description: '* REQUIRED - Human-readable rule name' },
                    description: { type: 'string', description: 'Optional description' },
                    conditions: {
                        type: 'object',
                        description: '* REQUIRED - At least one condition required',
                        properties: {
                            message_contains: { type: 'array', items: { type: 'string' } },
                            message_regex: { type: 'string' },
                            message_exact: { type: 'string' },
                            node_name_contains: { type: 'array', items: { type: 'string' } },
                            node_name_regex: { type: 'string' },
                            node_name_exact: { type: 'string' },
                            object_name_contains: { type: 'array', items: { type: 'string' } },
                            network: { type: 'string' },
                            operator_contains: { type: 'array', items: { type: 'string' } }
                        }
                    },
                    logic_operator: { type: 'string', enum: ['OR', 'AND'], default: 'OR' },
                    incident_overrides: {
                        type: 'object',
                        description: 'Fields to override in the incident',
                        properties: {
                            short_description: { type: 'string' },
                            description: { type: 'string' },
                            u_system_failure: { type: 'boolean' },
                            assignment_group: { type: 'string' },
                            u_operational_impact: { type: 'string' }
                        }
                    },
                    enabled: { type: 'boolean', default: true }
                }
            }
        }
    }
};

module.exports = { swaggerSpec };
