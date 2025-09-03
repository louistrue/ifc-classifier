export interface BsddClass {
  uri: string;
  code: string;
  name: string;
  classType: string;
  referenceCode: string;
  parentClassCode?: string;
  descriptionPart?: string;
}

const BSDD_DICTIONARY_URI = "https://identifier.buildingsmart.org/uri/nbs/uniclass2015/1";

export async function fetchBSDDClasses(
  search: string,
  signal?: AbortSignal,
): Promise<BsddClass[]> {
  const params = new URLSearchParams({
    Uri: BSDD_DICTIONARY_URI,
    Limit: "100",
  });
  if (search) {
    params.set("SearchText", search);
  }
  const url = `https://api.bsdd.buildingsmart.org/api/Dictionary/v1/Classes?${params.toString()}`;
  const res = await fetch(url, {
    headers: { accept: "text/plain" },
    signal,
  });
  if (!res.ok) {
    throw new Error("Failed to fetch bSDD classes");
  }
  const data = await res.json();
  return data.classes ?? [];
}
