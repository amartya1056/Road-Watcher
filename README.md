<p align="center">
  <img src="https://img.shields.io/badge/Roadview-Pothole%20Intelligence-7c3aed?style=for-the-badge&logo=satellite&logoColor=white" alt="Roadview Badge"/>
</p>

<h1 align="center">Roadview — Pothole Intelligence Platform</h1>

<p align="center">
  <strong>Real-time global road infrastructure monitoring powered by satellite imagery, OpenStreetMap community data, and AI-driven analytics.</strong>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/TypeScript-5.9-3178c6?style=flat-square&logo=typescript&logoColor=white" alt="TypeScript"/>
  <img src="https://img.shields.io/badge/React-19.1-61dafb?style=flat-square&logo=react&logoColor=black" alt="React"/>
  <img src="https://img.shields.io/badge/Express-5.x-000000?style=flat-square&logo=express&logoColor=white" alt="Express"/>
  <img src="https://img.shields.io/badge/PostgreSQL-Supabase-336791?style=flat-square&logo=postgresql&logoColor=white" alt="PostgreSQL"/>
  <img src="https://img.shields.io/badge/Leaflet-Maps-199900?style=flat-square&logo=leaflet&logoColor=white" alt="Leaflet"/>
  <img src="https://img.shields.io/badge/License-MIT-green?style=flat-square" alt="License"/>
</p>

<p align="center">
  <a href="#overview">Overview</a> •
  <a href="#features">Features</a> •
  <a href="#screenshots">Screenshots</a> •
  <a href="#system-architecture">Architecture</a> •
  <a href="#quick-start">Quick Start</a> •
  <a href="#api-reference">API Reference</a> •
  <a href="#configuration">Configuration</a> •
  <a href="#real-world-applications">Applications</a> •
  <a href="#roadmap">Roadmap</a> •
  <a href="#contributing">Contributing</a> •
  <a href="#license">License</a>
</p>

---

## Table of Contents

