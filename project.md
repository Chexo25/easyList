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

- **Tauri Store** → stockage local (système de fichiers natif)

### 👉 Avantages

- offline total  
- rapide  
- accrédité avec Tauri
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

---

# 🚀 📋 4. Roadmap des fonctionnalités

## 🥇 Étape 1 — Base technique

- Setup projet SvelteKit + Bun  
- Setup Tailwind  
- Setup shadcn/ui  
- BDD locale avec le localstorage de Tauri

✅ Résultat :  
→ app qui tourne + base de données fonctionnelle  

---

## 🥈 Étape 2 — Ingrédients (CRUD)

### Fonctionnalités

- ajouter un ingrédient  
- lister les ingrédients  
- catégoriser (légumes, viande, etc.)  
- créer des ingrédients personnalisés  

💡 Très important :  
→ base solide pour tout le reste  

---

## 🥉 Étape 3 — Repas

### Fonctionnalités

- créer un repas  
- afficher la liste des repas  
- supprimer / modifier  

---

## 🏅 Étape 4 — Lier ingrédients ↔ repas

### Fonctionnalités

- ajouter des ingrédients à un repas  
- définir :
  - quantité  
  - unité  

### 💡 Exemple

- 2 tomates  
- 200g de pâtes  

👉 C’est le cœur métier  

---

## 🛒 Étape 5 — Génération de la liste de courses

### Fonctionnalités

- sélectionner plusieurs repas  
- générer une liste fusionnée  
- additionner les quantités  

### 💡 Exemple

- 2 repas avec tomate → total = 4 tomates  

---

## 🧺 Étape 6 — Catégorisation (UX ++)

### Fonctionnalités

- regrouper par catégorie :
  - légumes  
  - viande  
  - etc.  

👉 Très important pour l’expérience utilisateur  

---

## ⭐ Étape 7 — Améliorations UX

- favoris ⭐  
- duplication de repas  
- recherche d’ingrédients  
- autocomplétion  

---

## 📅 Étape 8 — Planning (optionnel)

- planifier les repas sur une semaine  
- générer automatiquement la liste de courses  

---

## 📱 Étape 9 — PWA

- installable sur mobile  
- fonctionnement offline complet  

---

## ☁️ Étape 10 — Synchronisation (plus tard)

- partage entre utilisateurs  
- ajout d’un backend (ex : Supabase)  