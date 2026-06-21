"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import {
  redeemShopItemAction,
  type ShopPageData,
} from "@/actions/shop";
import { formatCredits } from "@/lib/credits";
import { queryKeys } from "@/lib/queries/keys";

export function ShopClient({ initial }: { initial: ShopPageData }) {
  const qc = useQueryClient();
  const [data, setData] = useState(initial);
  const [pendingId, setPendingId] = useState<string | null>(null);

  async function onRedeem(itemId: string, itemName: string, cost: number) {
    if (data.balance < cost) {
      toast.error("Not enough points for this reward.");
      return;
    }
    if (
      !confirm(
        `Redeem ${itemName} for ${formatCredits(cost)} points? (Symbolic — no real delivery.)`,
      )
    ) {
      return;
    }
    setPendingId(itemId);
    try {
      const res = await redeemShopItemAction(itemId);
      if (!res.ok) {
        if (res.error === "INSUFFICIENT_BALANCE") {
          toast.error("Not enough points.");
        } else {
          toast.error("Could not redeem.");
        }
        return;
      }
      toast.success(`Redeemed ${res.itemName}!`);
      const fresh = await (await import("@/actions/shop")).getShopPageData();
      setData(fresh);
      void qc.invalidateQueries({ queryKey: queryKeys.shop.all });
      void qc.invalidateQueries({ queryKey: queryKeys.stats.all });
    } finally {
      setPendingId(null);
    }
  }

  return (
    <div className="flex flex-col gap-6 pb-10">
      <section className="card p-5">
        <div className="eyebrow">Your balance</div>
        <p className="mt-2 text-3xl font-semibold tabular-nums text-tk-honey">
          {formatCredits(data.balance)}
        </p>
        <p className="mt-1 text-[12px] text-tk-ink-3">
          Points from tracked time minus redemptions
        </p>
      </section>

      <section className="flex flex-col gap-3">
        <div className="eyebrow px-1">Rewards</div>
        {data.items.map((item) => (
          <div key={item.id} className="card flex flex-col gap-2 p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="font-semibold text-tk-ink">{item.name}</h2>
                {item.description ? (
                  <p className="mt-1 text-[13px] text-tk-ink-3">
                    {item.description}
                  </p>
                ) : null}
              </div>
              <span className="mono shrink-0 text-[14px] font-medium text-tk-honey">
                {formatCredits(item.costPoints)}
              </span>
            </div>
            <button
              type="button"
              className="btn-primary py-2.5 text-[14px] disabled:opacity-50"
              disabled={!item.canAfford || pendingId === item.id}
              onClick={() =>
                void onRedeem(item.id, item.name, item.costPoints)
              }
            >
              {pendingId === item.id
                ? "Redeeming…"
                : item.canAfford
                  ? "Redeem"
                  : "Need more points"}
            </button>
          </div>
        ))}
      </section>

      {data.redemptions.length > 0 ? (
        <section className="flex flex-col gap-2">
          <div className="eyebrow px-1">History</div>
          <ul className="card divide-y divide-tk-line p-0">
            {data.redemptions.map((r) => (
              <li
                key={r.id}
                className="flex justify-between gap-2 px-4 py-3 text-[13px]"
              >
                <span className="text-tk-ink">{r.itemName}</span>
                <span className="text-tk-ink-3">
                  −{formatCredits(r.pointsSpent)}
                </span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
