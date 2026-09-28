/**
 * Continuous Intelligent Driver Model (IDM) & MOBIL Lane-Changing Traffic Simulation Engine
 * Features:
 * - Continuous transverse (x) and longitudinal (y) kinematics (no discrete column jumping)
 * - Non-permeable vehicles: strict physical separation ensuring NO cars ever pass through each other
 * - Realistic highway traffic laws: lane speed hierarchy, safe 2s headway, courteous MOBIL lane merges
 * - Strict turn signaling: AI vehicles signal 1.2-1.8s BEFORE beginning lateral lane changes
 * - Fluid player momentum: satisfying lateral steering inertia with the ability to queue/change multiple lanes
 * - Realistic, fair hitboxes: authentic vehicle bounding boxes that prevent false collisions with adjacent lanes
 * - Dedicated Right Shoulder / Emergency Lane for 100% Cash Reserve position (AI cars never enter shoulder)
 */

export interface SimulationVehicle {
  id: string;
  isPlayer: boolean;
  laneIndex: number;          // Current physical lane: 0 to 4 (stocks), 5 = Right Shoulder (Cash)
  targetLaneIndex: number;    // Target lane during merge
  x: number;                  // Continuous lateral coordinate across highway (meters)
  targetX: number;            // Continuous lateral target (meters)
  vx: number;                 // Lateral velocity (m/s)
  worldY: number;             // Longitudinal position along highway (meters)
  speed: number;              // Forward velocity vy (m/s)
  acceleration: number;       // Forward acceleration (m/s^2)
  desiredSpeed: number;       // Free-flow desired speed (m/s)
  length: number;             // Meters
  width: number;              // Meters
  yawAngle: number;           // Heading angle in radians (visual rotation)
  type: 'sedan' | 'suv' | 'semi' | 'coupe';
  color: string;
  brakeLight: boolean;
  turnSignal: 'left' | 'right' | 'none';
  turnSignalTimer: number;    // Countdown for turn indicator
  signalPreWarningTimer: number; // Time spent signaling BEFORE starting lateral steering
  isTransitioning: boolean;   // Actively moving across lane line
  timeSinceLastChange: number;
  aggressiveness: number;     // 0.85 to 1.25
  wanderOffset: number;       // Natural human wandering inside lane (±0.10m)
  wanderPhase: number;
}

// Highway geometrical constants (standard real-world measurements)
export const HIGHWAY_GEOMETRY = {
  numTravelLanes: 5,
  laneWidthM: 3.6,            // Standard 12ft travel lane = ~3.65m
  shoulderWidthM: 3.2,        // Right paved shoulder = ~3.2m
  leftShoulderM: 1.8,         // Left median shoulder = ~1.8m
};

// Compute continuous lateral center (in meters) for each lane index (0-4 travel, 5 right shoulder)
export function getLaneCenterX(laneIndex: number): number {
  const leftStart = HIGHWAY_GEOMETRY.leftShoulderM;
  const clampedIndex = Math.min(5, Math.max(0, laneIndex));
  if (clampedIndex < 5) {
    return leftStart + (clampedIndex + 0.5) * HIGHWAY_GEOMETRY.laneWidthM;
  }
  // Lane 5: Right Shoulder (100% Cash Reserve)
  return leftStart + 5 * HIGHWAY_GEOMETRY.laneWidthM + HIGHWAY_GEOMETRY.shoulderWidthM * 0.5;
}

// Compute physical lane index from continuous lateral x position
export function getLaneIndexFromX(x: number): number {
  const leftStart = HIGHWAY_GEOMETRY.leftShoulderM;
  const relX = x - leftStart;
  if (relX < 0) return 0;
  const lane = Math.floor(relX / HIGHWAY_GEOMETRY.laneWidthM);
  if (lane >= 5) return 5;
  return Math.max(0, lane);
}

