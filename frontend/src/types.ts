export type AgeGroup = "minor" | "young" | "adult" | "senior" | "unknown";

export type User = {
  user_id: string;
  email: string;
  name: string;
  first_name: string;
  last_name: string;
  phone: string;
  birthdate: string | null;
  picture?: string | null;
  age: number | null;
  age_group: AgeGroup;
  preferences: { interests: string[]; music: string[]; diet: string[] };
  has_password: boolean;
  auth_providers: string[];
};

export type Transaction = {
  id: string;
  date: string;
  itinerary_id: string;
  itinerary_name: string;
  label: string;
  category: string | null;
  full: number;
  final: number;
  saved: number;
  deal: string | null;
};

export type Finance = Stats & { savings_ratio: number; transactions: Transaction[] };

export type Category = "resto" | "fastfood" | "bar" | "club" | "loisirs" | "culture" | "commerce" | "fleuriste";

export type Deal = {
  id: string;
  place_id: string | null;
  kind: "promo" | "braderie";
  type: "flash" | "etudiant" | "groupe" | "permanent";
  title: string;
  description: string;
  discount_pct: number;
  expires_at: string | null;
  min_people: number;
  image: string;
  place?: PlaceSummary | null;
};

export type PlaceSummary = {
  id: string;
  name: string;
  category: Category;
  image: string;
  address: string;
  lat: number;
  lng: number;
  rating: number;
  indoor: boolean;
  price_level: number;
};

export type Place = {
  id: string;
  name: string;
  category: Category;
  price_level: number;
  avg_price: number;
  rating: number;
  reviews_count: number;
  address: string;
  lat: number;
  lng: number;
  images: string[];
  description: string;
  indoor: boolean;
  tags: string[];
  duration_min: number;
  transports: { type: string; line: string; stop: string; walk_min: number }[];
  reviews: { author: string; rating: number; text: string }[];
  is_open: boolean;
  deals_count: number;
  best_discount: number;
  today_hours: string;
  is_favorite?: boolean;
  week_hours?: { day: string; hours: string; today: boolean }[];
  deals?: Deal[];
};

export type Travel = {
  mode: string;
  duration_min: number;
  distance_km: number;
  lines: string[];
  cost: number;
  from_name: string;
};

export type Step = {
  index: number;
  kind: "place" | "free";
  slot: string;
  slot_label: string;
  start: string;
  end: string;
  title: string;
  place: PlaceSummary | null;
  full_price: number;
  final_price: number;
  deal: { id: string; title: string; discount_pct: number; type: string } | null;
  travel_before: Travel | null;
};

export type PlanParams = {
  budget: number;
  people: number;
  start: string;
  end: string;
  weather: string;
  mode: string;
  interests: string[];
  student: boolean;
  seed?: number;
};

export type Plan = {
  params: PlanParams;
  steps: Step[];
  pinned: (string | null)[];
  totals: {
    budget: number;
    full_total: number;
    final_total: number;
    savings: number;
    travel_total: number;
    remaining: number;
    within_budget: boolean;
  };
  ai: { title: string; summary: string; tips: string[] } | null;
};

export type Itinerary = { id: string; name: string; plan: Plan; ai: Plan["ai"]; created_at: string };

export type Stats = {
  total_saved: number;
  total_spent: number;
  itineraries_count: number;
  claims_count: number;
  favorites_count: number;
  monthly: { key: string; label: string; spent: number; saved: number }[];
};
