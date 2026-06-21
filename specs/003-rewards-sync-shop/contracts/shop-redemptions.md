# Contract: Shop & Redemptions

Symbolic rewards store. Route: `/shop`.

## `getShopPageData()`

```ts
type ShopPageData = {
  balance: number;
  items: {
    id: string;
    slug: string;
    name: string;
    description: string | null;
    costPoints: number;
    canAfford: boolean;
  }[];
  redemptions: {
    id: string;
    itemName: string;
    pointsSpent: number;
    redeemedAt: string; // ISO
  }[];
};
```

## `redeemShopItemAction(itemId: string)`

### Success

```ts
{ ok: true; balanceAfter: number; itemName: string; pointsSpent: number }
```

### Failure

```ts
{ ok: false; error: "INSUFFICIENT_BALANCE" | "ITEM_NOT_FOUND" | "UNAUTHORIZED" }
```

### Transaction steps

1. `requireUser()`
2. Load item; verify `active`
3. `balance = computeCreditBalance(userId)` (shared with stats)
4. If `balance < item.costPoints` → return insufficient
5. Insert `shop_redemptions` row
6. Return new balance (recompute)

No partial updates; single SQLite transaction.

## UI (`shop-client.tsx`)

- Display balance prominently.
- Redeem button disabled when `!canAfford`.
- On success: toast with symbolic message ("Redeemed Food Coupon!"); invalidate `shop`, `stats`.
- History section lists past redemptions newest first.

## Navigation

Add "Shop" to `app-nav.tsx` (icon + label).

## v1 out of scope

- Real fulfillment, coupon codes, inventory limits, refunds.
