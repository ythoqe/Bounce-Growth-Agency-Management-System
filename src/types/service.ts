export type ServiceBillingType = 'one_time' | 'monthly_retainer' | 'sprint';

export interface ServicePackage {
  id: string;
  name: string; // 'Tracking Foundation', 'Performance Growth', 'Analytics & Growth Partner'
  description: string;
  priceMin: number;
  priceMax: number;
  priceRange: string; // e.g. "৳5,000 - ৳8,000"
  currency: 'BDT' | 'USD';
  billingType: ServiceBillingType;
  features: string[];
  category: string;
  isActive: boolean;
  linkedProjectIds?: string[];
  sortOrder?: number;
  createdAt: string;
  updatedAt: string;
}

export interface AgencyServiceItem {
  id: string;
  name: string;
  description: string;
  category: string;
  priceMin: number;
  priceMax: number;
  priceRange: string;
  currency: 'BDT' | 'USD';
  features: string[];
  isActive: boolean;
  linkedProjectIds?: string[];
  createdAt: string;
  updatedAt: string;
}

export interface LinkServiceToProjectInput {
  packageId?: string;
  serviceId?: string;
  projectId: string;
}
