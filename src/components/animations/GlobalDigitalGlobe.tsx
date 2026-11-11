import React, { useEffect, useRef, useState } from 'react';
import { Globe, MapPin, Radio } from 'lucide-react';

interface Hub {
  name: string;
  lat: number;
  lng: number;
  isHQ?: boolean;
}

const HUBS: Hub[] = [
  { name: 'Clark Freeport Zone, Pampanga (HQ)', lat: 15.18, lng: 120.53, isHQ: true },
  { name: 'Singapore Tech Hub', lat: 1.35, lng: 103.82 },
  { name: 'Tokyo Digital Media Center', lat: 35.68, lng: 139.77 },
  { name: 'San Francisco Cloud Node', lat: 37.77, lng: -122.42 },
  { name: 'London Broadcast Cluster', lat: 51.51, lng: -0.13 },
  { name: 'Frankfurt Gateway', lat: 50.11, lng: 8.68 },
];

export const GlobalDigitalGlobe: React.FC<{ className?: string }> = ({ className = 'w-full h-80' }) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [activeHub, setActiveHub] = useState<string>('Clark Freeport Zone, Pampanga (HQ)');

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !containerRef.current) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animId: number;
    let rotation = 0;
    let width = 0;
    let height = 0;
    let pulsePhase = 0;

    const resize = () => {
      if (!canvas || !containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      width = rect.width;
      height = rect.height;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = width * dpr;
      canvas.height = height * dpr;
      ctx.scale(dpr, dpr);
    };

    const project = (lat: number, lng: number, rot: number, radius: number, cx: number, cy: number) => {
      const phi = (90 - lat) * (Math.PI / 180);
      const theta = (lng + rot) * (Math.PI / 180);
      const x = radius * Math.sin(phi) * Math.cos(theta);
      const y = -radius * Math.cos(phi);
      const z = radius * Math.sin(phi) * Math.sin(theta);
      return { x: cx + x, y: cy + y, z, visible: z > 0 };
    };

    const render = () => {
      ctx.clearRect(0, 0, width, height);

      const cx = width / 2;
      const cy = height / 2;
      const radius = Math.min(width, height) * 0.38;

      rotation += 0.25;
      pulsePhase += 0.04;

      // Draw outer atmosphere glow
      const grad = ctx.createRadialGradient(cx, cy, radius * 0.7, cx, cy, radius * 1.25);
      grad.addColorStop(0, 'rgba(0, 194, 199, 0.08)');
      grad.addColorStop(0.8, 'rgba(0, 194, 199, 0.02)');
      grad.addColorStop(1, 'transparent');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(cx, cy, radius * 1.25, 0, Math.PI * 2);
      ctx.fill();

      // Outer globe wireframe border
      ctx.beginPath();
      ctx.arc(cx, cy, radius, 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(0, 194, 199, 0.25)';
      ctx.lineWidth = 1.2;
      ctx.stroke();

      // Latitude rings
      for (let lat = -60; lat <= 60; lat += 30) {
        ctx.beginPath();
        let first = true;
        for (let lng = 0; lng <= 360; lng += 10) {
          const p = project(lat, lng, rotation, radius, cx, cy);
          if (p.visible) {
            if (first) {
              ctx.moveTo(p.x, p.y);
              first = false;
            } else {
              ctx.lineTo(p.x, p.y);
            }
          } else {
            first = true;
          }
        }
        ctx.strokeStyle = 'rgba(0, 194, 199, 0.08)';
        ctx.lineWidth = 0.8;
        ctx.stroke();
      }

      // Longitude rings
      for (let lng = 0; lng < 360; lng += 45) {
        ctx.beginPath();
        let first = true;
        for (let lat = -80; lat <= 80; lat += 10) {
          const p = project(lat, lng, rotation, radius, cx, cy);
          if (p.visible) {
            if (first) {
              ctx.moveTo(p.x, p.y);
              first = false;
            } else {
              ctx.lineTo(p.x, p.y);
            }
          } else {
            first = true;
          }
        }
        ctx.strokeStyle = 'rgba(0, 194, 199, 0.08)';
        ctx.lineWidth = 0.8;
        ctx.stroke();
      }

      // Project hubs
      const projectedHubs = HUBS.map(hub => ({
        ...hub,
        proj: project(hub.lat, hub.lng, rotation, radius, cx, cy)
      }));

      const hq = projectedHubs.find(h => h.isHQ);

      // Draw communication arcs from HQ to other hubs
      if (hq && hq.proj.visible) {
        for (const target of projectedHubs) {
          if (target.isHQ || !target.proj.visible) continue;

          // Arc curve
          const midX = (hq.proj.x + target.proj.x) / 2;
          const midY = (hq.proj.y + target.proj.y) / 2 - 25;

          ctx.beginPath();
          ctx.moveTo(hq.proj.x, hq.proj.y);
          ctx.quadraticCurveTo(midX, midY, target.proj.x, target.proj.y);
          ctx.strokeStyle = 'rgba(0, 194, 199, 0.4)';
          ctx.lineWidth = 1;
          ctx.setLineDash([4, 4]);
          ctx.stroke();
          ctx.setLineDash([]);

          // Flowing data packet on arc
          const t = (pulsePhase * 0.4) % 1;
          const px = (1 - t) * (1 - t) * hq.proj.x + 2 * (1 - t) * t * midX + t * t * target.proj.x;
          const py = (1 - t) * (1 - t) * hq.proj.y + 2 * (1 - t) * t * midY + t * t * target.proj.y;
          ctx.beginPath();
          ctx.arc(px, py, 2.5, 0, Math.PI * 2);
          ctx.fillStyle = '#D4AF37';
          ctx.shadowColor = '#D4AF37';
          ctx.shadowBlur = 6;
          ctx.fill();
          ctx.shadowBlur = 0;
        }
      }

      // Draw hubs
      for (const hub of projectedHubs) {
        if (!hub.proj.visible) continue;

        if (hub.isHQ) {
          // HQ pulsating marker
          const pulse = Math.sin(pulsePhase * 2) * 2;
          ctx.beginPath();
          ctx.arc(hub.proj.x, hub.proj.y, 4 + pulse, 0, Math.PI * 2);
          ctx.fillStyle = '#00C2C7';
          ctx.shadowColor = '#00C2C7';
          ctx.shadowBlur = 10;
          ctx.fill();
          ctx.shadowBlur = 0;

          // Outer gold ring
          ctx.beginPath();
          ctx.arc(hub.proj.x, hub.proj.y, 9 + pulse, 0, Math.PI * 2);
          ctx.strokeStyle = '#D4AF37';
          ctx.lineWidth = 1.5;
          ctx.stroke();
        } else {
          ctx.beginPath();
          ctx.arc(hub.proj.x, hub.proj.y, 2.5, 0, Math.PI * 2);
          ctx.fillStyle = '#C0C7D1';
          ctx.fill();
        }
      }

      animId = requestAnimationFrame(render);
    };

    window.addEventListener('resize', resize);
    resize();
    render();

    return () => {
      window.removeEventListener('resize', resize);
      cancelAnimationFrame(animId);
    };
  }, []);

  return (
    <div ref={containerRef} className={`relative flex flex-col items-center justify-center ${className}`}>
      <canvas ref={canvasRef} className="block w-full h-full" />
      
      {/* Overlay Hub Indicator */}
      <div className="absolute bottom-2 left-4 right-4 flex items-center justify-between text-[11px] font-mono text-slate-400 bg-slate-900/80 backdrop-blur-md px-3 py-1.5 rounded-lg border border-slate-800 pointer-events-none">
        <span className="flex items-center gap-1.5 text-[#00C2C7]">
          <Radio className="w-3.5 h-3.5 animate-pulse" />
          <span>Central Hub: Clark Freeport Zone, Pampanga</span>
        </span>
        <span className="hidden sm:inline text-slate-500">Global Synchronized Network</span>
      </div>
    </div>
  );
};
