import { useState, useEffect } from 'react';

export const LazyInput = ({
    value,
    onChange,
    ...props
}) => {
    // Initialize local state
    const [localValue, setLocalValue] = useState(value ?? '');

    // Sync local state if external value changes (e.g. clear filters)
    useEffect(() => {
        setLocalValue(value ?? '');
    }, [value]);

    const handleBlur = () => {
        // Only trigger onChange if value actually changed
        if (localValue !== (value ?? '')) {
            onChange({ target: { value: localValue } });
        }
    };

    const handleKeyDown = (e) => {
        if (e.key === 'Enter') {
            handleBlur();
            e.target.blur();
        }
        // Pass through other key handlers if needed
        if (props.onKeyDown) props.onKeyDown(e);
    };

    const handleChange = (e) => {
        setLocalValue(e.target.value);
    };

    return (
        <input
            {...props}
            value={localValue}
            onChange={handleChange}
            onBlur={handleBlur}
            onKeyDown={handleKeyDown}
        />
    );
};
