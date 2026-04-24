/**
 * Analytics Service for King Burgers
 * Centralizes tracking for user journey, cart events, and conversions.
 */

export type AnalyticsEvent = 
  | { type: 'PAGE_VIEW'; step: string; variant?: string }
  | { type: 'ADD_TO_CART'; itemId: string; name: string; price: number; variant?: string }
  | { type: 'START_CHECKOUT'; cartSize: number; total: number; variant?: string }
  | { type: 'CONVERSION'; orderId: string; total: number; variant?: string }
  | { type: 'MENU_INTERACT'; category: string; variant?: string }
  | { type: 'DEAL_CLAIM'; dealId: string; variant?: string }
  | { type: 'LOCATION_SELECT'; locationId: string; variant?: string }
  | { type: 'AB_TEST_VIEW'; testName: string; variant: string };

class AnalyticsService {
  private static instance: AnalyticsService;
  private isDevelopment: boolean = true;
  private events: any[] = [];

  private constructor() {
    this.isDevelopment = import.meta.env.DEV;
  }

  public static getInstance(): AnalyticsService {
    if (!AnalyticsService.instance) {
      AnalyticsService.instance = new AnalyticsService();
    }
    return AnalyticsService.instance;
  }

  /**
   * Primary tracking method
   * In production, this would send data to GA4, Mixpanel, or Segment.
   * For this app, we log to console and could potentially sync to a 'telemetry' collection in Firestore.
   */
  public track(event: AnalyticsEvent) {
    const timestamp = new Date().toISOString();
    
    // Auto-inject variant if available in localStorage to avoid circular dependency
    const variant = localStorage.getItem('king_burger_ab_variant');
    const enrichedEvent = { ...event, variant: event.variant || variant || 'N/A', timestamp };

    if (this.isDevelopment) {
      console.log(`[Analytics] ${timestamp} - ${enrichedEvent.type}`, enrichedEvent);
      this.events.push(enrichedEvent);
      
      // Log periodic summary every 10 events
      if (this.events.length % 10 === 0) {
        console.group('[Analytics Summary]');
        console.log('Total Events:', this.events.length);
        
        // A/B Test stats summary
        const variantA = this.events.filter(e => e.variant === 'A').length;
        const variantB = this.events.filter(e => e.variant === 'B').length;
        const convA = this.events.filter(e => e.variant === 'A' && e.type === 'CONVERSION').length;
        const convB = this.events.filter(e => e.variant === 'B' && e.type === 'CONVERSION').length;

        console.table({
          Variant_A: { Events: variantA, Conversions: convA, Rate: variantA ? ((convA/variantA)*100).toFixed(2) + '%' : '0%' },
          Variant_B: { Events: variantB, Conversions: convB, Rate: variantB ? ((convB/variantB)*100).toFixed(2) + '%' : '0%' }
        });
        
        console.groupEnd();
      }
    }

    // Example of how to send to an external provider
    // if (window.gtag) {
    //   window.gtag('event', event.type, { ...event, timestamp });
    // }
  }

  /**
   * Helper for page views (funnel steps)
   */
  public trackStep(step: string) {
    this.track({ type: 'PAGE_VIEW', step });
  }

  /**
   * Helper for conversion tracking
   */
  public trackConversion(orderId: string, total: number) {
    this.track({ type: 'CONVERSION', orderId, total });
  }
}

export const analytics = AnalyticsService.getInstance();
