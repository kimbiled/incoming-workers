import { classNames } from '@/lib/classNames';

export default function Chip({
  children,
  tone = 'gray',
}: {
  children: React.ReactNode;
  tone?: 'gray' | 'green' | 'blue' | 'red';
}) {
  const map: Record<string, string> = {
    gray: 'bg-gray-100 text-gray-700',
    green: 'bg-green-100 text-green-700',
    blue: 'bg-blue-100 text-blue-700',
    red: 'bg-red-100 text-red-700',
  };
  return (
    <span className={classNames('rounded-full px-2 py-0.5 text-xs', map[tone])}>
      {children}
    </span>
  );
}
