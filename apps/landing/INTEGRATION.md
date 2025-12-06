# Workyy Landing Integration Guide

This landing page is integrated with the Workyy Product application.

## Configuration

### Environment Variables

Create a `.env` file in the project root:

```bash
# URL of the Workyy Product application (Next.js)
# In production with Nginx: https://workyy.example.com/app
# In development: http://localhost:3000
VITE_PRODUCT_APP_URL=http://localhost:3000

# URL of the Workyy backend API (Fastify)
# In production with Nginx: https://workyy.example.com
# In development: http://localhost:4000
VITE_API_URL=http://localhost:4000
```

### Navigation Links

The landing page automatically routes to the product application:

- **Log in** → `${VITE_PRODUCT_APP_URL}/login`
- **Sign up** → `${VITE_PRODUCT_APP_URL}/signup`
- **Start for free** → `${VITE_PRODUCT_APP_URL}/signup`
- **Try demo** → `${VITE_PRODUCT_APP_URL}/board/demo`

These URLs are configured in `src/config/appConfig.ts`.

## Development

```bash
# Install dependencies
pnpm install

# Start dev server
pnpm dev

# Build for production
pnpm build
```

## Integration Points

### Header Navigation

The header (`src/components/Header.tsx`) includes:

- Logo linking to landing home
- Navigation menu (Product, Use Cases, Pricing, Resources)
- Language toggle (EN/RU)
- **Log in** button → Product login page
- **Sign up** button → Product signup page

### HomePage CTAs

The hero section (`src/pages/HomePage.tsx`) includes:

- **Start for free** → Product signup
- **Book a demo** → Product demo board

### API Client

The `src/lib/apiClient.ts` file provides:

- `postDemoSignup()` - Submit demo signup (future)
- `checkBackendHealth()` - Verify backend connectivity

## Production Deployment

1. Set environment variables in `.env`
2. Build: `pnpm build`
3. Copy `dist/` to server at `/var/www/workyy-landing/dist`
4. Configure Nginx to serve from this directory (see `workyy-4.0-stable/infra/nginx.conf`)

## Notes

- All product links use external URLs (not React Router) to ensure proper navigation
- Language toggle does not affect product URLs (they are language-agnostic)
- The landing page can make API calls to the backend if CORS is configured correctly
