
import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export async function POST(request: Request, props: { params: Promise<{ id: string }> }) {
    try {
        const params = await props.params;
        const leadId = params.id;
        const { responsible_user_id } = await request.json();

        const tokensPath = path.join(process.cwd(), 'secrets/amo_tokens.json');
        const tokens = JSON.parse(fs.readFileSync(tokensPath, 'utf8'));
        const headers = { 
            'Authorization': 'Bearer ' + tokens.access_token,
            'Content-Type': 'application/json'
        };

        const taskText = "Обновить подрядчика по статусу (запрос с дашборда)";
        const now = Math.floor(Date.now() / 1000);
        const completeTill = now + (2 * 3600); // + 2 hours

        const payload = [
            {
                text: taskText,
                complete_till: completeTill,
                entity_id: parseInt(leadId),
                entity_type: "leads",
                responsible_user_id: responsible_user_id
            }
        ];

        const res = await fetch('https://reforyou.amocrm.ru/api/v4/tasks', {
            method: 'POST',
            headers,
            body: JSON.stringify(payload)
        });

        if (!res.ok) {
            const err = await res.text();
            return NextResponse.json({ success: false, error: err }, { status: res.status });
        }

        return NextResponse.json({ success: true });
    } catch (error: any) {
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}
