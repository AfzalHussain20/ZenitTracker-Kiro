import { NextRequest, NextResponse } from 'next/server';
import { google } from 'googleapis';

function getCredentials() {
    const raw = process.env.GOOGLE_SERVICE_ACCOUNT_KEY;
    if (!raw) throw new Error('GOOGLE_SERVICE_ACCOUNT_KEY env var is not set');

    let parsed: any;
    try {
        parsed = JSON.parse(raw);
    } catch (e: any) {
        throw new Error(`GOOGLE_SERVICE_ACCOUNT_KEY is not valid JSON: ${e.message}`);
    }

    // Fix private_key: unescape \\n → \n if needed
    if (parsed.private_key) {
        parsed.private_key = parsed.private_key.replace(/\\n/g, '\n');
    }

    if (!parsed.client_email) throw new Error('Service account key missing client_email');
    if (!parsed.private_key) throw new Error('Service account key missing private_key');

    return parsed;
}

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const { title, sheets } = body;

        if (!title || !Array.isArray(sheets) || sheets.length === 0) {
            return NextResponse.json({ error: 'Missing title or sheets in request body' }, { status: 400 });
        }

        const credentials = getCredentials();

        const auth = new google.auth.GoogleAuth({
            credentials,
            scopes: ['https://www.googleapis.com/auth/spreadsheets'],
        });
        const api = google.sheets({ version: 'v4', auth });

        const created = await api.spreadsheets.create({
            requestBody: {
                properties: { title },
                sheets: sheets.map((s: any, i: number) => ({
                    properties: {
                        sheetId: i,
                        title: s.tabName,
                        gridProperties: { frozenRowCount: 1 },
                    },
                })),
            },
        });

        const spreadsheetId = created.data.spreadsheetId!;
        const requests: any[] = [];

        sheets.forEach((s: any, sheetIndex: number) => {
            const allRows = [s.headers, ...s.rows];
            requests.push({
                updateCells: {
                    range: { sheetId: sheetIndex, startRowIndex: 0, startColumnIndex: 0 },
                    rows: allRows.map((row: any[], rowIdx: number) => ({
                        values: row.map((cell) => {
                            const isHeader = rowIdx === 0;
                            return {
                                userEnteredValue: { stringValue: String(cell ?? '') },
                                userEnteredFormat: {
                                    backgroundColor: isHeader ? s.headerColor : { red: 1, green: 1, blue: 1 },
                                    textFormat: {
                                        bold: isHeader,
                                        fontSize: isHeader ? 10 : 9,
                                        foregroundColor: isHeader
                                            ? { red: 1, green: 1, blue: 1 }
                                            : { red: 0.18, green: 0.18, blue: 0.18 },
                                    },
                                    borders: {
                                        bottom: { style: 'SOLID', color: { red: 0.85, green: 0.85, blue: 0.85 } },
                                        right:  { style: 'SOLID', color: { red: 0.85, green: 0.85, blue: 0.85 } },
                                    },
                                    verticalAlignment: 'MIDDLE',
                                    wrapStrategy: 'WRAP',
                                },
                            };
                        }),
                    })),
                    fields: 'userEnteredValue,userEnteredFormat',
                },
            });

            // Auto-resize columns
            requests.push({
                autoResizeDimensions: {
                    dimensions: { sheetId: sheetIndex, dimension: 'COLUMNS', startIndex: 0, endIndex: s.headers.length },
                },
            });

            // Color status cells in data rows
            const STATUS_COLORS: Record<string, { red: number; green: number; blue: number }> = {
                '✓ PASS':           { red: 0.85, green: 0.95, blue: 0.85 },
                '✗ FAIL':           { red: 0.98, green: 0.88, blue: 0.88 },
                'MISSING':          { red: 0.99, green: 0.88, blue: 0.88 },
                'VALUE_REQUIRED':   { red: 1.00, green: 0.92, blue: 0.88 },
                'UNEXPECTED_VALUE': { red: 1.00, green: 0.97, blue: 0.82 },
                'EXTRA':            { red: 0.88, green: 0.93, blue: 1.00 },
                'CAPITAL_ATTR':     { red: 1.00, green: 0.97, blue: 0.82 },
            };

            s.rows.forEach((row: any[], rowIdx: number) => {
                row.forEach((cell, colIdx: number) => {
                    const bg = STATUS_COLORS[String(cell ?? '')];
                    if (bg) {
                        requests.push({
                            repeatCell: {
                                range: {
                                    sheetId: sheetIndex,
                                    startRowIndex: rowIdx + 1,
                                    endRowIndex: rowIdx + 2,
                                    startColumnIndex: colIdx,
                                    endColumnIndex: colIdx + 1,
                                },
                                cell: { userEnteredFormat: { backgroundColor: bg } },
                                fields: 'userEnteredFormat.backgroundColor',
                            },
                        });
                    }
                });
            });
        });

        await api.spreadsheets.batchUpdate({ spreadsheetId, requestBody: { requests } });

        return NextResponse.json({ url: `https://docs.google.com/spreadsheets/d/${spreadsheetId}` });
    } catch (err: any) {
        // Surface the full error so we can diagnose from the browser toast
        const message = err?.response?.data?.error?.message || err?.message || 'Unknown error';
        const status = err?.response?.status || 500;
        console.error('[Sheets Export Error]', message, err?.response?.data || '');
        return NextResponse.json({ error: message }, { status });
    }
}
