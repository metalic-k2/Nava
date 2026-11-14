import { Pause, Play, RotateCcw } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import type { SarObservationSite } from '../types/sar';

interface EarthHeroCanvasProps {
  sites: SarObservationSite[];
  onSelectSite: (siteId: string) => void;
}

// Simplified continental polygons [lng, lat] for crisp procedural Glacial Earth rendering
const CONTINENTS: { poly: [number, number][]; glacial?: boolean }[] = [
  // North America
  {
    poly: [
      [-168, 65], [-160, 71], [-140, 70], [-125, 71], [-95, 74], [-78, 72],
      [-64, 62], [-55, 52], [-66, 44], [-75, 35], [-81, 25], [-83, 30],
      [-90, 29], [-97, 26], [-96, 19], [-87, 21], [-83, 10], [-78, 8],
      [-85, 11], [-93, 15], [-105, 20], [-112, 28], [-117, 32], [-124, 42],
      [-125, 49], [-136, 58], [-152, 60], [-165, 61],
    ],
  },
  // Greenland Ice Sheet
  {
    poly: [
      [-52, 60], [-42, 60], [-22, 70], [-18, 81], [-45, 83], [-68, 77], [-56, 68],
    ],
    glacial: true,
  },
  // South America
  {
    poly: [
      [-78, 9], [-72, 12], [-62, 10], [-50, 1], [-35, -6], [-38, -14],
      [-40, -22], [-48, -28], [-53, -34], [-62, -40], [-67, -50], [-68, -55],
      [-74, -52], [-73, -42], [-71, -30], [-70, -18], [-77, -12], [-81, -5],
      [-79, 2],
    ],
  },
  // Africa
  {
    poly: [
      [-17, 15], [-13, 28], [-6, 36], [10, 37], [12, 33], [25, 32], [33, 31],
      [39, 21], [43, 12], [51, 12], [45, 2], [40, -10], [35, -24], [28, -33],
      [18, -35], [14, -22], [12, -12], [9, -2], [9, 4], [2, 6], [-8, 5],
      [-16, 11],
    ],
  },
  // Europe + Eurasia
  {
    poly: [
      [-9, 37], [-9, 43], [-2, 43], [-4, 48], [2, 51], [8, 54], [6, 60],
      [15, 69], [28, 71], [44, 68], [62, 70], [74, 73], [104, 77], [135, 72],
      [172, 66], [162, 55], [142, 53], [136, 44], [128, 35], [121, 39],
      [122, 31], [114, 22], [108, 16], [103, 2], [98, 10], [92, 21],
      [80, 12], [77, 8], [72, 20], [66, 25], [56, 26], [48, 30], [36, 36],
      [27, 37], [26, 41], [20, 39], [16, 38], [12, 42], [6, 43], [3, 41],
      [-5, 36],
    ],
  },
  // Maritime SE Asia / Indonesia & Japan & UK
  { poly: [[130, 31], [136, 34], [141, 38], [145, 44], [140, 42], [136, 36]] },
  { poly: [[96, 5], [104, -1], [106, -6], [102, -5], [97, 2]] },
  { poly: [[109, 2], [118, 5], [116, -3], [110, -3]] },
  { poly: [[-6, 50], [2, 51], [-1, 58], [-6, 57]] },
  // Australia
  {
    poly: [
      [114, -22], [122, -17], [131, -12], [137, -15], [142, -11], [146, -18],
      [153, -26], [150, -36], [141, -38], [135, -35], [128, -32], [116, -34],
      [113, -27],
    ],
  },
  // Antarctica Ice Sheet
  {
    poly: [
      [-180, -72], [-120, -74], [-62, -64], [-55, -75], [0, -70], [65, -68],
      [135, -67], [175, -72], [180, -72], [180, -89], [-180, -89],
    ],
    glacial: true,
  },
];

