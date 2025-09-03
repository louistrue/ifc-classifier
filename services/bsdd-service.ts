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

  const params = new URLSearchParams({
    DictionaryUri: BSDD_DICTIONARY_URI,
    SearchText: query,
    Limit: "100",
  });
  const url = `https://api.bsdd.buildingsmart.org/api/SearchInDictionary/v1?${params.toString()}`;
  const res = await fetch(url, {
    headers: { accept: "text/plain" },
    signal,
  });
  if (!res.ok) {
    throw new Error("Failed to fetch bSDD classes");
  }
  const data = await res.json();
  const classes = data.dictionary?.classes ?? [];
  return classes.map((cls: any) => ({
    uri: cls.uri,
    code: cls.referenceCode ?? cls.code ?? "",
    name: cls.name,
    classType: cls.classType,
  }));
}
