export enum EntityType {
  PERSONNE = "PERSONNE",
  ADRESSE = "ADRESSE",
  TELEPHONE = "TELEPHONE",
  EMAIL = "EMAIL",
  SECU_SOCIALE = "SECU_SOCIALE",
  ORGANISATION = "ORGANISATION",
  SIRET = "SIRET",
  REFERENCE_JURIDIQUE = "REFERENCE_JURIDIQUE"
}

export interface Entity {
  id: string;
  text: string;
  type: EntityType;
  start?: number;
  end?: number;
  occurrences: number;
  confidence: number;
  selected: boolean;
  replacement: string;
  source: string;
}

export interface EntityStats {
  total_entities: number;
  by_type: Record<string, number>;
  selected_count: number;
}

export interface AnalyzeResponse {
  success: boolean;
  session_id: string;
  filename: string;
  text_preview: string;
  entities: Entity[];
  stats: EntityStats;
}

export interface CustomEntity {
  text: string;
  entity_type: EntityType;
  replacement: string;
}