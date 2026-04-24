/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface MenuItem {
  id: string;
  name: string;
  description: string;
  price: number;
  category: 'burgers' | 'sides' | 'drinks' | 'desserts' | 'deals';
  image: string;
  calories: number;
  popular?: boolean;
  new?: boolean;
  isVeg?: boolean;
  isSpicy?: boolean;
  allergens?: string[];
}

export interface Ingredient {
  id: string;
  name: string;
  price: number;
  calories: number;
  removable?: boolean;
}

export const INGREDIENTS: Ingredient[] = [
  { id: 'bacon', name: 'Premium Bacon', price: 1.50, calories: 120 },
  { id: 'cheese', name: 'American Cheese', price: 0.80, calories: 80 },
  { id: 'patty', name: 'Extra Patty', price: 2.50, calories: 240 },
  { id: 'pickles', name: 'Pickles', price: 0, calories: 5, removable: true },
  { id: 'onions', name: 'Onions', price: 0, calories: 5, removable: true },
  { id: 'lettuce', name: 'Lettuce', price: 0, calories: 5, removable: true },
  { id: 'mayo', name: 'Creamy Mayo', price: 0, calories: 60, removable: true },
];

export interface CartItem extends MenuItem {
  cartId: string;
  quantity: number;
  customizations?: {
    added: string[];
    removed: string[];
  };
}

export interface Restaurant {
  id: string;
  name: string;
  address: string;
  distance: string;
  isOpen: boolean;
  closingTime: string;
  phone: string;
  lat: number;
  lng: number;
}

export const RESTAURANTS: Restaurant[] = [
  {
    id: 'loc-1',
    name: 'Downtown Grill',
    address: '456 Main St, Metropolis',
    distance: '0.8 miles',
    isOpen: true,
    closingTime: '11:00 PM',
    phone: '(555) 123-4567',
    lat: 40.7128,
    lng: -74.0060
  },
  {
    id: 'loc-2',
    name: 'Westside Palace',
    address: '789 Sunset Blvd, Metropolis',
    distance: '2.4 miles',
    isOpen: true,
    closingTime: '10:30 PM',
    phone: '(555) 987-6543',
    lat: 40.7282,
    lng: -73.9942
  },
  {
    id: 'loc-3',
    name: 'The King\'s Wharf',
    address: '101 Bay View, Metropolis',
    distance: '4.1 miles',
    isOpen: false,
    closingTime: 'Closed',
    phone: '(555) 555-0199',
    lat: 40.7306,
    lng: -73.9352
  }
];

export interface Deal {
  id: string;
  title: string;
  description: string;
  image: string;
  discountPrice: number;
  originalPrice: number;
  promoCode: string;
  isAppOnly?: boolean;
  expiresInSeconds: number;
}

export const DEALS: Deal[] = [
  {
    id: 'midnight-snack',
    title: 'MIDNIGHT SMASH',
    description: 'Get 50% off any Whopper meal after 10PM. Limited quantity available.',
    image: 'https://images.unsplash.com/photo-1594212699903-ec8a3eca50f5?auto=format&fit=crop&q=80&w=800&fm=webp',
    discountPrice: 4.99,
    originalPrice: 9.99,
    promoCode: 'MIDNIGHT50',
    expiresInSeconds: 3600 * 2,
    isAppOnly: true
  },
  {
    id: 'family-feast',
    title: 'THE KING\'S BANQUET',
    description: '2 Whoppers, 2 Crispy Chicken, 2 Large Fries, and 4 Drinks.',
    image: 'https://images.unsplash.com/photo-1610614819513-58e34989848b?auto=format&fit=crop&q=80&w=800&fm=webp',
    discountPrice: 19.99,
    originalPrice: 29.99,
    promoCode: 'BANQUET10',
    expiresInSeconds: 3600 * 5
  },
  {
    id: 'sweet-treat',
    title: 'BOGO SHAKES',
    description: 'Buy one OREO® Cookie Shake, get one FREE. Cool down with the King.',
    image: 'https://images.unsplash.com/photo-1572490122747-3968b75cc699?auto=format&fit=crop&q=80&w=800&fm=webp',
    discountPrice: 4.49,
    originalPrice: 8.98,
    promoCode: 'SHAKEIT',
    expiresInSeconds: 3600 * 1
  }
];

