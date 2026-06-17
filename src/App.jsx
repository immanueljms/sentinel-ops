import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';

// ---------------------------------------------------------------------------
// Design tokens
// ---------------------------------------------------------------------------
const COLORS = {
  bg: '#0A0E14',
  panel: '#101720',
  panelAlt: '#0D131B',
  border: '#1C2733',
  borderLight: '#26323F',
  teal: '#5EEAD4',
  tealDim: '#2DD4BF',
  amber: '#F59E0B',
  red: '#EF4444',
  slate: '#64748B',
  slateLight: '#94A3B8',
  white: '#E6EDF3',
};

const STATUS_COLOR = {
  idle: COLORS.slate,
  en_route: COLORS.teal,
  loitering: COLORS.tealDim,
  returning: COLORS.amber,
  landed: COLORS.slate,
  signal_lost: COLORS.red,
  offline: COLORS.red,
};

const STATUS_LABEL = {
  idle: 'IDLE',
  en_route: 'EN ROUTE',
  loitering: 'LOITERING',
  returning: 'RETURNING',
  landed: 'LANDED',
  signal_lost: 'SIGNAL LOST',
  offline: 'OFFLINE',
};

const PLATFORM_LABEL = {
  quadcopter: 'QUAD',
  fixed_wing: 'FIXED-WING',
  vtol: 'VTOL',
};

const SEVERITY_COLOR = {
  info: COLORS.teal,
  warning: COLORS.amber,
  critical: COLORS.red,
};

// ---------------------------------------------------------------------------
// Demo data generator — mirrors the backend's shape exactly, so swapping in
// a real WebSocket connection later is a drop-in change (see WS_URL below).
// ---------------------------------------------------------------------------
const LOCATIONS = [
  { id: 'blr', name: 'Bangalore Base', lat: 12.9716, lon: 77.5946 },
  { id: 'bom', name: 'Mumbai Base', lat: 19.0760, lon: 72.8777 },
  { id: 'pnq', name: 'Pune Forward Site', lat: 18.5204, lon: 73.8567 },
];

const FLEET_PLAN = [
  { id: 'sim-00', name: 'Falcon-01', platform: 'quadcopter', loc: 'blr' },
  { id: 'sim-01', name: 'Falcon-02', platform: 'quadcopter', loc: 'blr' },
  { id: 'sim-02', name: 'Kestrel-01', platform: 'fixed_wing', loc: 'blr' },
  { id: 'sim-03', name: 'Osprey-01', platform: 'vtol', loc: 'bom' },
  { id: 'sim-04', name: 'Osprey-02', platform: 'vtol', loc: 'bom' },
  { id: 'sim-05', name: 'Falcon-03', platform: 'quadcopter', loc: 'bom' },
  { id: 'sim-06', name: 'Kestrel-02', platform: 'fixed_wing', loc: 'pnq' },
  { id: 'sim-07', name: 'Falcon-04', platform: 'quadcopter', loc: 'pnq' },
  { id: 'sim-08', name: 'Osprey-03', platform: 'vtol', loc: 'pnq' },
  { id: 'sitl-01', name: 'Harrier-SITL', platform: 'quadcopter', loc: 'blr', source: 'sitl' },
];

