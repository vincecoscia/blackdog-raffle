import { useEffect, useRef } from "react";
import * as THREE from "three";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { OutputPass } from "three/examples/jsm/postprocessing/OutputPass.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/examples/jsm/postprocessing/UnrealBloomPass.js";
import { avatarHue, fullName, initials } from "@/lib/format";

/**
 * The lottery machine: a glass globe of balls (one per teammate) held in a
 * chrome cage on a lacquered cabinet with a scoreboard. `draw(winner)` mixes
 * the balls with an air jet, then shoots the winner's ball up the tube into
 * the display capsule on top, where it rolls to a stop facing the camera.
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
// Scene constants (world units; the globe has radius 1 and sits at the origin)
// ---------------------------------------------------------------------------
const ACCENT = 0x77ddaf;
const GLOBE_R = 1;
const BALL_R = 0.15;
const FLOOR_Y = -0.66; // perforated air floor inside the globe
const GRAVITY = -3.4;
const MIX_SECONDS = 3.0;
const SETTLE_SECONDS = 0.7;
const RISE_SECONDS = 1.7;
const RETURN_SECONDS = 0.6;

// Chrome cage around the globe: an equator band plus meridian arcs that run
// from the cradle up to the crown ring at the top.
const CAGE_R = 1.035;
const CAGE_LOW = THREE.MathUtils.degToRad(-60);
const CAGE_HIGH = THREE.MathUtils.degToRad(73);
const CAGE_BASE_Y = CAGE_R * Math.sin(CAGE_LOW);

// Cabinet the globe stands on.
const CAB_W = 2.3;
const CAB_H = 0.8;
const CAB_D = 1.4;
const CAB_TOP = -1.1;
const STAGE_Y = CAB_TOP - CAB_H;

// Display capsule on top, where the winning ball comes to rest.
const CAPSULE_Y = 1.64;
const CAPSULE_R = 0.2;
const CAPSULE_HALF = 0.42; // half-length of the straight section
const REST_Y = CAPSULE_Y - CAPSULE_R + BALL_R + 0.004;

const VIEW_TOP = CAPSULE_Y + CAPSULE_R + 0.08;
const VIEW_BOTTOM = STAGE_Y - 0.06;
const VIEW_MID = (VIEW_TOP + VIEW_BOTTOM) / 2;
const CAM_ELEVATION = 0.8;

// Extremes of the machine, projected in fit() to frame it exactly.
const FRAME_POINTS = [
  [0, VIEW_TOP, 0],
  [CAPSULE_HALF + CAPSULE_R + 0.06, CAPSULE_Y + CAPSULE_R, 0],
  [-(CAPSULE_HALF + CAPSULE_R + 0.06), CAPSULE_Y + CAPSULE_R, 0],
  [CAGE_R + 0.06, 0, 0],
  [-(CAGE_R + 0.06), 0, 0],
  [CAB_W / 2 + 0.05, STAGE_Y - 0.02, CAB_D / 2 + 0.05],
  [-(CAB_W / 2 + 0.05), STAGE_Y - 0.02, CAB_D / 2 + 0.05],
].map(([x, y, z]) => new THREE.Vector3(x, y, z));

const Z_AXIS = new THREE.Vector3(0, 0, 1);
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
  // Home framing is solved in fit(); this is just a starting guess.
  const camHome = { pos: new THREE.Vector3(0, VIEW_MID + CAM_ELEVATION, 7), target: new THREE.Vector3(0, VIEW_MID, 0) };
  const camPresent = {
    pos: new THREE.Vector3(0.32, CAPSULE_Y + 0.34, 2.5),
    target: new THREE.Vector3(0, CAPSULE_Y - 0.06, 0),
  };
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
  const underLight = new THREE.PointLight(ACCENT, 1.3, 5, 2);
  underLight.position.set(0, CAB_TOP + 0.1, 0.5);
  scene.add(underLight);

  // ---- materials -----------------------------------------------------------
  const disposables = [];
  const track = (o) => (disposables.push(o), o);
  const add = (mesh, x = 0, y = 0, z = 0) => {
    mesh.position.set(x, y, z);
    scene.add(mesh);
    return mesh;
  };

  const chrome = track(new THREE.MeshStandardMaterial({ color: 0xdcdce2, metalness: 1, roughness: 0.16 }));
  const metal = track(new THREE.MeshStandardMaterial({ color: 0x1b1b21, metalness: 0.85, roughness: 0.32 }));
  const darkMetal = track(new THREE.MeshStandardMaterial({ color: 0x0f0f13, metalness: 0.9, roughness: 0.45 }));
  const lacquer = track(
    new THREE.MeshPhysicalMaterial({ color: 0x0c0c10, metalness: 0.25, roughness: 0.3, clearcoat: 1, clearcoatRoughness: 0.06 })
  );
  // LED strips + deck ring share one material so they pulse together.
  const led = track(new THREE.MeshStandardMaterial({ color: ACCENT, emissive: ACCENT, emissiveIntensity: 1.3, roughness: 0.5 }));
  // The deck ring sits right under the globe, so it runs at about half the
  // strips' brightness to keep the bottom of the globe from blowing out.
  const deckGlow = track(led.clone());
  const capGlow = track(new THREE.MeshStandardMaterial({ color: ACCENT, emissive: ACCENT, emissiveIntensity: 0.3 }));
  const clearGlass = (side = THREE.FrontSide) =>
    track(
      new THREE.MeshPhysicalMaterial({
        color: 0xffffff,
        transmission: 1,
        thickness: 0.06,
        ior: 1.45,
        roughness: 0.04,
        clearcoat: 1,
        clearcoatRoughness: 0.03,
        specularIntensity: 0.9,
        side,
      })
    );

  // ---- stage ---------------------------------------------------------------
  // Soft mint glow behind, a faintly glossy floor that fades out, a contact
  // shadow under the cabinet and a pool of mint light spilling around it.
  const backGlow = add(
    new THREE.Mesh(
      track(new THREE.PlaneGeometry(10, 10)),
      track(
        new THREE.MeshBasicMaterial({
          map: track(radialTexture("rgba(119,221,175,0.55)", "rgba(119,221,175,0)")),
          transparent: true,
          opacity: 0.09,
          depthWrite: false,
        })
      )
    ),
    0,
    0,
    -3
  );
  backGlow.renderOrder = -1;

  const floor = add(
    new THREE.Mesh(
      track(new THREE.CircleGeometry(6, 64)),
      track(
        new THREE.MeshStandardMaterial({
          color: 0x0b0b0e,
          metalness: 0.5,
          roughness: 0.38,
          alphaMap: track(radialTexture("rgb(255,255,255)", "rgb(0,0,0)")),
          transparent: true,
        })
      )
    ),
    0,
    STAGE_Y
  );
  floor.rotation.x = -Math.PI / 2;

  const shadow = add(
    new THREE.Mesh(
      track(new THREE.PlaneGeometry(CAB_W * 1.5, CAB_D * 2.2)),
      track(
        new THREE.MeshBasicMaterial({
          map: track(radialTexture("rgba(0,0,0,0.9)", "rgba(0,0,0,0)")),
          transparent: true,
          depthWrite: false,
        })
      )
    ),
    0,
    STAGE_Y + 0.003
  );
  shadow.rotation.x = -Math.PI / 2;

  const pool = add(
    new THREE.Mesh(
      track(new THREE.PlaneGeometry(4.6, 4.6)),
      track(
        new THREE.MeshBasicMaterial({
          map: track(radialTexture("rgba(119,221,175,0.8)", "rgba(119,221,175,0)")),
          transparent: true,
          opacity: 0.16,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
        })
      )
    ),
    0,
    STAGE_Y + 0.005
  );
  pool.rotation.x = -Math.PI / 2;

  // A soft overhead spotlight beam, like a TV draw.
  const beam = add(
    new THREE.Mesh(
      track(new THREE.ConeGeometry(2.1, 6.4, 48, 1, true)),
      track(
        new THREE.ShaderMaterial({
          uniforms: { uColor: { value: new THREE.Color(0xdffff0) }, uIntensity: { value: 0.07 } },
          vertexShader: `
            varying vec3 vN; varying vec3 vV; varying float vH;
            void main() {
              vN = normalize(normalMatrix * normal);
              vec4 mv = modelViewMatrix * vec4(position, 1.0);
              vV = normalize(-mv.xyz);
              vH = uv.y;
              gl_Position = projectionMatrix * mv;
            }`,
          fragmentShader: `
            uniform vec3 uColor; uniform float uIntensity;
            varying vec3 vN; varying vec3 vV; varying float vH;
            void main() {
              float facing = pow(abs(dot(normalize(vN), normalize(vV))), 2.0);
              float fade = smoothstep(0.0, 0.35, vH) * (0.4 + 0.6 * vH);
              float a = facing * fade * uIntensity;
              gl_FragColor = vec4(uColor * a, a);
            }`,
          transparent: true,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
          side: THREE.DoubleSide,
        })
      )
    ),
    0,
    STAGE_Y + 3.2
  );
  beam.renderOrder = 40;

  // ---- cabinet ---------------------------------------------------------------
  add(new THREE.Mesh(track(new RoundedBoxGeometry(CAB_W, CAB_H, CAB_D, 5, 0.08)), lacquer), 0, CAB_TOP - CAB_H / 2);
  add(new THREE.Mesh(track(new RoundedBoxGeometry(CAB_W + 0.04, 0.045, CAB_D + 0.04, 3, 0.02)), chrome), 0, CAB_TOP - 0.02);
  add(new THREE.Mesh(track(new RoundedBoxGeometry(CAB_W + 0.07, 0.06, CAB_D + 0.07, 3, 0.025)), chrome), 0, STAGE_Y + 0.03);

  // LED strips across the front and down both sides.
  const frontStrip = track(new THREE.BoxGeometry(CAB_W - 0.34, 0.016, 0.012));
  const sideStrip = track(new THREE.BoxGeometry(0.012, 0.016, CAB_D - 0.3));
  for (const y of [CAB_TOP - 0.085, STAGE_Y + 0.105]) {
    add(new THREE.Mesh(frontStrip, led), 0, y, CAB_D / 2 + 0.004);
    add(new THREE.Mesh(sideStrip, led), CAB_W / 2 + 0.004, y, 0);
    add(new THREE.Mesh(sideStrip, led), -CAB_W / 2 - 0.004, y, 0);
  }

  // Scoreboard: Blackdog logo + a line of status text that follows the draw.
  const fontFamily =
    getComputedStyle(document.documentElement).getPropertyValue("--font-bricolage").trim() ||
    "Inter, system-ui, sans-serif";
  const board = createBoard(fontFamily, CAB_W - 0.4, CAB_H - 0.34);
  track(board.map);
  track(board.glow);
  const boardY = CAB_TOP - CAB_H / 2 + 0.005;
  add(
    new THREE.Mesh(track(new RoundedBoxGeometry(board.width + 0.06, board.height + 0.06, 0.02, 2, 0.02)), chrome),
    0,
    boardY,
    CAB_D / 2 + 0.004
  );
  add(
    new THREE.Mesh(
      track(new THREE.PlaneGeometry(board.width, board.height)),
      track(
        new THREE.MeshPhysicalMaterial({
          map: board.map,
          emissiveMap: board.glow,
          emissive: 0xffffff,
          emissiveIntensity: 1.35,
          roughness: 0.35,
          clearcoat: 1,
          clearcoatRoughness: 0.04,
        })
      )
    ),
    0,
    boardY,
    CAB_D / 2 + 0.016
  );

  // Turntable deck with a ring light, and the cradle the globe sits in.
  add(new THREE.Mesh(track(new THREE.CylinderGeometry(0.8, 0.84, 0.07, 64)), metal), 0, CAB_TOP + 0.035);
  const deckRing = add(new THREE.Mesh(track(new THREE.TorusGeometry(0.81, 0.014, 12, 128)), deckGlow), 0, CAB_TOP + 0.07);
  deckRing.rotation.x = Math.PI / 2;
  const cradleH = CAGE_BASE_Y - (CAB_TOP + 0.07);
  add(
    new THREE.Mesh(track(new THREE.CylinderGeometry(0.5, 0.58, cradleH, 64)), darkMetal),
    0,
    CAB_TOP + 0.07 + cradleH / 2
  );

  // ---- globe -----------------------------------------------------------------
  // Real refractive glass: three renders what's behind it into a buffer and
  // bends it through the sphere, so the balls look properly *inside*.
  const glass = add(
    new THREE.Mesh(
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
    )
  );
  glass.renderOrder = 20;

  // Mint fresnel rim: the globe's edge catches the light. Bloom picks it up.
  const rim = add(
    new THREE.Mesh(
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
    )
  );
  rim.renderOrder = 21;
  const rimMaterial = rim.material;

  // ---- chrome cage -------------------------------------------------------
  const flat = (mesh) => ((mesh.rotation.x = Math.PI / 2), mesh);
  flat(add(new THREE.Mesh(track(new THREE.TorusGeometry(CAGE_R, 0.032, 16, 160)), chrome)));
  const boltGeo = track(new THREE.SphereGeometry(0.026, 12, 8));
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2;
    add(new THREE.Mesh(boltGeo, chrome), Math.cos(a) * (CAGE_R + 0.03), 0, Math.sin(a) * (CAGE_R + 0.03));
  }
  flat(
    add(
      new THREE.Mesh(track(new THREE.TorusGeometry(CAGE_R * Math.cos(CAGE_LOW), 0.026, 12, 96)), chrome),
      0,
      CAGE_BASE_Y
    )
  );
  flat(
    add(
      new THREE.Mesh(track(new THREE.TorusGeometry(CAGE_R * Math.cos(CAGE_HIGH), 0.024, 12, 64)), chrome),
      0,
      CAGE_R * Math.sin(CAGE_HIGH)
    )
  );
  const arcGeo = track(new THREE.TorusGeometry(CAGE_R, 0.013, 8, 96, CAGE_HIGH - CAGE_LOW));
  for (let i = 0; i < 4; i++) {
    const arm = new THREE.Group();
    arm.rotation.y = Math.PI / 4 + (i * Math.PI) / 2;
    const arc = new THREE.Mesh(arcGeo, chrome);
    arc.rotation.z = CAGE_LOW;
    arm.add(arc);
    scene.add(arm);
  }

  // ---- inside the globe ------------------------------------------------------
  // Perforated air floor: the balls rest on it and the jet blows up through it.
  const floorR = Math.sqrt(GLOBE_R * GLOBE_R - FLOOR_Y * FLOOR_Y) - 0.02;
  const airFloor = add(
    new THREE.Mesh(
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
    ),
    0,
    FLOOR_Y
  );
  airFloor.rotation.x = -Math.PI / 2;
  flat(add(new THREE.Mesh(track(new THREE.TorusGeometry(floorR, 0.02, 10, 72)), chrome), 0, FLOOR_Y));
  const jetLight = add(new THREE.PointLight(ACCENT, 0, 2.2, 2), 0, FLOOR_Y + 0.05);

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

  // ---- draw tube and display capsule ---------------------------------------
  flat(add(new THREE.Mesh(track(new THREE.TorusGeometry(0.2, 0.03, 12, 48)), chrome), 0, 0.99));
  const tubeBottom = 0.99;
  const tubeTop = CAPSULE_Y - 0.17;
  const tube = add(
    new THREE.Mesh(track(new THREE.CylinderGeometry(0.19, 0.19, tubeTop - tubeBottom, 32, 1, true)), clearGlass(THREE.DoubleSide)),
    0,
    (tubeTop + tubeBottom) / 2
  );
  tube.renderOrder = 22;
  flat(add(new THREE.Mesh(track(new THREE.TorusGeometry(0.205, 0.024, 12, 48)), chrome), 0, tubeTop - 0.005));

  const capsule = add(
    new THREE.Mesh(track(new THREE.CapsuleGeometry(CAPSULE_R, CAPSULE_HALF * 2, 12, 32)), clearGlass()),
    0,
    CAPSULE_Y
  );
  capsule.rotation.z = Math.PI / 2;
  capsule.renderOrder = 22;
  const capsuleRim = add(new THREE.Mesh(capsule.geometry, rimMaterial), 0, CAPSULE_Y);
  capsuleRim.rotation.z = Math.PI / 2;
  capsuleRim.scale.setScalar(1.015);
  capsuleRim.renderOrder = 23;
  const bandGeo = track(new THREE.TorusGeometry(CAPSULE_R + 0.008, 0.02, 12, 48));
  const capLightGeo = track(new THREE.TorusGeometry(CAPSULE_R + 0.01, 0.009, 8, 48));
  const finialGeo = track(new THREE.SphereGeometry(0.035, 16, 12));
  for (const s of [-1, 1]) {
    add(new THREE.Mesh(bandGeo, chrome), s * CAPSULE_HALF, CAPSULE_Y).rotation.y = Math.PI / 2;
    add(new THREE.Mesh(capLightGeo, capGlow), s * (CAPSULE_HALF - 0.07), CAPSULE_Y).rotation.y = Math.PI / 2;
    add(new THREE.Mesh(finialGeo, chrome), s * (CAPSULE_HALF + CAPSULE_R + 0.01), CAPSULE_Y);
  }

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
  let count = 0;

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
      name: fullName(p),
      mesh,
      mat,
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
  const state = {
    mode: "idle",
    t: 0,
    blower: 0.12,
    winner: null,
    returning: null,
    path: null,
    bounces: 0,
    startQuat: new THREE.Quaternion(),
  };
  let lastClack = 0;

  const showIdleBoard = () => board.set("BLACKDOG WEEKLY DRAW", count ? `${count} IN THE DRAW` : "LOAD THE MACHINE");
  showIdleBoard();

  const clack = (speed) => {
    const now = performance.now();
    if (speed < 0.7 || now - lastClack < 70) return;
    lastClack = now;
    callbacks.current.onClack?.(Math.min(1, speed / 4));
  };

  const clearWinnerFx = (ball) => {
    if (ball) {
      ball.mat.emissive.set(0x000000);
      ball.mat.emissiveIntensity = 0;
    }
    halo.material.opacity = 0;
    winnerLight.intensity = 0;
    capGlow.emissiveIntensity = 0.3;
  };

  const selectWinner = (ball) => {
    state.winner = ball;
    ball.mat.emissive.set(ACCENT);
    ball.mat.emissiveIntensity = 0.07;
  };

  /** Drop the current winner straight back into the globe (no animation). */
  const deselectWinner = () => {
    const b = state.winner;
    if (!b) return;
    clearWinnerFx(b);
    b.kinematic = false;
    b.mesh.position.set((Math.random() - 0.5) * 0.2, 0.55, (Math.random() - 0.5) * 0.2);
    b.v.set(0, 0, 0);
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
    showIdleBoard();
  };

  const draw = (winner) => {
    // The roster changed while the last winner was on show: start clean.
    if (pendingParticipants) {
      deselectWinner();
      state.mode = "idle";
      buildBalls(pendingParticipants);
      pendingParticipants = null;
    }
    let ball = balls.find((b) => b.id === winner._id);
    if (!ball) {
      ball = makeBall(winner);
      balls.push(ball);
    }
    state.pendingWinner = ball;
    state.t = 0;

    if (state.winner && state.mode === "present") {
      // Send the previous winner back down the tube before mixing again.
      const b = state.winner;
      clearWinnerFx(b);
      state.returning = b;
      state.winner = null;
      state.path = new THREE.CatmullRomCurve3([
        b.mesh.position.clone(),
        new THREE.Vector3(0, CAPSULE_Y - 0.12, 0),
        new THREE.Vector3(0, 0.98, 0),
        new THREE.Vector3(0, 0.55, 0),
      ]);
      state.mode = "return";
    } else {
      deselectWinner();
      state.mode = "mixing";
    }
    moveCamera(camHome, 0.9);
    board.set("AIR ON", "MIXING…");
  };

  const setParticipants = (list) => {
    count = list.length;
    if (state.mode === "idle") {
      buildBallsWhenReady(list);
      showIdleBoard();
    } else pendingParticipants = list;
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
    clock += dt;
    state.t += dt;
    const { mode, t } = state;

    if (mode === "return") {
      const b = state.returning;
      const k = Math.min(1, t / RETURN_SECONDS);
      state.path.getPointAt(k * k, b.mesh.position); // falls, so it accelerates
      if (k >= 1) {
        b.kinematic = false;
        b.v.set(0, -2.2, 0);
        b.w.set(3, 1, 2);
        state.returning = null;
        state.mode = "mixing";
        state.t = 0;
      }
    } else if (mode === "mixing") {
      state.blower = Math.min(1, t / 0.4);
      if (t >= MIX_SECONDS) {
        state.mode = "settle";
        state.t = 0;
        state.blower = 0;
        selectWinner(state.pendingWinner);
        board.set("HERE IT COMES", "DRAWING…");
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
          new THREE.Vector3(0, 0.98, 0),
          new THREE.Vector3(0, CAPSULE_Y + 0.03, 0),
        ]);
        state.startQuat.copy(b.mesh.quaternion);
        state.mode = "rise";
        state.t = 0;
      }
    } else if (mode === "rise") {
      const b = state.winner;
      const k = Math.min(1, t / RISE_SECONDS);
      state.path.getPointAt(easeInOut(k), b.mesh.position);
      // Turn the badge toward the camera over the last stretch.
      const face = Math.max(0, (k - 0.55) / 0.45);
      b.mesh.quaternion.slerpQuaternions(state.startQuat, identity, easeOut(face));
      if (k > 0.3 && !state.pushed) {
        state.pushed = true;
        moveCamera(camPresent, 1.0);
      }
      if (k >= 1) {
        state.mode = "present";
        state.t = 0;
        state.bounces = 0;
        capGlow.emissiveIntensity = 0.85;
        winnerLight.intensity = 0.12;
        board.set("WINNER", b.name.toUpperCase());
        callbacks.current.onLanded?.();
      }
    } else if (mode === "present") {
      // Drops into the capsule, bounces, rolls back and forth and settles —
      // rolling along x spins the badge in-plane, so it ends up upright.
      const b = state.winner;
      const decay = Math.exp(-4.5 * t);
      const phase = t * 9;
      b.mesh.position.y = REST_Y + Math.abs(Math.cos(phase)) * 0.075 * decay;
      const bounce = Math.floor(phase / Math.PI + 0.5);
      if (bounce > state.bounces) {
        state.bounces = bounce;
        if (decay > 0.12) callbacks.current.onClack?.(Math.min(1, decay));
      }
      const x = 0.24 * Math.exp(-1.8 * t) * Math.sin(4.6 * t);
      b.mesh.position.x = x;
      b.mesh.position.z = 0;
      b.mesh.quaternion.setFromAxisAngle(Z_AXIS, -x / BALL_R);
      halo.material.opacity = 0.09 + Math.sin(t * 3) * 0.03;
    } else if (mode === "idle") {
      state.blower = 0.12;
    }

    if (state.mode === "idle" || state.mode === "mixing") state.pushed = false;

    // LEDs breathe at rest, race while the air is on, and flare for the winner.
    led.emissiveIntensity =
      state.mode === "mixing" || state.mode === "return"
        ? 1.2 + Math.abs(Math.sin(clock * 10)) * 1.4
        : state.mode === "present"
          ? 1.9 + Math.sin(clock * 4) * 0.35
          : 1.05 + Math.sin(clock * 1.4) * 0.2;
    deckGlow.emissiveIntensity = led.emissiveIntensity * 0.5;

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
    const swayAmt = state.mode === "present" || state.mode === "rise" ? 0 : state.mode === "idle" ? 1 : 0.5;
    swayNow += (swayAmt - swayNow) * Math.min(1, dt * 1.5);
    camera.position.copy(cam.pos);
    camera.position.x += Math.sin(clock * 0.32) * 0.45 * swayNow;
    camera.position.y += Math.sin(clock * 0.21) * 0.08 * swayNow;
    camera.lookAt(cam.target);
  };

  // ---- sizing / loop / teardown ------------------------------------------
  const composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));
  const bloom = new UnrealBloomPass(new THREE.Vector2(1, 1), 0.42, 0.45, 0.9);
  composer.addPass(bloom);
  composer.addPass(new OutputPass());

  const fit = () => {
    const w = host.clientWidth || 1;
    const h = host.clientHeight || 1;
    renderer.setSize(w, h, false);
    composer.setSize(w, h);
    bloom.resolution.set(w, h);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();

    // Frame the machine: project its extremes from the home viewpoint, then
    // re-centre and adjust the distance until they fill ~92% of the height
    // and at most ~86% of the width (room for the idle sway).
    const tanHalf = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
    let dist = 7;
    let targetY = VIEW_MID;
    for (let i = 0; i < 5; i++) {
      camera.position.set(0, targetY + CAM_ELEVATION, dist);
      camera.lookAt(0, targetY, 0);
      camera.updateMatrixWorld();
      let minY = Infinity;
      let maxY = -Infinity;
      let maxX = 0;
      for (const p of FRAME_POINTS) {
        tmp.copy(p).project(camera);
        minY = Math.min(minY, tmp.y);
        maxY = Math.max(maxY, tmp.y);
        maxX = Math.max(maxX, Math.abs(tmp.x));
      }
      targetY += ((maxY + minY) / 2) * dist * tanHalf;
      dist *= Math.max((maxY - minY) / 2 / 0.92, maxX / 0.86);
    }
    camHome.pos.set(0, targetY + CAM_ELEVATION, dist);
    camHome.target.set(0, targetY, 0);
    if (state.mode !== "rise" && state.mode !== "present") {
      cam.toPos.copy(camHome.pos);
      cam.toTarget.copy(camHome.target);
      if (cam.t >= 1) {
        cam.pos.copy(camHome.pos);
        cam.target.copy(camHome.target);
      }
    }
  };

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

