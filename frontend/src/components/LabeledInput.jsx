import { useState, useEffect } from 'react';
import { S } from '../utils/styles';

  const LabeledInput = ({ 
    label, 
    value, 
    onChange, 
    type = 'number', 
    min, 
    max, 
    placeholder, 
    description 
  }) => {
    const [localValue, setLocalValue] = useState(value);

    useEffect(() => {
      setLocalValue(value);
    }, [value]);

    const handleChange = (e) => {
      const newValue = e.target.value;
      setLocalValue(newValue);
    };

    const handleBlur = () => {
      if (type === 'number') {
        const parsed = parseInt(localValue, 10);
        if (!isNaN(parsed)) {
          onChange(parsed);
        } else if (localValue === '') {
          onChange(min || 0);
          setLocalValue(min || 0);
        }
      } else {
        onChange(localValue);
      }
    };

    const handleKeyDown = (e) => {
      if (e.key === 'Enter') {
        e.target.blur();
      }
    };

    return (
      <div style={{ display: 'grid', gap: 6, minWidth: 0 }}>
        <label style={{ fontSize: 14, fontWeight: 600, color: '#374151' }}>
          {label}
          {description && (
            <span style={{ fontSize: 12, fontWeight: 400, color: '#6B7280', marginLeft: 8 }}>
              {description}
            </span>
          )}
        </label>
        <input
          type="text"
          value={localValue}
          onChange={handleChange}
          onBlur={handleBlur}
          onKeyDown={handleKeyDown}
          min={min}
          max={max}
          placeholder={placeholder}
          style={S.input}
        />
      </div>
    );
  };

  export default LabeledInput;