function createEarthTexture(): THREE.CanvasTexture {
  const width = 2048;
  const height = 1024;
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d')!;

  // Deep arctic polar sea gradient
  const oceanGrad = ctx.createLinearGradient(0, 0, 0, height);
  oceanGrad.addColorStop(0, '#0D3847');
  oceanGrad.addColorStop(0.18, '#061E28');
  oceanGrad.addColorStop(0.5, '#031015');
  oceanGrad.addColorStop(0.82, '#061E28');
  oceanGrad.addColorStop(1, '#0D3847');
  ctx.fillStyle = oceanGrad;
  ctx.fillRect(0, 0, width, height);

  // Graticule lines
  ctx.strokeStyle = 'rgba(165, 228, 247, 0.08)';
  ctx.lineWidth = 1;
  for (let lon = -180; lon <= 180; lon += 15) {
    const x = ((lon + 180) / 360) * width;
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, height);
    ctx.stroke();
  }
  for (let lat = -75; lat <= 75; lat += 15) {
    const y = ((90 - lat) / 180) * height;
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(width, y);
    ctx.stroke();
  }

  // Equator reference line
  ctx.strokeStyle = 'rgba(165, 228, 247, 0.18)';
  ctx.beginPath();
  ctx.moveTo(0, height / 2);
  ctx.lineTo(width, height / 2);
  ctx.stroke();

  const project = (lng: number, lat: number): [number, number] => [
    ((lng + 180) / 360) * width,
    ((90 - lat) / 180) * height,
  ];

  // Continents & Glacial Ice Caps
  for (const { poly, glacial } of CONTINENTS) {
    ctx.beginPath();
    poly.forEach(([lng, lat], idx) => {
      const [px, py] = project(lng, lat);
      if (idx === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    });
    ctx.closePath();

    if (glacial) {
      const iceGrad = ctx.createLinearGradient(0, 0, 0, height);
      iceGrad.addColorStop(0, '#DDF6FC');
      iceGrad.addColorStop(0.5, '#A5E4F7');
      iceGrad.addColorStop(1, '#F2FAFC');
      ctx.fillStyle = iceGrad;
      ctx.fill();
      ctx.strokeStyle = 'rgba(242, 250, 252, 0.85)';
      ctx.lineWidth = 2;
      ctx.stroke();
    } else {
      ctx.fillStyle = '#0A2A36';
      ctx.fill();
      ctx.strokeStyle = 'rgba(165, 228, 247, 0.58)';
      ctx.lineWidth = 2;
      ctx.stroke();
    }
  }

  // Subtle radar backscatter surface grain
  ctx.fillStyle = 'rgba(221, 246, 252, 0.08)';
  for (let i = 0; i < 3200; i++) {
    const rx = (Math.sin(i * 12.9898) * 43758.5453) % 1;
    const ry = (Math.sin(i * 78.233) * 23421.631) % 1;
    const x = Math.abs(rx) * width;
    const y = Math.abs(ry) * height;
    ctx.fillRect(x, y, 2, 1);
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  return texture;
}

function latLngToVec3(
  lat: number,
  lng: number,
  radius: number,
  out = new THREE.Vector3()
): THREE.Vector3 {
  const phi = (90 - lat) * (Math.PI / 180);
  const theta = (lng + 180) * (Math.PI / 180);
  out.set(
    -radius * Math.sin(phi) * Math.cos(theta),
    radius * Math.cos(phi),
    radius * Math.sin(phi) * Math.sin(theta)
  );
  return out;
}

// Composite 7-part procedural SAR spacecraft (ExtrudeGeometry + LatheGeometry + TubeGeometry)
function buildSarSatelliteGroup(): THREE.Group {
  const satGroup = new THREE.Group();

  // Distinct roughness/metalness values (>= 0.25 delta across adjacent parts)
  const foilBusMat = new THREE.MeshStandardMaterial({
    color: 0xd9a441,
    metalness: 0.9,
    roughness: 0.22,
  });
  const solarMat = new THREE.MeshStandardMaterial({
    color: 0x164e63,
    metalness: 0.45,
    roughness: 0.24,
    emissive: 0x082f3a,
    emissiveIntensity: 0.35,
  });
  const antennaMat = new THREE.MeshStandardMaterial({
    color: 0xf2fafc,
    metalness: 0.72,
    roughness: 0.52,
  });
  const dishMat = new THREE.MeshStandardMaterial({
    color: 0xa5e4f7,
    metalness: 0.85,
    roughness: 0.25,
    side: THREE.DoubleSide,
  });
  const titaniumMat = new THREE.MeshStandardMaterial({
    color: 0x6b8f9c,
    metalness: 0.78,
    roughness: 0.58,
  });

  // 1. Primary beveled hexagonal spacecraft bus (ExtrudeGeometry)
  const busShape = new THREE.Shape();
  const r = 0.036;
  for (let i = 0; i < 6; i++) {
    const angle = (i / 6) * Math.PI * 2;
    const vx = Math.cos(angle) * r;
    const vy = Math.sin(angle) * r;
    if (i === 0) busShape.moveTo(vx, vy);
    else busShape.lineTo(vx, vy);
  }
  busShape.closePath();

  const busGeo = new THREE.ExtrudeGeometry(busShape, {
    depth: 0.085,
    bevelEnabled: true,
    bevelThickness: 0.005,
    bevelSize: 0.004,
    bevelSegments: 2,
  });
  busGeo.center();
  const busMesh = new THREE.Mesh(busGeo, foilBusMat);
  satGroup.add(busMesh);

  // 2. Beveled planar SAR phased-array antenna (ExtrudeGeometry)
  const panelShape = new THREE.Shape();
  panelShape.moveTo(-0.015, -0.125);
  panelShape.lineTo(0.015, -0.125);
  panelShape.lineTo(0.015, 0.125);
  panelShape.lineTo(-0.015, 0.125);
  panelShape.closePath();
  const sarPanelGeo = new THREE.ExtrudeGeometry(panelShape, {
    depth: 0.007,
    bevelEnabled: true,
    bevelThickness: 0.002,
    bevelSize: 0.002,
    bevelSegments: 1,
  });
  sarPanelGeo.center();
  sarPanelGeo.rotateX(Math.PI / 2);
  const sarPanel = new THREE.Mesh(sarPanelGeo, antennaMat);
  sarPanel.position.set(0, -0.044, 0);
  sarPanel.rotation.z = 0.34;
  satGroup.add(sarPanel);

  // 3. Parabolic Ka-band downlink telemetry dish (LatheGeometry)
  const dishPts = [
    new THREE.Vector2(0.001, 0),
    new THREE.Vector2(0.014, 0.003),
    new THREE.Vector2(0.025, 0.011),
    new THREE.Vector2(0.032, 0.021),
  ];
  const dishGeo = new THREE.LatheGeometry(dishPts, 20);
  const dish = new THREE.Mesh(dishGeo, dishMat);
  dish.position.set(0, 0.048, -0.022);
  dish.rotation.x = -0.35;
  satGroup.add(dish);

  // 4. Apogee thruster nozzle bell (LatheGeometry)
  const nozzlePts = [
    new THREE.Vector2(0.006, 0),
    new THREE.Vector2(0.008, -0.008),
    new THREE.Vector2(0.015, -0.022),
  ];
  const nozzleGeo = new THREE.LatheGeometry(nozzlePts, 16);
  const nozzle = new THREE.Mesh(nozzleGeo, titaniumMat);
  nozzle.position.set(0, 0, -0.048);
  nozzle.rotation.x = Math.PI / 2;
  satGroup.add(nozzle);

  // 5. Curved waveguide boom (TubeGeometry)
  const boomCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0, 0.022, 0.02),
    new THREE.Vector3(0.014, 0.042, 0.0),
    new THREE.Vector3(0, 0.056, -0.018),
  ]);
  const boomGeo = new THREE.TubeGeometry(boomCurve, 12, 0.003, 8, false);
  const boom = new THREE.Mesh(boomGeo, titaniumMat);
  satGroup.add(boom);

  // 6. Twin solar wings & deployment yoke
  const wingGeo = new THREE.BoxGeometry(0.24, 0.005, 0.052);
  const leftWing = new THREE.Mesh(wingGeo, solarMat);
  leftWing.position.set(-0.165, 0.01, 0);
  const rightWing = new THREE.Mesh(wingGeo, solarMat);
  rightWing.position.set(0.165, 0.01, 0);
  const yokeGeo = new THREE.CylinderGeometry(0.004, 0.004, 0.1, 8);
  yokeGeo.rotateZ(Math.PI / 2);
  const yoke = new THREE.Mesh(yokeGeo, titaniumMat);
  yoke.position.set(0, 0.01, 0);
  satGroup.add(leftWing, rightWing, yoke);

  // 7. Nadir icy-blue SAR swath beam
  const swathGeo = new THREE.ConeGeometry(0.17, 0.58, 24, 1, true);
  const swathMat = new THREE.MeshBasicMaterial({
    color: 0x7ad4ec,
    transparent: true,
    opacity: 0.16,
    side: THREE.DoubleSide,
    depthWrite: false,
  });
  const swath = new THREE.Mesh(swathGeo, swathMat);
  swath.position.set(0.085, -0.31, 0);
  swath.rotation.z = 0.28;
  satGroup.add(swath);

  return satGroup;
}

