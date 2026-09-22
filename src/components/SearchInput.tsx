'use client';

import React from 'react';

interface SearchInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  onClear?: () => void;
  wrapperClassName?: string;
}

export default function SearchInput({
  value,
  onChange,
  onClear,
  placeholder = 'Search...',
  className = '',
  wrapperClassName = '',
  ...props
}: SearchInputProps) {
  const hasValue = Boolean(value && String(value).length > 0);

  return (
    <div className={`relative flex items-center ${wrapperClassName}`}>
      <div className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none text-muted flex items-center justify-center">
        <svg
          className="w-4 h-4 text-muted/80"
          viewBox="0 0 16 16"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <circle cx="7" cy="7" r="4.75" />
          <path d="M10.5 10.5L14 14" />
        </svg>
      </div>
      <input
        type="text"
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        style={{ paddingLeft: '2.4rem', paddingRight: hasValue && onClear ? '2rem' : '0.875rem' }}
        className={`w-full py-2 text-[14px] rounded-lg border border-line bg-paper text-ink placeholder:text-muted/60 focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all ${className}`}
        {...props}
      />
      {hasValue && onClear && (
        <button
          type="button"
          onClick={onClear}
          className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted hover:text-ink p-1 rounded-md transition-colors"
          title="Clear search"
          aria-label="Clear search"
        >
          <svg className="w-3.5 h-3.5" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="M4 4l8 8M12 4l-8 8" />
          </svg>
        </button>
      )}
    </div>
  );
}
