export interface BsddClass {
  uri: string;
  code: string;
  name: string;
  classType: string;
  referenceCode?: string;
  dictionaryName?: string;
  dictionaryUri?: string;
  definition?: string;
  synonyms?: string[];
}

export interface BsddProperty {
  uri: string;
  code: string;
  name: string;
  descriptionPart?: string;
}

export interface BsddDictionary {
  uri: string;
  name: string;
  version?: string;
  organizationCode?: string;
  organizationNameOwner?: string;
  dictionaryCode?: string;
  qualityAssuranceProcedure?: string;
  status?: string;
  isLatestVersion?: boolean;
  isVerified?: boolean;
  isPrivate?: boolean;
  releaseDate?: string;
  lastUpdatedUtc?: string;
}

export interface BsddSearchResult {
  classes: BsddClass[];
  totalCount: number;
  offset: number;
  count: number;
}

export interface BsddGlobalSearchResult {
  classes: BsddClass[];
  dictionaries: BsddDictionary[];
  totalCount: number;
  offset: number;
  count: number;
}

const BSDD_DICTIONARY_URI =
  "https://identifier.buildingsmart.org/uri/nbs/uniclass2015/1";

// Popular dictionaries for quick selection
export const POPULAR_DICTIONARIES = [
  {
    uri: 'https://identifier.buildingsmart.org/uri/buildingsmart/ifc/4.3',
    name: 'IFC 4.3',
    description: 'Industry Foundation Classes'
  },
  {
    uri: 'https://identifier.buildingsmart.org/uri/nbs/uniclass2015/1',
    name: 'Uniclass 2015',
    description: 'UK Classification System'
  },
  {
    uri: 'https://identifier.buildingsmart.org/uri/etim/etim/10.0',
    name: 'ETIM 10.0',
    description: 'Technical Information Model'
  },
  {
    uri: 'https://identifier.buildingsmart.org/uri/molio/cciconstruction/1.0',
    name: 'CCI Construction',
    description: 'Molio Construction Classification'
  },
  {
    uri: 'https://identifier.buildingsmart.org/uri/buildingsmart-de/LAFA1/1.0',
    name: 'LAFA1',
    description: 'German Building Classification'
  }
];

export async function searchBSDDClasses(
  search: string,
  signal?: AbortSignal,
): Promise<BsddClass[]> {
  const query = search.trim();
  if (!query) return [];

  // Use our Next.js API route as proxy instead of direct BSDD API call
  const params = new URLSearchParams({
    searchText: query,
    dictionaryUri: BSDD_DICTIONARY_URI,
    limit: "100",
  });

  const url = `/api/bsdd/search?${params.toString()}`;

  try {
    const res = await fetch(url, {
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json'
      },
      signal,
    });

    if (!res.ok) {
      const errorData = await res.json().catch(() => ({ error: 'Unknown error' }));
      throw new Error(errorData.error || `HTTP ${res.status}: ${res.statusText}`);
    }

    const data = await res.json();
    const classes = data.dictionary?.classes ?? [];

    return classes.map((cls: any) => {
      // Improved code fallback logic
      let finalCode = cls.referenceCode ?? cls.code ?? "";

      // If still no code, generate a synthetic one from the name
      if (!finalCode.trim()) {
        const name = cls.name || "";
        if (name) {
          // Create a code from the first few words of the name
          finalCode = name.split(' ')
            .slice(0, 3)
            .map((word: string) => word.substring(0, 3).toUpperCase())
            .join('-')
            .replace(/[^A-Z0-9\-]/g, ''); // Remove special characters
        }
      }

      return {
        uri: cls.uri,
        code: finalCode,
        name: cls.name ?? "",
        classType: cls.classType ?? "",
        referenceCode: cls.referenceCode,
        definition: cls.definition,
        synonyms: cls.synonyms,
      } as BsddClass;
    }).filter((cls: BsddClass) => {
      // More lenient filtering - allow classifications without codes if they have names
      const hasValidName = cls.name && cls.name.trim().length > 0;

      if (!hasValidName) {
        console.warn('Filtered out BSDD classification with no name:', cls);
        return false;
      }

      // If no code, generate a fallback
      if (!cls.code || !cls.code.trim()) {
        console.warn('BSDD classification missing code, using generated fallback:', cls);
      }

      return true;
    });
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error('Search request was cancelled');
    }
    throw error;
  }
}

