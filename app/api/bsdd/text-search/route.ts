import { NextRequest, NextResponse } from 'next/server';
import { searchBSDDGlobal } from '@/services/bsdd-service';

const BSDD_BASE_URL = 'https://api.bsdd.buildingsmart.org';

export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);

        // Get search parameters with defaults
        const searchText = searchParams.get('SearchText') || '';
        const languageCode = searchParams.get('LanguageCode');
        const relatedIfcEntity = searchParams.get('RelatedIfcEntity');
        const offset = searchParams.get('Offset') || '0';
        const limit = searchParams.get('Limit') || '100';
        const typeFilter = searchParams.get('TypeFilter'); // 'Class', 'Property', 'Material', 'GroupOfProperties'

        // Validate required parameters
        if (!searchText.trim()) {
            return NextResponse.json(
                { error: 'SearchText parameter is required' },
                { status: 400 }
            );
        }

        // Convert typeFilter to the expected format
        const typeFilterValue = typeFilter as 'Class' | 'Property' | 'Material' | 'GroupOfProperties' | undefined;

        // For now, let's go back to the raw API call and see if that works
        // Build the BSDD API URL for global text search
        const bsddParams = new URLSearchParams({
            SearchText: searchText,
            Offset: offset,
            Limit: limit,
        });

        // Add optional parameters if provided
        if (languageCode) {
            bsddParams.append('LanguageCode', languageCode);
        }
        if (relatedIfcEntity) {
            bsddParams.append('RelatedIfcEntity', relatedIfcEntity);
        }
        if (typeFilter) {
            bsddParams.append('TypeFilter', typeFilter);
        }

        const bsddUrl = `${BSDD_BASE_URL}/api/TextSearch/v2?${bsddParams.toString()}`;

        // Make the request to BSDD API
        const response = await fetch(bsddUrl, {
            headers: {
                'Accept': 'application/json',
                'User-Agent': 'IFC-Classifier/1.0',
            },
            // Add timeout to prevent hanging requests
            signal: AbortSignal.timeout(15000), // 15 second timeout for global search
        });

        if (!response.ok) {
            console.error(`BSDD API error: ${response.status} ${response.statusText}`);
            return NextResponse.json(
                { error: `BSDD API returned ${response.status}: ${response.statusText}` },
                { status: response.status }
            );
        }

        const data = await response.json();

        // Process the data to add dictionary names to classes
        const dictionaryLookup: Record<string, string> = {};
        (data.dictionaries ?? []).forEach((dict: any) => {
            dictionaryLookup[dict.uri] = dict.name || 'Unknown';
        });

        // Add dictionary names to classes
        const processedClasses = (data.classes ?? []).map((cls: any) => ({
            ...cls,
            dictionaryName: cls.dictionaryName || dictionaryLookup[cls.dictionaryUri] || null,
        }));

        const processedData = {
            ...data,
            classes: processedClasses,
        };

        // Return the response with proper CORS headers
        return NextResponse.json(processedData, {
            headers: {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'GET, OPTIONS',
                'Access-Control-Allow-Headers': 'Content-Type',
            },
        });

    } catch (error) {
        console.error('Error proxying BSDD text search request:', error);

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
