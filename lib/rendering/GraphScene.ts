import { Application, Container, Graphics, Text } from "pixi.js";
import type { Coder, Graph } from "../graph/types";
import { layoutGraph, type Point } from "../graph/layout";

interface NodeView {
  group: Container;
  body: Graphics;
  initials: Text;
  label: Text;
  tag: Text;
  position: Point;
  origin: Point;
  target: Point;
  started: number;
  delay: number;
  radius: number;
  targetRadius: number;
  alpha: number;
  targetAlpha: number;
  active: boolean;
  index: number;
  entering: boolean;
}
interface EdgeView {
  source: string;
  target: string;
  progress: number;
  alpha: number;
  targetAlpha: number;
  started: number;
  active: boolean;
  delay: number;
}
interface Camera {
  x: number;
  y: number;
  scale: number;
}
const ease = (t: number) => 1 - Math.pow(1 - Math.min(1, Math.max(0, t)), 3);
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const near = (a: number, b: number) => Math.abs(a - b) < 0.001;

/** A retained scene: React delivers evidence; keyed display objects retain motion and identity.
 * Only discovery, interaction and a short route celebration run the ticker. */
export class GraphScene {
  private readonly world = new Container();
  private readonly edges = new Graphics();
  private readonly route = new Graphics();
  private readonly traveler = new Graphics();
  private readonly nodeLayer = new Container();
  private readonly nodes = new Map<string, NodeView>();
  private readonly links = new Map<string, EdgeView>();
  private path: string[] = [];
  private graph: Graph = { nodes: [], edges: [] };
  private pathKey = "";
  private camera: Camera = { x: 0, y: 0, scale: 1 };
  private targetCamera: Camera = { x: 0, y: 0, scale: 1 };
  private lastFrame = 0;
  private celebrateFrom = 0;
  private celebrateUntil = 0;
  private disposed = false;
  private dragged = false;
  private drag: { x: number; y: number; camera: Camera } | null = null;
  private readonly reduced = window.matchMedia(
    "(prefers-reduced-motion: reduce)",
  );
  private resize?: ResizeObserver;
  private constructor(
    private readonly app: Application,
    private readonly host: HTMLElement,
    private readonly onSelect: (login: string) => void,
  ) {
    this.world.addChild(this.edges, this.route, this.traveler, this.nodeLayer);
    app.stage.addChild(this.world);
    app.ticker.maxFPS = 60;
    app.ticker.add(this.frame);
    host.appendChild(app.canvas);
    this.fit(true);
    let previousWidth = host.clientWidth,
      previousHeight = host.clientHeight;
    this.resize = new ResizeObserver(() => {
      if (
        previousWidth === host.clientWidth &&
        previousHeight === host.clientHeight
      )
        return;
      previousWidth = host.clientWidth;
      previousHeight = host.clientHeight;
      app.renderer.resize(host.clientWidth, host.clientHeight);
      this.fit();
      this.setGraph(this.graph, this.path);
    });
    this.resize.observe(host);
    app.canvas.addEventListener("pointerdown", this.down);
    app.canvas.addEventListener("pointermove", this.move);
    app.canvas.addEventListener("pointerup", this.up);
    app.canvas.addEventListener("pointercancel", this.up);
    app.canvas.addEventListener("wheel", this.wheel, { passive: false });
    this.reduced.addEventListener("change", this.wake);
  }
  static async create(
    host: HTMLElement,
    onSelect: (login: string) => void,
  ): Promise<GraphScene> {
    const app = new Application();
    await app.init({
      backgroundAlpha: 0,
      antialias: true,
      resolution: Math.min(window.devicePixelRatio, 2),
      autoDensity: true,
      autoStart: false,
      preference: "webgl",
      width: host.clientWidth,
      height: host.clientHeight,
    });
    return new GraphScene(app, host, onSelect);
  }
  private wake = () => {
    if (this.disposed) return;
    this.lastFrame = performance.now();
    this.app.start();
  };
  private makeNode(coder: Coder, origin: Point): NodeView {
    const group = new Container();
    const body = new Graphics();
    const initials = new Text({
      text: coder.login.slice(0, 2).toUpperCase(),
      style: {
        fontFamily: "Arial",
        fontSize: 15,
        fill: 0x315cff,
        fontWeight: "600",
      },
    });
    initials.anchor.set(0.5);
    const label = new Text({
      text: `@${coder.login}`,
      style: { fontFamily: "Arial", fontSize: 14, fill: 0x687c9b },
    });
    label.anchor.set(0.5, 0);
    const tag = new Text({
      text: "",
      style: {
        fontFamily: "Arial",
        fontSize: 10,
        letterSpacing: 1.4,
        fill: 0x8393ab,
      },
    });
    tag.anchor.set(0.5, 1);
    group.addChild(body, initials, label, tag);
    group.eventMode = "static";
    group.cursor = "pointer";
    group.on("pointertap", () => {
      if (!this.dragged) this.onSelect(coder.login);
    });
    this.nodeLayer.addChild(group);
    return {
      group,
      body,
      initials,
      label,
      tag,
      position: { ...origin },
      origin: { ...origin },
      target: { ...origin },
      started: 0,
      delay: 0,
      radius: 0,
      targetRadius: 19,
      alpha: 0,
      targetAlpha: 1,
      active: false,
      index: -1,
      entering: true,
    };
  }
  setGraph(graph: Graph, path: string[]) {
    if (this.disposed) return;
    this.graph = graph;
    const now = performance.now();
    const vertical = this.host.clientWidth < 620;
    const positions = layoutGraph(graph, path, vertical);
    const activeIds = new Set(graph.nodes.map((n) => n.login));
    const newPath = path.join(">") !== this.pathKey;
    this.path = [...path];
    this.pathKey = path.join(">");
    const pathEdges = new Set(path.slice(1).map((id, i) => `${path[i]}>${id}`));
    for (const [id, node] of this.nodes)
      if (!activeIds.has(id)) node.targetAlpha = 0;
    graph.nodes.forEach((coder, i) => {
      let node = this.nodes.get(coder.login);
      const target = positions.get(coder.login)!;
      if (!node) {
        const neighbor = graph.edges.find(
          (e) => e.target === coder.login && this.nodes.has(e.source),
        )?.source;
        const origin = neighbor
          ? this.nodes.get(neighbor)!.position
          : { x: 500, y: 350 };
        node = this.makeNode(coder, origin);
        this.nodes.set(coder.login, node);
        node.delay = this.reduced.matches ? 0 : Math.min(i * 28, 600);
      } else node.delay = 0;
      node.origin = { ...node.position };
      node.target = target;
      node.started = now;
      node.targetAlpha = 1;
      node.index = path.indexOf(coder.login);
      node.active = node.index >= 0;
      node.targetRadius = node.active
        ? vertical
          ? 34
          : 30
        : vertical
          ? 7
          : graph.nodes.length > 80
            ? 8
            : 18;
      node.label.visible =
        node.active || (!vertical && graph.nodes.length <= 20);
      node.label.style.fill = node.active ? 0x203a69 : 0x7c8da7;
      node.label.style.fontWeight = node.active ? "600" : "400";
      node.initials.visible =
        node.active || (!vertical && graph.nodes.length <= 80);
      node.initials.style.fontSize = node.active ? (vertical ? 20 : 16) : 11;
      node.label.style.fontSize = vertical ? 19 : 14;
      node.tag.style.fontSize = vertical ? 13 : 10;
      node.label.anchor.set(vertical ? 0 : 0.5, vertical ? 0.5 : 0);
      node.tag.anchor.set(vertical ? 1 : 0.5, vertical ? 0.5 : 1);
      node.tag.text =
        node.index === 0
          ? "START"
          : node.index === path.length - 1
            ? "DESTINATION"
            : `JUMP ${node.index}`;
      node.tag.visible = node.active;
      if (newPath && node.active && !this.reduced.matches)
        node.delay = node.index * 180;
    });
    const present = new Set<string>();
    graph.edges.forEach((edge, i) => {
      const key = `${edge.source}>${edge.target}`;
      present.add(key);
      const active = pathEdges.has(key);
      let view = this.links.get(key);
      if (!view) {
        view = {
          ...edge,
          progress: 0,
          alpha: 0,
          targetAlpha: 1,
          started: now,
          active,
          delay: Math.min(i * 18, 650),
        };
        this.links.set(key, view);
      }
      view.targetAlpha = 1;
      if (newPath && active) {
        view.started = now;
        view.progress = 0;
        view.delay = 250 + path.indexOf(edge.source) * 360;
      }
      view.active = active;
    });
    for (const [key, link] of this.links)
      if (!present.has(key)) link.targetAlpha = 0;
    if (newPath && path.length > 1 && !this.reduced.matches) {
      this.celebrateFrom = now + path.length * 360 + 300;
      this.celebrateUntil = this.celebrateFrom + 7500;
    }
    if (!path.length) {
      this.celebrateUntil = 0;
      this.traveler.clear();
    }
    this.wake();
  }
  private frame = () => {
    if (this.disposed) return;
    const now = performance.now();
    const dt = Math.min(64, now - this.lastFrame);
    this.lastFrame = now;
    const smooth = this.reduced.matches ? 1 : 1 - Math.exp(-dt / 110);
    let moving = false;
    for (const key of ["x", "y", "scale"] as const) {
      this.camera[key] = lerp(this.camera[key], this.targetCamera[key], smooth);
      moving ||= !near(this.camera[key], this.targetCamera[key]);
    }
    this.world.position.set(this.camera.x, this.camera.y);
    this.world.scale.set(this.camera.scale);
    for (const [id, node] of this.nodes) {
      const elapsed = now - node.started - node.delay;
      const t = this.reduced.matches ? 1 : ease(elapsed / 900);
      node.position = {
        x: lerp(node.origin.x, node.target.x, t),
        y: lerp(node.origin.y, node.target.y, t),
      };
      if (elapsed >= 0 || this.reduced.matches) {
        node.alpha = lerp(node.alpha, node.targetAlpha, smooth);
        node.radius = lerp(node.radius, node.targetRadius, smooth);
      }
      moving ||=
        t < 1 ||
        !near(node.alpha, node.targetAlpha) ||
        !near(node.radius, node.targetRadius);
      if (node.targetAlpha === 0 && node.alpha < 0.005) {
        node.group.destroy({ children: true });
        this.nodes.delete(id);
        continue;
      }
      node.group.position.set(node.position.x, node.position.y);
      node.group.alpha = node.alpha;
      const radius = node.radius;
      node.body.clear();
      if (node.active) {
        node.body
          .circle(0, 0, radius + 11)
          .fill({ color: 0x315cff, alpha: 0.045 });
        node.body
          .circle(0, 0, radius + 5)
          .fill({ color: 0x315cff, alpha: 0.04 });
      }
      node.body
        .circle(0, 0, Math.max(0.1, radius))
        .fill(node.active ? 0xffffff : 0xf8faff)
        .stroke({
          color: node.active ? 0x315cff : 0xc4cfe0,
          width: node.active ? 2.2 : 1.2,
        });
      node.initials.alpha = Math.min(1, radius / 18);
      const vertical = this.host.clientWidth < 620;
      node.label.position.set(
        vertical ? radius + 13 : 0,
        vertical ? 0 : radius + 12,
      );
      node.tag.position.set(
        vertical ? -radius - 15 : 0,
        vertical ? 0 : -radius - 16,
      );
    }
    this.edges.clear();
    this.route.clear();
    for (const [key, edge] of this.links) {
      const a = this.nodes.get(edge.source)?.position,
        b = this.nodes.get(edge.target)?.position;
      if (!a || !b) {
        this.links.delete(key);
        continue;
      }
      edge.alpha = lerp(edge.alpha, edge.targetAlpha, smooth);
      edge.progress = this.reduced.matches
        ? 1
        : ease((now - edge.started - edge.delay) / (edge.active ? 800 : 1000));
      moving ||= edge.progress < 1 || !near(edge.alpha, edge.targetAlpha);
      if (edge.targetAlpha === 0 && edge.alpha < 0.005) {
        this.links.delete(key);
        continue;
      }
      const end = {
        x: lerp(a.x, b.x, edge.progress),
        y: lerp(a.y, b.y, edge.progress),
      };
      const layer = edge.active ? this.route : this.edges;
      if (edge.active)
        layer
          .moveTo(a.x, a.y)
          .lineTo(end.x, end.y)
          .stroke({ color: 0x315cff, width: 11, alpha: edge.alpha * 0.04 });
      layer
        .moveTo(a.x, a.y)
        .lineTo(end.x, end.y)
        .stroke({
          color: edge.active ? 0x315cff : 0xaabbd3,
          width: edge.active ? 2.6 : 1,
          alpha: edge.alpha * (edge.active ? 1 : 0.35),
        });
      if (edge.active && edge.progress > 0.96) {
        const angle = Math.atan2(b.y - a.y, b.x - a.x);
        const x = b.x - Math.cos(angle) * 41,
          y = b.y - Math.sin(angle) * 41;
        layer
          .moveTo(x - 8 * Math.cos(angle - 0.5), y - 8 * Math.sin(angle - 0.5))
          .lineTo(x, y)
          .lineTo(x - 8 * Math.cos(angle + 0.5), y - 8 * Math.sin(angle + 0.5))
          .stroke({ color: 0x315cff, width: 2, alpha: edge.alpha });
      }
    }
    this.traveler.clear();
    if (
      !this.reduced.matches &&
      now > this.celebrateFrom &&
      now < this.celebrateUntil &&
      this.path.length > 1
    ) {
      moving = true;
      const progress =
        (((now - this.celebrateFrom) % 2500) / 2500) * (this.path.length - 1);
      const index = Math.min(this.path.length - 2, Math.floor(progress));
      const a = this.nodes.get(this.path[index])?.position,
        b = this.nodes.get(this.path[index + 1])?.position;
      if (a && b) {
        const t = progress - index,
          x = lerp(a.x, b.x, t),
          y = lerp(a.y, b.y, t);
        this.traveler
          .circle(x, y, 13)
          .fill({ color: 0x315cff, alpha: 0.07 })
          .circle(x, y, 7)
          .fill({ color: 0x315cff, alpha: 0.15 })
          .circle(x, y, 3)
          .fill(0x315cff);
      }
    } else if (
      !this.reduced.matches &&
      now < this.celebrateFrom &&
      this.celebrateUntil > now
    )
      moving = true;
    if (!moving) this.app.stop();
  };
  replay() {
    if (!this.path.length) return;
    this.pathKey = "";
    const path = [...this.path];
    if (!this.reduced.matches)
      for (const id of path) {
        const node = this.nodes.get(id);
        if (node) {
          node.radius = 16;
          node.alpha = 0.25;
        }
      }
    this.setGraph(this.graph, path);
  }
  zoom(
    factor: number,
    x = this.host.clientWidth / 2,
    y = this.host.clientHeight / 2,
  ) {
    const next = Math.min(3, Math.max(0.18, this.targetCamera.scale * factor));
    const ratio = next / this.targetCamera.scale;
    this.targetCamera = {
      x: x - (x - this.targetCamera.x) * ratio,
      y: y - (y - this.targetCamera.y) * ratio,
      scale: next,
    };
    this.wake();
  }
  fit(immediate = false) {
    const scale = Math.min(
      this.host.clientWidth / (this.host.clientWidth < 620 ? 600 : 1000),
      this.host.clientHeight / 740,
    );
    this.targetCamera = {
      x:
        (this.host.clientWidth -
          (this.host.clientWidth < 620 ? 600 : 1000) * scale) /
        2,
      y: (this.host.clientHeight - 700 * scale) / 2 + 20,
      scale,
    };
    if (immediate) this.camera = { ...this.targetCamera };
    this.wake();
  }
  private down = (event: PointerEvent) => {
    this.dragged = false;
    this.drag = {
      x: event.clientX,
      y: event.clientY,
      camera: { ...this.camera },
    };
    this.app.canvas.setPointerCapture(event.pointerId);
  };
  private move = (event: PointerEvent) => {
    if (!this.drag) return;
    const dx = event.clientX - this.drag.x,
      dy = event.clientY - this.drag.y;
    if (Math.hypot(dx, dy) > 5) this.dragged = true;
    if (this.dragged) {
      this.camera = {
        ...this.drag.camera,
        x: this.drag.camera.x + dx,
        y: this.drag.camera.y + dy,
      };
      this.targetCamera = { ...this.camera };
      this.wake();
    }
  };
  private up = () => {
    this.drag = null;
  };
  private wheel = (event: WheelEvent) => {
    event.preventDefault();
    const rect = this.app.canvas.getBoundingClientRect();
    this.zoom(
      Math.exp(-event.deltaY * 0.001),
      event.clientX - rect.left,
      event.clientY - rect.top,
    );
  };
  destroy() {
    if (this.disposed) return;
    this.disposed = true;
    this.resize?.disconnect();
    this.reduced.removeEventListener("change", this.wake);
    const canvas = this.app.canvas;
    canvas.removeEventListener("pointerdown", this.down);
    canvas.removeEventListener("pointermove", this.move);
    canvas.removeEventListener("pointerup", this.up);
    canvas.removeEventListener("pointercancel", this.up);
    canvas.removeEventListener("wheel", this.wheel);
    this.app.destroy(true, { children: true });
  }
}