// Global text search across all BSDD dictionaries
export async function searchBSDDGlobal(
  search: string,
  options: {
    limit?: number;
    offset?: number;
    typeFilter?: 'Class' | 'Property' | 'Material' | 'GroupOfProperties';
    relatedIfcEntity?: string;
    signal?: AbortSignal;
  } = {}
): Promise<BsddGlobalSearchResult> {
  const query = search.trim();
  if (!query) {
    return { classes: [], dictionaries: [], totalCount: 0, offset: 0, count: 0 };
  }

  const params = new URLSearchParams({
    SearchText: query,
    Limit: (options.limit ?? 50).toString(),
    Offset: (options.offset ?? 0).toString(),
  });

  if (options.typeFilter) {
    params.append('TypeFilter', options.typeFilter);
  }
  if (options.relatedIfcEntity) {
    params.append('RelatedIfcEntity', options.relatedIfcEntity);
  }

  const url = `/api/bsdd/text-search?${params.toString()}`;

  try {
    const res = await fetch(url, {
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json'
      },
      signal: options.signal,
    });

    if (!res.ok) {
      const errorData = await res.json().catch(() => ({ error: 'Unknown error' }));
      throw new Error(errorData.error || `HTTP ${res.status}: ${res.statusText}`);
    }

    const data = await res.json();

    // Create a lookup object for dictionary names
    const dictionaryLookup: Record<string, string> = {};
    (data.dictionaries ?? []).forEach((dict: any) => {
      dictionaryLookup[dict.uri] = dict.name || 'Unknown';
    });

    const classes = (data.classes ?? []).map((cls: any) => {
      // Improved code fallback logic for global search
      let finalCode = cls.referenceCode ?? cls.code ?? "";

      // If still no code, generate a synthetic one from the name
      if (!finalCode.trim()) {
        const name = cls.name || "";
        if (name) {
          // Create a code from the first few words of the name
          finalCode = name.split(' ')
            .slice(0, 3)
            .map((word: string) => word.substring(0, 3).toUpperCase())
            .join('-')
            .replace(/[^A-Z0-9\-]/g, ''); // Remove special characters
        }
      }

      // Fallback to URI parsing if lookup fails
      let finalDictionaryName = cls.dictionaryName || dictionaryLookup[cls.dictionaryUri] || null;

      // If still no name, try parsing the URI
      if (!finalDictionaryName && cls.dictionaryUri) {
        const parts = cls.dictionaryUri.split('/');
        let dictName = '';
        if (parts.length >= 2) {
          dictName = parts[parts.length - 2];
        }

        const lastPart = parts[parts.length - 1] || '';
        if (!/^(v?\d+\.?\d*|latest)$/i.test(lastPart)) {
          dictName = lastPart;
        }

        const nameMap: Record<string, string> = {
          'ifc': 'IFC',
          'etim': 'ETIM',
          'uniclass2015': 'Uniclass 2015',
          'cciconstruction': 'CCI Construction',
          'nlsfb2005': 'NL-SfB 2005',
          'buildingsmart': 'buildingSMART'
        };

        finalDictionaryName = nameMap[dictName.toLowerCase()] || dictName || 'Unknown';
      }

      return {
        uri: cls.uri,
        code: finalCode,
        name: cls.name ?? "",
        classType: cls.classType ?? "",
        referenceCode: cls.referenceCode,
        dictionaryName: finalDictionaryName,
        dictionaryUri: cls.dictionaryUri,
        definition: cls.definition,
        synonyms: cls.synonyms,
      } as BsddClass;
    }).filter((cls: BsddClass) => {
      // More lenient filtering for global search
      const hasValidName = cls.name && cls.name.trim().length > 0;

      if (!hasValidName) {
        console.warn('Filtered out BSDD classification with no name:', cls);
        return false;
      }

      // Allow classifications with generated codes
      if (!cls.code || !cls.code.trim()) {
        console.warn('BSDD classification using generated code:', cls);
      }

      return true;
    });

    const dictionaries = (data.dictionaries ?? []).map((dict: any) => ({
      uri: dict.uri,
      name: dict.name ?? "",
      version: dict.version,
      organizationCode: dict.organizationCode,
      dictionaryCode: dict.dictionaryCode,
      qualityAssuranceProcedure: dict.qualityAssuranceProcedure,
      status: dict.status,
    }));

    return {
      classes,
      dictionaries,
      totalCount: data.totalCount ?? 0,
      offset: data.offset ?? 0,
      count: data.count ?? 0,
    };
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error('Global search request was cancelled');
    }
    throw error;
  }
}

