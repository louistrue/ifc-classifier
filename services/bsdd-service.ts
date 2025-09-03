export interface BsddClass {
  uri: string;
  code: string;
  name: string;
  classType: string;
}

export async function fetchBSDDClasses(
  search: string,
  signal?: AbortSignal,
): Promise<BsddClass[]> {
  const params = new URLSearchParams();
  if (search) {
    params.set("search", search);
  }
  const res = await fetch(`/api/bsdd?${params.toString()}`, { signal });
  if (!res.ok) {
    throw new Error("Failed to fetch bSDD classes");
  }
  return res.json();
}
