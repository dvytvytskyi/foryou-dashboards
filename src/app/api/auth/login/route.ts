import { NextResponse } from 'next/server';
import { findUserByEmail } from '@/lib/users';
import { createSession } from '@/lib/auth';

export async function POST(request: Request) {
  try {
    const { email, password } = await request.json();

    const user = findUserByEmail(email);

    if (!user || user.password !== password) {
      return NextResponse.json(
        { success: false, error: 'Invalid credentials' },
        { status: 401 }
      );
    }

    await createSession(user.email);

    return NextResponse.json({ 
        success: true, 
        user: { 
            name: user.name, 
            role: user.role, 
            email: user.email,
            partnerId: user.partnerId
        } 
    });
  } catch (e) {
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
