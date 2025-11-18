export default function SectionTitle({
  title,
  count,
}: {
  title: string;
  count?: number;
}) {
  return (
    <div className="mb-3 flex items-center justify-between">
      <h3 className="text-base font-semibold text-gray-800">{title}</h3>
      {typeof count === 'number' && (
        <span className="rounded-full bg-gray-200 px-2 py-0.5 text-xs text-gray-700">
          {count}
        </span>
      )}
    </div>
  );
}
