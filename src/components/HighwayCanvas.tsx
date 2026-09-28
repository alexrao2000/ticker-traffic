import React, { useEffect, useRef, useState } from 'react';
import { StockLane, CollisionEvent } from '../types/market';
import {
  SimulationVehicle,
  generateInitialFleet,
  updateContinuousTraffic,
  getLaneCenterX,
  HIGHWAY_GEOMETRY,
} from '../services/trafficEngine';
import { sound } from '../services/audio';
import { Camera, Compass, Layers, AlertCircle, Eye, Minimize2, Maximize2, RotateCcw } from 'lucide-react';

export type CameraPerspective = 'chase' | 'elevated' | 'topdown';

interface HighwayCanvasProps {
  lanes: StockLane[];
  currentLaneIndex: number; // 0 to 4: stock lanes, 5: right shoulder (100% Cash)
  onSelectLane: (index: number) => void;
  onExitToCash: () => void;
  isPaused: boolean;
  distanceAccrued: number;
  unrealizedEarnings: number;
  onCollision: (event: CollisionEvent) => void;
  carHealth: number;
}

/**
 * 60FPS High-Fidelity Automotive Rearview Mirror Renderer
 * Renders backward perspective down the highway with authentic glass bevel,
 * road curvature, trailing traffic headlights, sports cockpit rear deck silhouette,
 * and electrochromic auto-dimming night tint.
 */
