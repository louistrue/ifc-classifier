"use client";

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col">
      {/* Script tag removed as WebIFC is now imported as a module in ifc-viewer.tsx */}
      {/* <script type="module" src="/wasm/web-ifc/web-ifc-api.js" async></script> */}

      {/* Import the IFC Viewer component dynamically to ensure WebIFC is loaded first */}
      <div className="flex-1">
        {/* @ts-ignore */}
        <IFCViewerWithScript />
      </div>
    </main>
  );
}
// Use client directive for the dynamic import
import dynamic from "next/dynamic";

// Dynamically import the IFCViewer component with no SSR
const IFCViewerWithScript = dynamic(() => import("@/components/ifc-viewer"), {
  ssr: false,
});
