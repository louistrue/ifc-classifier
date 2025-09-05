import { NextRequest, NextResponse } from 'next/server';

const BSDD_BASE_URL = 'https://api.bsdd.buildingsmart.org';

export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);

        const uri = searchParams.get('Uri');
        if (!uri) {
            return NextResponse.json(
                { error: 'Uri parameter is required' },
                { status: 400 }
            );
        }

        const bsddParams = new URLSearchParams();
        bsddParams.append('Uri', uri);

        const useNested = searchParams.get('UseNestedClasses');
        const classType = searchParams.get('ClassType');
        const searchText = searchParams.get('SearchText');
        const relatedIfcEntity = searchParams.get('RelatedIfcEntity');
        const relatedIfcEntities = searchParams.getAll('RelatedIfcEntities');
        const offset = searchParams.get('Offset');
        const limit = searchParams.get('Limit');
        const languageCode = searchParams.get('languageCode');

        if (useNested) bsddParams.append('UseNestedClasses', useNested);
        if (classType) bsddParams.append('ClassType', classType);
        if (searchText) bsddParams.append('SearchText', searchText);
        if (relatedIfcEntity) bsddParams.append('RelatedIfcEntity', relatedIfcEntity);
        if (relatedIfcEntities && relatedIfcEntities.length > 0) {
            for (const e of relatedIfcEntities) bsddParams.append('RelatedIfcEntities', e);
        }
        if (offset) bsddParams.append('Offset', offset);
        if (limit) bsddParams.append('Limit', limit);
        if (languageCode) bsddParams.append('languageCode', languageCode);

        const bsddUrl = `${BSDD_BASE_URL}/api/Dictionary/v1/Classes?${bsddParams.toString()}`;

        const response = await fetch(bsddUrl, {
            headers: {
                'Accept': 'application/json',
                'User-Agent': 'IFC-Classifier/1.0',
            },
            signal: AbortSignal.timeout(15000),
        });

        if (!response.ok) {
            console.error(`BSDD API error: ${response.status} ${response.statusText}`);
            return NextResponse.json(
                { error: `BSDD API returned ${response.status}: ${response.statusText}` },
                { status: response.status }
            );
        }

        const data = await response.json();
        return NextResponse.json(data, {
            headers: {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'GET, OPTIONS',
                'Access-Control-Allow-Headers': 'Content-Type',
            },
        });
    } catch (error) {
        console.error('Error proxying BSDD dictionary classes request:', error);
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


