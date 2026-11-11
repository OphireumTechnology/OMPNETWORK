import React, { useEffect, useRef } from 'react';

interface BlockchainNetworkCanvasProps {
  className?: string;
  nodeCount?: number;
  interactive?: boolean;
}

interface Node {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  baseRadius: number;
  pulsePhase: number;
  isHex: boolean;
  connections: number[];
}

interface Packet {
  fromNode: number;
  toNode: number;
  progress: number;
  speed: number;
  color: string;
}

export const BlockchainNetworkCanvas: React.FC<BlockchainNetworkCanvasProps> = ({
  className = 'w-full h-full',
  nodeCount = 45,
  interactive = true,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const animationFrameId = useRef<number | null>(null);
  const isVisible = useRef<boolean>(true);
  const mousePos = useRef<{ x: number; y: number; active: boolean }>({ x: -1000, y: -1000, active: false });

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Check prefers-reduced-motion
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    // Setup intersection observer to pause when off-screen
    const observer = new IntersectionObserver(([entry]) => {
      isVisible.current = entry.isIntersecting;
    }, { threshold: 0.05 });

    if (containerRef.current) {
      observer.observe(containerRef.current);
    }

    let width = 0;
    let height = 0;
    let nodes: Node[] = [];
    let packets: Packet[] = [];

    const resize = () => {
      if (!canvas || !containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      width = rect.width;
      height = rect.height;

      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = width * dpr;
      canvas.height = height * dpr;
      ctx.scale(dpr, dpr);

      // Adjust node count on smaller screens
      const actualNodeCount = width < 768 ? Math.floor(nodeCount * 0.5) : nodeCount;
      initNodes(actualNodeCount);
    };

    const initNodes = (count: number) => {
      nodes = [];
      packets = [];
      for (let i = 0; i < count; i++) {
        const radius = Math.random() * 2.5 + 2;
        nodes.push({
          x: Math.random() * width,
          y: Math.random() * height,
          vx: (Math.random() - 0.5) * (prefersReducedMotion ? 0.05 : 0.4),
          vy: (Math.random() - 0.5) * (prefersReducedMotion ? 0.05 : 0.4),
          radius,
          baseRadius: radius,
          pulsePhase: Math.random() * Math.PI * 2,
          isHex: i % 4 === 0,
          connections: [],
        });
      }
    };

    const drawHexagon = (x: number, y: number, r: number, strokeColor: string) => {
      ctx.beginPath();
      for (let i = 0; i < 6; i++) {
        const angle = (i * Math.PI) / 3;
        const hx = x + r * Math.cos(angle);
        const hy = y + r * Math.sin(angle);
        if (i === 0) ctx.moveTo(hx, hy);
        else ctx.lineTo(hx, hy);
      }
      ctx.closePath();
      ctx.strokeStyle = strokeColor;
      ctx.lineWidth = 1;
      ctx.stroke();
    };

    const maxDistance = 140;

    const render = () => {
      if (!isVisible.current) {
        animationFrameId.current = requestAnimationFrame(render);
        return;
      }

      ctx.clearRect(0, 0, width, height);

      // Update positions
      for (let i = 0; i < nodes.length; i++) {
        const node = nodes[i];
        node.x += node.vx;
        node.y += node.vy;

        // Bounce from walls
        if (node.x < 10) { node.x = 10; node.vx *= -1; }
        if (node.x > width - 10) { node.x = width - 10; node.vx *= -1; }
        if (node.y < 10) { node.y = 10; node.vy *= -1; }
        if (node.y > height - 10) { node.y = height - 10; node.vy *= -1; }

        // Mouse interaction
        if (interactive && mousePos.current.active) {
          const dx = mousePos.current.x - node.x;
          const dy = mousePos.current.y - node.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < 160 && dist > 0) {
            const force = (160 - dist) / 160;
            node.x -= (dx / dist) * force * 1.5;
            node.y -= (dy / dist) * force * 1.5;
          }
        }

        // Pulse phase
        node.pulsePhase += 0.03;
      }

      // Draw connection lines
      for (let i = 0; i < nodes.length; i++) {
        nodes[i].connections = [];
        for (let j = i + 1; j < nodes.length; j++) {
          const dx = nodes[j].x - nodes[i].x;
          const dy = nodes[j].y - nodes[i].y;
          const dist = Math.sqrt(dx * dx + dy * dy);

          if (dist < maxDistance) {
            nodes[i].connections.push(j);
            const opacity = 1 - dist / maxDistance;
            ctx.beginPath();
            ctx.moveTo(nodes[i].x, nodes[i].y);
            ctx.lineTo(nodes[j].x, nodes[j].y);
            ctx.strokeStyle = `rgba(0, 194, 199, ${opacity * 0.22})`;
            ctx.lineWidth = opacity * 1.2;
            ctx.stroke();

            // Chance to create data packet
            if (packets.length < 18 && Math.random() < 0.003) {
              packets.push({
                fromNode: i,
                toNode: j,
                progress: 0,
                speed: 0.008 + Math.random() * 0.015,
                color: Math.random() > 0.3 ? '#00C2C7' : '#D4AF37',
              });
            }
          }
        }
      }

      // Draw moving data packets
      for (let p = packets.length - 1; p >= 0; p--) {
        const pkt = packets[p];
        pkt.progress += pkt.speed;

        if (pkt.progress >= 1) {
          packets.splice(p, 1);
          continue;
        }

        const from = nodes[pkt.fromNode];
        const to = nodes[pkt.toNode];
        if (!from || !to) {
          packets.splice(p, 1);
          continue;
        }

        const px = from.x + (to.x - from.x) * pkt.progress;
        const py = from.y + (to.y - from.y) * pkt.progress;

        ctx.beginPath();
        ctx.arc(px, py, 1.8, 0, Math.PI * 2);
        ctx.fillStyle = pkt.color;
        ctx.shadowColor = pkt.color;
        ctx.shadowBlur = 6;
        ctx.fill();
        ctx.shadowBlur = 0;
      }

      // Draw nodes
      for (let i = 0; i < nodes.length; i++) {
        const node = nodes[i];
        const pulse = Math.sin(node.pulsePhase) * 0.8;
        const currentRadius = Math.max(1.5, node.baseRadius + pulse);

        if (node.isHex) {
          drawHexagon(node.x, node.y, currentRadius + 5, 'rgba(0, 194, 199, 0.4)');
          ctx.beginPath();
          ctx.arc(node.x, node.y, currentRadius, 0, Math.PI * 2);
          ctx.fillStyle = '#00C2C7';
          ctx.fill();
        } else {
          ctx.beginPath();
          ctx.arc(node.x, node.y, currentRadius, 0, Math.PI * 2);
          ctx.fillStyle = i % 5 === 0 ? '#D4AF37' : '#00C2C7';
          ctx.shadowColor = '#00C2C7';
          ctx.shadowBlur = 8;
          ctx.fill();
          ctx.shadowBlur = 0;

          // Outer ring
          ctx.beginPath();
          ctx.arc(node.x, node.y, currentRadius + 3, 0, Math.PI * 2);
          ctx.strokeStyle = 'rgba(0, 194, 199, 0.2)';
          ctx.lineWidth = 1;
          ctx.stroke();
        }
      }

      animationFrameId.current = requestAnimationFrame(render);
    };

    window.addEventListener('resize', resize);
    resize();
    render();

    const handleMouseMove = (e: MouseEvent) => {
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      mousePos.current = {
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
        active: true,
      };
    };

    const handleMouseLeave = () => {
      mousePos.current.active = false;
    };

    if (interactive && containerRef.current) {
      containerRef.current.addEventListener('mousemove', handleMouseMove);
      containerRef.current.addEventListener('mouseleave', handleMouseLeave);
    }

    return () => {
      window.removeEventListener('resize', resize);
      if (animationFrameId.current) cancelAnimationFrame(animationFrameId.current);
      observer.disconnect();
      if (containerRef.current) {
        containerRef.current.removeEventListener('mousemove', handleMouseMove);
        containerRef.current.removeEventListener('mouseleave', handleMouseLeave);
      }
    };
  }, [nodeCount, interactive]);

  return (
    <div ref={containerRef} className={`relative overflow-hidden pointer-events-auto ${className}`}>
      <canvas ref={canvasRef} className="block w-full h-full" />
    </div>
  );
};
