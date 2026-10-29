import type { Product } from "./types";

export type { Product };

type Seed = Omit<Product, "id" | "active" | "createdAt">;

// Catálogo inicial: gravado no banco na primeira execução. Depois disso, edite pelo /admin.
export const SEED_PRODUCTS: Seed[] = [
  {
    slug: "elfbar-bc-pro-40k",
    name: "Elfbar BC PRO 40K",
    brand: "Elfbar",
    price: 125,
    puffs: "40.000",
    capacity: "20 mL",
    description: "40.000 puffs, capacidade de 20 mL. Tela digital com nível de bateria e líquido.",
    image: "/products/elfbar-bc-pro-40k.jpg",
    flavors: ["Grape Ice", "Watermelon Ice", "Strawberry Kiwi", "Blue Razz Ice", "Menthol"],
    bestseller: true,
  },
  {
    slug: "elfbar-23k",
    name: "Elfbar 23k",
    brand: "Elfbar",
    price: 115,
    puffs: "23.000",
    capacity: "23 mL",
    description: "23.000 puffs, com intensidade ajustável em até 3 níveis, capacidade de 23 mL.",
    image: "/products/elfbar-23k.jpg",
    flavors: ["Peach Ice", "Mango Ice", "Blueberry Ice", "Cherry Lemon"],
  },
  {
    slug: "elfbar-bc-15k",
    name: "Elfbar BC 15k",
    brand: "Elfbar",
    price: 100,
    puffs: "15.000",
    capacity: "13 mL",
    description: "15.000 puffs, capacidade de 13 mL. Compacto e potente.",
    image: "/products/elfbar-bc-15k.png",
    flavors: ["Watermelon Ice", "Strawberry Banana", "Cool Mint"],
  },
  {
    slug: "ignite-v400-mix-boost",
    name: "Ignite V400 Mix Boost Series",
    brand: "Ignite",
    price: 140,
    puffs: "40.000",
    capacity: "18 mL",
    description: "40.000 puffs, dois sabores com intensidade controlável, capacidade de 18 mL.",
    image: "/products/ignite-v400.jpg",
    flavors: ["Grape + Menthol", "Watermelon + Strawberry", "Passion Fruit + Mango"],
    isNew: true,
  },
  {
    slug: "ignite-v300-ultra-slim",
    name: "Ignite v300 Ultra Slim",
    brand: "Ignite",
    price: 130,
    puffs: "30.000",
    capacity: "18 mL",
    description: "30.000 puffs, capacidade de 18 mL. Design ultra slim.",
    image: "/products/ignite-v300.jpg",
    flavors: ["Ice Mint", "Strawberry Ice", "Grape Ice", "Pineapple Ice"],
  },
];

export const normalize = (s: string) =>
  s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();

export const slugify = (s: string) =>
  normalize(s).replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

export function filterProducts(products: Product[], query: string, brand?: string) {
  const q = normalize(query);
  return products.filter(
    (p) =>
      (!brand || p.brand === brand) &&
      (!q || normalize(`${p.name} ${p.brand} ${p.flavors.join(" ")}`).includes(q)),
  );
}

export const brandsOf = (products: Product[]) => [...new Set(products.map((p) => p.brand))].sort();
