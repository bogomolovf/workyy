# Authentication Implementation

This document describes the authentication system implemented in Workyy 4.0.

## Overview

The authentication system uses:

- **Email + Password** authentication
- **JWT tokens** stored in HTTP-only cookies
- **bcrypt** for password hashing (11 rounds)
- **Fastify JWT plugin** for token management
- **Fastify Cookie plugin** for secure cookie handling

## Backend Implementation

### Database Schema

The `User` model includes:

- `passwordHash` (nullable for backward compatibility with existing users)

### Environment Variables

Required environment variables in `apps/realtime-server/.env`:

```bash
JWT_SECRET=change-me-in-prod
AUTH_COOKIE_NAME=auth_token
AUTH_COOKIE_DOMAIN=
AUTH_COOKIE_SECURE=false  # true in production
AUTH_TOKEN_EXPIRES_IN=3600  # 1 hour in seconds
BCRYPT_ROUNDS=11
```

### API Endpoints

#### `POST /api/auth/register`

Register a new user.

**Request:**

```json
{
  "email": "user@example.com",
  "password": "password123",
  "name": "User Name" // optional
}
```

**Response:**

```json
{
  "id": "user-uuid",
  "email": "user@example.com",
  "name": "User Name"
}
```

Creates a user account and automatically creates a default workspace with the user as owner. Sets an authentication cookie.

#### `POST /api/auth/login`

Login with email and password.

**Request:**

```json
{
  "email": "user@example.com",
  "password": "password123"
}
```

**Response:**

```json
{
  "id": "user-uuid",
  "email": "user@example.com",
  "name": "User Name"
}
```

Sets an authentication cookie.

#### `POST /api/auth/logout`

Logout the current user.

**Response:**

```json
{
  "ok": true
}
```

Clears the authentication cookie.

#### `GET /api/auth/me`

Get the current authenticated user.

**Response:**

```json
{
  "id": "user-uuid",
  "email": "user@example.com",
  "name": "User Name",
  "workspaces": [
    {
      "id": "workspace-uuid",
      "name": "Workspace Name",
      "role": "owner"
    }
  ]
}
```

Requires authentication (protected endpoint).

### Protected Endpoints

All board-related endpoints require authentication:

- `GET /api/boards` - List boards (filtered by user's workspaces)
- `POST /api/boards` - Create board (requires workspace access)
- `GET /api/boards/:boardId` - Get board (requires board access)
- `PATCH /api/boards/:boardId` - Update board metadata (requires owner/editor role)
- `PUT /api/boards/:boardId/nodes` - Update board structure (requires owner/editor role)
- `DELETE /api/boards/:boardId` - Delete board (requires owner role)

### Authorization

The system uses workspace-based authorization:

- Users can only access boards in workspaces where they have a role
- Roles: `owner`, `editor`, `viewer`
- `owner` can delete boards
- `owner` and `editor` can modify boards
- `viewer` can only read boards

## Frontend Implementation

### Auth Store

The frontend uses Zustand for auth state management (`apps/web/src/state/authStore.ts`):

```typescript
const { user, loading, error, initialized } = useAuthStore();
const login = useAuthStore((s) => s.login);
const register = useAuthStore((s) => s.register);
const logout = useAuthStore((s) => s.logout);
```

### Protected Routes

Pages are protected using the `RequireAuth` component:

```typescript
<RequireAuth>
  <YourPage />
</RequireAuth>
```

This component:

- Checks if the user is authenticated
- Redirects to `/login?redirectTo=/` if not authenticated
- Shows a loading state while checking authentication

### API Client

All API requests include `credentials: 'include'` to send cookies with requests.

## Security Considerations

1. **Passwords**: Hashed with bcrypt (11 rounds)
2. **Cookies**: HTTP-only, SameSite=Lax, Secure in production
3. **JWT**: Short-lived (1 hour), stored in HTTP-only cookies
4. **CORS**: Configured to allow credentials from landing and product origins
5. **Rate Limiting**: Applied to all endpoints (100 req/min)

## Production Deployment

1. Set `AUTH_COOKIE_SECURE=true` in production
2. Set a strong `JWT_SECRET` (use a secure random string)
3. Ensure HTTPS is enabled (required for secure cookies)
4. Configure `AUTH_COOKIE_DOMAIN` if needed for cross-subdomain cookies

## Future Enhancements

- Refresh tokens for longer sessions
- Password reset functionality
- Email verification
- Two-factor authentication
- OAuth providers (Google, GitHub, etc.)
