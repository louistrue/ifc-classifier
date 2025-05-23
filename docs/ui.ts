const content = {
  en: `## Interface Overview

The app is divided into three areas: a **Model Explorer** on the left, a central **3D view**, and tabs for **Classifications**, **Rules** and **Settings** on the right. The top menubar lets you toggle the theme and open this guide.

### 3D Controls

- **Orbit** - left mouse drag
- **Pan** - middle mouse drag or \`Shift\` + left drag
- **Zoom** - scroll wheel or right drag
- **Select** - left click an element

### View Toolbar

The toolbar below the canvas offers quick actions:

- **Zoom to Extents** - \`E\` - fit the whole model
- **Zoom to Selected** - \`F\` - focus the active element
- **Hide Selected** - \`Spacebar\` - toggle visibility of the current selection
  - **Unhide Last** - \`Ctrl/Cmd+Z\` - restore the last hidden element
  - **Unhide All** - \`Shift+A\` - show everything again

### Properties Panel

Use this panel to inspect attributes and property sets. The **Global ID** row includes a small copy button.

### Schema Documentation

Throughout the interface, you'll find interactive schema features:

- **Schema Preview Tooltips** - Hover over IFC class names (like IfcWall, IfcColumn) to see instant previews with entity descriptions and key information
- **"View Schema" Links** - Click these links to open the full documentation reader with comprehensive details about IFC entities
- **Documentation Reader** - A modal window that displays complete schema documentation including entity descriptions, attributes, inheritance relationships, and examples
- **Smart Caching** - Schema data is cached locally for fast access and offline use`,
  de: `## Überblick über die Oberfläche

Die App ist in drei Bereiche gegliedert: Links der **Model Explorer**, in der Mitte die **3D-Ansicht**, rechts die Tabs **Classifications**, **Rules** und **Settings**. Über die Menubar oben kannst du das Theme wechseln und diese Hilfe öffnen.

### 3D-Steuerung

- **Orbit** – mit der linken Maustaste ziehen
- **Pan** – mittlere Maustaste oder \`Shift\` + linke Maustaste
- **Zoom** – Mausrad oder rechte Maustaste ziehen
- **Select** – Element mit linker Maustaste anklicken

### Werkzeugleiste

Die Leiste unterhalb der Ansicht bietet schnelle Aktionen:

- **Zoom to Extents** – \`E\` – gesamtes Modell einpassen
- **Zoom to Selected** – \`F\` – auf aktives Element fokussieren
- **Hide Selected** – \`Spacebar\` – aktuelle Auswahl ausblenden
  - **Unhide Last** – \`Ctrl/Cmd+Z\` – zuletzt ausgeblendetes Element wiederherstellen
  - **Unhide All** – \`Shift+A\` – alles einblenden

### Eigenschaften-Panel

Hier siehst du Attribute und Property Sets. Neben der **Global ID** gibt es ein kleines Kopiersymbol.

### Schema-Dokumentation

In der gesamten Oberfläche findest du interaktive Schema-Funktionen:

- **Schema-Vorschau-Tooltips** - Bewege die Maus über IFC-Klassennamen (wie IfcWall, IfcColumn) für sofortige Vorschauen mit Entitätsbeschreibungen und wichtigen Informationen
- **"Schema anzeigen"-Links** - Klicke auf diese Links um den vollständigen Dokumentations-Reader mit umfassenden Details zu IFC-Entitäten zu öffnen
- **Dokumentations-Reader** - Ein Modal-Fenster das vollständige Schema-Dokumentation einschließlich Entitätsbeschreibungen, Attributen, Vererbungsbeziehungen und Beispielen anzeigt
- **Intelligente Zwischenspeicherung** - Schema-Daten werden lokal zwischengespeichert für schnellen Zugriff und Offline-Nutzung`,
  fr: `## Vue d'ensemble de l'interface

L'application est divisée en trois zones : un **Explorateur de modèle** à gauche, une **vue 3D** centrale, et des onglets pour **Classifications**, **Règles** et **Paramètres** à droite. La barre de menu supérieure vous permet de basculer le thème et d'ouvrir ce guide.

### Contrôles 3D

- **Orbiter** - glisser avec le bouton gauche de la souris
- **Panoramique** - glisser avec le bouton du milieu ou \`Shift\` + glisser gauche
- **Zoom** - molette de défilement ou glisser droit
- **Sélectionner** - clic gauche sur un élément

### Barre d'outils de vue

La barre d'outils sous la zone de travail offre des actions rapides :

- **Zoom sur l'étendue** - \`E\` - ajuster tout le modèle
- **Zoom sur la sélection** - \`F\` - centrer sur l'élément actif
- **Masquer la sélection** - \`Espace\` - basculer la visibilité de la sélection actuelle
  - **Afficher le dernier** - \`Ctrl/Cmd+Z\` - restaurer le dernier élément masqué
  - **Tout afficher** - \`Shift+A\` - tout montrer à nouveau

### Panneau des propriétés

Utilisez ce panneau pour inspecter les attributs et les ensembles de propriétés. La ligne **Global ID** inclut un petit bouton de copie.

### Documentation du schéma

Dans toute l'interface, vous trouverez des fonctionnalités de schéma interactives :

- **Infobulles d'aperçu du schéma** - Survolez les noms de classes IFC (comme IfcWall, IfcColumn) pour voir des aperçus instantanés avec descriptions d'entités et informations clés
- **Liens "Voir le schéma"** - Cliquez sur ces liens pour ouvrir le lecteur de documentation complet avec des détails exhaustifs sur les entités IFC
- **Lecteur de documentation** - Une fenêtre modale qui affiche la documentation complète du schéma incluant descriptions d'entités, attributs, relations d'héritage et exemples
- **Mise en cache intelligente** - Les données de schéma sont mises en cache localement pour un accès rapide et une utilisation hors ligne`,
  it: `## Panoramica dell'interfaccia

L'app è divisa in tre aree: un **Esploratore del modello** a sinistra, una **vista 3D** centrale, e schede per **Classificazioni**, **Regole** e **Impostazioni** a destra. La barra dei menu in alto ti permette di cambiare il tema e aprire questa guida.

### Controlli 3D

- **Orbita** - trascinare con il tasto sinistro del mouse
- **Panoramica** - trascinare con il tasto centrale o \`Shift\` + trascinare sinistro
- **Zoom** - rotella di scorrimento o trascinare destro
- **Seleziona** - clic sinistro su un elemento

### Barra degli strumenti vista

La barra degli strumenti sotto la tela offre azioni rapide:

- **Adatta all'estensione** - \`E\` - adatta l'intero modello
- **Zoom su selezionato** - \`F\` - focalizza sull'elemento attivo
- **Nascondi selezionato** - \`Barra spaziatrice\` - attiva/disattiva la visibilità della selezione corrente
  - **Mostra ultimo** - \`Ctrl/Cmd+Z\` - ripristina l'ultimo elemento nascosto
  - **Mostra tutto** - \`Shift+A\` - mostra tutto di nuovo

### Pannello delle proprietà

Usa questo pannello per ispezionare attributi e set di proprietà. La riga **Global ID** include un piccolo pulsante di copia.

### Documentazione dello schema

In tutta l'interfaccia, troverai funzionalità interattive dello schema:

- **Tooltip di anteprima dello schema** - Passa il mouse sui nomi delle classi IFC (come IfcWall, IfcColumn) per vedere anteprime istantanee con descrizioni delle entità e informazioni chiave
- **Link "Visualizza schema"** - Fai clic su questi link per aprire il lettore di documentazione completo con dettagli esaustivi sulle entità IFC
- **Lettore di documentazione** - Una finestra modale che visualizza la documentazione completa dello schema incluse descrizioni delle entità, attributi, relazioni di ereditarietà ed esempi
- **Cache intelligente** - I dati dello schema sono memorizzati nella cache localmente per accesso rapido e uso offline`
};
export default content;
