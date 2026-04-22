import { NextRequest, NextResponse } from 'next/server';

const WAZZUP_API_KEY = 'c5ece50e4cd445fdb47fa67daec1bbea';

export async function POST(req: NextRequest) {
  try {
    const { phone, userId } = await req.json();

    if (!phone) {
      return NextResponse.json({ error: 'phone required' }, { status: 400 });
    }

    // Normalize phone: digits only, no +
    const chatId = String(phone).replace(/\D/g, '');

    if (!chatId) {
      return NextResponse.json({ error: 'invalid phone' }, { status: 400 });
    }

    const body = {
      user: {
        id: String(userId || 'dashboard-user'),
      },
      scope: 'card',
      filter: [
        {
          chatType: 'whatsapp',
          chatId,
        },
      ],
      activeChat: {
        chatType: 'whatsapp',
        chatId,
      },
    };

    const res = await fetch('https://api.wazzup24.com/v3/iframe', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${WAZZUP_API_KEY}`,
      },
      body: JSON.stringify(body),
    });

    const data = await res.json();

    if (!res.ok || data.error) {
      return NextResponse.json(
        { error: data.error?.code || data.error || 'Wazzup error', details: data },
        { status: res.status || 500 }
      );
    }

    return NextResponse.json({ url: data.url });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
