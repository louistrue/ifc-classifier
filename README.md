# IFC Classifier 🧐

[![License: AGPL v3](https://img.shields.io/badge/License-AGPL%20v3-blue.svg)](https://www.gnu.org/licenses/agpl-3.0)
[![Work in Progress](https://img.shields.io/badge/Status-WIP-orange.svg)]()
[![TypeScript](https://img.shields.io/badge/TypeScript-3178C6.svg?logo=typescript&logoColor=white)]()
[![Next.js](https://img.shields.io/badge/Next.js-000000.svg?logo=nextdotjs&logoColor=white)]()
[![React](https://img.shields.io/badge/React-61DAFB.svg?logo=react&logoColor=black)]()
[![Three.js](https://img.shields.io/badge/Three.js-000000.svg?logo=threedotjs&logoColor=white)]()
[![web-ifc](https://img.shields.io/badge/web--ifc-lightgrey.svg)]()
[![IfcOpenShell](https://img.shields.io/badge/IfcOpenShell-red.svg)]()

A simple tool to add classifications to your IFC models 🛠️

## 🎯 The Problem

Working with IFC files? Then you know how hard it can be to get everyone to consistently classify model elements. Whether you're using Uniclass, eBKP-H, or your own system, getting teams to properly implement `IfcClassificationReference` is often a pain.

After initially thinking about how to fully automating this process, I quickly realized that regulations, responsibilities across disciplines, and accountability requirements make that approach less practical.

## ✨ What This Tool Does

IFC Classifier helps you classify IFC elements without needing expert knowledge of BIM authoring tools. It's designed to make the process simpler and more repeatable.

**Note:** This is a **Work In Progress** and open source under the **AGPL v3** license.

## 🌟 Features

- **🖼️ IFC Viewer:**

  - View IFC models in your browser
  - Standard navigation (orbit, pan, zoom)
  - Easy model exploration through spatial tree
  - Check element properties
  - Hide/show elements as needed

- **📚 Classification Systems:**

  - Use ready-made systems:
    - 🇨🇭 Swiss CRB eBKP-H
    - 🇬🇧 Uniclass
  - Or create your own custom system
  - Assign colors to visualize different classifications

- **⚙️ Rule-Based Sorting:**

  - Create rules to automatically sort elements
  - Based on properties like: `IsExternal`, `LoadBearing`, etc.
  - Example: "Put all external, non-load bearing walls (except basement) into category C02.01"
  - See rule results live on your model

- **✍️ Export Your Work:**

  - Save your model with proper `IfcClassificationReference` entities
  - Use the improved file in other BIM tools

- **🔮 Coming Soon:**
  - Support for property-based classification (where codes are stored in Psets instead of IfcClassificationReference)

## 💡 Goal

Make IFC classification simple enough that anyone can do it properly.

## 🛠️ Tech Stack

- [Next.js](https://nextjs.org/)
- [React](https://reactjs.org/)
- [TypeScript](https://www.typescriptlang.org/)
- [Three.js](https://threejs.org/) / [@react-three/fiber](https://docs.pmnd.rs/react-three-fiber)
- [web-ifc](https://github.com/IFCjs/web-ifc)
- [IfcOpenShell](https://ifcopenshell.org/) via Pyodide/WASM
- [Tailwind CSS](https://tailwindcss.com/)
- [Shadcn/ui](https://ui.shadcn.com/)

## 📄 License

**GNU Affero General Public License v3.0** - See the [LICENSE](./LICENSE) file for details.