function haversineKm(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

function bearingDeg(lat1, lon1, lat2, lon2) {
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const y = Math.sin(dLon) * Math.cos(lat2 * Math.PI / 180);
  const x = Math.cos(lat1 * Math.PI / 180) * Math.sin(lat2 * Math.PI / 180) -
            Math.sin(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.cos(dLon);
  return (Math.atan2(y, x) * 180 / Math.PI + 360) % 360;
}

function offsetLatLon(lat, lon, maxKm = 4) {
  const dKm = 0.5 + Math.random() * (maxKm - 0.5);
  const angle = Math.random() * 2 * Math.PI;
  const dlat = (dKm / 111) * Math.cos(angle);
  const dlon = (dKm / (111 * Math.cos(lat * Math.PI / 180))) * Math.sin(angle);
  return [lat + dlat, lon + dlon];
}

const CRUISE_ALT = { quadcopter: 60, fixed_wing: 150, vtol: 100 };
const CRUISE_SPEED = { quadcopter: 8, fixed_wing: 22, vtol: 15 };
const MIN_ALT = { quadcopter: 10, fixed_wing: 80, vtol: 50 };
const MAX_ALT = { quadcopter: 120, fixed_wing: 500, vtol: 300 };

function initFleet() {
  let missionCounter = 0;
  const drones = FLEET_PLAN.map((p) => {
    const loc = LOCATIONS.find((l) => l.id === p.loc);
    const [jlat, jlon] = offsetLatLon(loc.lat, loc.lon, 0.3);
    return {
      drone_id: p.id,
      name: p.name,
      platform_type: p.platform,
      location_id: p.loc,
      source: p.source || 'simulated',
      base_lat: jlat,
      base_lon: jlon,
      lat: jlat,
      lon: jlon,
      altitude_m: 0,
      heading_deg: 0,
      battery_pct: 60 + Math.random() * 40,
      status: 'idle',
      mission_id: null,
      target_lat: jlat,
      target_lon: jlon,
      stateTimer: 0,
      drainRate: 0.025 + Math.random() * 0.025,
    };
  });
  return { drones, missionCounter };
}

function stepDrone(d, dt, nextMissionId) {
  const loc = LOCATIONS.find((l) => l.id === d.location_id);
  let mission = null;

  switch (d.status) {
    case 'idle': {
      d.altitude_m = 0;
      d.battery_pct = Math.min(100, d.battery_pct + dt * 0.4);
      if (Math.random() < 0.01) {
        [d.target_lat, d.target_lon] = offsetLatLon(loc.lat, loc.lon, 4);
        d.status = 'en_route';
        mission = nextMissionId();
        d.mission_id = mission;
        d.stateTimer = 0;
      }
      break;
    }
    case 'en_route': {
      d.altitude_m += (CRUISE_ALT[d.platform_type] - d.altitude_m) * Math.min(1, dt * 0.3);
      d.heading_deg = bearingDeg(d.lat, d.lon, d.target_lat, d.target_lon);
      const speed = CRUISE_SPEED[d.platform_type];
      const dist = haversineKm(d.lat, d.lon, d.target_lat, d.target_lon) * 1000;
      if (dist < speed * dt) {
        d.lat = d.target_lat; d.lon = d.target_lon;
        d.status = 'loitering';
        d.stateTimer = 0;
      } else {
        const frac = (speed * dt) / Math.max(dist, 1e-6);
        d.lat += (d.target_lat - d.lat) * frac;
        d.lon += (d.target_lon - d.lon) * frac;
      }
      d.battery_pct = Math.max(0, d.battery_pct - dt * d.drainRate);
      break;
    }
    case 'loitering': {
      d.stateTimer += dt;
      d.heading_deg = (d.heading_deg + dt * 20) % 360;
      d.battery_pct = Math.max(0, d.battery_pct - dt * d.drainRate * 0.7);
      if (d.stateTimer > 20 + Math.random() * 30) {
        d.target_lat = d.base_lat; d.target_lon = d.base_lon;
        d.status = 'returning';
      }
      break;
    }
    case 'returning': {
      d.heading_deg = bearingDeg(d.lat, d.lon, d.base_lat, d.base_lon);
      const speed = CRUISE_SPEED[d.platform_type];
      const dist = haversineKm(d.lat, d.lon, d.base_lat, d.base_lon) * 1000;
      if (dist < speed * dt) {
        d.lat = d.base_lat; d.lon = d.base_lon;
        d.status = 'landed';
        d.altitude_m = 0;
        d.stateTimer = 0;
      } else {
        const frac = (speed * dt) / Math.max(dist, 1e-6);
        d.lat += (d.base_lat - d.lat) * frac;
        d.lon += (d.base_lon - d.lon) * frac;
        d.altitude_m = Math.max(0, d.altitude_m - dt * 2);
      }
      d.battery_pct = Math.max(0, d.battery_pct - dt * d.drainRate);
      break;
    }
    case 'landed': {
      d.stateTimer += dt;
      if (d.stateTimer > 5) {
        d.status = 'idle';
        d.mission_id = null;
      }
      break;
    }
    default:
      break;
  }

  if (!['idle', 'landed'].includes(d.status) && Math.random() < 0.0008) {
    d.status = 'signal_lost';
  }
}

// ---------------------------------------------------------------------------
// Decision-support rules engine (mirrors backend/decision_engine.py)
// ---------------------------------------------------------------------------
const LOW_BATTERY_PCT = 25;
const CRITICAL_BATTERY_PCT = 12;
const GEOFENCE_CONFLICT_M = 150;

function evaluateRules(fleet) {
  const alerts = [];

  fleet.forEach((d) => {
    const distToBase = haversineKm(d.lat, d.lon, d.base_lat, d.base_lon) * 1000;

    if (d.battery_pct <= CRITICAL_BATTERY_PCT && d.status !== 'returning') {
      alerts.push({
        id: `${d.drone_id}-battery-critical`,
        drone_id: d.drone_id,
        type: 'low_battery_rtb',
        severity: 'critical',
        message: `${d.name}: battery at ${d.battery_pct.toFixed(0)}% — immediate RTB required (${(distToBase / 1000).toFixed(1)} km from base).`,
      });
    } else if (d.battery_pct <= LOW_BATTERY_PCT && distToBase > 500 && d.status !== 'returning') {
      alerts.push({
        id: `${d.drone_id}-battery-warn`,
        drone_id: d.drone_id,
        type: 'low_battery_rtb',
        severity: 'warning',
        message: `${d.name}: battery at ${d.battery_pct.toFixed(0)}%, ${(distToBase / 1000).toFixed(1)} km from base — recommend recall.`,
      });
    }

    if (d.status === 'signal_lost') {
      alerts.push({
        id: `${d.drone_id}-signal`,
        drone_id: d.drone_id,
        type: 'signal_lost',
        severity: 'critical',
        message: `${d.name}: signal lost. Last known position ${d.lat.toFixed(4)}, ${d.lon.toFixed(4)}.`,
      });
    }

    if (!['idle', 'landed', 'offline'].includes(d.status)) {
      const minAlt = MIN_ALT[d.platform_type];
      const maxAlt = MAX_ALT[d.platform_type];
      if (d.altitude_m < minAlt) {
        alerts.push({
          id: `${d.drone_id}-alt-low`,
          drone_id: d.drone_id,
          type: 'altitude_violation',
          severity: 'warning',
          message: `${d.name} (${PLATFORM_LABEL[d.platform_type]}): altitude ${d.altitude_m.toFixed(0)}m below minimum safe altitude (${minAlt}m).`,
        });
      } else if (d.altitude_m > maxAlt) {
        alerts.push({
          id: `${d.drone_id}-alt-high`,
          drone_id: d.drone_id,
          type: 'altitude_violation',
          severity: 'warning',
          message: `${d.name} (${PLATFORM_LABEL[d.platform_type]}): altitude ${d.altitude_m.toFixed(0)}m exceeds ceiling (${maxAlt}m).`,
        });
      }
    }
  });

  const airborne = fleet.filter((d) => ['en_route', 'loitering'].includes(d.status));
  for (let i = 0; i < airborne.length; i++) {
    for (let j = i + 1; j < airborne.length; j++) {
      const a = airborne[i], b = airborne[j];
      if (a.mission_id && b.mission_id && a.mission_id === b.mission_id) continue;
      const dist = haversineKm(a.lat, a.lon, b.lat, b.lon) * 1000;
      if (dist <= GEOFENCE_CONFLICT_M) {
        alerts.push({
          id: `${a.drone_id}-${b.drone_id}-conflict`,
          drone_id: a.drone_id,
          type: 'geofence_conflict',
          severity: 'critical',
          message: `${a.name} and ${b.name} within ${dist.toFixed(0)}m of each other — separation conflict.`,
        });
      }
    }
  }

  return alerts;
}

// ---------------------------------------------------------------------------
// SVG tactical map — projects lat/lon to screen space per-location, since
// our three bases are far apart (Bangalore/Mumbai/Pune); each gets its own
// mini-map tile rather than one global projection that wastes space on
// open ocean between cities.
// ---------------------------------------------------------------------------
function project(lat, lon, center, scale, size) {
  const x = size / 2 + (lon - center.lon) * scale * Math.cos(center.lat * Math.PI / 180) * 111000;
  const y = size / 2 - (lat - center.lat) * scale * 111000;
  return [x, y];
}

function DroneMarker({ d, selected, onClick, center, scale, size }) {
  const [x, y] = project(d.lat, d.lon, center, scale, size);
  const color = STATUS_COLOR[d.status];
  const isMoving = ['en_route', 'returning'].includes(d.status);

  return (
    <g
      transform={`translate(${x}, ${y})`}
      onClick={() => onClick(d.drone_id)}
      style={{ cursor: 'pointer' }}
    >
      {selected && (
        <circle r="14" fill="none" stroke={color} strokeWidth="1" opacity="0.5">
          <animate attributeName="r" values="10;16;10" dur="1.6s" repeatCount="indefinite" />
          <animate attributeName="opacity" values="0.6;0.1;0.6" dur="1.6s" repeatCount="indefinite" />
        </circle>
      )}
      <g transform={isMoving ? `rotate(${d.heading_deg})` : ''}>
        {isMoving ? (
          <path d="M 0 -6 L 4 5 L 0 2.5 L -4 5 Z" fill={color} />
        ) : (
          <circle r="4" fill={color} />
        )}
      </g>
      <text
        x="0" y="-9" textAnchor="middle"
        fontSize="8" fontFamily="'JetBrains Mono', monospace"
        fill={selected ? COLORS.white : COLORS.slateLight}
        fontWeight={selected ? '600' : '400'}
      >
        {d.name}
      </text>
      {d.status === 'signal_lost' && (
        <circle r="7" fill="none" stroke={COLORS.red} strokeWidth="1.5">
          <animate attributeName="opacity" values="1;0.2;1" dur="0.8s" repeatCount="indefinite" />
        </circle>
      )}
    </g>
  );
}

function LocationTile({ loc, drones, selectedId, onSelect }) {
  const size = 280;
  const scale = 0.012; // degrees-equivalent zoom factor for the projection
  const localDrones = drones.filter((d) => d.location_id === loc.id);

  return (
    <div style={{
      background: COLORS.panelAlt,
      border: `1px solid ${COLORS.border}`,
      borderRadius: 4,
      padding: 10,
      flex: '1 1 280px',
      minWidth: 260,
    }}>
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'baseline',
        marginBottom: 6, paddingBottom: 6, borderBottom: `1px solid ${COLORS.border}`,
      }}>
        <span style={{
          fontFamily: "'JetBrains Mono', monospace", fontSize: 11,
          color: COLORS.teal, letterSpacing: '0.05em', fontWeight: 600,
        }}>
          {loc.name.toUpperCase()}
        </span>
        <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, color: COLORS.slate }}>
          {localDrones.length} UNITS
        </span>
      </div>
      <svg width="100%" viewBox={`0 0 ${size} ${size}`} style={{ display: 'block' }}>
        <defs>
          <pattern id={`grid-${loc.id}`} width="28" height="28" patternUnits="userSpaceOnUse">
            <path d="M 28 0 L 0 0 0 28" fill="none" stroke={COLORS.border} strokeWidth="0.5" />
          </pattern>
        </defs>
        <rect width={size} height={size} fill={COLORS.bg} rx="3" />
        <rect width={size} height={size} fill={`url(#grid-${loc.id})`} rx="3" />
        {/* base marker */}
        <g transform={`translate(${size / 2}, ${size / 2})`}>
          <rect x="-6" y="-6" width="12" height="12" fill="none" stroke={COLORS.slate} strokeWidth="1" transform="rotate(45)" />
        </g>
        {localDrones.map((d) => (
          <DroneMarker
            key={d.drone_id}
            d={d}
            selected={d.drone_id === selectedId}
            onClick={onSelect}
            center={loc}
            scale={scale}
            size={size}
          />
        ))}
      </svg>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Side panel: fleet list
