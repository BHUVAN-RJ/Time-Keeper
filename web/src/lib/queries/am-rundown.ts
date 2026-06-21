"use client";

import { useQuery } from "@tanstack/react-query";
import { getAmRundownData } from "@/actions/am-rundown";
import { queryKeys } from "@/lib/queries/keys";

export type AmRundownData = Awaited<ReturnType<typeof getAmRundownData>>;

export function useAmRundownQuery(initialData?: AmRundownData) {
  return useQuery({
    queryKey: queryKeys.amRundown.all,
    queryFn: () => getAmRundownData(),
    initialData,
    staleTime: 30_000,
    refetchOnWindowFocus: true,
  });
}
