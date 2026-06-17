# SentinelOps

An intelligent multi-drone monitoring, fleet management, and decision support platform built for coordinating drone operations across multiple locations.

![Status](https://img.shields.io/badge/status-active-success)
![React](https://img.shields.io/badge/React-19-blue)
![License](https://img.shields.io/badge/license-MIT-green)

---

## Overview

SentinelOps is an integrated drone management system that simulates and monitors multiple drone fleets operating across geographically distributed locations.

The platform provides real-time operational awareness, fleet management, and automated decision support capabilities for drone operators.

The system currently simulates operations across:

- Bangalore Base
- Mumbai Base
- Pune Forward Site

---

## Features

### Fleet Monitoring

- Real-time drone status tracking
- Multi-location operational view
- Mission lifecycle simulation
- Drone telemetry visualization

### Decision Support Engine

- Low battery detection
- Return-To-Base recommendations
- Signal loss detection
- Altitude violation alerts
- Geofence conflict detection

### Fleet Management

- Platform filtering
- Drone selection panel
- Mission assignment simulation
- Alert prioritization

### Tactical Visualization

- Interactive drone map
- Live drone movement
- Location-based segmentation
- Alert feed dashboard

---

## System Architecture

Drone Fleet Simulator

↓

Telemetry Engine

↓

Decision Support Rules Engine

↓

Alert Generation

↓

Operator Dashboard

---

## Technology Stack

### Frontend

- React
- JavaScript
- SVG Tactical Maps

### Future Backend Integrations

- FastAPI
- WebSockets
- PostgreSQL

### Future Drone Integrations

- MAVLink
- PX4
- ROS2

---

## Current Rule Engine

The system currently supports:

### Battery Monitoring

```text
Battery < 25%
↓
Recommend Return To Base
```

### Critical Battery

```text
Battery < 12%
↓
Immediate Return To Base
```

### Signal Loss Detection

```text
Communication Failure
↓
Critical Alert
```

### Separation Conflict Detection

```text
Distance < 150m
↓
Collision Warning
```

---

## Project Structure

src/

├── Dashboard

├── Fleet Simulator

├── Rule Engine

├── Tactical Map

├── Fleet Management

└── Alert System

---

## Future Improvements

- Real drone integration
- Weather-aware routing
- Autonomous mission assignment
- Predictive maintenance
- Swarm intelligence
- Edge computing integration

---

## Demo

This project currently runs entirely through a simulation engine and can later be connected to physical drone ecosystems.

---

## License

MIT

