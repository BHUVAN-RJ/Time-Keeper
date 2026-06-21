import { getShopPageData } from "@/actions/shop";
import { ShopClient } from "@/components/shop-client";

export default async function ShopPage() {
  const initial = await getShopPageData();
  return (
    <div className="mx-auto flex w-full max-w-lg flex-col gap-4 px-4 pt-4">
      <h1 className="text-[22px] font-semibold tracking-tight text-tk-ink">
        Shop
      </h1>
      <ShopClient initial={initial} />
    </div>
  );
}
