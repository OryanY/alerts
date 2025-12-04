import { useState, useEffect, useRef } from 'react';
import { ChevronDown } from 'lucide-react';

export const CustomSelect = ({ value, onChange, options, placeholder, disabled, colors }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const ref = useRef(null);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (ref.current && !ref.current.contains(e.target)) {
        setIsOpen(false);
        setSearchTerm('');
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const filteredOptions = options.filter((opt) =>
    opt.label.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const selectedLabel = options.find((opt) => opt.value === value)?.label || placeholder;

  return (
    <div ref={ref} style={{ position: 'relative', width: '100%' }}>
      <button
        onClick={() => !disabled && setIsOpen(!isOpen)}
        disabled={disabled}
        style={{
          width: '100%',
          padding: '10px 12px',
          background: colors.bg.secondary,
          border: `1px solid ${colors.border.primary}`,
          borderRadius: 8,
          fontSize: 14,
          color: value ? colors.text.primary : colors.text.tertiary,
          cursor: disabled ? 'not-allowed' : 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          opacity: disabled ? 0.5 : 1,
          transition: 'all 0.2s ease',
        }}
        onMouseEnter={(e) =>
          !disabled && (e.currentTarget.style.borderColor = colors.border.secondary)
        }
        onMouseLeave={(e) => (e.currentTarget.style.borderColor = colors.border.primary)}
      >
        <span
          style={{
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            flex: 1,
            textAlign: 'left',
          }}
        >
          {selectedLabel}
        </span>
        <ChevronDown
          size={16}
          style={{
            marginLeft: 8,
            transform: isOpen ? 'rotate(180deg)' : 'rotate(0)',
            transition: 'transform 0.2s ease',
          }}
        />
      </button>

      {isOpen && (
        <div
          style={{
            position: 'absolute',
            top: '100%',
            left: 0,
            right: 0,
            marginTop: 4,
            background: colors.bg.elevated,
            border: `1px solid ${colors.border.primary}`,
            borderRadius: 8,
            maxHeight: 300,
            overflowY: 'auto',
            zIndex: 1000,
            boxShadow: colors.shadow.lg,
          }}
        >
          {options.length > 8 && (
            <div style={{ padding: '8px', borderBottom: `1px solid ${colors.border.primary}` }}>
              <input
                type="text"
                placeholder="Search..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                onClick={(e) => e.stopPropagation()}
                style={{
                  width: '100%',
                  padding: '8px',
                  background: colors.bg.secondary,
                  border: `1px solid ${colors.border.primary}`,
                  borderRadius: 6,
                  fontSize: 13,
                  color: colors.text.primary,
                  outline: 'none',
                }}
              />
            </div>
          )}
          <div style={{ padding: '4px' }}>
            {filteredOptions.map((opt) => (
              <button
                key={opt.value}
                onClick={() => {
                  onChange(opt.value);
                  setIsOpen(false);
                  setSearchTerm('');
                }}
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  background: value === opt.value ? colors.brand.primary + '15' : 'transparent',
                  border: 'none',
                  borderRadius: 6,
                  fontSize: 14,
                  color: value === opt.value ? colors.brand.primary : colors.text.primary,
                  cursor: 'pointer',
                  textAlign: 'left',
                  fontWeight: value === opt.value ? 600 : 400,
                  transition: 'all 0.15s ease',
                }}
                onMouseEnter={(e) => {
                  if (value !== opt.value) {
                    e.currentTarget.style.background = colors.bg.tertiary;
                  }
                }}
                onMouseLeave={(e) => {
                  if (value !== opt.value) {
                    e.currentTarget.style.background = 'transparent';
                  }
                }}
              >
                {opt.label}
              </button>
            ))}
            {filteredOptions.length === 0 && (
              <div
                style={{
                  padding: '20px',
                  textAlign: 'center',
                  color: colors.text.tertiary,
                  fontSize: 13,
                }}
              >
                No options found
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

