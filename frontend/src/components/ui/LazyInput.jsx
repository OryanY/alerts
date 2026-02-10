import { useState, useEffect } from 'react';

export const LazyInput = ({
    value,
    onChange,
    type,
    min,
    max,
    style,
    ...props
}) => {
    const [localValue, setLocalValue] = useState(value ?? '');
    const [error, setError] = useState(null);

    // Sync local state if external value changes (e.g. clear filters)
    useEffect(() => {
        setLocalValue(value ?? '');
        setError(null);
    }, [value]);

    const validate = (val) => {
        if (type === 'number' && val !== '') {
            const num = parseFloat(val);

            if (isNaN(num)) {
                return 'Please enter a valid number';
            }

            if (min !== undefined && num < parseFloat(min)) {
                return `Value must be at least ${min}`;
            }

            if (max !== undefined && num > parseFloat(max)) {
                return `Value must be at most ${max}`;
            }
        }

        return null;
    };

    const handleBlur = () => {
        const validationError = validate(localValue);

        if (validationError) {
            setError(validationError);
            return;
        }

        setError(null);

        // Only trigger onChange if value actually changed and is valid
        if (localValue !== (value ?? '')) {
            onChange({ target: { value: localValue } });
        }
    };

    const handleKeyDown = (e) => {
        if (e.key === 'Enter') {
            handleBlur();
            if (!error) {
                e.target.blur();
            }
        }
        // Pass through other key handlers if needed
        if (props.onKeyDown) props.onKeyDown(e);
    };

    const handleChange = (e) => {
        setLocalValue(e.target.value);
        // Clear error on change
        if (error) setError(null);
    };

    return (
        <div style={{ position: 'relative', flex: style?.flex }}>
            <input
                {...props}
                type={type}
                min={min}
                max={max}
                value={localValue}
                onChange={handleChange}
                onBlur={handleBlur}
                onKeyDown={handleKeyDown}
                style={{
                    ...style,
                    borderColor: error ? '#EF4444' : style?.borderColor,
                    flex: undefined, // Remove flex from input itself
                }}
            />
            {error && (
                <div
                    style={{
                        position: 'absolute',
                        top: '100%',
                        left: 0,
                        marginTop: 4,
                        fontSize: 12,
                        color: '#EF4444',
                        whiteSpace: 'nowrap',
                    }}
                >
                    {error}
                </div>
            )}
        </div>
    );
};

