import { useState, useEffect } from "react";

export function useSchemaPreview(schemaUrl?: string) {
  const [preview, setPreview] = useState<string | null>(null);

  useEffect(() => {
    if (!schemaUrl) {
      setPreview(null);
      return;
    }
    let cancelled = false;
    async function fetchPreview() {
      try {
        const res = await fetch(schemaUrl, { mode: "cors" });
        if (!res.ok) return;
        const text = await res.text();
        const parser = new DOMParser();
        const doc = parser.parseFromString(text, "text/html");
        const heading = Array.from(doc.querySelectorAll("h2, h3, h4, h5, h6"))
          .find(h => h.textContent?.toLowerCase().includes("semantic definition"));
        if (heading) {
          let snippet = "";
          let el = heading.nextElementSibling;
          let count = 0;
          while (el && el.tagName.toLowerCase() === "p" && count < 2) {
            snippet += el.textContent?.trim() + " ";
            el = el.nextElementSibling;
            count++;
          }
          if (!cancelled) setPreview(snippet.trim());
        }
      } catch (err) {
        console.error("Failed to fetch schema preview", err);
      }
    }
    fetchPreview();
    return () => { cancelled = true; };
  }, [schemaUrl]);

  return preview;
}
