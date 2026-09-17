import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import type { Graph } from "../graph/types";
import { layoutSpace } from "../graph/layout3d";
import { connectionKey } from "../graph/path";
interface SignalNode {
  id: string;
  position: THREE.Vector3;
  origin: THREE.Vector3;
  target: THREE.Vector3;
  alpha: number;
  targetAlpha: number;
  started: number;
  delay: number;
  label: THREE.Sprite;
  active: boolean;
}
interface CameraFlight {
  from: THREE.Vector3;
  to: THREE.Vector3;
  lookFrom: THREE.Vector3;
  lookTo: THREE.Vector3;
  started: number;
  duration: number;
}
const ease = (t: number) => {
  const n = Math.max(0, Math.min(1, t));
  return n < 0.5 ? 4 * n * n * n : 1 - Math.pow(-2 * n + 2, 3) / 2;
};
const NODE_LIMIT = 700;
/** Three-dimensional, retained signal space. Domain evidence is independent of WebGL.
 * The same camera supports orbit, dolly, focus and a cancellable route fly-through. */
export class SpaceScene {
  private readonly renderer: THREE.WebGLRenderer;
  private readonly scene = new THREE.Scene();
  private readonly camera = new THREE.PerspectiveCamera(52, 1, 0.5, 2400);
  private readonly controls: OrbitControls;
  private readonly nodes = new Map<string, SignalNode>();
  private readonly pointGeometry = new THREE.BufferGeometry();
  private readonly lineGeometry = new THREE.BufferGeometry();
  private readonly routeGeometry = new THREE.BufferGeometry();
  private readonly labels = new THREE.Group();
  private readonly pointMaterial: THREE.ShaderMaterial;
  private readonly edges: THREE.LineSegments;
  private readonly route: THREE.LineSegments;
  private readonly stars: THREE.Points;
  private readonly traveler: THREE.Mesh;
  private readonly positions = new Float32Array(NODE_LIMIT * 3);
  private readonly colors = new Float32Array(NODE_LIMIT * 3);
  private readonly alphas = new Float32Array(NODE_LIMIT);
  private readonly sizes = new Float32Array(NODE_LIMIT);
  private edgeData: Graph["edges"] = [];
  private path: string[] = [];
  private indexToId: string[] = [];
  private flight: CameraFlight | null = null;
  private tour: { index: number; next: number } | null = null;
  private readonly raycaster = new THREE.Raycaster();
  private readonly pointer = new THREE.Vector2();
  private downPosition = { x: 0, y: 0 };
  private tickId = 0;
  private disposed = false;
  private lastFrame = 0;
  private batchStarted = 0;
  private readonly resize: ResizeObserver;
  private readonly reduced = window.matchMedia(
    "(prefers-reduced-motion: reduce)",
  );
  private readonly points: THREE.Points;
  private initializedGraph = false;
  private readonly keys = new Set<string>();
  private constructor(
    private readonly host: HTMLElement,
    private readonly onSelect: (id: string) => void,
  ) {
    this.renderer = new THREE.WebGLRenderer({
      alpha: true,
      antialias: true,
      powerPreference: "high-performance",
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setClearColor(0x000000, 0);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.domElement.setAttribute("aria-hidden", "true");
    host.appendChild(this.renderer.domElement);
    this.camera.position.set(155, 85, 465);
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.055;
    this.controls.minDistance = 25;
    this.controls.maxDistance = 1400;
    this.controls.enablePan = true;
    this.controls.rotateSpeed = 0.5;
    this.controls.zoomSpeed = 0.8;
    this.controls.addEventListener("start", this.interruptFlight);
    this.pointGeometry.setAttribute(
      "position",
      new THREE.BufferAttribute(this.positions, 3).setUsage(
        THREE.DynamicDrawUsage,
      ),
    );
    this.pointGeometry.setAttribute(
      "color",
      new THREE.BufferAttribute(this.colors, 3).setUsage(
        THREE.DynamicDrawUsage,
      ),
    );
    this.pointGeometry.setAttribute(
      "alpha",
      new THREE.BufferAttribute(this.alphas, 1).setUsage(
        THREE.DynamicDrawUsage,
      ),
    );
    this.pointGeometry.setAttribute(
      "size",
      new THREE.BufferAttribute(this.sizes, 1).setUsage(THREE.DynamicDrawUsage),
    );
    this.pointGeometry.setDrawRange(0, 0);
    this.pointGeometry.boundingSphere = new THREE.Sphere(
      new THREE.Vector3(),
      2000,
    );
    this.lineGeometry.setAttribute(
      "position",
      new THREE.BufferAttribute(new Float32Array(5000 * 6), 3).setUsage(
        THREE.DynamicDrawUsage,
      ),
    );
    this.routeGeometry.setAttribute(
      "position",
      new THREE.BufferAttribute(new Float32Array(14 * 6), 3).setUsage(
        THREE.DynamicDrawUsage,
      ),
    );
    this.pointMaterial = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      vertexColors: true,
      uniforms: { scale: { value: 900 } },
      vertexShader: `attribute float alpha; attribute float size; varying vec3 vColor; varying float vAlpha; uniform float scale; void main(){vColor=color;vAlpha=alpha;vec4 mv=modelViewMatrix*vec4(position,1.0);gl_Position=projectionMatrix*mv;gl_PointSize=clamp(size*scale/max(1.0,-mv.z),1.0,85.0);}`,
      fragmentShader: `varying vec3 vColor;varying float vAlpha;void main(){float d=length(gl_PointCoord-0.5);float core=1.0-smoothstep(0.035,0.13,d);float glow=exp(-d*8.0)*0.52;gl_FragColor=vec4(vColor,(core+glow)*vAlpha);}`,
    });
    this.points = new THREE.Points(this.pointGeometry, this.pointMaterial);
    this.points.frustumCulled = false;
    this.scene.add(this.points, this.labels);
    this.edges = new THREE.LineSegments(
      this.lineGeometry,
      new THREE.LineBasicMaterial({
        color: 0x267a51,
        transparent: true,
        opacity: 0.24,
        depthWrite: false,
      }),
    );
    this.route = new THREE.LineSegments(
      this.routeGeometry,
      new THREE.LineBasicMaterial({
        color: 0x8bffc1,
        transparent: true,
        opacity: 0.9,
        depthWrite: false,
      }),
    );
    this.scene.add(this.edges, this.route);
    const starPositions = new Float32Array(2400 * 3);
    let random = 42;
    const rng = () => {
      random = (Math.imul(random, 1664525) + 1013904223) >>> 0;
      return random / 4294967296;
    };
    for (let i = 0; i < 2400; i++) {
      const radius = 320 + rng() * 650,
        theta = rng() * Math.PI * 2,
        z = rng() * 2 - 1,
        r = Math.sqrt(1 - z * z);
      starPositions.set(
        [
          Math.cos(theta) * r * radius,
          z * radius,
          Math.sin(theta) * r * radius,
        ],
        i * 3,
      );
    }
    const starGeometry = new THREE.BufferGeometry();
    starGeometry.setAttribute(
      "position",
      new THREE.BufferAttribute(starPositions, 3),
    );
    this.stars = new THREE.Points(
      starGeometry,
      new THREE.PointsMaterial({
        color: 0x4f9972,
        size: 0.95,
        sizeAttenuation: false,
        transparent: true,
        opacity: 0.45,
        depthWrite: false,
      }),
    );
    this.scene.add(this.stars);
    this.traveler = new THREE.Mesh(
      new THREE.SphereGeometry(1.1, 10, 10),
      new THREE.MeshBasicMaterial({ color: 0xd0ffe5 }),
    );
    this.traveler.visible = false;
    this.scene.add(this.traveler);
    this.resize = new ResizeObserver(this.measure);
    this.resize.observe(host);
    this.measure();
    this.renderer.domElement.addEventListener("pointerdown", this.down);
    this.renderer.domElement.addEventListener("pointerup", this.up);
    this.renderer.domElement.addEventListener("pointermove", this.hover);
    this.renderer.domElement.tabIndex = 0;
    this.renderer.domElement.addEventListener("keydown", this.keyDown);
    this.renderer.domElement.addEventListener("keyup", this.keyUp);
    this.renderer.domElement.addEventListener("blur", this.clearKeys);
    this.lastFrame = performance.now();
    this.tickId = requestAnimationFrame(this.frame);
  }
  static async create(host: HTMLElement, onSelect: (id: string) => void) {
    return new SpaceScene(host, onSelect);
  }
  private measure = () => {
    const width = this.host.clientWidth,
      height = this.host.clientHeight;
    this.renderer.setSize(width, height);
    this.camera.aspect = width / Math.max(1, height);
    this.camera.updateProjectionMatrix();
    this.pointMaterial.uniforms.scale.value =
      (height * this.renderer.getPixelRatio()) /
      (2 * Math.tan(THREE.MathUtils.degToRad(26)));
  };
  private label(id: string) {
    const canvas = document.createElement("canvas");
    const context = canvas.getContext("2d")!;
    context.font = "36px monospace";
    canvas.width = Math.ceil(context.measureText("@" + id).width) + 36;
    canvas.height = 68;
    context.font = "36px monospace";
    context.fillStyle = "#c5ffdc";
    context.shadowColor = "#4fff9b";
    context.shadowBlur = 5;
    context.fillText("@" + id, 18, 45);
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    const material = new THREE.SpriteMaterial({
      map: texture,
      transparent: true,
      depthWrite: false,
      depthTest: false,
      opacity: 0,
    });
    const sprite = new THREE.Sprite(material);
    sprite.scale.set(canvas.width * 0.16, canvas.height * 0.16, 1);
    sprite.center.set(0, 0.5);
    this.labels.add(sprite);
    return sprite;
  }
  setGraph(graph: Graph, path: string[]) {
    if (this.disposed) return;
    const now = performance.now();
    this.batchStarted = now;
    const positions = layoutSpace(graph, path);
    const present = new Set(graph.nodes.map((n) => n.login));
    const pathChanged = path.join(">") !== this.path.join(">");
    this.path = [...path];
    this.edgeData = graph.edges;
    for (const [id, node] of this.nodes)
      if (!present.has(id)) node.targetAlpha = 0;
    for (const [i, coder] of graph.nodes.entries()) {
      const next = positions.get(coder.login)!;
      let node = this.nodes.get(coder.login);
      if (!node) {
        // Retirement can overlap a new page, but never grow GPU buffers without a bound.
        if (this.nodes.size >= NODE_LIMIT) {
          const retired = [...this.nodes.values()].find(
            (n) => n.targetAlpha === 0,
          );
          if (retired) this.removeNode(retired.id);
          else continue;
        }
        const parent = graph.edges.find(
          (e) => e.target === coder.login && this.nodes.has(e.source),
        );
        const origin = parent
          ? this.nodes.get(parent.source)!.position.clone()
          : new THREE.Vector3(0, 0, -90);
        node = {
          id: coder.login,
          position: origin.clone(),
          origin,
          target: new THREE.Vector3(next.x, next.y, next.z),
          alpha: 0,
          targetAlpha: 1,
          started: now,
          delay: Math.min(i * 32, 2800),
          label: this.label(coder.login),
          active: false,
        };
        this.nodes.set(coder.login, node);
      } else {
        node.origin.copy(node.position);
        node.target.set(next.x, next.y, next.z);
        node.started = now;
        node.delay = 0;
      }
      node.active = path.includes(coder.login);
      node.targetAlpha = 1;
    }
    if (!this.initializedGraph && graph.nodes.length) {
      this.initializedGraph = true;
      this.camera.position.set(250, 140, 760);
      this.moveCamera(
        new THREE.Vector3(130, 65, this.camera.aspect < 0.8 ? 650 : 410),
        new THREE.Vector3(),
        5000,
      );
    }
    if (pathChanged && path.length > 1) {
      this.tour = null;
    }
  }
  private removeNode(id: string) {
    const node = this.nodes.get(id);
    if (!node) return;
    node.label.material.map?.dispose();
    node.label.material.dispose();
    this.labels.remove(node.label);
    this.nodes.delete(id);
  }
  private frame = (now: number) => {
    if (this.disposed) return;
    const dt = Math.min(60, now - this.lastFrame);
    this.lastFrame = now;
    let index = 0;
    this.indexToId = [];
    for (const [id, node] of this.nodes) {
      const t = this.reduced.matches
        ? 1
        : ease((now - node.started - node.delay) / 2200);
      node.position.lerpVectors(node.origin, node.target, t);
      node.alpha = THREE.MathUtils.lerp(
        node.alpha,
        node.targetAlpha,
        this.reduced.matches ? 1 : 1 - Math.exp(-dt / 220),
      );
      if (node.targetAlpha === 0 && node.alpha < 0.005) {
        this.removeNode(id);
        continue;
      }
      this.positions.set(node.position.toArray(), index * 3);
      this.colors.set(
        node.active ? [0.55, 1, 0.74] : [0.12, 0.72, 0.4],
        index * 3,
      );
      this.alphas[index] = node.alpha;
      this.sizes[index] = node.active ? 17 : 8;
      const distance = this.camera.position.distanceTo(node.position);
      node.label.position
        .copy(node.position)
        .add(new THREE.Vector3(node.active ? 7 : 4, 0, 0));
      node.label.visible =
        node.active || this.nodes.size < 24 || distance < 100;
      node.label.material.opacity =
        node.alpha * (node.active ? 0.94 : Math.max(0.15, 1 - distance / 600));
      const labelScale = THREE.MathUtils.clamp(distance / 420, 0.55, 1.8);
      const texture = node.label.material.map?.image as HTMLCanvasElement;
      node.label.scale.set(
        texture.width * 0.16 * labelScale,
        texture.height * 0.16 * labelScale,
        1,
      );
      this.indexToId.push(id);
      index++;
    }
    this.pointGeometry.setDrawRange(0, index);
    for (const key of ["position", "color", "alpha", "size"])
      this.pointGeometry.attributes[key].needsUpdate = true;
    const lines: number[] = [],
      route: number[] = [];
    const routeKeys = new Set(
      this.path.slice(1).map((id, i) => connectionKey(this.path[i], id)),
    );
    for (const edge of this.edgeData) {
      const a = this.nodes.get(edge.source),
        b = this.nodes.get(edge.target);
      if (!a || !b) continue;
      const target = routeKeys.has(connectionKey(edge.source, edge.target))
        ? route
        : lines;
      const progress = this.reduced.matches
        ? 1
        : ease(
            (now -
              Math.max(a.started, b.started) -
              Math.max(a.delay, b.delay)) /
              2400,
          );
      const end = a.position.clone().lerp(b.position, progress);
      target.push(...a.position.toArray(), ...end.toArray());
    }
    this.updateLines(this.lineGeometry, lines);
    this.updateLines(this.routeGeometry, route);
    if (this.tour && now >= this.tour.next) {
      const id = this.path[this.tour.index];
      if (id) {
        this.focus(id, 3800);
        this.onSelect(id);
        this.tour.index++;
        this.tour.next = now + 5000;
      } else this.tour = null;
    }
    if (this.flight) {
      const t = this.reduced.matches
        ? 1
        : ease((now - this.flight.started) / this.flight.duration);
      this.camera.position.lerpVectors(this.flight.from, this.flight.to, t);
      this.controls.target.lerpVectors(
        this.flight.lookFrom,
        this.flight.lookTo,
        t,
      );
      if (t >= 1) this.flight = null;
    }
    if (this.keys.size) {
      const forward = this.camera.getWorldDirection(new THREE.Vector3());
      const right = new THREE.Vector3()
        .crossVectors(forward, this.camera.up)
        .normalize();
      const movement = new THREE.Vector3();
      if (this.keys.has("w")) movement.add(forward);
      if (this.keys.has("s")) movement.sub(forward);
      if (this.keys.has("d")) movement.add(right);
      if (this.keys.has("a")) movement.sub(right);
      if (this.keys.has("e")) movement.y += 1;
      if (this.keys.has("q")) movement.y -= 1;
      movement.normalize().multiplyScalar(dt * 0.11);
      this.camera.position.add(movement);
      this.controls.target.add(movement);
    }
    this.controls.update();
    if (!this.reduced.matches) this.stars.rotation.y += dt * 0.000007;
    this.traveler.visible = this.path.length > 1 && !this.reduced.matches;
    if (this.traveler.visible) {
      const progress =
        (((now - this.batchStarted) % 6500) / 6500) * (this.path.length - 1);
      const step = Math.min(this.path.length - 2, Math.floor(progress));
      const a = this.nodes.get(this.path[step]),
        b = this.nodes.get(this.path[step + 1]);
      if (a && b)
        this.traveler.position.lerpVectors(
          a.position,
          b.position,
          progress - step,
        );
    }
    this.renderer.render(this.scene, this.camera);
    this.tickId = requestAnimationFrame(this.frame);
  };
  private updateLines(geometry: THREE.BufferGeometry, data: number[]) {
    const existing = geometry.getAttribute("position");
    if (!existing || existing.array.length < data.length) {
      geometry.setAttribute(
        "position",
        new THREE.Float32BufferAttribute(
          new Float32Array(Math.max(data.length, 6)),
          3,
        ),
      );
    }
    const attribute = geometry.getAttribute(
      "position",
    ) as THREE.BufferAttribute;
    (attribute.array as Float32Array).set(data);
    attribute.needsUpdate = true;
    geometry.setDrawRange(0, data.length / 3);
    geometry.computeBoundingSphere();
  }
  private moveCamera(
    position: THREE.Vector3,
    target: THREE.Vector3,
    duration: number,
  ) {
    this.flight = {
      from: this.camera.position.clone(),
      to: position,
      lookFrom: this.controls.target.clone(),
      lookTo: target,
      started: performance.now(),
      duration,
    };
  }
  private focus(id: string, duration = 2600) {
    const node = this.nodes.get(id);
    if (!node) return;
    const offset = this.camera.position
      .clone()
      .sub(this.controls.target)
      .normalize()
      .multiplyScalar(125);
    offset.y += 20;
    this.moveCamera(
      node.target.clone().add(offset),
      node.target.clone(),
      duration,
    );
  }
  replay() {
    if (!this.path.length) return;
    this.tour = { index: 0, next: performance.now() };
  }
  fit() {
    this.tour = null;
    this.moveCamera(
      new THREE.Vector3(130, 65, this.camera.aspect < 0.8 ? 720 : 480),
      new THREE.Vector3(),
      2600,
    );
  }
  zoom(factor: number) {
    this.tour = null;
    const offset = this.camera.position.clone().sub(this.controls.target);
    offset.multiplyScalar(1 / factor);
    offset.clampLength(25, 1400);
    this.moveCamera(
      this.controls.target.clone().add(offset),
      this.controls.target.clone(),
      1000,
    );
  }
  private interruptFlight = () => {
    this.flight = null;
    this.tour = null;
  };
  private keyDown = (event: KeyboardEvent) => {
    const key = event.key.toLowerCase();
    if (
      "wasdqe".includes(key) &&
      key.length === 1 &&
      !event.metaKey &&
      !event.ctrlKey
    ) {
      event.preventDefault();
      this.interruptFlight();
      this.keys.add(key);
    }
  };
  private keyUp = (event: KeyboardEvent) => {
    this.keys.delete(event.key.toLowerCase());
  };
  private clearKeys = () => this.keys.clear();
  private down = (event: PointerEvent) => {
    this.renderer.domElement.focus({ preventScroll: true });
    this.downPosition = { x: event.clientX, y: event.clientY };
  };
  private hit(event: PointerEvent) {
    const rect = this.renderer.domElement.getBoundingClientRect();
    this.pointer.set(
      ((event.clientX - rect.left) / rect.width) * 2 - 1,
      (-(event.clientY - rect.top) / rect.height) * 2 + 1,
    );
    this.raycaster.params.Points = { threshold: 5 };
    this.raycaster.setFromCamera(this.pointer, this.camera);
    return this.raycaster.intersectObject(this.points)[0];
  }
  private up = (event: PointerEvent) => {
    if (
      Math.hypot(
        event.clientX - this.downPosition.x,
        event.clientY - this.downPosition.y,
      ) > 5
    )
      return;
    const hit = this.hit(event);
    if (hit?.index !== undefined) {
      const id = this.indexToId[hit.index];
      if (id) {
        this.onSelect(id);
        this.focus(id);
      }
    }
  };
  private hover = (event: PointerEvent) => {
    this.renderer.domElement.style.cursor = this.hit(event)
      ? "pointer"
      : "grab";
  };
  destroy() {
    if (this.disposed) return;
    this.disposed = true;
    cancelAnimationFrame(this.tickId);
    this.resize.disconnect();
    this.controls.removeEventListener("start", this.interruptFlight);
    this.controls.dispose();
    const canvas = this.renderer.domElement;
    canvas.removeEventListener("pointerdown", this.down);
    canvas.removeEventListener("pointerup", this.up);
    canvas.removeEventListener("pointermove", this.hover);
    canvas.removeEventListener("keydown", this.keyDown);
    canvas.removeEventListener("keyup", this.keyUp);
    canvas.removeEventListener("blur", this.clearKeys);
    for (const id of this.nodes.keys()) this.removeNode(id);
    for (const geometry of [
      this.pointGeometry,
      this.lineGeometry,
      this.routeGeometry,
      this.stars.geometry,
      this.traveler.geometry,
    ])
      geometry.dispose();
    this.pointMaterial.dispose();
    (this.edges.material as THREE.Material).dispose();
    (this.route.material as THREE.Material).dispose();
    (this.stars.material as THREE.Material).dispose();
    (this.traveler.material as THREE.Material).dispose();
    this.renderer.dispose();
    canvas.remove();
  }
}
