const content = {
  en: `## Typical Workflow

Here's how most users approach classification in IfcClassifier:

### 1. Load a Model
- Upload your IFC file or select a demo model from **Settings**
- The model loads in the 3D viewer with the spatial tree on the left

### 2. Choose Classification System
- Go to **Classifications** and load a standard set (Uniclass, eBKP-H) or create custom entries
- Alternatively, set a **Default Classification** in **Settings** to auto-apply

### 3. Set Up Automation (Optional)
- In **Rules**, create logic like "If IFC Type = IfcWall, assign Wall classification"
- Use **Preview Rule Impact** to test before applying
- Rules save time on large models with repetitive patterns

### 4. Manual Classification
- Select elements in 3D or from the tree
- Choose a classification and click **Assign Selected Element**
- Use classification colors to visualize your progress

### 5. Export Results
- Export the classified model as IFC using **Export IFC**
- Save your classifications and rules as JSON/Excel for reuse

This workflow scales from small manual projects to large automated classification jobs.`,
  de: `## Typischer Arbeitsablauf

So gehen die meisten Nutzer bei der Klassifizierung in IfcClassifier vor:

### 1. Modell laden
- IFC-Datei hochladen oder Demo-Modell aus **Settings** wählen
- Das Modell wird im 3D-Viewer mit dem Strukturbaum links geladen

### 2. Klassifikationssystem wählen
- Zu **Classifications** gehen und Standardset (Uniclass, eBKP-H) laden oder eigene Einträge erstellen
- Alternativ eine **Default Classification** in **Settings** festlegen für automatische Anwendung

### 3. Automatisierung einrichten (Optional)
- In **Rules** Logik erstellen wie "Wenn IFC Type = IfcWall, dann Wall-Klassifikation zuweisen"
- **Preview Rule Impact** nutzen, um vor dem Anwenden zu testen
- Regeln sparen Zeit bei großen Modellen mit wiederkehrenden Mustern

### 4. Manuelle Klassifikation
- Elemente in 3D oder im Baum auswählen
- Klassifikation wählen und **Assign Selected Element** klicken
- Klassifikationsfarben nutzen, um den Fortschritt zu visualisieren

### 5. Ergebnisse exportieren
- Klassifiziertes Modell als IFC mit **Export IFC** exportieren
- Klassifikationen und Regeln als JSON/Excel zur Wiederverwendung speichern

Dieser Arbeitsablauf skaliert von kleinen manuellen Projekten bis zu großen automatisierten Klassifikationsaufgaben.`,
  fr: `## Flux de travail typique

Voici comment la plupart des utilisateurs abordent la classification dans IfcClassifier :

### 1. Charger un modèle
- Téléchargez votre fichier IFC ou sélectionnez un modèle de démonstration depuis **Paramètres**
- Le modèle se charge dans le visualiseur 3D avec l'arbre spatial à gauche

### 2. Choisir le système de classification
- Allez dans **Classifications** et chargez un ensemble standard (Uniclass, eBKP-H) ou créez des entrées personnalisées
- Alternativement, définissez une **Classification par défaut** dans **Paramètres** pour l'application automatique

### 3. Configurer l'automatisation (Optionnel)
- Dans **Règles**, créez une logique comme "Si Type IFC = IfcWall, assigner la classification Mur"
- Utilisez **Prévisualiser l'impact de la règle** pour tester avant d'appliquer
- Les règles font gagner du temps sur les gros modèles avec des motifs répétitifs

### 4. Classification manuelle
- Sélectionnez des éléments en 3D ou depuis l'arbre
- Choisissez une classification et cliquez sur **Assigner l'élément sélectionné**
- Utilisez les couleurs de classification pour visualiser votre progression

### 5. Exporter les résultats
- Exportez le modèle classifié en IFC en utilisant **Exporter IFC**
- Sauvegardez vos classifications et règles en JSON/Excel pour réutilisation

Ce flux de travail s'adapte des petits projets manuels aux gros travaux de classification automatisée.`,
  it: `## Flusso di lavoro tipico

Ecco come la maggior parte degli utenti affronta la classificazione in IfcClassifier:

### 1. Carica un modello
- Carica il tuo file IFC o seleziona un modello demo da **Impostazioni**
- Il modello si carica nel visualizzatore 3D con l'albero spaziale a sinistra

### 2. Scegli il sistema di classificazione
- Vai a **Classificazioni** e carica un set standard (Uniclass, eBKP-H) o crea voci personalizzate
- In alternativa, imposta una **Classificazione predefinita** in **Impostazioni** per l'applicazione automatica

### 3. Configura l'automazione (Opzionale)
- In **Regole**, crea logica come "Se Tipo IFC = IfcWall, assegna classificazione Parete"
- Usa **Anteprima impatto regola** per testare prima di applicare
- Le regole fanno risparmiare tempo su modelli grandi con pattern ripetitivi

### 4. Classificazione manuale
- Seleziona elementi in 3D o dall'albero
- Scegli una classificazione e fai clic su **Assegna elemento selezionato**
- Usa i colori di classificazione per visualizzare i tuoi progressi

### 5. Esporta i risultati
- Esporta il modello classificato come IFC usando **Esporta IFC**
- Salva le tue classificazioni e regole come JSON/Excel per il riutilizzo

Questo flusso di lavoro si adatta da piccoli progetti manuali a grandi lavori di classificazione automatizzata.`
};
export default content;