export const MENU_ITEMS: MenuItem[] = [
  {
    id: 'whopper',
    name: 'WHOPPER®',
    description: 'A ¼ lb.* of savory flame-grilled beef topped with juicy tomatoes, fresh lettuce, creamy mayonnaise, ketchup, crunchy pickles, and sliced white onions on a soft sesame seed bun.',
    price: 6.49,
    category: 'burgers',
    image: 'https://images.unsplash.com/photo-1571091718767-18b5b1457add?auto=format&fit=crop&q=80&w=800&fm=webp',
    calories: 670,
    popular: true,
    allergens: ['Soy', 'Milk', 'Wheat']
  },
  {
    id: 'impossible-whopper',
    name: 'IMPOSSIBLE™ WHOPPER®',
    description: 'Our Impossible™ Whopper® is a flame-grilled, plant-based patty topped with tomatoes, lettuce, mayo, ketchup, pickles, and onions.',
    price: 7.49,
    category: 'burgers',
    image: 'https://images.unsplash.com/photo-1586190848861-99aa4a171e90?auto=format&fit=crop&q=80&w=800&fm=webp',
    calories: 630,
    isVeg: true,
    allergens: ['Soy', 'Wheat', 'Milk']
  },
  {
    id: 'spicy-chicken',
    name: 'SPICY CHICKEN SANDWICH',
    description: 'White meat chicken breast, breaded with a bold, spicy seasoning and topped with lettuce and mayo.',
    price: 5.49,
    category: 'burgers',
    image: 'https://images.unsplash.com/photo-1606755962773-d324e0a13086?auto=format&fit=crop&q=80&w=800&fm=webp',
    calories: 520,
    isSpicy: true,
    new: true,
    allergens: ['Wheat', 'Milk', 'Eggs']
  },
  {
    id: 'big-king',
    name: 'BIG KING®',
    description: 'Two savory flame-grilled beef patties topped with melted American cheese, fresh lettuce, sliced onions, crunchy pickles, and our signature BIG KING® sauce.',
    price: 5.99,
    category: 'burgers',
    image: 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?auto=format&fit=crop&q=80&w=800&fm=webp',
    calories: 490,
    allergens: ['Wheat', 'Milk', 'Soy', 'Eggs']
  },
  {
    id: 'chicken-fries',
    name: 'CHICKEN FRIES',
    description: 'Made with white meat chicken, our Chicken Fries are coated in a light breading seasoned with savory spices.',
    price: 4.29,
    category: 'sides',
    image: 'https://images.unsplash.com/photo-1562967914-6cbb241c2edf?auto=format&fit=crop&q=80&w=800&fm=webp',
    calories: 280,
    popular: true,
    allergens: ['Wheat']
  },
  {
    id: 'fries',
    name: 'FRENCH FRIES',
    description: 'Our Great Tasting Fries are thick cut and salted to perfection.',
    price: 2.99,
    category: 'sides',
    image: 'https://images.unsplash.com/photo-1573080496219-bb080dd4f877?auto=format&fit=crop&q=80&w=800&fm=webp',
    calories: 380,
    isVeg: true
  },
  {
    id: 'oreo-shake',
    name: 'OREO® COOKIE SHAKE',
    description: 'Velvety vanilla soft serve mixed with OREO® cookie pieces.',
    price: 4.49,
    category: 'desserts',
    image: 'https://images.unsplash.com/photo-1572490122747-3968b75cc699?auto=format&fit=crop&q=80&w=800&fm=webp',
    calories: 590,
    new: true,
    allergens: ['Milk', 'Wheat', 'Soy']
  },
  {
    id: 'coca-cola',
    name: 'COCA-COLA®',
    description: 'A refreshing cola drink.',
    price: 2.19,
    category: 'drinks',
    image: 'https://images.unsplash.com/photo-1622483767028-3f66f32aef97?auto=format&fit=crop&q=80&w=800&fm=webp',
    calories: 140,
    isVeg: true
  },
  {
    id: 'family-bundle',
    name: 'FAMILY BUNDLE',
    description: '3 Whoppers, 3 Cheeseburgers, and 3 sets of Large Fries.',
    price: 24.99,
    category: 'deals',
    image: 'https://images.unsplash.com/photo-1610614819513-58e34989848b?auto=format&fit=crop&q=80&w=800&fm=webp',
    calories: 2400,
    new: true,
    allergens: ['Wheat', 'Milk', 'Soy', 'Eggs']
  }
];
