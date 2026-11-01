"use client";

import { useEffect, useRef, useState } from "react";
import type * as THREE_NS from "three";
import { skinById, type DiceSkin } from "@/lib/rules";

export interface Throw {
  id: string;
  who: string;
  color?: string;
  label: string;
  total: number | string;
  skin?: string;
  parts: { sides: number; value: number; dropped?: boolean }[];
  nat?: number | null;
  at?: number;
}

type THREE = typeof THREE_NS;

const FLIGHT = 1.35; // seconds in the air
const HOLD = 1.9; // seconds shown after landing

// ---- geometry ---------------------------------------------------------------
function d10Geometry(T: THREE) {
  // pentagonal trapezohedron: two poles + a ring of 10 vertices alternating up/down
  const h = 0.1056;
  const ring = Array.from({ length: 10 }, (_, i) => {
    const a = (i * Math.PI) / 5;
    return [Math.cos(a), Math.sin(a), i % 2 === 0 ? h : -h];
  });
  const N = [0, 0, 1], S = [0, 0, -1];
  const R = (i: number) => ring[((i % 10) + 10) % 10];
  const pos: number[] = [];
  for (let k = 0; k < 5; k++) {
    const u0 = R(2 * k), l1 = R(2 * k + 1), u2 = R(2 * k + 2), l3 = R(2 * k + 3);
    pos.push(...N, ...u0, ...l1, ...N, ...l1, ...u2); // top kite
    pos.push(...S, ...u2, ...l1, ...S, ...l3, ...u2); // bottom kite
  }
  const g = new T.BufferGeometry();
  g.setAttribute("position", new T.Float32BufferAttribute(pos, 3));
  g.computeVertexNormals();
  return g;
}

function dieGeometry(T: THREE, sides: number): THREE_NS.BufferGeometry {
  let g: THREE_NS.BufferGeometry;
  switch (sides) {
    case 4: g = new T.TetrahedronGeometry(1.15); break;
    case 6: g = new T.BoxGeometry(1.25, 1.25, 1.25); break;
    case 8: g = new T.OctahedronGeometry(1.05); break;
    case 12: g = new T.DodecahedronGeometry(1.05); break;
    case 20: g = new T.IcosahedronGeometry(1.1); break;
    default: g = d10Geometry(T); break; // d10, d100 and anything else
  }
  return g.index ? g.toNonIndexed() : g;
}

interface Face { normal: THREE_NS.Vector3; center: THREE_NS.Vector3; radius: number }

/** Groups triangles that share a normal into the die's logical faces. */
function faces(T: THREE, g: THREE_NS.BufferGeometry): Face[] {
  const p = g.getAttribute("position");
  const groups: { n: THREE_NS.Vector3; pts: THREE_NS.Vector3[] }[] = [];
  const a = new T.Vector3(), b = new T.Vector3(), c = new T.Vector3();
  for (let i = 0; i < p.count; i += 3) {
    a.fromBufferAttribute(p, i); b.fromBufferAttribute(p, i + 1); c.fromBufferAttribute(p, i + 2);
    const n = new T.Vector3().subVectors(c, b).cross(new T.Vector3().subVectors(a, b)).normalize();
    const tc = new T.Vector3().add(a).add(b).add(c).divideScalar(3);
    if (tc.dot(n) < 0) n.negate();
    let grp = groups.find((x) => x.n.dot(n) > 0.97);
    if (!grp) { grp = { n, pts: [] }; groups.push(grp); }
    grp.pts.push(a.clone(), b.clone(), c.clone());
  }
  return groups.map(({ n, pts }) => {
    const uniq: THREE_NS.Vector3[] = [];
    for (const v of pts) if (!uniq.some((u) => u.distanceTo(v) < 1e-4)) uniq.push(v);
    const center = uniq.reduce((acc, v) => acc.add(v), new T.Vector3()).divideScalar(uniq.length);
    if (center.dot(n) < 0) n.negate();
    const radius = Math.min(...uniq.map((v) => v.distanceTo(center)));
    return { normal: n, center, radius };
  });
}

function labelTexture(T: THREE, text: string, color: string) {
  const cv = document.createElement("canvas");
  cv.width = cv.height = 128;
  const ctx = cv.getContext("2d")!;
  ctx.fillStyle = color;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  const size = text.length > 2 ? 52 : text.length > 1 ? 66 : 80;
  ctx.font = `800 ${size}px Cinzel, Georgia, serif`;
  ctx.fillText(text, 64, 68);
  if (text === "6" || text === "9") ctx.fillRect(44, 104, 40, 6);
  const tex = new T.CanvasTexture(cv);
  tex.anisotropy = 4;
  return tex;
}

interface Built {
  group: THREE_NS.Group;
  target: THREE_NS.Quaternion;
  spin: THREE_NS.Vector3;
  start: THREE_NS.Vector3;
  end: THREE_NS.Vector3;
  delay: number;
  dropped: boolean;
  materials: THREE_NS.Material[];
}

