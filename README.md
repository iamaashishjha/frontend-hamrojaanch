# HamroJaanch — Frontend

React SPA for the HamroJaanch exam platform.

## Tech Stack

- React 18 + TypeScript + Vite (SWC)
- Tailwind CSS + shadcn/ui (Radix primitives)
- TanStack React Query + React Router DOM 6
- Recharts, react-markdown, Sonner, Lucide icons

## Quick Start

```bash
npm install
npm run dev
```

Opens at **http://localhost:8081**.

## Environment Variables

Copy `.env.example` to `.env`:

| Variable | Default | Purpose |
|----------|---------|---------|
| `VITE_API_BASE_URL` | _(empty = mock mode)_ | Backend API URL |
| `VITE_SERVING_URL` | `http://localhost:8081` | Frontend public serving origin |
| `VITE_SIGNALING_URL` | `ws://localhost:3001/ws` | WebSocket signaling |
| `VITE_SIGNALING_HTTP_URL` | `http://localhost:3001` | Token endpoint |
| `VITE_ICE_SERVERS` | Google STUN | STUN/TURN config |

**Mock mode:** When `VITE_API_BASE_URL` is empty, the app uses in-browser mock APIs with localStorage. No backend needed.

**Backend mode:** Set `VITE_API_BASE_URL=http://localhost:4000/api` to use the real backend.

## Commands

| Command | Description |
|---------|-------------|
| `npm run dev` | Start dev server (port 8081) |
| `npm run build` | Production build to `dist/` |
| `npm run preview` | Preview production build |
| `npm test` | Run tests (Vitest) |
| `npm run lint` | Run ESLint |

## Project Structure

```
frontend/
├── public/             Static assets (logo, favicon)
├── src/
│   ├── components/     UI components (admin, exam, shadcn/ui)
│   ├── data/           Mock seed data
│   ├── hooks/          Custom React hooks
│   ├── lib/            API modules, types, utilities
│   ├── pages/          All page components
│   │   └── admin/      Admin panel pages
│   ├── test/           Test setup
│   ├── App.tsx         Router + providers
│   └── main.tsx        Entry point
├── package.json
├── vite.config.ts
└── tailwind.config.ts
```
