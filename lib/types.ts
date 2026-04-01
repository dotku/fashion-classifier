export interface GarmentAttributes {
  garment_type: string;
  style: string;
  material: string;
  color_palette: string[];
  pattern: string;
  season: string;
  occasion: string;
  consumer_profile: string;
  trend_notes: string;
  location_continent: string;
  location_country: string;
  location_city: string;
}

export interface ImageRecord {
  id: string;
  filename: string;
  original_name: string;
  description: string;
  attributes: GarmentAttributes;
  designer: string;
  upload_date: string; // ISO string
  upload_year: number;
  upload_month: number;
  created_at: string;
}

export interface Annotation {
  id: string;
  image_id: string;
  tags: string[];
  notes: string;
  created_at: string;
}

export interface ClassificationResult {
  description: string;
  attributes: GarmentAttributes;
}

export interface FilterOptions {
  [key: string]: string[];
}