function buildDie(T: THREE, sides: number, value: number, skin: DiceSkin, camDir: THREE_NS.Vector3): Built {
  const geo = dieGeometry(T, sides);
  const fs = faces(T, geo);
  const body = new T.MeshStandardMaterial({ color: skin.body, metalness: skin.metal, roughness: 0.32, flatShading: true, transparent: true, side: T.DoubleSide });
  const mesh = new T.Mesh(geo, body);
  const edges = new T.LineSegments(new T.EdgesGeometry(geo, 10), new T.LineBasicMaterial({ color: skin.edge, transparent: true }));
  const group = new T.Group();
  group.add(mesh, edges);
  const materials: THREE_NS.Material[] = [body, edges.material as THREE_NS.Material];

  // label faces 1..n; the face that will face the camera shows the real value
  const shownFace = Math.floor(Math.random() * fs.length);
  const labels = fs.map((_, i) => String((i % Math.max(sides, 1)) + 1));
  const valueStr = String(value);
  const already = labels.indexOf(valueStr);
  if (already >= 0 && already !== shownFace) labels[already] = labels[shownFace];
  labels[shownFace] = valueStr;
  fs.forEach((f, i) => {
    const tex = labelTexture(T, sides === 100 && labels[i] !== valueStr ? String((Number(labels[i]) % 10) * 10).padStart(2, "0") : labels[i], skin.text);
    const mat = new T.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false });
    materials.push(mat);
    const s = f.radius * (sides === 6 ? 1.3 : sides === 4 ? 1.1 : sides === 20 ? 1.25 : 1.4);
    const plane = new T.Mesh(new T.PlaneGeometry(s, s), mat);
    plane.position.copy(f.center).addScaledVector(f.normal, 0.012);
    plane.lookAt(f.center.clone().add(f.normal));
    group.add(plane);
  });

  const target = new T.Quaternion().setFromUnitVectors(fs[shownFace].normal.clone(), camDir.clone());
  // random twist around the view axis so dice don't all look identical
  target.premultiply(new T.Quaternion().setFromAxisAngle(camDir, (Math.random() - 0.5) * 0.6));
  return {
    group, target, materials, dropped: false, delay: 0,
    spin: new T.Vector3(Math.random() * 14 + 8, Math.random() * 14 + 8, Math.random() * 10),
    start: new T.Vector3(), end: new T.Vector3(),
  };
}

/**
 * Full-screen overlay that throws 3D dice across the table whenever a new throw arrives.
 * Everyone in the room sees the same dice land on the same numbers.
 */
