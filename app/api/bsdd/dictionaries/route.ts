import { NextRequest, NextResponse } from 'next/server';

const BSDD_BASE_URL = 'https://api.bsdd.buildingsmart.org';

export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);

        // Get optional parameters
        const languageCode = searchParams.get('languageCode');
        const includeTestDictionaries = searchParams.get('includeTestDictionaries') === 'true';

        // Build the BSDD API URL
        const bsddParams = new URLSearchParams();

        if (languageCode) {
            bsddParams.append('LanguageCode', languageCode);
        }
        if (includeTestDictionaries) {
            bsddParams.append('IncludeTestDictionaries', 'true');
        }

        const bsddUrl = `${BSDD_BASE_URL}/api/Dictionary/v1${bsddParams.toString() ? '?' + bsddParams.toString() : ''}`;

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
        console.error('Error proxying BSDD dictionaries request:', error);

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