// Search within a specific dictionary (enhanced version)
export async function searchBSDDInDictionary(
  search: string,
  dictionaryUri: string,
  options: {
    limit?: number;
    offset?: number;
    relatedIfcEntity?: string;
    signal?: AbortSignal;
  } = {}
): Promise<BsddSearchResult> {
  const query = search.trim();
  if (!query) {
    return { classes: [], totalCount: 0, offset: 0, count: 0 };
  }

  const params = new URLSearchParams({
    searchText: query,
    dictionaryUri,
    limit: (options.limit ?? 100).toString(),
    offset: (options.offset ?? 0).toString(),
  });

  if (options.relatedIfcEntity) {
    params.append('relatedIfcEntity', options.relatedIfcEntity);
  }

  const url = `/api/bsdd/search?${params.toString()}`;

  try {
    const res = await fetch(url, {
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json'
      },
      signal: options.signal,
    });

    if (!res.ok) {
      const errorData = await res.json().catch(() => ({ error: 'Unknown error' }));
      throw new Error(errorData.error || `HTTP ${res.status}: ${res.statusText}`);
    }

    const data = await res.json();
    const classes = data.dictionary?.classes ?? [];

    const processedClasses = classes.map((cls: any) => ({
      uri: cls.uri,
      code: cls.referenceCode ?? cls.code ?? "",
      name: cls.name ?? "",
      classType: cls.classType ?? "",
      referenceCode: cls.referenceCode,
      dictionaryName: data.dictionary?.name,
      dictionaryUri: dictionaryUri,
      definition: cls.definition,
      synonyms: cls.synonyms,
    } as BsddClass)).filter((cls: BsddClass) => {
      const hasValidCode = cls.code && cls.code.trim().length > 0;
      const hasValidName = cls.name && cls.name.trim().length > 0;

      if (!hasValidCode || !hasValidName) {
        console.warn('Filtered out invalid BSDD classification:', cls);
        return false;
      }

      return true;
    });

    return {
      classes: processedClasses,
      totalCount: data.totalCount ?? 0,
      offset: data.offset ?? 0,
      count: data.count ?? 0,
    };
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error('Dictionary search request was cancelled');
    }
    throw error;
  }
}

// Search in multiple dictionaries and aggregate the results
export async function searchBSDDInDictionaries(
  search: string,
  dictionaryUris: string[],
  options: {
    limit?: number; // total limit across all results (applied after aggregation)
    offset?: number; // not currently used across aggregated results
    relatedIfcEntity?: string;
    signal?: AbortSignal;
    typeFilter?: 'Class' | 'Property' | 'Material' | 'GroupOfProperties'; // client-side filter for per-dictionary searches
  } = {}
): Promise<BsddSearchResult> {
  const trimmed = search.trim();
  if (!trimmed || dictionaryUris.length === 0) {
    return { classes: [], totalCount: 0, offset: 0, count: 0 };
  }

  // Run searches in parallel
  const results = await Promise.allSettled(
    dictionaryUris.map((uri) =>
      searchBSDDInDictionary(trimmed, uri, {
        // Use a reasonably high per-dictionary limit so client-side filters can work well
        limit: Math.max(options.limit ?? 100, 100),
        offset: options.offset ?? 0,
        relatedIfcEntity: options.relatedIfcEntity,
        signal: options.signal,
      })
    )
  );

  // Flatten successful results
  const allClasses: BsddClass[] = [];
  let total = 0;

  for (const res of results) {
    if (res.status === 'fulfilled') {
      total += res.value.totalCount ?? res.value.classes.length;
      allClasses.push(...res.value.classes);
    }
  }

  // Client-side type filter for per-dictionary searches (since API lacks TypeFilter here)
  let filtered = allClasses;
  if (options.typeFilter && options.typeFilter !== (undefined as any)) {
    filtered = filtered.filter((cls) => cls.classType === options.typeFilter);
  }

  // Dedupe by URI if available, otherwise by dictionaryUri+code
  const seen = new Set<string>();
  const deduped: BsddClass[] = [];
  for (const cls of filtered) {
    const key = cls.uri || `${cls.dictionaryUri}::${cls.code}`;
    if (!seen.has(key)) {
      seen.add(key);
      deduped.push(cls);
    }
  }

  // Apply global limit after aggregation
  const limited = (options.limit && options.limit > 0) ? deduped.slice(0, options.limit) : deduped;

  return {
    classes: limited,
    totalCount: total,
    offset: 0,
    count: limited.length,
  };
}

