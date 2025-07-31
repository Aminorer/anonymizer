import React from 'react';

interface Option {
  value: string;
  label: string;
}

interface SelectBoxProps {
  value: string;
  onChange: (value: string) => void;
  options: Option[];
  className?: string;
}

const SelectBox: React.FC<SelectBoxProps> = ({ value, onChange, options, className = '' }) => (
  <select
    value={value}
    onChange={(e) => onChange(e.target.value)}
    className={className}
  >
    {options.map((opt) => (
      <option key={opt.value} value={opt.value}>
        {opt.label}
      </option>
    ))}
  </select>
);

export default SelectBox;
