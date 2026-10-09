import type { TrendingSearches } from "@/lib/types";

// Generic sample terms; campuses without their own list fall back to "all".
export const trendingSearches: TrendingSearches = {
  all: ["Scientific calculator", "Laptop charger", "Statistics notes", "Knotless braids", "Mini fridge"],
  midrand: ["Accounting 1A notes", "Gaming headset", "Braids", "Desk lamp", "Logo design"],
  pretoria: ["Calculator", "Python tutor", "Kettle", "Thrift jackets", "Lash tech"],
  "cape-town-mowbray": ["Textbooks", "Bicycle", "Laptop stand", "Nails", "Photography"],
};
