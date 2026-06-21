"use client";

import { useQuery } from "@tanstack/react-query";
import { getShopPageData, type ShopPageData } from "@/actions/shop";
import { queryKeys } from "@/lib/queries/keys";

export function useShopQuery(initialData?: ShopPageData) {
  return useQuery({
    queryKey: queryKeys.shop.all,
    queryFn: () => getShopPageData(),
    initialData,
    staleTime: 30_000,
  });
}
