import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown, Search, X } from 'lucide-react';
import { useTheme } from '../../contexts/ThemeContext';

/**
 * SearchableSelect – a searchable, keyboard-navigable dropdown.
 *
 * Props:
 *   options   – [{ value, label }]
 *   value     – currently selected value
 *   onChange  – (value) => void
 *   placeholder – string shown when nothing selected
 *   loading   – bool
 *   id        – optional HTML id
 */
const SearchableSelect = ({ options = [], value, onChange, placeholder = 'Select...', loading = false, id }) => {
    const { colors } = useTheme();
    const [open, setOpen] = useState(false);
    const [search, setSearch] = useState('');
    const containerRef = useRef(null);
    const searchRef = useRef(null);

    const selectedLabel = options.find(o => o.value === value)?.label || '';
    const filtered = search
        ? options.filter(o => o.label.toLowerCase().includes(search.toLowerCase()))
        : options;

    // Close on outside click
    useEffect(() => {
        const handler = (e) => {
            if (containerRef.current && !containerRef.current.contains(e.target)) {
                setOpen(false);
                setSearch('');
            }
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, []);

    // Focus search input when opening
    useEffect(() => {
        if (open && searchRef.current) searchRef.current.focus();
    }, [open]);

    const handleSelect = (opt) => {
        onChange(opt.value);
        setOpen(false);
        setSearch('');
    };

    const handleClear = (e) => {
        e.stopPropagation();
        onChange('');
    };

    const buttonStyle = {
        width: '100%',
        padding: '10px 36px 10px 14px',
        borderRadius: 8,
        border: `1px solid ${open ? colors.brand?.primary || '#6366f1' : colors.border.primary}`,
        background: colors.bg.primary,
        color: value ? colors.text.primary : colors.text.secondary,
        fontSize: 14,
        outline: 'none',
        cursor: loading ? 'not-allowed' : 'pointer',
        textAlign: 'left',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 8,
        position: 'relative',
        transition: 'border-color 0.15s',
        opacity: loading ? 0.6 : 1,
        minHeight: 44,
    };

    const dropdownStyle = {
        position: 'absolute',
        zIndex: 9999,
        top: '100%',
        left: 0,
        right: 0,
        marginTop: 4,
        background: colors.bg.secondary || colors.bg.primary,
        border: `1px solid ${colors.border.primary}`,
        borderRadius: 8,
        boxShadow: '0 8px 24px rgba(0,0,0,0.25)',
        overflow: 'hidden',
    };

    return (
        <div ref={containerRef} style={{ position: 'relative', width: '100%' }} id={id}>
            {/* Trigger button */}
            <button
                type="button"
                disabled={loading}
                onClick={() => !loading && setOpen(o => !o)}
                style={buttonStyle}
            >
                <span style={{ flex: 1, wordBreak: 'break-word', lineHeight: 1.3, paddingLeft: 4 }}>
                    {loading ? 'Loading...' : (selectedLabel || placeholder)}
                </span>
                <span style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>
                    {value && !loading && (
                        <X
                            size={13}
                            onClick={handleClear}
                            style={{ cursor: 'pointer', color: colors.text.secondary }}
                        />
                    )}
                    <ChevronDown
                        size={15}
                        style={{
                            color: colors.text.secondary,
                            transform: open ? 'rotate(180deg)' : 'rotate(0deg)',
                            transition: 'transform 0.15s',
                        }}
                    />
                </span>
            </button>

            {/* Dropdown */}
            {open && (
                <div style={dropdownStyle}>
                    {/* Search box */}
                    <div style={{ padding: '8px 10px', borderBottom: `1px solid ${colors.border.primary}`, display: 'flex', alignItems: 'center', gap: 8 }}>
                        <Search size={14} color={colors.text.secondary} />
                        <input
                            ref={searchRef}
                            type="text"
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                            placeholder="Search..."
                            style={{
                                border: 'none',
                                outline: 'none',
                                background: 'transparent',
                                color: colors.text.primary,
                                fontSize: 13,
                                flex: 1,
                            }}
                        />
                        {search && (
                            <X size={13} style={{ cursor: 'pointer', color: colors.text.secondary }} onClick={() => setSearch('')} />
                        )}
                    </div>

                    {/* Options list */}
                    <div style={{ maxHeight: 220, overflowY: 'auto' }}>
                        {filtered.length === 0 ? (
                            <div style={{ padding: '10px 14px', color: colors.text.secondary, fontSize: 13 }}>
                                No results found
                            </div>
                        ) : (
                            filtered.map(opt => (
                                <div
                                    key={opt.value}
                                    onClick={() => handleSelect(opt)}
                                    style={{
                                        padding: '9px 14px',
                                        cursor: 'pointer',
                                        fontSize: 13,
                                        color: opt.value === value ? (colors.brand?.primary || '#6366f1') : colors.text.primary,
                                        background: opt.value === value ? (colors.brand?.primaryAlpha || 'rgba(99,102,241,0.1)') : 'transparent',
                                        fontWeight: opt.value === value ? 600 : 400,
                                        transition: 'background 0.1s',
                                        wordBreak: 'break-word',
                                    }}
                                    onMouseEnter={e => e.currentTarget.style.background = colors.bg.hover || 'rgba(255,255,255,0.05)'}
                                    onMouseLeave={e => e.currentTarget.style.background = opt.value === value ? (colors.brand?.primaryAlpha || 'rgba(99,102,241,0.1)') : 'transparent'}
                                >
                                    {opt.label}
                                </div>
                            ))
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

export default SearchableSelect;