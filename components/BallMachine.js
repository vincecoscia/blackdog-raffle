import { useEffect, useRef } from "react";
import * as THREE from "three";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { OutputPass } from "three/examples/jsm/postprocessing/OutputPass.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/examples/jsm/postprocessing/UnrealBloomPass.js";
import { avatarHue, fullName, initials } from "@/lib/format";

/**
 * The lottery ball machine: a glass globe of balls (one per teammate) on a
 * pedestal. `draw(winner)` mixes the balls with an air jet, then lifts the
 * winner's ball up the tube into the cup and turns it to face the camera.
 *
 * Everything runs in a plain requestAnimationFrame loop outside React. The
 * component wires the DOM host and callbacks, and hands the engine's API
 * ({ draw, reset }) to the parent via `onReady` — this is loaded through
 * next/dynamic, which doesn't forward refs.
 */
export default function BallMachine({ participants, onReady, onLanded, onClack }) {
  const host = useRef(null);
  const engine = useRef(null);
  const callbacks = useRef({ onReady, onLanded, onClack });

  useEffect(() => {
    callbacks.current = { onReady, onLanded, onClack };
  }, [onReady, onLanded, onClack]);

  useEffect(() => {
    const e = createEngine(host.current, callbacks);
    engine.current = e;
    callbacks.current.onReady?.({ draw: e.draw, reset: e.reset });
    return () => {
      e.dispose();
      engine.current = null;
      callbacks.current.onReady?.(null);
    };
  }, []);

  useEffect(() => {
    engine.current?.setParticipants(participants);
  }, [participants]);

  return <div ref={host} className="absolute inset-0" aria-hidden="true" />;
}

// ---------------------------------------------------------------------------
// Scene constants
// ---------------------------------------------------------------------------
const ACCENT = 0x77ddaf;
const GLOBE_R = 1;
const BALL_R = 0.15;
const FLOOR_Y = -0.66; // perforated air floor inside the globe
const CUP_Y = 1.42;
const GRAVITY = -3.4;
const MIX_SECONDS = 3.0;
const SETTLE_SECONDS = 0.7;
const RISE_SECONDS = 1.7;

const easeInOut = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const easeOut = (t) => 1 - Math.pow(1 - t, 3);

