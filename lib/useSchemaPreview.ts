import { useState, useEffect, useCallback } from "react";

// Lightweight preview cache and request management
const previewCache = new Map<string, string[]>();
const previewRequestQueue = new Map<string, Promise<string[]>>();
let lastPreviewRequestTime = 0;
const MIN_PREVIEW_REQUEST_INTERVAL = 500; // Much faster for previews - 0.5 seconds

// Persistent preview cache keys
const PREVIEW_CACHE_KEY = 'ifc-schema-preview-cache';
const PREVIEW_CACHE_VERSION = 'v6-extension-fix'; // Fixed the extension removal bug that caused extra 'l'
const PREVIEW_CACHE_EXPIRY_HOURS = 24; // 24 hour cache for previews

// Load preview cache from localStorage
const loadPreviewCacheFromStorage = (): void => {
  try {
    const stored = localStorage.getItem(PREVIEW_CACHE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      if (parsed.version === PREVIEW_CACHE_VERSION) {
        const now = Date.now();
        Object.entries(parsed.data).forEach(([url, entry]: [string, any]) => {
          if (entry.expires > now) {
            previewCache.set(url, entry.preview);
          }
        });
        console.log(`Loaded ${previewCache.size} cached previews from localStorage (v6)`);
      }
    }
  } catch (error) {
    console.warn('Failed to load preview cache from localStorage:', error);
  }
};

// Save preview cache to localStorage
const saveCacheToStorage = (): void => {
  // Guard for non-browser environments
  if (typeof window === 'undefined' || !window.localStorage) {
    return;
  }

  try {
    const now = Date.now();
    const expiryTime = now + (PREVIEW_CACHE_EXPIRY_HOURS * 60 * 60 * 1000);

    const data: Record<string, any> = {};
    previewCache.forEach((preview, url) => {
      data[url] = {
        preview,
        expires: expiryTime,
        cached: now
      };
    });

    // Serialize and check size before storing
    const serialized = JSON.stringify({
      version: PREVIEW_CACHE_VERSION,
      data
    });

    // Check if approaching storage limits
    if (serialized.length > 2 * 1024 * 1024) { // 2MB warning threshold
      console.warn('Preview cache is approaching storage limits, pruning oldest entries');
      // Prune the cache to reduce size
      const entries = Object.entries(data);
      entries.sort((a, b) => a[1].cached - b[1].cached);

      // Remove oldest entries
      const entriesToRemove = Math.ceil(entries.length * 0.25);
      for (let i = 0; i < entriesToRemove; i++) {
        delete data[entries[i][0]];
        previewCache.delete(entries[i][0]);
      }

      // Try again with reduced data
      localStorage.setItem(PREVIEW_CACHE_KEY, JSON.stringify({
        version: PREVIEW_CACHE_VERSION,
        data
      }));
      return;
    }

    localStorage.setItem(PREVIEW_CACHE_KEY, serialized);
  } catch (error) {
    console.warn('Failed to save preview cache to localStorage:', error);

    // Handle quota errors
    if (
      error instanceof DOMException &&
      (error.name === 'QuotaExceededError' || error.name === 'NS_ERROR_DOM_QUOTA_REACHED')
    ) {
      try {
        // Clear older cache entries
        const oldEntries = Array.from(previewCache.entries());
        oldEntries.sort((a, b) => 0); // Sort by age if possible

        // Keep only 50% of entries
        if (oldEntries.length > 10) {
          const toKeep = Math.ceil(oldEntries.length / 2);
          previewCache.clear();
          oldEntries.slice(-toKeep).forEach(([k, v]) => previewCache.set(k, v));

          // Try saving again
          saveCacheToStorage();
        }
      } catch (innerError) {
        console.error('Failed to recover from storage quota error:', innerError);
      }
    }
  }
};

// Initialize preview cache
loadPreviewCacheFromStorage();

const GENERIC_FAILURE_MESSAGE = ["Could not load preview."];
const NO_DEFINITION_MESSAGE = ["Semantic definition not found."];

