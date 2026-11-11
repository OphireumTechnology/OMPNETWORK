import React, { useEffect, useRef } from 'react';
import { Cpu, Sparkles, Activity } from 'lucide-react';

export const AIProcessingVisualizer: React.FC<{ className?: string }> = ({ className = 'w-full h-64' }) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !containerRef.current) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animId: number;
    let width = 0;
    let height = 0;
    let time = 0;

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

    // Synapse layers: Input (3), Hidden 1 (5), Hidden 2 (5), Output (3)
    const layers = [3, 5, 5, 3];
    const nodeCoords: { x: number; y: number; layer: number; index: number }[] = [];

    const setupLayers = () => {
      nodeCoords.length = 0;
      const layerSpacing = width / (layers.length + 1);

      layers.forEach((count, lIdx) => {
        const x = layerSpacing * (lIdx + 1);
        const nodeSpacing = height / (count + 1);
        for (let nIdx = 0; nIdx < count; nIdx++) {
          const y = nodeSpacing * (nIdx + 1);
          nodeCoords.push({ x, y, layer: lIdx, index: nIdx });
        }
      });
    };

    const render = () => {
      ctx.clearRect(0, 0, width, height);
      time += 0.03;

      const cx = width / 2;
      const cy = height / 2;

      // Draw central intelligence halo
      const corePulse = Math.sin(time * 2) * 5;
      const coreGrad = ctx.createRadialGradient(cx, cy, 10, cx, cy, 75 + corePulse);
      coreGrad.addColorStop(0, 'rgba(0, 194, 199, 0.25)');
      coreGrad.addColorStop(0.5, 'rgba(0, 194, 199, 0.06)');
      coreGrad.addColorStop(1, 'transparent');
      ctx.fillStyle = coreGrad;
      ctx.beginPath();
      ctx.arc(cx, cy, 80 + corePulse, 0, Math.PI * 2);
      ctx.fill();

      // Draw synaptic connections between adjacent layers
      for (let i = 0; i < nodeCoords.length; i++) {
        const n1 = nodeCoords[i];
        for (let j = 0; j < nodeCoords.length; j++) {
          const n2 = nodeCoords[j];
          if (n2.layer === n1.layer + 1) {
            // Synapse line
            const wave = Math.sin(time * 3 + n1.index * 0.8 + n2.index * 0.5);
            const alpha = 0.08 + Math.max(0, wave * 0.2);

            ctx.beginPath();
            ctx.moveTo(n1.x, n1.y);
            ctx.lineTo(n2.x, n2.y);
            ctx.strokeStyle = `rgba(0, 194, 199, ${alpha})`;
            ctx.lineWidth = 1;
            ctx.stroke();

            // Moving energy pulse packet
            const progress = (time * 0.6 + (n1.index + n2.index) * 0.2) % 1;
            const px = n1.x + (n2.x - n1.x) * progress;
            const py = n1.y + (n2.y - n1.y) * progress;

            ctx.beginPath();
            ctx.arc(px, py, 1.8, 0, Math.PI * 2);
            ctx.fillStyle = progress > 0.5 ? '#00C2C7' : '#D4AF37';
            ctx.fill();
          }
        }
      }

      // Draw nodes
      for (const node of nodeCoords) {
        const pulse = Math.sin(time * 2 + node.index) * 1.2;
        ctx.beginPath();
        ctx.arc(node.x, node.y, 3.5 + pulse, 0, Math.PI * 2);
        ctx.fillStyle = node.layer === 0 ? '#C0C7D1' : node.layer === 3 ? '#D4AF37' : '#00C2C7';
        ctx.shadowColor = '#00C2C7';
        ctx.shadowBlur = 8;
        ctx.fill();
        ctx.shadowBlur = 0;

        // Outer ring
        ctx.beginPath();
        ctx.arc(node.x, node.y, 6 + pulse, 0, Math.PI * 2);
        ctx.strokeStyle = 'rgba(0, 194, 199, 0.3)';
        ctx.lineWidth = 0.8;
        ctx.stroke();
      }

      animId = requestAnimationFrame(render);
    };

    window.addEventListener('resize', resize);
    resize();
    setupLayers();
    render();

    return () => {
      window.removeEventListener('resize', resize);
      cancelAnimationFrame(animId);
    };
  }, []);

  return (
    <div ref={containerRef} className={`relative flex flex-col items-center justify-center ${className}`}>
      <canvas ref={canvasRef} className="block w-full h-full" />
      <div className="absolute top-3 left-4 flex items-center gap-2 text-[10px] font-mono text-[#00C2C7] bg-slate-900/80 px-2.5 py-1 rounded border border-slate-800">
        <Activity className="w-3 h-3 text-[#00C2C7] animate-pulse" />
        <span>NEURAL ENGINE · ACTIVE SYNAPSE MATRIX</span>
      </div>
    </div>
  );
};
