export interface ApiPricingTableDto {
  id: string;
  storeId: string;
  products: ApiProductDto[];
}

/**
 * Product DTO Interface
 * Represents the data structure for product information in the API
 */
export interface ApiProductDto {
  /** Unique identifier for the product */
  id: string;
  
  /** Product name */
  name: string;
  
  /** Detailed product description */
  description: string;
  
  /** Product price in smallest currency unit (e.g., cents) */
  price: number;
  
  /** Currency code (e.g., USD, EUR) */
  currency: string;
  
  /** Billing period for subscription products */
  billing_period: BillingPeriod;
  
  /** Payment provider type */
  payment_type: string;
  
  /** URL for the payment checkout page */
  payment_link: string;
  
  /** Optional URL for product image */
  product_image_url?: string;
  
  /** Whether this is a featured product */
  featured: boolean;
  
  /** Tax handling behavior */
  tax_behavior?: TaxBehavior | null;
  
  /** List of product features */
  features: string[];
  
  /** Product creation timestamp */
  created_at: Date;
  
  /** Last update timestamp */
  updated_at: Date;
}

export enum TaxBehavior {
  Exclusive = 'exclusive',
  Inclusive = 'inclusive',
  Unspecified = 'unspecified',
}

/**
 * Billing Period Enum
 * Defines available subscription billing intervals
 */
export enum BillingPeriod {
  /** Monthly billing */
  oneMonth = 'one-m',
  
  /** Quarterly billing */
  threeMonths = 'three-m',
  
  /** Semi-annual billing */
  sixMonths = 'six-m',
  
  /** Annual billing */
  oneYear = 'one-y',
}