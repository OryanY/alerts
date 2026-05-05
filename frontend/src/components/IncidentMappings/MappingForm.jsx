import React, { useEffect, useState, useCallback } from 'react';
import {
    Plus,
    Edit,
    Save,
} from 'lucide-react';
import { API_BASE } from '../../utils/constants';
import { useTheme } from '../../contexts/ThemeContext';
import { withAlpha } from '../../utils/formatters';
import { safeJson } from '../../utils/api';
import MappingFormPatternBuilder from './MappingFormPatternBuilder';
import TemplateHints from './TemplateHints';
import MappingServiceNowFields from './MappingServiceNowFields';
import MappingCustomFields from './MappingCustomFields';

const baseMandatoryFields = [
    'service_offering',
    'business_service',
    'u_network',
    'u_impact_technology',
    'assignment_group',
    'u_system_failure',
];

const excludeFromCustom = [
    '_id',
    'grafana_names',
    'created_at',
    'updated_at',
    ...baseMandatoryFields,
];

const OTHER_VALUE = '___OTHER___';



const MappingForm = ({
    PATTERN_TYPES,
    PATTERN_COLORS,
    assignmentGroups,
    loadingGroups,
    editingItem,
    onSaved,
    onCancel,
    onError,
}) => {
    const { colors } = useTheme();

    const [form, setForm] = useState({
        grafana_names: [],
        service_offering: '',
        business_service: '',
        u_network: '',
        u_impact_technology: '',
        assignment_group: '',
        u_system_failure: false,
    });

    const [customFields, setCustomFields] = useState({});
    const [errors, setErrors] = useState({});

    // Reference Data State
    const [networks, setNetworks] = useState([]);
    const [loadingNetworks, setLoadingNetworks] = useState(false);
    const [businessServices, setBusinessServices] = useState([]);
    const [loadingBusiness, setLoadingBusiness] = useState(false);
    const [serviceOfferings, setServiceOfferings] = useState([]);
    const [loadingOfferings, setLoadingOfferings] = useState(false);

    // "Other" manual input state
    const [useOtherNetwork, setUseOtherNetwork] = useState(false);
    const [otherNetwork, setOtherNetwork] = useState('');
    const [useOtherBusiness, setUseOtherBusiness] = useState(false);
    const [otherBusiness, setOtherBusiness] = useState('');
    const [useOtherOffering, setUseOtherOffering] = useState(false);
    const [otherOffering, setOtherOffering] = useState('');

    const resetLocal = useCallback(() => {
        setForm({
            grafana_names: [],
            service_offering: '',
            business_service: '',
            u_network: '',
            u_impact_technology: '',
            assignment_group: '',
            u_system_failure: false,
        });
        setCustomFields({});
        setErrors({});
        setUseOtherNetwork(false);
        setOtherNetwork('');
        setUseOtherBusiness(false);
        setOtherBusiness('');
        setUseOtherOffering(false);
        setOtherOffering('');
    }, []);

    // Fetch initial data (Assignment groups come from parent, Networks we fetch here)
    useEffect(() => {
        const fetchNetworks = async () => {
            try {
                setLoadingNetworks(true);
                const res = await fetch(`${API_BASE}/incidents/networks`, { credentials: 'include' });
                const data = await safeJson(res);
                if (data.success) {
                    setNetworks(data.data || []);
                }
            } catch (e) {
                console.warn('Could not fetch networks:', e.message);
            } finally {
                setLoadingNetworks(false);
            }
        };
        fetchNetworks();
    }, []);

    // Cascade: Network -> Business Services
    useEffect(() => {
        if (!form.u_network || useOtherNetwork) {
            setBusinessServices([]);
            return;
        }

        const fetchBusinessServices = async () => {
            try {
                setLoadingBusiness(true);
                const res = await fetch(`${API_BASE}/incidents/business-services?network=${encodeURIComponent(form.u_network)}`, { credentials: 'include' });
                const data = await safeJson(res);
                if (data.success) {
                    setBusinessServices(data.data || []);
                }
            } catch (e) {
                console.warn('Could not fetch business services:', e.message);
            } finally {
                setLoadingBusiness(false);
            }
        };
        fetchBusinessServices();
    }, [form.u_network, useOtherNetwork]);

    // Cascade: Business Service -> Service Offerings (also filtered by the same network as business services)
    useEffect(() => {
        if (!form.business_service || useOtherBusiness) {
            setServiceOfferings([]);
            return;
        }

        const fetchServiceOfferings = async () => {
            try {
                setLoadingOfferings(true);
                // Filter service offerings by the same network — consistent with how business services are filtered
                const networkParam = !useOtherNetwork && form.u_network
                    ? `&network=${encodeURIComponent(form.u_network)}`
                    : '';
                const res = await fetch(`${API_BASE}/incidents/service-offerings?business_service=${encodeURIComponent(form.business_service)}${networkParam}`, { credentials: 'include' });
                const data = await safeJson(res);
                if (data.success) {
                    setServiceOfferings(data.data || []);
                }
            } catch (e) {
                console.warn('Could not fetch service offerings:', e.message);
            } finally {
                setLoadingOfferings(false);
            }
        };
        fetchServiceOfferings();
    }, [form.business_service, form.u_network, useOtherBusiness, useOtherNetwork]);

    // Handle Edit Mode Initialization
    useEffect(() => {
        if (!editingItem) {
            resetLocal();
            return;
        }

        const patterns = (editingItem.grafana_names || []).map((item) => {
            if (typeof item === 'string') {
                return { value: item, type: 'exact' };
            }
            return item;
        });

        setForm({
            grafana_names: patterns,
            service_offering: editingItem.service_offering || '',
            business_service: editingItem.business_service || '',
            u_network: editingItem.u_network || '',
            u_impact_technology: editingItem.u_impact_technology || '',
            assignment_group: editingItem.assignment_group || '',
            u_system_failure: Boolean(editingItem.u_system_failure),
        });

        const custom = {};
        Object.keys(editingItem).forEach((key) => {
            if (!excludeFromCustom.includes(key)) {
                custom[key] = editingItem[key] || '';
            }
        });
        setCustomFields(custom);

    }, [editingItem, resetLocal]);

    const addCustomField = () => {
        const fieldName = prompt('Enter field name (e.g., u_eck_name, u_oracle_error):');
        if (!fieldName) return;
        const sanitized = fieldName.trim().toLowerCase().replace(/\s+/g, '_');
        if (excludeFromCustom.includes(sanitized)) {
            alert('This field name is reserved or already exists as a base field');
            return;
        }
        if (customFields[sanitized] !== undefined) {
            alert('This custom field already exists');
            return;
        }
        setCustomFields((prev) => ({ ...prev, [sanitized]: '' }));
    };

    const removeCustomField = (fieldName) => {
        setCustomFields((prev) => {
            const updated = { ...prev };
            delete updated[fieldName];
            return updated;
        });
    };

    const updateCustomField = (fieldName, value) => {
        setCustomFields((prev) => ({ ...prev, [fieldName]: value }));
    };

    const validateForm = () => {
        const newErrors = {};
        if (!form.grafana_names || form.grafana_names.length === 0) {
            newErrors.grafana_names = 'At least one Grafana application pattern is required';
        }
        form.grafana_names.forEach((pattern, idx) => {
            if (!pattern.value || !pattern.value.trim()) {
                newErrors[`grafana_names_${idx}`] = `Pattern ${idx + 1}: Value is required`;
            }
            if (pattern.type === 'regex') {
                try { new RegExp(pattern.value); } catch (e) { newErrors[`grafana_names_${idx}`] = `Pattern ${idx + 1}: Invalid regex`; }
            }
        });

        const requiredFields = {
            service_offering: 'Service Offering',
            business_service: 'Business Service',
            u_network: 'Network',
            u_impact_technology: 'Impact Technology',
            assignment_group: 'Assignment Group',
        };

        Object.entries(requiredFields).forEach(([key, label]) => {
            const val = key === 'u_network' && useOtherNetwork ? otherNetwork :
                       key === 'business_service' && useOtherBusiness ? otherBusiness :
                       key === 'service_offering' && useOtherOffering ? otherOffering :
                       form[key];
            
            if (!val || !val.toString().trim()) {
                newErrors[key] = `${label} is required`;
            }
        });

        return newErrors;
    };

    const save = async (e) => {
        e.preventDefault();
        const validationErrors = validateForm();
        if (Object.keys(validationErrors).length > 0) {
            setErrors(validationErrors);
            onError?.('Please fix the errors in the form before saving.');
            return;
        }
        setErrors({});

        try {
            const dataToSave = {
                ...form,
                ...customFields,
                u_network: useOtherNetwork ? otherNetwork : form.u_network,
                business_service: useOtherBusiness ? otherBusiness : form.business_service,
                service_offering: useOtherOffering ? otherOffering : form.service_offering,
                u_impact_technology: form.u_impact_technology?.trim(),
                assignment_group: form.assignment_group?.trim(),
            };

            const url = editingItem ? `${API_BASE}/incidents/system-mappings/${editingItem._id}` : `${API_BASE}/incidents/system-mappings`;
            const method = editingItem ? 'PUT' : 'POST';

            const res = await fetch(url, {
                method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(dataToSave),
                credentials: 'include'
            });

            const data = await safeJson(res);
            if (data.success) {
                onSaved?.();
            } else {
                onError?.(data.error?.message || 'Failed to save mapping');
            }
        } catch (e2) {
            onError?.('Error saving mapping: ' + e2.message);
        }
    };

    const getOptionsWithOther = (options) => [
        ...options,
        { value: OTHER_VALUE, label: '+ Other (Manual Entry)' }
    ];

    const inputStyle = {
        width: '100%',
        padding: '10px 12px',
        borderRadius: 8,
        border: `1px solid ${colors.border.primary}`,
        background: colors.bg.primary,
        color: colors.text.primary,
        fontSize: 14,
        outline: 'none',
    };

    return (
        <div
            style={{
                background: colors.bg.secondary,
                borderRadius: 12,
                padding: 32,
                marginBottom: 32,
                border: `1px solid ${colors.border.primary}`,
                borderTop: `4px solid ${colors.brand.primary}`,
            }}
        >
            <div>
                <h3
                    style={{
                        margin: '0 0 8px 0',
                        fontSize: 20,
                        fontWeight: 600,
                        color: colors.text.primary,
                        display: 'flex',
                        alignItems: 'center',
                        gap: 12,
                    }}
                >
                    {editingItem ? (
                        <Edit size={20} style={{ color: colors.brand.primary }} />
                    ) : (
                        <Plus size={20} style={{ color: colors.brand.primary }} />
                    )}
                    {editingItem ? 'Update Mapping' : 'Create New Mapping'}
                </h3>
                <p
                    style={{
                        margin: '0 0 32px 0',
                        color: colors.text.secondary,
                        fontSize: 14,
                    }}
                >
                    {editingItem
                        ? 'Update how these applications create incidents'
                        : 'Configure how alerts from Grafana applications create ServiceNow incidents.'}
                </p>

                <form
                    onSubmit={save}
                    style={{ display: 'flex', flexDirection: 'column', gap: 24 }}
                >
                    {/* Grafana Application Patterns */}
                    <MappingFormPatternBuilder
                        grafanaNames={form.grafana_names}
                        onPatternsChange={(newPatterns) =>
                            setForm((prev) => ({ ...prev, grafana_names: newPatterns }))
                        }
                        PATTERN_TYPES={PATTERN_TYPES}
                        PATTERN_COLORS={PATTERN_COLORS}
                        errors={errors}
                    />

                    {/* Template Hints */}
                    <TemplateHints colors={colors} />

                    {/* ServiceNow Fields */}
                    <MappingServiceNowFields
                        form={form}
                        setForm={setForm}
                        networks={networks}
                        loadingNetworks={loadingNetworks}
                        businessServices={businessServices}
                        loadingBusiness={loadingBusiness}
                        serviceOfferings={serviceOfferings}
                        loadingOfferings={loadingOfferings}
                        useOtherNetwork={useOtherNetwork}
                        setUseOtherNetwork={setUseOtherNetwork}
                        otherNetwork={otherNetwork}
                        setOtherNetwork={setOtherNetwork}
                        useOtherBusiness={useOtherBusiness}
                        setUseOtherBusiness={setUseOtherBusiness}
                        otherBusiness={otherBusiness}
                        setOtherBusiness={setOtherBusiness}
                        useOtherOffering={useOtherOffering}
                        setUseOtherOffering={setUseOtherOffering}
                        otherOffering={otherOffering}
                        setOtherOffering={setOtherOffering}
                        assignmentGroups={assignmentGroups}
                        loadingGroups={loadingGroups}
                        errors={errors}
                    />

                    {/* Custom Fields */}
                    <MappingCustomFields
                        customFields={customFields}
                        onAddCustomField={addCustomField}
                        onRemoveCustomField={removeCustomField}
                        onUpdateCustomField={updateCustomField}
                    />

                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12, marginTop: 12, paddingTop: 20, borderTop: `1px solid ${colors.border.secondary}` }}>
                        <button
                            type="button"
                            onClick={onCancel}
                            style={{ background: 'transparent', color: colors.text.secondary, border: 'none', padding: '10px 20px', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            style={{
                                background: `linear-gradient(135deg, ${colors.brand.primary} 0%, ${colors.brand.primaryHover} 100%)`,
                                color: colors.text.inverse,
                                border: 'none',
                                borderRadius: 8,
                                padding: '10px 24px',
                                fontSize: 14,
                                fontWeight: 600,
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                gap: 8,
                                boxShadow: `0 4px 12px ${withAlpha(colors.brand.primary, '40')}`,
                            }}
                        >
                            <Save size={18} />
                            {editingItem ? 'Update Mapping' : 'Save Mapping'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default MappingForm;
