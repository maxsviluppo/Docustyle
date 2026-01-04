
export enum PageFormat {
  A4 = 'A4',
  A5 = 'A5',
  Letter = 'Letter'
}

export interface PageNumbering {
  enabled: boolean;
  startPage: number;
  endPage: number | null;
  position: 'top-left' | 'top-center' | 'top-right' | 'bottom-left' | 'bottom-center' | 'bottom-right';
}

export interface PageSettings {
  format: PageFormat;
  orientation: 'portrait' | 'landscape';
  margins: {
    top: number;
    bottom: number;
    left: number;
    right: number;
  };
  lineHeight: number;
  paragraphSpacing: number;
  fontFamily: string;
  paragraphBorderWidth: number;
  paragraphBorderColor: string;
  paragraphPadding: number;
  firstLineIndent: number; // in mm
  fontSizeBody: number; // in pt
  fontSizeH1: number; // in pt
  fontSizeH2: number; // in pt
  pageNumbering: PageNumbering;
}

export interface DocumentTemplate {
  id: string;
  name: string;
  description: string;
  icon: string;
  settings: PageSettings;
  initialContent: string;
}

export interface SavedProject {
  id: string;
  name: string;
  settings: PageSettings;
  content: string;
  timestamp: number;
}

export const FORMAT_DIMENSIONS = {
  [PageFormat.A4]: { width: '210mm', height: '297mm' },
  [PageFormat.A5]: { width: '148mm', height: '210mm' },
  [PageFormat.Letter]: { width: '215.9mm', height: '279.4mm' }
};

export const FONTS = [
  { name: 'Inter', value: "'Inter', sans-serif" },
  { name: 'Montserrat', value: "'Montserrat', sans-serif" },
  { name: 'Roboto', value: "'Roboto', sans-serif" },
  { name: 'Playfair Display', value: "'Playfair Display', serif" },
  { name: 'Merriweather', value: "'Merriweather', serif" },
  { name: 'Lora', value: "'Lora', serif" },
  { name: 'System Mono', value: 'monospace' }
];

const defaultPageNumbering: PageNumbering = {
  enabled: false,
  startPage: 1,
  endPage: null,
  position: 'bottom-center'
};

export const PREDEFINED_TEMPLATES: DocumentTemplate[] = [
  {
    id: 'simple',
    name: 'Documento Semplice',
    description: 'Layout pulito e minimale. Margini standard 20mm, interlinea 1.15.',
    icon: 'fa-align-left',
    settings: {
      format: PageFormat.A4,
      orientation: 'portrait',
      margins: { top: 20, bottom: 20, left: 20, right: 20 },
      lineHeight: 1.15,
      paragraphSpacing: 10,
      fontFamily: "'Inter', sans-serif",
      paragraphBorderWidth: 0,
      paragraphBorderColor: '#e5e7eb',
      paragraphPadding: 0,
      firstLineIndent: 0,
      fontSizeBody: 11,
      fontSizeH1: 20,
      fontSizeH2: 16,
      pageNumbering: { ...defaultPageNumbering, enabled: false }
    },
    initialContent: '<h1>Titolo Documento</h1><p>Inserisci qui il tuo testo semplice...</p>'
  },
  {
    id: 'professional',
    name: 'Documento Professionale',
    description: 'Relazione formale istituzionale. Margini 25-30mm, font istituzionale.',
    icon: 'fa-briefcase',
    settings: {
      format: PageFormat.A4,
      orientation: 'portrait',
      margins: { top: 25, bottom: 25, left: 30, right: 20 },
      lineHeight: 1.3,
      paragraphSpacing: 12,
      fontFamily: "'Roboto', sans-serif",
      paragraphBorderWidth: 0,
      paragraphBorderColor: '#e5e7eb',
      paragraphPadding: 0,
      firstLineIndent: 12,
      fontSizeBody: 12,
      fontSizeH1: 18,
      fontSizeH2: 14,
      pageNumbering: { ...defaultPageNumbering, enabled: true, position: 'bottom-right' }
    },
    initialContent: '<h1>Relazione Professionale</h1><h2>Sintesi Esecutiva</h2><p>Questo layout segue le regole della videoscrittura professionale moderna...</p>'
  },
  {
    id: 'thesis',
    name: 'Documento Tesi',
    description: 'Standard accademico: margine rilegatura 40mm, interlinea 1.5, numerazione tesi.',
    icon: 'fa-graduation-cap',
    settings: {
      format: PageFormat.A4,
      orientation: 'portrait',
      margins: { top: 30, bottom: 30, left: 40, right: 25 },
      lineHeight: 1.5,
      paragraphSpacing: 8,
      fontFamily: "'Merriweather', serif",
      paragraphBorderWidth: 0,
      paragraphBorderColor: '#e5e7eb',
      paragraphPadding: 0,
      firstLineIndent: 15,
      fontSizeBody: 12,
      fontSizeH1: 16,
      fontSizeH2: 14,
      pageNumbering: { ...defaultPageNumbering, enabled: true, position: 'bottom-center' }
    },
    initialContent: '<h1 style="text-align:center">TITOLO TESI DI LAUREA</h1><h2>Introduzione</h2><p>Analisi metodologica e impaginazione accademica...</p>'
  }
];
