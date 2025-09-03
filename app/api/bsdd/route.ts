import { NextResponse } from "next/server";

const BSDD_DICTIONARY_URI = "https://identifier.buildingsmart.org/uri/nbs/uniclass2015/1";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const search = searchParams.get("search") ?? "";

  const params = new URLSearchParams({
    DictionaryUri: BSDD_DICTIONARY_URI,
    SearchText: search,
    Limit: "100",
  });

  const res = await fetch(
    `https://api.bsdd.buildingsmart.org/api/SearchInDictionary/v1?${params.toString()}`,
    {
      headers: { accept: "application/json" },
    },
  );

  if (!res.ok) {
    return new NextResponse("Failed to fetch bSDD classes", { status: 500 });
  }

  const data = await res.json();
  const classes = data?.dictionary?.classes ?? [];
  const mapped = classes.map((cls: any) => ({
    uri: cls.uri,
    code: cls.referenceCode,
    name: cls.name,
    classType: cls.classType,
  }));

  return NextResponse.json(mapped);
}
