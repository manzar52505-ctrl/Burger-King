/**
 * Data Models for the Fast Food System
 */

export enum OrderStatus {
  PENDING = 'pending',
  PREPARING = 'preparing',
  READY = 'ready',
  DELIVERED = 'delivered',
  CANCELLED = 'cancelled'
}

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
}

export interface User {
  userId: string;
  email: string;
  displayName: string;
  photoURL?: string;
  points: number;
  createdAt: string;
}

export interface Order {
  orderId: string;
  userId: string;
  items: any[];
  total: number;
  status: OrderStatus;
  deliveryDetails: {
    fullName: string;
    phone: string;
    address: string;
  };
  createdAt: string;
}