export function EarthHeroCanvas({ sites, onSelectSite }: EarthHeroCanvasProps) {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const [hoveredSite, setHoveredSite] = useState<SarObservationSite | null>(
    sites[0] ?? null
  );
  const [paused, setPaused] = useState(false);
  const pausedRef = useRef(false);
  pausedRef.current = paused;

  const resetCameraRef = useRef<(() => void) | null>(null);
  const onSelectSiteRef = useRef(onSelectSite);
  onSelectSiteRef.current = onSelectSite;

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    const isSoftwareGl = (() => {
      const gl = document.createElement('canvas').getContext('webgl2');
      if (!gl) return true;
      const ext = gl.getExtension('WEBGL_debug_renderer_info');
      const param = ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER;
      const gpu = String(gl.getParameter(param));
      gl.getExtension('WEBGL_lose_context')?.loseContext();
      return /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
    })();

    const width = container.clientWidth || 640;
    const height = container.clientHeight || 520;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x031015);
    scene.fog = new THREE.FogExp2(0x031015, 0.032);

    const camera = new THREE.PerspectiveCamera(40, width / height, 0.1, 100);
    const defaultCamPos = new THREE.Vector3(2.35, 1.35, 3.3);
    camera.position.copy(defaultCamPos);

    const renderer = new THREE.WebGLRenderer({
      antialias: !isSoftwareGl,
      powerPreference: 'high-performance',
    });
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.15;
    renderer.setPixelRatio(
      isSoftwareGl ? 1 : Math.min(window.devicePixelRatio, 2)
    );
    renderer.setSize(width, height);
    container.appendChild(renderer.domElement);

    // Mandatory Studio PBR environment reflection for metallic satellite surfaces
    const pmremGenerator = new THREE.PMREMGenerator(renderer);
    const envTarget = pmremGenerator.fromScene(new RoomEnvironment(), 0.04);
    scene.environment = envTarget.texture;
    pmremGenerator.dispose();

    // Warm key sunlight + cool Arctic teal hemisphere fill + icy rim
    const hemiLight = new THREE.HemisphereLight(0xa5e4f7, 0x031015, 0.85);
    scene.add(hemiLight);

    const sunLight = new THREE.DirectionalLight(0xfff6ea, 2.25);
    sunLight.position.set(5, 2.6, 4);
    scene.add(sunLight);

    const rimLight = new THREE.DirectionalLight(0x7ad4ec, 0.9);
    rimLight.position.set(-4, -1.5, -3);
    scene.add(rimLight);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enablePan = false;
    controls.enableZoom = false;
    controls.enableDamping = !isSoftwareGl;
    controls.dampingFactor = 0.05;
    controls.rotateSpeed = 0.65;

    let resettingCamera = false;
    resetCameraRef.current = () => {
      resettingCamera = true;
    };

    // Glacial Earth Group
    const earthGroup = new THREE.Group();
    scene.add(earthGroup);

    const earthRadius = 1.25;
    const earthTexture = createEarthTexture();
    earthTexture.anisotropy = renderer.capabilities.getMaxAnisotropy();

    const earthGeo = new THREE.SphereGeometry(earthRadius, 64, 64);
    const earthMat = new THREE.MeshStandardMaterial({
      map: earthTexture,
      roughness: 0.72,
      metalness: 0.14,
    });
    const earthMesh = new THREE.Mesh(earthGeo, earthMat);
    earthGroup.add(earthMesh);

    // Atmospheric Fresnel Glacial Rim Shader
    const atmosGeo = new THREE.SphereGeometry(earthRadius * 1.036, 64, 64);
    const atmosMat = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      side: THREE.BackSide,
      blending: THREE.AdditiveBlending,
      vertexShader: `
        varying vec3 vWorldNormal;
        varying vec3 vWorldPos;
        void main() {
          vWorldNormal = normalize(mat3(modelMatrix) * normal);
          vec4 wp = modelMatrix * vec4(position, 1.0);
          vWorldPos = wp.xyz;
          gl_Position = projectionMatrix * viewMatrix * wp;
        }
      `,
      fragmentShader: `
        varying vec3 vWorldNormal;
        varying vec3 vWorldPos;
        void main() {
          vec3 viewDir = normalize(cameraPosition - vWorldPos);
          float rim = pow(clamp(0.75 - dot(viewDir, -normalize(vWorldNormal)), 0.0, 1.0), 2.5);
          gl_FragColor = vec4(0.65, 0.90, 0.97, rim * 0.58);
        }
      `,
    });
    const atmosMesh = new THREE.Mesh(atmosGeo, atmosMat);
    earthGroup.add(atmosMesh);

    // Sun-synchronous polar orbit ring
    const orbitRadius = 1.72;
    const orbitPts: THREE.Vector3[] = [];
    for (let i = 0; i <= 128; i++) {
      const a = (i / 128) * Math.PI * 2;
      orbitPts.push(
        new THREE.Vector3(Math.cos(a) * orbitRadius, Math.sin(a) * orbitRadius, 0)
      );
    }
    const orbitGeo = new THREE.BufferGeometry().setFromPoints(orbitPts);
    const orbitMat = new THREE.LineBasicMaterial({
      color: 0xa5e4f7,
      transparent: true,
      opacity: 0.34,
    });
    const orbitRing = new THREE.LineLoop(orbitGeo, orbitMat);
    orbitRing.rotation.y = 0.45;
    orbitRing.rotation.x = 0.18;
    scene.add(orbitRing);

    const satellite = buildSarSatelliteGroup();
    scene.add(satellite);

    // Distant ice-crystal starfield
    const starCount = 420;
    const starPositions = new Float32Array(starCount * 3);
    for (let i = 0; i < starCount; i++) {
      const r = 12 + Math.random() * 14;
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      starPositions[i * 3] = r * Math.sin(phi) * Math.cos(theta);
      starPositions[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
      starPositions[i * 3 + 2] = r * Math.cos(phi);
    }
    const starGeo = new THREE.BufferGeometry();
    starGeo.setAttribute('position', new THREE.BufferAttribute(starPositions, 3));
    const starMat = new THREE.PointsMaterial({
      color: 0xe4f7fc,
      size: 0.045,
      transparent: true,
      opacity: 0.6,
    });
    const stars = new THREE.Points(starGeo, starMat);
    scene.add(stars);

    // Interactive site beacons on Earth surface (Layer 1 for raycasting)
    const clickableMeshes: THREE.Mesh[] = [];
    const beaconGeo = new THREE.SphereGeometry(0.038, 16, 16);
    const ringGeo = new THREE.RingGeometry(0.054, 0.072, 24);
    const upAxis = new THREE.Vector3(0, 1, 0);

    sites.forEach((site) => {
      const pos = latLngToVec3(site.lat, site.lng, earthRadius + 0.015);
      const beaconMat = new THREE.MeshBasicMaterial({ color: 0xa5e4f7 });
      const beacon = new THREE.Mesh(beaconGeo, beaconMat);
      beacon.position.copy(pos);
      beacon.layers.set(1);
      beacon.userData = { site };
      earthGroup.add(beacon);
      clickableMeshes.push(beacon);

      const ringMat = new THREE.MeshBasicMaterial({
        color: 0xf2fafc,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.85,
      });
      const ring = new THREE.Mesh(ringGeo, ringMat);
      ring.position.copy(pos);
      const normalDir = pos.clone().normalize();
      ring.quaternion.setFromUnitVectors(upAxis, normalDir);
      ring.rotateX(Math.PI / 2);
      earthGroup.add(ring);
    });

    const raycaster = new THREE.Raycaster();
    raycaster.layers.set(1);
    const pointer = new THREE.Vector2();
    let lastHoverCheck = 0;
    let userDragging = false;

    const onControlStart = () => {
      userDragging = true;
      resettingCamera = false;
    };
    const onControlEnd = () => {
      userDragging = false;
    };
    controls.addEventListener('start', onControlStart);
    controls.addEventListener('end', onControlEnd);

    const updatePointer = (clientX: number, clientY: number) => {
      const rect = renderer.domElement.getBoundingClientRect();
      pointer.x = ((clientX - rect.left) / rect.width) * 2 - 1;
      pointer.y = -((clientY - rect.top) / rect.height) * 2 + 1;
    };

    const onPointerMove = (e: PointerEvent) => {
      const now = performance.now();
      if (now - lastHoverCheck < 50) return;
      lastHoverCheck = now;
      updatePointer(e.clientX, e.clientY);
      raycaster.setFromCamera(pointer, camera);
      const hits = raycaster.intersectObjects(clickableMeshes, false);
      if (hits.length > 0) {
        const hitSite = hits[0].object.userData.site as SarObservationSite;
        setHoveredSite(hitSite);
        renderer.domElement.style.cursor = 'pointer';
      } else {
        renderer.domElement.style.cursor = userDragging ? 'grabbing' : 'grab';
      }
    };

    const onClick = (e: MouseEvent) => {
      updatePointer(e.clientX, e.clientY);
      raycaster.setFromCamera(pointer, camera);
      const hits = raycaster.intersectObjects(clickableMeshes, false);
      if (hits.length > 0) {
        const hitSite = hits[0].object.userData.site as SarObservationSite;
        onSelectSiteRef.current(hitSite.id);
      }
    };

    renderer.domElement.addEventListener('pointermove', onPointerMove);
    renderer.domElement.addEventListener('click', onClick);

    const _satLocalPos = new THREE.Vector3();
    const _origin = new THREE.Vector3(0, 0, 0);
    const _orbitEuler = new THREE.Euler(0.18, 0.45, 0);
    const _orbitQuat = new THREE.Quaternion().setFromEuler(_orbitEuler);

    let lastTime = performance.now();
    let orbitElapsed = 0.6;
    let frameId = 0;
    let disposed = false;

    const prefersReducedMotion = window.matchMedia(
      '(prefers-reduced-motion: reduce)'
    ).matches;

    if (!isSoftwareGl) {
      renderer.compile(scene, camera);
    }

    function afterDraw(cb: () => void) {
      const gl = renderer.getContext() as WebGL2RenderingContext;
      const sync = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
      gl.flush();
      const poll = () => {
        if (disposed) return;
        const state = sync && gl.getSyncParameter(sync, gl.SYNC_STATUS);
        if (state === gl.UNSIGNALED) {
          frameId = window.setTimeout(poll, 5);
        } else {
          if (sync) gl.deleteSync(sync);
          frameId = window.setTimeout(cb, 80);
        }
      };
      frameId = window.setTimeout(poll, 5);
    }

    function tick() {
      if (disposed) return;
      const now = performance.now();
      const dt = Math.min((now - lastTime) / 1000, 0.1);
      lastTime = now;

      if (!prefersReducedMotion && !pausedRef.current) {
        if (!userDragging) {
          earthGroup.rotation.y += dt * 0.12;
        }
        orbitElapsed += dt * 0.42;
      }

      if (resettingCamera) {
        const dampFactor = 1 - Math.exp(-6 * dt);
        camera.position.lerp(defaultCamPos, dampFactor);
        if (camera.position.distanceTo(defaultCamPos) < 0.01) {
          camera.position.copy(defaultCamPos);
          resettingCamera = false;
        }
      }

      _satLocalPos.set(
        Math.cos(orbitElapsed) * orbitRadius,
        Math.sin(orbitElapsed) * orbitRadius,
        0
      );
      _satLocalPos.applyQuaternion(_orbitQuat);
      satellite.position.copy(_satLocalPos);
      satellite.lookAt(_origin);
      satellite.rotateX(-Math.PI / 2);

      controls.update();
      renderer.render(scene, camera);

      if (isSoftwareGl) {
        afterDraw(tick);
      } else {
        frameId = requestAnimationFrame(tick);
      }
    }

    tick();

    const resizeObserver = new ResizeObserver(() => {
      if (!container || disposed) return;
      const w = container.clientWidth;
      const h = container.clientHeight;
      if (w === 0 || h === 0) return;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    });
    resizeObserver.observe(container);

    return () => {
      disposed = true;
      cancelAnimationFrame(frameId);
      clearTimeout(frameId);
      resizeObserver.disconnect();
      controls.removeEventListener('start', onControlStart);
      controls.removeEventListener('end', onControlEnd);
      controls.dispose();
      renderer.domElement.removeEventListener('pointermove', onPointerMove);
      renderer.domElement.removeEventListener('click', onClick);

      earthTexture.dispose();
      earthGeo.dispose();
      earthMat.dispose();
      atmosGeo.dispose();
      atmosMat.dispose();
      orbitGeo.dispose();
      orbitMat.dispose();
      starGeo.dispose();
      starMat.dispose();
      beaconGeo.dispose();
      ringGeo.dispose();
      envTarget.dispose();

      scene.traverse((obj) => {
        if (obj instanceof THREE.Mesh) {
          obj.geometry?.dispose();
          if (Array.isArray(obj.material)) {
            obj.material.forEach((m) => m.dispose());
          } else {
            obj.material?.dispose();
          }
        }
      });

      renderer.dispose();
      if (renderer.domElement.parentNode === container) {
        container.removeChild(renderer.domElement);
      }
    };
  }, [sites]);

  return (
    <div className="relative h-[430px] w-full overflow-hidden rounded-lg border border-frost-line bg-glacial-abyss lg:h-[520px]">
      <div
        ref={mountRef}
        className="h-full w-full"
        aria-label="Interactive 3D Glacial Earth with orbiting Synthetic Aperture Radar satellite"
      />

      {/* Solid-surface compact bottom control dock (no backdrop-filter over WebGL) */}
      <div className="absolute inset-x-4 bottom-4 flex flex-wrap items-center justify-between gap-3 rounded-md border border-frost-line bg-arctic-teal/95 px-4 py-2.5">
        {hoveredSite ? (
          <div className="min-w-0 flex-1">
            <p className="truncate font-display text-sm font-semibold text-crystal-white">
              {hoveredSite.title}
            </p>
            <p className="mt-0.5 font-mono text-[11px] text-ice-blue tabular-nums">
              {hoveredSite.country} · {hoveredSite.lat.toFixed(1)}°,{' '}
              {hoveredSite.lng.toFixed(1)}°
            </p>
          </div>
        ) : (
          <p className="font-mono text-xs text-frost-mist">
            Drag globe · Click any beacon
          </p>
        )}

        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => setPaused((p) => !p)}
            aria-label={paused ? 'Resume orbit' : 'Pause orbit'}
            className="inline-flex items-center gap-1 rounded border border-frost-line bg-crevasse px-2.5 py-1.5 font-mono text-[11px] text-crystal-white transition-colors hover:border-ice-blue/60 hover:text-ice-blue"
          >
            {paused ? <Play className="h-3 w-3" /> : <Pause className="h-3 w-3" />}
            <span>{paused ? 'Play' : 'Pause'}</span>
          </button>
          <button
            type="button"
            onClick={() => resetCameraRef.current?.()}
            aria-label="Reset camera view"
            className="inline-flex items-center gap-1 rounded border border-frost-line bg-crevasse px-2.5 py-1.5 font-mono text-[11px] text-crystal-white transition-colors hover:border-ice-blue/60 hover:text-ice-blue"
          >
            <RotateCcw className="h-3 w-3" />
            <span>Reset</span>
          </button>
          {hoveredSite && (
            <button
              type="button"
              onClick={() => onSelectSite(hoveredSite.id)}
              className="rounded bg-crystal-white px-3 py-1.5 font-mono text-[11px] font-semibold text-glacial-abyss transition-colors hover:bg-ice-blue whitespace-nowrap"
            >
              Open Map
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
