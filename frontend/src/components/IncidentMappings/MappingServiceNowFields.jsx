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
    businessServices,
    loadingBusiness,
    serviceOfferings,
    loadingOfferings,
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
                    />
                ) : (
                    <div style={{ border: errors.u_network ? `1px solid ${colors.semantic.error}` : 'none', borderRadius: 8 }}>
                        <SearchableSelect
                            options={getOptionsWithOther(networks)}
                            value={form.u_network}
                            onChange={(val) => {
                                if (val === OTHER_VALUE) {
                                    setUseOtherNetwork(true);
                                } else {
                                    setForm({ ...form, u_network: val, business_service: '', service_offering: '' });
                                }
                            }}
                            placeholder="Select Network..."
                            loading={loadingNetworks}
                        />
                    </div>
                )}
                {errors.u_network && <span style={errorStyle}>{errors.u_network}</span>}
            </div>

            {/* 2. Business Service (Depends on Network) */}
            <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                    <label style={{ fontSize: 13, fontWeight: 600, color: colors.text.secondary }}>
                        Business Service
                    </label>
                    {useOtherBusiness && (
                        <button 
                            type="button" 
                            onClick={() => { setUseOtherBusiness(false); setForm({...form, business_service: ''}); }}
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
                    />
                ) : (
                    <div style={{ border: errors.business_service ? `1px solid ${colors.semantic.error}` : 'none', borderRadius: 8 }}>
                        <SearchableSelect
                            options={getOptionsWithOther(businessServices)}
                            value={form.business_service}
                            disabled={!form.u_network && !useOtherNetwork}
                            onChange={(val) => {
                                if (val === OTHER_VALUE) {
                                    setUseOtherBusiness(true);
                                } else {
                                    setForm({ ...form, business_service: val, service_offering: '' });
                                }
                            }}
                            placeholder={(!form.u_network && !useOtherNetwork) ? "Select Network First" : "Select Business Service..."}
                            loading={loadingBusiness}
                        />
                    </div>
                )}
                {errors.business_service && <span style={errorStyle}>{errors.business_service}</span>}
            </div>

            {/* 3. Service Offering (Depends on Business Service) */}
            <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                    <label style={{ fontSize: 13, fontWeight: 600, color: colors.text.secondary }}>
                        Service Offering
                    </label>
                    {useOtherOffering && (
                        <button 
                            type="button" 
                            onClick={() => { setUseOtherOffering(false); setForm({...form, service_offering: ''}); }}
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
                    />
                ) : (
                    <div style={{ border: errors.service_offering ? `1px solid ${colors.semantic.error}` : 'none', borderRadius: 8 }}>
                        <SearchableSelect
                            options={getOptionsWithOther(serviceOfferings)}
                            value={form.service_offering}
                            disabled={!form.business_service && !useOtherBusiness}
                            onChange={(val) => {
                                if (val === OTHER_VALUE) {
                                    setUseOtherOffering(true);
                                } else {
                                    setForm({ ...form, service_offering: val });
                                }
                            }}
                            placeholder={(!form.business_service && !useOtherBusiness) ? "Select Business Service First" : "Select Service Offering..."}
                            loading={loadingOfferings}
                        />
                    </div>
                )}
                {errors.service_offering && <span style={errorStyle}>{errors.service_offering}</span>}
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
                />
                {errors.u_impact_technology && <span style={errorStyle}>{errors.u_impact_technology}</span>}
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
