import { prisma } from '../lib/prisma';
import bcrypt from 'bcrypt';

const BCRYPT_ROUNDS = Number(process.env.BCRYPT_ROUNDS ?? 11);

export async function createUserWithPassword(params: {
  email: string;
  password: string;
  name?: string;
}) {
  const { email, password, name } = params;
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    throw new Error('User already exists');
  }

  const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);

  const user = await prisma.user.create({
    data: {
      email,
      name,
      passwordHash,
      // Create default workspace and role
      roles: {
        create: {
          workspace: {
            create: {
              name: `${name ?? email}'s workspace`,
            },
          },
          role: 'owner',
        },
      },
    },
    include: {
      roles: {
        include: { workspace: true },
      },
    },
  });

  return user;
}

export async function verifyUserPassword(email: string, password: string) {
  const user = await prisma.user.findUnique({
    where: { email },
    include: {
      roles: {
        include: { workspace: true },
      },
    },
  });
  if (!user || !user.passwordHash) {
    return null;
  }

  const ok = await bcrypt.compare(password, user.passwordHash);
  if (!ok) return null;

  return user;
}

export async function getUserById(userId: string) {
  return prisma.user.findUnique({
    where: { id: userId },
    include: {
      roles: {
        include: { workspace: true },
      },
    },
  });
}