function renderRearviewMirror(
  mCanvas: HTMLCanvasElement,
  sim: { player: SimulationVehicle; traffic: SimulationVehicle[] },
  lanes: StockLane[],
  isDimmed: boolean,
  isPanoramic: boolean,
  time: number
) {
  const mCtx = mCanvas.getContext('2d');
  if (!mCtx) return;

  const mw = mCanvas.width;
  const mh = mCanvas.height;
  mCtx.clearRect(0, 0, mw, mh);

  // Outer mirror glass border path (rounded trapezoid shape with subtle automotive curve)
  mCtx.save();
  mCtx.beginPath();
  const pad = 3;
  const r = 10;
  const inset = isPanoramic ? 12 : 8;
  mCtx.moveTo(pad + r, pad);
  mCtx.lineTo(mw - pad - r, pad);
  mCtx.quadraticCurveTo(mw - pad, pad, mw - pad, pad + r);
  mCtx.lineTo(mw - pad - inset, mh - pad - r);
  mCtx.quadraticCurveTo(mw - pad - inset, mh - pad, mw - pad - inset - r, mh - pad);
  mCtx.lineTo(pad + inset + r, mh - pad);
  mCtx.quadraticCurveTo(pad + inset, mh - pad, pad + inset, mh - pad - r);
  mCtx.lineTo(pad, pad + r);
  mCtx.quadraticCurveTo(pad, pad, pad + r, pad);
  mCtx.closePath();
  mCtx.clip();

  // 1. Sky & Horizon in Mirror (Low horizon for maximum road & vehicle visibility)
  const mHorizonY = mh * 0.22;
  const skyGrad = mCtx.createLinearGradient(0, 0, 0, mHorizonY);
  skyGrad.addColorStop(0, '#060a16');
  skyGrad.addColorStop(0.65, '#0e162a');
  skyGrad.addColorStop(1, '#1e2438');
  mCtx.fillStyle = skyGrad;
  mCtx.fillRect(0, 0, mw, mHorizonY);

  // Distant horizon mountain / city silhouette in mirror
  mCtx.fillStyle = '#0a0f1d';
  const numB = Math.floor(mw / 16);
  for (let b = 0; b < numB; b++) {
    const bh = 2 + ((b * 23) % 8);
    mCtx.fillRect(b * 16, mHorizonY - bh, 14, bh);
  }

  // Terrain outside highway
  mCtx.fillStyle = '#080c14';
  mCtx.fillRect(0, mHorizonY, mw, mh - mHorizonY);

  // Total roadway geometry (meters)
  const totalRoadWidthM =
    HIGHWAY_GEOMETRY.leftShoulderM +
    HIGHWAY_GEOMETRY.numTravelLanes * HIGHWAY_GEOMETRY.laneWidthM +
    HIGHWAY_GEOMETRY.shoulderWidthM;

  const mVpx = mw / 2;
  // High-magnification optical lens: trailing vehicles appear prominent and easy to see
  const mCamDist = 22.0;
  const pxPerM = (mw * (isPanoramic ? 1.02 : 0.95)) / totalRoadWidthM;

  // 2. Wide-Angle Convex Projection (Large, clear trailing vehicles)
  const projectMirrorPoint = (worldX: number, worldY: number) => {
    const dz = sim.player.worldY - worldY;
    if (dz <= 0.2) {
      return { x: mVpx, y: mh + 80, scale: 3.2, depth: dz };
    }
    const t = mCamDist / (dz + mCamDist * 0.35);
    const scale = Math.min(3.0, Math.pow(t, 0.65));
    const sy = mHorizonY + (mh * 0.95 - mHorizonY) * scale;
    // In a flat rearview mirror reflection, objects to the left of the car appear on the left!
    const sx = mVpx + (worldX - sim.player.x) * pxPerM * scale;
    return { x: sx, y: sy, scale, depth: dz };
  };

  // 3. High-Contrast Asphalt Road Surface
  const nearRearY = sim.player.worldY - 0.5;
  const farRearY = sim.player.worldY - 130;

  const pNearL = projectMirrorPoint(0, nearRearY);
  const pNearR = projectMirrorPoint(totalRoadWidthM, nearRearY);
  const pFarL = projectMirrorPoint(0, farRearY);
  const pFarR = projectMirrorPoint(totalRoadWidthM, farRearY);

  mCtx.beginPath();
  mCtx.moveTo(pNearL.x, pNearL.y);
  mCtx.lineTo(pFarL.x, pFarL.y);
  mCtx.lineTo(pFarR.x, pFarR.y);
  mCtx.lineTo(pNearR.x, pNearR.y);
  mCtx.closePath();

  const roadGrad = mCtx.createLinearGradient(0, mHorizonY, 0, mh);
  roadGrad.addColorStop(0, '#101422');
  roadGrad.addColorStop(0.5, '#151928');
  roadGrad.addColorStop(1, '#1b2032');
  mCtx.fillStyle = roadGrad;
  mCtx.fill();

  // 4. Highlight player's current lane in reflection
  const curLaneLeftM = HIGHWAY_GEOMETRY.leftShoulderM + sim.player.laneIndex * HIGHWAY_GEOMETRY.laneWidthM;
  const curLaneRightM =
    curLaneLeftM + (sim.player.laneIndex === 5 ? HIGHWAY_GEOMETRY.shoulderWidthM : HIGHWAY_GEOMETRY.laneWidthM);
  const curNL = projectMirrorPoint(curLaneLeftM, nearRearY);
  const curNR = projectMirrorPoint(curLaneRightM, nearRearY);
  const curFL = projectMirrorPoint(curLaneLeftM, farRearY);
  const curFR = projectMirrorPoint(curLaneRightM, farRearY);

  mCtx.beginPath();
  mCtx.moveTo(curNL.x, curNL.y);
  mCtx.lineTo(curFL.x, curFL.y);
  mCtx.lineTo(curFR.x, curFR.y);
  mCtx.lineTo(curNR.x, curNR.y);
  mCtx.closePath();
  mCtx.fillStyle = sim.player.laneIndex === 5 ? 'rgba(16, 185, 129, 0.12)' : 'rgba(2, 132, 199, 0.12)';
  mCtx.fill();

  // 5. Crisp Road Markings in Mirror
  // Left median yellow line
  const yellNear = projectMirrorPoint(HIGHWAY_GEOMETRY.leftShoulderM, nearRearY);
  const yellFar = projectMirrorPoint(HIGHWAY_GEOMETRY.leftShoulderM, farRearY);
  mCtx.strokeStyle = '#facc15';
  mCtx.lineWidth = Math.max(1.5, 2.5 * yellNear.scale);
  mCtx.beginPath();
  mCtx.moveTo(yellNear.x, yellNear.y);
  mCtx.lineTo(yellFar.x, yellFar.y);
  mCtx.stroke();

  // Right shoulder white line
  const shNear = projectMirrorPoint(HIGHWAY_GEOMETRY.leftShoulderM + 5 * HIGHWAY_GEOMETRY.laneWidthM, nearRearY);
  const shFar = projectMirrorPoint(HIGHWAY_GEOMETRY.leftShoulderM + 5 * HIGHWAY_GEOMETRY.laneWidthM, farRearY);
  mCtx.strokeStyle = 'rgba(255, 255, 255, 0.85)';
  mCtx.lineWidth = Math.max(1.5, 2.5 * shNear.scale);
  mCtx.beginPath();
  mCtx.moveTo(shNear.x, shNear.y);
  mCtx.lineTo(shFar.x, shFar.y);
  mCtx.stroke();

  // Dashed white lane dividers (moving backwards with vehicle speed)
  const dashInterval = 12; // meters
  const dashLength = 4.5;  // meters
  const offset = sim.player.worldY % dashInterval;

  mCtx.strokeStyle = 'rgba(255, 255, 255, 0.7)';
  mCtx.lineWidth = Math.max(1.5, 2.0);

  for (let l = 1; l < 5; l++) {
    const laneM = HIGHWAY_GEOMETRY.leftShoulderM + l * HIGHWAY_GEOMETRY.laneWidthM;
    mCtx.beginPath();
    for (let segY = sim.player.worldY - offset; segY > sim.player.worldY - 120; segY -= dashInterval) {
      const p1 = projectMirrorPoint(laneM, segY);
      const p2 = projectMirrorPoint(laneM, Math.max(sim.player.worldY - 120, segY - dashLength));
      if (p1.y > mHorizonY && p2.y > mHorizonY) {
        mCtx.moveTo(p1.x, p1.y);
        mCtx.lineTo(p2.x, p2.y);
      }
    }
    mCtx.stroke();
  }

  // 6. Trailing Vehicles in Mirror
  const trailing = sim.traffic.filter(
    (v) => v.worldY < sim.player.worldY && sim.player.worldY - v.worldY < 125
  );
  // Sort farthest first, closest last so closer cars render on top
  trailing.sort((a, b) => a.worldY - b.worldY);

  let closestTrailingM = 999;

  for (const veh of trailing) {
    const dz = sim.player.worldY - veh.worldY;
    const isDirectlyBehind = Math.abs(veh.x - sim.player.x) < 2.2;
    if (isDirectlyBehind) {
      if (dz < closestTrailingM) closestTrailingM = dz;
    }

    const p = projectMirrorPoint(veh.x, veh.worldY);
    if (p.y < mHorizonY - 6 || p.y > mh + 40) continue;

    const s = p.scale;
    // BOLD vehicle dimensions for unmistakable visibility
    const vWidPx = Math.max(18, veh.width * pxPerM * s * 1.35);
    const carH = Math.max(11, (veh.type === 'semi' ? 24 : veh.type === 'suv' ? 16 : 13) * s);

    // Ground contact shadow
    mCtx.fillStyle = 'rgba(0, 0, 0, 0.75)';
    mCtx.beginPath();
    mCtx.ellipse(p.x, p.y + 1, vWidPx * 0.54, 3.5 * s, 0, 0, Math.PI * 2);
    mCtx.fill();

    // Headlight throw on road pointing forward toward player
    mCtx.fillStyle = isDimmed ? 'rgba(56, 189, 248, 0.08)' : 'rgba(254, 240, 138, 0.16)';
    mCtx.beginPath();
    mCtx.moveTo(p.x - vWidPx * 0.45, p.y - carH * 0.3);
    mCtx.lineTo(p.x - vWidPx * 1.35, p.y + 40 * s);
    mCtx.lineTo(p.x + vWidPx * 1.35, p.y + 40 * s);
    mCtx.lineTo(p.x + vWidPx * 0.45, p.y - carH * 0.3);
    mCtx.closePath();
    mCtx.fill();

    // Front vehicle body
    if (veh.type === 'semi') {
      // Semi front cab & chrome grille
      mCtx.fillStyle = '#64748b';
      mCtx.fillRect(p.x - vWidPx / 2, p.y - carH, vWidPx, carH);

      // Large polished chrome grille
      mCtx.fillStyle = '#cbd5e1';
      mCtx.fillRect(p.x - vWidPx * 0.36, p.y - carH * 0.68, vWidPx * 0.72, carH * 0.65);

      // Grille horizontal slats
      mCtx.strokeStyle = '#1e293b';
      mCtx.lineWidth = Math.max(1, 1.2 * s);
      for (let sl = p.y - carH * 0.6; sl < p.y - 1; sl += 3 * s) {
        mCtx.beginPath();
        mCtx.moveTo(p.x - vWidPx * 0.33, sl);
        mCtx.lineTo(p.x + vWidPx * 0.33, sl);
        mCtx.stroke();
      }

      // Windshield with subtle reflection
      mCtx.fillStyle = '#0f172a';
      mCtx.fillRect(p.x - vWidPx * 0.42, p.y - carH + 1.5 * s, vWidPx * 0.84, carH * 0.3);
      mCtx.fillStyle = 'rgba(56, 189, 248, 0.2)';
      mCtx.fillRect(p.x - vWidPx * 0.38, p.y - carH + 2 * s, vWidPx * 0.4, carH * 0.15);

      // Top cab clearance amber lights (5 prominent glowing dots)
      mCtx.fillStyle = '#f59e0b';
      mCtx.shadowColor = '#f59e0b';
      mCtx.shadowBlur = 6 * s;
      for (let dot = -2; dot <= 2; dot++) {
        mCtx.fillRect(p.x + dot * 3.5 * s - 1.5, p.y - carH - 1, 2.5 * s, 2.5 * s);
      }
      mCtx.shadowBlur = 0;
    } else {
      // Passenger car / SUV front fascia
      mCtx.fillStyle = veh.color;
      mCtx.beginPath();
      mCtx.roundRect(p.x - vWidPx / 2, p.y - carH, vWidPx, carH, Math.max(2, 3.5 * s));
      mCtx.fill();

      // Sharp edge specular highlight along hood & roof (makes vehicle pop out clearly!)
      mCtx.strokeStyle = 'rgba(255, 255, 255, 0.45)';
      mCtx.lineWidth = Math.max(1, 1.5 * s);
      mCtx.stroke();

      // Sloping windshield & roof
      mCtx.fillStyle = '#090d16';
      const glassW = vWidPx * 0.78;
      const glassH = carH * 0.38;
      mCtx.fillRect(p.x - glassW / 2, p.y - carH + 1.5 * s, glassW, glassH);

      // Windshield reflection
      mCtx.fillStyle = 'rgba(255, 255, 255, 0.18)';
      mCtx.fillRect(p.x - glassW / 2 + 1, p.y - carH + 2 * s, glassW * 0.5, 2 * s);

      // Front lower intake
      mCtx.fillStyle = '#0f172a';
      mCtx.fillRect(p.x - vWidPx * 0.34, p.y - carH * 0.44, vWidPx * 0.68, carH * 0.4);
    }

    // Front Headlights & DRL Lightbars
    const lightW = Math.max(4, 7 * s);
    const lightH = Math.max(3, 5.5 * s);
    const lightY = p.y - carH * 0.56;

    // Glowing front LED lightbar spanning between headlights
    mCtx.fillStyle = isDimmed ? 'rgba(56, 189, 248, 0.75)' : 'rgba(254, 240, 138, 0.85)';
    mCtx.fillRect(p.x - vWidPx * 0.28, lightY + 1 * s, vWidPx * 0.56, Math.max(1.5, 2 * s));

    // Intense Glowing Headlight Bulbs
    mCtx.fillStyle = '#ffffff';
    mCtx.shadowColor = isDimmed ? '#38bdf8' : '#fde047';
    mCtx.shadowBlur = (isDimmed ? 8 : 16) * s;

    // Left headlight projector
    mCtx.fillRect(p.x - vWidPx / 2 + 1.5 * s, lightY, lightW, lightH);
    // Right headlight projector
    mCtx.fillRect(p.x + vWidPx / 2 - lightW - 1.5 * s, lightY, lightW, lightH);
    mCtx.shadowBlur = 0;

    // Blinking amber turn signals
    if (veh.turnSignal !== 'none') {
      const blinkOn = Math.floor(time * 0.008) % 2 === 0;
      if (blinkOn) {
        mCtx.fillStyle = '#f59e0b';
        mCtx.shadowColor = '#f59e0b';
        mCtx.shadowBlur = 10 * s;
        const sigX =
          veh.turnSignal === 'left'
            ? p.x - vWidPx / 2 + 1.5 * s
            : p.x + vWidPx / 2 - lightW - 1.5 * s;
        mCtx.fillRect(sigX, lightY, lightW, lightH);
        mCtx.shadowBlur = 0;
      }
    }

    // Tactical Target Reticle & Distance Tag for vehicle directly trailing you
    if (isDirectlyBehind && dz < 70) {
      mCtx.save();
      const isTailgate = dz < 18;
      const tagText = isTailgate ? `⚠ ${Math.round(dz)}m` : `${Math.round(dz)}m`;
      const tagY = p.y - carH - 4 * s;

      // HUD Distance Tag Pill
      mCtx.font = `700 ${Math.max(8, Math.round(9 * s))}px "JetBrains Mono", monospace`;
      mCtx.textAlign = 'center';
      const textW = mCtx.measureText(tagText).width;

      mCtx.fillStyle = isTailgate ? 'rgba(239, 68, 68, 0.85)' : 'rgba(2, 132, 199, 0.8)';
      mCtx.beginPath();
      mCtx.roundRect(p.x - textW / 2 - 3, tagY - 9 * s, textW + 6, 11 * s, 3);
      mCtx.fill();

      mCtx.fillStyle = '#ffffff';
      mCtx.fillText(tagText, p.x, tagY);

      // Subtle tactical tracking brackets
      mCtx.strokeStyle = isTailgate ? '#ef4444' : '#38bdf8';
      mCtx.lineWidth = 1.2;
      const bW = vWidPx * 0.58;
      const bH = carH * 0.65;
      // Top-left bracket
      mCtx.beginPath();
      mCtx.moveTo(p.x - bW, p.y - bH * 0.5);
      mCtx.lineTo(p.x - bW, p.y - bH);
      mCtx.lineTo(p.x - bW + 4, p.y - bH);
      // Top-right bracket
      mCtx.moveTo(p.x + bW - 4, p.y - bH);
      mCtx.lineTo(p.x + bW, p.y - bH);
      mCtx.lineTo(p.x + bW, p.y - bH * 0.5);
      mCtx.stroke();
      mCtx.restore();
    }
  }

  // 7. Slim Modern Cockpit Window Frame Silhouette (Minimal height so it doesn't block the road)
  mCtx.fillStyle = '#06080f';
  mCtx.beginPath();
  mCtx.moveTo(0, mh);
  mCtx.lineTo(0, mh - 5);
  mCtx.quadraticCurveTo(mw * 0.1, mh - 9, mw * 0.25, mh - 4);
  mCtx.lineTo(mw * 0.75, mh - 4);
  mCtx.quadraticCurveTo(mw * 0.9, mh - 9, mw, mh - 5);
  mCtx.lineTo(mw, mh);
  mCtx.closePath();
  mCtx.fill();

  // 8. Auto-Dimming Electrochromic Anti-Glare Tint
  if (isDimmed) {
    const dimGrad = mCtx.createLinearGradient(0, 0, 0, mh);
    dimGrad.addColorStop(0, 'rgba(14, 165, 233, 0.09)');
    dimGrad.addColorStop(1, 'rgba(16, 185, 129, 0.05)');
    mCtx.fillStyle = dimGrad;
    mCtx.fillRect(0, 0, mw, mh);
  }

  // 9. Glass Specular Sheen Highlight
  const sheen = mCtx.createLinearGradient(0, 0, mw, mh);
  sheen.addColorStop(0, 'rgba(255, 255, 255, 0.14)');
  sheen.addColorStop(0.24, 'rgba(255, 255, 255, 0.02)');
  sheen.addColorStop(0.5, 'transparent');
  mCtx.fillStyle = sheen;
  mCtx.fillRect(0, 0, mw, mh);

  // 10. Micro Safety Etching
  mCtx.fillStyle = 'rgba(226, 232, 240, 0.45)';
  mCtx.font = '600 6.5px "JetBrains Mono", monospace';
  mCtx.textAlign = 'center';
  mCtx.fillText('OBJECTS IN MIRROR ARE CLOSER THAN THEY APPEAR', mw / 2, mh - 2);

  // 11. Mirror Micro-Telemetry HUD
  mCtx.textAlign = 'left';
  mCtx.font = '700 8.5px "JetBrains Mono", monospace';
  mCtx.fillStyle = isDimmed ? '#38bdf8' : '#e2e8f0';
  mCtx.fillText('DIGITAL REARVIEW HD', 9, 12);

  mCtx.textAlign = 'right';
  if (closestTrailingM < 18) {
    const blink = Math.floor(time * 0.006) % 2 === 0;
    mCtx.fillStyle = blink ? '#ef4444' : '#f59e0b';
    mCtx.fillText(`⚠ TAILGATING ${Math.round(closestTrailingM)}m`, mw - 9, 12);
  } else if (closestTrailingM < 70) {
    mCtx.fillStyle = '#38bdf8';
    mCtx.fillText(`REAR: ${Math.round(closestTrailingM)}m`, mw - 9, 12);
  } else {
    mCtx.fillStyle = 'rgba(148, 163, 184, 0.7)';
    mCtx.fillText('REAR: CLEAR', mw - 9, 12);
  }

  mCtx.restore();
}