// ---------------------------------------------------------------------------
function FleetListItem({ d, selected, onClick }) {
  const color = STATUS_COLOR[d.status];
  const batteryColor = d.battery_pct <= 12 ? COLORS.red : d.battery_pct <= 25 ? COLORS.amber : COLORS.slateLight;

  return (
    <div
      onClick={() => onClick(d.drone_id)}
      style={{
        display: 'flex', alignItems: 'center', gap: 10,
        padding: '8px 10px', cursor: 'pointer',
        background: selected ? COLORS.borderLight : 'transparent',
        borderLeft: `2px solid ${selected ? COLORS.teal : 'transparent'}`,
        transition: 'background 0.15s',
      }}
    >
      <div style={{ width: 6, height: 6, borderRadius: '50%', background: color, flexShrink: 0 }} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
          <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 12, color: COLORS.white, fontWeight: 500 }}>
            {d.name}
          </span>
          {d.source === 'sitl' && (
            <span style={{
              fontSize: 8, color: COLORS.teal, border: `1px solid ${COLORS.tealDim}`,
              borderRadius: 2, padding: '1px 4px', fontFamily: "'JetBrains Mono', monospace",
            }}>
              LIVE SITL
            </span>
          )}
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 2 }}>
          <span style={{ fontSize: 10, color: COLORS.slate, fontFamily: "'JetBrains Mono', monospace" }}>
            {PLATFORM_LABEL[d.platform_type]} · {STATUS_LABEL[d.status]}
          </span>
          <span style={{ fontSize: 10, color: batteryColor, fontFamily: "'JetBrains Mono', monospace" }}>
            {d.battery_pct.toFixed(0)}%
          </span>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Alert feed
