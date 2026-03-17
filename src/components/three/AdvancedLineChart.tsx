'use client';

import { useEffect, useRef } from 'react';
import { useTheme } from 'next-themes';

interface DataPoint {
  month: string;
  bugs: number;
  critical: number;
}

interface Props {
  data: DataPoint[];
}

export const AdvancedLineChart = ({ data }: Props) => {
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

    const padding = { top: 40, right: 40, bottom: 60, left: 60 };
    const chartWidth = canvas.width - padding.left - padding.right;
    const chartHeight = canvas.height - padding.top - padding.bottom;

    const maxValue = Math.max(...data.map(d => Math.max(d.bugs, d.critical)));
    let animationProgress = 0;

    const drawGrid = () => {
      ctx.strokeStyle = theme === 'dark' ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)';
      ctx.lineWidth = 1;

      // Horizontal grid lines
      for (let i = 0; i <= 5; i++) {
        const y = padding.top + (chartHeight * i) / 5;
        ctx.beginPath();
        ctx.moveTo(padding.left, y);
        ctx.lineTo(padding.left + chartWidth, y);
        ctx.stroke();

        // Y-axis labels
        const value = Math.round(maxValue * (1 - i / 5));
        ctx.fillStyle = theme === 'dark' ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.5)';
        ctx.font = '12px sans-serif';
        ctx.textAlign = 'right';
        ctx.fillText(value.toString(), padding.left - 10, y + 4);
      }

      // X-axis labels
      data.forEach((point, i) => {
        const x = padding.left + (chartWidth * i) / (data.length - 1);
        ctx.fillStyle = theme === 'dark' ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.5)';
        ctx.font = '12px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(point.month, x, canvas.height - padding.bottom + 25);
      });
    };

    const drawLine = (
      dataKey: 'bugs' | 'critical',
      color: string,
      shadowColor: string
    ) => {
      const points = data.map((point, i) => ({
        x: padding.left + (chartWidth * i) / (data.length - 1),
        y: padding.top + chartHeight - (chartHeight * point[dataKey]) / maxValue * animationProgress,
      }));

      // Draw shadow/glow
      ctx.shadowBlur = 20;
      ctx.shadowColor = shadowColor;
      ctx.strokeStyle = color;
      ctx.lineWidth = 3;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';

      // Draw line
      ctx.beginPath();
      points.forEach((point, i) => {
        if (i === 0) {
          ctx.moveTo(point.x, point.y);
        } else {
          const prevPoint = points[i - 1];
          const cpX = (prevPoint.x + point.x) / 2;
          ctx.quadraticCurveTo(prevPoint.x, prevPoint.y, cpX, (prevPoint.y + point.y) / 2);
          ctx.quadraticCurveTo(cpX, (prevPoint.y + point.y) / 2, point.x, point.y);
        }
      });
      ctx.stroke();

      ctx.shadowBlur = 0;

      // Draw gradient fill
      const gradient = ctx.createLinearGradient(0, padding.top, 0, padding.top + chartHeight);
      gradient.addColorStop(0, color.replace(')', ', 0.3)').replace('rgb', 'rgba'));
      gradient.addColorStop(1, color.replace(')', ', 0)').replace('rgb', 'rgba'));

      ctx.fillStyle = gradient;
      ctx.beginPath();
      points.forEach((point, i) => {
        if (i === 0) {
          ctx.moveTo(point.x, point.y);
        } else {
          const prevPoint = points[i - 1];
          const cpX = (prevPoint.x + point.x) / 2;
          ctx.quadraticCurveTo(prevPoint.x, prevPoint.y, cpX, (prevPoint.y + point.y) / 2);
          ctx.quadraticCurveTo(cpX, (prevPoint.y + point.y) / 2, point.x, point.y);
        }
      });
      ctx.lineTo(points[points.length - 1].x, padding.top + chartHeight);
      ctx.lineTo(points[0].x, padding.top + chartHeight);
      ctx.closePath();
      ctx.fill();

      // Draw points
      points.forEach((point) => {
        // Outer glow
        ctx.fillStyle = shadowColor;
        ctx.beginPath();
        ctx.arc(point.x, point.y, 8, 0, Math.PI * 2);
        ctx.fill();

        // Inner circle
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.arc(point.x, point.y, 5, 0, Math.PI * 2);
        ctx.fill();

        // Center dot
        ctx.fillStyle = theme === 'dark' ? '#fff' : '#000';
        ctx.beginPath();
        ctx.arc(point.x, point.y, 2, 0, Math.PI * 2);
        ctx.fill();
      });
    };

    const animate = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      drawGrid();

      animationProgress = Math.min(animationProgress + 0.02, 1);
      const easeProgress = 1 - Math.pow(1 - animationProgress, 3);
      animationProgress = easeProgress;

      drawLine('bugs', 'rgb(59, 130, 246)', 'rgba(59, 130, 246, 0.5)');
      drawLine('critical', 'rgb(239, 68, 68)', 'rgba(239, 68, 68, 0.5)');

      if (animationProgress < 1) {
        animationFrameId = requestAnimationFrame(animate);
      }
    };

    animate();

    const handleResize = () => {
      canvas.width = container.clientWidth;
      canvas.height = container.clientHeight;
      animationProgress = 0;
      animate();
    };

    window.addEventListener('resize', handleResize);

    return () => {
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener('resize', handleResize);
      if (canvas.parentNode) {
        canvas.parentNode.removeChild(canvas);
      }
    };
  }, [data, theme]);

  return <div ref={containerRef} className="w-full h-full" />;
};
