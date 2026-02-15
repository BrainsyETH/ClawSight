import { Skeleton } from "@/components/shared/skeleton";

function SkillCardSkeleton() {
  return (
    <div className="rounded-xl border border-gray-200 bg-white shadow-sm p-4">
      <div className="flex items-start justify-between">
        <div className="flex-1 min-w-0">
          {/* Icon placeholder + title line */}
          <div className="flex items-center gap-2 mb-2">
            <Skeleton className="h-5 w-5 rounded" />
            <Skeleton className="h-4 w-28" />
            <Skeleton className="h-5 w-16 rounded-full" />
          </div>
          {/* Description lines */}
          <Skeleton className="h-3 w-full mb-1.5" />
          <Skeleton className="h-3 w-3/4 mb-3" />
          {/* Badges row */}
          <div className="flex items-center gap-2">
            <Skeleton className="h-5 w-16 rounded-full" />
            <Skeleton className="h-5 w-14 rounded-full" />
          </div>
        </div>
        {/* Settings icon + toggle */}
        <div className="flex items-center gap-3 ml-4">
          <Skeleton className="h-8 w-8 rounded-lg" />
          <Skeleton className="h-6 w-11 rounded-full" />
        </div>
      </div>
    </div>
  );
}

export default function SkillsLoading() {
  return (
    <div className="space-y-6">
      {/* Header skeleton */}
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Skeleton className="h-6 w-6" />
            <Skeleton className="h-7 w-32" />
          </div>
          <Skeleton className="h-4 w-72" />
        </div>
        <Skeleton className="h-10 w-28 rounded-lg" />
      </div>

      {/* Section label */}
      <div>
        <Skeleton className="h-3 w-20 mb-3" />
      </div>

      {/* Grid of 6 skill card skeletons */}
      <div className="space-y-3">
        <SkillCardSkeleton />
        <SkillCardSkeleton />
        <SkillCardSkeleton />
        <SkillCardSkeleton />
        <SkillCardSkeleton />
        <SkillCardSkeleton />
      </div>
    </div>
  );
}