function createEngine(host, callbacks) {
  // ---- renderer / camera ---------------------------------------------------
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: "high-performance" });
  // Phones get DPR 1: the window is small there and bloom + transmission
  // both scale with pixel count.
  const coarse = window.matchMedia("(pointer: coarse)").matches;
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, coarse ? 1 : 1.5));
  renderer.setClearColor(0x070709, 1);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.domElement.style.cssText = "position:absolute;inset:0;width:100%;height:100%;display:block";
  host.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x070709);
  const camera = new THREE.PerspectiveCamera(32, 1, 0.1, 40);
  const camHome = { pos: new THREE.Vector3(0, 0.75, 5.6), target: new THREE.Vector3(0, 0.02, 0) };
  const camPresent = { pos: new THREE.Vector3(0.2, 1.36, 1.5), target: new THREE.Vector3(0, CUP_Y + 0.02, 0) };
  const cam = {
    pos: camHome.pos.clone(),
    target: camHome.target.clone(),
    fromPos: camHome.pos.clone(),
    fromTarget: camHome.target.clone(),
    toPos: camHome.pos.clone(),
    toTarget: camHome.target.clone(),
    t: 1,
    duration: 1,
  };
  const moveCamera = (to, duration) => {
    cam.fromPos.copy(cam.pos);
    cam.fromTarget.copy(cam.target);
    cam.toPos.copy(to.pos);
    cam.toTarget.copy(to.target);
    cam.t = 0;
    cam.duration = duration;
  };

  // ---- environment & lights ---------------------------------------------
  const pmrem = new THREE.PMREMGenerator(renderer);
  const studio = studioEnvironment();
  scene.environment = pmrem.fromScene(studio, 0.04).texture;
  pmrem.dispose();
  studio.traverse((o) => {
    o.geometry?.dispose();
    o.material?.dispose();
  });

  scene.add(new THREE.HemisphereLight(0xffffff, 0x0b0b10, 0.55));
  const key = new THREE.DirectionalLight(0xffffff, 1.6);
  key.position.set(2.5, 4, 3);
  scene.add(key);
  const underLight = new THREE.PointLight(ACCENT, 3, 5, 2);
  underLight.position.set(0, -1.05, 0.5);
  scene.add(underLight);

  // ---- the machine ---------------------------------------------------------
  const disposables = [];
  const track = (o) => (disposables.push(o), o);

  const metal = track(new THREE.MeshStandardMaterial({ color: 0x1b1b21, metalness: 0.85, roughness: 0.32 }));
  const darkMetal = track(new THREE.MeshStandardMaterial({ color: 0x0f0f13, metalness: 0.9, roughness: 0.45 }));
  const accentGlow = track(
    new THREE.MeshStandardMaterial({ color: ACCENT, emissive: ACCENT, emissiveIntensity: 1.15, roughness: 0.4 })
  );

  // Soft mint stage glow behind the machine, and a pool of ring-light beneath it.
  const stageGlow = new THREE.Mesh(
    track(new THREE.PlaneGeometry(9, 9)),
    track(
      new THREE.MeshBasicMaterial({
        map: track(radialTexture("rgba(119,221,175,0.55)", "rgba(119,221,175,0)")),
        transparent: true,
        opacity: 0.09,
        depthWrite: false,
      })
    )
  );
  stageGlow.position.set(0, -0.1, -2.5);
  scene.add(stageGlow);
  const pool = new THREE.Mesh(
    track(new THREE.PlaneGeometry(3.2, 3.2)),
    track(
      new THREE.MeshBasicMaterial({
        map: track(radialTexture("rgba(119,221,175,0.8)", "rgba(119,221,175,0)")),
        transparent: true,
        opacity: 0.14,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      })
    )
  );
  pool.rotation.x = -Math.PI / 2;
  pool.position.y = -1.28;
  scene.add(pool);

  const pedestal = new THREE.Mesh(track(new THREE.CylinderGeometry(0.6, 0.66, 0.2, 48)), metal);
  pedestal.position.y = -1.17;
  scene.add(pedestal);
  const neck = new THREE.Mesh(track(new THREE.CylinderGeometry(0.34, 0.42, 0.22, 48)), darkMetal);
  neck.position.y = -0.98;
  scene.add(neck);
  const ring = new THREE.Mesh(track(new THREE.TorusGeometry(0.66, 0.018, 12, 96)), accentGlow);
  ring.rotation.x = Math.PI / 2;
  ring.position.y = -1.065;
  scene.add(ring);

  // Real refractive glass: three renders what's behind it into a buffer and
  // bends it through the sphere, so the balls look properly *inside*.
  const glass = new THREE.Mesh(
    track(new THREE.SphereGeometry(GLOBE_R, 72, 48)),
    track(
      new THREE.MeshPhysicalMaterial({
        color: 0xffffff,
        transmission: 1,
        thickness: 0.4,
        ior: 1.45,
        roughness: 0.035,
        metalness: 0,
        clearcoat: 1,
        clearcoatRoughness: 0.03,
        envMapIntensity: 1,
        specularIntensity: 0.8,
        attenuationColor: new THREE.Color(0xdcfff1),
        attenuationDistance: 1.6,
        iridescence: 0.18,
        iridescenceIOR: 1.3,
      })
    )
  );
  glass.renderOrder = 20;
  scene.add(glass);

  // Mint fresnel rim: the globe's edge catches the light. Bloom picks it up.
  const rim = new THREE.Mesh(
    track(new THREE.SphereGeometry(GLOBE_R + 0.004, 72, 48)),
    track(
      new THREE.ShaderMaterial({
        uniforms: { uColor: { value: new THREE.Color(ACCENT) }, uIntensity: { value: 0.9 } },
        vertexShader: `
          varying vec3 vN; varying vec3 vV;
          void main() {
            vN = normalize(normalMatrix * normal);
            vec4 mv = modelViewMatrix * vec4(position, 1.0);
            vV = normalize(-mv.xyz);
            gl_Position = projectionMatrix * mv;
          }`,
        fragmentShader: `
          uniform vec3 uColor; uniform float uIntensity;
          varying vec3 vN; varying vec3 vV;
          void main() {
            float f = pow(1.0 - max(dot(normalize(vN), normalize(vV)), 0.0), 3.2);
            gl_FragColor = vec4(uColor * f * uIntensity, f * uIntensity);
          }`,
        transparent: true,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      })
    )
  );
  rim.renderOrder = 21;
  scene.add(rim);

  // Chrome mounting ring where the globe meets the neck.
  const chrome = track(new THREE.MeshStandardMaterial({ color: 0xd8d8de, metalness: 1, roughness: 0.18 }));
  const bottomRing = new THREE.Mesh(track(new THREE.TorusGeometry(0.44, 0.03, 14, 72)), chrome);
  bottomRing.rotation.x = Math.PI / 2;
  bottomRing.position.y = -0.9;
  scene.add(bottomRing);

  // Perforated air floor inside the globe: the balls rest on it and the jet
  // blows up through it.
  const floorR = Math.sqrt(GLOBE_R * GLOBE_R - FLOOR_Y * FLOOR_Y) - 0.02;
  const airFloor = new THREE.Mesh(
    track(new THREE.CircleGeometry(floorR, 64)),
    track(
      new THREE.MeshStandardMaterial({
        color: 0x14141a,
        metalness: 0.7,
        roughness: 0.5,
        alphaMap: track(grateTexture()),
        transparent: true,
        side: THREE.DoubleSide,
      })
    )
  );
  airFloor.rotation.x = -Math.PI / 2;
  airFloor.position.y = FLOOR_Y;
  scene.add(airFloor);
  const floorRing = new THREE.Mesh(track(new THREE.TorusGeometry(floorR, 0.02, 10, 72)), chrome);
  floorRing.rotation.x = Math.PI / 2;
  floorRing.position.y = FLOOR_Y;
  scene.add(floorRing);
  const jetLight = new THREE.PointLight(ACCENT, 0, 2.2, 2);
  jetLight.position.set(0, FLOOR_Y + 0.05, 0);
  scene.add(jetLight);

  // Air-jet particles: streaks rising from the floor while the blower runs.
  const JETS = 260;
  const jetPos = new Float32Array(JETS * 3);
  const jetSeed = new Float32Array(JETS * 2);
  for (let i = 0; i < JETS; i++) {
    const a = Math.random() * Math.PI * 2;
    const r = Math.sqrt(Math.random()) * 0.42;
    jetPos[i * 3] = Math.cos(a) * r;
    jetPos[i * 3 + 1] = FLOOR_Y + Math.random() * 1.5;
    jetPos[i * 3 + 2] = Math.sin(a) * r;
    jetSeed[i * 2] = 0.8 + Math.random() * 1.4; // speed
    jetSeed[i * 2 + 1] = a; // swirl phase
  }
  const jetGeo = track(new THREE.BufferGeometry());
  jetGeo.setAttribute("position", new THREE.BufferAttribute(jetPos, 3));
  const jets = new THREE.Points(
    jetGeo,
    track(
      new THREE.PointsMaterial({
        color: ACCENT,
        size: 0.028,
        transparent: true,
        opacity: 0,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      })
    )
  );
  scene.add(jets);

  // Opening at the top of the globe, the tube and the winner's cup.
  const collar = new THREE.Mesh(track(new THREE.TorusGeometry(0.2, 0.03, 12, 48)), metal);
  collar.rotation.x = Math.PI / 2;
  collar.position.y = 0.985;
  scene.add(collar);
  const tube = new THREE.Mesh(
    track(new THREE.CylinderGeometry(0.19, 0.19, 0.32, 32, 1, true)),
    track(
      new THREE.MeshPhysicalMaterial({
        color: 0xffffff,
        transparent: true,
        opacity: 0.16,
        roughness: 0.05,
        clearcoat: 1,
        side: THREE.DoubleSide,
        depthWrite: false,
      })
    )
  );
  tube.position.y = 1.15;
  tube.renderOrder = 21;
  scene.add(tube);
  const cup = new THREE.Mesh(track(new THREE.CylinderGeometry(0.2, 0.16, 0.12, 40, 1, true)), darkMetal);
  cup.position.y = CUP_Y - 0.12;
  scene.add(cup);
  const cupFloor = new THREE.Mesh(track(new THREE.CircleGeometry(0.16, 32)), darkMetal);
  cupFloor.rotation.x = -Math.PI / 2;
  cupFloor.position.y = CUP_Y - 0.18;
  scene.add(cupFloor);
  const cupRim = new THREE.Mesh(track(new THREE.TorusGeometry(0.2, 0.014, 10, 48)), accentGlow.clone());
  track(cupRim.material);
  cupRim.material.emissiveIntensity = 0.35;
  cupRim.rotation.x = Math.PI / 2;
  cupRim.position.y = CUP_Y - 0.06;
  scene.add(cupRim);

  // Halo + light that follow the winning ball.
  const halo = new THREE.Sprite(
    track(
      new THREE.SpriteMaterial({
        map: track(haloTexture()),
        color: ACCENT,
        transparent: true,
        opacity: 0,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      })
    )
  );
  halo.scale.set(0.8, 0.8, 1);
  halo.renderOrder = 30;
  scene.add(halo);
  const winnerLight = new THREE.PointLight(ACCENT, 0, 2.6, 2);
  scene.add(winnerLight);

  // ---- balls ---------------------------------------------------------------
  const ballGeo = track(new THREE.SphereGeometry(BALL_R, 28, 20));
  let balls = [];
  let pendingParticipants = null;

  // Same display face the rest of the app uses (next/font exposes it on :root).
  const fontFamily =
    getComputedStyle(document.documentElement).getPropertyValue("--font-bricolage").trim() ||
    "Inter, system-ui, sans-serif";

  const makeBall = (p) => {
    const tex = track(ballTexture(p, fontFamily));
    const mat = track(
      new THREE.MeshPhysicalMaterial({ map: tex, roughness: 0.28, metalness: 0.02, clearcoat: 0.7, clearcoatRoughness: 0.18 })
    );
    const mesh = new THREE.Mesh(ballGeo, mat);
    // Start scattered in the lower half of the globe.
    const a = Math.random() * Math.PI * 2;
    const r = Math.sqrt(Math.random()) * 0.55;
    mesh.position.set(Math.cos(a) * r, FLOOR_Y + BALL_R + Math.random() * 0.6, Math.sin(a) * r);
    mesh.quaternion.random();
    scene.add(mesh);
    return {
      id: p._id,
      mesh,
      mat,
      baseColor: mat.color.clone(),
      v: new THREE.Vector3(),
      w: new THREE.Vector3((Math.random() - 0.5) * 2, (Math.random() - 0.5) * 2, (Math.random() - 0.5) * 2),
      kinematic: false,
    };
  };

  const clearBalls = () => {
    for (const b of balls) {
      scene.remove(b.mesh);
      b.mat.map?.dispose();
      b.mat.dispose();
    }
    balls = [];
  };

  let latestList = null;
  const buildBalls = (list) => {
    clearBalls();
    balls = list.map((p) => makeBall(p));
  };
  // Wait for the web font so the initials on the balls use the display face.
  const buildBallsWhenReady = (list) => {
    latestList = list;
    const go = () => {
      if (latestList === list && state.mode === "idle") buildBalls(list);
    };
    if (document.fonts?.status === "loaded") go();
    else document.fonts?.ready.then(go) ?? go();
  };

  // ---- state machine -------------------------------------------------------
  const state = { mode: "idle", t: 0, blower: 0.12, winner: null, path: null, startQuat: new THREE.Quaternion() };
  let lastClack = 0;

  const clack = (speed) => {
    const now = performance.now();
    if (speed < 0.7 || now - lastClack < 70) return;
    lastClack = now;
    callbacks.current.onClack?.(Math.min(1, speed / 4));
  };

  const selectWinner = (ball) => {
    state.winner = ball;
    ball.mat.emissive.set(ACCENT);
    ball.mat.emissiveIntensity = 0.07;
  };

  const deselectWinner = () => {
    const b = state.winner;
    if (!b) return;
    b.mat.color.copy(b.baseColor);
    b.mat.emissive.set(0x000000);
    b.mat.emissiveIntensity = 0;
    b.kinematic = false;
    b.mesh.position.set((Math.random() - 0.5) * 0.2, 0.55, (Math.random() - 0.5) * 0.2);
    b.v.set(0, 0, 0);
    halo.material.opacity = 0;
    winnerLight.intensity = 0;
    cupRim.material.emissiveIntensity = 0.35;
    state.winner = null;
  };

  const reset = () => {
    deselectWinner();
    state.mode = "idle";
    state.blower = 0.12;
    moveCamera(camHome, 0.9);
    if (pendingParticipants) {
      buildBallsWhenReady(pendingParticipants);
      pendingParticipants = null;
    }
  };

  const draw = (winner) => {
    if (state.mode !== "idle") reset();
    let ball = balls.find((b) => b.id === winner._id);
    if (!ball) {
      ball = makeBall(winner);
      balls.push(ball);
    }
    state.pendingWinner = ball;
    state.mode = "mixing";
    state.t = 0;
  };

  const setParticipants = (list) => {
    if (state.mode === "idle") buildBallsWhenReady(list);
    else pendingParticipants = list;
  };

  // ---- physics ---------------------------------------------------------------
  const tmp = new THREE.Vector3();
  const tmp2 = new THREE.Vector3();
  const spinQ = new THREE.Quaternion();
  const bound = GLOBE_R - BALL_R - 0.015;

  const step = (dt) => {
    const blower = state.blower;
    for (const b of balls) {
      if (b.kinematic) continue;
      const p = b.mesh.position;
      const v = b.v;
      v.y += GRAVITY * dt;
      if (blower > 0) {
        const rxz = Math.hypot(p.x, p.z);
        // Air jet from the bottom, a slow swirl, and some turbulence.
        if (p.y < FLOOR_Y + 0.45 && rxz < 0.5) v.y += (11 + Math.random() * 5) * blower * dt;
        v.x += (-p.z * 1.6 * blower + (Math.random() - 0.5) * 7 * blower) * dt;
        v.z += (p.x * 1.6 * blower + (Math.random() - 0.5) * 7 * blower) * dt;
        v.y += (Math.random() - 0.5) * 4 * blower * dt;
      }
      v.multiplyScalar(1 - 0.5 * dt);
      p.addScaledVector(v, dt);

      // Rest on the air floor.
      if (p.y < FLOOR_Y + BALL_R) {
        p.y = FLOOR_Y + BALL_R;
        if (v.y < 0) {
          clack(-v.y);
          v.y = -v.y * 0.42;
          b.w.set((Math.random() - 0.5) * 4, (Math.random() - 0.5) * 4, (Math.random() - 0.5) * 4);
        }
        v.x *= 1 - 2.5 * dt; // rolling friction on the floor
        v.z *= 1 - 2.5 * dt;
      }
      // Keep inside the globe.
      const d = p.length();
      if (d > bound) {
        tmp.copy(p).divideScalar(d);
        p.copy(tmp).multiplyScalar(bound);
        const vn = v.dot(tmp);
        if (vn > 0) {
          v.addScaledVector(tmp, -vn * 1.5);
          clack(vn);
          b.w.set((Math.random() - 0.5) * 6, (Math.random() - 0.5) * 6, (Math.random() - 0.5) * 6).multiplyScalar(vn);
        }
      }
      // Rest on the floor of the globe without jittering.
      if (blower < 0.2 && p.y <= FLOOR_Y + BALL_R + 0.002 && v.lengthSq() < 0.02) v.set(0, 0, 0);
    }

    // Ball–ball collisions (n is small, so the naive pass is fine).
    const minD = BALL_R * 2;
    for (let i = 0; i < balls.length; i++) {
      const a = balls[i];
      for (let j = i + 1; j < balls.length; j++) {
        const c = balls[j];
        tmp.subVectors(c.mesh.position, a.mesh.position);
        const dist = tmp.length();
        if (dist >= minD || dist === 0) continue;
        tmp.divideScalar(dist);
        const overlap = minD - dist;
        if (a.kinematic) c.mesh.position.addScaledVector(tmp, overlap);
        else if (c.kinematic) a.mesh.position.addScaledVector(tmp, -overlap);
        else {
          a.mesh.position.addScaledVector(tmp, -overlap / 2);
          c.mesh.position.addScaledVector(tmp, overlap / 2);
        }
        tmp2.subVectors(a.v, c.v);
        const rel = tmp2.dot(tmp);
        if (rel > 0) {
          const impulse = (rel * 1.55) / 2;
          if (!a.kinematic) a.v.addScaledVector(tmp, -impulse);
          if (!c.kinematic) c.v.addScaledVector(tmp, impulse);
          clack(rel);
        }
      }
    }

    // Tumble.
    for (const b of balls) {
      if (b.kinematic) continue;
      const wl = b.w.length();
      if (wl > 0.001) {
        spinQ.setFromAxisAngle(tmp.copy(b.w).divideScalar(wl), wl * dt);
        b.mesh.quaternion.premultiply(spinQ);
      }
      b.w.multiplyScalar(1 - 1.2 * dt);
    }
  };

  // ---- the draw sequence -------------------------------------------------
  const identity = new THREE.Quaternion();
  let clock = 0;
  let swayNow = 1;

  const update = (dt) => {
    state.t += dt;
    const { mode, t } = state;

    if (mode === "mixing") {
      state.blower = Math.min(1, t / 0.4);
      if (t >= MIX_SECONDS) {
        state.mode = "settle";
        state.t = 0;
        state.blower = 0;
        selectWinner(state.pendingWinner);
      }
    } else if (mode === "settle") {
      const k = Math.min(1, t / 0.5);
      halo.material.opacity = 0.3 * k;
      winnerLight.intensity = 1.2 * k;
      if (t >= SETTLE_SECONDS) {
        const b = state.winner;
        b.kinematic = true;
        b.v.set(0, 0, 0);
        state.path = new THREE.CatmullRomCurve3([
          b.mesh.position.clone(),
          new THREE.Vector3(b.mesh.position.x * 0.4, 0.35, b.mesh.position.z * 0.4),
          new THREE.Vector3(0, 1.02, 0),
          new THREE.Vector3(0, CUP_Y, 0),
        ]);
        state.startQuat.copy(b.mesh.quaternion);
        state.mode = "rise";
        state.t = 0;
      }
    } else if (mode === "rise") {
      const b = state.winner;
      const k = Math.min(1, t / RISE_SECONDS);
      state.path.getPointAt(easeInOut(k), b.mesh.position);
      // Turn the label toward the camera over the last stretch.
      const face = Math.max(0, (k - 0.55) / 0.45);
      b.mesh.quaternion.slerpQuaternions(state.startQuat, identity, easeOut(face));
      if (k > 0.3 && !state.pushed) {
        state.pushed = true;
        moveCamera(camPresent, 1.0);
      }
      if (k >= 1) {
        state.mode = "present";
        state.t = 0;
        cupRim.material.emissiveIntensity = 1.1;
        winnerLight.intensity = 0.12;
        callbacks.current.onLanded?.();
      }
    } else if (mode === "present") {
      // Settled in the cup: a gentle hover so it still feels alive.
      const b = state.winner;
      b.mesh.position.y = CUP_Y + Math.sin(t * 2.2) * 0.008;
      b.mesh.quaternion.slerp(identity, 0.05);
      halo.material.opacity = 0.09 + Math.sin(t * 3) * 0.03;
    } else if (mode === "idle") {
      state.blower = 0.12;
    }

    if (state.mode === "idle" || state.mode === "mixing") state.pushed = false;

    // Physics substeps for stability at low frame rates.
    const sub = 2;
    for (let i = 0; i < sub; i++) step(dt / sub);

    // Air-jet particles follow the blower.
    const blow = state.blower;
    jets.material.opacity = Math.min(0.55, blow * 0.6);
    jetLight.intensity = blow * 1.4;
    if (blow > 0.02) {
      const arr = jetGeo.attributes.position.array;
      for (let i = 0; i < JETS; i++) {
        const sp = jetSeed[i * 2];
        let y = arr[i * 3 + 1] + (1.4 + sp) * blow * dt;
        if (y > FLOOR_Y + 1.55) y = FLOOR_Y + Math.random() * 0.1;
        const ph = jetSeed[i * 2 + 1] + y * 2.2;
        const r = 0.08 + (y - FLOOR_Y) * 0.28;
        arr[i * 3] = Math.cos(ph) * r;
        arr[i * 3 + 1] = y;
        arr[i * 3 + 2] = Math.sin(ph) * r;
      }
      jetGeo.attributes.position.needsUpdate = true;
    }

    if (state.winner) {
      halo.position.copy(state.winner.mesh.position);
      winnerLight.position.copy(state.winner.mesh.position).add(tmp.set(0, 0.15, 0.25));
    }

    // Camera easing.
    if (cam.t < 1) {
      cam.t = Math.min(1, cam.t + dt / cam.duration);
      const e = easeInOut(cam.t);
      cam.pos.lerpVectors(cam.fromPos, cam.toPos, e);
      cam.target.lerpVectors(cam.fromTarget, cam.toTarget, e);
    }
    // Slow sway around the machine while it's not presenting the winner.
    clock += dt;
    const swayAmt = state.mode === "present" || state.mode === "rise" ? 0 : state.mode === "idle" ? 1 : 0.5;
    swayNow += (swayAmt - swayNow) * Math.min(1, dt * 1.5);
    camera.position.copy(cam.pos);
    camera.position.x += Math.sin(clock * 0.32) * 0.45 * swayNow;
    camera.position.y += Math.sin(clock * 0.21) * 0.08 * swayNow;
    camera.lookAt(cam.target);
  };

  // ---- sizing / loop / teardown ------------------------------------------
  const fit = () => {
    const w = host.clientWidth || 1;
    const h = host.clientHeight || 1;
    renderer.setSize(w, h, false);
    composer.setSize(w, h);
    bloom.resolution.set(w, h);
    camera.aspect = w / h;
    // Fit the whole machine (y from -1.35 to 1.55) vertically, and the globe
    // horizontally on narrow screens.
    const halfFov = THREE.MathUtils.degToRad(camera.fov / 2);
    const dist = Math.max(1.72 / Math.tan(halfFov), 1.18 / (Math.tan(halfFov) * camera.aspect));
    camHome.pos.z = dist;
    if (state.mode === "idle" || state.mode === "mixing" || state.mode === "settle") {
      cam.toPos.z = dist;
      if (cam.t >= 1) cam.pos.z = dist;
    }
    camera.updateProjectionMatrix();
  };
  const composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));
  const bloom = new UnrealBloomPass(new THREE.Vector2(1, 1), 0.42, 0.45, 0.9);
  composer.addPass(bloom);
  composer.addPass(new OutputPass());

  const ro = new ResizeObserver(fit);
  ro.observe(host);
  fit();

  let raf = 0;
  let last = 0;
  const frame = (ts) => {
    raf = requestAnimationFrame(frame);
    const dt = last ? Math.min(1 / 30, (ts - last) / 1000) : 1 / 60;
    last = ts;
    update(dt);
    composer.render();
  };
  raf = requestAnimationFrame(frame);

  const dispose = () => {
    cancelAnimationFrame(raf);
    ro.disconnect();
    clearBalls();
    for (const d of disposables) d.dispose?.();
    scene.environment?.dispose();
    composer.dispose();
    renderer.dispose();
    renderer.domElement.remove();
  };

  return { draw, reset, setParticipants, dispose };
}