// ---------------------------------------------------------------------------
function AlertItem({ alert, isNew }) {
  const color = SEVERITY_COLOR[alert.severity];
  return (
    <div style={{
      padding: '8px 10px',
      borderBottom: `1px solid ${COLORS.border}`,
      borderLeft: `2px solid ${color}`,
      background: isNew ? `${color}14` : 'transparent',
      animation: isNew ? 'flash 1s ease-out' : 'none',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
        <span style={{
          fontSize: 9, color, fontFamily: "'JetBrains Mono', monospace",
          letterSpacing: '0.05em', fontWeight: 700,
        }}>
          {alert.severity.toUpperCase()}
        </span>
        <span style={{ fontSize: 9, color: COLORS.slate, fontFamily: "'JetBrains Mono', monospace" }}>
          {new Date(alert.timestamp || Date.now()).toLocaleTimeString('en-US', { hour12: false })}
        </span>
      </div>
      <div style={{ fontSize: 12, color: COLORS.slateLight, lineHeight: 1.4 }}>
        {alert.message}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main dashboard
// ---------------------------------------------------------------------------
export default function DroneOpsDashboard() {
  const fleetRef = useRef(null);
  const missionCounterRef = useRef(0);
  const [fleet, setFleet] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [newAlertIds, setNewAlertIds] = useState(new Set());
  const [selectedDrone, setSelectedDrone] = useState(null);
  const [platformFilter, setPlatformFilter] = useState('all');
  const [tick, setTick] = useState(0);

  if (fleetRef.current === null) {
    fleetRef.current = initFleet().drones;
  }

  const nextMissionId = useCallback(() => {
    missionCounterRef.current += 1;
    return `M-${String(missionCounterRef.current).padStart(3, '0')}`;
  }, []);

  useEffect(() => {
    const interval = setInterval(() => {
      fleetRef.current.forEach((d) => stepDrone(d, 1, nextMissionId));
      const snapshot = fleetRef.current.map((d) => ({ ...d }));
      setFleet(snapshot);

      const computed = evaluateRules(snapshot).map((a) => ({ ...a, timestamp: Date.now() }));
      setAlerts((prev) => {
        const prevIds = new Set(prev.map((a) => a.id));
        const incomingIds = new Set(computed.map((a) => a.id));
        const fresh = computed.filter((a) => !prevIds.has(a.id));
        if (fresh.length) {
          setNewAlertIds(new Set(fresh.map((a) => a.id)));
          setTimeout(() => setNewAlertIds(new Set()), 1200);
        }
        // keep alerts that are still active, preserve original timestamp for those
        const stillActive = prev.filter((a) => incomingIds.has(a.id));
        const merged = [...fresh, ...stillActive];
        return merged.slice(0, 40);
      });

      setTick((t) => t + 1);
    }, 1000);
    return () => clearInterval(interval);
  }, [nextMissionId]);

  const filteredFleet = useMemo(() => {
    if (platformFilter === 'all') return fleet;
    return fleet.filter((d) => d.platform_type === platformFilter);
  }, [fleet, platformFilter]);

  const fleetByLocation = useMemo(() => {
    return LOCATIONS.map((loc) => ({
      loc,
      drones: filteredFleet.filter((d) => d.location_id === loc.id),
    }));
  }, [filteredFleet]);

  const statusCounts = useMemo(() => {
    const counts = {};
    fleet.forEach((d) => { counts[d.status] = (counts[d.status] || 0) + 1; });
    return counts;
  }, [fleet]);

  const criticalCount = alerts.filter((a) => a.severity === 'critical').length;
  const warningCount = alerts.filter((a) => a.severity === 'warning').length;

  const handleForceLowBattery = () => {
    const candidate = fleetRef.current.find((d) => !['idle', 'landed'].includes(d.status)) || fleetRef.current[0];
    candidate.battery_pct = 8;
  };

  const handleForceSignalLost = () => {
    const candidate = fleetRef.current.find((d) => !['idle', 'landed', 'signal_lost'].includes(d.status)) || fleetRef.current[1];
    candidate.status = 'signal_lost';
  };

  return (
    <div style={{
      fontFamily: "'Inter', -apple-system, sans-serif",
      background: COLORS.bg,
      color: COLORS.white,
      minHeight: '100vh',
      display: 'flex',
      flexDirection: 'column',
    }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&family=JetBrains+Mono:wght@400;500;600;700&display=swap');
        @keyframes flash { 0% { background-color: rgba(94,234,212,0.25); } 100% { background-color: transparent; } }
        * { box-sizing: border-box; }
        ::-webkit-scrollbar { width: 6px; height: 6px; }
        ::-webkit-scrollbar-thumb { background: ${COLORS.borderLight}; border-radius: 3px; }
        ::-webkit-scrollbar-track { background: transparent; }
        button:focus-visible, div[tabindex]:focus-visible { outline: 2px solid ${COLORS.teal}; outline-offset: 1px; }
      `}</style>

      {/* Top bar */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '12px 20px', borderBottom: `1px solid ${COLORS.border}`,
        background: COLORS.panel, flexWrap: 'wrap', gap: 12,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <div style={{
            fontFamily: "'JetBrains Mono', monospace", fontSize: 14, fontWeight: 700,
            color: COLORS.white, letterSpacing: '0.02em',
          }}>
            <span style={{ color: COLORS.teal }}>◆</span> INTEGRATED DRONE MANAGEMENT SYSTEM
          </div>
          <div style={{
            fontSize: 10, fontFamily: "'JetBrains Mono', monospace", color: COLORS.slate,
            padding: '2px 8px', border: `1px solid ${COLORS.border}`, borderRadius: 3,
          }}>
            FLEET: {fleet.length} · LOCATIONS: {LOCATIONS.length}
          </div>
        </div>

        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          {['all', 'quadcopter', 'fixed_wing', 'vtol'].map((p) => (
            <button
              key={p}
              onClick={() => setPlatformFilter(p)}
              style={{
                background: platformFilter === p ? COLORS.tealDim : 'transparent',
                color: platformFilter === p ? COLORS.bg : COLORS.slateLight,
                border: `1px solid ${platformFilter === p ? COLORS.tealDim : COLORS.border}`,
                borderRadius: 3, padding: '5px 10px', fontSize: 10,
                fontFamily: "'JetBrains Mono', monospace", cursor: 'pointer',
                letterSpacing: '0.03em', fontWeight: 600,
              }}
            >
              {p === 'all' ? 'ALL' : PLATFORM_LABEL[p]}
            </button>
          ))}
        </div>
      </div>

      {/* Status strip */}
      <div style={{
        display: 'flex', gap: 16, padding: '8px 20px',
        borderBottom: `1px solid ${COLORS.border}`, background: COLORS.panelAlt,
        fontSize: 11, fontFamily: "'JetBrains Mono', monospace", flexWrap: 'wrap',
      }}>
        {Object.entries(statusCounts).map(([status, count]) => (
          <div key={status} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <div style={{ width: 5, height: 5, borderRadius: '50%', background: STATUS_COLOR[status] }} />
            <span style={{ color: COLORS.slateLight }}>{STATUS_LABEL[status]}: {count}</span>
          </div>
        ))}
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 16 }}>
          <span style={{ color: COLORS.red }}>● CRITICAL: {criticalCount}</span>
          <span style={{ color: COLORS.amber }}>● WARNING: {warningCount}</span>
        </div>
      </div>

      {/* Main body */}
      <div style={{ display: 'flex', flex: 1, minHeight: 0 }}>
        {/* Left: fleet list */}
        <div style={{
          width: 240, borderRight: `1px solid ${COLORS.border}`,
          display: 'flex', flexDirection: 'column', background: COLORS.panel,
        }}>
          <div style={{
            padding: '10px 12px', fontSize: 10, color: COLORS.slate,
            fontFamily: "'JetBrains Mono', monospace", letterSpacing: '0.05em',
            borderBottom: `1px solid ${COLORS.border}`,
          }}>
            FLEET ROSTER
          </div>
          <div style={{ overflowY: 'auto', flex: 1 }}>
            {filteredFleet.map((d) => (
              <FleetListItem
                key={d.drone_id}
                d={d}
                selected={d.drone_id === selectedDrone}
                onClick={setSelectedDrone}
              />
            ))}
          </div>
          <div style={{
            padding: 10, borderTop: `1px solid ${COLORS.border}`,
            display: 'flex', flexDirection: 'column', gap: 6,
          }}>
            <div style={{ fontSize: 9, color: COLORS.slate, fontFamily: "'JetBrains Mono', monospace", marginBottom: 2 }}>
              DEMO CONTROLS
            </div>
            <button
              onClick={handleForceLowBattery}
              style={{
                background: 'transparent', border: `1px solid ${COLORS.border}`, color: COLORS.amber,
                borderRadius: 3, padding: '6px 8px', fontSize: 10, cursor: 'pointer',
                fontFamily: "'JetBrains Mono', monospace", textAlign: 'left',
              }}
            >
              ⚡ Trigger low battery
            </button>
            <button
              onClick={handleForceSignalLost}
              style={{
                background: 'transparent', border: `1px solid ${COLORS.border}`, color: COLORS.red,
                borderRadius: 3, padding: '6px 8px', fontSize: 10, cursor: 'pointer',
                fontFamily: "'JetBrains Mono', monospace", textAlign: 'left',
              }}
            >
              ⚡ Trigger signal loss
            </button>
          </div>
        </div>

        {/* Center: map tiles */}
        <div style={{ flex: 1, padding: 16, overflowY: 'auto' }}>
          <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap' }}>
            {fleetByLocation.map(({ loc, drones }) => (
              <LocationTile
                key={loc.id}
                loc={loc}
                drones={drones}
                selectedId={selectedDrone}
                onSelect={setSelectedDrone}
              />
            ))}
          </div>
        </div>

        {/* Right: alert feed */}
        <div style={{
          width: 300, borderLeft: `1px solid ${COLORS.border}`,
          display: 'flex', flexDirection: 'column', background: COLORS.panel,
        }}>
          <div style={{
            padding: '10px 12px', fontSize: 10, color: COLORS.slate,
            fontFamily: "'JetBrains Mono', monospace", letterSpacing: '0.05em',
            borderBottom: `1px solid ${COLORS.border}`, display: 'flex', justifyContent: 'space-between',
          }}>
            <span>DECISION SUPPORT — ALERT FEED</span>
          </div>
          <div style={{ overflowY: 'auto', flex: 1 }}>
            {alerts.length === 0 ? (
              <div style={{ padding: 20, fontSize: 11, color: COLORS.slate, textAlign: 'center' }}>
                No active alerts. Fleet operating within nominal parameters.
              </div>
            ) : (
              alerts.map((a) => (
                <AlertItem key={a.id} alert={a} isNew={newAlertIds.has(a.id)} />
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}