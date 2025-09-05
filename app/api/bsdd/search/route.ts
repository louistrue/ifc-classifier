import { NextRequest, NextResponse } from 'next/server';

const BSDD_BASE_URL = 'https://api.bsdd.buildingsmart.org';
const DEFAULT_DICTIONARY_URI = 'https://identifier.buildingsmart.org/uri/nbs/uniclass2015/1';

// Popular dictionaries for quick access
const POPULAR_DICTIONARIES = [
  'https://identifier.buildingsmart.org/uri/buildingsmart/ifc/4.3',
  'https://identifier.buildingsmart.org/uri/nbs/uniclass2015/1',
  'https://identifier.buildingsmart.org/uri/etim/etim/10.0',
  'https://identifier.buildingsmart.org/uri/molio/cciconstruction/1.0',
  'https://identifier.buildingsmart.org/uri/buildingsmart-de/LAFA1/1.0'
];

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);

    // Get search parameters with defaults
    const searchText = searchParams.get('searchText') || '';
    const dictionaryUri = searchParams.get('dictionaryUri') || DEFAULT_DICTIONARY_URI;
    const limit = searchParams.get('limit') || '100';
    const languageCode = searchParams.get('languageCode');
    const relatedIfcEntity = searchParams.get('relatedIfcEntity');
    const offset = searchParams.get('offset') || '0';

    // Validate required parameters
    if (!searchText.trim()) {
      return NextResponse.json(
        { error: 'searchText parameter is required' },
        { status: 400 }
      );
    }

    // Build the BSDD API URL
    const bsddParams = new URLSearchParams({
      DictionaryUri: dictionaryUri,
      SearchText: searchText,
      Limit: limit,
      Offset: offset,
    });

    // Add optional parameters if provided
    if (languageCode) {
      bsddParams.append('LanguageCode', languageCode);
    }
    if (relatedIfcEntity) {
      bsddParams.append('RelatedIfcEntity', relatedIfcEntity);
    }

    const bsddUrl = `${BSDD_BASE_URL}/api/SearchInDictionary/v1?${bsddParams.toString()}`;

    // Make the request to BSDD API
    const response = await fetch(bsddUrl, {
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'IFC-Classifier/1.0',
      },
      // Add timeout to prevent hanging requests
      signal: AbortSignal.timeout(10000), // 10 second timeout
    });

    if (!response.ok) {
      console.error(`BSDD API error: ${response.status} ${response.statusText}`);
      return NextResponse.json(
        { error: `BSDD API returned ${response.status}: ${response.statusText}` },
        { status: response.status }
      );
    }

    const data = await response.json();

    // Return the response with proper CORS headers
    return NextResponse.json(data, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
      },
    });

  } catch (error) {
    console.error('Error proxying BSDD request:', error);

    // Handle timeout errors specifically
    if (error instanceof Error && error.name === 'AbortError') {
      return NextResponse.json(
        { error: 'Request to BSDD API timed out' },
        { status: 408 }
      );
    }

    return NextResponse.json(
      { error: 'Internal server error while fetching from BSDD API' },
      { status: 500 }
    );
  }
}

// Handle preflight requests for CORS
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
}
