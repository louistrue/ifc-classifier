"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
    ExternalLink,
    Search,
    BookOpen,
    ChevronLeft,
    ChevronRight,
    Bookmark,
    BookmarkCheck,
    Loader2,
    FileText,
    Hash,
    List,
    Eye,
    Zap,
    RefreshCw,
    Image,
    Table,
    AlertTriangle,
    Info,
    Code,
    Workflow,
    X,
    ZoomIn,
    Download,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface SchemaContent {
    type: 'text' | 'list' | 'table' | 'image' | 'note' | 'reference' | 'code' | 'diagram';
    content: string;
    data?: any;
    style?: string;
    level?: number;
}

interface SchemaSection {
    id: string;
    title: string;
    content: SchemaContent[];
    type: 'definition' | 'attributes' | 'inheritance' | 'examples' | 'formal' | 'propositions' | 'references' | 'other';
}

interface SchemaReaderProps {
    isOpen: boolean;
    onClose: () => void;
    schemaUrl: string;
    ifcClassName: string;
    initialPreview?: string[];
}

// Global cache and request throttling with persistent storage
const schemaCache = new Map<string, SchemaSection[]>();
const requestQueue = new Map<string, Promise<SchemaSection[]>>();
let lastRequestTime = 0;
const MIN_REQUEST_INTERVAL = 3000; // Increased to 3 seconds due to 403 errors

// Persistent cache keys
const SCHEMA_CACHE_KEY = 'ifc-schema-full-cache';
const SCHEMA_CACHE_VERSION = 'v2-local'; // Updated to clear old cache and use local files
const SCHEMA_CACHE_EXPIRY_HOURS = 48; // Longer cache for full schemas

// Helper function (moved outside component)
const isHeading = (element: Element): boolean => {
    const tag = element.tagName.toLowerCase();
    return ['h1', 'h2', 'h3', 'h4', 'h5', 'h6'].includes(tag);
};

// Load schema cache from localStorage
const loadSchemaCacheFromStorage = (): void => {
    try {
        const stored = localStorage.getItem(SCHEMA_CACHE_KEY);
        if (stored) {
            const parsed = JSON.parse(stored);
            if (parsed.version === SCHEMA_CACHE_VERSION) {
                const now = Date.now();
                Object.entries(parsed.data).forEach(([url, entry]: [string, any]) => {
                    if (entry.expires > now) {
                        schemaCache.set(url, entry.sections);
                    }
                });
                console.log(`Loaded ${schemaCache.size} cached schemas from localStorage`);
            }
        }
    } catch (error) {
        console.warn('Failed to load schema cache from localStorage:', error);
    }
};

// Save schema cache to localStorage
const saveSchemaCacheToStorage = (): void => {
    try {
        const now = Date.now();
        const expiryTime = now + (SCHEMA_CACHE_EXPIRY_HOURS * 60 * 60 * 1000);

        const data: Record<string, any> = {};
        schemaCache.forEach((sections, url) => {
            data[url] = {
                sections,
                expires: expiryTime,
                cached: now
            };
        });

        localStorage.setItem(SCHEMA_CACHE_KEY, JSON.stringify({
            version: SCHEMA_CACHE_VERSION,
            data
        }));
    } catch (error) {
        console.warn('Failed to save schema cache to localStorage:', error);
    }
};

// Initialize schema cache
loadSchemaCacheFromStorage();

// Function to clear all cached data (for debugging/forcing refresh)
const clearAllCaches = (): void => {
    console.log('🗑️ Clearing all schema and preview caches...');
    schemaCache.clear();
    localStorage.removeItem(SCHEMA_CACHE_KEY);
    localStorage.removeItem('ifc-schema-preview-cache');
    console.log('✅ All caches cleared');
};

// Expose cache clearing function globally for debugging
if (typeof window !== 'undefined') {
    (window as any).clearIfcCaches = clearAllCaches;
}

