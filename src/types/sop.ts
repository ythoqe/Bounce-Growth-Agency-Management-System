export type SopCategory =
  | 'tracking'
  | 'meta_ads'
  | 'google_ads'
  | 'ga4'
  | 'qa';

export interface SopGuide {
  id: string;
  title: string;
  category: SopCategory;
  summary: string;
  content: string;
  steps: string[];
  externalDocUrl?: string;
  tags: string[];
  authorUid?: string;
  authorName?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateSopInput {
  title: string;
  category: SopCategory;
  summary: string;
  content: string;
  steps?: string[];
  externalDocUrl?: string;
  tags?: string[];
}

export interface UpdateSopInput {
  title?: string;
  category?: SopCategory;
  summary?: string;
  content?: string;
  steps?: string[];
  externalDocUrl?: string;
  tags?: string[];
}
