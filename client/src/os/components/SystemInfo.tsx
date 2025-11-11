import { useState, useEffect, useRef } from 'react';

import { getCachedDesktop, saveDesktopState } from '../../services/saveService';
import './SystemInfo.css';

export default function SystemInfo() {
  const [_time, setTime] = useState(new Date());
  const [cpuUsage, setCpuUsage] = useState(45);
  const [memUsage, setMemUsage] = useState(62);
  const [netUsage, setNetUsage] = useState(15);
  const [temperature, setTemperature] = useState(52);
  const [cpuHistory, setCpuHistory] = useState<number[]>(Array(20).fill(30));
  const [netHistory, setNetHistory] = useState<number[]>(Array(20).fill(10));
  const cached = getCachedDesktop();
  const [isHorizontal, setIsHorizontal] = useState<boolean>(() => cached?.systemInfoLayout ?? false);
  const [isDragging, setIsDragging] = useState(false);
  const [position, setPosition] = useState<{ x: number; y: number }>(() => cached?.systemInfoPosition ?? { x: 20, y: 60 });
  const [snappedEdge, setSnappedEdge] = useState<'left' | 'right' | 'top' | 'bottom' | null>(() => cached?.systemInfoSnappedEdge ?? null);
  const [isCollapsed, setIsCollapsed] = useState<boolean>(() => cached?.systemInfoCollapsed ?? false);
  const dragRef = useRef({ startX: 0, startY: 0, offsetX: 0, offsetY: 0 });
  const monitorRef = useRef<HTMLDivElement>(null);

  // External IP address (simulated)
  const ipAddress = '203.0.113.45';
  const gateway = '203.0.113.1';
  const dns = '8.8.8.8';

  useEffect(() => {
    // On first launch (no saved position/edge), snap the monitor to the right by default.
    const hasSavedPos = !!cached?.systemInfoPosition;
    const hasSavedEdge = !!cached?.systemInfoSnappedEdge;
    if (!hasSavedPos && !hasSavedEdge) {
      requestAnimationFrame(() => {
        const el = monitorRef.current;
        if (!el) return;
        const rect = el.getBoundingClientRect();
        const x = Math.max(0, window.innerWidth - rect.width);
        const y = position.y; // keep default top offset
        const next = { x, y };
        setPosition(next);
        setSnappedEdge('right');
        saveDesktopState({ systemInfoPosition: next, systemInfoSnappedEdge: 'right' }).catch(() => {});
      });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const timer = setInterval(() => {
      setTime(new Date());
      
      // Simulate system metrics with realistic variations
      setCpuUsage(prev => Math.max(20, Math.min(90, prev + (Math.random() - 0.5) * 10)));
      setMemUsage(prev => Math.max(40, Math.min(85, prev + (Math.random() - 0.5) * 3)));
      setNetUsage(prev => Math.max(5, Math.min(100, prev + (Math.random() - 0.5) * 15)));
      setTemperature(prev => Math.max(45, Math.min(75, prev + (Math.random() - 0.5) * 2)));
      
      setCpuHistory(prev => [...prev.slice(1), cpuUsage]);
      setNetHistory(prev => [...prev.slice(1), netUsage]);
    }, 2000);

    return () => clearInterval(timer);
  }, [cpuUsage, netUsage]);

  const handleMouseDown = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest('.toggle-layout-btn')) return;
    setIsDragging(true);
    dragRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      offsetX: position.x,
      offsetY: position.y
    };
  };

  useEffect(() => {
    if (!isDragging) return;

    const handleMouseMove = (e: MouseEvent) => {
      const dx = e.clientX - dragRef.current.startX;
      const dy = e.clientY - dragRef.current.startY;
      const newPosition = {
        x: dragRef.current.offsetX + dx,
        y: dragRef.current.offsetY + dy
      };
      setPosition(newPosition);
      setSnappedEdge(null); // Unsnap while dragging
    };

    const handleMouseUp = () => {
      setIsDragging(false);
      
      // Snap to edge logic
      const monitor = monitorRef.current;
      if (!monitor) return;
      
      const rect = monitor.getBoundingClientRect();
      const snapThreshold = 50;
      const windowWidth = window.innerWidth;
      const windowHeight = window.innerHeight;
      
      let snapped: 'left' | 'right' | 'top' | 'bottom' | null = null;
      const finalPosition = { ...position };
      
      // Check proximity to edges
      if (rect.left < snapThreshold) {
        finalPosition.x = 0;
        snapped = 'left';
      } else if (windowWidth - rect.right < snapThreshold) {
        finalPosition.x = windowWidth - rect.width;
        snapped = 'right';
      } else if (rect.top < snapThreshold + 40) { // Account for taskbar
        finalPosition.y = 40;
        snapped = 'top';
      } else if (windowHeight - rect.bottom < snapThreshold + 40) {
        finalPosition.y = windowHeight - rect.height - 40;
        snapped = 'bottom';
      }
      
      setPosition(finalPosition);
      setSnappedEdge(snapped);
      saveDesktopState({ systemInfoPosition: finalPosition, systemInfoSnappedEdge: snapped }).catch(() => {});
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, position]);

  useEffect(() => {
    saveDesktopState({ systemInfoLayout: isHorizontal }).catch(() => {});
  }, [isHorizontal]);

  useEffect(() => {
    saveDesktopState({ systemInfoCollapsed: isCollapsed }).catch(() => {});
  }, [isCollapsed]);

  // Handle window resize to adjust snapped position
  useEffect(() => {
    const handleResize = () => {
      if (!snappedEdge || !monitorRef.current) return;
      
      const rect = monitorRef.current.getBoundingClientRect();
      const windowWidth = window.innerWidth;
      const windowHeight = window.innerHeight;
      const newPosition = { ...position };
      
      switch (snappedEdge) {
        case 'right':
          newPosition.x = windowWidth - rect.width;
          break;
        case 'bottom':
          newPosition.y = windowHeight - rect.height - 40;
          break;
        case 'top':
          newPosition.y = 40;
          break;
        case 'left':
          newPosition.x = 0;
          break;
      }
      
      setPosition(newPosition);
      saveDesktopState({ systemInfoPosition: newPosition }).catch(() => {});
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [snappedEdge, position]);

  const renderMiniChart = (data: number[], color: string) => {
    const max = Math.max(...data, 100);
    const points = data.map((val, i) => {
      const x = (i / (data.length - 1)) * 100;
      const y = 100 - (val / max) * 100;
      return `${x},${y}`;
    }).join(' ');

    return (
      <svg className="mini-chart" viewBox="0 0 100 100" preserveAspectRatio="none">
        <polyline
          points={points}
          fill="none"
          stroke={color}
          strokeWidth="2"
          vectorEffect="non-scaling-stroke"
        />
      </svg>
    );
  };

  const renderBar = (value: number, color: string) => (
    <div className="metric-bar">
      <div 
        className="metric-bar-fill" 
        style={{ 
          width: `${value}%`,
          background: `linear-gradient(90deg, ${color}00, ${color})`
        }}
      />
    </div>
  );

  return (
    <div 
      ref={monitorRef}
      className={`system-info ${isHorizontal ? 'horizontal' : 'vertical'} ${isDragging ? 'dragging' : ''} ${snappedEdge ? `snapped-${snappedEdge}` : ''}`}
      style={{ left: `${position.x}px`, top: `${position.y}px` }}
      onMouseDown={handleMouseDown}
    >
      <div className="system-info-header">
        <span className="system-info-title">[ SYSTEM MONITOR ]</span>
        <div className="header-buttons">
          <button 
            className="toggle-layout-btn" 
            onClick={() => setIsHorizontal(!isHorizontal)}
            title={isHorizontal ? 'Switch to Vertical' : 'Switch to Horizontal'}
          >
            {isHorizontal ? '[↕]' : '[↔]'}
          </button>
          <button 
            className="toggle-layout-btn collapse-btn"
            onClick={() => setIsCollapsed(!isCollapsed)}
            title={isCollapsed ? 'Expand' : 'Collapse'}
          >
            {isCollapsed ? '[+]' : '[−]'}
          </button>
        </div>
      </div>

      {!isCollapsed && (
        <>
          <div className="system-info-section">
            <div className="metric-label">NETWORK</div>
            <div className="metric-value">{ipAddress}</div>
            <div className="metric-secondary">GW: {gateway}</div>
            <div className="metric-secondary">DNS: {dns}</div>
          </div>

          <div className="system-info-section">
            <div className="metric-label">CPU USAGE</div>
            <div className="metric-value">{cpuUsage.toFixed(1)}%</div>
            {renderBar(cpuUsage, 'var(--color-primary)')}
            {renderMiniChart(cpuHistory, 'var(--color-primary)')}
          </div>

          <div className="system-info-section">
            <div className="metric-label">MEMORY</div>
            <div className="metric-value">{memUsage.toFixed(1)}%</div>
            {renderBar(memUsage, 'var(--color-primary)')}
            <div className="metric-secondary">6.2 GB / 10.0 GB</div>
          </div>

          <div className="system-info-section">
            <div className="metric-label">NETWORK I/O</div>
            <div className="metric-value">{netUsage.toFixed(1)} MB/s</div>
            {renderBar(netUsage, 'var(--color-primary)')}
            {renderMiniChart(netHistory, 'var(--color-primary)')}
          </div>

          <div className="system-info-section">
            <div className="metric-label">TEMPERATURE</div>
            <div className="metric-value">{temperature.toFixed(1)}°C</div>
            {renderBar((temperature - 30) / 0.6, temperature > 65 ? '#ff4444' : 'var(--color-primary)')}
          </div>
        </>
      )}
    </div>
  );
}