export function useSchemaPreview(schemaUrl?: string) {
  const [preview, setPreview] = useState<string[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Lightweight parsing for semantic definition only
  const parsePreviewContent = useCallback((html: string, targetIfcClass: string): string[] => {
    try {
      const parser = new DOMParser();
      const doc = parser.parseFromString(html, "text/html");

      // Attempt to find a heading that indicates the start of the main definition for the target class.
      // This could be an H1 with the class name, or an H{2-6} with "semantic definition"
      // and the class name nearby.
      const targetClassUpper = targetIfcClass.toUpperCase();
      let definitionHeading: Element | undefined = Array.from(doc.querySelectorAll("h1, h2, h3, h4, h5, h6")).find(h => {
        const headingText = h.textContent?.toUpperCase() || "";
        return headingText.includes(targetClassUpper) && headingText.includes("DEFINITION");
      });

      if (!definitionHeading) {
        // Fallback: Find "semantic definition" and then check if the target class is mentioned soon after.
        const semanticDefinitionHeadings = Array.from(doc.querySelectorAll("h2, h3, h4, h5, h6"))
          .filter(h => h.textContent?.toLowerCase().includes("semantic definition"));

        for (const heading of semanticDefinitionHeadings) {
          // Check if the IFC class name appears in the heading itself or in the first few sibling/child elements
          let currentElement: Element | null = heading;
          let searchDepth = 0;
          let foundClassMention = false;
          while (currentElement && searchDepth < 5) {
            if (currentElement.textContent?.toUpperCase().includes(targetClassUpper)) {
              foundClassMention = true;
              break;
            }
            currentElement = currentElement.nextElementSibling;
            searchDepth++;
          }

          if (foundClassMention) {
            definitionHeading = heading;
            break;
          }
        }
      }

      if (definitionHeading) {
        const paragraphs: string[] = [];
        let el = definitionHeading.nextElementSibling;
        let count = 0;

        while (el && el.tagName.toLowerCase() === "p" && count < 2) {
          const paragraphText = el.textContent?.trim();
          if (paragraphText && paragraphText.length > 0) {
            let limitedText = paragraphText;
            if (limitedText.length > 200) {
              const cutoff = limitedText.substring(0, 180);
              const lastSentence = cutoff.lastIndexOf('.');
              const lastSpace = cutoff.lastIndexOf(' ');
              if (lastSentence > 100) {
                limitedText = limitedText.substring(0, lastSentence + 1);
              } else if (lastSpace > 100) {
                limitedText = limitedText.substring(0, lastSpace) + '...';
              } else {
                limitedText = cutoff + '...';
              }
            }
            paragraphs.push(limitedText);
            count++;
          }
          el = el.nextElementSibling;
        }

        if (paragraphs.length > 0) {
          console.log(`Preview for ${targetIfcClass} extracted:`, paragraphs);
          return paragraphs;
        }
        // Semantic definition heading found, but no <p> tags after it for this class.
        console.log(`No paragraphs found after semantic definition for ${targetIfcClass}`);
        return NO_DEFINITION_MESSAGE;
      }

      // No suitable "semantic definition" heading found for the target class.
      console.log(`No semantic definition heading found for ${targetIfcClass}`);
      return NO_DEFINITION_MESSAGE;
    } catch (error) {
      console.error(`Failed to parse preview HTML for ${targetIfcClass}:`, error);
      return GENERIC_FAILURE_MESSAGE;
    }
  }, []);

  // Generate fallback preview content for IFC classes
  const generateFallbackPreview = useCallback((ifcClass: string): string[] => {
    // Remove "Ifc" prefix for natural language
    const naturalName = ifcClass.startsWith('Ifc') ? ifcClass.substring(3) : ifcClass;

    if (ifcClass.includes('Wall')) {
      return [`${naturalName} is a vertical construction element that provides structural support and space separation in buildings.`];
    } else if (ifcClass.includes('Slab')) {
      return [`${naturalName} is a horizontal structural element that forms floors, roofs, or other flat surfaces in buildings.`];
    } else if (ifcClass.includes('Beam')) {
      return [`${naturalName} is a horizontal structural element that carries loads perpendicular to its length.`];
    } else if (ifcClass.includes('Column')) {
      return [`${naturalName} is a vertical structural element that transfers loads from upper levels to foundations.`];
    } else if (ifcClass.includes('Door')) {
      return [`${naturalName} provides controlled access between spaces and includes frames, panels, and hardware.`];
    } else if (ifcClass.includes('Window')) {
      return [`${naturalName} provides natural light, ventilation, and views while maintaining thermal barriers.`];
    } else if (ifcClass.includes('Space')) {
      return [`${naturalName} defines functional areas within buildings for specific activities or purposes.`];
    } else if (ifcClass.includes('Building')) {
      return [`${naturalName} represents the overall building structure in the IFC hierarchy.`];
    } else if (ifcClass.includes('Project')) {
      return [`${naturalName} is the root element of an IFC model, establishing global context and references.`];
    } else {
      return [`${naturalName} is an IFC entity used in Building Information Modeling (BIM) for construction industry data exchange.`];
    }
  }, []);

  // Fast preview fetch - handle local files directly, no CORS proxies
  const fetchPreviewFast = useCallback(async (url: string, ifcClass: string): Promise<string[]> => {
    console.log(`🔍 Fetching preview for: ${url} (Class: ${ifcClass})`);

    // Always try local files first - check if URL is local or convert remote to local
    let localUrl = '';

    if (url.startsWith('/ifc-docs/')) {
      // Already a local URL
      localUrl = url;
      console.log(`📂 Using direct local URL: ${localUrl}`);
    } else if (url.includes('ifc-docs') || url.includes('buildingsmart.org')) {
      // Convert remote URL to local path
      const urlParts = url.split('/');
      let fileName = urlParts[urlParts.length - 1];

      // Handle both .htm and .html extensions
      if (fileName.endsWith('.htm')) {
        fileName = fileName.replace('.htm', '.html');
      }

      // If no file extension, append .html
      if (!fileName.includes('.')) {
        fileName = `${fileName}.html`;
      }

      localUrl = `/ifc-docs/${fileName}`;
      console.log(`🔄 Converted to local URL: ${localUrl}`);
    } else {
      // Extract IFC class name from URL for more accurate parsing
      const urlParts = url.split('/');
      const fileName = urlParts[urlParts.length - 1]?.replace('.html', '').replace('.htm', '');
      const ifcClassFromUrl = fileName || "UnknownIfcClass";

      // If we can extract a class name, try to construct local path
      if (ifcClassFromUrl && ifcClassFromUrl.startsWith('Ifc')) {
        localUrl = `/ifc-docs/${ifcClassFromUrl}.html`;
        console.log(`🔧 Constructed local URL from class: ${localUrl}`);
      } else {
        // Use the passed ifcClass parameter as fallback
        localUrl = `/ifc-docs/${ifcClass}.html`;
        console.log(`⚠️ Using ifcClass fallback: ${localUrl}`);
      }
    }

    // Try to load the local file
    if (localUrl) {
      try {
        console.log(`🏠 Loading local preview from: ${localUrl}`);

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 5000); // Increased timeout

        const res = await fetch(localUrl, {
          signal: controller.signal,
          headers: {
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          }
        });

        clearTimeout(timeoutId);

        if (res.ok) {
          const text = await res.text();
          if (text && text.length > 100) {
            console.log(`✅ Local file loaded successfully (${Math.round(text.length / 1024)}KB)`);
            const parsed = parsePreviewContent(text, ifcClass);

            // If parsing was successful and found actual content
            if (parsed && parsed.length > 0 &&
              parsed !== GENERIC_FAILURE_MESSAGE &&
              parsed !== NO_DEFINITION_MESSAGE) {
              console.log('✅ Local preview parsed successfully for', ifcClass);
              return parsed;
            } else {
              console.log('⚠️ Local file parsed but no semantic definition found, using fallback');
            }
          } else {
            console.log(`⚠️ Local file too small or empty: ${text?.length || 0} bytes`);
          }
        } else {
          console.log(`📁 Local file not found (${res.status}): ${localUrl}`);
        }
      } catch (err) {
        console.log(`📁 Local preview fetch failed for ${ifcClass}:`, err);
      }
    }

    // Always fall back to generated preview content instead of showing errors
    console.log(`🔄 Using generated fallback content for ${ifcClass}`);
    const fallbackPreview = generateFallbackPreview(ifcClass);
    return fallbackPreview;
  }, [parsePreviewContent, generateFallbackPreview]);

  useEffect(() => {
    if (!schemaUrl) {
      setPreview(null);
      setLoading(false);
      setError(null);
      return;
    }

    // Extract IFC class name from URL for more accurate parsing
    const urlParts = schemaUrl.split('/');
    const fileName = urlParts[urlParts.length - 1]?.replace('.html', '').replace('.htm', '');
    const ifcClassFromUrl = fileName || "UnknownIfcClass";

    if (previewCache.has(schemaUrl)) {
      console.log('Loading preview from cache:', schemaUrl);
      const cachedData = previewCache.get(schemaUrl)!;

      // Check if cached data is old error messages - if so, regenerate with fallback content
      if (cachedData === GENERIC_FAILURE_MESSAGE || cachedData === NO_DEFINITION_MESSAGE ||
        (Array.isArray(cachedData) && cachedData.length === 1 &&
          (cachedData[0] === "Could not load preview." || cachedData[0] === "Semantic definition not found."))) {
        console.log('Found old cached error, regenerating with fallback content...');
        const fallbackContent = generateFallbackPreview(ifcClassFromUrl);
        setPreview(fallbackContent);
        setError(null);
        // Update cache with new fallback content
        previewCache.set(schemaUrl, fallbackContent);
        saveCacheToStorage();
      } else {
        // Use cached content normally
        setPreview(cachedData);
        setError(null);
      }
      setLoading(false);
      return;
    }

    if (previewRequestQueue.has(schemaUrl)) {
      console.log('Preview request already in progress for:', schemaUrl);
      setLoading(true); // Ensure loading is true while waiting for queued request
      previewRequestQueue.get(schemaUrl)!
        .then(cachedPreview => {
          // Always show content, never errors
          setPreview(cachedPreview);
          setError(null);
        })
        .catch(err => {
          console.error('Cached preview request failed:', err);
          // Generate fallback content for failed requests
          const fallbackContent = generateFallbackPreview(ifcClassFromUrl);
          setPreview(fallbackContent);
          setError(null);
        })
        .finally(() => setLoading(false));
      return;
    }

    const now = Date.now();
    const timeSinceLastRequest = now - lastPreviewRequestTime;
    const delay = Math.max(0, MIN_PREVIEW_REQUEST_INTERVAL - timeSinceLastRequest);

    let cancelled = false;
    setLoading(true);
    setError(null);

    const executeRequest = async () => {
      if (delay > 0) {
        await new Promise(resolve => setTimeout(resolve, delay));
      }

      if (cancelled) {
        setLoading(false); // Ensure loading is false if cancelled before fetch
        return;
      }
      lastPreviewRequestTime = Date.now();

      const requestPromise = fetchPreviewFast(schemaUrl, ifcClassFromUrl);
      previewRequestQueue.set(schemaUrl, requestPromise);

      try {
        const extractedPreview = await requestPromise;
        if (!cancelled) {
          // All responses are now valid - either from local files or generated fallback
          // No longer treating any response as an error since fallback content is intentional
          setPreview(extractedPreview);
          setError(null);

          // Cache the result
          previewCache.set(schemaUrl, extractedPreview);
          saveCacheToStorage();
        }
      } catch (err) {
        if (!cancelled) {
          console.error("Preview fetch failed unexpectedly:", err);
          // Generate fallback content even for unexpected errors
          const fallbackContent = generateFallbackPreview(ifcClassFromUrl);
          setPreview(fallbackContent);
          setError(null); // Don't show errors since we have fallback content

          // Cache the fallback content
          previewCache.set(schemaUrl, fallbackContent);
          saveCacheToStorage();
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
        previewRequestQueue.delete(schemaUrl);
      }
    };

    executeRequest();

    return () => {
      cancelled = true;
      // No setLoading(false) here as it might interfere with ongoing request finalization
    };
  }, [schemaUrl, fetchPreviewFast]);

  return { preview, loading, error };
}
