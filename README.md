<div align="center">

# 🏢 HR Office Platform

[![Build](https://img.shields.io/github/actions/workflow/status/roma-frontend/hr-project/ci.yml?branch=main&label=CI%2FCD)](https://github.com/roma-frontend/hr-project/actions)
[![Coverage](https://img.shields.io/badge/coverage-80%25-brightgreen)]()
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-3178C6?logo=typescript&logoColor=white)]()
[![Next.js](https://img.shields.io/badge/Next.js-16-000000?logo=next.js&logoColor=white)]()
[![Convex](https://img.shields.io/badge/Convex-Real--time_DB-FF6F00)]()
[![License](https://img.shields.io/badge/license-MIT-blue)]()
[![Vercel](https://img.shields.io/badge/deployed_on-Vercel_(EU)-000000?logo=vercel&logoColor=white)](https://hr-project-sigma.vercel.app)

**All-in-One HR Management SaaS Platform**

[Live Demo](https://hr-project-sigma.vercel.app) · [Report Bug](https://github.com/roma-frontend/hr-project/issues) · [Request Feature](https://github.com/roma-frontend/hr-project/issues)

</div>

---

## 📋 Table of Contents

- [About](#-about)
- [Features](#-features)
- [Tech Stack](#-tech-stack)
- [Architecture](#-architecture)
- [Getting Started](#-getting-started)
- [Environment Variables](#-environment-variables)
- [Project Structure](#-project-structure)
- [Testing](#-testing)
- [Deployment](#-deployment)
- [Security](#-security)
- [Internationalization](#-internationalization)
- [API Reference](#-api-reference)
- [Contributing](#-contributing)
- [Roadmap](#-roadmap)
- [License](#-license)

---

## 🎯 About

**HR Office** is a comprehensive, enterprise-grade HR management platform that centralizes all HR operations into a single, real-time application. Built for organizations that need modern workforce management — from employee lifecycle and attendance tracking (with face recognition) to AI-powered analytics and Microsoft 365 integration.

### The Problem

HR processes are typically fragmented across multiple disconnected tools:
- Employee data scattered in spreadsheets and SharePoint lists
- Leave requests handled via email with no calendar visibility
- Attendance tracked manually — error-prone and time-consuming
- No centralized task management or real-time analytics

### The Solution

HR Office replaces all fragmented tools with a **unified platform** — zero manual data entry, single source of truth synced from SharePoint, and automated Outlook Calendar integration for approved leaves.

---

## ✨ Features

| Module | Description | Highlights |
|--------|-------------|------------|
| 👤 **Employee Lifecycle** | Full employee profile management | Documents, performance metrics, onboarding/offboarding |
| 🔐 **Face Recognition** | Biometric attendance check-in/out | Browser-based camera, daily logs, anomaly detection |
| 📅 **Leave Management** | End-to-end leave workflow | Multi-level approval, auto Outlook Calendar sync, entitlement rules |
| 📋 **Task Management** | Kanban board with drag-and-drop | Assignment, deadlines, progress tracking, notifications |
| 💬 **Team Chat** | Real-time messaging | File sharing, channels, direct messages |
| 🤖 **AI HR Assistant** | Conversational HR chatbot | Policy Q&A, smart insights, analytics queries |
| 🚗 **Driver Management** | Vehicle/driver booking system | Availability tracking, scheduling, route management |
| 📊 **AI Analytics** | Workforce intelligence dashboard | Headcount trends, leave patterns, attendance heatmaps |
| 🔗 **M365 Integration** | SharePoint + Outlook sync | Auto employee sync, calendar events for leave |
| 💳 **Multi-Tenant Billing** | Stripe subscription management | Plans, invoicing, usage tracking |

### Role-Based Access Control (5 Roles)

| Role | Permissions |
|------|------------|
| **Superadmin** | Full system access, tenant management, billing |
| **Admin** | Organization settings, user management, approvals |
| **Supervisor** | Team management, leave/task approvals, reports |
| **Employee** | Self-service: profile, leave requests, tasks, chat |
| **Driver** | Booking management, availability, schedule view |

---

## 🛠 Tech Stack

### Frontend
| Technology | Purpose |
|-----------|---------|
| [Next.js 16](https://nextjs.org/) | React framework (SSR/SSG/ISR) |
| [React 19](https://react.dev/) | UI library |
| [TypeScript 5.x](https://www.typescriptlang.org/) | Type safety |
| [Tailwind CSS](https://tailwindcss.com/) | Utility-first styling |
| [Shadcn/ui](https://ui.shadcn.com/) | Accessible component library |

### Backend & Database
| Technology | Purpose |
|-----------|---------|
| [Convex](https://www.convex.dev/) | Real-time database + serverless functions |
| [NextAuth.js v5](https://authjs.dev/) | Authentication framework |
| [Upstash Redis](https://upstash.com/) | Rate limiting & caching |

### Integrations
| Service | Purpose |
|---------|---------|
| [Microsoft Graph API](https://learn.microsoft.com/en-us/graph/) | SharePoint sync + Outlook Calendar |
| [Google Calendar API](https://developers.google.com/calendar) | Calendar sync (alternative) |
| [Stripe](https://stripe.com/) | Subscription billing |
| [Resend](https://resend.com/) | Transactional email |
| [Cloudinary](https://cloudinary.com/) | Media storage & optimization |
| [Sentry](https://sentry.io/) + [OpenTelemetry](https://opentelemetry.io/) | Error tracking & observability |

### DevOps
| Tool | Purpose |
|------|---------|
| [Vercel](https://vercel.com/) (EU, fra1) | Hosting & Edge Functions |
| [GitHub Actions](https://github.com/features/actions) | CI/CD pipeline |
| [Playwright](https://playwright.dev/) | E2E testing |
| [Jest](https://jestjs.io/) + [RTL](https://testing-library.com/) | Unit & integration testing |

---

## 🏗 Architecture

```mermaid
graph TB
    subgraph "Client Layer"
        A["Next.js 16 + React 19<br/>TypeScript + Tailwind"]
        B["Face Recognition<br/>MediaDevices API"]
    end

    subgraph "Auth Layer"
        C[NextAuth.js v5]
        C1[Azure AD OAuth 2.0]
        C2[Google OAuth]
        C3[TOTP 2FA]
        C4[WebAuthn Passkeys]
    end

    subgraph "Backend Layer"
        D["Convex<br/>Real-time DB + Functions"]
        E["Upstash Redis<br/>Rate Limiting + Cache"]
    end

    subgraph "Microsoft 365"
        F["SharePoint Lists<br/>Employee Data — Source of Truth"]
        G["Outlook Calendar<br/>Leave Events"]
        H[Microsoft Graph API]
    end

    subgraph "External Services"
        I["Stripe<br/>Billing"]
        J["Resend<br/>Email"]
        K["Cloudinary<br/>Media"]
        L["Google Calendar<br/>Sync"]
    end

    subgraph "Observability"
        M["Sentry<br/>Error Tracking"]
        N["OpenTelemetry<br/>Traces"]
        O["Vercel Analytics<br/>Performance"]
    end

    A --> C
    C --> C1 & C2 & C3 & C4
    A --> D
    A --> B
    D --> E
    D <-->|"Flow A: Employee Sync"| H
    D -->|"Flow B: Leave → Calendar"| H
    H --> F & G
    D --> I & J & K & L
    A --> M & N & O

    style A fill:#0070f3,color:#fff
    style D fill:#ff6f00,color:#fff
    style H fill:#0078d4,color:#fff
    style F fill:#217346,color:#fff
    style G fill:#0072c6,color:#fff
