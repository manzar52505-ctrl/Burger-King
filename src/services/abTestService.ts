/**
 * A/B Testing Service
 * Manages variant assignment and persistence.
 */

export type HomeVariant = 'A' | 'B';

class ABTestService {
  private static instance: ABTestService;
  private variant: HomeVariant | null = null;
  private STORAGE_KEY = 'king_burger_ab_variant';

  private constructor() {
    this.variant = this.getStoredVariant();
    if (!this.variant) {
      this.variant = Math.random() > 0.5 ? 'A' : 'B';
      this.storeVariant(this.variant);
    }
  }

  public static getInstance(): ABTestService {
    if (!ABTestService.instance) {
      ABTestService.instance = new ABTestService();
    }
    return ABTestService.instance;
  }

  private getStoredVariant(): HomeVariant | null {
    return localStorage.getItem(this.STORAGE_KEY) as HomeVariant | null;
  }

  private storeVariant(variant: HomeVariant) {
    localStorage.setItem(this.STORAGE_KEY, variant);
  }

  public getVariant(): HomeVariant {
    return this.variant || 'A';
  }

  /**
   * Resets the variant (for testing purposes)
   */
  public resetVariant() {
    this.variant = Math.random() > 0.5 ? 'A' : 'B';
    this.storeVariant(this.variant);
    return this.variant;
  }
}

export const abTest = ABTestService.getInstance();
