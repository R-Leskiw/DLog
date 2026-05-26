# Project Specification: BuildTrack (Construction Log & Messaging)

## 1. Project Overview
A web-based dashboard for construction management. It bridges the gap between on-site employees and clients through transparent daily logs and real-time internal communication.

## 2. User Roles & Permissions
- **Employee:** - Full access to internal Group Chat.
  - Create, Edit, and View Daily Logs.
  - Upload jobsite images to logs.
- **Client:**
  - View Daily Logs (Read-only for main content).
  - Comment on Daily Logs for feedback.
  - No access to internal employee messaging.

## 3. Core Features (MVP)
- **Authentication:** Email/Password via Supabase Auth. Redirect users to specific dashboards based on role.
- **Daily Logs:** - Form fields: Date, Weather, Work Performed, Crew on Site, Issues/Delays.
  - Image Gallery: Support for multiple photo uploads per log.
- **Real-time Chat:** Internal messaging for employees using Supabase Realtime.
- **Database:** PostgreSQL (via Supabase) to store logs, comments, and messages.

## 4. Design & Aesthetic
- **Vibe:** Clean, modern, professional.
- **Typography:** 'Young Serif' for headings; clean Sans-serif (Inter) for body text.
- **Palette:** Primary Color: Yellow (#FACC15). Background: White/Light Gray (Light mode only).
- **Layout:** Mobile-first responsive design for field workers.

## 5. Technical Stack
- **Frontend:** Next.js (App Router), Tailwind CSS.
- **UI Components:** Shadcn UI.
- **Backend/DB:** Supabase (Auth, Database, Storage, Realtime).