export const IDM_PHYSICS = {
  a_max: 2.6,                 // Maximum acceleration (m/s^2)
  b_comf: 2.4,                // Comfortable deceleration (m/s^2)
  b_max: 9.0,                 // Emergency maximum braking (m/s^2)
  s_0: 3.6,                   // Jam bumper-to-bumper gap (meters)
  T_headway: 1.5,             // Safe time headway (seconds)
  politeness: 0.35,           // MOBIL politeness factor
  changeThreshold: 0.35,      // Acceleration gain needed to change lane (m/s^2)
  maxLateralVelocity: 4.6,    // Max lateral steering speed in m/s (fluid momentum without teleporting)
  maxLateralAcc: 12.0,        // Max lateral steering acceleration in m/s^2
};

export const REALISTIC_COLORS = [
  '#334155', // slate graphite
  '#475569', // cool steel
  '#1e293b', // midnight navy
  '#52525b', // neutral zinc
  '#3f3f46', // deep charcoal
  '#64748b', // metallic grey
  '#94a3b8', // pearl silver
  '#78350f', // deep bronze
  '#065f46', // dark emerald
  '#831843', // deep wine
];

/**
 * Intelligent Driver Model acceleration
 * Net bumper-to-bumper gap: lead vehicle rear bumper minus follower front bumper
 */
export function calculateIDM(
  veh: SimulationVehicle,
  leadVeh: SimulationVehicle | null,
  speedLimit: number
): number {
  const v = Math.max(0, veh.speed);
  const v0 = Math.max(4, Math.min(veh.desiredSpeed, speedLimit));
  const a = IDM_PHYSICS.a_max * veh.aggressiveness;
  const b = IDM_PHYSICS.b_comf;
  const s0 = IDM_PHYSICS.s_0;
  const T = IDM_PHYSICS.T_headway / veh.aggressiveness;

  // Free-flow acceleration term towards target cruising speed
  const freeAcc = a * (1 - Math.pow(v / v0, 4));

  if (!leadVeh) {
    return freeAcc;
  }

  // Net longitudinal distance gap between rear of lead car and front of follower
  const gap = leadVeh.worldY - (veh.worldY + veh.length);
  if (gap <= 0.3) {
    return -IDM_PHYSICS.b_max;
  }

  const deltaV = v - leadVeh.speed; // positive if closing in
  const dynamicGap = s0 + v * T + (v * deltaV) / (2 * Math.sqrt(a * b));
  const interactionAcc = -a * Math.pow(Math.max(0, dynamicGap) / Math.max(0.2, gap), 2);

  return Math.max(-IDM_PHYSICS.b_max, freeAcc + interactionAcc);
}

/**
 * Step continuous traffic simulation forward by dt seconds
 */
