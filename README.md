# 🏢 HR Office — All-in-One HR Management Platform

[![Next.js](https://img.shields.io/badge/Next.js-16-black?logo=next.js)](https://nextjs.org)
[![React](https://img.shields.io/badge/React-19-blue?logo=react)](https://react.dev)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-blue?logo=typescript)](https://typescriptlang.org)
[![Convex](https://img.shields.io/badge/Convex-Backend-orange)](https://convex.dev)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind-v4-38bdf8?logo=tailwindcss)](https://tailwindcss.com)

> Modern HR management platform with real-time attendance tracking, AI-powered analytics, leave management, task boards, face recognition check-in, and an intelligent HR assistant.

## ✨ Features

- 📊 **Dashboard** — Real-time overview of workforce metrics
- 👥 **Employee Management** — Full employee lifecycle management
- ⏰ **Attendance Tracking** — Face recognition check-in/out
- 🏖️ **Leave Management** — Request, approve, and track leaves
- 📋 **Task Management** — Kanban board with drag-and-drop
- 📈 **Analytics** — AI-powered performance insights
- 💬 **Real-time Chat** — Team messaging with file sharing
- 🤖 **AI Assistant** — Smart HR assistant powered by OpenAI/Groq
- 🔐 **Multi-role Access** — Admin, Supervisor, Employee roles
- 🌍 **i18n** — English, Russian, Armenian translations
- 🌗 **Dark/Light Mode** — Theme switching with next-themes
- 💳 **Stripe Billing** — Subscription management
- 📧 **Email Notifications** — Via Resend
- 🔒 **Security** — CSP headers, rate limiting, brute-force protection

## 🛠️ Tech Stack

| Layer | Technology |
|---|---|
| **Framework** | Next.js 16 (App Router, Turbopack) |
| **UI** | React 19, Tailwind CSS v4, Radix UI, shadcn/ui |
| **State** | Zustand, React Query |
| **Backend** | Convex (real-time database) |
| **Auth** | NextAuth.js + Custom JWT |
| **AI** | OpenAI, Groq, Google Generative AI |
| **Payments** | Stripe |
| **Email** | Resend |
| **Monitoring** | Sentry, OpenTelemetry |
| **Cache/Rate Limit** | Upstash Redis |
| **Maps** | Google Maps, Leaflet |
| **Animation** | Framer Motion |
| **Charts** | Recharts |

## 🚀 Quick Start

### Prerequisites

- **Node.js** ≥ 20
- **npm** ≥ 10
- **Convex CLI** — `npm install -g convex`

### Installation

```bash
# Clone the repository
git clone https://github.com/roma-frontend/hr-project.git
cd hr-project

# Install dependencies
npm install

# Copy environment variables
cp .env.example .env.local
# Fill in your API keys in .env.local

# Start Convex development server
npx convex dev

# In another terminal, start Next.js
npm run dev
```

### Available Scripts

| Command | Description |
|---|---|
| `npm run dev` | Start dev server (Turbopack) |
| `npm run build` | Production build |
| `npm run lint` | Run ESLint |
| `npm run lint:strict` | ESLint with zero warnings |
| `npm run type-check` | TypeScript type checking |
| `npm run format` | Format code with Prettier |
| `npm run test` | Run Jest tests |
| `npm run test:coverage` | Tests with coverage report |
| `npm run build:analyze` | Build with bundle analyzer |

## 📁 Project Structure

```
hr-project/
├── convex/              # Convex backend (schema, queries, mutations)
├── public/              # Static assets, face-api models
├── scripts/             # Utility scripts (Stripe, test data)
├── src/
│   ├── actions/         # Server actions
│   ├── app/
│   │   ├── (auth)/      # Login, Register pages
│   │   ├── (dashboard)/ # Protected dashboard pages
│   │   ├── api/         # API routes
│   │   └���─ ...          # Public pages
│   ├── components/      # Reusable UI components
│   ├── context/         # React contexts
│   ├── hooks/           # Custom React hooks
│   ├── i18n/            # Internationalization
│   ├── lib/             # Utilities, helpers
│   ├── store/           # Zustand stores
│   ├── styles/          # Additional styles
│   └── types/           # TypeScript types
├── .env.example         # Environment template
├── next.config.js       # Next.js configuration
├── tailwind.config.ts   # Tailwind configuration
└── tsconfig.json        # TypeScript configuration
```

## 🔒 Security

- **CSP Headers** — Comprehensive Content Security Policy
- **Rate Limiting** — Redis-backed request throttling
- **Brute Force Protection** — Login attempt limiting
- **DDoS Mitigation** — Automatic IP blocking
- **SQL/XSS Prevention** — Query parameter sanitization
- **HSTS** — Strict Transport Security with preload

## 📄 License

This project is private and proprietary.

## 👥 Team

Built with ❤️ by the HR Office team.