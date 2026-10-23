(function () {
  function create(canvas, posts) {
    const frame = canvas.parentElement;
    const tooltip = document.querySelector("#graph-tooltip");
    const context = canvas.getContext("2d");
    const nodes = [];
    const edges = [];
    const tagNodes = new Map();
    const adjacency = new Map();
    const view = { x: 0, y: 0, scale: 1 };
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let width = 1;
    let height = 1;
    let dpr = 1;
    let running = false;
    let frameId = 0;
    let hovered = null;
    let pointer = null;
    let moved = false;

    posts.forEach((post) => {
      const node = {
        type: "post",
        label: post.title,
        slug: post.slug,
        radius: 7,
        x: 0,
        y: 0,
        vx: 0,
        vy: 0,
      };
      nodes.push(node);
      adjacency.set(node, new Set());

      post.tags.forEach((tag) => {
        const slug = window.Pollo.tagSlug(tag);
        if (!slug) return;
        let tagNode = tagNodes.get(slug);
        if (!tagNode) {
          tagNode = {
            type: "tag",
            label: tag,
            slug,
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
        adjacency.get(node).add(tagNode);
        adjacency.get(tagNode).add(node);
      });
    });

    const tagCounts = new Map();
    edges.forEach((edge) => {
      tagCounts.set(edge.target, (tagCounts.get(edge.target) || 0) + 1);
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

    function resize() {
      const rect = canvas.getBoundingClientRect();
      width = Math.max(1, rect.width);
      height = Math.max(1, rect.height);
      dpr = window.devicePixelRatio || 1;
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      draw();
    }

    function screenToWorld(clientX, clientY) {
      const rect = canvas.getBoundingClientRect();
      return {
        x: (clientX - rect.left - width / 2 - view.x) / view.scale,
        y: (clientY - rect.top - height / 2 - view.y) / view.scale,
      };
    }

    function nodeAt(clientX, clientY) {
      const point = screenToWorld(clientX, clientY);
      return nodes.find((node) => {
        const dx = point.x - node.x;
        const dy = point.y - node.y;
        return Math.sqrt(dx * dx + dy * dy) <= node.radius + 9 / view.scale;
      }) || null;
    }

    function truncate(value, length) {
      const text = String(value || "");
      return text.length > length ? `${text.slice(0, length - 1)}…` : text;
    }

    function simulate() {
      nodes.forEach((node) => {
        if ((pointer && pointer.node === node) || node.fixed) return;
        node.vx -= node.x * 0.0018;
        node.vy -= node.y * 0.0018;
      });

      for (let i = 0; i < nodes.length; i += 1) {
        for (let j = i + 1; j < nodes.length; j += 1) {
          const a = nodes[i];
          const b = nodes[j];
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
        if ((pointer && pointer.node === node) || node.fixed) {
          node.vx = 0;
          node.vy = 0;
          return;
        }
        node.vx = Math.max(-7, Math.min(7, node.vx * 0.9));
        node.vy = Math.max(-7, Math.min(7, node.vy * 0.9));
        node.x += node.vx;
        node.y += node.vy;
      });
    }

    function draw() {
      context.setTransform(dpr, 0, 0, dpr, 0, 0);
      context.clearRect(0, 0, width, height);
      context.save();
      context.translate(width / 2 + view.x, height / 2 + view.y);
      context.scale(view.scale, view.scale);

      const highlighted = hovered ? new Set([hovered, ...adjacency.get(hovered)]) : null;

      edges.forEach((edge) => {
        const isHighlighted = hovered && (edge.source === hovered || edge.target === hovered);
        context.beginPath();
        context.moveTo(edge.source.x, edge.source.y);
        context.lineTo(edge.target.x, edge.target.y);
        context.strokeStyle = isHighlighted ? "rgba(10, 10, 10, 0.48)" : "rgba(10, 10, 10, 0.14)";
        context.lineWidth = (isHighlighted ? 1.2 : 0.8) / view.scale;
        context.stroke();
      });

      nodes.forEach((node) => {
        const isDimmed = highlighted && !highlighted.has(node);
        context.globalAlpha = isDimmed ? 0.2 : 1;
        context.beginPath();
        context.arc(node.x, node.y, node.radius, 0, Math.PI * 2);
        if (node.type === "post") {
          context.fillStyle = "#0a0a0a";
          context.fill();
        } else {
          context.fillStyle = "#ffffff";
          context.fill();
          context.strokeStyle = "#0a0a0a";
          context.lineWidth = 1.4 / view.scale;
          context.stroke();
        }
        if (node === hovered) {
          context.beginPath();
          context.arc(node.x, node.y, node.radius + 4, 0, Math.PI * 2);
          context.strokeStyle = "rgba(10, 10, 10, 0.32)";
          context.lineWidth = 1 / view.scale;
          context.stroke();
        }
        context.globalAlpha = 1;
      });

      nodes.forEach((node) => {
        const isDimmed = highlighted && !highlighted.has(node);
        context.globalAlpha = isDimmed ? 0.16 : node.type === "tag" ? 0.72 : 0.94;
        context.fillStyle = "#0a0a0a";
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
    }

    function animate() {
      if (!running) return;
      simulate();
      draw();
      frameId = window.requestAnimationFrame(animate);
    }

    function start() {
      if (running) return;
      running = true;
      resize();
      if (reduceMotion) {
        for (let index = 0; index < 240; index += 1) simulate();
        draw();
        running = false;
        return;
      }
      frameId = window.requestAnimationFrame(animate);
    }

    function stop() {
      running = false;
      window.cancelAnimationFrame(frameId);
      tooltip.hidden = true;
    }

    function updateTooltip(node, event) {
      if (!node) {
        tooltip.hidden = true;
        return;
      }
      const rect = frame.getBoundingClientRect();
      tooltip.textContent = node.type === "tag" ? `#${node.label}` : node.label;
      tooltip.style.left = `${Math.min(event.clientX - rect.left + 14, rect.width - 24)}px`;
      tooltip.style.top = `${Math.min(event.clientY - rect.top + 14, rect.height - 24)}px`;
      tooltip.hidden = false;
    }

    canvas.addEventListener("pointerdown", (event) => {
      const node = nodeAt(event.clientX, event.clientY);
      moved = false;
      pointer = node
        ? { node, startX: event.clientX, startY: event.clientY, x: node.x, y: node.y }
        : { startX: event.clientX, startY: event.clientY, panX: view.x, panY: view.y };
      if (node) {
        hovered = node;
      } else {
        hovered = null;
        tooltip.hidden = true;
      }
      canvas.setPointerCapture(event.pointerId);
      canvas.style.cursor = "grabbing";
      if (!running) draw();
    });

    canvas.addEventListener("pointermove", (event) => {
      if (pointer) {
        const dx = event.clientX - pointer.startX;
        const dy = event.clientY - pointer.startY;
        if (Math.abs(dx) > 3 || Math.abs(dy) > 3) moved = true;

        if (pointer.node) {
          const point = screenToWorld(event.clientX, event.clientY);
          pointer.node.x = point.x;
          pointer.node.y = point.y;
          pointer.node.vx = 0;
          pointer.node.vy = 0;
        } else {
          view.x = pointer.panX + dx;
          view.y = pointer.panY + dy;
        }
        if (!running) draw();
        return;
      }

      hovered = nodeAt(event.clientX, event.clientY);
      canvas.style.cursor = hovered ? "pointer" : "grab";
      updateTooltip(hovered, event);
      if (!running) draw();
    });

    canvas.addEventListener("pointerup", (event) => {
      if (pointer && pointer.node && !moved) {
        if (pointer.node.type === "post") {
          window.location.href = `post.html?slug=${encodeURIComponent(pointer.node.slug)}`;
        } else {
          window.location.href = `index.html?tag=${encodeURIComponent(pointer.node.slug)}`;
        }
      }
      pointer = null;
      canvas.style.cursor = hovered ? "pointer" : "grab";
      canvas.releasePointerCapture(event.pointerId);
    });

    canvas.addEventListener("pointerleave", () => {
      if (pointer) return;
      hovered = null;
      tooltip.hidden = true;
      canvas.style.cursor = "grab";
      if (!running) draw();
    });

    canvas.addEventListener("pointercancel", () => {
      pointer = null;
      hovered = null;
      tooltip.hidden = true;
      canvas.style.cursor = "grab";
      if (!running) draw();
    });

    canvas.addEventListener("wheel", (event) => {
      event.preventDefault();
      const point = screenToWorld(event.clientX, event.clientY);
      const nextScale = Math.max(0.45, Math.min(2.2, view.scale * Math.exp(-event.deltaY * 0.0012)));
      const rect = canvas.getBoundingClientRect();
      view.x = event.clientX - rect.left - width / 2 - point.x * nextScale;
      view.y = event.clientY - rect.top - height / 2 - point.y * nextScale;
      view.scale = nextScale;
      if (!running) draw();
    }, { passive: false });

    if (typeof ResizeObserver === "function") {
      new ResizeObserver(() => resize()).observe(frame);
    } else {
      window.addEventListener("resize", resize);
    }

    return { start, stop };
  }

  window.PolloGraph = { create };
})();
