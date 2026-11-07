export type ContentPlatform =
  | 'meta'
  | 'google'
  | 'tiktok'
  | 'linkedin'
  | 'youtube'
  | 'x'
  | 'pinterest'
  | 'other';

export type ContentStatus =
  | 'idea'
  | 'in_creative'
  | 'client_review'
  | 'scheduled'
  | 'published';

export interface ContentItem {
  id: string;
  title: string;
  caption: string;
  platforms: ContentPlatform[];
  publishDate: string; // ISO format: YYYY-MM-DDTHH:mm or YYYY-MM-DD
  status: ContentStatus;
  clientId?: string;
  clientName?: string;
  mediaUrl?: string;
  authorUid?: string;
  authorName?: string;
  notes?: string;
  tags?: string[];
  createdAt: string;
  updatedAt: string;
}

export interface CreateContentItemInput {
  title: string;
  caption: string;
  platforms: ContentPlatform[];
  publishDate: string;
  status?: ContentStatus;
  clientId?: string;
  clientName?: string;
  mediaUrl?: string;
  notes?: string;
  tags?: string[];
}

export interface UpdateContentItemInput {
  title?: string;
  caption?: string;
  platforms?: ContentPlatform[];
  publishDate?: string;
  status?: ContentStatus;
  clientId?: string;
  clientName?: string;
  mediaUrl?: string;
  notes?: string;
  tags?: string[];
}