// Analyze dictionary field availability
export interface DictionaryFieldAnalysis {
  dictionaryUri: string;
  dictionaryName: string;
  totalClasses: number;
  hasCodeField: number;
  hasReferenceCodeField: number;
  hasDefinitionField: number;
  hasSynonymsField: number;
  bothCodesAvailable: number;
  neitherCodeAvailable: number;
}

export async function analyzeDictionaryFields(searchTerm: string = 'wall', limit: number = 50): Promise<DictionaryFieldAnalysis[]> {
  try {
    // Get global search results
    const result = await searchBSDDGlobal(searchTerm, { limit });

    // Group by dictionary and analyze fields
    const dictAnalysis = new Map<string, DictionaryFieldAnalysis>();

    result.classes.forEach(cls => {
      const dictUri = cls.dictionaryUri || 'unknown';
      const dictName = cls.dictionaryName || dictUri.split('/').pop() || 'Unknown';

      if (!dictAnalysis.has(dictUri)) {
        dictAnalysis.set(dictUri, {
          dictionaryUri: dictUri,
          dictionaryName: dictName,
          totalClasses: 0,
          hasCodeField: 0,
          hasReferenceCodeField: 0,
          hasDefinitionField: 0,
          hasSynonymsField: 0,
          bothCodesAvailable: 0,
          neitherCodeAvailable: 0,
        });
      }

      const analysis = dictAnalysis.get(dictUri)!;
      analysis.totalClasses++;

      // Analyze field availability
      const hasCode = cls.code && cls.code.trim().length > 0;
      const hasReferenceCode = cls.referenceCode && cls.referenceCode.trim().length > 0;

      if (hasCode) analysis.hasCodeField++;
      if (hasReferenceCode) analysis.hasReferenceCodeField++;
      if (cls.definition && cls.definition.trim().length > 0) analysis.hasDefinitionField++;
      if (cls.synonyms && cls.synonyms.length > 0) analysis.hasSynonymsField++;

      if (hasCode && hasReferenceCode) analysis.bothCodesAvailable++;
      if (!hasCode && !hasReferenceCode) analysis.neitherCodeAvailable++;
    });

    return Array.from(dictAnalysis.values()).sort((a, b) => b.totalClasses - a.totalClasses);
  } catch (error) {
    console.error('Error analyzing dictionary fields:', error);
    return [];
  }
}

// Get available dictionaries
export async function getBSDDDictionaries(signal?: AbortSignal): Promise<BsddDictionary[]> {
  try {
    const res = await fetch('/api/bsdd/dictionaries', {
      headers: { 'Accept': 'application/json' },
      signal,
    });

    if (!res.ok) {
      throw new Error('Failed to fetch BSDD dictionaries');
    }

    const data = await res.json();
    const dictionaries = data.dictionaries ?? [];

    return dictionaries.map((dict: any) => ({
      uri: dict.uri,
      name: dict.name ?? "",
      version: dict.version,
      organizationCode: dict.organizationCode ?? dict.organizationCodeOwner, // support both
      organizationNameOwner: dict.organizationNameOwner,
      dictionaryCode: dict.dictionaryCode ?? dict.code,
      qualityAssuranceProcedure: dict.qualityAssuranceProcedure,
      status: dict.status,
      isLatestVersion: dict.isLatestVersion,
      isVerified: dict.isVerified,
      isPrivate: dict.isPrivate,
      releaseDate: dict.releaseDate,
      lastUpdatedUtc: dict.lastUpdatedUtc,
    } as BsddDictionary));
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error('Dictionary request was cancelled');
    }
    throw error;
  }
}

