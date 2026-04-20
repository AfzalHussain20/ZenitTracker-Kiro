import { NextResponse } from 'next/server';

export async function GET() {
    try {
        const raw = process.env.GOOGLE_SERVICE_ACCOUNT_KEY;
        
        if (!raw) {
            return NextResponse.json({ 
                error: 'GOOGLE_SERVICE_ACCOUNT_KEY not found',
                allEnvKeys: Object.keys(process.env).filter(k => k.includes('GOOGLE'))
            }, { status: 500 });
        }

        let parsed: any;
        try {
            parsed = JSON.parse(raw);
        } catch (e: any) {
            return NextResponse.json({ 
                error: 'Invalid JSON',
                message: e.message,
                rawLength: raw.length,
                rawPreview: raw.substring(0, 100)
            }, { status: 500 });
        }

        return NextResponse.json({ 
            success: true,
            hasClientEmail: !!parsed.client_email,
            hasPrivateKey: !!parsed.private_key,
            clientEmail: parsed.client_email,
            projectId: parsed.project_id
        });
    } catch (err: any) {
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