// ---------------------------------------------------------------------------
// Textures
// ---------------------------------------------------------------------------

const TEX_W = 512;
const TEX_H = 256;
const STICKER_R = 52;

/**
 * 2:1 sphere texture for one teammate: the ball is a pastel tint of their
 * avatar hue, with their roster icon (gradient disc + initials, or their
 * photo once it loads) printed as a badge on opposite faces.
 */
function ballTexture(p, fontFamily) {
  const name = fullName(p) || "Teammate";
  const hue = avatarHue(name);
  const text = initials(p);
  const c = document.createElement("canvas");
  c.width = TEX_W;
  c.height = TEX_H;
  const ctx = c.getContext("2d");

  ctx.fillStyle = `hsl(${hue} 46% 80%)`;
  ctx.fillRect(0, 0, TEX_W, TEX_H);
  // Poles a touch darker so the ball reads as round even in flat light.
  const band = ctx.createLinearGradient(0, 0, 0, TEX_H);
  band.addColorStop(0, "rgba(0,0,0,0.22)");
  band.addColorStop(0.5, "rgba(255,255,255,0.08)");
  band.addColorStop(1, "rgba(0,0,0,0.26)");
  ctx.fillStyle = band;
  ctx.fillRect(0, 0, TEX_W, TEX_H);

  const centres = [TEX_W * 0.25, TEX_W * 0.75];
  const drawBadge = (x) => {
    ctx.beginPath();
    ctx.arc(x, TEX_H / 2, STICKER_R + 6, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(255,255,255,0.94)";
    ctx.fill();
    const g = ctx.createLinearGradient(x - STICKER_R, TEX_H / 2 - STICKER_R, x + STICKER_R, TEX_H / 2 + STICKER_R);
    g.addColorStop(0, `hsl(${hue} 55% 42%)`);
    g.addColorStop(1, `hsl(${(hue + 40) % 360} 60% 28%)`);
    ctx.beginPath();
    ctx.arc(x, TEX_H / 2, STICKER_R, 0, Math.PI * 2);
    ctx.fillStyle = g;
    ctx.fill();
    ctx.fillStyle = "#ffffff";
    ctx.font = `800 ${text.length > 2 ? 30 : 38}px ${fontFamily}`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(text, x, TEX_H / 2 + 2);
  };
  centres.forEach(drawBadge);

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;

  // Photo, if they have one and the host allows cross-origin use.
  const src = p.imageURL?.trim();
  if (src) {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.referrerPolicy = "no-referrer";
    img.onload = () => {
      const side = Math.min(img.naturalWidth, img.naturalHeight);
      const sx = (img.naturalWidth - side) / 2;
      const sy = (img.naturalHeight - side) / 2;
      for (const x of centres) {
        ctx.save();
        ctx.beginPath();
        ctx.arc(x, TEX_H / 2, STICKER_R, 0, Math.PI * 2);
        ctx.clip();
        ctx.drawImage(img, sx, sy, side, side, x - STICKER_R, TEX_H / 2 - STICKER_R, STICKER_R * 2, STICKER_R * 2);
        ctx.restore();
      }
      tex.needsUpdate = true;
    };
    img.src = src;
  }
  return tex;
}

/** Radial gradient (centre -> edge) for glows and light pools. */
function radialTexture(inner, outer) {
  const c = document.createElement("canvas");
  c.width = c.height = 256;
  const ctx = c.getContext("2d");
  const g = ctx.createRadialGradient(128, 128, 0, 128, 128, 128);
  g.addColorStop(0, inner);
  g.addColorStop(1, outer);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 256, 256);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/** Alpha map of a perforated plate: opaque metal with a grid of holes. */
function grateTexture() {
  const c = document.createElement("canvas");
  c.width = c.height = 256;
  const ctx = c.getContext("2d");
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, 256, 256);
  ctx.fillStyle = "#000";
  for (let y = 12; y < 256; y += 20) {
    for (let x = 12 + ((y / 20) % 2) * 10; x < 256; x += 20) {
      ctx.beginPath();
      ctx.arc(x, y, 5, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(2, 2);
  return tex;
}

function haloTexture() {
  const c = document.createElement("canvas");
  c.width = c.height = 128;
  const ctx = c.getContext("2d");
  const g = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
  g.addColorStop(0, "rgba(255,255,255,1)");
  g.addColorStop(0.25, "rgba(255,255,255,0.55)");
  g.addColorStop(0.6, "rgba(255,255,255,0.12)");
  g.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 128, 128);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/**
 * A small dark studio for reflections: near-black walls, one soft white
 * panel overhead, a fill from the left and a mint kicker low on the right.
 * Colours above 1.0 act as HDR emitters once PMREM-filtered.
 */
function studioEnvironment() {
  const env = new THREE.Scene();
  env.add(
    new THREE.Mesh(new THREE.BoxGeometry(24, 24, 24), new THREE.MeshBasicMaterial({ color: 0x08080b, side: THREE.BackSide }))
  );
  const panel = (color, intensity, w, h, x, y, z) => {
    const m = new THREE.Mesh(
      new THREE.PlaneGeometry(w, h),
      new THREE.MeshBasicMaterial({ color: new THREE.Color(color).multiplyScalar(intensity), side: THREE.DoubleSide })
    );
    m.position.set(x, y, z);
    m.lookAt(0, 0, 0);
    env.add(m);
  };
  panel(0xffffff, 7, 7, 3, 0, 9, 3);
  panel(0xffffff, 2.2, 3, 7, -9, 2, 4);
  panel(0x77ddaf, 3.5, 5, 2.5, 7, -4, 5);
  return env;
}