export const HighwayCanvas: React.FC<HighwayCanvasProps> = ({
  lanes,
  currentLaneIndex,
  onSelectLane,
  onExitToCash,
  isPaused,
  distanceAccrued,
  unrealizedEarnings,
  onCollision,
  carHealth,
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // Perspective camera mode: 'chase' is forward-looking 3D perspective looking 250m down the road
  const [perspective, setPerspective] = useState<CameraPerspective>('chase');
  const perspectiveRef = useRef<CameraPerspective>('chase');
  perspectiveRef.current = perspective;

  const dimsRef = useRef<{ width: number; height: number; dpr: number }>({
    width: 800,
    height: 480,
    dpr: 1,
  });

  // Continuous simulation state
  const simRef = useRef<{
    traffic: SimulationVehicle[];
    player: SimulationVehicle;
    invincibleTimer: number;
    playerGas: boolean;
    playerBrake: boolean;
    requestedLaneChange: number | null;
  }>({
    traffic: generateInitialFleet(100),
    player: {
      id: 'player-car',
      isPlayer: true,
      laneIndex: currentLaneIndex,
      targetLaneIndex: currentLaneIndex,
      x: getLaneCenterX(currentLaneIndex),
      targetX: getLaneCenterX(currentLaneIndex),
      vx: 0,
      worldY: 100,
      speed: 26, // ~95 km/h
      acceleration: 0,
      desiredSpeed: 30,
      length: 4.6,
      width: 1.9,
      yawAngle: 0,
      type: 'coupe',
      color: '#0284c7', // Distinctive Cyan Supercar
      brakeLight: false,
      turnSignal: 'none',
      turnSignalTimer: 0,
      signalPreWarningTimer: 0,
      isTransitioning: false,
      timeSinceLastChange: 0,
      aggressiveness: 1.1,
      wanderOffset: 0,
      wanderPhase: 0,
    },
    invincibleTimer: 0,
    playerGas: false,
    playerBrake: false,
    requestedLaneChange: null,
  });

  // Track currently held keys for human steering and pedal controls
  const keysHeldRef = useRef<{
    left: boolean;
    right: boolean;
    gas: boolean;
    brake: boolean;
  }>({
    left: false,
    right: false,
    gas: false,
    brake: false,
  });

  const holdSteerTimerRef = useRef<number>(0);

  // Telemetry HUD state (low-frequency sync to prevent re-render loops)
  const [hudStats, setHudStats] = useState<{
    speedMph: number;
    headwayMeters: number;
    closingMph: number;
    isBraking: boolean;
    leadBraking: boolean;
    turnSignal: 'left' | 'right' | 'none';
  }>({
    speedMph: 60,
    headwayMeters: 999,
    closingMph: 0,
    isBraking: false,
    leadBraking: false,
    turnSignal: 'none',
  });

  // Rearview Mirror State & Controls
  const [mirrorMode, setMirrorMode] = useState<'standard' | 'panoramic' | 'minimized'>('standard');
  const mirrorModeRef = useRef<'standard' | 'panoramic' | 'minimized'>('standard');
  mirrorModeRef.current = mirrorMode;

  const [isMirrorDimmed, setIsMirrorDimmed] = useState<boolean>(true);
  const isMirrorDimmedRef = useRef<boolean>(true);
  isMirrorDimmedRef.current = isMirrorDimmed;

  const [isLookBehind, setIsLookBehind] = useState<boolean>(false);
  const isLookBehindRef = useRef<boolean>(false);
  isLookBehindRef.current = isLookBehind;

  const mirrorCanvasRef = useRef<HTMLCanvasElement | null>(null);

  const [rearTelemetry, setRearTelemetry] = useState<{
    trailingGapM: number;
    isTailgating: boolean;
    countBehind: number;
  }>({
    trailingGapM: 999,
    isTailgating: false,
    countBehind: 0,
  });

  // Prop sync: user clicked a lane directory card or triggered a scenario
  useEffect(() => {
    if (simRef.current.player.laneIndex !== currentLaneIndex) {
      simRef.current.requestedLaneChange = currentLaneIndex;
    }
  }, [currentLaneIndex]);

  // Keyboard controls for throttle, human braking, continuous steering, and perspective toggle
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

      // CRITICAL: Ignore OS key repeat on steering and exit keys
      if (e.repeat) return;

      if (e.key === 'ArrowUp' || e.key === 'w' || e.key === 'W') {
        keysHeldRef.current.gas = true;
      } else if (e.key === 'ArrowDown' || e.key === 's' || e.key === 'S') {
        keysHeldRef.current.brake = true;
        sound.playBrakeScreech();
      } else if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') {
        keysHeldRef.current.left = true;
        holdSteerTimerRef.current = 0;
        // Multi-lane tap queuing: immediately step target left (can queue multiple lanes)
        const currentTarget = simRef.current.player.targetLaneIndex ?? simRef.current.player.laneIndex;
        if (currentTarget > 0) {
          const nextTarget = currentTarget - 1;
          simRef.current.requestedLaneChange = nextTarget;
          sound.playLaneSwitch();
        }
      } else if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') {
        keysHeldRef.current.right = true;
        holdSteerTimerRef.current = 0;
        // Multi-lane tap queuing: immediately step target right (can queue multiple lanes)
        const currentTarget = simRef.current.player.targetLaneIndex ?? simRef.current.player.laneIndex;
        if (currentTarget < 5) {
          const nextTarget = currentTarget + 1;
          simRef.current.requestedLaneChange = nextTarget;
          sound.playLaneSwitch();
        }
      } else if (e.key === 'c' || e.key === 'C') {
        if (simRef.current.player.laneIndex !== 5) {
          sound.playLaneSwitch();
          simRef.current.requestedLaneChange = 5;
        }
      } else if (e.key === 'v' || e.key === 'V') {
        // Quick toggle camera perspective
        sound.playLaneSwitch();
        setPerspective((prev) => (prev === 'chase' ? 'elevated' : prev === 'elevated' ? 'topdown' : 'chase'));
      } else if (e.key === 'm' || e.key === 'M') {
        // Toggle rearview mirror mode: Standard -> Panoramic -> Minimized
        sound.playMirrorClick();
        setMirrorMode((prev) => (prev === 'standard' ? 'panoramic' : prev === 'panoramic' ? 'minimized' : 'standard'));
      } else if (e.key === 'r' || e.key === 'R') {
        // Look Behind (Rear Camera Glance)
        sound.playMirrorClick();
        setIsLookBehind(true);
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.key === 'ArrowUp' || e.key === 'w' || e.key === 'W') {
        keysHeldRef.current.gas = false;
      } else if (e.key === 'ArrowDown' || e.key === 's' || e.key === 'S') {
        keysHeldRef.current.brake = false;
      } else if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') {
        keysHeldRef.current.left = false;
        holdSteerTimerRef.current = 0;
      } else if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') {
        keysHeldRef.current.right = false;
        holdSteerTimerRef.current = 0;
      } else if (e.key === 'r' || e.key === 'R') {
        setIsLookBehind(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, []);

  // Robust container ResizeObserver
  useEffect(() => {
    const container = containerRef.current;
    const canvas = canvasRef.current;
    if (!container || !canvas) return;

    const handleResize = () => {
      const rect = container.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const w = Math.floor(rect.width);
      const h = Math.floor(rect.height);

      if (w > 0 && h > 0) {
        canvas.width = w * dpr;
        canvas.height = h * dpr;
        dimsRef.current = { width: w, height: h, dpr };
      }
    };

    const observer = new ResizeObserver(() => handleResize());
    observer.observe(container);
    handleResize();

    return () => observer.disconnect();
  }, []);

  // 60FPS Continuous Highway Physical Render Loop with 3D Perspective Projection
  useEffect(() => {
    let animId: number;
    let lastTime = performance.now();
    let statsTimer = 0;

    const render = (time: number) => {
      const dt = Math.min((time - lastTime) / 1000, 0.05);
      lastTime = time;

      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      const { width: w, height: h, dpr } = dimsRef.current;
      const sim = simRef.current;
      const curPerspective = perspectiveRef.current;

      // Handle collision invincibility decay
      if (sim.invincibleTimer > 0) {
        sim.invincibleTimer = Math.max(0, sim.invincibleTimer - dt);
      }

      // Continuous held keyboard steering processing (allows fluid momentum across multiple lanes)
      if (!isPaused) {
        if (keysHeldRef.current.right) {
          holdSteerTimerRef.current += dt;
          if (holdSteerTimerRef.current >= 0.28) {
            holdSteerTimerRef.current = 0;
            const currentTarget = sim.player.targetLaneIndex ?? sim.player.laneIndex;
            if (currentTarget < 5) {
              sim.requestedLaneChange = currentTarget + 1;
              sound.playLaneSwitch();
            }
          }
        } else if (keysHeldRef.current.left) {
          holdSteerTimerRef.current += dt;
          if (holdSteerTimerRef.current >= 0.28) {
            holdSteerTimerRef.current = 0;
            const currentTarget = sim.player.targetLaneIndex ?? sim.player.laneIndex;
            if (currentTarget > 0) {
              sim.requestedLaneChange = currentTarget - 1;
              sound.playLaneSwitch();
            }
          }
        } else {
          holdSteerTimerRef.current = 0;
        }
      }

      // Pedal control sync
      sim.playerGas = keysHeldRef.current.gas;
      sim.playerBrake = keysHeldRef.current.brake;

      // Step continuous traffic physics forward
      if (!isPaused) {
        const { updatedVehicles, updatedPlayer } = updateContinuousTraffic(
          sim.traffic,
          sim.player,
          lanes.map((l) => l.speedMph * 0.44704),
          lanes.map((l) => l.congestion),
          {
            gas: sim.playerGas,
            brake: sim.playerBrake,
            steeringTargetLane: sim.requestedLaneChange,
          },
          dt,
          (leadCar) => {
            // Collision handler
            if (sim.invincibleTimer <= 0) {
              sim.invincibleTimer = 2.0; // 2s invincibility buffer
              sound.playCrashImpact();

              const activeLane = lanes[sim.player.laneIndex] || lanes[0];
              const penalty = Math.round(activeLane.currentPrice * 0.85);

              onCollision({
                id: `col-${Date.now()}`,
                time: Date.now(),
                carId: leadCar.id,
                penaltyAmount: penalty,
                laneSymbol: sim.player.laneIndex === 5 ? 'CASH' : activeLane.symbol,
                message: `Rear-ended vehicle ahead! -$${penalty} capital penalty.`,
              });
            }
          },
          (finalLane) => {
            if (finalLane === 5) {
              onExitToCash();
            } else {
              onSelectLane(finalLane);
            }
          }
        );

        sim.traffic = updatedVehicles;
        sim.player = updatedPlayer;
        if (!updatedPlayer.isTransitioning && updatedPlayer.laneIndex === sim.requestedLaneChange) {
          sim.requestedLaneChange = null;
        }
      }

      // Compute headway to lead vehicle in front of player
      let minGap = 999;
      let relClosingMps = 0;
      let leadIsBraking = false;

      for (const veh of sim.traffic) {
        if (Math.abs(veh.x - sim.player.x) < 2.0 && veh.worldY > sim.player.worldY) {
          // Bumper-to-bumper distance: lead rear bumper minus player front bumper (~1.2m offset)
          const gap = Math.max(0, veh.worldY - sim.player.worldY - 1.2);
          if (gap < minGap) {
            minGap = gap;
            relClosingMps = sim.player.speed - veh.speed;
            leadIsBraking = veh.brakeLight;
          }
        }
      }

      // Update React HUD state at ~8Hz to avoid re-render cost
      statsTimer += dt;
      if (statsTimer > 0.12) {
        statsTimer = 0;

        // Trailing vehicle telemetry for rearview mirror
        let minRearGap = 999;
        let countBehind = 0;
        for (const veh of sim.traffic) {
          if (veh.worldY < sim.player.worldY) {
            countBehind++;
            if (Math.abs(veh.x - sim.player.x) < 2.0) {
              const gap = sim.player.worldY - veh.worldY;
              if (gap < minRearGap) minRearGap = gap;
            }
          }
        }

        setHudStats({
          speedMph: Math.round(sim.player.speed * 2.23694),
          headwayMeters: Math.round(minGap),
          closingMph: Math.round(Math.max(0, relClosingMps * 2.23694)),
          isBraking: sim.player.brakeLight,
          leadBraking: leadIsBraking && minGap < 45,
          turnSignal: sim.player.turnSignal,
        });

        setRearTelemetry({
          trailingGapM: Math.round(minRearGap),
          isTailgating: minRearGap < 18,
          countBehind,
        });
      }

      // ==========================================
      // PERSPECTIVE HIGHWAY ROAD RENDERER
      // ==========================================
      ctx.save();
      ctx.scale(dpr, dpr);

      // Total roadway geometry (meters)
      const totalRoadWidthM =
        HIGHWAY_GEOMETRY.leftShoulderM +
        HIGHWAY_GEOMETRY.numTravelLanes * HIGHWAY_GEOMETRY.laneWidthM +
        HIGHWAY_GEOMETRY.shoulderWidthM;

      const roadCenterM =
        HIGHWAY_GEOMETRY.leftShoulderM +
        (HIGHWAY_GEOMETRY.numTravelLanes * HIGHWAY_GEOMETRY.laneWidthM) / 2;

      // Camera Configuration based on chosen perspective mode
      const is3D = curPerspective === 'chase' || curPerspective === 'elevated';
      const isLookingBack = isLookBehindRef.current;
      const horizonY = curPerspective === 'chase' ? h * 0.22 : curPerspective === 'elevated' ? h * 0.16 : 0;
      const playerScreenY = curPerspective === 'chase' ? h * 0.77 : curPerspective === 'elevated' ? h * 0.81 : h * 0.84;
      const camDistBehind = curPerspective === 'chase' ? 10.5 : curPerspective === 'elevated' ? 17.0 : 12.0;
      const maxLookaheadM = curPerspective === 'chase' ? 240 : curPerspective === 'elevated' ? 190 : 110;
      const perspectivePow = curPerspective === 'chase' ? 0.86 : 0.88;

      // Base lateral scale factor at the player's longitudinal plane
      const roadBasePxWidth = w * (curPerspective === 'chase' ? 0.88 : curPerspective === 'elevated' ? 0.84 : 0.92);
      const pxPerMeterBase = roadBasePxWidth / totalRoadWidthM;
      const vpx = w / 2;
      const vpy = horizonY;
      const camWorldY = isLookingBack
        ? sim.player.worldY + camDistBehind
        : sim.player.worldY - camDistBehind;

      // 3D Perspective Projection Function (World Meters -> Screen Pixels)
      const projectPoint = (worldX: number, worldY: number) => {
        if (!is3D) {
          // Top-down Radar view with extended lookahead
          const sx = vpx + (worldX - roadCenterM) * (pxPerMeterBase * 0.95);
          const sy = playerScreenY - (worldY - sim.player.worldY) * (pxPerMeterBase * 0.95);
          return { x: sx, y: sy, scale: 1.0, depth: worldY - sim.player.worldY };
        }

        const dz = isLookingBack ? camWorldY - worldY : worldY - camWorldY;
        if (dz <= 0.8) {
          return { x: vpx, y: h + 200, scale: 3.0, depth: dz };
        }

        // Perspective scale factor
        const t = Math.max(0.001, camDistBehind / dz);
        const scale = Math.min(2.5, Math.pow(t, perspectivePow));
        const sy = vpy + (playerScreenY - vpy) * scale;
        const sx = isLookingBack
          ? vpx + (roadCenterM - worldX) * pxPerMeterBase * scale
          : vpx + (worldX - roadCenterM) * pxPerMeterBase * scale;

        return { x: sx, y: sy, scale, depth: dz };
      };

      // 1. SKY & DISTANT HORIZON BACKDROP (3D Modes)
      if (is3D) {
        // Deep dusk atmosphere gradient
        const skyGrad = ctx.createLinearGradient(0, 0, 0, horizonY);
        skyGrad.addColorStop(0, '#04060d');
        skyGrad.addColorStop(0.55, '#0b1224');
        skyGrad.addColorStop(0.85, '#191b2c');
        skyGrad.addColorStop(1, '#2c2233');
        ctx.fillStyle = skyGrad;
        ctx.fillRect(0, 0, w, horizonY);

        // Distant horizon mountain / city skyline silhouette
        ctx.fillStyle = '#080a12';
        const numBldgs = Math.floor(w / 22);
        for (let b = 0; b < numBldgs; b++) {
          const bx = b * 22;
          const bh = 8 + ((b * 37) % 24) + ((b * 13) % 15);
          ctx.fillRect(bx, horizonY - bh, 20, bh);

          // Subtle glowing red tower beacons at night
          if (b % 4 === 1 && Math.floor(time * 0.002) % 2 === 0) {
            ctx.fillStyle = 'rgba(239, 68, 68, 0.7)';
            ctx.fillRect(bx + 9, horizonY - bh - 2, 2, 2);
            ctx.fillStyle = '#080a12';
          }
        }

        // Faint atmospheric glow along horizon
        const fogGrad = ctx.createLinearGradient(0, horizonY - 12, 0, horizonY + 16);
        fogGrad.addColorStop(0, 'rgba(44, 34, 51, 0)');
        fogGrad.addColorStop(0.5, 'rgba(56, 189, 248, 0.08)');
        fogGrad.addColorStop(1, 'rgba(15, 17, 24, 0)');
        ctx.fillStyle = fogGrad;
        ctx.fillRect(0, horizonY - 12, w, 28);
      }

      // Terrain / Bed outside the highway
      ctx.fillStyle = '#06070a';
      if (is3D) {
        ctx.fillRect(0, horizonY, w, h - horizonY);
      } else {
        ctx.fillRect(0, 0, w, h);
      }

      // 2. MAIN ASPHALT SURFACE POLYGON
      const nearY = isLookingBack
        ? sim.player.worldY + camDistBehind - 1.2
        : sim.player.worldY - camDistBehind + 1.2;
      const farY = isLookingBack
        ? sim.player.worldY - maxLookaheadM
        : sim.player.worldY + maxLookaheadM;

      const pNearLeft = projectPoint(0, nearY);
      const pNearRight = projectPoint(totalRoadWidthM, nearY);
      const pFarLeft = projectPoint(0, farY);
      const pFarRight = projectPoint(totalRoadWidthM, farY);

      // Asphalt roadway polygon
      ctx.beginPath();
      ctx.moveTo(pNearLeft.x, pNearLeft.y);
      ctx.lineTo(pFarLeft.x, pFarLeft.y);
      ctx.lineTo(pFarRight.x, pFarRight.y);
      ctx.lineTo(pNearRight.x, pNearRight.y);
      ctx.closePath();

      const roadGrad = ctx.createLinearGradient(0, is3D ? horizonY : 0, 0, h);
      roadGrad.addColorStop(0, '#0c0d12');
      roadGrad.addColorStop(0.5, '#101219');
      roadGrad.addColorStop(1, '#141620');
      ctx.fillStyle = roadGrad;
      ctx.fill();

      // 3. FIVE TRAVEL LANES & REAL-TIME HIGHLIGHTS
      for (let l = 0; l < 5; l++) {
        const laneLeftM = HIGHWAY_GEOMETRY.leftShoulderM + l * HIGHWAY_GEOMETRY.laneWidthM;
        const laneRightM = laneLeftM + HIGHWAY_GEOMETRY.laneWidthM;
        const lane = lanes[l];
        const isCurrent = sim.player.laneIndex === l;
        const isRed = lane ? lane.recentDrop || lane.pctChange < 0 : false;
        const isCongested = lane ? lane.congestion > 0.45 : false;

        const pNL = projectPoint(laneLeftM, nearY);
        const pNR = projectPoint(laneRightM, nearY);
        const pFL = projectPoint(laneLeftM, farY);
        const pFR = projectPoint(laneRightM, farY);

        ctx.beginPath();
        ctx.moveTo(pNL.x, pNL.y);
        ctx.lineTo(pFL.x, pFL.y);
        ctx.lineTo(pFR.x, pFR.y);
        ctx.lineTo(pNR.x, pNR.y);
        ctx.closePath();

        if (isRed) {
          ctx.fillStyle = 'rgba(239, 68, 68, 0.11)';
          ctx.fill();
        } else if (isCongested) {
          ctx.fillStyle = 'rgba(249, 115, 22, 0.08)';
          ctx.fill();
        }

        if (isCurrent) {
          ctx.fillStyle = 'rgba(2, 132, 199, 0.08)';
          ctx.fill();
        }
      }

      // 4. LEFT MEDIAN & YELLOW SAFETY LINE
      const yellowNear = projectPoint(HIGHWAY_GEOMETRY.leftShoulderM, nearY);
      const yellowFar = projectPoint(HIGHWAY_GEOMETRY.leftShoulderM, farY);

      ctx.strokeStyle = '#eab308';
      ctx.lineWidth = Math.max(1.5, 3.0 * (yellowNear.scale || 1));
      ctx.beginPath();
      ctx.moveTo(yellowNear.x, yellowNear.y);
      ctx.lineTo(yellowFar.x, yellowFar.y);
      ctx.stroke();

      // Concrete median barrier wall with 3D depth
      const medNear = projectPoint(HIGHWAY_GEOMETRY.leftShoulderM - 0.6, nearY);
      const medFar = projectPoint(HIGHWAY_GEOMETRY.leftShoulderM - 0.6, farY);
      ctx.strokeStyle = '#272935';
      ctx.lineWidth = Math.max(2, 6.0 * (yellowNear.scale || 1));
      ctx.beginPath();
      ctx.moveTo(medNear.x, medNear.y);
      ctx.lineTo(medFar.x, medFar.y);
      ctx.stroke();

      // 5. DASHED WHITE LANE DIVIDERS (Continuous moving dashes in perspective)
      const dashLengthM = 3.2;
      const gapLengthM = 8.8;
      const patternM = dashLengthM + gapLengthM;
      const startWorldY = Math.floor(nearY / patternM) * patternM;

      for (let l = 1; l < 5; l++) {
        const dividerX = HIGHWAY_GEOMETRY.leftShoulderM + l * HIGHWAY_GEOMETRY.laneWidthM;

        for (let dY = startWorldY; dY < farY; dY += patternM) {
          const dNear = projectPoint(dividerX, dY);
          const dFar = projectPoint(dividerX, Math.min(farY, dY + dashLengthM));

          if (dFar.y < (is3D ? horizonY : 0) || dNear.y > h + 40) continue;

          ctx.strokeStyle = 'rgba(255, 255, 255, 0.22)';
          ctx.lineWidth = Math.max(1.0, 2.2 * dNear.scale);
          ctx.beginPath();
          ctx.moveTo(dNear.x, dNear.y);
          ctx.lineTo(dFar.x, dFar.y);
          ctx.stroke();
        }
      }

      // 6. SOLID WHITE TRAVEL EDGE & RIGHT PAVED SHOULDER (100% Cash Reserve)
      const rightEdgeX = HIGHWAY_GEOMETRY.leftShoulderM + 5 * HIGHWAY_GEOMETRY.laneWidthM;
      const edgeNear = projectPoint(rightEdgeX, nearY);
      const edgeFar = projectPoint(rightEdgeX, farY);

      ctx.strokeStyle = '#f8fafc';
      ctx.lineWidth = Math.max(1.5, 3.0 * (edgeNear.scale || 1));
      ctx.beginPath();
      ctx.moveTo(edgeNear.x, edgeNear.y);
      ctx.lineTo(edgeFar.x, edgeFar.y);
      ctx.stroke();

      // Right shoulder zone
      const isPlayerOnShoulder = sim.player.laneIndex === 5;
      const shNearR = projectPoint(totalRoadWidthM, nearY);
      const shFarR = projectPoint(totalRoadWidthM, farY);

      ctx.beginPath();
      ctx.moveTo(edgeNear.x, edgeNear.y);
      ctx.lineTo(edgeFar.x, edgeFar.y);
      ctx.lineTo(shFarR.x, shFarR.y);
      ctx.lineTo(shNearR.x, shNearR.y);
      ctx.closePath();
      ctx.fillStyle = isPlayerOnShoulder ? 'rgba(16, 185, 129, 0.15)' : 'rgba(16, 185, 129, 0.04)';
      ctx.fill();

      // Shoulder diagonal safety striping
      const stripeIntervalM = 7.0;
      const stripeStart = Math.floor(nearY / stripeIntervalM) * stripeIntervalM;
      for (let sY = stripeStart; sY < farY; sY += stripeIntervalM) {
        const sp1 = projectPoint(rightEdgeX, sY);
        const sp2 = projectPoint(totalRoadWidthM, sY + 3.0);
        if (sp1.y < (is3D ? horizonY : 0) || sp1.y > h + 40) continue;

        ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
        ctx.lineWidth = Math.max(1, 1.6 * sp1.scale);
        ctx.beginPath();
        ctx.moveTo(sp1.x, sp1.y);
        ctx.lineTo(sp2.x, sp2.y);
        ctx.stroke();
      }

      // Outer right guardrail
      const railNear = projectPoint(totalRoadWidthM + 0.4, nearY);
      const railFar = projectPoint(totalRoadWidthM + 0.4, farY);
      ctx.strokeStyle = '#272935';
      ctx.lineWidth = Math.max(2, 5.0 * (railNear.scale || 1));
      ctx.beginPath();
      ctx.moveTo(railNear.x, railNear.y);
      ctx.lineTo(railFar.x, railFar.y);
      ctx.stroke();

      // 7. 3D OVERHEAD GANTRY HIGHWAY SIGNS (Spanning across lanes)
      if (is3D) {
        const gantryIntervalM = 150;
        const gantryWorldY = Math.floor(sim.player.worldY / gantryIntervalM + 1) * gantryIntervalM;
        const gantryDz = gantryWorldY - camWorldY;

        if (gantryDz > 8 && gantryDz < maxLookaheadM) {
          const gL = projectPoint(HIGHWAY_GEOMETRY.leftShoulderM - 0.5, gantryWorldY);
          const gR = projectPoint(totalRoadWidthM + 0.5, gantryWorldY);
          const gantryH = 14 * gL.scale;

          // Steel truss frame
          ctx.strokeStyle = '#475569';
          ctx.lineWidth = Math.max(1.5, 3.5 * gL.scale);
          ctx.beginPath();
          ctx.moveTo(gL.x, gL.y);
          ctx.lineTo(gL.x, gL.y - gantryH);
          ctx.lineTo(gR.x, gR.y - gantryH);
          ctx.lineTo(gR.x, gR.y);
          ctx.stroke();

          // Green highway signage above lanes
          for (let l = 0; l < 5; l++) {
            const laneLeftM = HIGHWAY_GEOMETRY.leftShoulderM + l * HIGHWAY_GEOMETRY.laneWidthM;
            const pL = projectPoint(laneLeftM + 0.3, gantryWorldY);
            const pR = projectPoint(laneLeftM + HIGHWAY_GEOMETRY.laneWidthM - 0.3, gantryWorldY);
            const signW = pR.x - pL.x;
            const signH = 10 * pL.scale;
            const signY = pL.y - gantryH + 1;

            if (signW > 18) {
              ctx.fillStyle = '#065f46';
              ctx.fillRect(pL.x, signY, signW, signH);
              ctx.strokeStyle = '#34d399';
              ctx.lineWidth = 1;
              ctx.strokeRect(pL.x, signY, signW, signH);

              if (signW > 35) {
                const lane = lanes[l];
                ctx.fillStyle = '#ffffff';
                ctx.font = `bold ${Math.max(7, Math.floor(7 * pL.scale))}px "JetBrains Mono", monospace`;
                ctx.textAlign = 'center';
                ctx.fillText(lane ? lane.symbol : `L${l + 1}`, pL.x + signW / 2, signY + signH * 0.72);
              }
            }
          }
        }
      }

      // 8. RENDER VEHICLES IN 3D PERSPECTIVE (Back to Front Sorting)
      const allVehicles = [...sim.traffic, sim.player];
      allVehicles.sort((a, b) => (isLookingBack ? b.worldY - a.worldY : a.worldY - b.worldY));

      for (const veh of allVehicles) {
        const proj = projectPoint(veh.x, veh.worldY);

        if (proj.y < (is3D ? horizonY - 10 : -80) || proj.y > h + 100) continue;

        const s = proj.scale;
        const vWidPx = veh.width * pxPerMeterBase * s;
        const vLenPx = veh.length * pxPerMeterBase * s * (is3D ? 0.45 : 1.0);

        ctx.save();
        ctx.translate(proj.x, proj.y);

        // Continuous steering yaw angle (real physical vehicle heading)
        if (veh.yawAngle !== 0) {
          ctx.rotate(veh.yawAngle * (is3D ? 0.6 : 1.0));
        }

        // Invincibility flicker
        if (veh.isPlayer && sim.invincibleTimer > 0) {
          if (Math.floor(time * 0.015) % 2 === 0) {
            ctx.globalAlpha = 0.45;
          }
        }

        if (is3D) {
          // ==========================================
          // 3D CHASE / ELEVATED VEHICLE RENDERING
          // ==========================================
          const carHeight = (veh.type === 'semi' ? 3.4 : 1.45) * pxPerMeterBase * s * 0.65;
          const roofDepth = (veh.type === 'semi' ? 8.5 : 3.0) * pxPerMeterBase * s * (curPerspective === 'elevated' ? 0.35 : 0.18);

          // 1. Ground contact shadow
          ctx.fillStyle = 'rgba(0, 0, 0, 0.65)';
          ctx.beginPath();
          ctx.ellipse(0, 2, vWidPx * 0.58, 4 * s, 0, 0, Math.PI * 2);
          ctx.fill();

          // 2. Soft forward headlight throw on the asphalt
          ctx.fillStyle = 'rgba(254, 240, 138, 0.05)';
          ctx.beginPath();
          ctx.moveTo(-vWidPx * 0.4, -carHeight * 0.5);
          ctx.lineTo(-vWidPx * 0.9, -carHeight * 0.5 - 28 * s);
          ctx.lineTo(vWidPx * 0.9, -carHeight * 0.5 - 28 * s);
          ctx.lineTo(vWidPx * 0.4, -carHeight * 0.5);
          ctx.closePath();
          ctx.fill();

          if (veh.type === 'semi') {
            // Semi-Truck Trailer (3D Box)
            // Roof / Top
            ctx.fillStyle = '#475569';
            ctx.beginPath();
            ctx.moveTo(-vWidPx / 2, -carHeight);
            ctx.lineTo(-vWidPx * 0.44, -carHeight - roofDepth);
            ctx.lineTo(vWidPx * 0.44, -carHeight - roofDepth);
            ctx.lineTo(vWidPx / 2, -carHeight);
            ctx.closePath();
            ctx.fill();

            // Rear Face (Container doors)
            ctx.fillStyle = veh.color;
            ctx.fillRect(-vWidPx / 2, -carHeight, vWidPx, carHeight);

            // Door split seam and locking bars
            ctx.strokeStyle = '#1e293b';
            ctx.lineWidth = Math.max(1, 1.5 * s);
            ctx.beginPath();
            ctx.moveTo(0, -carHeight);
            ctx.lineTo(0, 0);
            ctx.moveTo(-vWidPx * 0.22, -carHeight);
            ctx.lineTo(-vWidPx * 0.22, 0);
            ctx.moveTo(vWidPx * 0.22, -carHeight);
            ctx.lineTo(vWidPx * 0.22, 0);
            ctx.stroke();

            // Reflective DOT red-and-white safety chevrons along bottom bumper
            ctx.fillStyle = '#ef4444';
            ctx.fillRect(-vWidPx / 2, -3 * s, vWidPx, 3 * s);
            ctx.fillStyle = '#f8fafc';
            for (let ch = -vWidPx / 2; ch < vWidPx / 2; ch += 6 * s) {
              ctx.fillRect(ch, -3 * s, 3 * s, 3 * s);
            }

            // Top clearance lights
            ctx.fillStyle = '#f59e0b';
            ctx.fillRect(-vWidPx / 2 + 2 * s, -carHeight + 1, 2 * s, 2 * s);
            ctx.fillRect(vWidPx / 2 - 4 * s, -carHeight + 1, 2 * s, 2 * s);
          } else {
            // Passenger Car / Supercar / SUV
            // 3D Roof / Hood trapezoid receding into distance
            ctx.fillStyle = 'rgba(255, 255, 255, 0.12)';
            ctx.beginPath();
            ctx.moveTo(-vWidPx * 0.4, -carHeight);
            ctx.lineTo(-vWidPx * 0.32, -carHeight - roofDepth);
            ctx.lineTo(vWidPx * 0.32, -carHeight - roofDepth);
            ctx.lineTo(vWidPx * 0.4, -carHeight);
            ctx.closePath();
            ctx.fill();

            // Rear bumper & trunk fascia
            ctx.fillStyle = veh.color;
            ctx.beginPath();
            ctx.roundRect(-vWidPx / 2, -carHeight, vWidPx, carHeight, Math.max(2, 4 * s));
            ctx.fill();

            // Rear windshield glass
            ctx.fillStyle = '#090d16';
            const glassW = vWidPx * 0.72;
            const glassH = carHeight * 0.38;
            ctx.fillRect(-glassW / 2, -carHeight + 2 * s, glassW, glassH);

            // Subtle glass highlight reflection
            ctx.fillStyle = 'rgba(255, 255, 255, 0.18)';
            ctx.fillRect(-glassW / 2 + 1, -carHeight + 3 * s, glassW - 2, 1.5 * s);

            // License plate
            ctx.fillStyle = '#f8fafc';
            ctx.fillRect(-vWidPx * 0.18, -carHeight * 0.42, vWidPx * 0.36, 3 * s);

            if (veh.isPlayer) {
              // Custom sports racing stripes on player car
              ctx.fillStyle = '#ffffff';
              ctx.fillRect(-1.5 * s, -carHeight, 3 * s, carHeight);

              // Active rear aerodynamic spoiler
              ctx.fillStyle = '#0f172a';
              ctx.fillRect(-vWidPx * 0.46, -carHeight - 2 * s, vWidPx * 0.92, 2 * s);

              // Dual polished exhaust tips with subtle heat glow
              ctx.fillStyle = '#94a3b8';
              ctx.fillRect(-vWidPx * 0.36, -2 * s, 3 * s, 2 * s);
              ctx.fillRect(vWidPx * 0.36 - 3 * s, -2 * s, 3 * s, 2 * s);
            }
          }

          // TAILLIGHTS & DYNAMIC BRAKE LIGHTS
          const isBraking = veh.brakeLight;
          const lightW = Math.max(3, 6 * s);
          const lightH = Math.max(2, 4 * s);
          const lightY = -carHeight * 0.55;

          ctx.fillStyle = isBraking ? '#ef4444' : '#7f1d1d';
          if (isBraking) {
            ctx.shadowColor = '#ef4444';
            ctx.shadowBlur = 14 * s;
          }

          // Left taillight
          ctx.fillRect(-vWidPx / 2 + 1.5 * s, lightY, lightW, lightH);
          // Right taillight
          ctx.fillRect(vWidPx / 2 - lightW - 1.5 * s, lightY, lightW, lightH);

          // Center high-mounted brake light (CHMSL)
          if (isBraking) {
            ctx.fillRect(-lightW * 0.4, -carHeight + 1.5 * s, lightW * 0.8, 2 * s);
          }
          ctx.shadowBlur = 0;

          // BLINKING AMBER TURN SIGNALS
          if (veh.turnSignal !== 'none') {
            const blinkOn = Math.floor(time * 0.008) % 2 === 0;
            if (blinkOn) {
              ctx.fillStyle = '#f59e0b';
              ctx.shadowColor = '#f59e0b';
              ctx.shadowBlur = 10 * s;
              const sigX = veh.turnSignal === 'left' ? -vWidPx / 2 + 1.5 * s : vWidPx / 2 - lightW - 1.5 * s;
              ctx.fillRect(sigX, lightY, lightW, lightH);
              ctx.shadowBlur = 0;
            }
          }

          // Floating Player Indicator Badge
          if (veh.isPlayer) {
            ctx.fillStyle = '#38bdf8';
            ctx.beginPath();
            ctx.moveTo(0, -carHeight - roofDepth - 6 * s);
            ctx.lineTo(-4 * s, -carHeight - roofDepth - 12 * s);
            ctx.lineTo(4 * s, -carHeight - roofDepth - 12 * s);
            ctx.closePath();
            ctx.fill();

            if (sim.invincibleTimer > 0) {
              ctx.strokeStyle = 'rgba(56, 189, 248, 0.8)';
              ctx.lineWidth = 2 * s;
              ctx.setLineDash([4 * s, 3 * s]);
              ctx.beginPath();
              ctx.ellipse(0, -carHeight * 0.5, vWidPx * 0.72, (carHeight + roofDepth) * 0.65, 0, 0, Math.PI * 2);
              ctx.stroke();
              ctx.setLineDash([]);
            }
          }
        } else {
          // ==========================================
          // 2D TOP-DOWN RADAR VEHICLE RENDERING
          // ==========================================
          ctx.fillStyle = 'rgba(0, 0, 0, 0.55)';
          ctx.fillRect(-vWidPx / 2 - 1, -vLenPx / 2 + 2, vWidPx + 2, vLenPx + 2);

          ctx.fillStyle = veh.color;
          ctx.beginPath();
          ctx.roundRect(-vWidPx / 2, -vLenPx / 2, vWidPx, vLenPx, 3);
          ctx.fill();

          if (veh.isPlayer) {
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(-1.5, -vLenPx / 2, 3, vLenPx);

            if (sim.invincibleTimer > 0) {
              ctx.strokeStyle = 'rgba(56, 189, 248, 0.85)';
              ctx.lineWidth = 1.5;
              ctx.setLineDash([4, 3]);
              ctx.strokeRect(-vWidPx / 2 - 3, -vLenPx / 2 - 3, vWidPx + 6, vLenPx + 6);
              ctx.setLineDash([]);
            }
          }

          // Cabin glass
          ctx.fillStyle = '#0a0d14';
          ctx.fillRect(-vWidPx * 0.36, -vLenPx * 0.25, vWidPx * 0.72, vLenPx * 0.45);

          // Taillights
          ctx.fillStyle = veh.brakeLight ? '#ef4444' : '#7f1d1d';
          ctx.fillRect(-vWidPx / 2 + 2, vLenPx / 2 - 3, 3, 2);
          ctx.fillRect(vWidPx / 2 - 5, vLenPx / 2 - 3, 3, 2);
        }

        ctx.restore();
      }

      // 9. FIXED OVERHEAD VARIABLE MESSAGE GANTRY (Top Telemetry Banner)
      const gantryH = 44;
      ctx.fillStyle = 'rgba(10, 12, 18, 0.95)';
      ctx.fillRect(0, 0, w, gantryH);
      ctx.strokeStyle = '#22232a';
      ctx.lineWidth = 1;
      ctx.strokeRect(0, 0, w, gantryH);

      const gantryLaneW = (w - 110) / 5;

      // Travel Lanes (0 to 4)
      for (let i = 0; i < 5; i++) {
        const lane = lanes[i];
        const lx = i * gantryLaneW;
        const isCurrent = sim.player.laneIndex === i;
        const isRed = lane ? lane.recentDrop || lane.pctChange < 0 : false;

        if (i > 0) {
          ctx.strokeStyle = '#1e212b';
          ctx.beginPath();
          ctx.moveTo(lx, 0);
          ctx.lineTo(lx, gantryH);
          ctx.stroke();
        }

        if (isCurrent) {
          ctx.fillStyle = 'rgba(2, 132, 199, 0.16)';
          ctx.fillRect(lx, 0, gantryLaneW, gantryH);
          ctx.fillStyle = '#0284c7';
          ctx.fillRect(lx, gantryH - 2.5, gantryLaneW, 2.5);
        }

        ctx.save();
        ctx.textAlign = 'left';
        ctx.font = '600 11px "JetBrains Mono", monospace';
        ctx.fillStyle = isCurrent ? '#38bdf8' : isRed ? '#f87171' : '#e2e8f0';
        ctx.fillText(`L${i + 1} ${lane.symbol}`, lx + 7, 16);

        ctx.textAlign = 'right';
        ctx.font = '500 10px "JetBrains Mono", monospace';
        ctx.fillStyle = '#71717a';
        ctx.fillText(`${lane.speedMph} mph`, lx + gantryLaneW - 6, 16);

        ctx.textAlign = 'left';
        ctx.font = '500 10px "JetBrains Mono", monospace';
        ctx.fillStyle = '#a1a1aa';
        ctx.fillText(`$${lane.currentPrice.toLocaleString()}`, lx + 7, 33);

        ctx.textAlign = 'right';
        ctx.font = '600 10px "JetBrains Mono", monospace';
        ctx.fillStyle = isRed ? '#ef4444' : '#10b981';
        const changeStr = `${lane.pctChange >= 0 ? '+' : ''}${lane.pctChange.toFixed(1)}%`;
        ctx.fillText(changeStr, lx + gantryLaneW - 6, 33);
        ctx.restore();
      }

      // Cash Shoulder Sign (Far Right)
      const cashStartX = 5 * gantryLaneW;
      const cashWidth = w - cashStartX;
      const isCash = sim.player.laneIndex === 5;

      ctx.save();
      ctx.strokeStyle = '#1e212b';
      ctx.beginPath();
      ctx.moveTo(cashStartX, 0);
      ctx.lineTo(cashStartX, gantryH);
      ctx.stroke();

      if (isCash) {
        ctx.fillStyle = 'rgba(16, 185, 129, 0.2)';
        ctx.fillRect(cashStartX, 0, cashWidth, gantryH);
        ctx.fillStyle = '#10b981';
        ctx.fillRect(cashStartX, gantryH - 2.5, cashWidth, 2.5);
      }

      ctx.textAlign = 'left';
      ctx.font = '700 11px "JetBrains Mono", monospace';
      ctx.fillStyle = isCash ? '#34d399' : '#10b981';
      ctx.fillText('SHOULDER', cashStartX + 8, 16);

      ctx.font = '500 10px "JetBrains Mono", monospace';
      ctx.fillStyle = '#a7f3d0';
      ctx.fillText('100% CASH', cashStartX + 8, 33);
      ctx.restore();

      ctx.restore();

      // Render 60FPS High-Fidelity Rearview Mirror reflection
      if (mirrorCanvasRef.current && mirrorModeRef.current !== 'minimized') {
        renderRearviewMirror(
          mirrorCanvasRef.current,
          sim,
          lanes,
          isMirrorDimmedRef.current,
          mirrorModeRef.current === 'panoramic',
          time
        );
      }

      animId = requestAnimationFrame(render);
    };

    animId = requestAnimationFrame(render);
    return () => cancelAnimationFrame(animId);
  }, [lanes, isPaused, distanceAccrued, onCollision, onSelectLane, onExitToCash]);

  // Click on highway to select lane or shoulder in perspective
  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const clickY = e.clientY - rect.top;

    const gantryH = 44;
    // Click on top gantry banner directly selects that lane
    if (clickY <= gantryH) {
      const gantryLaneW = (rect.width - 110) / 5;
      if (clickX >= 5 * gantryLaneW) {
        sound.playLaneSwitch();
        simRef.current.requestedLaneChange = 5;
      } else {
        const laneIdx = Math.floor(clickX / gantryLaneW);
        if (laneIdx >= 0 && laneIdx < 5) {
          sound.playLaneSwitch();
          simRef.current.requestedLaneChange = laneIdx;
        }
      }
      return;
    }

    const curPerspective = perspectiveRef.current;
    const totalRoadWidthM =
      HIGHWAY_GEOMETRY.leftShoulderM +
      HIGHWAY_GEOMETRY.numTravelLanes * HIGHWAY_GEOMETRY.laneWidthM +
      HIGHWAY_GEOMETRY.shoulderWidthM;

    const roadCenterM =
      HIGHWAY_GEOMETRY.leftShoulderM +
      (HIGHWAY_GEOMETRY.numTravelLanes * HIGHWAY_GEOMETRY.laneWidthM) / 2;

    if (curPerspective === 'topdown') {
      const roadBasePxWidth = rect.width * 0.92;
      const pxPerMeterBase = roadBasePxWidth / totalRoadWidthM;
      const vpx = rect.width / 2;
      const clickedMeterX = roadCenterM + (clickX - vpx) / (pxPerMeterBase * 0.95);

      if (clickedMeterX > HIGHWAY_GEOMETRY.leftShoulderM + 5 * HIGHWAY_GEOMETRY.laneWidthM) {
        sound.playLaneSwitch();
        simRef.current.requestedLaneChange = 5;
      } else {
        const travelM = clickedMeterX - HIGHWAY_GEOMETRY.leftShoulderM;
        const targetLane = Math.floor(travelM / HIGHWAY_GEOMETRY.laneWidthM);
        if (targetLane >= 0 && targetLane < 5) {
          sound.playLaneSwitch();
          simRef.current.requestedLaneChange = targetLane;
        }
      }
      return;
    }

    // Invert 3D Perspective Projection for click
    const horizonY = curPerspective === 'chase' ? rect.height * 0.22 : rect.height * 0.16;
    const playerScreenY = curPerspective === 'chase' ? rect.height * 0.77 : rect.height * 0.81;
    const perspectivePow = curPerspective === 'chase' ? 0.86 : 0.88;
    const roadBasePxWidth = rect.width * (curPerspective === 'chase' ? 0.88 : 0.84);
    const pxPerMeterBase = roadBasePxWidth / totalRoadWidthM;
    const vpx = rect.width / 2;
    const vpy = horizonY;

    if (clickY <= vpy + 4) {
      // Clicked near horizon or sky: horizontal determination
      const ratio = clickX / rect.width;
      if (ratio > 0.85) {
        sound.playLaneSwitch();
        simRef.current.requestedLaneChange = 5;
      } else {
        const lane = Math.min(4, Math.max(0, Math.floor(ratio * 5)));
        sound.playLaneSwitch();
        simRef.current.requestedLaneChange = lane;
      }
      return;
    }

    // Scale at click point:
    const scale = Math.max(0.02, (clickY - vpy) / (playerScreenY - vpy));
    const effectiveT = Math.pow(scale, 1 / perspectivePow);
    const meterOffset = (clickX - vpx) / (pxPerMeterBase * Math.min(2.5, effectiveT));
    const clickedMeterX = roadCenterM + meterOffset;

    if (clickedMeterX > HIGHWAY_GEOMETRY.leftShoulderM + 5 * HIGHWAY_GEOMETRY.laneWidthM) {
      sound.playLaneSwitch();
      simRef.current.requestedLaneChange = 5;
    } else {
      const travelM = clickedMeterX - HIGHWAY_GEOMETRY.leftShoulderM;
      const targetLane = Math.floor(travelM / HIGHWAY_GEOMETRY.laneWidthM);
      if (targetLane >= 0 && targetLane < 5) {
        sound.playLaneSwitch();
        simRef.current.requestedLaneChange = targetLane;
      }
    }
  };

  const mirrorWidth =
    mirrorMode === 'panoramic'
      ? dimsRef.current.width < 640
        ? 280
        : 370
      : dimsRef.current.width < 640
      ? 220
      : 276;
  const mirrorHeight = mirrorMode === 'panoramic' ? 86 : 72;

  return (
    <div
      ref={containerRef}
      className="relative w-full h-[470px] sm:h-[510px] rounded-xl overflow-hidden border border-neutral-800 bg-neutral-950 select-none shadow-md"
    >
      <canvas
        ref={canvasRef}
        onClick={handleCanvasClick}
        className="w-full h-full cursor-pointer block"
      />

      {/* Camera Perspective Mode Switcher Overlay (Top Right) */}
      <div className="absolute top-12 right-3 z-20 pointer-events-auto flex items-center gap-1 bg-neutral-950/85 backdrop-blur-md p-1 rounded-lg border border-neutral-800/90 shadow-lg text-[11px] font-mono">
        <span className="text-[10px] text-neutral-400 px-1.5 flex items-center gap-1 font-sans">
          <Camera className="w-3 h-3 text-sky-400" />
          <span className="hidden sm:inline">VIEW:</span>
        </span>

        <button
          onClick={() => {
            sound.playLaneSwitch();
            setPerspective('chase');
          }}
          className={`px-2 py-1 rounded transition-colors flex items-center gap-1 ${
            perspective === 'chase'
              ? 'bg-sky-500/20 text-sky-300 font-semibold border border-sky-500/30'
              : 'text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800/50'
          }`}
          title="Forward-facing 3D Chase Camera (Look 240m down the highway)"
        >
          <Compass className="w-3 h-3" />
          <span>3D Chase</span>
        </button>

        <button
          onClick={() => {
            sound.playLaneSwitch();
            setPerspective('elevated');
          }}
          className={`px-2 py-1 rounded transition-colors flex items-center gap-1 ${
            perspective === 'elevated'
              ? 'bg-sky-500/20 text-sky-300 font-semibold border border-sky-500/30'
              : 'text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800/50'
          }`}
          title="Elevated Tactical Drone Perspective"
        >
          <Layers className="w-3 h-3" />
          <span>3D Elevated</span>
        </button>

        <button
          onClick={() => {
            sound.playLaneSwitch();
            setPerspective('topdown');
          }}
          className={`px-2 py-1 rounded transition-colors flex items-center gap-1 ${
            perspective === 'topdown'
              ? 'bg-sky-500/20 text-sky-300 font-semibold border border-sky-500/30'
              : 'text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800/50'
          }`}
          title="Top-Down Radar Lookahead View"
        >
          <span>Top-Down</span>
        </button>

        <span className="text-[9px] text-neutral-500 px-1 border-l border-neutral-800 hidden md:inline">
          [V]
        </span>
      </div>

      {/* Automotive Rearview Mirror Assembly (Top-Center Windshield Mount) */}
      <div className="absolute top-[46px] left-1/2 -translate-x-1/2 z-20 pointer-events-auto flex flex-col items-center select-none">
        {/* Mirror Mounting Bracket connecting down from Overhead Gantry */}
        <div className="w-8 h-2 bg-gradient-to-b from-neutral-800 to-neutral-900 border-x border-neutral-700/80 rounded-t-sm shadow-md flex items-center justify-center">
          <div className="w-2.5 h-1 bg-neutral-950 rounded-full" />
        </div>

        {mirrorMode === 'minimized' ? (
          <button
            onClick={() => {
              sound.playMirrorClick();
              setMirrorMode('standard');
            }}
            className="px-3 py-1 bg-neutral-900/90 hover:bg-neutral-800/95 backdrop-blur-md border border-neutral-700/80 rounded-full shadow-lg text-[10px] font-mono text-neutral-300 flex items-center gap-1.5 transition-all hover:scale-105 active:scale-95"
            title="Click or press [M] to expand Rearview Mirror"
          >
            <Eye className="w-3 h-3 text-sky-400" />
            <span>REARVIEW [M]</span>
            <span className="text-neutral-500">|</span>
            <span className={rearTelemetry.isTailgating ? 'text-rose-400 font-bold animate-pulse' : 'text-neutral-400'}>
              {rearTelemetry.trailingGapM < 999 ? `${rearTelemetry.trailingGapM}m` : 'CLEAR'}
            </span>
            <Maximize2 className="w-2.5 h-2.5 text-neutral-400 ml-0.5" />
          </button>
        ) : (
          <div className="relative flex flex-col items-center">
            {/* Outer Beveled Mirror Housing */}
            <div className="p-1 rounded-xl bg-gradient-to-b from-neutral-800 via-neutral-900 to-neutral-950 border border-neutral-700/90 shadow-[0_8px_24px_rgba(0,0,0,0.7)] flex flex-col items-center">
              {/* Mirror Glass Canvas */}
              <canvas
                ref={mirrorCanvasRef}
                width={mirrorWidth * (dimsRef.current.dpr || 1)}
                height={mirrorHeight * (dimsRef.current.dpr || 1)}
                onClick={() => {
                  sound.playMirrorClick();
                  setMirrorMode((prev) => (prev === 'standard' ? 'panoramic' : 'standard'));
                }}
                className="rounded-lg cursor-pointer block"
                style={{ width: `${mirrorWidth}px`, height: `${mirrorHeight}px` }}
                title="Click to toggle Wide-Angle Panoramic / Standard Rearview"
              />

              {/* Bottom Mirror Bezel Controls & Day/Night Flip Tab */}
              <div className="w-full pt-1 px-1.5 flex items-center justify-between text-[9px] font-mono text-neutral-400">
                {/* Look Behind Quick Button */}
                <button
                  onClick={() => {
                    sound.playMirrorClick();
                    setIsLookBehind((prev) => !prev);
                  }}
                  className={`px-1.5 py-0.5 rounded transition-colors flex items-center gap-1 ${
                    isLookBehind
                      ? 'bg-sky-500/30 text-sky-300 font-bold border border-sky-500/40'
                      : 'hover:text-neutral-200 hover:bg-neutral-800/60'
                  }`}
                  title="Press [R] or click to Look Behind with main camera"
                >
                  <RotateCcw className="w-2.5 h-2.5" />
                  <span className="hidden sm:inline">GLANCE</span> [R]
                </button>

                {/* Mechanical Day/Night Flip Tab (Center) */}
                <button
                  onClick={() => {
                    sound.playMirrorClick();
                    setIsMirrorDimmed((prev) => !prev);
                  }}
                  className="flex items-center gap-1.5 px-2 py-0.5 bg-neutral-950/80 hover:bg-neutral-800/90 rounded border border-neutral-700/70 transition-all active:scale-95"
                  title="Flip Day/Night tab: toggles electrochromic anti-glare mirror tint"
                >
                  <span
                    className={`w-1.5 h-1.5 rounded-full transition-colors ${
                      isMirrorDimmed
                        ? 'bg-emerald-400 shadow-[0_0_6px_#34d399]'
                        : 'bg-neutral-600'
                    }`}
                  />
                  <span className="text-[8.5px] font-semibold tracking-wide text-neutral-300">
                    {isMirrorDimmed ? 'AUTO-DIM' : 'DAY'}
                  </span>
                </button>

                {/* Right Controls: Mode Toggle & Minimize */}
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => {
                      sound.playMirrorClick();
                      setMirrorMode((prev) => (prev === 'standard' ? 'panoramic' : 'standard'));
                    }}
                    className="px-1 py-0.5 hover:text-neutral-200 hover:bg-neutral-800/60 rounded"
                    title={mirrorMode === 'panoramic' ? 'Switch to Standard Width' : 'Switch to Wide-Angle Panoramic'}
                  >
                    {mirrorMode === 'panoramic' ? 'STD' : 'WIDE'}
                  </button>

                  <button
                    onClick={() => {
                      sound.playMirrorClick();
                      setMirrorMode('minimized');
                    }}
                    className="p-0.5 hover:text-neutral-200 hover:bg-neutral-800/60 rounded"
                    title="Minimize mirror to badge [M]"
                  >
                    <Minimize2 className="w-2.5 h-2.5" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Look Behind Mode Active Indicator */}
      {isLookBehind && (
        <div className="absolute top-[134px] left-1/2 -translate-x-1/2 z-20 pointer-events-none animate-pulse">
          <div className="bg-sky-950/90 border border-sky-500/80 text-sky-200 text-xs font-mono font-bold px-3 py-1 rounded-full shadow-[0_0_16px_rgba(56,189,248,0.5)] flex items-center gap-1.5 backdrop-blur-sm">
            <RotateCcw className="w-3.5 h-3.5 text-sky-400" />
            <span>LOOKING BEHIND [R] — RELEASE OR TAP [R] TO RETURN</span>
          </div>
        </div>
      )}

      {/* Dynamic Cockpit Collision Alert (Positioned below the rearview mirror) */}
      {hudStats.leadBraking && !isLookBehind && (
        <div className="absolute top-[134px] left-1/2 -translate-x-1/2 pointer-events-none z-20 animate-bounce">
          <div className="bg-rose-950/90 border border-rose-500/80 text-rose-200 text-xs font-mono font-bold px-3 py-1.5 rounded-full shadow-[0_0_16px_rgba(239,68,68,0.6)] flex items-center gap-1.5 backdrop-blur-sm">
            <AlertCircle className="w-3.5 h-3.5 text-rose-400 animate-pulse" />
            <span>BRAKE AHEAD — TAP [S] OR STEER TO PASS</span>
          </div>
        </div>
      )}

      {/* Real-time Highway Cockpit HUD & Pedals */}
      <div className="absolute bottom-2.5 left-3 right-3 pointer-events-none flex flex-wrap items-center justify-between gap-2 text-xs font-mono">
        {/* Speedometer & Human Headway Telemetry */}
        <div className="flex items-center gap-2.5 bg-neutral-900/95 backdrop-blur-md px-3 py-1.5 rounded-lg border border-neutral-800 text-neutral-300 pointer-events-auto shadow-md">
          <div className="flex items-baseline gap-1">
            <span className="font-bold text-sm text-neutral-100 tabular-nums">
              {hudStats.speedMph}
            </span>
            <span className="text-[10px] text-neutral-500">MPH</span>
          </div>

          <span className="text-neutral-600">|</span>

          {/* Turn Signal Indicator */}
          <div className="flex items-center gap-1 text-[11px]">
            <span
              className={`font-bold ${
                hudStats.turnSignal === 'left' ? 'text-amber-400 animate-pulse' : 'text-neutral-600'
              }`}
            >
              ◄
            </span>
            <span className="text-[10px] text-neutral-400">SIGNAL</span>
            <span
              className={`font-bold ${
                hudStats.turnSignal === 'right' ? 'text-amber-400 animate-pulse' : 'text-neutral-600'
              }`}
            >
              ►
            </span>
          </div>

          <span className="text-neutral-600">|</span>

          {/* Headway to car ahead */}
          <div className="text-[11px]">
            <span className="text-neutral-500">Headway: </span>
            <span
              className={`font-bold tabular-nums ${
                hudStats.headwayMeters < 15
                  ? 'text-rose-400'
                  : hudStats.headwayMeters < 35
                  ? 'text-amber-400'
                  : 'text-neutral-200'
              }`}
            >
              {hudStats.headwayMeters > 200 ? 'Clear (200m+)' : `${hudStats.headwayMeters}m`}
            </span>
            {hudStats.closingMph > 0 && hudStats.headwayMeters < 50 && (
              <span className="text-rose-400 ml-1 font-semibold tabular-nums">
                (+{hudStats.closingMph}mph)
              </span>
            )}
          </div>

          {/* Current Position Tag */}
          <span className="text-neutral-600">|</span>
          <span
            className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${
              currentLaneIndex === 5
                ? 'bg-emerald-500/20 text-emerald-300'
                : 'bg-sky-500/20 text-sky-300'
            }`}
          >
            {currentLaneIndex === 5 ? '100% CASH SHOULDER' : `${lanes[currentLaneIndex]?.symbol} POSITION`}
          </span>
        </div>

        {/* Human Driving Pedals (Full Authority Braking & Throttle) */}
        <div className="flex items-center gap-2 pointer-events-auto">
          <button
            onMouseDown={() => {
              keysHeldRef.current.brake = true;
              sound.playBrakeScreech();
            }}
            onMouseUp={() => {
              keysHeldRef.current.brake = false;
            }}
            onMouseLeave={() => {
              keysHeldRef.current.brake = false;
            }}
            onTouchStart={() => {
              keysHeldRef.current.brake = true;
              sound.playBrakeScreech();
            }}
            onTouchEnd={() => {
              keysHeldRef.current.brake = false;
            }}
            className={`px-3 py-1.5 rounded-lg border text-xs font-bold font-mono transition-colors active:scale-95 flex items-center gap-1.5 ${
              hudStats.isBraking
                ? 'bg-rose-600 text-white border-rose-500 shadow-[0_0_12px_rgba(239,68,68,0.5)]'
                : 'bg-neutral-900/90 hover:bg-neutral-800 text-neutral-300 border-neutral-700'
            }`}
            title="Press or hold [S] / [Down] to brake down to 0 mph"
          >
            <span className="w-2 h-2 rounded-full bg-rose-500" />
            BRAKE [S]
          </button>

          <button
            onMouseDown={() => {
              keysHeldRef.current.gas = true;
            }}
            onMouseUp={() => {
              keysHeldRef.current.gas = false;
            }}
            onMouseLeave={() => {
              keysHeldRef.current.gas = false;
            }}
            onTouchStart={() => {
              keysHeldRef.current.gas = true;
            }}
            onTouchEnd={() => {
              keysHeldRef.current.gas = false;
            }}
            className="px-3 py-1.5 rounded-lg border text-xs font-bold font-mono bg-neutral-900/90 hover:bg-neutral-800 text-neutral-300 border-neutral-700 transition-colors active:scale-95 flex items-center gap-1.5"
            title="Press or hold [W] / [Up] to throttle"
          >
            <span className="w-2 h-2 rounded-full bg-emerald-500" />
            GAS [W]
          </button>

          {/* Sell to Cash Button directly in cockpit */}
          {currentLaneIndex !== 5 && (
            <button
              onClick={() => {
                sound.playLaneSwitch();
                simRef.current.requestedLaneChange = 5;
              }}
              className="px-2.5 py-1.5 rounded-lg border text-xs font-medium font-mono bg-emerald-950/40 hover:bg-emerald-900/60 text-emerald-300 border-emerald-700/60 transition-colors active:scale-95"
              title="Sell active stock to 100% Cash (park on shoulder without buying a new stock)"
            >
              Sell to Cash [C]
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
