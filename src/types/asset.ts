export type TrackingAssetType =
  | 'ga4'
  | 'gtm_web'
  | 'google_ads'
  | 'meta_pixel'
  | 'meta_capi'
  | 'tiktok_pixel'
  | 'tiktok_events_api'
  | 'gtm_server'
  | 'stape'
  | 'looker_studio'
  | 'custom_domain';

export interface TrackingAsset {
  id: string; // Unique document ID
  clientId: string;
  clientName: string;
  projectId?: string;
  projectName?: string;
  assetType: TrackingAssetType;
  name: string; // assetName
  measurementId?: string; // GA4 ID (G-XXXXXX)
  containerId?: string; // GTM Web or Server Container ID (GTM-XXXXXX)
  pixelId?: string; // Meta or TikTok Pixel ID
  serverContainerUrl?: string; // e.g. https://ssgtm.client.com or Stape URL
  dashboardUrl?: string; // Looker Studio report URL
  accessLevel: 'admin_only' | 'shared_with_client';
  status: 'active' | 'in_configuration' | 'verifying' | 'archived';
  notes?: string;
  createdAt: string;
  updatedAt: string;
  createdBy: string;
}
