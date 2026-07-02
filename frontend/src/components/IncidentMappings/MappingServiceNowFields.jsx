import React from 'react';
import { ChevronLeft } from 'lucide-react';
import SearchableSelect from '../common/SearchableSelect';
import { useTheme } from '../../contexts/ThemeContext';

const OTHER_VALUE = '___OTHER___';

const MappingServiceNowFields = ({
    form,
    setForm,
    networks,
    loadingNetworks,
    businessOptions,
    offeringOptions,
    loadingRelationships,
    onNetworkChange,
    onBusinessChange,
    onOfferingChange,
    useOtherNetwork,
    setUseOtherNetwork,
    otherNetwork,
    setOtherNetwork,
    useOtherBusiness,
    setUseOtherBusiness,
    otherBusiness,
    setOtherBusiness,
    useOtherOffering,
    setUseOtherOffering,
    otherOffering,
    setOtherOffering,
    assignmentGroups,
    loadingGroups,
    errors
}) => {
    const { colors } = useTheme();

    const getOptionsWithOther = (options) => [
        ...options,
        { value: OTHER_VALUE, label: '+ Other (Manual Entry)' }
    ];

    const hasNetwork = Boolean(form.u_network) || useOtherNetwork;

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

    const errorStyle = {
        color: colors.semantic.error,
        fontSize: 11,
        marginTop: 4,
        display: 'block'
    };

    const focusRing = (e) => { e.currentTarget.style.boxShadow = `0 0 0 3px ${colors.brand.primary}33`; };
    const blurRing = (e) => { e.currentTarget.style.boxShadow = 'none'; };

    return (
        <div
            style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(2, 1fr)',
                gap: 20,
            }}
        >
            {/* 1. Network (The Trigger) */}
            <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                    <label style={{ fontSize: 13, fontWeight: 600, color: colors.text.secondary }}>
                        Network
                    </label>
                    {useOtherNetwork && (
                        <button
                            type="button"
                            onClick={() => { setUseOtherNetwork(false); setForm({...form, u_network: ''}); }}
                            style={{ background: 'none', border: 'none', color: colors.brand.primary, fontSize: 11, cursor: 'pointer', display: 'flex', alignItems: 'center' }}
                        >
                            <ChevronLeft size={12} /> Back to List
                        </button>
                    )}
                </div>
                {useOtherNetwork ? (
                    <input
                        type="text"
                        autoFocus
                        placeholder="Enter network manually..."
                        value={otherNetwork}
                        onChange={(e) => setOtherNetwork(e.target.value)}
                        style={{ ...inputStyle, borderColor: errors.u_network ? colors.semantic.error : colors.border.primary }}
                        onFocus={focusRing}
                        onBlur={blurRing}
                        aria-invalid={!!errors.u_network}
                        aria-describedby={errors.u_network ? 'error-u_network' : undefined}
                    />
                ) : (
                    <div style={{ border: errors.u_network ? `1px solid ${colors.semantic.error}` : 'none', borderRadius: 8 }}>
                        <SearchableSelect
                            options={getOptionsWithOther(networks)}
                            value={form.u_network}
                            onChange={onNetworkChange}
                            placeholder="Select Network..."
                            loading={loadingNetworks}
                        />
                    </div>
                )}
                {errors.u_network && <span id="error-u_network" style={errorStyle}>{errors.u_network}</span>}
            </div>

            {/* 2. Service Offering (child) — drives the Business Service auto-fill */}
            <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                    <label style={{ fontSize: 13, fontWeight: 600, color: colors.text.secondary }}>
                        Service Offering
                    </label>
                    {useOtherOffering && (
                        <button
                            type="button"
                            onClick={() => { setUseOtherOffering(false); setForm({...form, service_offering: '', service_offering_label: ''}); }}
                            style={{ background: 'none', border: 'none', color: colors.brand.primary, fontSize: 11, cursor: 'pointer', display: 'flex', alignItems: 'center' }}
                        >
                            <ChevronLeft size={12} /> Back to List
                        </button>
                    )}
                </div>
                {useOtherOffering ? (
                    <input
                        type="text"
                        autoFocus
                        placeholder="Enter service offering manually..."
                        value={otherOffering}
                        onChange={(e) => setOtherOffering(e.target.value)}
                        style={{ ...inputStyle, borderColor: errors.service_offering ? colors.semantic.error : colors.border.primary }}
                        onFocus={focusRing}
                        onBlur={blurRing}
                        aria-invalid={!!errors.service_offering}
                        aria-describedby={errors.service_offering ? 'error-service_offering' : undefined}
                    />
                ) : (
                    <div style={{ border: errors.service_offering ? `1px solid ${colors.semantic.error}` : 'none', borderRadius: 8 }}>
                        <SearchableSelect
                            options={getOptionsWithOther(offeringOptions)}
                            value={form.service_offering}
                            disabled={!hasNetwork}
                            onChange={onOfferingChange}
                            placeholder={!hasNetwork ? 'Select Network First' : 'Select Service Offering...'}
                            loading={loadingRelationships}
                        />
                    </div>
                )}
                {errors.service_offering && <span id="error-service_offering" style={errorStyle}>{errors.service_offering}</span>}
            </div>

            {/* 3. Business Service (parent) — auto-filled from the offering, still editable */}
            <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                    <label style={{ fontSize: 13, fontWeight: 600, color: colors.text.secondary }}>
                        Business Service
                    </label>
                    {useOtherBusiness && (
                        <button
                            type="button"
                            onClick={() => { setUseOtherBusiness(false); setForm({...form, business_service: '', business_service_label: ''}); }}
                            style={{ background: 'none', border: 'none', color: colors.brand.primary, fontSize: 11, cursor: 'pointer', display: 'flex', alignItems: 'center' }}
                        >
                            <ChevronLeft size={12} /> Back to List
                        </button>
                    )}
                </div>
                {useOtherBusiness ? (
                    <input
                        type="text"
                        autoFocus
                        placeholder="Enter business service manually..."
                        value={otherBusiness}
                        onChange={(e) => setOtherBusiness(e.target.value)}
                        style={{ ...inputStyle, borderColor: errors.business_service ? colors.semantic.error : colors.border.primary }}
                        onFocus={focusRing}
                        onBlur={blurRing}
                        aria-invalid={!!errors.business_service}
                        aria-describedby={errors.business_service ? 'error-business_service' : undefined}
                    />
                ) : (
                    <div style={{ border: errors.business_service ? `1px solid ${colors.semantic.error}` : 'none', borderRadius: 8 }}>
                        <SearchableSelect
                            options={getOptionsWithOther(businessOptions)}
                            value={form.business_service}
                            disabled={!hasNetwork}
                            onChange={onBusinessChange}
                            placeholder={!hasNetwork ? 'Select Network First' : 'Auto-filled from Offering (or pick one)...'}
                            loading={loadingRelationships}
                        />
                    </div>
                )}
                {errors.business_service && <span id="error-business_service" style={errorStyle}>{errors.business_service}</span>}
            </div>

            {/* 4. Assignment Group (Standard Select) */}
            <div>
                <label style={{ display: 'block', marginBottom: 8, fontSize: 13, fontWeight: 600, color: colors.text.secondary }}>
                    Assignment Group
                </label>
                <div style={{ border: errors.assignment_group ? `1px solid ${colors.semantic.error}` : 'none', borderRadius: 8 }}>
                    <SearchableSelect
                        options={assignmentGroups}
                        value={form.assignment_group}
                        onChange={(val) => setForm({ ...form, assignment_group: val })}
                        placeholder="Select Group..."
                        loading={loadingGroups}
                    />
                </div>
                {errors.assignment_group && <span style={errorStyle}>{errors.assignment_group}</span>}
            </div>

            {/* 5. Impact Technology */}
            <div>
                <label style={{ display: 'block', marginBottom: 8, fontSize: 13, fontWeight: 600, color: colors.text.secondary }}>
                    Impact Technology
                </label>
                <input
                    type="text"
                    value={form.u_impact_technology}
                    onChange={(e) => setForm({ ...form, u_impact_technology: e.target.value })}
                    style={{ ...inputStyle, borderColor: errors.u_impact_technology ? colors.semantic.error : colors.border.primary }}
                    placeholder="e.g. {{ network }} Monitoring"
                    onFocus={focusRing}
                    onBlur={blurRing}
                    aria-invalid={!!errors.u_impact_technology}
                    aria-describedby={errors.u_impact_technology ? 'error-u_impact_technology' : undefined}
                />
                {errors.u_impact_technology && <span id="error-u_impact_technology" style={errorStyle}>{errors.u_impact_technology}</span>}
            </div>

            {/* 6. System Failure */}
            <div style={{ display: 'flex', alignItems: 'center' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer', userSelect: 'none' }}>
                    <input
                        type="checkbox"
                        checked={form.u_system_failure}
                        onChange={(e) => setForm({ ...form, u_system_failure: e.target.checked })}
                        style={{ width: 18, height: 18, accentColor: colors.brand.primary, cursor: 'pointer' }}
                    />
                    <span style={{ fontSize: 14, fontWeight: 600, color: colors.text.primary }}>
                        System Failure
                    </span>
                </label>
            </div>
        </div>
    );
};

export default MappingServiceNowFields;
