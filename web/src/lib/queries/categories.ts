import { listCategoriesForUser } from "@/actions/categories";

export type CategoriesData = Awaited<ReturnType<typeof listCategoriesForUser>>;

export async function fetchCategories(): Promise<CategoriesData> {
  return listCategoriesForUser();
}
