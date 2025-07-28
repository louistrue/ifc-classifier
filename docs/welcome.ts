const content = {
  en: `# IFC Classifier

IfcClassifier helps you apply standardized classifications to IFC models right in your browser. The project is open source under the AGPL v3 license and is still a work in progress.

## What It Does

Assigning classification codes in IFC shouldn't slow you down—it should just work. IFC Classifier is a simple, fast solution that handles IFC classifications your way, using [**web-ifc**](https://thatopen.github.io/engine_web-ifc/docs/) for processing models and [**IfcOpenShell**](https://github.com/IfcOpenShell/IfcOpenShell) for exporting proper ClassificationReferences, all while following the standards defined by [**buildingSMART**](https://www.buildingsmart.org/standards/bsi-standards/industry-foundation-classes/).

## Key Features

  - **Automate code assignment** across IFC elements using customizable rules
  - **Switch between classification systems** (Uniclass, eBKP-H, or your custom schema)
  - **Import or export classifications and rules** as JSON or Excel
  - **Copy Global IDs** right from the properties panel
  - **3D selection-based classification** for quick manual fixes
  - **Browser-based** and completely open source

Try it out on your own models and let us know how it works for you!

## Privacy & Security

**Your IFC data never leaves your device.** The application processes all files locally in your browser using [**WebAssembly**](https://webassembly.org/) technology:

- **WebAssembly (WASM)** allows the IFC parser to run at near-native speed directly in your browser
- All processing happens on your device—no server uploads required
- Your models and their data remain private and secure

> **🔍 Verify it yourself:** Press \`F12\` or \`Ctrl+Shift+I\` to open browser developer tools, select the Network tab, and observe that **no IFC data is ever transmitted** while using the application. Your data stays on your device!

## Project Status

This application is still in development. Your feedback and contributions are welcome to help improve its functionality.

## Video Guide

<div style="position:relative;padding-bottom:56.25%;height:0;overflow:hidden;border-radius:0.5rem;">
  <iframe src="https://www.youtube.com/embed/VUEGCefgqkY?si=0FFKAZ14qd518raN" title="IfcClassifier walkthrough" style="position:absolute;top:0;left:0;width:100%;height:100%;" allowfullscreen></iframe>
</div>`,
  de: `# IFC Classifier

IfcClassifier hilft dir, standardisierte Klassifizierungen direkt im Browser auf IFC-Modelle anzuwenden. Das Projekt ist quelloffen unter der AGPL v3 Lizenz und befindet sich noch in Entwicklung.

## Was macht es?

Die Zuordnung von Klassifizierungscodes zu IFC-Elementen soll dich nicht ausbremsen. IFC Classifier bietet eine einfache und schnelle Lösung, nutzt [**web-ifc**](https://thatopen.github.io/engine_web-ifc/docs/) zur Modellverarbeitung und [**IfcOpenShell**](https://github.com/IfcOpenShell/IfcOpenShell) zum Export korrekter ClassificationReferences und folgt dabei den Standards von [**buildingSMART**](https://www.buildingsmart.org/standards/bsi-standards/industry-foundation-classes/).

## Hauptfunktionen

  - **Automatische Codezuweisung** über anpassbare Regeln
  - **Wechsel zwischen Klassifikationssystemen** (Uniclass, eBKP-H oder eigenes Schema)
  - **Klassifikationen und Regeln** als JSON oder Excel importieren und exportieren
  - **Global IDs** im Eigenschaften-Panel kopieren
  - **Manuelle Zuordnung** über 3D-Selektion
  - **Im Browser** und vollständig Open Source

Probiere es mit eigenen Modellen aus und gib uns Feedback!

## Datenschutz & Sicherheit

**Deine IFC-Daten verlassen niemals dein Gerät.** Alle Dateien werden lokal im Browser mit [**WebAssembly**](https://webassembly.org/) verarbeitet:

- **WebAssembly (WASM)** ermöglicht nahezu native Geschwindigkeit im Browser
- Es findet keine Serverübertragung statt – alles bleibt auf deinem Gerät
- Deine Modelle und Daten bleiben privat und sicher

> **🔍 Überprüfe es selbst:** Mit \`F12\` oder \`Ctrl+Shift+I\` die Entwicklertools öffnen, den Reiter Netzwerk wählen und sehen, dass **keine IFC-Daten übertragen** werden.

## Projektstatus

Diese Anwendung befindet sich noch in Entwicklung. Feedback und Beiträge sind willkommen.

## Video-Anleitung

<div style="position:relative;padding-bottom:56.25%;height:0;overflow:hidden;border-radius:0.5rem;">
  <iframe src="https://www.youtube.com/embed/VUEGCefgqkY?si=0FFKAZ14qd518raN" title="IfcClassifier walkthrough" style="position:absolute;top:0;left:0;width:100%;height:100%;" allowfullscreen></iframe>
</div>`,
  fr: `# IFC Classifier

IfcClassifier vous aide à appliquer des classifications standardisées aux modèles IFC directement dans votre navigateur. Le projet est open source sous licence AGPL v3 et est encore en cours de développement.

## Que fait-il ?

L'attribution de codes de classification dans IFC ne devrait pas vous ralentir—cela devrait simplement fonctionner. IFC Classifier est une solution simple et rapide qui gère les classifications IFC à votre façon, utilisant [**web-ifc**](https://thatopen.github.io/engine_web-ifc/docs/) pour traiter les modèles et [**IfcOpenShell**](https://github.com/IfcOpenShell/IfcOpenShell) pour exporter des ClassificationReferences appropriées, tout en suivant les standards définis par [**buildingSMART**](https://www.buildingsmart.org/standards/bsi-standards/industry-foundation-classes/).

## Fonctionnalités clés

  - **Automatiser l'attribution de codes** aux éléments IFC avec des règles personnalisables
  - **Basculer entre systèmes de classification** (Uniclass, eBKP-H, ou votre schéma personnalisé)
  - **Importer ou exporter classifications et règles** en JSON ou Excel
  - **Copier les IDs globaux** directement depuis le panneau des propriétés
  - **Classification par sélection 3D** pour des corrections manuelles rapides
  - **Basé sur navigateur** et complètement open source

Essayez-le sur vos propres modèles et dites-nous comment cela fonctionne pour vous !

## Confidentialité et sécurité

**Vos données IFC ne quittent jamais votre appareil.** L'application traite tous les fichiers localement dans votre navigateur en utilisant la technologie [**WebAssembly**](https://webassembly.org/) :

- **WebAssembly (WASM)** permet au parseur IFC de fonctionner à une vitesse proche du natif directement dans votre navigateur
- Tout le traitement se fait sur votre appareil—aucun téléchargement vers un serveur requis
- Vos modèles et leurs données restent privés et sécurisés

> **🔍 Vérifiez par vous-même :** Appuyez sur \`F12\` ou \`Ctrl+Shift+I\` pour ouvrir les outils de développement du navigateur, sélectionnez l'onglet Réseau, et observez qu'**aucune donnée IFC n'est jamais transmise** lors de l'utilisation de l'application. Vos données restent sur votre appareil !

## Statut du projet

Cette application est encore en développement. Vos commentaires et contributions sont les bienvenus pour aider à améliorer ses fonctionnalités.

## Guide vidéo

<div style="position:relative;padding-bottom:56.25%;height:0;overflow:hidden;border-radius:0.5rem;">
  <iframe src="https://www.youtube.com/embed/VUEGCefgqkY?si=0FFKAZ14qd518raN" title="IfcClassifier walkthrough" style="position:absolute;top:0;left:0;width:100%;height:100%;" allowfullscreen></iframe>
</div>`,
  it: `# IFC Classifier

IfcClassifier ti aiuta ad applicare classificazioni standardizzate ai modelli IFC direttamente nel tuo browser. Il progetto è open source sotto licenza AGPL v3 ed è ancora in fase di sviluppo.

## Cosa fa

L'assegnazione di codici di classificazione in IFC non dovrebbe rallentarti—dovrebbe semplicemente funzionare. IFC Classifier è una soluzione semplice e veloce che gestisce le classificazioni IFC nel modo che preferisci, utilizzando [**web-ifc**](https://thatopen.github.io/engine_web-ifc/docs/) per elaborare i modelli e [**IfcOpenShell**](https://github.com/IfcOpenShell/IfcOpenShell) per esportare ClassificationReferences corretti, seguendo sempre gli standard definiti da [**buildingSMART**](https://www.buildingsmart.org/standards/bsi-standards/industry-foundation-classes/).

## Caratteristiche principali

  - **Automatizza l'assegnazione dei codici** agli elementi IFC utilizzando regole personalizzabili
  - **Passa tra sistemi di classificazione** (Uniclass, eBKP-H, o il tuo schema personalizzato)
  - **Importa o esporta classificazioni e regole** come JSON o Excel
  - **Copia gli ID globali** direttamente dal pannello delle proprietà
  - **Classificazione basata su selezione 3D** per correzioni manuali rapide
  - **Basato su browser** e completamente open source

Provalo sui tuoi modelli e facci sapere come funziona per te!

## Privacy e sicurezza

**I tuoi dati IFC non lasciano mai il tuo dispositivo.** L'applicazione elabora tutti i file localmente nel tuo browser utilizzando la tecnologia [**WebAssembly**](https://webassembly.org/):

- **WebAssembly (WASM)** permette al parser IFC di funzionare a velocità quasi nativa direttamente nel tuo browser
- Tutta l'elaborazione avviene sul tuo dispositivo—nessun caricamento su server richiesto
- I tuoi modelli e i loro dati rimangono privati e sicuri

> **🔍 Verificalo tu stesso:** Premi \`F12\` o \`Ctrl+Shift+I\` per aprire gli strumenti di sviluppo del browser, seleziona la scheda Network e osserva che **nessun dato IFC viene mai trasmesso** durante l'uso dell'applicazione. I tuoi dati rimangono sul tuo dispositivo!

## Stato del progetto

Questa applicazione è ancora in sviluppo. I tuoi feedback e contributi sono benvenuti per aiutare a migliorarne le funzionalità.

## Guida video

<div style="position:relative;padding-bottom:56.25%;height:0;overflow:hidden;border-radius:0.5rem;">
  <iframe src="https://www.youtube.com/embed/VUEGCefgqkY?si=0FFKAZ14qd518raN" title="IfcClassifier walkthrough" style="position:absolute;top:0;left:0;width:100%;height:100%;" allowfullscreen></iframe>
</div>`
};
export default content;