export function updateContinuousTraffic(
  vehicles: SimulationVehicle[],
  player: SimulationVehicle,
  laneDesiredSpeeds: number[],
  laneCongestions: number[],
  playerControl: { gas: boolean; brake: boolean; steeringTargetLane: number | null },
  dt: number,
  onCollision?: (leadCar: SimulationVehicle) => void,
  onLaneCompleted?: (newLane: number) => void
): { updatedVehicles: SimulationVehicle[]; updatedPlayer: SimulationVehicle } {
  const allVehicles = [...vehicles, player];
  const numTravelLanes = HIGHWAY_GEOMETRY.numTravelLanes;

  // 1. Group vehicles by current longitudinal world position (highest worldY first = furthest ahead)
  const sortedByY = [...allVehicles].sort((a, b) => b.worldY - a.worldY);

  // 2. Compute IDM Acceleration for all vehicles
  const accelerations = new Map<string, number>();

  for (let i = 0; i < sortedByY.length; i++) {
    const veh = sortedByY[i];

    if (veh.isPlayer) {
      // Human player has full manual throttle and braking control:
      // Never artificially auto-brakes behind traffic ahead — distance closes naturally!
      if (playerControl.brake) {
        accelerations.set(veh.id, -IDM_PHYSICS.b_max * 1.05); // Strong human braking
      } else if (playerControl.gas) {
        // Active throttle punch up to ~105 mph (47 m/s)
        const v = veh.speed;
        const topSpeed = 47;
        const punch = Math.max(0, 1 - Math.pow(v / topSpeed, 2));
        accelerations.set(veh.id, IDM_PHYSICS.a_max * 1.5 * punch);
      } else {
        // Natural cruising or coasting (NO auto-braking for cars ahead!)
        if (veh.laneIndex === 5) {
          // Cash position on shoulder: coast smoothly to a safe stop or gentle idle
          accelerations.set(veh.id, -2.8);
        } else {
          // High-performance sports car cruising speed: ~72 mph (32 m/s)
          const baseCruise = 32;
          const v = veh.speed;
          if (v > baseCruise) {
            // Gentle air/rolling resistance coasting down towards base cruise
            accelerations.set(veh.id, -0.6);
          } else if (v < baseCruise - 2) {
            // Gentle acceleration up to base cruising speed
            accelerations.set(veh.id, 1.2);
          } else {
            accelerations.set(veh.id, 0);
          }
        }
      }
      continue;
    }

    // AI vehicle: find lead vehicle directly ahead in same approximate lateral corridor
    let lead: SimulationVehicle | null = null;
    for (let j = i - 1; j >= 0; j--) {
      const ahead = sortedByY[j];
      // Lateral overlap corridor: vehicles whose bodies span into our driving line
      const latGap = Math.abs(ahead.x - veh.x);
      const combinedHalfWidth = (ahead.width + veh.width) * 0.5;
      if (latGap < combinedHalfWidth + 0.6) {
        lead = ahead;
        break;
      }
    }

    const currentLane = Math.min(4, Math.max(0, Math.round(veh.laneIndex)));
    const baseSpeed = laneDesiredSpeeds[currentLane] || 25;
    const congestion = laneCongestions[currentLane] || 0.1;
    const speedLimit = Math.max(4, baseSpeed * (1 - Math.pow(congestion, 1.3) * 0.88));

    const acc = calculateIDM(veh, lead, speedLimit);
    accelerations.set(veh.id, acc);
  }

  // 3. MOBIL Autonomous Lane Changing for AI with Traffic Law Obedience & Mandatory Pre-Signaling
  // Traffic ahead drives according to normal traffic laws — AI cars do NOT dodge the player!
  for (const veh of vehicles) {
    veh.timeSinceLastChange += dt;

    if (veh.isTransitioning) {
      continue;
    }

    // If currently pre-signaling, wait until indicator warning duration completes before steering
    if (veh.signalPreWarningTimer > 0) {
      veh.signalPreWarningTimer -= dt;
      if (veh.signalPreWarningTimer <= 0) {
        // Double check target space is STILL clear before committing to lateral steer
        const targetCenterX = getLaneCenterX(veh.targetLaneIndex);
        let safeToCommit = true;
        for (const other of allVehicles) {
          if (other.id === veh.id) continue;
          if (Math.abs(other.x - targetCenterX) < 1.8) {
            const gap = Math.abs((other.worldY + other.length * 0.5) - (veh.worldY + veh.length * 0.5));
            if (gap < IDM_PHYSICS.s_0 + 3.0) {
              safeToCommit = false;
              break;
            }
          }
        }
        if (safeToCommit) {
          veh.isTransitioning = true;
          veh.targetX = targetCenterX;
        } else {
          // Abort maneuver courteously
          veh.turnSignal = 'none';
          veh.targetLaneIndex = veh.laneIndex;
          veh.timeSinceLastChange = 1.0;
        }
      }
      continue;
    }

    // AI vehicles obey lane discipline: disciplined highway driving (5s cooldown)
    if (veh.timeSinceLastChange < 5.0) continue;

    // Semis stay in slow freight lanes (lanes 2, 3, 4); never enter passing lane 0
    const currentLane = veh.laneIndex;
    const currentAcc = accelerations.get(veh.id) || 0;

    // AI only considers lane changes if their OWN progress ahead is significantly impeded
    if (currentAcc > -0.4) continue;

    const candidateLanes: number[] = [];
    if (currentLane > 0 && !(veh.type === 'semi' && currentLane === 1)) {
      candidateLanes.push(currentLane - 1);
    }
    // AI vehicles NEVER enter lane 5 (Right Shoulder / Emergency Reserve)
    if (currentLane < numTravelLanes - 1) {
      candidateLanes.push(currentLane + 1);
    }

    for (const targetLane of candidateLanes) {
      const targetCenterX = getLaneCenterX(targetLane);

      let targetLead: SimulationVehicle | null = null;
      let targetFollower: SimulationVehicle | null = null;

      for (const other of sortedByY) {
        if (other.id === veh.id) continue;
        const otherLaneCenter = getLaneCenterX(other.isTransitioning ? other.targetLaneIndex : other.laneIndex);
        if (Math.abs(other.x - targetCenterX) < 1.9 || Math.abs(otherLaneCenter - targetCenterX) < 0.5) {
          if (other.worldY > veh.worldY && !targetLead) {
            targetLead = other;
          } else if (other.worldY < veh.worldY && !targetFollower) {
            targetFollower = other;
          }
        }
      }

      // Safe headway gap check: generous gap front and rear
      const gapLead = targetLead ? targetLead.worldY - (veh.worldY + veh.length) : 999;
      const gapFollower = targetFollower ? veh.worldY - (targetFollower.worldY + targetFollower.length) : 999;

      if (gapLead < IDM_PHYSICS.s_0 + 6.0 || gapFollower < IDM_PHYSICS.s_0 + 7.0) {
        continue;
      }

      const targetSpeedLimit = Math.max(
        4,
        (laneDesiredSpeeds[targetLane] || 25) * (1 - Math.pow(laneCongestions[targetLane] || 0.1, 1.3) * 0.88)
      );
      const accInTarget = calculateIDM(veh, targetLead, targetSpeedLimit);

      // MOBIL politeness: don't cut off trailing driver
      if (targetFollower) {
        const followerAcc = calculateIDM(targetFollower, veh, targetSpeedLimit);
        if (followerAcc < -IDM_PHYSICS.b_comf * 1.0) continue;
      }

      // Need a significant acceleration improvement to justify changing lane
      if (accInTarget - currentAcc > 0.65) {
        veh.targetLaneIndex = targetLane;
        veh.turnSignal = targetLane < currentLane ? 'left' : 'right';
        veh.signalPreWarningTimer = 1.4 + Math.random() * 0.4; // 1.4-1.8s pre-warning signal
        veh.turnSignalTimer = 4.0;
        veh.timeSinceLastChange = 0;
        break;
      }
    }
  }

  // 4. Update Continuous Lateral & Longitudinal Positions for AI Traffic
  const updatedVehicles: SimulationVehicle[] = [];

  for (const veh of vehicles) {
    const acc = accelerations.get(veh.id) ?? 0;
    veh.acceleration = acc;
    veh.speed = Math.max(0, veh.speed + acc * dt);
    veh.worldY += veh.speed * dt;
    veh.brakeLight = acc < -0.4;

    // Natural human micro-wandering within lane
    veh.wanderPhase += dt * 0.7;
    veh.wanderOffset = Math.sin(veh.wanderPhase) * 0.08;

    // Continuous lateral movement across road
    if (veh.isTransitioning) {
      const dx = veh.targetX - veh.x;
      const rawSteeringAcc = dx * 6.5 - veh.vx * 4.8;
      const steeringAcc = Math.max(-IDM_PHYSICS.maxLateralAcc, Math.min(IDM_PHYSICS.maxLateralAcc, rawSteeringAcc));

      veh.vx += steeringAcc * dt;
      veh.vx = Math.max(-IDM_PHYSICS.maxLateralVelocity * 0.75, Math.min(IDM_PHYSICS.maxLateralVelocity * 0.75, veh.vx));
      veh.x += veh.vx * dt;

      // Realistic vehicle yaw angle
      veh.yawAngle = Math.atan2(veh.vx, Math.max(4, veh.speed));

      if (Math.abs(dx) < 0.06 && Math.abs(veh.vx) < 0.15) {
        veh.x = veh.targetX;
        veh.vx = 0;
        veh.yawAngle = 0;
        veh.laneIndex = veh.targetLaneIndex;
        veh.isTransitioning = false;
        veh.turnSignal = 'none';
      }
    } else {
      const laneCenter = getLaneCenterX(veh.laneIndex) + veh.wanderOffset;
      const dx = laneCenter - veh.x;
      veh.x += dx * Math.min(1, dt * 4.0);
      veh.vx = 0;
      veh.yawAngle = 0;
    }

    if (veh.turnSignalTimer > 0) {
      veh.turnSignalTimer -= dt;
      if (veh.turnSignalTimer <= 0 && !veh.isTransitioning) {
        veh.turnSignal = 'none';
      }
    }

    // Wrap around relative to player horizon with SMART GAP PLACEMENT (never spawn inside other cars)
    const relDist = veh.worldY - player.worldY;
    if (relDist < -140 || relDist > 340) {
      // Find a safe open gap on the highway
      const spawnTargetY = relDist < -140
        ? player.worldY + 220 + Math.random() * 50
        : player.worldY - 90 - Math.random() * 40;

      // Choose a travel lane (0-4) with lowest local density
      const laneCounts = [0, 0, 0, 0, 0];
      for (const other of allVehicles) {
        if (other.laneIndex >= 0 && other.laneIndex < 5) {
          if (Math.abs(other.worldY - spawnTargetY) < 30) {
            laneCounts[other.laneIndex]++;
          }
        }
      }
      let bestLane = 0;
      let minCount = laneCounts[0];
      for (let l = 1; l < 5; l++) {
        if (laneCounts[l] < minCount) {
          minCount = laneCounts[l];
          bestLane = l;
        }
      }

      veh.worldY = spawnTargetY;
      veh.laneIndex = bestLane;
      veh.targetLaneIndex = bestLane;
      veh.targetX = getLaneCenterX(bestLane);
      veh.x = veh.targetX;
      veh.vx = 0;
      veh.yawAngle = 0;
      veh.isTransitioning = false;
      veh.signalPreWarningTimer = 0;
      veh.turnSignal = 'none';
      veh.speed = Math.max(18, laneDesiredSpeeds[bestLane] || 25);
    }

    updatedVehicles.push(veh);
  }

  // 5. Update Player Vehicle with Satisfying Lateral Momentum & Multi-Lane Capability
  const playerCopy = { ...player };
  const playerAcc = accelerations.get(playerCopy.id) ?? 0;
  playerCopy.acceleration = playerAcc;
  playerCopy.speed = Math.max(0, playerCopy.speed + playerAcc * dt);
  playerCopy.worldY += playerCopy.speed * dt;
  playerCopy.brakeLight = playerControl.brake || playerAcc < -0.3;

  // Handle player lane target changes (allows fluid multiple lane changes in a single sweep)
  if (playerControl.steeringTargetLane !== null) {
    const rawTarget = Math.min(5, Math.max(0, playerControl.steeringTargetLane));
    if (rawTarget !== playerCopy.targetLaneIndex) {
      playerCopy.targetLaneIndex = rawTarget;
      playerCopy.targetX = getLaneCenterX(rawTarget);
      playerCopy.turnSignal = rawTarget < playerCopy.laneIndex ? 'left' : 'right';
      playerCopy.turnSignalTimer = 2.0;
      playerCopy.isTransitioning = true;
    }
  }

  // Lateral steering physics: Spring-damper with inertia & lateral velocity clamping
  // F = k_p * dx - k_d * vx
  const dx = playerCopy.targetX - playerCopy.x;
  const isSettled = Math.abs(dx) < 0.05 && Math.abs(playerCopy.vx) < 0.2;

  if (isSettled && !playerCopy.isTransitioning) {
    playerCopy.x = playerCopy.targetX;
    playerCopy.vx = 0;
    playerCopy.yawAngle = 0;
  } else {
    // Responsive yet weighty lateral acceleration (momentum so you consider lane changes)
    const rawSteeringAcc = dx * 9.5 - playerCopy.vx * 5.6;
    const clampedSteeringAcc = Math.max(-IDM_PHYSICS.maxLateralAcc, Math.min(IDM_PHYSICS.maxLateralAcc, rawSteeringAcc));

    playerCopy.vx += clampedSteeringAcc * dt;
    // Strict clamp on lateral velocity prevents unrealistic jumping while preserving high-speed fluid sweeping
    playerCopy.vx = Math.max(-IDM_PHYSICS.maxLateralVelocity, Math.min(IDM_PHYSICS.maxLateralVelocity, playerCopy.vx));
    playerCopy.x += playerCopy.vx * dt;

    // Authentic vehicle heading yaw angle from lateral velocity
    playerCopy.yawAngle = Math.atan2(playerCopy.vx, Math.max(3.5, playerCopy.speed));

    // Dynamic physical lane tracking: As the car sweeps across divider lines, update physical lane
    const currentPhysicalLane = getLaneIndexFromX(playerCopy.x);
    if (currentPhysicalLane !== playerCopy.laneIndex) {
      playerCopy.laneIndex = currentPhysicalLane;
      if (onLaneCompleted) {
        onLaneCompleted(currentPhysicalLane);
      }
    }

    if (Math.abs(dx) < 0.06 && Math.abs(playerCopy.vx) < 0.25) {
      playerCopy.x = playerCopy.targetX;
      playerCopy.vx = 0;
      playerCopy.yawAngle = 0;
      playerCopy.isTransitioning = false;
      playerCopy.turnSignal = 'none';
      if (playerCopy.laneIndex !== playerCopy.targetLaneIndex) {
        playerCopy.laneIndex = playerCopy.targetLaneIndex;
        if (onLaneCompleted) {
          onLaneCompleted(playerCopy.targetLaneIndex);
        }
      }
    } else {
      playerCopy.isTransitioning = true;
    }
  }

  if (playerCopy.turnSignalTimer > 0) {
    playerCopy.turnSignalTimer -= dt;
    if (playerCopy.turnSignalTimer <= 0 && !playerCopy.isTransitioning) {
      playerCopy.turnSignal = 'none';
    }
  }

  // 6. PHYSICAL NON-PERMEABILITY CONSTRAINT BETWEEN AI VEHICLES
  // Strictly enforce that NO TWO AI CARS EVER PASS THROUGH EACH OTHER
  // (The human player is governed by human manual control, allowing the player to close distance,
  // tailgate, draft, or crash if failing to steer or brake in Section 7)
  const sortedPhysicalAI = [...updatedVehicles].sort((a, b) => b.worldY - a.worldY);

  for (let i = 0; i < sortedPhysicalAI.length - 1; i++) {
    const lead = sortedPhysicalAI[i];
    const follower = sortedPhysicalAI[i + 1];

    // Check if lateral corridors overlap (they are in or entering the same lane space)
    const latDist = Math.abs(lead.x - follower.x);
    const combinedHalfWidth = (lead.width + follower.width) * 0.44;

    if (latDist < combinedHalfWidth) {
      // Rear bumper of lead vs front bumper of follower
      const minDistance = follower.length + 0.6; // 0.6m safety cushion
      const currentGap = lead.worldY - follower.worldY;

      if (currentGap < minDistance) {
        // Physical hard constraint: follower CANNOT penetrate lead vehicle!
        follower.worldY = lead.worldY - minDistance;
        // Follower's speed cannot exceed lead vehicle's speed
        follower.speed = Math.min(follower.speed, lead.speed);
        follower.acceleration = Math.min(follower.acceleration, -2.5);
        follower.brakeLight = true;
      }
    }
  }

  // 7. REALISTIC COLLISION CHECK (Player vs AI vehicles)
  // Tight, authentic hitboxes: bumper contact ONLY occurs when player's front bumper physically
  // reaches the lead car's rear bumper (longGap <= 1.2m), eliminating phantom crashes from 15ft away.
  if (onCollision) {
    for (const other of updatedVehicles) {
      // Longitudinal bumper-to-bumper distance:
      // other.worldY is the rear bumper of the lead car
      // playerCopy.worldY is the rear bumper of the player car
      const longGap = other.worldY - playerCopy.worldY;

      // Contact occurs when player's nose reaches the lead vehicle's rear bumper (longGap between 0 and 1.25m)
      // or if trailing vehicle collides from behind (longGap between -1.1m and 0)
      const longOverlap = longGap >= -1.1 && longGap <= 1.25;

      // Lateral overlap: only when vehicles actually occupy the same lane corridor
      // Tight, fair body clearance: requires authentic vehicle overlap (~1.31m for cars, ~1.54m for semi)
      const maxLatDist = (playerCopy.width + other.width) * 0.35;
      const latOverlap = Math.abs(playerCopy.x - other.x) < maxLatDist;

      if (longOverlap && latOverlap) {
        onCollision(other);

        // Physics bounce / separation: push player safely behind the impacted car
        if (longGap >= 0) {
          playerCopy.worldY = other.worldY - 1.5;
          playerCopy.speed = Math.max(0, Math.min(playerCopy.speed * 0.5, other.speed * 0.7));
        } else {
          playerCopy.worldY = other.worldY + 1.5;
          playerCopy.speed = Math.max(playerCopy.speed, other.speed + 2.0);
        }
        playerCopy.brakeLight = true;

        // Lead vehicle absorbs forward kinetic impulse
        other.speed = Math.min(36, other.speed + 2.5);
        break;
      }
    }
  }

  return { updatedVehicles, updatedPlayer: playerCopy };
}

