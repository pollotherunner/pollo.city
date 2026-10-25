import type { Post } from "@/api/types";
import { query } from "@/lib/dom";
import { truncate } from "@/lib/strings";
import { tagSlug } from "@/lib/tags";
import { onThemeChange } from "@/ui/theme";

type NodeType = "post" | "tag";

interface GraphNode {
  type: NodeType;
  label: string;
  slug: string;
  offTopic: boolean;
  radius: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
}

interface GraphEdge {
  source: GraphNode;
  target: GraphNode;
}

interface View {
  x: number;
  y: number;
  scale: number;
}

type PointerState =
  | { kind: "node"; node: GraphNode; startX: number; startY: number }
  | { kind: "pan"; startX: number; startY: number; panX: number; panY: number };

interface GraphColors {
  post: string;
  tagFill: string;
  stroke: string;
  label: string;
  edge: string;
  edgeStrong: string;
  halo: string;
}

function readGraphColors(): GraphColors {
  const style = getComputedStyle(document.documentElement);
  const token = (name: string, fallback: string): string => style.getPropertyValue(name).trim() || fallback;
  return {
    post: token("--graph-post", "#0a0a0a"),
    tagFill: token("--graph-tag-fill", "#ffffff"),
    stroke: token("--graph-stroke", "#0a0a0a"),
    label: token("--graph-label", "#0a0a0a"),
    edge: token("--graph-edge", "rgba(10, 10, 10, 0.14)"),
    edgeStrong: token("--graph-edge-strong", "rgba(10, 10, 10, 0.48)"),
    halo: token("--graph-halo", "rgba(10, 10, 10, 0.32)"),
  };
}

export interface PostsGraph {
  start(): void;
  stop(): void;
}

