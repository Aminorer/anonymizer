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
  type: EntityType | string;
  start?: number;
  end?: number;
  occurrences: number;
  confidence: number;
  selected: boolean;
  replacement: string;
  source: 'regex' | 'ner' | 'manual';
  groupId?: string; // 🆕 Pour le groupement
}

export interface EntityStats {
  total_entities: number;
  by_type: Record<string, number>;
  selected_count: number;
  by_source?: Record<string, number>; // 🆕 Statistiques par source
}

// 🆕 NOUVEAUX TYPES POUR LE GROUPEMENT
export interface EntityGroup {
  id: string;
  name: string;
  replacement: string;
  entities: string[]; // IDs des entités groupées
  createdAt: string;
}

export interface CustomEntity {
  text: string;
  entity_type: EntityType;
  replacement: string;
}

export interface AnalyzeResponse {
  success: boolean;
  session_id: string;
  filename: string;
  text_preview: string;
  entities: Entity[];
  stats: EntityStats;
}

// 🆕 TYPES POUR LES MODALS
export interface EntityEditData {
  entityId: string;
  originalText: string;
  newText: string;
  replacement: string;
}

export interface GroupCreationData {
  name: string;
  replacement: string;
  selectedEntityIds: string[];
}

// 🆕 CONFIGURATION DES COULEURS PAR TYPE D'ENTITÉ
export const ENTITY_TYPE_COLORS: Record<string, string> = {
  'PERSONNE': 'bg-blue-100 text-blue-800 border-blue-200',
  'ORGANISATION': 'bg-cyan-100 text-cyan-800 border-cyan-200',
  'TELEPHONE': 'bg-yellow-100 text-yellow-800 border-yellow-200',
  'EMAIL': 'bg-green-100 text-green-800 border-green-200',
  'SECU_SOCIALE': 'bg-red-100 text-red-800 border-red-200',
  'SIRET': 'bg-orange-100 text-orange-800 border-orange-200',
  'ADRESSE': 'bg-purple-100 text-purple-800 border-purple-200',
  'REFERENCE_JURIDIQUE': 'bg-gray-100 text-gray-800 border-gray-200'
};

// 🆕 ICÔNES PAR TYPE D'ENTITÉ
export const ENTITY_TYPE_ICONS: Record<string, string> = {
  'PERSONNE': '👤',
  'ORGANISATION': '🏢',
  'TELEPHONE': '📞',
  'EMAIL': '📧',
  'SECU_SOCIALE': '🆔',
  'SIRET': '🏭',
  'ADRESSE': '🏠',
  'REFERENCE_JURIDIQUE': '⚖️'
};

// 🆕 REMPLACEMENTS PRÉDÉFINIS
export const PREDEFINED_REPLACEMENTS: Record<string, string[]> = {
  'PERSONNE': [
    'M. ANONYME',
    'Mme ANONYME', 
    'PERSONNE_A',
    'PERSONNE_B',
    'CLIENT_ANONYME'
  ],
  'ORGANISATION': [
    'SOCIÉTÉ_ANONYME',
    'ENTREPRISE_A',
    'CABINET_JURIDIQUE',
    'ORGANISATION_X'
  ],
  'SIRET': [
    'XXX XXX XXX XXXXX',
    'SIRET_MASQUE',
    'SIREN_MASQUE',
    'NUMERO_REGISTRE'
  ],
  'TELEPHONE': [
    '0X XX XX XX XX',
    '+33 X XX XX XX XX',
    'TELEPHONE_MASQUE'
  ],
  'EMAIL': [
    'contact@anonyme.fr',
    'email@masque.fr',
    'adresse@confidentiel.fr'
  ],
  'ADRESSE': [
    'ADRESSE_MASQUEE',
    'XX rue de la Paix, 75001 Paris',
    'DOMICILE_ANONYME'
  ]
};