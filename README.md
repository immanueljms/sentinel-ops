# SentinelOps

> Intelligent Multi-Drone Monitoring, Fleet Management, and Decision Support Platform.

SentinelOps is a React-based drone operations dashboard that simulates and monitors multiple drone fleets operating across geographically distributed locations.

The system provides real-time fleet awareness, mission tracking, and automated decision support capabilities for drone operators.

---

## Features

### Fleet Monitoring

* Real-time drone status tracking
* Multi-location fleet visualization
* Mission lifecycle simulation
* Interactive tactical dashboard

### Decision Support Engine

* Low battery detection
* Return-To-Base recommendations
* Signal loss detection
* Altitude violation alerts
* Geofence conflict detection

### Fleet Management

* Platform filtering
* Drone selection panel
* Mission assignment simulation
* Prioritized alert system

---

## Tech Stack

### Frontend

* React (Create React App)
* JavaScript
* SVG Tactical Maps
* CSS-in-JS

### Planned Integrations

* FastAPI
* PostgreSQL
* WebSockets
* MAVLink
* PX4
* ROS2

---

## Getting Started

### Prerequisites

Install:

* Node.js (v18+ recommended)
* npm

Verify installation:

```bash
node -v
npm -v
```

---

## Installation

Clone the repository:

```bash
git clone https://github.com/<your-username>/sentinel-ops.git
```

Navigate into the project:

```bash
cd sentinel-ops
```

Install dependencies:

```bash
npm install
```

Start the application:

```bash
npm start
```

The app will run at:

```text
http://localhost:3000
```

---

## Available Scripts

### Start development server

```bash
npm start
```

### Run tests

```bash
npm test
```

### Build for production

```bash
npm run build
```

### Eject configuration (irreversible)

```bash
npm run eject
```

---

## System Workflow

```text
Drone Fleet Simulator

↓

Telemetry Engine

↓

Decision Support Rules Engine

↓

Alert Generation

↓

Operator Dashboard
```

---

## Project Structure

```text
src/

├── Dashboard
├── Fleet Simulator
├── Rule Engine
├── Tactical Map
├── Fleet Management
└── Alert System
```

---

## Future Improvements

* Real drone integration
* Weather-aware routing
* Autonomous mission assignment
* Predictive maintenance
* Swarm intelligence
* Edge computing integration

---

## License

MIT


