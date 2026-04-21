
import { NextResponse } from 'next/server';
import { amoFetch } from '@/lib/amo';

export async function POST(request: Request, props: { params: Promise<{ id: string }> }) {
    try {
        const params = await props.params;
        const leadId = params.id;
        const { responsible_user_id } = await request.json();

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

        const res = await amoFetch(`/api/v4/tasks`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
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
