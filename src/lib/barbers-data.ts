import barber1 from "@/assets/barber-1.jpg";
import barber2 from "@/assets/barber-2.jpg";
import barber3 from "@/assets/barber-3.jpg";
import barber4 from "@/assets/barber-4.jpg";
import barber5 from "@/assets/barber-5.jpg";
import barber6 from "@/assets/barber-6.jpg";

export type Service = "Cut" | "Color" | "Perm" | "Beard";

export interface FeaturedBarber {
  id: string;
  name: string;
  shop: string;
  image: string;
  services: Service[];
  rating: number;
  reviews: number;
  fromPrice: number;
}

export const featuredBarbers: FeaturedBarber[] = [
  {
    id: "1",
    name: "Marcus Reed",
    shop: "Fold Studio · Brooklyn, NY",
    image: barber1,
    services: ["Cut", "Beard"],
    rating: 4.9,
    reviews: 214,
    fromPrice: 38,
  },
  {
    id: "2",
    name: "Elena Vasquez",
    shop: "Maison Blanc · Chelsea, NY",
    image: barber2,
    services: ["Cut", "Color"],
    rating: 4.8,
    reviews: 189,
    fromPrice: 52,
  },
  {
    id: "3",
    name: "Kai Nakamura",
    shop: "Atelier Nine · Williamsburg, NY",
    image: barber3,
    services: ["Cut", "Color", "Perm"],
    rating: 5.0,
    reviews: 132,
    fromPrice: 45,
  },
  {
    id: "4",
    name: "Alfred Moore",
    shop: "Moore & Sons · Hoboken, NJ",
    image: barber4,
    services: ["Cut", "Beard"],
    rating: 4.9,
    reviews: 401,
    fromPrice: 30,
  },
  {
    id: "5",
    name: "Nadia Rahman",
    shop: "Curl Theory · Astoria, NY",
    image: barber5,
    services: ["Perm", "Color"],
    rating: 4.7,
    reviews: 96,
    fromPrice: 60,
  },
  {
    id: "6",
    name: "Tomas Lindqvist",
    shop: "North Light · SoHo, NY",
    image: barber6,
    services: ["Cut", "Perm", "Beard"],
    rating: 4.8,
    reviews: 158,
    fromPrice: 42,
  },
];
