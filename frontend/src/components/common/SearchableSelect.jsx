import React, { useState, useRef, useEffect, useId } from 'react';
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
    const [highlightedIndex, setHighlightedIndex] = useState(0);
    const containerRef = useRef(null);
    const searchRef = useRef(null);
    const triggerRef = useRef(null);
    const reactId = useId();
    const listboxId = `${id || reactId}-listbox`;

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

    // Focus search input when opening; reset highlight
    useEffect(() => {
        if (open) {
            searchRef.current?.focus();
            const selectedIdx = filtered.findIndex(o => o.value === value);
            setHighlightedIndex(selectedIdx >= 0 ? selectedIdx : 0);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [open]);

    // Keep highlight in range as the filtered list changes
    useEffect(() => {
        setHighlightedIndex((i) => Math.max(0, Math.min(i, filtered.length - 1)));
    }, [filtered.length]);

    const handleSelect = (opt) => {
        onChange(opt.value);
        setOpen(false);
        setSearch('');
        triggerRef.current?.focus();
    };

    const handleClear = (e) => {
        e.stopPropagation();
        onChange('');
    };

    const openAndFocus = () => {
        if (loading) return;
        setOpen(true);
    };

    const handleTriggerKeyDown = (e) => {
        if (loading) return;
        if (e.key === 'ArrowDown' || e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            openAndFocus();
        }
    };

    const handleSearchKeyDown = (e) => {
        if (e.key === 'ArrowDown') {
            e.preventDefault();
            setHighlightedIndex((i) => Math.min(i + 1, filtered.length - 1));
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            setHighlightedIndex((i) => Math.max(i - 1, 0));
        } else if (e.key === 'Enter') {
            e.preventDefault();
            const opt = filtered[highlightedIndex];
            if (opt) handleSelect(opt);
        } else if (e.key === 'Escape') {
            e.preventDefault();
            setOpen(false);
            setSearch('');
            triggerRef.current?.focus();
        } else if (e.key === 'Tab') {
            setOpen(false);
            setSearch('');
        }
    };

    const buttonStyle = {
        width: '100%',
        padding: '10px 36px 10px 14px',
        borderRadius: 8,
        border: `1px solid ${open ? colors.brand.primary : colors.border.primary}`,
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
        transition: 'border-color 0.15s, box-shadow 0.15s',
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
                ref={triggerRef}
                type="button"
                disabled={loading}
                role="combobox"
                aria-haspopup="listbox"
                aria-expanded={open}
                aria-controls={listboxId}
                onClick={() => !loading && setOpen(o => !o)}
                onKeyDown={handleTriggerKeyDown}
                onFocus={(e) => { e.currentTarget.style.boxShadow = `0 0 0 3px ${colors.brand.primary}33`; }}
                onBlur={(e) => { e.currentTarget.style.boxShadow = 'none'; }}
                style={buttonStyle}
            >
                <span style={{ flex: 1, wordBreak: 'break-word', lineHeight: 1.3, paddingLeft: 4 }}>
                    {loading ? 'Loading...' : (selectedLabel || placeholder)}
                </span>
                <span style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>
                    {value && !loading && (
                        <X
                            size={13}
                            role="button"
                            aria-label="Clear selection"
                            tabIndex={0}
                            onClick={handleClear}
                            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleClear(e); } }}
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
                            role="searchbox"
                            aria-label="Search options"
                            aria-autocomplete="list"
                            aria-controls={listboxId}
                            aria-activedescendant={filtered[highlightedIndex] ? `${listboxId}-option-${highlightedIndex}` : undefined}
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                            onKeyDown={handleSearchKeyDown}
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
                            <X
                                size={13}
                                role="button"
                                aria-label="Clear search"
                                tabIndex={0}
                                style={{ cursor: 'pointer', color: colors.text.secondary }}
                                onClick={() => setSearch('')}
                                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setSearch(''); } }}
                            />
                        )}
                    </div>

                    {/* Options list */}
                    <div role="listbox" id={listboxId} style={{ maxHeight: 220, overflowY: 'auto' }}>
                        {filtered.length === 0 ? (
                            <div style={{ padding: '10px 14px', color: colors.text.secondary, fontSize: 13 }}>
                                No results found
                            </div>
                        ) : (
                            filtered.map((opt, idx) => {
                                const isHighlighted = idx === highlightedIndex;
                                const isSelected = opt.value === value;
                                return (
                                    <div
                                        key={opt.value}
                                        id={`${listboxId}-option-${idx}`}
                                        role="option"
                                        aria-selected={isSelected}
                                        onClick={() => handleSelect(opt)}
                                        onMouseEnter={() => setHighlightedIndex(idx)}
                                        style={{
                                            padding: '9px 14px',
                                            cursor: 'pointer',
                                            fontSize: 13,
                                            color: isSelected ? colors.brand.primary : colors.text.primary,
                                            background: isHighlighted
                                                ? (colors.bg.hover || 'rgba(255,255,255,0.08)')
                                                : isSelected ? (colors.brand?.primaryAlpha || 'rgba(99,102,241,0.1)') : 'transparent',
                                            fontWeight: isSelected ? 600 : 400,
                                            transition: 'background 0.1s',
                                            wordBreak: 'break-word',
                                        }}
                                    >
                                        {opt.label}
                                    </div>
                                );
                            })
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

export default SearchableSelect;