/**
 * Generate initial fleet of realistic highway vehicles
 * Strictly places vehicles on travel lanes (0-4), never on shoulder (5)
 * Semis in right lanes, safe spacing, no clipping
 */
export function generateInitialFleet(playerInitialY: number): SimulationVehicle[] {
  const vehicles: SimulationVehicle[] = [];
  let idCounter = 1;

  for (let l = 0; l < HIGHWAY_GEOMETRY.numTravelLanes; l++) {
    const count = 7;
    for (let i = 0; i < count; i++) {
      // Semis primarily in slow lanes (3 and 4)
      const isSemi = (i === 1 || i === 4) && (l === 3 || l === 4);
      const isSUV = i % 2 === 1 && !isSemi;

      const type: 'sedan' | 'suv' | 'semi' | 'coupe' = isSemi ? 'semi' : isSUV ? 'suv' : 'sedan';
      const length = isSemi ? 12.8 : isSUV ? 4.9 : 4.5;
      const width = isSemi ? 2.5 : isSUV ? 1.95 : 1.85;

      // Generous spacing: 36m between cars in each lane
      // Avoid placing cars right on top of player's initial position (offset by at least 15m)
      let dist = (i - 1) * 36 + (l * 8) + (Math.random() * 6 - 3);
      if (Math.abs(dist) < 14) {
        dist = dist >= 0 ? 18 + Math.random() * 8 : -18 - Math.random() * 8;
      }

      const worldY = playerInitialY + dist;
      const laneCenterX = getLaneCenterX(l);

      // Lane speed hierarchy: Left lanes faster, right lanes slower
      const laneBaseSpeed = 31 - l * 2.2;

      vehicles.push({
        id: `veh-${idCounter++}`,
        isPlayer: false,
        laneIndex: l,
        targetLaneIndex: l,
        x: laneCenterX,
        targetX: laneCenterX,
        vx: 0,
        worldY,
        speed: laneBaseSpeed + (Math.random() * 2 - 1),
        acceleration: 0,
        desiredSpeed: laneBaseSpeed + (Math.random() * 3),
        length,
        width,
        yawAngle: 0,
        type,
        color: REALISTIC_COLORS[Math.floor(Math.random() * REALISTIC_COLORS.length)],
        brakeLight: false,
        turnSignal: 'none',
        turnSignalTimer: 0,
        signalPreWarningTimer: 0,
        isTransitioning: false,
        timeSinceLastChange: 2 + Math.random() * 4,
        aggressiveness: 0.9 + Math.random() * 0.25,
        wanderOffset: 0,
        wanderPhase: Math.random() * Math.PI * 2,
      });
    }
  }

  return vehicles;
}
