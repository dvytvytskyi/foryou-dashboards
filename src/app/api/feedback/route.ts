import { NextResponse } from 'next/server';
import { queryPostgres } from '@/lib/postgres';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { page_name, component_name, date_context, ticket_type, description } = body;

    if (!page_name || !component_name || !date_context || !ticket_type || !description) {
      return NextResponse.json({ success: false, error: 'Missing required fields' }, { status: 400 });
    }

    const { rows } = await queryPostgres(
      `
      INSERT INTO feedback_tickets (page_name, component_name, date_context, ticket_type, description)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING id, created_at
      `,
      [page_name, component_name, date_context, ticket_type, description]
    );

    return NextResponse.json({ success: true, data: rows[0] });
  } catch (error: any) {
    console.error('Failed to create feedback ticket:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
