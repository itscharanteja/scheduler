import type { MenuItem } from "./types";

export const MENU_ITEMS: MenuItem[] = [
  {
    id: "menu-classic-burger",
    name: "Classic Burger",
    price: 119,
    category: "burgers",
    recipe: {
      "Beef patties": 1,
      "Brioche buns": 1,
      "Cheddar slices": 1,
      "Lettuce": 0.03,
      "Tomatoes": 0.04,
      "House sauce": 0.02,
      "Burger paper wraps": 1,
    },
  },
  {
    id: "menu-double-smash",
    name: "Double Smash",
    price: 149,
    category: "burgers",
    recipe: {
      "Beef patties": 2,
      "Brioche buns": 1,
      "Cheddar slices": 2,
      "Pickles": 0.02,
      "Onions": 0.02,
      "House sauce": 0.03,
      "Burger paper wraps": 1,
    },
  },
  {
    id: "menu-truffle-burger",
    name: "Truffle Burger",
    price: 159,
    category: "burgers",
    recipe: {
      "Beef patties": 2,
      "Brioche buns": 1,
      "Cheddar slices": 2,
      "Truffle mayo": 0.035,
      "Onions": 0.025,
      "Burger paper wraps": 1,
    },
  },
  {
    id: "menu-halloumi-burger",
    name: "Halloumi Burger",
    price: 129,
    category: "burgers",
    recipe: {
      "Halloumi portions": 1,
      "Brioche buns": 1,
      "Lettuce": 0.03,
      "Tomatoes": 0.04,
      "Jalapeño relish": 0.025,
      "Burger paper wraps": 1,
    },
  },
  {
    id: "menu-crispy-chicken",
    name: "Crispy Chicken Burger",
    price: 135,
    category: "burgers",
    recipe: {
      "Chicken breasts": 1,
      "Brioche buns": 1,
      "Lettuce": 0.03,
      "Mayonnaise": 0.025,
      "Pickles": 0.02,
      "Burger paper wraps": 1,
    },
  },
  {
    id: "menu-kids-burger",
    name: "Kids Burger",
    price: 79,
    category: "burgers",
    recipe: {
      "Beef patties": 1,
      "Brioche buns": 1,
      "Ketchup": 0.02,
      "Burger paper wraps": 1,
    },
  },
  {
    id: "menu-loaded-fries",
    name: "Loaded Fries",
    price: 65,
    category: "sides",
    recipe: {
      "Potatoes": 0.3,
      "Cheddar slices": 1,
      "Onions": 0.02,
      "House sauce": 0.02,
      "Packaging boxes": 1,
    },
  },
  {
    id: "menu-regular-fries",
    name: "Regular Fries",
    price: 42,
    category: "sides",
    recipe: {
      "Potatoes": 0.22,
      "Packaging boxes": 1,
    },
  },
  {
    id: "menu-hot-wings",
    name: "Hot Wings (6pcs)",
    price: 79,
    category: "sides",
    recipe: {
      "Chicken wings": 6,
      "BBQ sauce": 0.025,
      "Packaging boxes": 1,
    },
  },
  {
    id: "menu-cola",
    name: "Cola 50cl",
    price: 32,
    category: "drinks",
    recipe: {
      "Cola syrup": 0.04,
      "Paper cups": 1,
    },
  },
  {
    id: "menu-orange-soda",
    name: "Orange Soda 50cl",
    price: 32,
    category: "drinks",
    recipe: {
      "Orange soda syrup": 0.04,
      "Paper cups": 1,
    },
  },
  {
    id: "menu-coffee-shake",
    name: "Coffee Shake",
    price: 59,
    category: "desserts",
    recipe: {
      "Coffee beans": 0.018,
      "Ice cream mix": 0.25,
      "Paper cups": 1,
    },
  },
];

export const HOURLY_ORDER_RATES: Record<number, number> = {
  8: 0.08,  // ~5 orders/hr  (~650 kr) - Morning prep / opening
  9: 0.12,  // ~7 orders/hr  (~950 kr) - Morning coffee / breakfast
  10: 0.20, // ~12 orders/hr (~1,600 kr) - Early lunch traffic
  11: 0.38, // ~23 orders/hr (~3,100 kr) - Lunch rush start
  12: 0.65, // ~39 orders/hr (~5,300 kr) - Lunch peak rush
  13: 0.55, // ~33 orders/hr (~4,500 kr) - Post-lunch service
  14: 0.32, // ~19 orders/hr (~2,600 kr) - Afternoon lull
  15: 0.22, // ~13 orders/hr (~1,750 kr) - Afternoon quiet
  16: 0.25, // ~15 orders/hr (~2,000 kr) - Fika / snack traffic
  17: 0.38, // ~23 orders/hr (~3,100 kr) - Dinner rush start
  18: 0.58, // ~35 orders/hr (~4,700 kr) - Dinner peak rush
  19: 0.50, // ~30 orders/hr (~4,050 kr) - Dinner secondary peak
  20: 0.30, // ~18 orders/hr (~2,400 kr) - Evening winding down
  21: 0.16, // ~10 orders/hr (~1,350 kr) - Late evening orders
  22: 0.08, // ~5 orders/hr  (~675 kr) - Closing hour
  23: 0.02, // ~1 order/hr   (~135 kr) - Final wrap-up
};
