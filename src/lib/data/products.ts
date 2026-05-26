import MiniSearch from 'minisearch';
import defaultProductsDatabase from './products.json';

export { defaultProductsDatabase };

const API_URL = 'https://world.openfoodfacts.org/cgi/search.pl';

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

const apiCategoryMap: Record<string, string> = {
  'en:fruits': 'Fruits et légumes',
  'en:vegetables': 'Fruits et légumes',
  'en:legumes': 'Fruits et légumes',
  'en:mushrooms': 'Fruits et légumes',
  'en:nuts': 'Fruits et légumes',
  'en:fruit-vegetables': 'Fruits et légumes',
  'en:leafy-vegetables': 'Fruits et légumes',
  'en:root-vegetables': 'Fruits et légumes',
  'en:fruit-based-foods': 'Fruits et légumes',

  'en:dairies': 'Crèmerie',
  'en:milks': 'Crèmerie',
  'en:milks-liquid-and-powder': 'Crèmerie',
  'en:yogurts': 'Crèmerie',
  'en:yoghurts': 'Crèmerie',
  'en:eggs': 'Crèmerie',
  'en:butters': 'Crèmerie',
  'en:creams': 'Crèmerie',
  'en:cream': 'Crèmerie',

  'en:cheeses': 'Fromages',
  'en:processed-cheeses': 'Fromages',

  'en:meats': 'Boucherie',
  'en:poultries': 'Boucherie',
  'en:pork-and-its-products': 'Boucherie',
  'en:beef-and-its-products': 'Boucherie',
  'en:lamb-and-goat': 'Boucherie',

  'en:prepared-meats': 'Charcuterie',
  'en:hams': 'Charcuterie',
  'en:sausages': 'Charcuterie',
  'en:pork': 'Boucherie',

  'en:fish': 'Frais',
  'en:seafood': 'Frais',
  'en:shellfish': 'Frais',
  'en:molluscs': 'Frais',

  'en:beverages': 'Boissons',
  'en:waters': 'Boissons',
  'en:fruit-juices': 'Boissons',
  'en:soft-drinks': 'Boissons',
  'en:alcoholic-beverages': 'Cave à vin',
  'en:beers': 'Cave à vin',
  'en:wines': 'Cave à vin',

  'en:breads': 'Boulangerie',
  'en:pastries': 'Boulangerie',
  'en:breakfast-biscuits': 'Boulangerie',

  'en:pasta': 'Pâtes et riz',
  'en:rices': 'Pâtes et riz',
  'en:couscous': 'Pâtes et riz',
  'en:cereals-and-their-products': 'Pâtes et riz',
  'en:cereals-and-potatoes': 'Pâtes et riz',

  'en:canned-foods': 'Conserves',
  'en:canned': 'Conserves',
  'en:canned-legumes': 'Conserves',
  'en:canned-vegetables': 'Conserves',
  'en:canned-fish': 'Conserves',
  'en:canned-fruits': 'Conserves',

  'en:frozen-foods': 'Surgelés',
  'en:frozen-vegetables': 'Surgelés',
  'en:frozen-potatoes': 'Surgelés',
  'en:frozen-fish': 'Surgelés',
  'en:ice-creams': 'Surgelés',

  'en:desserts': 'Desserts frais',
  'en:cakes': 'Bonbons / Snacks',
  'en:biscuits': 'Bonbons / Snacks',
  'en:cookies': 'Bonbons / Snacks',
  'en:chocolates': 'Bonbons / Snacks',
  'en:chocolate-confectioneries': 'Bonbons / Snacks',
  'en:confectioneries': 'Bonbons / Snacks',
  'en:sweets': 'Bonbons / Snacks',
  'en:gum': 'Bonbons / Snacks',
  'en:snacks': 'Chips et apéros',
  'en:crisps': 'Chips et apéros',

  'en:coffees': 'Café et thé',
  'en:teas': 'Café et thé',
  'en:herbal-teas': 'Café et thé',
  'en:chicory': 'Café et thé',

  'en:oils': 'Condiments et huiles',
  'en:vinegars': 'Condiments et huiles',
  'en:sauces': 'Sauces et épices',
  'en:condiments': 'Sauces et épices',
  'en:spices': 'Sauces et épices',
  'en:herbs': 'Sauces et épices',
  'en:salt': 'Sauces et épices',
  'en:dressings': 'Sauces et épices',

  'en:breakfast-cereals': 'Petit déjeuner',
  'en:spreads': 'Petit déjeuner',
  'en:honeys': 'Petit déjeuner',
  'en:jams': 'Petit déjeuner',
  'en:marmalades': 'Petit déjeuner',
  'en:chocolate-spreads': 'Petit déjeuner',
  'en:granolas': 'Petit déjeuner',
  'en:porridges': 'Petit déjeuner',

  'en:baby-foods': 'Bébé',
  'en:baby-dishes': 'Bébé',
  'en:baby-milks': 'Bébé',
  'en:dental-hygiene': 'Hygiène',
  'en:hygiene': 'Hygiène',
  'en:household-products': 'Soin de la maison',
  'en:cleaning-products': 'Soin de la maison',

  'en:pet-foods': 'Animaux',
  'en:pet-supplies': 'Animaux',

  'en:flours': 'Ingrédients de cuisine',
  'en:sugars': 'Ingrédients de cuisine',
  'en:chocolate-powders': 'Ingrédients de cuisine',
  'en:baking-powders': 'Ingrédients de cuisine',
  'en:gelatins': 'Ingrédients de cuisine',
  'en:baking-ingredients': 'Ingrédients de cuisine',
};

function mapAPICategory(tags: string[] | undefined): string {
  if (!tags?.length) return 'Divers';
  for (const tag of tags) {
    const mapped = apiCategoryMap[tag];
    if (mapped) return mapped;
  }
  return 'Divers';
}

async function searchAPI(query: string): Promise<{ name: string; category: string }[]> {
  const params = new URLSearchParams({
    search_terms: query,
    json: '1',
    page_size: '10',
    fields: 'product_name,categories_tags',
  });

  const res = await fetch(`${API_URL}?${params}`, { signal: AbortSignal.timeout(4000) });
  if (!res.ok) return [];

  const data: { products?: { product_name?: string; categories_tags?: string[] }[] } = await res.json();
  if (!data.products?.length) return [];

  return data.products
    .filter((p) => p.product_name)
    .map((p) => ({
      name: p.product_name!.trim(),
      category: mapAPICategory(p.categories_tags),
    }));
}

function searchLocalDB(query: string): { name: string; category: string }[] {
  if (!query || query.length < 2) return [];
  return miniSearch.search(query, { prefix: true, fuzzy: 0.2 }).slice(0, 10).map(
    (r) => ({ name: r.name as string, category: r.category as string }),
  );
}

export async function searchLocalProducts(query: string): Promise<{ name: string; category: string }[]> {
  if (typeof navigator !== 'undefined' && navigator.onLine) {
    try {
      const results = await searchAPI(query);
      if (results.length > 0) return results;
    } catch {
      // API failed — fallback to local DB
    }
  }
  return searchLocalDB(query);
}

export interface Product {
  name: string;
  category: string;
}
