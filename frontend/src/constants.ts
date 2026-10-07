export { usesNativeTabs } from "@/src/navigation";

export const CATEGORIES: { key: string; label: string; icon: string }[] = [
  { key: "fastfood", label: "Fast-food", icon: "fast-food-outline" },
  { key: "resto", label: "Restos", icon: "restaurant-outline" },
  { key: "bar", label: "Bars", icon: "wine-outline" },
  { key: "club", label: "Boîtes", icon: "musical-notes-outline" },
  { key: "loisirs", label: "Loisirs", icon: "bicycle-outline" },
  { key: "culture", label: "Culture", icon: "color-palette-outline" },
  { key: "commerce", label: "Commerces", icon: "storefront-outline" },
  { key: "fleuriste", label: "Fleuristes", icon: "flower-outline" },
];

export const CATEGORY_LABEL: Record<string, string> = {
  resto: "Restaurant",
  fastfood: "Fast-food",
  fleuriste: "Fleuriste",
  bar: "Bar",
  club: "Boîte de nuit",
  loisirs: "Loisirs & Sport",
  culture: "Culture",
  commerce: "Commerce",
};

export const CATEGORY_ICON: Record<string, string> = Object.fromEntries(CATEGORIES.map((c) => [c.key, c.icon]));

export const DEAL_TYPES: { key: string; label: string }[] = [
  { key: "", label: "Tous" },
  { key: "flash", label: "Vente flash" },
  { key: "etudiant", label: "Étudiant" },
  { key: "groupe", label: "Groupe" },
  { key: "permanent", label: "Permanente" },
];

export const DEAL_TYPE_LABEL: Record<string, string> = {
  flash: "Vente flash",
  etudiant: "Étudiant",
  groupe: "Groupe",
  permanent: "Permanente",
};

export const MODE_ICON: Record<string, string> = {
  walk: "walk-outline",
  transit: "bus-outline",
  bike: "bicycle-outline",
  car: "car-outline",
};

export const MODE_LABEL: Record<string, string> = {
  walk: "À pied",
  transit: "Transports",
  bike: "Vélo",
  car: "Voiture",
};

export const TRANSPORT_ICON: Record<string, string> = {
  tram: "train-outline",
  bus: "bus-outline",
  velo: "bicycle-outline",
  metro: "subway-outline",
};

export const euro = (n: number) => `${n.toFixed(n % 1 === 0 ? 0 : 2).replace(".", ",")} €`;
export const priceLevel = (n: number) => "€".repeat(n);

export function timeLeft(iso: string | null): string | null {
  if (!iso) return null;
  const ms = new Date(iso).getTime() - Date.now();
  if (ms <= 0) return "Expiré";
  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  return h > 0 ? `${h}h ${String(m).padStart(2, "0")}` : `${m} min`;
}