// Fetch classes for a dictionary (supports nested or paginated flat)
export async function fetchDictionaryClasses(options: {
  uri: string;
  useNested?: boolean;
  classType?: 'Class' | 'GroupOfProperties' | 'AlternativeUse' | 'Material';
  relatedIfcEntity?: string;
  offset?: number;
  limit?: number;
  languageCode?: string;
  signal?: AbortSignal;
}): Promise<{
  classes: any[];
  classesTotalCount?: number;
  classesOffset?: number;
  classesCount?: number;
  totalCount?: number;
  offset?: number;
  count?: number;
}> {
  const params = new URLSearchParams();
  params.set('Uri', options.uri);
  if (options.useNested) params.set('UseNestedClasses', 'true');
  if (options.classType) params.set('ClassType', options.classType);
  if (options.relatedIfcEntity) params.set('RelatedIfcEntity', options.relatedIfcEntity);
  if (options.offset !== undefined) params.set('Offset', String(options.offset));
  if (options.limit !== undefined) params.set('Limit', String(options.limit));
  if (options.languageCode) params.set('languageCode', options.languageCode);

  const res = await fetch(`/api/bsdd/dictionary-classes?${params.toString()}`, {
    headers: { 'Accept': 'application/json' },
    signal: options.signal,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `Failed to fetch dictionary classes: ${res.statusText}`);
  }
  return res.json();
}

// Fetch properties for a dictionary (paginated)
export async function fetchDictionaryProperties(options: {
  uri: string;
  searchText?: string;
  offset?: number;
  limit?: number;
  languageCode?: string;
  signal?: AbortSignal;
}): Promise<{
  properties: BsddProperty[];
  propertiesTotalCount?: number;
  propertiesOffset?: number;
  propertiesCount?: number;
}> {
  const params = new URLSearchParams();
  params.set('Uri', options.uri);
  if (options.searchText) params.set('SearchText', options.searchText);
  if (options.offset !== undefined) params.set('Offset', String(options.offset));
  if (options.limit !== undefined) params.set('Limit', String(options.limit));
  if (options.languageCode) params.set('languageCode', options.languageCode);

  const res = await fetch(`/api/bsdd/dictionary-properties?${params.toString()}`, {
    headers: { 'Accept': 'application/json' },
    signal: options.signal,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `Failed to fetch dictionary properties: ${res.statusText}`);
  }
  const data = await res.json();
  const properties = (data.properties ?? []).map((p: any) => ({
    uri: p.uri,
    code: p.code,
    name: p.name,
    descriptionPart: p.descriptionPart,
  })) as BsddProperty[];
  return { ...data, properties };
}

// Convenience: fetch many pages of classes (flat) and build a simple parent map
export async function fetchAllDictionaryClassesFlat(options: {
  uri: string;
  classType?: 'Class' | 'GroupOfProperties' | 'AlternativeUse' | 'Material';
  languageCode?: string;
  maxPages?: number; // safety cap
  signal?: AbortSignal;
}): Promise<any[]> {
  const pageSize = 1000;
  const maxPages = options.maxPages ?? 5;
  const out: any[] = [];
  let offset = 0;
  for (let i = 0; i < maxPages; i++) {
    const page = await fetchDictionaryClasses({
      uri: options.uri,
      classType: options.classType,
      offset,
      limit: pageSize,
      languageCode: options.languageCode,
      signal: options.signal,
    });
    const batch = page.classes ?? [];
    out.push(...batch);
    const count = page.classesCount ?? batch.length;
    if (count < pageSize) break;
    offset += count;
  }
  return out;
}

// Try nested, fallback to flat if fails
export async function fetchDictionaryClassesTree(options: {
  uri: string;
  classType?: 'Class' | 'GroupOfProperties' | 'AlternativeUse' | 'Material';
  languageCode?: string;
  signal?: AbortSignal;
}): Promise<{ root: any[]; byCode: Map<string, any> }> {
  try {
    const nested = await fetchDictionaryClasses({
      uri: options.uri,
      useNested: true,
      classType: options.classType,
      languageCode: options.languageCode,
      signal: options.signal,
    });
    // When nested, items may include children identifiers; pass through
    const byCode = new Map<string, any>();
    (nested.classes ?? []).forEach((c: any) => { if (c.code) byCode.set(c.code, c); });
    return { root: nested.classes ?? [], byCode };
  } catch {
    const flat = await fetchAllDictionaryClassesFlat({
      uri: options.uri,
      classType: options.classType,
      languageCode: options.languageCode,
      signal: options.signal,
    });
    // Build tree from parentClassCode
    const byCode = new Map<string, any>();
    flat.forEach((c: any) => { if (c.code) { byCode.set(c.code, { ...c, children: [] }); } });
    const roots: any[] = [];
    flat.forEach((c: any) => {
      const node = byCode.get(c.code);
      const parent = c.parentClassCode ? byCode.get(c.parentClassCode) : null;
      if (parent && node) parent.children.push(node);
      else if (node) roots.push(node);
    });
    return { root: roots, byCode };
  }
}
