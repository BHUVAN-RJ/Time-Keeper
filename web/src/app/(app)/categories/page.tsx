import { listCategoriesForUser } from "@/actions/categories";
import { CategoriesClient } from "@/components/categories-client";

export default async function CategoriesPage() {
  const rows = await listCategoriesForUser();
  return <CategoriesClient initial={rows} />;
}
