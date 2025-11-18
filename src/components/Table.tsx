import clsx from 'clsx';
import React from 'react';

interface ThProps extends React.ThHTMLAttributes<HTMLTableHeaderCellElement> {
  sortable?: boolean;
  active?: boolean;
  direction?: 'none' | 'asc' | 'desc';
}

export function Th({
  children,
  sortable,
  active,
  direction,
  className,
  ...rest
}: ThProps) {
  return (
    <th
      {...rest}
      className={clsx(
        'px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500',
        sortable && 'cursor-pointer select-none',
        className,
      )}
    >
      <span className="inline-flex items-center gap-1">
        {children}
        {sortable && (
          <span className="text-[10px] text-gray-400">
            {active
              ? direction === 'asc'
                ? '▲'
                : direction === 'desc'
                ? '▼'
                : '⇅'
              : '⇅'}
          </span>
        )}
      </span>
    </th>
  );
}

export function Td(props: React.TdHTMLAttributes<HTMLTableCellElement>) {
  return (
    <td
      {...props}
      className={clsx('px-4 py-3 text-sm text-gray-700', props.className)}
    />
  );
}