export default function Dice3D({ throwData }: { throwData: Throw | null }) {
  const mount = useRef<HTMLDivElement>(null);
  const [caption, setCaption] = useState<Throw | null>(null);
  const [landed, setLanded] = useState(false);
  const engine = useRef<{
    T: THREE;
    renderer: THREE_NS.WebGLRenderer;
    scene: THREE_NS.Scene;
    camera: THREE_NS.PerspectiveCamera;
    dice: Built[];
    raf: number;
  } | null>(null);
  const lastId = useRef<string | null>(null);

  useEffect(() => {
    if (!throwData || throwData.id === lastId.current) return;
    lastId.current = throwData.id;
    if (throwData.at && Date.now() - throwData.at > 8000) return; // old roll from a saved room
    let cancelled = false;
    (async () => {
      const T = await import("three");
      if (cancelled || !mount.current) return;
      let e = engine.current;
      if (!e) {
        const renderer = new T.WebGLRenderer({ antialias: true, alpha: true });
        renderer.setPixelRatio(Math.min(2, window.devicePixelRatio));
        mount.current.appendChild(renderer.domElement);
        const scene = new T.Scene();
        const camera = new T.PerspectiveCamera(35, 1, 0.1, 100);
        camera.position.set(0, 9, 11);
        camera.lookAt(0, 0, 0);
        scene.add(new T.AmbientLight(0xffffff, 0.9));
        const key = new T.DirectionalLight(0xfff1d6, 2.2);
        key.position.set(4, 10, 6);
        scene.add(key);
        const rim = new T.DirectionalLight(0x9ec2ff, 0.8);
        rim.position.set(-6, 4, -4);
        scene.add(rim);
        e = engine.current = { T, renderer, scene, camera, dice: [], raf: 0 };
      }
      const { renderer, scene, camera } = e;
      const w = window.innerWidth, h = window.innerHeight;
      renderer.setSize(w, h);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();

      // clear the previous throw
      cancelAnimationFrame(e.raf);
      for (const d of e.dice) {
        scene.remove(d.group);
        d.group.traverse((o) => { if ((o as THREE_NS.Mesh).geometry) (o as THREE_NS.Mesh).geometry.dispose(); });
        d.materials.forEach((m) => { (m as THREE_NS.MeshBasicMaterial).map?.dispose(); m.dispose(); });
      }
      e.dice = [];

      const skin = skinById(throwData.skin);
      const parts = throwData.parts.slice(0, 10);
      const camDir = camera.position.clone().normalize();
      const n = parts.length;
      const spacing = Math.min(2.6, 12 / Math.max(1, n));
      const scale = n > 6 ? 0.75 : 1;
      parts.forEach((p, i) => {
        const d = buildDie(T, p.sides, p.value, skin, camDir);
        d.dropped = !!p.dropped;
        d.group.scale.setScalar(scale);
        d.end.set((i - (n - 1) / 2) * spacing, 0, (i % 2 ? 0.6 : -0.3) * (n > 4 ? 1 : 0));
        d.start.set(9 + Math.random() * 3, 5 + Math.random() * 2, 5 + Math.random() * 3);
        d.delay = i * 0.06;
        d.group.position.copy(d.start);
        d.group.quaternion.setFromEuler(new T.Euler(Math.random() * 6, Math.random() * 6, Math.random() * 6));
        scene.add(d.group);
        e!.dice.push(d);
      });

      setCaption(throwData);
      setLanded(false);
      const t0 = performance.now();
      const startQ = e.dice.map((d) => d.group.quaternion.clone());
      let landedFlag = false;
      const tick = () => {
        const t = (performance.now() - t0) / 1000;
        e!.dice.forEach((d, i) => {
          const u = Math.max(0, Math.min(1, (t - d.delay) / FLIGHT));
          const ease = 1 - Math.pow(1 - u, 3);
          d.group.position.lerpVectors(d.start, d.end, ease);
          // bounces: decaying |cos|
          const bounce = Math.abs(Math.cos(u * Math.PI * 2.5)) * Math.pow(1 - u, 2) * 3.2;
          d.group.position.y = d.end.y + bounce + (1 - ease) * d.start.y * 0.35;
          if (u < 0.72) {
            const k = (1 - u) * 0.016;
            const q = new T.Quaternion().setFromEuler(new T.Euler(d.spin.x * k, d.spin.y * k, d.spin.z * k));
            d.group.quaternion.multiply(q);
            startQ[i].copy(d.group.quaternion);
          } else {
            const v = Math.min(1, (u - 0.72) / 0.28);
            const s = v * v * (3 - 2 * v);
            d.group.quaternion.slerpQuaternions(startQ[i], d.target, s);
          }
          const fade = t > FLIGHT + HOLD ? Math.max(0, 1 - (t - FLIGHT - HOLD) / 0.5) : 1;
          const dim = d.dropped && u >= 1 ? 0.35 : 1;
          d.materials.forEach((m) => (m.opacity = fade * dim));
        });
        if (!landedFlag && t > FLIGHT + 0.1) {
          landedFlag = true;
          setLanded(true);
        }
        renderer.render(scene, camera);
        if (t < FLIGHT + HOLD + 0.55) e!.raf = requestAnimationFrame(tick);
        else {
          renderer.clear();
          setCaption(null);
        }
      };
      e.raf = requestAnimationFrame(tick);
    })();
    return () => {
      cancelled = true;
    };
  }, [throwData]);

  useEffect(() => () => {
    const e = engine.current;
    if (!e) return;
    cancelAnimationFrame(e.raf);
    e.renderer.dispose();
    e.renderer.domElement.remove();
    engine.current = null;
  }, []);

  const crit = caption?.nat === 20, fumble = caption?.nat === 1;
  return (
    <div className="pointer-events-none fixed inset-0 z-40" aria-hidden={!caption}>
      <div ref={mount} className="absolute inset-0" />
      {caption && (
        <div className="absolute inset-x-0 bottom-[16%] flex justify-center">
          <div className={`flex items-center gap-3 rounded-2xl border bg-[rgba(14,15,20,.88)] px-5 py-3 backdrop-blur transition-opacity duration-300 ${landed ? "opacity-100" : "opacity-0"} ${crit ? "border-gold crit-glow" : fumble ? "border-[#7A2A20]" : "border-gold-line"}`} role="status">
            <span className="h-3 w-3 rounded-full" style={{ background: caption.color }} />
            <span className="text-sm text-soft"><b className="text-parch-hi">{caption.who}</b> · {caption.label}</span>
            <span className={`font-display text-3xl font-extrabold ${crit ? "text-gold" : fumble ? "text-[#F28B7E]" : "text-parch-hi"}`}>{caption.total}</span>
            {crit && <span className="font-display text-sm font-extrabold tracking-[2px] text-gold">CRITICAL!</span>}
            {fumble && <span className="font-display text-sm font-extrabold tracking-[2px] text-[#F28B7E]">FUMBLE</span>}
          </div>
        </div>
      )}
    </div>
  );
}
