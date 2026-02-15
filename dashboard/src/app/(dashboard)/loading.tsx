import { Skeleton, SkeletonCard, SkeletonRow } from "@/components/shared/skeleton";

export default function DashboardLoading() {
  return (
    <div className="space-y-6">
      {/* Header skeleton (greeting area) */}
      <div className="flex items-center gap-4">
        <Skeleton className="h-14 w-14 rounded-full" />
        <div className="space-y-2">
          <Skeleton className="h-7 w-48" />
          <Skeleton className="h-4 w-64" />
        </div>
      </div>

      {/* Status + Wallet row — two cards side by side */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Status card skeleton */}
        <div className="rounded-xl border border-gray-200 bg-white shadow-sm p-6">
          <Skeleton className="h-4 w-20 mb-4" />
          <div className="flex items-center gap-3 mb-3">
            <Skeleton className="h-3 w-3 rounded-full" />
            <Skeleton className="h-5 w-16" />
          </div>
          <Skeleton className="h-3 w-40 mb-2" />
          <Skeleton className="h-3 w-32" />
        </div>

        {/* Wallet card skeleton */}
        <div className="rounded-xl border border-gray-200 bg-white shadow-sm p-6">
          <Skeleton className="h-4 w-16 mb-4" />
          <Skeleton className="h-8 w-24 mb-3" />
          <div className="flex items-center gap-4">
            <Skeleton className="h-3 w-28" />
            <Skeleton className="h-3 w-28" />
          </div>
        </div>
      </div>

      {/* Four small stat card skeletons in a row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <SkeletonCard />
        <SkeletonCard />
        <SkeletonCard />
        <SkeletonCard />
      </div>

      {/* Activity feed skeleton */}
      <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
        <div className="p-6">
          <Skeleton className="h-5 w-36 mb-4" />
          <div className="flex items-center gap-2">
            <Skeleton className="h-9 w-full max-w-[200px] rounded-lg" />
            <Skeleton className="h-8 w-12 rounded-md" />
            <Skeleton className="h-8 w-12 rounded-md" />
            <Skeleton className="h-8 w-12 rounded-md" />
          </div>
        </div>
        <div className="px-6 pb-6">
          <SkeletonRow />
          <SkeletonRow />
          <SkeletonRow />
          <SkeletonRow />
          <SkeletonRow />
          <SkeletonRow />
        </div>
      </div>
    </div>
  );
}