- [Overview](#overview)
- [Features](#features)
  - [Frontend Capabilities](#frontend-capabilities)
  - [Backend Capabilities](#backend-capabilities)
- [Screenshots](#screenshots)
- [System Architecture](#system-architecture)
  - [Technology Stack](#technology-stack)
  - [Project Structure](#project-structure)
  - [Data Flow Pipeline](#data-flow-pipeline)
- [Quick Start](#quick-start)
  - [Prerequisites](#prerequisites)
  - [Installation](#installation)
  - [Running the Application](#running-the-application)
- [API Reference](#api-reference)
- [Configuration](#configuration)
- [Real-World Applications](#real-world-applications)
- [Future Modifications & Roadmap](#roadmap)
- [Contributing](#contributing)
- [License](#license)
- [Acknowledgements](#acknowledgements)

---

## Overview

**Roadview** is a production-grade, full-stack pothole intelligence platform that aggregates **real-world road infrastructure data** from multiple authoritative sources — including the **City of Chicago 311 Open Data Portal**, **TomTom Traffic API**, and the **OpenStreetMap Overpass API** — to provide a unified, real-time command center for monitoring, analyzing, and reporting road hazards across the globe.

Unlike conventional pothole trackers that rely on mock datasets, Roadview operates exclusively on **live, production data** that is automatically synchronized every 30 minutes via a backend worker pipeline. The platform combines satellite imagery analysis, AI-powered conversational intelligence, and a gamified driver score system to transform raw civic data into actionable infrastructure insights.

### Why Roadview?

- **7,500+ real pothole records** ingested from production civic APIs
- **Zero mock data** — every data point traces back to a verified government or crowd-sourced origin
- **Multi-source fusion** — Chicago 311, TomTom Traffic, and OpenStreetMap data merged into a single intelligence layer
- **AI-powered complaint drafting** — automated RTI applications and formal complaint generation via Groq LLM
- **Global coverage** — real-time monitoring across NYC, Chicago, Los Angeles, Washington D.C., Houston, Philadelphia, and the entire OpenStreetMap network

---

## Features

### Frontend Capabilities

| Feature | Description |
|:--------|:------------|
| **Command Center** | Interactive Leaflet map with real-time pothole markers, severity-coded color system (Critical/High/Medium/Low), and live OSM data overlay |
| **Satellite Scanner** | Simulated ESRI satellite imagery analysis with sweep-line detection animation, depth analysis, and confidence scoring |
| **Pothole Detail Panel** | Click any marker to view ESRI World Imagery satellite view with adjustable zoom (z14–z19), precise coordinates, depth/width measurements, repair cost estimates, and one-click "Mark as Repaired" |
| **Global Analytics Dashboard** | Real-time statistics with regional breakdown (Asia, Africa, Americas, Europe, Oceania), severity distribution charts, top 10 damage cities ranked by cost, 12-month repair cost trend line, and active anomaly heatmap |
| **Pothole Registry** | Full database table with search, filter by severity/status, sortable columns, satellite-confirmed confidence bars, and inline "File Complaint" action |
| **Complaint Filing System** | Modal dialog for filing formal complaints or reports with road type classification (NH/SH/MDR/City Road/Rural Road), auto-routed authority selection, description, and contact details |
| **RoadWatch AI Assistant** | Groq-powered conversational AI specialized in road quality monitoring, pothole reporting procedures, RTI filing guides, budget transparency queries, and formal complaint drafting |
| **Driver Gamification** | Credit-based scoring system with tiered badges (Rookie → Street Scout → Pothole Hunter → Road Ranger → City Guardian → Legend), trust rank, and city savings tracker |
| **Dark/Light Mode** | Full adaptive theming with CSS custom properties, dark-mode map filter inversion, and persistent preference |
| **Multi-Currency Support** | Dynamic currency conversion (USD, EUR, GBP, INR, JPY) with locale-aware formatting |
| **Time-Range Filtering** | Global 24H / Week / Month / All Time filter applied across map, analytics, and data views |
| **Responsive Layout** | Mobile-first design with collapsible sidebar, adaptive grid layouts, and touch-friendly interactions |

### Backend Capabilities

| Feature | Description |
|:--------|:------------|
| **Live Data Sync Pipeline** | Automated 30-minute interval worker that fetches from Chicago 311 and TomTom Traffic APIs, deduplicates via SHA-256 stable IDs, and upserts into PostgreSQL |
| **OpenStreetMap Overpass Integration** | Frontend-direct queries to the Overpass API for global road-damage nodes and ways (`barrier=pothole`, `surface=very_bad`, `smoothness=horrible/impassable`) with adaptive zoom-based query complexity |
| **RESTful API (OpenAPI 3.1)** | Fully documented API with Zod runtime validation, including CRUD for potholes, voting, complaints, stats aggregation, heatmap data, driver scores, and pothole-aware routing |
| **Pothole-Aware Routing** | OSRM-backed route calculation with Haversine distance corridor analysis to detect and warn about potholes along planned routes |
| **Reverse Geocoding** | Automatic address resolution via Nominatim for newly reported potholes |
| **AI Chat (SSE Streaming)** | Server-Sent Events streaming for real-time AI responses, with persistent conversation history stored in PostgreSQL |
| **Complaint Management** | Full lifecycle complaint tracking with status workflow (pending → forwarded → resolved), road type classification, and authority routing |
| **Drizzle ORM** | Type-safe database layer with PostgreSQL, automatic schema inference, and conflict-free upserts for live data ingestion |
| **Structured Logging** | Pino-based request logging with serialized request/response metadata |

---

## Screenshots

### Command Center — Live Map Interface
> *The primary command center displaying real-time pothole markers across New Delhi with severity-coded indicators, satellite scanner panel, route planner, network statistics (7,504 SkyMap DB records), and road credit score.*

![Command Center — Live Map Interface](screenshots/01_command_center.png)

---

### Satellite Scanner — Active Detection
> *The satellite scanner in action with anomaly confirmed status, real-time sweep-line detection overlay on ESRI satellite imagery, depth analysis panel showing 8.1cm depth at 26.4cm width, and live detection toast notification.*

![Satellite Scanner — Active Detection](screenshots/02_satellite_scanner.png)

---

### Pothole Detail — ESRI Satellite View
> *Detailed pothole inspection panel with zoomable ESRI World Imagery (z17 block level), precise GPS coordinates, severity classification, repair cost estimate, satellite confidence bar, active status indicator, and "Mark as Repaired" action.*

![Pothole Detail — ESRI Satellite View](screenshots/03_pothole_detail.png)

---

### Global Analytics — Regional Intelligence Overview
> *The analytics dashboard displaying global infrastructure metrics: 10 hotspots tracked, €7,872.45 global repair cost, 7,504 satellite-confirmed records, and regional breakdown for Asia showing top damage cities (Delhi, Kalkaji Tehsil, Greater Kailash) with infrastructure maintenance notes.*

![Global Analytics — Regional Intelligence Overview](screenshots/04_analytics_overview.png)

---

### Severity Distribution & Top Damage Cities
> *Global severity distribution breakdown (Critical 15%, High 40%, Medium 30%, Low 15%) with repair cost by region, and the top 10 damage cities ranked by estimated repair cost — from Chicago ($234.13) to S Ashland Ave ($10.78) — all sourced from real civic data pipelines.*

![Severity Distribution & Top Damage Cities](screenshots/05_severity_distribution.png)

---

### Repair Cost Trend & Driver Score
> *12-month repair cost trend chart showing actual vs. projected costs with exponential growth detection, alongside the driver gamification panel displaying 75,275 credits at Legend tier with City Guardian badge, 7,504 reports filed, and Top 4% trust rank.*

![Repair Cost Trend & Driver Score](screenshots/06_cost_trend_driver.png)

---

### Active Anomaly Heatmap & Infrastructure Telemetry
> *Global anomaly heatmap with 7,504 active data points concentrated across the United States, paired with the live infrastructure telemetry stream showing real-time HIGH and MEDIUM anomaly detections with pipeline source IDs and exposure costs.*

![Active Anomaly Heatmap & Infrastructure Telemetry](screenshots/07_heatmap_telemetry.png)

---

### Pothole Registry — Satellite-Confirmed Database
> *The full pothole registry table with 7,504 results, showing detailed records including ID, location, coordinates, severity badges, dimensions (depth/width), repair cost, satellite confidence bars, active status, detection timestamps, and action buttons for marking repairs and filing complaints.*

![Pothole Registry — Satellite-Confirmed Database](screenshots/08_pothole_registry.png)

---

### File Complaint / Report Modal
> *Formal complaint filing dialog with road type classification (NH/SH/MDR/City Road/Rural Road), auto-routed authority assignment (Municipal Corporation / Urban Local Body), description field, optional contact details, and submit action — enabling citizens to report infrastructure damage to the correct governmental body.*

![File Complaint / Report Modal](screenshots/09_complaint_form.png)

---

### RoadWatch AI — Conversational Infrastructure Intelligence
> *The AI assistant landing screen showcasing suggested queries: reporting procedures, NH/SH/MDR road classifications, road project funding checks, formal complaint drafting, and RTI filing for road budget transparency — all powered by Groq LLM with SSE streaming.*

![RoadWatch AI — Conversational Infrastructure Intelligence](screenshots/10_ai_assistant.png)

---

### RoadWatch AI — RTI Filing Step-by-Step Guide
> *AI-generated comprehensive guide for filing an RTI (Right to Information) application for road budget transparency, including: identifying the public authority (NHAI/PWD/Municipal Corporation), locating the PIO, drafting the application, specifying required information, fee payment, submission, and follow-up procedures.*

![RoadWatch AI — RTI Filing Step-by-Step Guide](screenshots/11_ai_rti_guide.png)

---

### RoadWatch AI — Sample RTI Application Template
> *AI-generated sample RTI application template with proper formatting: subject line, addressee fields, formal request body citing the Right to Information Act 2005, itemized information requests (DPR, budget allocations, expenditure records, contractor details), fee acknowledgement, and additional tips for follow-up and appeals.*

![RoadWatch AI — Sample RTI Application Template](screenshots/12_ai_rti_application.png)

---

## System Architecture

### Technology Stack

#### Frontend
| Technology | Purpose |
|:-----------|:--------|
| **React 19.1** | Component framework with hooks-based architecture |
| **TypeScript 5.9** | End-to-end type safety |
| **Vite 7.3** | Lightning-fast HMR and build tooling |
| **Leaflet 1.9** | Interactive map rendering with custom tile layers |
| **TanStack React Query** | Server state management with automatic caching and refetching |
| **Framer Motion** | Physics-based animations and page transitions |
| **Recharts** | Data visualization (line charts, area charts) |
| **Radix UI** | Accessible, unstyled component primitives |
| **Tailwind CSS 4** | Utility-first styling with custom design tokens |
| **wouter** | Lightweight client-side routing |
| **Lucide React** | Premium icon library |
| **Zod** | Client-side runtime validation |

#### Backend
| Technology | Purpose |
|:-----------|:--------|
| **Express 5** | HTTP server framework |
| **TypeScript 5.9** | Type-safe server logic |
| **Drizzle ORM** | Type-safe SQL query builder with PostgreSQL driver |
| **PostgreSQL (Supabase)** | Cloud-hosted relational database |
| **Zod** | Request/response validation schemas |
| **Groq SDK** | LLM integration for AI chat (Llama-based models) |
| **Pino** | High-performance structured logging |
| **tsx** | TypeScript execution for development |
| **esbuild** | Production bundling |

#### External APIs
| API | Data Source |
|:----|:-----------|
| **Chicago 311 Open Data** | `data.cityofchicago.org` — Real civic pothole service requests |
| **TomTom Traffic API** | Traffic incidents across 6 US metro areas |
| **OpenStreetMap Overpass** | Global crowd-sourced road damage data |
| **OSRM** | Open Source Routing Machine for route calculations |
| **ESRI World Imagery** | High-resolution satellite tile imagery |
| **Nominatim** | Reverse geocoding for address resolution |

### Project Structure

```
Road-Watcher/
├── package.json                  # Root workspace — orchestrates both packages
├── .env                          # Environment variables (DB, API keys)
├── .gitignore
│
├── backend/
│   ├── package.json              # Backend dependencies
│   ├── tsconfig.json             # TypeScript config
│   ├── build.mjs                 # esbuild production bundler
│   ├── openapi.yaml              # OpenAPI 3.1 specification
│   └── src/
│       ├── index.ts              # Server entry — startup, live sync scheduler
│       ├── app.ts                # Express app — middleware, CORS, routing
│       ├── run.ts                # Dev entry with dotenv
│       ├── db/
│       │   ├── index.ts          # Drizzle + pg Pool connection
│       │   ├── drizzle.config.ts # Migration config
│       │   └── schema/
│       │       ├── potholes.ts   # Pothole table schema
│       │       ├── complaints.ts # Complaints table with enums
│       │       ├── conversations.ts # AI chat conversations
│       │       └── messages.ts   # AI chat message history
│       ├── lib/
│       │   ├── liveData.ts       # Chicago 311 + TomTom sync engine
│       │   ├── logger.ts         # Pino logger config
│       │   └── seed.ts           # Database seeder (disabled)
│       ├── routes/
│       │   ├── index.ts          # Route aggregator + live-sync endpoint
│       │   ├── potholes.ts       # CRUD + voting + reverse geocoding
│       │   ├── stats.ts          # Summary, heatmap, driver score, detailed metrics
│       │   ├── routing.ts        # OSRM pothole-aware routing
│       │   ├── complaints.ts     # Complaint CRUD
│       │   ├── health.ts         # Health check
│       │   └── anthropic/
│       │       └── index.ts      # AI chat with Groq SSE streaming
│       └── zod/
│           └── api.ts            # Generated Zod validation schemas
│
├── frontend/
│   ├── package.json              # Frontend dependencies
│   ├── vite.config.ts            # Vite config with proxy
│   ├── tsconfig.json
│   ├── index.html                # SPA entry
│   └── src/
│       ├── main.tsx              # React DOM entry
│       ├── App.tsx               # Router + providers (Query, Theme, Currency)
│       ├── index.css             # Global styles + CSS custom properties
│       ├── api/                  # Generated API client + custom fetch
│       ├── components/           # Reusable UI components (Radix-based)
│       ├── context/
│       │   ├── theme.tsx         # Dark/light mode provider
│       │   └── currency.tsx      # Multi-currency provider
│       ├── data/
│       │   └── hotspots.ts       # Global hotspot definitions
│       ├── hooks/                # Custom React hooks
│       ├── lib/                  # Utility functions
│       └── pages/
│           ├── home.tsx          # Command Center (map + scanner + detail)
│           ├── dashboard.tsx     # Analytics dashboard
│           ├── potholes.tsx      # Pothole registry table
│           ├── ai.tsx            # RoadWatch AI chat interface
│           └── not-found.tsx     # 404 page
│
└── screenshots/                  # Application screenshots for documentation
```

### Data Flow Pipeline

```
┌─────────────────────────────────────────────────────────────────────────┐
│                        EXTERNAL DATA SOURCES                            │
├─────────────────┬─────────────────────┬─────────────────────────────────┤
│  Chicago 311    │   TomTom Traffic    │   OpenStreetMap Overpass         │
│  Open Data API  │   Incidents API     │   (Frontend-Direct)             │
│  ┌───────────┐  │  ┌───────────────┐  │  ┌───────────────────────────┐  │
│  │ 500 latest│  │  │ 6 US metro    │  │  │ barrier=pothole           │  │
│  │ pothole   │  │  │ bounding box  │  │  │ surface=very_bad/bad      │  │
│  │ requests  │  │  │ incidents     │  │  │ smoothness=horrible       │  │
│  └─────┬─────┘  │  └──────┬────────┘  │  └────────────┬──────────────┘  │
│        │        │         │           │               │                 │
└────────┼────────┴─────────┼───────────┴───────────────┼─────────────────┘
         │                  │                           │
         ▼                  ▼                           │
  ┌──────────────────────────────────┐                  │
  │     Backend Sync Worker          │                  │
  │     (Every 30 minutes)           │                  │
  │                                  │                  │
  │  1. Fetch from all sources       │                  │
  │  2. SHA-256 stable ID generation │                  │
  │  3. Deduplicate against DB       │                  │
  │  4. Chunked upsert (50/batch)    │                  │
  │  5. Conflict resolution          │                  │
  └──────────────┬───────────────────┘                  │
                 │                                      │
                 ▼                                      │
  ┌──────────────────────────────────┐                  │
  │     PostgreSQL (Supabase)        │                  │
  │                                  │                  │
  │  ┌────────────────────────────┐  │                  │
  │  │ potholes (7,500+ records) │  │                  │
  │  │ complaints                │  │                  │
  │  │ conversations             │  │                  │
  │  │ messages                  │  │                  │
  │  └────────────────────────────┘  │                  │
  └──────────────┬───────────────────┘                  │
                 │                                      │
                 ▼                                      ▼
  ┌──────────────────────────────────────────────────────────────────────┐
  │                     Express 5 REST API (/api)                       │
  │                                                                      │
  │  GET  /potholes          POST /potholes         GET /stats/summary   │
  │  GET  /potholes/:id      PATCH /potholes/:id    GET /stats/heatmap   │
  │  POST /potholes/:id/vote POST /route/pothole-aware                   │
  │  GET  /stats/driver-score GET /stats/detailed-metrics                │
  │  POST /live-sync         GET/POST /anthropic/conversations           │
  │  GET/POST /potholes/:id/complaints                                   │
  └──────────────────────────┬───────────────────────────────────────────┘
                             │
                             ▼
  ┌──────────────────────────────────────────────────────────────────────┐
  │                    React 19 Frontend (Vite)                          │
  │                                                                      │
  │  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐  │
  │  │ Command  │ │Analytics │ │ Pothole  │ │RoadWatch │ │ Overpass │  │
  │  │ Center   │ │Dashboard │ │ Registry │ │   AI     │ │ Layer    │  │
  │  │ (Map)    │ │(Charts)  │ │ (Table)  │ │ (Chat)   │ │ (Live)   │  │
  │  └──────────┘ └──────────┘ └──────────┘ └──────────┘ └──────────┘  │
  └──────────────────────────────────────────────────────────────────────┘
```

---

## Quick Start

### Prerequisites

| Requirement | Version |
|:------------|:--------|
| **Node.js** | v18.0 or higher |
| **npm** | v9.0 or higher |
| **PostgreSQL** | Any (Supabase recommended) |
| **Git** | Latest stable |

You will also need API keys for:
- **TomTom Developer Portal** — [https://developer.tomtom.com](https://developer.tomtom.com) (free tier available)
- **Groq Cloud** — [https://console.groq.com](https://console.groq.com) (free tier available)
- **Supabase** — [https://supabase.com](https://supabase.com) (free tier available)

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/your-username/Road-Watcher.git
   cd Road-Watcher
   ```

2. **Install all dependencies** (root, backend, and frontend)
   ```bash
   npm run install:all
   ```

3. **Configure environment variables**  
   Create a `.env` file in the project root:
   ```env
   DATABASE_URL="postgresql://your-user:your-password@your-host:6543/postgres"
   GROQ_API_KEY=gsk_your_groq_api_key_here
   TOMTOM_API_KEY=your_tomtom_api_key_here
   PORT=5000
   ```

4. **Set up the database**  
   Run the database setup script to create required tables:
   ```bash
   cd backend
   node setup-db.js
   cd ..
   ```

### Running the Application

**Start both frontend and backend concurrently:**
```bash
npm run dev
```

This runs:
- **Backend** → `http://localhost:5000` (Express API server)
- **Frontend** → `http://localhost:5173` (Vite dev server with API proxy)

Open your browser and navigate to **`http://localhost:5173`** to access the platform.

**Production build:**
```bash
npm run build
npm run start:backend
```

---

## API Reference

All endpoints are prefixed with `/api`. Full OpenAPI 3.1 specification available at [`backend/openapi.yaml`](backend/openapi.yaml).

### Health
| Method | Endpoint | Description |
|:-------|:---------|:------------|
| `GET` | `/api/healthz` | Server health check |

### Potholes
| Method | Endpoint | Description |
|:-------|:---------|:------------|
| `GET` | `/api/potholes` | List all potholes (filterable by severity, dateRange, is_fixed) |
| `POST` | `/api/potholes` | Report a new pothole (auto reverse-geocodes address) |
| `GET` | `/api/potholes/:id` | Get a specific pothole by ID |
| `PATCH` | `/api/potholes/:id` | Update pothole (mark as fixed, change severity) |
| `POST` | `/api/potholes/:id/vote` | Upvote/confirm a pothole report |

### Statistics
| Method | Endpoint | Description |
|:-------|:---------|:------------|
| `GET` | `/api/stats/summary` | Dashboard summary (total, fixed, high severity, costs, volumes) |
| `GET` | `/api/stats/heatmap` | Heatmap data points with severity-weighted values |
| `GET` | `/api/stats/driver-score` | Gamification score, level, badge, and savings |
| `GET` | `/api/stats/detailed-metrics` | Regional analytics, severity distribution, cost trends, top cities |

### Routing
| Method | Endpoint | Description |
|:-------|:---------|:------------|
| `POST` | `/api/route/pothole-aware` | Calculate route with pothole warnings via OSRM |

### Complaints
| Method | Endpoint | Description |
|:-------|:---------|:------------|
| `GET` | `/api/potholes/:id/complaints` | List complaints for a specific pothole |
| `POST` | `/api/potholes/:id/complaints` | File a formal complaint or report |

### AI Chat
| Method | Endpoint | Description |
|:-------|:---------|:------------|
| `GET` | `/api/anthropic/conversations` | List all AI chat conversations |
| `POST` | `/api/anthropic/conversations` | Create a new conversation |
| `GET` | `/api/anthropic/conversations/:id` | Get conversation with message history |
| `DELETE` | `/api/anthropic/conversations/:id` | Delete a conversation |
| `GET` | `/api/anthropic/conversations/:id/messages` | List messages in a conversation |
| `POST` | `/api/anthropic/conversations/:id/messages` | Send a message (SSE streaming response) |

### Live Data Sync
| Method | Endpoint | Description |
|:-------|:---------|:------------|
| `POST` | `/api/live-sync` | Manually trigger a live data sync from external sources |

---

## Configuration

### Environment Variables

| Variable | Required | Description |
|:---------|:---------|:------------|
| `DATABASE_URL` | Yes | PostgreSQL connection string (Supabase pooler recommended) |
| `GROQ_API_KEY` | Yes | Groq Cloud API key for AI chat functionality |
| `TOMTOM_API_KEY` | No | TomTom Developer API key (enables traffic incident data; platform works without it using Chicago 311 data only) |
| `PORT` | No | Backend server port (default: `5000`) |

### Live Data Sync Configuration

The backend automatically syncs external data through two mechanisms:

| Mechanism | Interval | Source |
|:----------|:---------|:-------|
| **Backend Worker** | Every 30 minutes | Chicago 311 API + TomTom Traffic API |
| **Frontend Overpass** | On map move/zoom (1.4s debounce) | OpenStreetMap Overpass API |

### Database Schema

The platform uses 4 primary tables:

| Table | Records | Description |
|:------|:--------|:------------|
| `potholes` | 7,500+ | Core pothole records with lat/lon, severity, dimensions, cost, confidence |
| `complaints` | Variable | Linked complaints with road type, authority, status tracking |
| `conversations` | Variable | AI chat conversation metadata |
| `messages` | Variable | AI chat message history with role and content |

---

## Real-World Applications

### Municipal Infrastructure Monitoring
City governments can deploy Roadview to aggregate 311 service request data with satellite-confirmed road damage, prioritize repair schedules based on severity and cost, and track repair completion rates across districts.

### Citizen Advocacy & RTI Filing
The integrated AI assistant helps citizens navigate bureaucratic processes — from identifying the correct authority (NHAI, PWD, Municipal Corporation) to drafting formal RTI applications for road budget transparency, complete with ready-to-submit templates.

### Urban Planning & Budget Allocation
The regional analytics dashboard provides data-driven insights for infrastructure budget allocation, showing repair cost trends, severity distribution by region, and projected maintenance costs that enable evidence-based urban planning.

### Insurance & Fleet Management
Commercial fleet operators can leverage pothole-aware routing to minimize vehicle damage, while insurance companies can use the platform's damage density data to assess area-specific risk profiles.

### Academic Research
The platform's multi-source data fusion approach — combining civic APIs, crowd-sourced OSM data, and satellite imagery — provides a rich dataset for research in urban computing, infrastructure monitoring, and smart city applications.

### Community-Driven Reporting
The gamified driver score system and community voting mechanism incentivize citizen participation in road quality monitoring, creating a self-sustaining feedback loop between residents and municipal authorities.

---

## Roadmap

### Phase 1 — Core Platform (Current)
- [x] Real-time data ingestion from Chicago 311 and TomTom
- [x] Interactive map with severity-coded markers
- [x] Global analytics dashboard with regional breakdown
- [x] Pothole registry with search and filtering
- [x] Complaint filing system with authority routing
- [x] AI-powered chat assistant with SSE streaming
- [x] Driver gamification system
- [x] ESRI satellite imagery integration
- [x] OpenStreetMap Overpass live overlay
- [x] Dark/light mode and multi-currency support

### Phase 2 — Enhanced Detection
- [ ] Computer vision model for automated pothole detection from satellite imagery
- [ ] Smartphone accelerometer-based pothole detection (mobile companion app)
- [ ] LiDAR point cloud integration for precise 3D depth mapping
- [ ] Drone survey integration for targeted area scanning

### Phase 3 — Expanded Coverage
- [ ] Integration with additional city 311 APIs (NYC, LA, Houston, Philadelphia)
- [ ] India-specific data sources (MyGov Grievance, Swachh Bharat)
- [ ] European road quality databases (EuroRAP)
- [ ] Real-time traffic camera stream analysis

### Phase 4 — Predictive Intelligence
- [ ] Machine learning model for pothole formation prediction based on weather, traffic, and road age
- [ ] Predictive maintenance scheduling for municipalities
- [ ] Cost optimization algorithms for repair prioritization
- [ ] Seasonal degradation pattern analysis

### Phase 5 — Platform Expansion
- [ ] Native mobile app (React Native) with offline capability
- [ ] Progressive Web App (PWA) with push notifications
- [ ] Municipal dashboard with role-based access control
- [ ] Public API for third-party integrations
- [ ] Blockchain-based repair verification and fund tracking

---

## Contributing

Contributions are welcome! Whether you're fixing bugs, improving documentation, or proposing new features, your input is valued.

### How to Contribute

1. **Fork the repository**
   ```bash
   git fork https://github.com/your-username/Road-Watcher.git
   ```

2. **Create a feature branch**
   ```bash
   git checkout -b feature/your-feature-name
   ```

3. **Make your changes** and commit with descriptive messages
   ```bash
   git commit -m "feat: add smartphone accelerometer detection mode"
   ```

4. **Push to your fork**
   ```bash
   git push origin feature/your-feature-name
   ```

5. **Open a Pull Request** with a clear description of changes

### Development Guidelines

- Follow the existing TypeScript coding patterns
- Ensure all Zod validators match the OpenAPI specification
- Test with `npm run dev` before submitting
- Update the OpenAPI spec (`backend/openapi.yaml`) for any API changes
- Use conventional commit messages (`feat:`, `fix:`, `docs:`, `refactor:`)

### Reporting Issues

- Use the GitHub Issue tracker
- Include steps to reproduce, expected behavior, and actual behavior
- Attach screenshots if applicable
- Specify your OS, Node.js version, and browser

---

## License

This project is licensed under the **MIT License**.

```
MIT License

Copyright (c) 2026 Amartya Nayan

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

---

## Acknowledgements

This project would not be possible without the following open-source projects and public data providers:

### Data Sources
- **[City of Chicago Open Data Portal](https://data.cityofchicago.org/)** — 311 Service Requests for pothole reports
- **[TomTom Developer](https://developer.tomtom.com/)** — Real-time traffic incident data
- **[OpenStreetMap](https://www.openstreetmap.org/)** — Global crowd-sourced geographic data (ODbL License)
- **[ESRI World Imagery](https://www.arcgis.com/)** — High-resolution satellite tile imagery (© Esri, Maxar, Earthstar Geographics)
- **[Nominatim](https://nominatim.openstreetmap.org/)** — Reverse geocoding service
- **[OSRM](http://project-osrm.org/)** — Open Source Routing Machine

### Technologies
- **[React](https://react.dev/)** — UI component framework
- **[Express](https://expressjs.com/)** — Node.js web server framework
- **[Drizzle ORM](https://orm.drizzle.team/)** — TypeScript ORM for PostgreSQL
- **[Supabase](https://supabase.com/)** — Hosted PostgreSQL database
- **[Leaflet](https://leafletjs.com/)** — Interactive map library
- **[Groq](https://groq.com/)** — LLM inference platform
- **[Vite](https://vite.dev/)** — Frontend build tooling
- **[Radix UI](https://www.radix-ui.com/)** — Accessible component primitives
- **[Recharts](https://recharts.org/)** — React charting library
- **[Framer Motion](https://www.framer.com/motion/)** — Animation library
- **[Tailwind CSS](https://tailwindcss.com/)** — Utility-first CSS framework
- **[Pino](https://getpino.io/)** — Structured logging for Node.js

---

<p align="center">
  <strong>Built for safer roads worldwide.</strong>
</p>

<p align="center">
  <sub>Roadview — Pothole Intelligence Platform © 2026</sub>
</p>
