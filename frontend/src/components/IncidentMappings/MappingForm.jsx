import React, { useEffect, useState, useCallback, useMemo, useRef } from 'react';
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
    'service_offering_label',
    'business_service_label',
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

const emptyForm = () => ({
    grafana_names: [],
    // Business Service (parent) + Service Offering (child) store the ServiceNow
    // sys_id; the *_label fields hold the display name. sys_id is immune to the
    // accidental-spaces bug that used to leave the reference field empty.
    service_offering: '',
    service_offering_label: '',
    business_service: '',
    business_service_label: '',
    u_network: '',
    u_impact_technology: '',
    assignment_group: '',
    u_system_failure: false,
});

const MappingForm = ({
    PATTERN_TYPES,
    PATTERN_COLORS,
    assignmentGroups,
    loadingGroups,
    editingItem,
    prefillApplication,
    onSaved,
    onCancel,
    onError,
}) => {
    const { colors } = useTheme();

    const [form, setForm] = useState(emptyForm);

    const [customFields, setCustomFields] = useState({});
    const [errors, setErrors] = useState({});

    // Reference Data State
    const [networks, setNetworks] = useState([]);
    const [loadingNetworks, setLoadingNetworks] = useState(false);
    const [defaultNetwork, setDefaultNetwork] = useState('');
    // cmdb_ci_rel pairs: [{ parent: {value,label}, child: {value,label} }]
    const [relationships, setRelationships] = useState([]);
    const [loadingRelationships, setLoadingRelationships] = useState(false);
    const didPreselectNetwork = useRef(false);

    // "Other" manual input state (the override path — CMDB data is often
    // incomplete, so analysts must always be able to type a value by hand).
    const [useOtherNetwork, setUseOtherNetwork] = useState(false);
    const [otherNetwork, setOtherNetwork] = useState('');
    const [useOtherBusiness, setUseOtherBusiness] = useState(false);
    const [otherBusiness, setOtherBusiness] = useState('');
    const [useOtherOffering, setUseOtherOffering] = useState(false);
    const [otherOffering, setOtherOffering] = useState('');

    const resetLocal = useCallback(() => {
        setForm(emptyForm());
        setCustomFields({});
        setErrors({});
        setUseOtherNetwork(false);
        setOtherNetwork('');
        setUseOtherBusiness(false);
        setOtherBusiness('');
        setUseOtherOffering(false);
        setOtherOffering('');
        didPreselectNetwork.current = false;
    }, []);

    // Fetch networks (assignment groups come from parent). Capture the
    // instance default so new mappings can preselect it.
    useEffect(() => {
        const fetchNetworks = async () => {
            try {
                setLoadingNetworks(true);
                const res = await fetch(`${API_BASE}/incidents/networks`, { credentials: 'include' });
                const data = await safeJson(res);
                if (data.success) {
                    setNetworks(data.data || []);
                    setDefaultNetwork(data.default || '');
                }
            } catch (e) {
                console.warn('Could not fetch networks:', e.message);
            } finally {
                setLoadingNetworks(false);
            }
        };
        fetchNetworks();
    }, []);

    // Preselect the default network once, for new mappings only.
    useEffect(() => {
        if (editingItem || didPreselectNetwork.current) return;
        if (!defaultNetwork || form.u_network) return;
        didPreselectNetwork.current = true;
        setForm((prev) => ({ ...prev, u_network: defaultNetwork }));
    }, [defaultNetwork, editingItem, form.u_network]);

    // Network -> Business Service ⇄ Service Offering relationships (cmdb_ci_rel).
    useEffect(() => {
        if (!form.u_network || useOtherNetwork) {
            setRelationships([]);
            return;
        }

        const fetchRelationships = async () => {
            try {
                setLoadingRelationships(true);
                const res = await fetch(
                    `${API_BASE}/incidents/service-relationships?network=${encodeURIComponent(form.u_network)}`,
                    { credentials: 'include' }
                );
                const data = await safeJson(res);
                if (data.success) {
                    setRelationships(data.data || []);
                }
            } catch (e) {
                console.warn('Could not fetch service relationships:', e.message);
            } finally {
                setLoadingRelationships(false);
            }
        };
        fetchRelationships();
    }, [form.u_network, useOtherNetwork]);

    // Handle Edit Mode Initialization
    useEffect(() => {
        if (!editingItem) {
            resetLocal();
            // New mapping opened from the "needs mapping" queue: seed the first
            // Grafana pattern with the unmapped application (exact match).
            if (prefillApplication) {
                setForm((prev) => ({ ...prev, grafana_names: [{ value: prefillApplication, type: 'exact' }] }));
            }
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
            // Fall back to the stored value when an older mapping has no label.
            service_offering_label: editingItem.service_offering_label || editingItem.service_offering || '',
            business_service: editingItem.business_service || '',
            business_service_label: editingItem.business_service_label || editingItem.business_service || '',
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

    }, [editingItem, resetLocal, prefillApplication]);

    // ---- Derived option lists from the relationship pairs ----

    // child sys_id -> parent {value,label}, for offering→business auto-fill.
    // Per-field errors for the custom-fields section (stored under custom_<name>).
    const customFieldErrors = useMemo(() => {
        const out = {};
        Object.keys(errors).forEach((k) => { if (k.startsWith('custom_')) out[k.slice('custom_'.length)] = errors[k]; });
        return out;
    }, [errors]);

    const offeringParentMap = useMemo(() => {
        const map = new Map();
        relationships.forEach((r) => {
            if (r.child?.value) map.set(r.child.value, r.parent);
        });
        return map;
    }, [relationships]);

    const businessOptions = useMemo(() => {
        const seen = new Map();
        relationships.forEach((r) => {
            const p = r.parent;
            if (p?.value && !seen.has(p.value)) seen.set(p.value, { value: p.value, label: p.label });
        });
        let opts = Array.from(seen.values());
        // Keep the current selection visible even if it isn't in the fetched set
        // (edit mode, or a value the analyst typed manually earlier).
        if (form.business_service && !useOtherBusiness && !seen.has(form.business_service)) {
            opts = [{ value: form.business_service, label: form.business_service_label || form.business_service }, ...opts];
        }
        return opts;
    }, [relationships, form.business_service, form.business_service_label, useOtherBusiness]);

    const offeringOptions = useMemo(() => {
        // When a business service is chosen, narrow offerings to its children.
        const source = form.business_service && !useOtherBusiness
            ? relationships.filter((r) => r.parent?.value === form.business_service)
            : relationships;
        const seen = new Map();
        source.forEach((r) => {
            const c = r.child;
            if (c?.value && !seen.has(c.value)) seen.set(c.value, { value: c.value, label: c.label });
        });
        let opts = Array.from(seen.values());
        if (form.service_offering && !useOtherOffering && !seen.has(form.service_offering)) {
            opts = [{ value: form.service_offering, label: form.service_offering_label || form.service_offering }, ...opts];
        }
        return opts;
    }, [relationships, form.business_service, form.service_offering, form.service_offering_label, useOtherBusiness, useOtherOffering]);

    // ---- Selection handlers ----

    const handleNetworkChange = (val) => {
        if (val === OTHER_VALUE) { setUseOtherNetwork(true); return; }
        setForm({
            ...form,
            u_network: val,
            business_service: '', business_service_label: '',
            service_offering: '', service_offering_label: '',
        });
    };

    const handleBusinessChange = (val) => {
        if (val === OTHER_VALUE) { setUseOtherBusiness(true); return; }
        const opt = businessOptions.find((o) => o.value === val);
        // Changing the business service clears the offering — it may belong to a different parent.
        setForm({
            ...form,
            business_service: val,
            business_service_label: opt?.label || val,
            service_offering: '', service_offering_label: '',
        });
    };

    const handleOfferingChange = (val) => {
        if (val === OTHER_VALUE) { setUseOtherOffering(true); return; }
        const opt = offeringOptions.find((o) => o.value === val);
        const parent = offeringParentMap.get(val);
        const next = {
            ...form,
            service_offering: val,
            service_offering_label: opt?.label || val,
        };
        // Auto-fill the parent Business Service, unless the analyst is overriding it manually.
        if (parent && !useOtherBusiness) {
            next.business_service = parent.value;
            next.business_service_label = parent.label;
        }
        setForm(next);
    };

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
            // Manual ("Other") entries store the typed name as both value and label.
            const businessValue = useOtherBusiness ? otherBusiness.trim() : form.business_service;
            const offeringValue = useOtherOffering ? otherOffering.trim() : form.service_offering;

            const dataToSave = {
                ...form,
                ...customFields,
                u_network: useOtherNetwork ? otherNetwork.trim() : form.u_network,
                business_service: businessValue,
                business_service_label: useOtherBusiness ? otherBusiness.trim() : (form.business_service_label || businessValue),
                service_offering: offeringValue,
                service_offering_label: useOtherOffering ? otherOffering.trim() : (form.service_offering_label || offeringValue),
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
                        businessOptions={businessOptions}
                        offeringOptions={offeringOptions}
                        loadingRelationships={loadingRelationships}
                        onNetworkChange={handleNetworkChange}
                        onBusinessChange={handleBusinessChange}
                        onOfferingChange={handleOfferingChange}
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
                        errors={customFieldErrors}
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
