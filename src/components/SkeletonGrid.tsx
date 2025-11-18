export default function SkeletonGrid() {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {[0, 1, 2].map((i) => (
        <div
          key={i}
          className="animate-pulse rounded-2xl border border-gray-200 bg-white p-4"
        >
          <div className="mb-3 h-5 w-1/2 rounded bg-gray-200" />
          <div className="mb-2 h-4 w-2/3 rounded bg-gray-200" />
          <div className="mb-2 h-4 w-1/3 rounded bg-gray-200" />
          <div className="h-4 w-1/4 rounded bg-gray-200" />
        </div>
      ))}
    </div>
  );
}
