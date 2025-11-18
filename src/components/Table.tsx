import { classNames } from '@/lib/classNames';

export function Th({ children }: { children: React.ReactNode }) {
  return (
    <th
      scope="col"
      className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-600"
    >
      {children}
    </th>
  );
}

export function Td({
  children,
  className = '',
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <td className={classNames('px-4 py-3 text-sm text-gray-800', className)}>
      {children}
    </td>
  );
}
