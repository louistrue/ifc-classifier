export interface BsddClass {
  uri: string;
  code: string;
  name: string;
  classType: string;
}

const BSDD_DICTIONARY_URI =
  "https://identifier.buildingsmart.org/uri/nbs/uniclass2015/1";

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

    return classes.map((cls: any) => ({
      uri: cls.uri,
      code: cls.referenceCode ?? cls.code ?? "",
      name: cls.name ?? "",
      classType: cls.classType ?? "",
    })).filter((cls) => {
      // Filter out invalid classifications
      const hasValidCode = cls.code && cls.code.trim().length > 0;
      const hasValidName = cls.name && cls.name.trim().length > 0;

      if (!hasValidCode || !hasValidName) {
        console.warn('Filtered out invalid BSDD classification:', cls);
        return false;
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

// Additional function to get available dictionaries
export async function getBSDDDictionaries(signal?: AbortSignal): Promise<any[]> {
  try {
    const res = await fetch('/api/bsdd/dictionaries', {
      headers: { 'Accept': 'application/json' },
      signal,
    });

    if (!res.ok) {
      throw new Error('Failed to fetch BSDD dictionaries');
    }

    const data = await res.json();
    return data.dictionaries ?? [];
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error('Dictionary request was cancelled');
    }
    throw error;
  }
}