export function SchemaReader({
    isOpen,
    onClose,
    schemaUrl,
    ifcClassName,
    initialPreview
}: SchemaReaderProps) {
    const [sections, setSections] = useState<SchemaSection[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [searchQuery, setSearchQuery] = useState("");
    const [activeSection, setActiveSection] = useState(0);
    const [isBookmarked, setIsBookmarked] = useState(false);
    const [imageModalOpen, setImageModalOpen] = useState(false);
    const [selectedImage, setSelectedImage] = useState<{ src: string; alt: string } | null>(null);
    const [loadingProxy, setLoadingProxy] = useState<string>("");
    const [retryAttempt, setRetryAttempt] = useState(0);

    // Helper functions
    const getSectionType = useCallback((headingText: string): SchemaSection['type'] => {
        const lowerText = headingText.toLowerCase();
        if (lowerText.includes('definition') || lowerText.includes('description')) return 'definition';
        if (lowerText.includes('attribute') || lowerText.includes('property')) return 'attributes';
        if (lowerText.includes('inheritance') || lowerText.includes('supertype')) return 'inheritance';
        if (lowerText.includes('example')) return 'examples';
        if (lowerText.includes('formal') || lowerText.includes('express')) return 'formal';
        if (lowerText.includes('proposition')) return 'propositions';
        if (lowerText.includes('reference') || lowerText.includes('access')) return 'references';
        return 'other';
    }, []);

    const resolveImageUrl = useCallback((src: string, baseHref: string, basePath: string): string => {
        console.log(`🖼️ Resolving image URL: src="${src}", baseHref="${baseHref}", basePath="${basePath}"`);

        if (!src) {
            console.log('❌ Empty src, returning empty string');
            return '';
        }

        // If already absolute URL, return as is
        if (src.startsWith('http://') || src.startsWith('https://')) {
            console.log('🌐 Already absolute URL, returning as-is');
            return src;
        }

        // If starts with //, add protocol
        if (src.startsWith('//')) {
            const resolved = `https:${src}`;
            console.log(`🔗 Protocol-relative URL, resolved to: ${resolved}`);
            return resolved;
        }

        // For local documentation (when baseHref is empty or basePath starts with /ifc-docs)
        const isLocalDoc = !baseHref || baseHref === '' || basePath.startsWith('/ifc-docs');

        if (isLocalDoc) {
            console.log('🏠 Processing local documentation image');

            // For local documentation, try to construct local asset paths
            if (src.startsWith('/')) {
                // Absolute path - use as is for local assets
                const localAsset = src;
                console.log(`📁 Local absolute path: ${localAsset}`);
                return localAsset;
            } else if (src.startsWith('../figures/') || src.startsWith('figures/')) {
                // Relative path to figures directory - construct local path
                const fileName = src.replace('../figures/', '').replace('figures/', '');
                const localAsset = `/ifc-docs/figures/${fileName}`;
                console.log(`🖼️ Local figures path constructed: "${src}" -> "${localAsset}"`);
                return localAsset;
            } else if (src.includes('../') || src.includes('./')) {
                // Other relative paths - try to construct local asset
                const cleanSrc = src.replace('../', '').replace('./', '');
                const localAsset = `/ifc-docs/${cleanSrc}`;
                console.log(`🔧 Local relative path: ${localAsset}`);
                return localAsset;
            } else {
                // Simple filename - assume it's in the ifc-docs directory
                const localAsset = `/ifc-docs/${src}`;
                console.log(`📄 Local simple filename: ${localAsset}`);
                return localAsset;
            }
        }

        // Fallback: Use original buildingSMART URLs for remote images
        const ifcDocumentationBase = 'https://ifc43-docs.standards.buildingsmart.org/IFC/RELEASE/IFC4x3/HTML';

        // If starts with /, it's relative to the IFC documentation root
        if (src.startsWith('/')) {
            const cleanSrc = src.substring(1);
            const resolved = `${ifcDocumentationBase}/${cleanSrc}`;
            console.log(`🌐 Root-relative URL, resolved to: ${resolved}`);
            return resolved;
        }

        // For relative paths, construct full URL
        const resolved = `${ifcDocumentationBase}/${src.replace('../', '')}`;
        console.log(`🔗 Relative path resolved to: ${resolved}`);
        return resolved;
    }, []);

    // Test URL resolution (for debugging)
    const testUrlResolution = useCallback(() => {
        const testCases = [
            '/figures/ifcbuildingelement-brep-layout1.gif',
            'figures/ifcbuildingelement-brep-layout1.gif',
            '../figures/some-image.png',
            'https://example.com/absolute.jpg',
            '//cdn.example.com/protocol-relative.png'
        ];

        const baseHref = 'https://ifc43-docs.standards.buildingsmart.org';
        const basePath = '/IFC/RELEASE/IFC4x3/HTML/lexical';

        console.log('=== URL Resolution Test ===');
        testCases.forEach(testSrc => {
            const resolved = resolveImageUrl(testSrc, baseHref, basePath);
            console.log(`&quot;${testSrc}&quot; -> &quot;${resolved}&quot;`);
        });
        console.log('=== End Test ===');
    }, [resolveImageUrl]);

    // Check if image URL has a static image format (including IFC documentation GIFs)
    const isStaticImageFormat = useCallback((url: string): boolean => {
        const staticFormats = ['.png', '.jpg', '.jpeg', '.svg', '.webp', '.bmp', '.tiff'];
        const ifcDiagramFormats = ['.gif']; // IFC documentation uses GIFs for static diagrams
        const animatedFormats = ['.apng', '.webm', '.mp4']; // Actually animated formats to exclude

        const urlLower = url.toLowerCase();

        // Check for truly animated formats - exclude these
        if (animatedFormats.some(format => urlLower.includes(format))) {
            return false;
        }

        // Check for static formats - include these
        if (staticFormats.some(format => urlLower.includes(format))) {
            return true;
        }

        // Allow GIF files if they're from IFC documentation (these are typically static diagrams)
        if (ifcDiagramFormats.some(format => urlLower.includes(format))) {
            const isIfcDocumentation = urlLower.includes('ifc') || urlLower.includes('buildingsmart') ||
                urlLower.includes('/figures/') || urlLower.includes('/ifc-docs/');
            if (isIfcDocumentation) {
                console.log(`✅ Allowing IFC documentation GIF: ${url}`);
                return true;
            }
        }

        // If no extension detected, assume it might be static (but log warning)
        console.warn(`❓ Unknown image format for: ${url}`);
        return false; // Be conservative and exclude unknown formats
    }, []);

    const extractCellStructure = useCallback((cell: Element): any => {
        const structure: any = {
            sections: []
        };

        // Look for property set names (usually bold or in specific classes)
        const propertySetHeaders = cell.querySelectorAll('strong, b, .property-set-name, h4, h5, h6');

        if (propertySetHeaders.length > 0) {
            // This cell contains multiple property sets
            propertySetHeaders.forEach(header => {
                const psetName = header.textContent?.trim() || '';
                const properties: string[] = [];

                // Find properties following this header
                let nextEl = header.nextElementSibling || header.parentElement?.nextElementSibling;
                while (nextEl && !['h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'strong', 'b'].includes(nextEl.tagName?.toLowerCase() || '')) {
                    if (nextEl.tagName?.toLowerCase() === 'ul' || nextEl.tagName?.toLowerCase() === 'ol') {
                        const listItems = nextEl.querySelectorAll('li');
                        listItems.forEach(li => {
                            const propText = li.textContent?.trim();
                            if (propText) properties.push(propText);
                        });
                        break; // Stop after finding the list
                    }
                    nextEl = nextEl.nextElementSibling;
                }

                if (psetName) {
                    structure.sections.push({
                        name: psetName,
                        properties: properties
                    });
                }
            });
        } else {
            // Simple list of properties without headers
            const lists = cell.querySelectorAll('ul, ol');
            if (lists.length > 0) {
                const properties: string[] = [];
                lists.forEach(list => {
                    const listItems = list.querySelectorAll('li');
                    listItems.forEach(li => {
                        const propText = li.textContent?.trim();
                        if (propText) properties.push(propText);
                    });
                });

                structure.sections.push({
                    name: '',
                    properties: properties
                });
            }
        }

        return structure;
    }, []);

    const extractNestedList = useCallback((listElement: Element): any[] => {
        const items: any[] = [];

        // Get direct children li elements only (not nested ones)
        const directListItems = Array.from(listElement.children).filter(child =>
            child.tagName.toLowerCase() === 'li'
        );

        for (const li of directListItems) {
            const item: any = {
                text: '',
                children: []
            };

            // Extract text content, but exclude nested lists
            const textNodes: string[] = [];
            for (const child of Array.from(li.childNodes)) {
                if (child.nodeType === Node.TEXT_NODE) {
                    const text = child.textContent?.trim();
                    if (text) textNodes.push(text);
                } else if (child.nodeType === Node.ELEMENT_NODE) {
                    const element = child as Element;
                    if (!['ul', 'ol'].includes(element.tagName.toLowerCase())) {
                        const text = element.textContent?.trim();
                        if (text) textNodes.push(text);
                    }
                }
            }
            item.text = textNodes.join(' ').trim();

            // Look for nested lists within this li
            const nestedLists = Array.from(li.querySelectorAll(':scope > ul, :scope > ol'));
            for (const nestedList of nestedLists) {
                const nestedItems = extractNestedList(nestedList);
                item.children.push(...nestedItems);
            }

            if (item.text || item.children.length > 0) {
                items.push(item);
            }
        }

        return items;
    }, []);

    const extractTableData = useCallback((table: HTMLTableElement): any => {
        const headers: string[] = [];
        const rows: any[] = [];

        // Extract headers
        const headerRow = table.querySelector('thead tr') || table.querySelector('tr');
        if (headerRow) {
            const headerCells = headerRow.querySelectorAll('th, td');
            headerCells.forEach(cell => {
                headers.push(cell.textContent?.trim() || '');
            });
        }

        // Extract data rows with enhanced property set handling
        const dataRows = table.querySelectorAll('tbody tr, tr:not(:first-child)');
        dataRows.forEach(row => {
            const cells = row.querySelectorAll('td, th');
            const rowData: any[] = [];

            cells.forEach((cell, cellIndex) => {
                const cellText = cell.textContent?.trim() || '';

                // Check if this cell contains nested property lists (common in property sets)
                const nestedLists = cell.querySelectorAll('ul, ol');
                if (nestedLists.length > 0 && cellText.length > 100) {
                    // This cell contains complex content with lists - preserve structure
                    const cellContent = {
                        text: cellText,
                        hasNestedContent: true,
                        structure: extractCellStructure(cell)
                    };
                    rowData.push(cellContent);
                } else {
                    // Simple text cell
                    rowData.push(cellText);
                }
            });

            if (rowData.length > 0) {
                rows.push(rowData);
            }
        });

        return {
            headers, rows, hasComplexContent: rows.some(row =>
                row.some((cell: any) => typeof cell === 'object' && cell.hasNestedContent)
            )
        };
    }, [extractCellStructure]);

    const extractEnhancedSectionContent = useCallback((heading: Element, doc: Document, baseUrl: string, rawImageSources: Map<string, string>): SchemaContent[] => {
        const content: SchemaContent[] = [];
        let el = heading.nextElementSibling;

        // Handle both local file paths and full URLs
        let baseHref: string;
        let basePath: string;

        if (baseUrl.startsWith('/ifc-docs/') || baseUrl.startsWith('./') || baseUrl.startsWith('../') || !baseUrl.includes('://')) {
            // Local file path - construct local base values
            baseHref = '';
            basePath = '/ifc-docs';
            console.log(`🏠 Local file detected, using basePath: ${basePath}`);
        } else {
            // Full URL - parse normally
            try {
                const urlBase = new URL(baseUrl);
                baseHref = `${urlBase.protocol}//${urlBase.host}`;
                basePath = urlBase.pathname.substring(0, urlBase.pathname.lastIndexOf('/'));
                console.log(`🌐 Remote URL detected, baseHref: ${baseHref}, basePath: ${basePath}`);
            } catch (error) {
                console.warn(`⚠️ Failed to parse URL ${baseUrl}, using local defaults:`, error);
                baseHref = '';
                basePath = '/ifc-docs';
            }
        }

        console.log(`📍 Content extraction - baseUrl: ${baseUrl}, baseHref: ${baseHref}, basePath: ${basePath}`);

        // Run URL resolution test when processing first element
        if (el && el === heading.nextElementSibling) {
            testUrlResolution();
        }

        // Check if this is a property sets section
        const headingText = heading.textContent?.toLowerCase() || '';
        const isPropertySetsSection = headingText.includes('property set') || headingText.includes('pset');

        while (el && !isHeading(el)) {
            if (el.tagName.toLowerCase() === 'p') {
                const text = el.textContent?.trim();
                if (text) {
                    const classList = el.className || '';
                    const style = classList.includes('note') ? 'note' :
                        classList.includes('reference') ? 'reference' :
                            classList.includes('ifc4-change') ? 'change' : '';

                    content.push({
                        type: style ? 'note' : 'text',
                        content: text,
                        style
                    });
                }
            }
            else if (el.tagName.toLowerCase() === 'table') {
                const tableData = extractTableData(el as HTMLTableElement);
                if (tableData) {
                    content.push({
                        type: 'table',
                        content: '',
                        data: tableData
                    });
                }
            }
            else if (el.tagName.toLowerCase() === 'ul' || el.tagName.toLowerCase() === 'ol') {
                // Only process as list if NOT in a property sets section or if table extraction failed
                if (!isPropertySetsSection) {
                    const nestedStructure = extractNestedList(el);

                    if (nestedStructure.length > 0) {
                        content.push({
                            type: 'list',
                            content: '',
                            data: {
                                ordered: el.tagName.toLowerCase() === 'ol',
                                items: nestedStructure
                            }
                        });
                    }
                } else {
                    // In property sets sections, try to find the parent table first
                    const parentTable = el.closest('table');
                    if (!parentTable) {
                        // If no parent table, this might be a standalone list in property sets
                        console.log('Standalone list found in property sets section - may need table context');

                        // Look for preceding table or create a simple property list
                        const nestedStructure = extractNestedList(el);
                        if (nestedStructure.length > 0) {
                            content.push({
                                type: 'list',
                                content: '',
                                data: {
                                    ordered: el.tagName.toLowerCase() === 'ol',
                                    items: nestedStructure
                                }
                            });
                        }
                    }
                }
            }
            else if (el.tagName.toLowerCase() === 'img') {
                const img = el as HTMLImageElement;
                const alt = img.alt || 'Diagram';

                // Try to get raw src from our pre-extracted map first, then fall back to getAttribute
                let rawSrc = '';
                Array.from(rawImageSources.entries()).forEach(([key, src]) => {
                    if (!rawSrc && (key === alt || key.includes(alt) || alt.includes(key))) {
                        rawSrc = src;
                    }
                });

                // Fallback to getAttribute if not found in raw sources
                if (!rawSrc) {
                    rawSrc = img.getAttribute('src') || '';
                }

                console.log(`Image processing: alt="${alt}", rawSrc="${rawSrc}"`);

                if (rawSrc && !rawSrc.startsWith('http://localhost')) {
                    const imageUrl = resolveImageUrl(rawSrc, baseHref, basePath);

                    // Check if it's a static image format
                    if (!isStaticImageFormat(imageUrl)) {
                        console.log(`⏭️ Skipping non-static image format: ${imageUrl}`);
                    } else {
                        console.log(`🖼️ Image found: raw="${rawSrc}", resolved="${imageUrl}"`);

                        // Add images that appear to be valid IFC documentation images (local or remote)
                        const isValidIfcImage = imageUrl.includes('/ifc-docs/') || // Local IFC docs
                            imageUrl.includes('/figures/') || // Figures directory
                            (imageUrl.includes('ifc43-docs.standards.buildingsmart.org') &&
                                imageUrl.includes('/HTML/')); // Remote IFC docs

                        if (isValidIfcImage) {
                            console.log(`✅ Adding valid IFC image: ${imageUrl}`);
                            content.push({
                                type: 'image',
                                content: alt,
                                data: { src: imageUrl, alt, originalSrc: rawSrc }
                            });
                        } else {
                            console.warn(`⚠️ Skipping potentially invalid image: ${imageUrl}`);
                        }
                    }
                } else {
                    console.warn(`Skipping localhost or empty image src: ${rawSrc}`);
                }
            }
            else if (el.tagName.toLowerCase() === 'figure') {
                const img = el.querySelector('img');
                const caption = el.querySelector('figcaption')?.textContent?.trim() || '';

                if (img) {
                    const alt = img.alt || 'Diagram';

                    // Try to get raw src from our pre-extracted map first
                    let rawSrc = '';
                    const searchKey = caption || alt;
                    Array.from(rawImageSources.entries()).forEach(([key, src]) => {
                        if (!rawSrc && (key === searchKey || key.includes(searchKey) || searchKey.includes(key))) {
                            rawSrc = src;
                        }
                    });

                    // Fallback to getAttribute if not found in raw sources
                    if (!rawSrc) {
                        rawSrc = img.getAttribute('src') || '';
                    }

                    console.log(`Figure processing: caption="${caption}", alt="${alt}", rawSrc="${rawSrc}"`);

                    if (rawSrc && !rawSrc.startsWith('http://localhost')) {
                        const imageUrl = resolveImageUrl(rawSrc, baseHref, basePath);

                        // Check if it's a static image format
                        if (!isStaticImageFormat(imageUrl)) {
                            console.log(`⏭️ Skipping non-static figure image format: ${imageUrl}`);
                        } else {
                            console.log(`🖼️ Figure image found: raw="${rawSrc}", resolved="${imageUrl}"`);

                            // Add images that appear to be valid IFC documentation images (local or remote)
                            const isValidIfcImage = imageUrl.includes('/ifc-docs/') || // Local IFC docs
                                imageUrl.includes('/figures/') || // Figures directory
                                (imageUrl.includes('ifc43-docs.standards.buildingsmart.org') &&
                                    imageUrl.includes('/HTML/')); // Remote IFC docs

                            if (isValidIfcImage) {
                                console.log(`✅ Adding valid IFC figure image: ${imageUrl}`);
                                content.push({
                                    type: 'image',
                                    content: caption || alt,
                                    data: { src: imageUrl, alt: caption || alt, originalSrc: rawSrc }
                                });
                            } else {
                                console.warn(`⚠️ Skipping potentially invalid figure image: ${imageUrl}`);
                            }
                        }
                    } else {
                        console.warn(`Skipping localhost or empty figure image src: ${rawSrc}`);
                    }
                }
            }
            else if (el.tagName.toLowerCase() === 'pre' || el.tagName.toLowerCase() === 'code') {
                const codeText = el.textContent?.trim();
                if (codeText) {
                    content.push({
                        type: 'code',
                        content: codeText
                    });
                }
            }

            el = el.nextElementSibling;
        }

        return content;
    }, [extractTableData, extractNestedList, resolveImageUrl, isStaticImageFormat, testUrlResolution]);

    const extractRawImageSources = useCallback((html: string): Map<string, string> => {
        const imageMap = new Map<string, string>();

        // Use regex to find img tags and extract src attributes before browser resolution
        const imgRegex = /<img[^>]+src=["']([^"']+)["'][^>]*>/gi;
        const figureImgRegex = /<figure[^>]*>[\s\S]*?<img[^>]+src=["']([^"']+)["'][^>]*>[\s\S]*?<\/figure>/gi;

        let match;

        // Extract standalone img tags
        while ((match = imgRegex.exec(html)) !== null) {
            const rawSrc = match[1];
            console.log(`Raw HTML extraction found img src: &quot;${rawSrc}&quot;`);

            // Create a unique key based on alt text or src
            const altMatch = match[0].match(/alt=["']([^"']*)["']/i);
            const alt = altMatch ? altMatch[1] : rawSrc;
            imageMap.set(alt, rawSrc);
        }

        // Extract figure img tags
        imgRegex.lastIndex = 0; // Reset regex
        while ((match = figureImgRegex.exec(html)) !== null) {
            const rawSrc = match[1];
            console.log(`Raw HTML extraction found figure img src: &quot;${rawSrc}&quot;`);

            // Create a unique key based on figcaption or alt text
            const captionMatch = match[0].match(/<figcaption[^>]*>([^<]+)<\/figcaption>/i);
            const altMatch = match[0].match(/alt=["']([^"']*)["']/i);
            const key = captionMatch ? captionMatch[1] : (altMatch ? altMatch[1] : rawSrc);
            imageMap.set(key, rawSrc);
        }

        console.log(`Extracted ${imageMap.size} raw image sources`);
        return imageMap;
    }, []);

    const parseSchemaContent = useCallback((html: string, baseUrl: string): SchemaSection[] => {
        console.log(`Parsing schema content for: ${baseUrl}`);
        console.log(`HTML content preview: ${html.substring(0, 500)}...`);

        // Extract raw image sources before parsing
        const rawImageSources = extractRawImageSources(html);

        // Extract the base URL for IFC documentation
        const ifcDocumentationBase = 'https://ifc43-docs.standards.buildingsmart.org/IFC/RELEASE/IFC4x3/HTML';

        // Modify HTML to include proper base tag BEFORE parsing to prevent localhost resolution
        let modifiedHtml = html;
        if (!html.includes('<base')) {
            // Insert base tag right after <head> or at the beginning if no head
            if (html.includes('<head>')) {
                modifiedHtml = html.replace('<head>', `<head><base href="${ifcDocumentationBase}/">`);
            } else if (html.includes('<html>')) {
                modifiedHtml = html.replace('<html>', `<html><head><base href="${ifcDocumentationBase}/"></head>`);
            } else {
                modifiedHtml = `<html><head><base href="${ifcDocumentationBase}/"></head><body>${html}</body></html>`;
            }
        }

        console.log(`Modified HTML with base URL for parsing`);

        const parser = new DOMParser();
        const doc = parser.parseFromString(modifiedHtml, "text/html");
        const extractedSections: SchemaSection[] = [];

        const headings = Array.from(doc.querySelectorAll("h1, h2, h3, h4, h5, h6"));
        console.log(`Found ${headings.length} headings`);

        for (const heading of headings) {
            const headingText = heading.textContent?.trim() || "";
            if (!headingText) continue;

            const sectionType = getSectionType(headingText);
            const sectionId = headingText.toLowerCase().replace(/\s+/g, '-').replace(/[^\w-]/g, '');

            const content = extractEnhancedSectionContent(heading, doc, baseUrl, rawImageSources);

            if (content.length > 0) {
                extractedSections.push({
                    id: sectionId,
                    title: headingText,
                    content,
                    type: sectionType
                });
            }
        }

        console.log(`Extracted ${extractedSections.length} sections`);
        return extractedSections;
    }, [extractRawImageSources, getSectionType, extractEnhancedSectionContent, isHeading]);

    // Throttled request function
    const throttledRequest = useCallback(async (url: string, options: RequestInit): Promise<Response> => {
        const now = Date.now();
        const timeSinceLastRequest = now - lastRequestTime;

        if (timeSinceLastRequest < MIN_REQUEST_INTERVAL) {
            const delay = MIN_REQUEST_INTERVAL - timeSinceLastRequest;
            await new Promise(resolve => setTimeout(resolve, delay));
        }

        lastRequestTime = Date.now();
        return fetch(url, options);
    }, []);

    // Enhanced fallback content generator
    const getEnhancedFallbackSections = useCallback((className: string, url: string): SchemaSection[] => {
        const sections: SchemaSection[] = [];

        // Main definition section
        sections.push({
            id: 'definition',
            title: 'Semantic Definition',
            content: [
                {
                    type: 'text',
                    content: `${className} is an IFC (Industry Foundation Classes) entity used in Building Information Modeling (BIM).`
                },
                {
                    type: 'note',
                    content: 'The detailed documentation for this entity is temporarily unavailable due to network restrictions. You can access the full documentation using the external link.',
                    style: 'note'
                }
            ],
            type: 'definition'
        });

        // Add specific information based on class name patterns
        if (className.includes('Wall')) {
            sections.push({
                id: 'usage',
                title: 'Common Usage',
                content: [
                    { type: 'text', content: 'Walls are fundamental building elements that provide structural support, separation of spaces, and environmental barriers.' },
                    { type: 'text', content: 'They can be load-bearing or non-load-bearing, and may include openings for doors and windows.' }
                ],
                type: 'other'
            });
        } else if (className.includes('Slab')) {
            sections.push({
                id: 'usage',
                title: 'Common Usage',
                content: [
                    { type: 'text', content: 'Slabs are horizontal structural elements that form floors, roofs, or other horizontal surfaces.' },
                    { type: 'text', content: 'They distribute loads and provide platforms for other building elements.' }
                ],
                type: 'other'
            });
        } else if (className.includes('Project')) {
            sections.push({
                id: 'hierarchy',
                title: 'Project Hierarchy',
                content: [
                    { type: 'text', content: 'IfcProject is the root element of any IFC model and establishes the global context.' },
                    { type: 'text', content: 'It contains references to units, coordinate systems, and the overall project structure.' }
                ],
                type: 'other'
            });
        } else if (className.includes('Beam')) {
            sections.push({
                id: 'usage',
                title: 'Structural Element',
                content: [
                    { type: 'text', content: 'Beams are horizontal structural elements that carry loads perpendicular to their length.' },
                    { type: 'text', content: 'They transfer loads from slabs and other elements to columns or walls.' }
                ],
                type: 'other'
            });
        } else if (className.includes('Column')) {
            sections.push({
                id: 'usage',
                title: 'Structural Element',
                content: [
                    { type: 'text', content: 'Columns are vertical structural elements that transfer loads from upper levels to foundations.' },
                    { type: 'text', content: 'They provide vertical support and can be made of various materials like concrete, steel, or wood.' }
                ],
                type: 'other'
            });
        } else if (className.includes('Door')) {
            sections.push({
                id: 'usage',
                title: 'Building Element',
                content: [
                    { type: 'text', content: 'Doors provide controlled access between spaces and can include various opening mechanisms.' },
                    { type: 'text', content: 'They may include frames, hardware, and glazing components.' }
                ],
                type: 'other'
            });
        } else if (className.includes('Window')) {
            sections.push({
                id: 'usage',
                title: 'Building Element',
                content: [
                    { type: 'text', content: 'Windows provide natural light, ventilation, and views between interior and exterior spaces.' },
                    { type: 'text', content: 'They include glazing, frames, and may have various opening configurations.' }
                ],
                type: 'other'
            });
        } else if (className.includes('Space')) {
            sections.push({
                id: 'usage',
                title: 'Spatial Element',
                content: [
                    { type: 'text', content: 'Spaces define functional areas within buildings for specific activities or purposes.' },
                    { type: 'text', content: 'They contain spatial boundaries and can include environmental and usage requirements.' }
                ],
                type: 'other'
            });
        }

        // IFC Schema information
        sections.push({
            id: 'schema-info',
            title: 'IFC Schema Information',
            content: [
                {
                    type: 'text',
                    content: 'IFC (Industry Foundation Classes) is an open international standard for Building Information Modeling data exchange.'
                },
                {
                    type: 'list',
                    content: '',
                    data: [
                        'Standardized by buildingSMART International',
                        'ISO 16739 certified standard',
                        'Enables interoperability between different BIM software',
                        'Supports the entire building lifecycle'
                    ]
                }
            ],
            type: 'references'
        });

        // Access information
        sections.push({
            id: 'access',
            title: 'Documentation Access',
            content: [
                {
                    type: 'note',
                    content: `To access the complete documentation for ${className}, use the external link to view the official IFC documentation on the buildingSMART website.`,
                    style: 'reference'
                }
            ],
            type: 'references'
        });

        return sections;
    }, []);

    // Load schema with local-only strategy
    const loadSchemaWithFallbacks = useCallback(async (url: string): Promise<SchemaSection[]> => {
        console.log(`🔍 loadSchemaWithFallbacks called with URL: ${url}`);

        // Strategy 1: Try local documentation first
        if (url.startsWith('/ifc-docs/') || url.includes('ifc-docs') || url.includes('buildingsmart.org')) {
            try {
                setLoadingProxy("local files");
                console.log('🏠 Attempting to load local documentation...');

                // Convert any URL to local path
                let localUrl = '';

                if (url.startsWith('/ifc-docs/')) {
                    // Already a local URL
                    localUrl = url;
                    console.log(`📁 Using direct local URL: ${localUrl}`);
                } else {
                    // Extract IFC class name from URL and construct local path
                    const urlParts = url.split('/');
                    let fileName = urlParts[urlParts.length - 1]; // e.g., "IfcWall.htm"
                    console.log(`📝 Extracted filename from URL: ${fileName}`);

                    // Handle file extension conversion
                    if (fileName.endsWith('.htm')) {
                        fileName = fileName.replace('.htm', '.html');
                        console.log(`🔄 Converted .htm to .html: ${fileName}`);
                    } else if (!fileName.includes('.')) {
                        fileName = `${fileName}.html`;
                        console.log(`➕ Added .html extension: ${fileName}`);
                    }

                    localUrl = `/ifc-docs/${fileName}`;
                    console.log(`🔧 Constructed local URL: ${localUrl}`);
                }

                console.log(`📂 Fetching local file: ${localUrl}`);

                const response = await fetch(localUrl, {
                    method: 'GET',
                    headers: {
                        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                    }
                });

                console.log(`📡 Fetch response status: ${response.status} ${response.statusText}`);

                if (!response.ok) {
                    if (response.status === 404) {
                        console.log(`❌ Local file not found: ${localUrl}`);
                    } else {
                        console.warn(`⚠️ Local file error ${response.status}: ${localUrl}`);
                    }
                    throw new Error(`Local file not available: ${response.status}`);
                }

                const text = await response.text();
                console.log(`📄 File content loaded: ${Math.round(text.length / 1024)}KB (${text.length} characters)`);

                if (text && text.length > 1000) { // Ensure we have substantial content
                    console.log(`✅ Content size check passed, parsing with parseSchemaContent...`);
                    const parsed = parseSchemaContent(text, url);
                    console.log(`📖 Parsing completed: ${parsed.length} sections found`);

                    if (parsed && parsed.length > 0) {
                        console.log(`🎉 Successfully parsed local documentation: ${parsed.length} sections`);
                        parsed.forEach((section, i) => {
                            console.log(`  Section ${i + 1}: "${section.title}" (${section.type}) - ${section.content.length} content items`);
                        });
                        setLoadingProxy(""); // Clear loading proxy indicator
                        return parsed;
                    } else {
                        console.warn(`⚠️ Parsing returned empty or invalid result`);
                    }
                } else {
                    console.warn(`⚠️ File content too small: ${text?.length || 0} characters (minimum: 1000)`);
                }
                throw new Error('Local file content invalid or empty');

            } catch (err) {
                console.error('❌ Local documentation failed:', err instanceof Error ? err.message : err);
                if (err instanceof Error) {
                    console.error('❌ Error details:', err.stack);
                }
                // Fall through to fallback content
            }
        } else {
            console.log(`⚠️ URL does not match local file patterns: ${url}`);
        }

        // Strategy 2: Return enhanced fallback content (no CORS proxies)
        console.log(`🔄 Using enhanced fallback content for: ${ifcClassName}`);
        setLoadingProxy("");
        const fallbackSections = getEnhancedFallbackSections(ifcClassName, url);
        console.log(`📝 Generated ${fallbackSections.length} fallback sections`);
        return fallbackSections;
    }, [ifcClassName, getEnhancedFallbackSections, parseSchemaContent]);

    // Load full schema content with enhanced extraction and persistent caching
    const loadFullSchema = useCallback(async (): Promise<void> => {
        if (!schemaUrl || loading) return;

        console.log(`🔍 loadFullSchema called for: ${schemaUrl}`);

        // Check cache first (both memory and localStorage)
        if (schemaCache.has(schemaUrl)) {
            console.log('📦 Loading schema from cache:', schemaUrl);
            const cachedSections = schemaCache.get(schemaUrl)!;

            // Check if cached data contains fallback content (indicates old failed attempts)
            const hasFallbackContent = cachedSections.some(section =>
                section.content.some(item =>
                    item.content.includes('temporarily unavailable due to network restrictions') ||
                    item.content.includes('documentation for this entity is temporarily unavailable')
                )
            );

            if (hasFallbackContent) {
                console.log('⚠️ Found old fallback content in cache, forcing fresh load...');
                schemaCache.delete(schemaUrl);
                // Continue to fresh load
            } else {
                console.log(`✅ Using valid cached schema data (${cachedSections.length} sections)`);
                setSections(cachedSections);
                return;
            }
        }

        // Check if already requesting this URL
        if (requestQueue.has(schemaUrl)) {
            console.log('⏳ Schema request already in progress for:', schemaUrl);
            try {
                const cachedSections = await requestQueue.get(schemaUrl)!;
                setSections(cachedSections);
                return;
            } catch (err) {
                console.log('❌ Cached request failed, starting fresh request');
                // Continue with new request if cached request failed
            }
        }

        setLoading(true);
        setError(null);
        setLoadingProxy("");

        // Create request promise and add to queue
        const requestPromise = loadSchemaWithFallbacks(schemaUrl);
        requestQueue.set(schemaUrl, requestPromise);

        try {
            console.log(`🚀 Starting fresh schema load for: ${schemaUrl}`);
            const extractedSections = await requestPromise;
            console.log(`✅ Schema load completed: ${extractedSections.length} sections extracted`);

            setSections(extractedSections);
            // Cache successful result in both memory and localStorage
            schemaCache.set(schemaUrl, extractedSections);
            saveSchemaCacheToStorage();
            setRetryAttempt(0);
        } catch (err) {
            console.error("❌ Failed to load schema:", err);
            const errorMessage = err instanceof Error ? err.message : "Failed to load schema";
            setError(errorMessage);
        } finally {
            setLoading(false);
            requestQueue.delete(schemaUrl);
        }
    }, [schemaUrl, loading, loadSchemaWithFallbacks]);

    // Search functionality
    const filteredSections = useMemo(() => {
        if (!searchQuery.trim()) return sections;

        return sections.filter(section =>
            section.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
            section.content.some(item =>
                item.content.toLowerCase().includes(searchQuery.toLowerCase())
            )
        );
    }, [sections, searchQuery]);

    // Section type icons
    const getSectionIcon = useCallback((type: SchemaSection['type']) => {
        switch (type) {
            case 'definition': return <BookOpen className="w-4 h-4" />;
            case 'attributes': return <List className="w-4 h-4" />;
            case 'inheritance': return <Hash className="w-4 h-4" />;
            case 'examples': return <Eye className="w-4 h-4" />;
            case 'formal': return <FileText className="w-4 h-4" />;
            case 'propositions': return <Code className="w-4 h-4" />;
            case 'references': return <ExternalLink className="w-4 h-4" />;
            default: return <FileText className="w-4 h-4" />;
        }
    }, []);

    // Open image in modal
    const openImageModal = useCallback((src: string, alt: string) => {
        setSelectedImage({ src, alt });
        setImageModalOpen(true);
    }, []);

    // Smart retry with exponential backoff
    const retryWithDelay = useCallback(async () => {
        const delay = Math.min(2000 * Math.pow(2, retryAttempt), 10000);
        setRetryAttempt(prev => prev + 1);

        console.log(`Retrying in ${delay}ms (attempt ${retryAttempt + 1})`);
        await new Promise(resolve => setTimeout(resolve, delay));
        loadFullSchema();
    }, [retryAttempt, loadFullSchema]);

    // Render nested list items recursively
    const renderNestedListItem = useCallback((item: any, index: number, level: number = 0): React.ReactNode => {
        const indentClass = level > 0 ? `ml-${Math.min(level * 4, 12)}` : '';
        const bulletStyle = level === 0 ? 'w-1.5 h-1.5 bg-primary rounded-full' :
            level === 1 ? 'w-1.5 h-1.5 bg-primary/70 rounded-sm' :
                'w-1 h-1 bg-primary/50 rounded-full';

        return (
            <li key={index} className={`text-sm leading-relaxed ${indentClass}`}>
                <div className="flex items-start gap-2">
                    <span className={`${bulletStyle} mt-2 flex-shrink-0`} />
                    <div className="break-words flex-1">
                        {item.text && <span>{item.text}</span>}
                        {item.children && item.children.length > 0 && (
                            <ul className="space-y-1 mt-1">
                                {item.children.map((child: any, i: number) =>
                                    renderNestedListItem(child, i, level + 1)
                                )}
                            </ul>
                        )}
                    </div>
                </div>
            </li>
        );
    }, []);

    // Render individual content items with beautiful styling
    const renderContentItem = useCallback((item: SchemaContent, index: number) => {
        switch (item.type) {
            case 'text':
                return (
                    <p key={index} className="mb-4 text-sm leading-relaxed text-foreground break-words">
                        {item.content}
                    </p>
                );

            case 'note':
                const noteStyle = item.style === 'note' ? 'bg-blue-50 border-blue-200 text-blue-900 dark:bg-blue-950/30 dark:border-blue-800 dark:text-blue-100' :
                    item.style === 'reference' ? 'bg-green-50 border-green-200 text-green-900 dark:bg-green-950/30 dark:border-green-800 dark:text-green-100' :
                        item.style === 'change' ? 'bg-orange-50 border-orange-200 text-orange-900 dark:bg-orange-950/30 dark:border-orange-800 dark:text-orange-100' :
                            'bg-yellow-50 border-yellow-200 text-yellow-900 dark:bg-yellow-950/30 dark:border-yellow-800 dark:text-yellow-100';

                return (
                    <div key={index} className={`p-4 rounded-lg border-l-4 mb-4 ${noteStyle} max-w-full overflow-hidden`}>
                        <div className="flex items-start gap-2">
                            <Info className="w-4 h-4 mt-0.5 flex-shrink-0" />
                            <p className="text-sm font-medium break-words">{item.content}</p>
                        </div>
                    </div>
                );

            case 'list':
                // Handle both old flat format and new nested format for backward compatibility
                if (Array.isArray(item.data)) {
                    // Old flat format
                    return (
                        <ul key={index} className="space-y-2 mb-4 pl-4 max-w-full">
                            {item.data.map((listItem: string, i: number) => (
                                <li key={i} className="text-sm leading-relaxed flex items-start gap-2">
                                    <span className="w-1.5 h-1.5 bg-primary rounded-full mt-2 flex-shrink-0" />
                                    <span className="break-words">{listItem}</span>
                                </li>
                            ))}
                        </ul>
                    );
                } else if (item.data?.items) {
                    // New nested format
                    const ListComponent = item.data.ordered ? 'ol' : 'ul';
                    return (
                        <ListComponent key={index} className="space-y-1 mb-4 pl-4 max-w-full">
                            {item.data.items.map((listItem: any, i: number) =>
                                renderNestedListItem(listItem, i, 0)
                            )}
                        </ListComponent>
                    );
                }
                return null;

            case 'table':
                // Enhanced table rendering for property sets and complex content
                if (item.data?.hasComplexContent) {
                    // Special rendering for property sets tables with nested content
                    return (
                        <div key={index} className="mb-6 max-w-full overflow-hidden rounded-lg border border-border">
                            <div className="overflow-x-auto">
                                <table className="w-full min-w-0">
                                    {item.data?.headers && (
                                        <thead className="bg-muted">
                                            <tr>
                                                {item.data.headers.map((header: string, i: number) => (
                                                    <th key={i} className="px-4 py-3 text-left text-xs font-semibold text-foreground uppercase tracking-wider break-words min-w-0">
                                                        {header}
                                                    </th>
                                                ))}
                                            </tr>
                                        </thead>
                                    )}
                                    <tbody className="divide-y divide-border">
                                        {item.data?.rows?.map((row: any[], i: number) => (
                                            <tr key={i} className="hover:bg-muted/50">
                                                {row.map((cell: any, j: number) => (
                                                    <td key={j} className="px-4 py-3 text-sm text-foreground break-words min-w-0 align-top">
                                                        {typeof cell === 'object' && cell.hasNestedContent ? (
                                                            // Render structured property sets content
                                                            <div className="space-y-3">
                                                                {cell.structure?.sections?.map((section: any, sIndex: number) => (
                                                                    <div key={sIndex} className="space-y-2">
                                                                        {section.name && (
                                                                            <div className="font-semibold text-primary border-l-2 border-primary pl-2 bg-primary/5 py-1 rounded-r text-sm">
                                                                                {section.name}
                                                                            </div>
                                                                        )}
                                                                        {section.properties && section.properties.length > 0 && (
                                                                            <ul className="space-y-1 ml-2">
                                                                                {section.properties.map((prop: string, pIndex: number) => (
                                                                                    <li key={pIndex} className="text-xs flex items-start gap-2">
                                                                                        <span className="w-1 h-1 bg-muted-foreground rounded-full mt-1.5 flex-shrink-0" />
                                                                                        <span className="break-words">{prop}</span>
                                                                                    </li>
                                                                                ))}
                                                                            </ul>
                                                                        )}
                                                                    </div>
                                                                ))}
                                                                {(!cell.structure?.sections || cell.structure.sections.length === 0) && (
                                                                    <div className="text-xs text-muted-foreground whitespace-pre-wrap">
                                                                        {cell.text}
                                                                    </div>
                                                                )}
                                                            </div>
                                                        ) : (
                                                            // Simple text cell
                                                            <span className="break-words">{cell}</span>
                                                        )}
                                                    </td>
                                                ))}
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    );
                } else {
                    // Standard table rendering for simple tables
                    return (
                        <div key={index} className="mb-6 max-w-full overflow-hidden rounded-lg border border-border">
                            <div className="overflow-x-auto">
                                <table className="w-full min-w-0">
                                    {item.data?.headers && (
                                        <thead className="bg-muted">
                                            <tr>
                                                {item.data.headers.map((header: string, i: number) => (
                                                    <th key={i} className="px-4 py-3 text-left text-xs font-semibold text-foreground uppercase tracking-wider break-words min-w-0">
                                                        {header}
                                                    </th>
                                                ))}
                                            </tr>
                                        </thead>
                                    )}
                                    <tbody className="divide-y divide-border">
                                        {item.data?.rows?.map((row: string[], i: number) => (
                                            <tr key={i} className="hover:bg-muted/50">
                                                {row.map((cell: string, j: number) => (
                                                    <td key={j} className="px-4 py-3 text-sm text-foreground break-words min-w-0 max-w-xs">
                                                        {cell}
                                                    </td>
                                                ))}
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    );
                }

            case 'image':
                return (
                    <div key={index} className="mb-6 max-w-full">
                        <div className="rounded-lg border border-border overflow-hidden bg-muted/30 group">
                            <div className="relative">
                                {/* Use regular img tag for local IFC documentation images to avoid Next.js optimization issues */}
                                <img
                                    src={item.data?.src}
                                    alt={item.data?.alt || 'Diagram'}
                                    className="w-full h-auto cursor-pointer transition-transform duration-200 group-hover:scale-[1.02] max-w-full"
                                    onClick={() => openImageModal(item.data?.src, item.data?.alt || 'Diagram')}
                                    onError={(e) => {
                                        console.error(`❌ Failed to load image: ${e.currentTarget.src}`);
                                        console.error(`📝 Original source: ${item.data?.originalSrc}`);
                                        console.error(`🔍 Attempted resolution path: ${item.data?.src}`);

                                        // Hide the entire image container instead of showing error
                                        const imageContainer = e.currentTarget.closest('.mb-6');
                                        if (imageContainer) {
                                            (imageContainer as HTMLElement).style.display = 'none';
                                        }
                                    }}
                                    onLoad={() => {
                                        console.log(`✅ Successfully loaded image: ${item.data?.src}`);
                                        console.log(`📝 Original source was: ${item.data?.originalSrc}`);
                                    }}
                                    data-original-src={item.data?.originalSrc}
                                />
                                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors duration-200 flex items-center justify-center opacity-0 group-hover:opacity-100">
                                    <div className="bg-white/90 rounded-full p-2">
                                        <ZoomIn className="w-5 h-5 text-gray-700" />
                                    </div>
                                </div>
                            </div>
                            {item.content && (
                                <div className="p-3 bg-muted/50 border-t">
                                    <p className="text-xs text-muted-foreground break-words">{item.content}</p>
                                </div>
                            )}
                        </div>
                    </div>
                );

            case 'code':
                return (
                    <div key={index} className="mb-4 max-w-full">
                        <div className="bg-muted rounded-lg border border-border overflow-hidden">
                            <div className="overflow-x-auto">
                                <pre className="p-4 text-xs leading-relaxed whitespace-pre-wrap break-all min-w-0">
                                    <code className="text-foreground font-mono">{item.content}</code>
                                </pre>
                            </div>
                        </div>
                    </div>
                );

            default:
                return null;
        }
    }, [openImageModal, renderNestedListItem]);

    // Initialize with preview content if available
    useEffect(() => {
        if (isOpen && initialPreview && sections.length === 0) {
            const previewSection: SchemaSection = {
                id: 'preview',
                title: 'Quick Preview',
                content: initialPreview.map(text => ({
                    type: 'text' as const,
                    content: text
                })),
                type: 'definition'
            };
            setSections([previewSection]);
        }
    }, [isOpen, initialPreview, sections.length]);

    // Load full content when opening
    useEffect(() => {
        if (isOpen && sections.length <= 1) {
            loadFullSchema();
        }
    }, [isOpen, loadFullSchema, sections.length]);

    // Bookmark functionality (localStorage)
    useEffect(() => {
        const bookmarks = JSON.parse(localStorage.getItem('ifc-schema-bookmarks') || '[]');
        setIsBookmarked(bookmarks.includes(ifcClassName));
    }, [ifcClassName]);

    const toggleBookmark = useCallback(() => {
        const bookmarks = JSON.parse(localStorage.getItem('ifc-schema-bookmarks') || '[]');
        const newBookmarks = isBookmarked
            ? bookmarks.filter((b: string) => b !== ifcClassName)
            : [...bookmarks, ifcClassName];

        localStorage.setItem('ifc-schema-bookmarks', JSON.stringify(newBookmarks));
        setIsBookmarked(!isBookmarked);
    }, [isBookmarked, ifcClassName]);

    const navigateSection = useCallback((direction: 'prev' | 'next') => {
        const maxIndex = filteredSections.length - 1;
        if (direction === 'prev' && activeSection > 0) {
            setActiveSection(activeSection - 1);
        } else if (direction === 'next' && activeSection < maxIndex) {
            setActiveSection(activeSection + 1);
        }
    }, [activeSection, filteredSections.length]);

    const currentSection = filteredSections[activeSection];

    return (
        <>
            <Dialog open={isOpen} onOpenChange={onClose}>
                <DialogContent className="max-w-6xl h-[95vh] p-0 flex flex-col">
                    <DialogHeader className="p-6 pb-4 border-b bg-gradient-to-r from-primary/5 to-primary/10 flex-shrink-0">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <div className="p-3 bg-primary/20 rounded-xl">
                                    <Zap className="w-6 h-6 text-primary" />
                                </div>
                                <div>
                                    <DialogTitle className="text-2xl font-bold bg-gradient-to-r from-primary to-primary/80 bg-clip-text text-transparent">
                                        {ifcClassName}
                                    </DialogTitle>
                                    <p className="text-sm text-muted-foreground">IFC Schema Documentation</p>
                                </div>
                            </div>
                            <div className="flex items-center gap-2">
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={toggleBookmark}
                                    className="text-yellow-600 hover:text-yellow-700 hover:bg-yellow-50"
                                >
                                    {isBookmarked ? <BookmarkCheck className="w-4 h-4" /> : <Bookmark className="w-4 h-4" />}
                                </Button>
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => window.open(schemaUrl, '_blank')}
                                    className="text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                                >
                                    <ExternalLink className="w-4 h-4" />
                                </Button>
                            </div>
                        </div>
                    </DialogHeader>

                    <div className="flex flex-1 min-h-0">
                        {/* Enhanced Sidebar */}
                        <div className="w-72 border-r bg-muted/20 p-4 space-y-4 flex-shrink-0 flex flex-col">
                            <div className="space-y-3">
                                <div className="relative">
                                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                                    <Input
                                        placeholder="Search content..."
                                        value={searchQuery}
                                        onChange={(e) => setSearchQuery(e.target.value)}
                                        className="pl-10 border-border/50"
                                    />
                                </div>

                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={loadFullSchema}
                                    disabled={loading}
                                    className="w-full"
                                >
                                    {loading ? (
                                        <Loader2 className="w-4 h-4 animate-spin mr-2" />
                                    ) : (
                                        <RefreshCw className="w-4 h-4 mr-2" />
                                    )}
                                    {sections.length <= 1 ? 'Load Full Content' : 'Reload Content'}
                                </Button>
                            </div>

                            <div className="space-y-2 flex-1 min-h-0 flex flex-col">
                                <div className="flex items-center justify-between">
                                    <h4 className="text-sm font-semibold text-foreground">Sections</h4>
                                    <Badge variant="secondary" className="text-xs">
                                        {filteredSections.length}
                                    </Badge>
                                </div>

                                <ScrollArea className="flex-1">
                                    <div className="space-y-1 pr-2">
                                        {filteredSections.map((section, index) => (
                                            <Button
                                                key={section.id}
                                                variant={activeSection === index ? "secondary" : "ghost"}
                                                size="sm"
                                                onClick={() => setActiveSection(index)}
                                                className={cn(
                                                    "w-full justify-start text-left h-auto py-2 px-3",
                                                    activeSection === index && "bg-primary/10 border border-primary/20"
                                                )}
                                            >
                                                <div className="flex items-center gap-2 w-full">
                                                    <span className="flex-shrink-0">{getSectionIcon(section.type)}</span>
                                                    <div className="flex-1 min-w-0">
                                                        <p className="truncate text-xs font-medium">{section.title}</p>
                                                        <Badge variant="outline" className="text-xs mt-1">
                                                            {section.type}
                                                        </Badge>
                                                    </div>
                                                </div>
                                            </Button>
                                        ))}

                                        {filteredSections.length === 0 && searchQuery && (
                                            <p className="text-sm text-muted-foreground italic p-2">
                                                No sections match your search
                                            </p>
                                        )}
                                    </div>
                                </ScrollArea>
                            </div>
                        </div>

                        {/* Enhanced Main content */}
                        <div className="flex-1 flex flex-col min-h-0">
                            {currentSection ? (
                                <>
                                    <div className="p-4 border-b bg-gradient-to-r from-muted/50 to-muted/30 flex items-center justify-between flex-shrink-0">
                                        <div className="flex items-center gap-3">
                                            <div className="p-2 bg-background rounded-lg shadow-sm">
                                                {getSectionIcon(currentSection.type)}
                                            </div>
                                            <div>
                                                <h3 className="text-lg font-semibold">{currentSection.title}</h3>
                                                <Badge variant="secondary" className="mt-1">{currentSection.type}</Badge>
                                            </div>
                                        </div>

                                        <div className="flex items-center gap-2">
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                onClick={() => navigateSection('prev')}
                                                disabled={activeSection === 0}
                                            >
                                                <ChevronLeft className="w-4 h-4" />
                                            </Button>
                                            <span className="text-sm text-muted-foreground px-3 py-1 bg-background rounded-md">
                                                {activeSection + 1} of {filteredSections.length}
                                            </span>
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                onClick={() => navigateSection('next')}
                                                disabled={activeSection === filteredSections.length - 1}
                                            >
                                                <ChevronRight className="w-4 h-4" />
                                            </Button>
                                        </div>
                                    </div>

                                    <ScrollArea className="flex-1">
                                        <div className="p-6">
                                            <div className="max-w-none">
                                                {currentSection.content.map((item, index) =>
                                                    renderContentItem(item, index)
                                                )}
                                            </div>
                                        </div>
                                    </ScrollArea>
                                </>
                            ) : loading ? (
                                <div className="flex-1 flex items-center justify-center">
                                    <div className="text-center space-y-4">
                                        <div className="relative">
                                            <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto">
                                                <Loader2 className="w-8 h-8 animate-spin text-primary" />
                                            </div>
                                        </div>
                                        <div>
                                            <p className="text-base font-medium text-foreground mb-2">Loading Documentation</p>
                                            <p className="text-sm text-muted-foreground">
                                                {loadingProxy ? `Trying ${loadingProxy}...` : "Extracting content and images..."}
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            ) : error ? (
                                <div className="flex-1 flex items-center justify-center">
                                    <div className="text-center space-y-4 max-w-md">
                                        <div className="w-16 h-16 bg-red-50 rounded-full flex items-center justify-center mx-auto">
                                            <AlertTriangle className="w-8 h-8 text-red-500" />
                                        </div>
                                        <div>
                                            <p className="text-base font-medium text-foreground mb-2">Cannot Load Content</p>
                                            <p className="text-sm text-muted-foreground mb-4">{error}</p>
                                            <div className="flex flex-col gap-2">
                                                <Button variant="outline" onClick={retryWithDelay} disabled={loading}>
                                                    <RefreshCw className="w-4 h-4 mr-2" />
                                                    Smart Retry {retryAttempt > 0 && `(${retryAttempt})`}
                                                </Button>
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    onClick={() => window.open(schemaUrl, '_blank')}
                                                    className="text-blue-600 hover:text-blue-700"
                                                >
                                                    <ExternalLink className="w-4 h-4 mr-2" />
                                                    View Original Documentation
                                                </Button>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            ) : (
                                <div className="flex-1 flex items-center justify-center">
                                    <div className="text-center space-y-4">
                                        <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mx-auto">
                                            <BookOpen className="w-8 h-8 text-muted-foreground" />
                                        </div>
                                        <div>
                                            <p className="text-base font-medium text-foreground mb-2">No Content Available</p>
                                            <p className="text-sm text-muted-foreground">Click &quot;Load Full Content&quot; to fetch documentation</p>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </DialogContent>
            </Dialog>

            {/* Image Modal inspired by W3Schools example */}
            <Dialog open={imageModalOpen} onOpenChange={setImageModalOpen}>
                <DialogContent className="max-w-[95vw] max-h-[95vh] p-0 bg-black/95 border-none">
                    <div className="relative w-full h-full flex items-center justify-center">
                        <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setImageModalOpen(false)}
                            className="absolute top-4 right-4 z-10 text-white hover:bg-white/20"
                        >
                            <X className="w-6 h-6" />
                        </Button>

                        {selectedImage && (
                            <div className="flex flex-col items-center max-w-full max-h-full p-8">
                                <img
                                    src={selectedImage.src}
                                    alt={selectedImage.alt}
                                    className="max-w-full max-h-[80vh] object-contain animate-in zoom-in duration-300"
                                />
                                <div className="text-center text-white mt-4 max-w-2xl">
                                    <p className="text-lg font-medium">{selectedImage.alt}</p>
                                    <div className="flex items-center justify-center gap-2 mt-2">
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            onClick={() => window.open(selectedImage.src, '_blank')}
                                            className="text-white hover:bg-white/20"
                                        >
                                            <Download className="w-4 h-4 mr-2" />
                                            Open Original
                                        </Button>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                </DialogContent>
            </Dialog>
        </>
    );
} 