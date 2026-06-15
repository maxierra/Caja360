import { LandingStore } from "@/components/landing/store/landing-store";
import { buildLandingCatalog, serializeCatalogProduct } from "@/lib/store-catalog";
import { getStoreProducts } from "@/lib/store-products";

type Props = {
  searchParams?: Promise<{ missingSupabase?: string }>;
};

export default async function Home({ searchParams }: Props) {
  const sp = (await searchParams) ?? {};
  const storeProducts = await getStoreProducts();
  const catalog = buildLandingCatalog(storeProducts);
  const products = catalog.map(serializeCatalogProduct);

  return (
    <>
      {sp.missingSupabase ? (
        <div className="border-b border-amber-200 bg-amber-50 px-4 py-3 text-center text-sm text-amber-950">
          Falta configurar Supabase en <code className="rounded bg-white px-1">.env.local</code>.
        </div>
      ) : null}
      <LandingStore products={products} />
    </>
  );
}
