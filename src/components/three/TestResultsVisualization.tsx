'use client';

import { useEffect, useRef } from 'react';
import { useTheme } from 'next-themes';

interface Props {
  passed: number;
  failed: number;
}

export const TestResultsVisualization = ({ passed, failed }: Props) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const { theme } = useTheme();

  useEffect(() => {
    if (!containerRef.current || typeof window === 'undefined') return;

    let animationFrameId: number;
    const container = containerRef.current;
    const canvas = document.createElement('canvas');
    canvas.width = container.clientWidth;
    canvas.height = container.clientHeight;
    container.appendChild(canvas);

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const centerX = canvas.width / 2;
    const centerY = canvas.height / 2 - 20;
    const radius = Math.min(canvas.width, canvas.height) / 3;
    
    let rotation = 0;
    let animationProgress = 0;

    const total = passed + failed;
    const passedAngle = (passed / total) * Math.PI * 2;
    const failedAngle = (failed / total) * Math.PI * 2;

    const draw3DDonut = (
      startAngle: number,
      endAngle: number,
      color: string,
      depth: number = 30
    ) => {
      const innerRadius = radius * 0.6;
      
      // Draw multiple layers for 3D effect
      for (let i = 0; i < depth; i++) {
        const layerY = centerY + i;
        const opacity = 1 - (i / depth) * 0.5;
        
        ctx.globalAlpha = opacity;
        ctx.fillStyle = adjustBrightness(color, -i * 2);
        ctx.beginPath();
        ctx.arc(centerX, layerY, radius, startAngle, endAngle);
        ctx.arc(centerX, layerY, innerRadius, endAngle, startAngle, true);
        ctx.closePath();
        ctx.fill();
      }
      
      ctx.globalAlpha = 1;
      
      // Top surface
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(centerX, centerY, radius, startAngle, endAngle);
      ctx.arc(centerX, centerY, innerRadius, endAngle, startAngle, true);
      ctx.closePath();
      ctx.fill();
      
      // Highlight
      const gradient = ctx.createRadialGradient(
        centerX, centerY - radius / 3, 0,
        centerX, centerY, radius
      );
      gradient.addColorStop(0, 'rgba(255,255,255,0.3)');
      gradient.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = gradient;
      ctx.fill();
    };

    const adjustBrightness = (color: string, percent: number) => {
      const num = parseInt(color.replace('#', ''), 16);
      const amt = Math.round(2.55 * percent);
      const R = (num >> 16) + amt;
      const G = (num >> 8 & 0x00FF) + amt;
      const B = (num & 0x0000FF) + amt;
      return '#' + (0x1000000 + (R < 255 ? R < 1 ? 0 : R : 255) * 0x10000 +
        (G < 255 ? G < 1 ? 0 : G : 255) * 0x100 +
        (B < 255 ? B < 1 ? 0 : B : 255))
        .toString(16).slice(1);
    };

    const drawParticles = () => {
      const particles = 50;
      for (let i = 0; i < particles; i++) {
        const angle = (i / particles) * Math.PI * 2 + rotation;
        const distance = radius + 20 + Math.sin(rotation * 2 + i) * 10;
        const x = centerX + Math.cos(angle) * distance;
        const y = centerY + Math.sin(angle) * distance;
        
        ctx.fillStyle = theme === 'dark' 
          ? `rgba(139, 92, 246, ${0.3 + Math.sin(rotation + i) * 0.2})`
          : `rgba(99, 102, 241, ${0.3 + Math.sin(rotation + i) * 0.2})`;
        ctx.beginPath();
        ctx.arc(x, y, 2, 0, Math.PI * 2);
        ctx.fill();
      }
    };

    const animate = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      
      animationProgress = Math.min(animationProgress + 0.02, 1);
      const easeProgress = 1 - Math.pow(1 - animationProgress, 3);
      
      rotation += 0.005;
      
      drawParticles();
      
      const currentPassedAngle = passedAngle * easeProgress;
      const currentFailedAngle = failedAngle * easeProgress;
      
      draw3DDonut(-Math.PI / 2, -Math.PI / 2 + currentPassedAngle, '#10b981', 25);
      draw3DDonut(
        -Math.PI / 2 + currentPassedAngle,
        -Math.PI / 2 + currentPassedAngle + currentFailedAngle,
        '#ef4444',
        25
      );
      
      // Center text
      ctx.fillStyle = theme === 'dark' ? '#fff' : '#000';
      ctx.font = 'bold 32px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(total.toString(), centerX, centerY);
      
      ctx.font = '14px sans-serif';
      ctx.fillStyle = theme === 'dark' ? 'rgba(255,255,255,0.6)' : 'rgba(0,0,0,0.6)';
      ctx.fillText('Total Tests', centerX, centerY + 25);
      
      animationFrameId = requestAnimationFrame(animate);
    };

    animate();

    const handleResize = () => {
      canvas.width = container.clientWidth;
      canvas.height = container.clientHeight;
    };

    window.addEventListener('resize', handleResize);

    return () => {
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener('resize', handleResize);
      if (canvas.parentNode) {
        canvas.parentNode.removeChild(canvas);
      }
    };
  }, [passed, failed, theme]);

  return <div ref={containerRef} className="w-full h-full" />;
};