const BOARD_PX = 1024;

/**
 * The cabinet's scoreboard: a dark LED panel with the Blackdog logo on the
 * left and an eyebrow + headline on the right. `map` is the panel as lit;
 * `glow` holds only the lettering, used as the emissive map so the text
 * shines (and blooms) while the panel stays dark.
 */
function createBoard(fontFamily, width, height) {
  const W = BOARD_PX;
  const H = Math.round((BOARD_PX * height) / width);
  const mapCanvas = document.createElement("canvas");
  const glowCanvas = document.createElement("canvas");
  mapCanvas.width = glowCanvas.width = W;
  mapCanvas.height = glowCanvas.height = H;
  const m = mapCanvas.getContext("2d");
  const g = glowCanvas.getContext("2d");
  const map = new THREE.CanvasTexture(mapCanvas);
  const glow = new THREE.CanvasTexture(glowCanvas);
  map.colorSpace = glow.colorSpace = THREE.SRGBColorSpace;
  map.anisotropy = glow.anisotropy = 8;

  let logo = null;
  let eyebrow = "";
  let headline = "";

  const paint = () => {
    // Panel.
    const bg = m.createLinearGradient(0, 0, 0, H);
    bg.addColorStop(0, "#121218");
    bg.addColorStop(1, "#07070a");
    m.fillStyle = bg;
    m.fillRect(0, 0, W, H);
    m.fillStyle = "rgba(255,255,255,0.035)";
    for (let y = 6; y < H; y += 9) for (let x = 6; x < W; x += 9) m.fillRect(x, y, 2, 2);
    m.strokeStyle = "rgba(119,221,175,0.35)";
    m.lineWidth = 3;
    m.beginPath();
    m.roundRect(6, 6, W - 12, H - 12, 18);
    m.stroke();
    g.fillStyle = "#000";
    g.fillRect(0, 0, W, H);

    // Logo.
    const pad = 30;
    const logoH = H - pad * 2 - 12;
    let x = pad + 14;
    if (logo) {
      const logoW = (logoH * logo.naturalWidth) / logo.naturalHeight;
      m.drawImage(logo, x, (H - logoH) / 2, logoW, logoH);
      x += logoW;
    } else x += logoH * 0.93;
    x += 30;
    m.fillStyle = "rgba(119,221,175,0.55)";
    m.fillRect(x, pad + 12, 3, H - pad * 2 - 24);
    g.fillStyle = "rgba(119,221,175,0.35)";
    g.fillRect(x, pad + 12, 3, H - pad * 2 - 24);
    x += 34;

    // Lettering, drawn on both canvases.
    const avail = W - x - pad - 10;
    const text = (ctx, color, str, size, weight, spacing, y) => {
      ctx.font = `${weight} ${size}px ${fontFamily}`;
      ctx.letterSpacing = spacing;
      ctx.fillStyle = color;
      ctx.textBaseline = "alphabetic";
      ctx.fillText(str, x, y);
    };
    let size = 92;
    m.font = `800 ${size}px ${fontFamily}`;
    m.letterSpacing = "1px";
    while (m.measureText(headline).width > avail && size > 36) {
      size -= 4;
      m.font = `800 ${size}px ${fontFamily}`;
    }
    const eyebrowY = H * 0.38;
    const headlineY = H * 0.38 + size * 0.95;
    text(m, "#77ddaf", eyebrow, 28, 800, "7px", eyebrowY);
    text(g, "#77ddaf", eyebrow, 28, 800, "7px", eyebrowY);
    text(m, "#f4fff9", headline, size, 800, "1px", headlineY);
    text(g, "#e6fff3", headline, size, 800, "1px", headlineY);

    map.needsUpdate = true;
    glow.needsUpdate = true;
  };

  const img = new Image();
  img.onload = () => {
    logo = img;
    paint();
  };
  img.src = "/assets/black_dog_logo.png";
  document.fonts?.ready.then(paint);

  return {
    map,
    glow,
    width,
    height,
    set(nextEyebrow, nextHeadline) {
      if (nextEyebrow === eyebrow && nextHeadline === headline) return;
      eyebrow = nextEyebrow;
      headline = nextHeadline;
      paint();
    },
  };
}

/** Radial gradient (centre -> edge) for glows, light pools and fades. */
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
