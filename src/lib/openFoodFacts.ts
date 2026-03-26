export interface OFFProduct {
  name: string;
  category: string;
}

function mapToAppCategory(offCategories: string | undefined): string {
  if (!offCategories) return 'Divers';
  
  const cat = offCategories.toLowerCase();
  
  // Mapping rules based on keywords found in OpenFoodFacts categories (both FR and EN)
  const rules: Record<string, string[]> = {
    "Hygiène": ["hygièn", "hygiene", "toilet paper", "papier toilette", "savon", "soap", "shamp", "douche", "shower", "dentifrice", "toothpaste", "mouchoir", "tissue", "beauté", "beauty", "soin", "dentaire", "corps"],
    "Soin de la maison": ["nettoyage", "cleaning", "lessive", "laundry", "détergent", "detergent", "vaisselle", "dish", "ménage", "entretien", "maison"],
    "Animaux": ["animal", "animaux", "chien", "dog ", "pour chat", "croquette", "pet food", "pet-food", "animaux de compagnie"],
    "Bébé": ["bébé", "baby", "couche", "diaper", "infant"],
    "Fruits et légumes": ["fruit", "légume", "vegetable", "salade", "compote", "pomme", "apple", "tomato", "potato"],
    "Surgelés": ["surgelé", "frozen", "glace", "crème glacée", "sorbet", "ice cream"],
    "Boissons": ["boisson", "beverage", "drink", "eau", "water", "jus", "juice", "soda", "cola", "nectar", "sirop"],
    "Pâtes et riz": ["pâte", "pasta", "riz", "rice", "céréale", "cereal", "blé", "wheat", "semoule", "quinoa", "nouille", "noodle"],
    "Conserves": ["conserve", "canned", "boîte", "tin"],
    "Crèmerie": ["lait", "milk", "dairy", "yaourt", "yogurt", "beurre", "butter", "crème", "cream", "laitier"],
    "Fromages": ["fromage", "cheese", "camembert", "emmental", "chèvre"],
    "Charcuterie": ["charcuterie", "jambon", "saucisson", "saucisse", "sausage", "lardon", "bacon"],
    "Boucherie": ["viande", "meat", "bœuf", "beef", "porc", "pork", "poulet", "chicken", "volaille", "poultry", "dinde", "agneau", "steak"],
    "Frais": ["poisson", "fish", "fruit de mer", "seafood", "saumon"],
    "Petit déjeuner": ["petit-déjeuner", "breakfast", "confiture", "jam", "pâte à tartiner", "spread", "miel", "honey", "muesli"],
    "Boulangerie": ["boulangerie", "bakery", "pain", "bread", "viennoiserie", "brioche", "baguette", "croissant"],
    "Bonbons / Snacks": ["snack", "bonbon", "candy", "chocolat", "chocolate", "biscuit", "confiserie", "sweet", "sucre ", "gâteau", "barre"],
    "Chips et apéros": ["apéritif", "chips", "crisp", "cacahuète", "peanut", "biscuit apéritif", "tuile", "apero"],
    "Ingrédients de cuisine": ["farine", "flour", "sucre", "sugar", "levure", "baking", "pâtisserie", "fécule", "cacao"],
    "Café et thé": ["thé", "tea", "café", "coffee", "infusion", "tisane"],
    "Sauces et épices": ["sauce", "épice", "spice", "herbe", "herb", "poivre", "pepper", "sel", "salt", "ketchup", "mayonnaise"],
    "Condiments et huiles": ["huile", "oil", "vinaigre", "vinegar", "condiment", "moutarde", "mustard", "cornichon", "pickle", "olive"],
    "Cave à vin": ["vin ", "wine", "bière", "beer", "alcool", "alcohol", "spiritueux", "champagne", "cidre", "cider"]
  };

  for (const [appCategory, keywords] of Object.entries(rules)) {
    if (keywords.some(kw => cat.includes(kw))) {
      return appCategory;
    }
  }

  // Fallback to exactly what they provide if it's short, or "Divers"
  let firstCat = offCategories.split(',')[0].trim();
  // Nettoyage des préfixes (ex: "en:", "fr:") et des tirets qui remplacent les espaces
  firstCat = firstCat.replace(/^[a-z]{2}:/, '').replace(/-/g, ' ');
  
  if (firstCat && firstCat.length < 25) {
    // Return capitalized clean OFF category
    return firstCat.charAt(0).toUpperCase() + firstCat.slice(1);
  }

  return 'Divers';
}

export async function searchProductsOFF(query: string): Promise<OFFProduct[]> {
  if (!query || query.length < 2) return [];

  // Use the .net domain which has better API support and avoids 503 HTML responses
  try {
    const url = `https://fr.openfoodfacts.net/cgi/search.pl?search_terms=${encodeURIComponent(query)}&search_simple=1&action=process&json=1&page_size=20`;
    const res = await fetch(url, {
      headers: {
        'Accept': 'application/json'
      }
    });
    
    if (!res.ok) {
      console.warn('OpenFoodFacts API error:', res.status);
      return [];
    }

    const data = await res.json();
    if (data.products && Array.isArray(data.products)) {
      const results: OFFProduct[] = [];
      const uniqueNames = new Set<string>();

      for (const p of data.products) {
        // Preferred french name, fallback to generic
        const name = p.product_name_fr || p.product_name;
        if (!name) continue;
        
        // Capitalize first letter for better UI
        const cleanName = name.charAt(0).toUpperCase() + name.slice(1).trim();
        const lowerName = cleanName.toLowerCase();
        
        if (!uniqueNames.has(lowerName)) {
          uniqueNames.add(lowerName);
          
          results.push({
            name: cleanName,
            category: mapToAppCategory(p.categories)
          });
        }
      }
      
      // Trier par taille (les noms plus courts comme "Papier toilette" avant "Papier toilette marque X fraîcheur")
      // Cela permet de remonter les termes génériques.
      results.sort((a, b) => a.name.length - b.name.length);
      
      // On retourne au maximum 10 suggestions compactes
      return results.slice(0, 10);
    }
    return [];
  } catch (err) {
    console.error('Failed to fetch from OpenFoodFacts:', err);
    return [];
  }
}
