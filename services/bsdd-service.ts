export interface BSDDClass {
  uri: string;
  code: string;
  name: string;
  classType?: string;
  referenceCode?: string;
  parentClassCode?: string;
  descriptionPart?: string;
}

const BASE_URL = "https://api.bsdd.buildingsmart.org/api/Dictionary/v1/Classes?Uri=https%3A%2F%2Fidentifier.buildingsmart.org%2Furi%2Fnbs%2Funiclass2015%2F1&Limit=100";

export async function searchBSDDClasses(searchText: string): Promise<BSDDClass[]> {
  const url = searchText
    ? `${BASE_URL}&SearchText=${encodeURIComponent(searchText)}`
    : BASE_URL;
  const res = await fetch(url, {
    headers: { accept: "text/plain" },
  });
  if (!res.ok) {
    throw new Error("Failed to fetch bSDD classes");
  }
  const data = await res.json();
  return data.classes ?? [];
}
