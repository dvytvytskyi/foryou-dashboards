import { SignJWT, jwtVerify } from 'jose';
import { cookies } from 'next/headers';
import { User, findUserByEmail, UserRole } from './users';

const SECRET = new TextEncoder().encode(process.env.AUTH_SECRET || 'foryou-secret-key-12345');
const COOKIE_NAME = 'foryou_session';

export async function createSession(email: string) {
  const user = findUserByEmail(email);
  if (!user) return null;

  const expirationTime = '24h';
  const token = await new SignJWT({ 
    email: user.email, 
    role: user.role,
    name: user.name,
    partnerId: user.partnerId 
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(expirationTime)
    .sign(SECRET);

  (await cookies()).set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24 // 1 day
  });

  return token;
}

export async function getSession() {
  const token = (await cookies()).get(COOKIE_NAME)?.value;
  if (!token) return null;

  try {
    const { payload } = await jwtVerify(token, SECRET);
    return payload as unknown as { 
        email: string; 
        role: UserRole; 
        name: string;
        partnerId?: string;
    };
  } catch (e) {
    return null;
  }
}

export async function logout() {
  (await cookies()).delete(COOKIE_NAME);
}
