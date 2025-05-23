import { useState, useEffect, useCallback } from "react";

// Lightweight preview cache and request management
const previewCache = new Map<string, string[]>();
const previewRequestQueue = new Map<string, Promise<string[]>>();
let lastPreviewRequestTime = 0;
const MIN_PREVIEW_REQUEST_INTERVAL = 500; // Much faster for previews - 0.5 seconds

// Persistent preview cache keys
const PREVIEW_CACHE_KEY = 'ifc-schema-preview-cache';
const PREVIEW_CACHE_VERSION = 'v3'; // Incremented version due to change in fallback behavior
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
        console.log(`Loaded ${previewCache.size} cached previews from localStorage (v3)`);
      }
    }
  } catch (error) {
    console.warn('Failed to load preview cache from localStorage:', error);
  }
};

// Save preview cache to localStorage
const saveCacheToStorage = (): void => {
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

    localStorage.setItem(PREVIEW_CACHE_KEY, JSON.stringify({
      version: PREVIEW_CACHE_VERSION,
      data
    }));
  } catch (error) {
    console.warn('Failed to save preview cache to localStorage:', error);
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

  // Fast preview fetch - only try one quick proxy
  const fetchPreviewFast = useCallback(async (url: string, ifcClass: string): Promise<string[]> => {
    console.log(`Fetching preview for: ${url} (Class: ${ifcClass})`);

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 3000); // 3 second timeout
      const proxyUrl = `https://thingproxy.freeboard.io/fetch/${url}`;

      const res = await fetch(proxyUrl, {
        signal: controller.signal,
        headers: {
          'Accept': 'text/html',
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
      });

      clearTimeout(timeoutId);

      if (res.ok) {
        const text = await res.text();
        if (text && text.length > 100 && (text.includes('<html') || text.includes('<!DOCTYPE'))) {
          const parsed = parsePreviewContent(text, ifcClass);
          if (parsed && parsed !== GENERIC_FAILURE_MESSAGE && parsed !== NO_DEFINITION_MESSAGE) {
            console.log('Preview fetch successful for', ifcClass);
            return parsed;
          }
          // If specific parsing failed (e.g. no def found for this class), return that specific message
          return parsed;
        }
      }
      // If response not ok or content invalid, fall through to generic failure
      console.warn(`Fetch not OK for ${ifcClass} (${res.status})`);
    } catch (err) {
      console.log(`Preview fetch failed for ${ifcClass}:`, err);
      // Fall through to generic failure
    }
    return GENERIC_FAILURE_MESSAGE;
  }, [parsePreviewContent]);

  useEffect(() => {
    if (!schemaUrl) {
      setPreview(null);
      setLoading(false);
      setError(null);
      return;
    }
    // Extract IFC class name from URL for more accurate parsing
    const urlParts = schemaUrl.split('/');
    const fileName = urlParts[urlParts.length - 1]?.replace('.htm', '');
    const ifcClassFromUrl = fileName || "UnknownIfcClass";

    if (previewCache.has(schemaUrl)) {
      console.log('Loading preview from cache:', schemaUrl);
      const cachedData = previewCache.get(schemaUrl)!;
      // Check if cached data is an error message, if so, reflect it in error state
      if (cachedData === GENERIC_FAILURE_MESSAGE || cachedData === NO_DEFINITION_MESSAGE) {
        setError(cachedData[0]);
        setPreview(null);
      } else {
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
          if (cachedPreview === GENERIC_FAILURE_MESSAGE || cachedPreview === NO_DEFINITION_MESSAGE) {
            setError(cachedPreview[0]);
            setPreview(null);
          } else {
            setPreview(cachedPreview);
            setError(null);
          }
        })
        .catch(err => {
          console.error('Cached preview request failed:', err);
          setError("Failed to load. Please try again.");
          setPreview(null);
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
          if (extractedPreview === GENERIC_FAILURE_MESSAGE) {
            setError(GENERIC_FAILURE_MESSAGE[0]);
            setPreview(null);
          } else if (extractedPreview === NO_DEFINITION_MESSAGE) {
            setError(NO_DEFINITION_MESSAGE[0]);
            setPreview(null);
          } else {
            setPreview(extractedPreview);
            setError(null);
          }
          // Cache the outcome, even if it's one of the defined error messages (as a string array)
          previewCache.set(schemaUrl, extractedPreview);
          saveCacheToStorage();
        }
      } catch (err) {
        if (!cancelled) {
          console.error("Preview fetch failed unexpectedly:", err);
          setError("An unexpected error occurred.");
          setPreview(null);
          // Cache generic failure on unexpected error
          previewCache.set(schemaUrl, GENERIC_FAILURE_MESSAGE);
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