export function createPostsGraph(canvas: HTMLCanvasElement, posts: Post[]): PostsGraph {
  const frame = canvas.parentElement;
  const context = canvas.getContext("2d");
  if (!frame || !context) {
    throw new Error("Graph canvas is unavailable");
  }

  const tooltip = query<HTMLElement>("#graph-tooltip");
  const nodes: GraphNode[] = [];
  const edges: GraphEdge[] = [];
  const tagNodes = new Map<string, GraphNode>();
  const adjacency = new Map<GraphNode, Set<GraphNode>>();
  const view: View = { x: 0, y: 0, scale: 1 };
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  let colors = readGraphColors();

  let width = 1;
  let height = 1;
  let dpr = 1;
  let running = false;
  let frameId = 0;
  let hovered: GraphNode | null = null;
  let pointer: PointerState | null = null;
  let moved = false;

  posts.forEach((post) => {
    const node: GraphNode = {
      type: "post",
      label: post.title,
      slug: post.slug,
      offTopic: post.section === "off-topic",
      radius: 7,
      x: 0,
      y: 0,
      vx: 0,
      vy: 0,
    };
    nodes.push(node);
    adjacency.set(node, new Set());

    post.tags.forEach((tag) => {
      const slug = tagSlug(tag);
      if (!slug) {
        return;
      }

      let tagNode = tagNodes.get(slug);
      if (!tagNode) {
        tagNode = {
          type: "tag",
          label: tag,
          slug,
          offTopic: false,
          radius: 4.5,
          x: 0,
          y: 0,
          vx: 0,
          vy: 0,
        };
        tagNodes.set(slug, tagNode);
        nodes.push(tagNode);
        adjacency.set(tagNode, new Set());
      }

      edges.push({ source: node, target: tagNode });
      adjacency.get(node)?.add(tagNode);
      adjacency.get(tagNode)?.add(node);
    });
  });

  const tagCounts = new Map<GraphNode, number>();
  edges.forEach((edge) => {
    tagCounts.set(edge.target, (tagCounts.get(edge.target) ?? 0) + 1);
  });
  tagCounts.forEach((total, node) => {
    node.radius = 4.5 + Math.min(3.5, total * 0.65);
  });

  nodes.forEach((node, index) => {
    const angle = (index / Math.max(1, nodes.length)) * Math.PI * 2 + Math.random() * 0.8;
    const radius = 90 + Math.random() * 150;
    node.x = Math.cos(angle) * radius;
    node.y = Math.sin(angle) * radius;
  });

  const resize = (): void => {
    const rect = canvas.getBoundingClientRect();
    width = Math.max(1, rect.width);
    height = Math.max(1, rect.height);
    dpr = window.devicePixelRatio || 1;
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    draw();
  };

  const screenToWorld = (clientX: number, clientY: number): { x: number; y: number } => {
    const rect = canvas.getBoundingClientRect();
    return {
      x: (clientX - rect.left - width / 2 - view.x) / view.scale,
      y: (clientY - rect.top - height / 2 - view.y) / view.scale,
    };
  };

  const nodeAt = (clientX: number, clientY: number): GraphNode | null => {
    const point = screenToWorld(clientX, clientY);
    return (
      nodes.find((node) => {
        const dx = point.x - node.x;
        const dy = point.y - node.y;
        return Math.sqrt(dx * dx + dy * dy) <= node.radius + 9 / view.scale;
      }) ?? null
    );
  };

  const simulate = (): void => {
    nodes.forEach((node) => {
      if (pointer?.kind === "node" && pointer.node === node) {
        return;
      }
      node.vx -= node.x * 0.0018;
      node.vy -= node.y * 0.0018;
    });

    for (let first = 0; first < nodes.length; first += 1) {
      for (let second = first + 1; second < nodes.length; second += 1) {
        const a = nodes[first];
        const b = nodes[second];
        if (!a || !b) {
          continue;
        }
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const distance = Math.max(22, Math.sqrt(dx * dx + dy * dy));
        const force = 1800 / (distance * distance);
        const fx = (dx / distance) * force;
        const fy = (dy / distance) * force;
        a.vx -= fx;
        a.vy -= fy;
        b.vx += fx;
        b.vy += fy;
      }
    }

    edges.forEach((edge) => {
      const dx = edge.target.x - edge.source.x;
      const dy = edge.target.y - edge.source.y;
      const distance = Math.max(1, Math.sqrt(dx * dx + dy * dy));
      const force = (distance - 112) * 0.012;
      const fx = (dx / distance) * force;
      const fy = (dy / distance) * force;
      edge.source.vx += fx;
      edge.source.vy += fy;
      edge.target.vx -= fx;
      edge.target.vy -= fy;
    });

    nodes.forEach((node) => {
      if (pointer?.kind === "node" && pointer.node === node) {
        node.vx = 0;
        node.vy = 0;
        return;
      }
      node.vx = Math.max(-7, Math.min(7, node.vx * 0.9));
      node.vy = Math.max(-7, Math.min(7, node.vy * 0.9));
      node.x += node.vx;
      node.y += node.vy;
    });
  };

  const draw = (): void => {
    context.setTransform(dpr, 0, 0, dpr, 0, 0);
    context.clearRect(0, 0, width, height);
    context.save();
    context.translate(width / 2 + view.x, height / 2 + view.y);
    context.scale(view.scale, view.scale);

    const highlighted = hovered ? new Set([hovered, ...(adjacency.get(hovered) ?? [])]) : null;

    edges.forEach((edge) => {
      const isHighlighted = hovered !== null && (edge.source === hovered || edge.target === hovered);
      context.beginPath();
      context.moveTo(edge.source.x, edge.source.y);
      context.lineTo(edge.target.x, edge.target.y);
      context.strokeStyle = isHighlighted ? colors.edgeStrong : colors.edge;
      context.lineWidth = (isHighlighted ? 1.2 : 0.8) / view.scale;
      context.stroke();
    });

    nodes.forEach((node) => {
      const isDimmed = highlighted !== null && !highlighted.has(node);
      context.globalAlpha = isDimmed ? 0.2 : 1;
      context.beginPath();
      context.arc(node.x, node.y, node.radius, 0, Math.PI * 2);
      if (node.type === "post" && !node.offTopic) {
        context.fillStyle = colors.post;
        context.fill();
      } else if (node.type === "post") {
        context.fillStyle = colors.tagFill;
        context.fill();
        context.strokeStyle = colors.post;
        context.lineWidth = 1.4 / view.scale;
        context.setLineDash([3 / view.scale, 2.5 / view.scale]);
        context.stroke();
        context.setLineDash([]);
      } else {
        context.fillStyle = colors.tagFill;
        context.fill();
        context.strokeStyle = colors.stroke;
        context.lineWidth = 1.4 / view.scale;
        context.stroke();
      }
      if (node === hovered) {
        context.beginPath();
        context.arc(node.x, node.y, node.radius + 4, 0, Math.PI * 2);
        context.strokeStyle = colors.halo;
        context.lineWidth = 1 / view.scale;
        context.stroke();
      }
      context.globalAlpha = 1;
    });

    nodes.forEach((node) => {
      const isDimmed = highlighted !== null && !highlighted.has(node);
      context.globalAlpha = isDimmed ? 0.16 : node.type === "tag" ? 0.72 : 0.94;
      context.fillStyle = colors.label;
      context.font = node.type === "post" ? '500 12px "IBM Plex Sans", sans-serif' : '400 11px "IBM Plex Sans", sans-serif';
      context.textAlign = "center";
      context.textBaseline = "top";
      context.fillText(
        node.type === "tag" ? `#${truncate(node.label, 22)}` : truncate(node.label, 34),
        node.x,
        node.y + node.radius + 8,
      );
      context.globalAlpha = 1;
    });

    context.restore();
  };

  const animate = (): void => {
    if (!running) {
      return;
    }
    simulate();
    draw();
    frameId = window.requestAnimationFrame(animate);
  };

  const start = (): void => {
    if (running) {
      return;
    }
    running = true;
    resize();
    if (reduceMotion) {
      for (let index = 0; index < 240; index += 1) {
        simulate();
      }
      draw();
      running = false;
      return;
    }
    frameId = window.requestAnimationFrame(animate);
  };

  const stop = (): void => {
    running = false;
    window.cancelAnimationFrame(frameId);
    tooltip.hidden = true;
  };

  const updateTooltip = (node: GraphNode | null, event: PointerEvent): void => {
    if (!node) {
      tooltip.hidden = true;
      return;
    }
    const rect = frame.getBoundingClientRect();
    tooltip.textContent =
      node.type === "tag" ? `#${node.label}` : node.offTopic ? `Off-Topic · ${node.label}` : node.label;
    tooltip.style.left = `${Math.min(event.clientX - rect.left + 14, rect.width - 24)}px`;
    tooltip.style.top = `${Math.min(event.clientY - rect.top + 14, rect.height - 24)}px`;
    tooltip.hidden = false;
  };

  canvas.addEventListener("pointerdown", (event) => {
    const node = nodeAt(event.clientX, event.clientY);
    moved = false;
    pointer = node
      ? { kind: "node", node, startX: event.clientX, startY: event.clientY }
      : { kind: "pan", startX: event.clientX, startY: event.clientY, panX: view.x, panY: view.y };
    hovered = node;
    if (!node) {
      tooltip.hidden = true;
    }
    canvas.setPointerCapture(event.pointerId);
    canvas.style.cursor = "grabbing";
    if (!running) {
      draw();
    }
  });

  canvas.addEventListener("pointermove", (event) => {
    if (pointer) {
      const dx = event.clientX - pointer.startX;
      const dy = event.clientY - pointer.startY;
      if (Math.abs(dx) > 3 || Math.abs(dy) > 3) {
        moved = true;
      }

      if (pointer.kind === "node") {
        const point = screenToWorld(event.clientX, event.clientY);
        pointer.node.x = point.x;
        pointer.node.y = point.y;
        pointer.node.vx = 0;
        pointer.node.vy = 0;
      } else {
        view.x = pointer.panX + dx;
        view.y = pointer.panY + dy;
      }
      if (!running) {
        draw();
      }
      return;
    }

    hovered = nodeAt(event.clientX, event.clientY);
    canvas.style.cursor = hovered ? "pointer" : "grab";
    updateTooltip(hovered, event);
    if (!running) {
      draw();
    }
  });

  canvas.addEventListener("pointerup", (event) => {
    if (pointer?.kind === "node" && !moved) {
      window.location.href =
        pointer.node.type === "post"
          ? `/post/${encodeURIComponent(pointer.node.slug)}`
          : `/?tag=${encodeURIComponent(pointer.node.slug)}`;
    }
    pointer = null;
    canvas.style.cursor = hovered ? "pointer" : "grab";
    canvas.releasePointerCapture(event.pointerId);
  });

  canvas.addEventListener("pointerleave", () => {
    if (pointer) {
      return;
    }
    hovered = null;
    tooltip.hidden = true;
    canvas.style.cursor = "grab";
    if (!running) {
      draw();
    }
  });

  canvas.addEventListener("pointercancel", () => {
    pointer = null;
    hovered = null;
    tooltip.hidden = true;
    canvas.style.cursor = "grab";
    if (!running) {
      draw();
    }
  });

  canvas.addEventListener(
    "wheel",
    (event) => {
      event.preventDefault();
      const point = screenToWorld(event.clientX, event.clientY);
      const nextScale = Math.max(0.45, Math.min(2.2, view.scale * Math.exp(-event.deltaY * 0.0012)));
      const rect = canvas.getBoundingClientRect();
      view.x = event.clientX - rect.left - width / 2 - point.x * nextScale;
      view.y = event.clientY - rect.top - height / 2 - point.y * nextScale;
      view.scale = nextScale;
      if (!running) {
        draw();
      }
    },
    { passive: false },
  );

  if (typeof ResizeObserver === "function") {
    new ResizeObserver(() => resize()).observe(frame);
  } else {
    window.addEventListener("resize", resize);
  }

  onThemeChange(() => {
    colors = readGraphColors();
    if (!running) {
      draw();
    }
  });

  return { start, stop };
}
