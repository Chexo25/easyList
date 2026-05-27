import MiniSearch from 'minisearch';
import defaultProductsDatabase from './products.json';

export { defaultProductsDatabase };

const miniSearch = new MiniSearch({
  fields: ['name'],
  storeFields: ['name', 'category'],
  searchOptions: {
    fuzzy: 0.2,
    prefix: true,
    boost: { name: 2 },
  },
});

miniSearch.addAll(defaultProductsDatabase.map((p, i) => ({ ...p, id: String(i) })));

function searchLocalDB(query: string): { name: string; category: string }[] {
  if (!query || query.length < 2) return [];
  return miniSearch
    .search(query, { prefix: true, fuzzy: 0.2 })
    .slice(0, 10)
    .map((r) => ({ name: r.name as string, category: r.category as string }));
}

export async function searchLocalProducts(query: string): Promise<{ name: string; category: string }[]> {
  return searchLocalDB(query);
}

export interface Product {
  name: string;
  category: string;
}
