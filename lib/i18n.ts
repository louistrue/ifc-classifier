export type Language = 'en' | 'de';

export const translations: Record<Language, Record<string, string>> = {
  en: {
    appName: 'IfcClassifier',
    openDocs: 'Open documentation',
    docModalTitle: 'IfcClassifier Guide',
    prev: 'Previous',
    next: 'Next',
    doc_welcome_title: 'Welcome!',
    doc_getting_started_title: 'Getting Started',
    doc_ui_title: 'Interface & 3D',
    doc_classifications_title: 'Classifications',
    doc_rules_title: 'Rules',
    doc_settings_title: 'Settings',
    doc_workflow_title: 'Typical Workflow',
    closeDocs: 'Close documentation',
  },
  de: {
    appName: 'IfcClassifier',
    openDocs: 'Dokumentation öffnen',
    docModalTitle: 'IfcClassifier Anleitung',
    prev: 'Zurück',
    next: 'Weiter',
    doc_welcome_title: 'Willkommen!',
    doc_getting_started_title: 'Erste Schritte',
    doc_ui_title: 'Oberfläche & 3D',
    doc_classifications_title: 'Klassifizierungen',
    doc_rules_title: 'Regeln',
    doc_settings_title: 'Einstellungen',
    doc_workflow_title: 'Typischer Ablauf',
    closeDocs: 'Dokumentation schließen',
  },
};
