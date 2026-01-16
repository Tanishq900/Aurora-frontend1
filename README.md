# Aurora Sentinel Frontend

React + TypeScript frontend application.

## Setup

1. Install dependencies:
```bash
npm install
```

2. Configure environment:
```bash
cp .env.example .env
# Edit .env with your configuration
```

3. Start development server:
```bash
npm run dev
```

## Features

- Student Dashboard: SOS button, risk monitoring, history
- Security Command Center: Live alerts, detail view, history
- Real-time WebSocket updates
- Presentation Mode toggle
- Sensor access (audio + motion)

## Tech Stack

- React 18
- TypeScript
- Vite
- Tailwind CSS
- Zustand (state management)
- Socket.io Client
- Recharts (visualizations)
