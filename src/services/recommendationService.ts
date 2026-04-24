import { MenuItem, MENU_ITEMS, CartItem } from '../constants';

export interface RecommendationResult {
  personalized: MenuItem[];
  frequentlyBoughtTogether: MenuItem[];
  trending: MenuItem[];
}

class RecommendationService {
  private static instance: RecommendationService;

  private constructor() {}

  public static getInstance(): RecommendationService {
    if (!RecommendationService.instance) {
      RecommendationService.instance = new RecommendationService();
    }
    return RecommendationService.instance;
  }

  /**
   * Get personalized recommendations based on user order history
   */
  public getPersonalized(history: any[], menu: MenuItem[] = MENU_ITEMS): MenuItem[] {
    if (!history || history.length === 0) {
      // Default to "Popular" items if no history
      return menu.filter(item => item.popular).slice(0, 4);
    }

    // Identify favorite categories
    const categoryCounts: Record<string, number> = {};
    history.forEach(order => {
      order.items?.forEach((item: any) => {
        categoryCounts[item.category] = (categoryCounts[item.category] || 0) + 1;
      });
    });

    const favoriteCategory = Object.entries(categoryCounts)
      .sort(([, a], [, b]) => b - a)[0]?.[0];

    // Find items in favorite category that the user hasn't tried recently
    // or just the most popular ones in that category
    return menu.filter(item => 
      item.category === favoriteCategory && 
      !item.id.includes('bundle') // Avoid suggesting big bundles here
    ).slice(0, 4);
  }

  /**
   * Get suggestions based on what's currently in the cart
   */
  public getFrequentlyBoughtTogether(cart: CartItem[], menu: MenuItem[] = MENU_ITEMS): MenuItem[] {
    const suggestions: MenuItem[] = [];
    const cartIds = cart.map(i => i.id);
    const cartCategories = cart.map(i => i.category);

    // If they have burgers but no sides, suggest fries or chicken fries
    if (cartCategories.includes('burgers') && !cartCategories.includes('sides')) {
      const fries = menu.find(i => i.id === 'fries');
      const chickenFries = menu.find(i => i.id === 'chicken-fries');
      if (fries) suggestions.push(fries);
      if (chickenFries) suggestions.push(chickenFries);
    }

    // If they have burgers but no drinks, suggest Coca-cola
    if (cartCategories.includes('burgers') && !cartCategories.includes('drinks')) {
      const coke = menu.find(i => i.id === 'coca-cola');
      if (coke) suggestions.push(coke);
    }

    // If no dessert, suggest the Oreo Shake
    if (!cartCategories.includes('desserts') && cart.length > 0) {
      const shake = menu.find(i => i.id === 'oreo-shake');
      if (shake) suggestions.push(shake);
    }

    // Fallback/Add trending items if suggestions are few
    if (suggestions.length < 2) {
      const popular = menu.filter(i => i.popular && !cartIds.includes(i.id));
      suggestions.push(...popular.slice(0, 2));
    }

    // Limit and unique
    return Array.from(new Set(suggestions)).slice(0, 4);
  }

  /**
   * Get global trending items
   */
  public getTrending(menu: MenuItem[] = MENU_ITEMS): MenuItem[] {
    return menu.filter(item => item.popular || item.new).slice(0, 4);
  }
}

export const recommendationService = RecommendationService.getInstance();
