# 🧠 🎯 1. But de l’application

Créer une application **offline-first** qui permet de :

- 👉 créer des repas à partir d’ingrédients  
- 👉 organiser ses menus  
- 👉 générer automatiquement une liste de courses optimisée  

## 💡 Objectif principal

> Ne plus réfléchir à quoi acheter → l’app le fait à partir des repas choisis

---

# 🧱 🛠️ 2. Stack technique

## ⚙️ Core

- **SvelteKit** → app web moderne  
- **Bun** → gestion du projet  

---

## 💾 Base de données (offline)

- **IndexedDB** → stockage local  
- **Dexie.js** → simplification DB  

### 👉 Avantages

- offline total  
- rapide  
- pas de backend  

---

## 🎨 UI / Design

- **Tailwind CSS** → styling  
- **shadcn/ui** → composants propres  

### 👉 Avantages

- rapide à dev  
- design moderne  
- pas de CSS par défaut peu esthétique  

---

## 🧩 Utilitaires

- **uuid** → identifiants uniques  

---

# 🧭 🏗️ 3. Architecture globale

## Entités principales

- **Ingredient**
- **Meal**
- **MealIngredient**
- **ShoppingList** (générée)

### 👉 Relation clé
