/* Shared primitives for Time Keeper TODAY screen variations */

const { useState, useEffect, useRef } = React;

// ---------- ICONS (line, 1.5 stroke, currentColor) ----------
const Icon = {
  Bell: (p) => (
    <svg width={p.size||18} height={p.size||18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M6 8a6 6 0 0 1 12 0c0 4.5 1.5 6 2 7H4c.5-1 2-2.5 2-7z"/>
      <path d="M10 19a2 2 0 0 0 4 0"/>
    </svg>
  ),
  Gear: (p) => (
    <svg width={p.size||18} height={p.size||18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="3"/>
      <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1A1.7 1.7 0 0 0 9 19.4a1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1A1.7 1.7 0 0 0 4.6 9a1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>
    </svg>
  ),
  Play: (p) => (
    <svg width={p.size||16} height={p.size||16} viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>
  ),
  Stop: (p) => (
    <svg width={p.size||14} height={p.size||14} viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="6" width="12" height="12" rx="2"/></svg>
  ),
  Plus: (p) => (
    <svg width={p.size||16} height={p.size||16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M12 5v14M5 12h14"/></svg>
  ),
  Chevron: (p) => (
    <svg width={p.size||14} height={p.size||14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="m9 6 6 6-6 6"/></svg>
  ),
  Arrow: (p) => (
    <svg width={p.size||12} height={p.size||12} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M7 17 17 7M9 7h8v8"/></svg>
  ),
  Hex: (p) => (
    <svg width={p.size||14} height={p.size||14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round"><polygon points="12,2 21,7 21,17 12,22 3,17 3,7"/></svg>
  ),
  HexFill: (p) => (
    <svg width={p.size||14} height={p.size||14} viewBox="0 0 24 24" fill="currentColor"><polygon points="12,2 21,7 21,17 12,22 3,17 3,7"/></svg>
  ),
  Check: (p) => (
    <svg width={p.size||14} height={p.size||14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="m5 12 5 5L20 7"/></svg>
  ),
  Flag: (p) => (
    <svg width={p.size||14} height={p.size||14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M4 22V4h13l-2 5 2 5H4"/></svg>
  ),
  Clock: (p) => (
    <svg width={p.size||14} height={p.size||14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>
  ),
  Warn: (p) => (
    <svg width={p.size||12} height={p.size||12} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3 2 21h20L12 3z"/><path d="M12 10v4M12 18h.01"/></svg>
  ),
  Coin: (p) => (
    <svg width={p.size||14} height={p.size||14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"><polygon points="12,2 21,7 21,17 12,22 3,17 3,7"/><polygon points="12,6 17,9 17,15 12,18 7,15 7,9" fill="currentColor" opacity=".25"/></svg>
  ),
  Kbd: (p) => (
    <svg width={p.size||12} height={p.size||12} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="6" width="20" height="12" rx="2"/><path d="M6 10h.01M10 10h.01M14 10h.01M18 10h.01M6 14h12"/></svg>
  ),
  Sparkle: (p) => (
    <svg width={p.size||12} height={p.size||12} viewBox="0 0 24 24" fill="currentColor"><path d="M12 2l1.6 6.4L20 10l-6.4 1.6L12 18l-1.6-6.4L4 10l6.4-1.6L12 2z"/></svg>
  ),
};

// ---------- Phone shell with status bar ----------
function Phone({ children, time = "9:41" }) {
  return (
    <div className="phone">
      <div className="phone-screen flex flex-col">
        <div className="status-bar shrink-0">
          <span className="mono tnum">{time}</span>
          <div className="flex items-center gap-1.5 text-[var(--ink-2)]">
            <svg width="16" height="11" viewBox="0 0 16 11" fill="currentColor"><rect x="0"  y="6" width="2.5" height="5"/><rect x="4"  y="4" width="2.5" height="7"/><rect x="8"  y="2" width="2.5" height="9"/><rect x="12" y="0" width="2.5" height="11"/></svg>
            <svg width="14" height="11" viewBox="0 0 14 11" fill="none" stroke="currentColor" strokeWidth="1.2"><path d="M.5 4a10 10 0 0 1 13 0M3 6.5a6.5 6.5 0 0 1 8 0M5.5 9a3 3 0 0 1 3 0"/></svg>
            <svg width="24" height="11" viewBox="0 0 24 11" fill="none" stroke="currentColor" strokeWidth="1"><rect x=".5" y=".5" width="20" height="10" rx="2.5"/><rect x="2" y="2" width="14" height="7" rx="1" fill="currentColor"/><rect x="21" y="3.5" width="1.5" height="4" rx=".5" fill="currentColor"/></svg>
          </div>
        </div>
        {children}
        <div className="home-indicator"></div>
      </div>
    </div>
  );
}

// ---------- Live elapsed-time hook ----------
function useElapsed(running, startedAt) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    if (!running) return;
    const id = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(id);
  }, [running]);
  const ms = running ? Math.max(0, now - startedAt) : 0;
  const s = Math.floor(ms/1000);
  const hh = String(Math.floor(s/3600)).padStart(2,'0');
  const mm = String(Math.floor((s%3600)/60)).padStart(2,'0');
  const ss = String(s%60).padStart(2,'0');
  return { hh, mm, ss, totalSec: s };
}

// ---------- Small reusable bits ----------
function Eyebrow({ children, className="" }) {
  return <div className={`eyebrow ${className}`}>{children}</div>;
}

function HexCheck({ filled, onClick }) {
  return (
    <button onClick={onClick}
      className="relative w-7 h-8 grid place-items-center"
      style={{ color: filled ? 'var(--honey)' : 'var(--ink-4)' }}>
      <Icon.Hex size={28} />
      {filled && <span className="absolute"><Icon.Check size={14}/></span>}
    </button>
  );
}

// Honeycomb cluster of habit ticks: row of N hex cells, X filled
function HexProgressRow({ total, done, color = 'var(--honey)' }) {
  return (
    <div className="flex items-center gap-1">
      {Array.from({length: total}).map((_, i) => (
        <span key={i} style={{ color: i < done ? color : 'var(--line-strong)' }}>
          <Icon.HexFill size={10}/>
        </span>
      ))}
    </div>
  );
}

// Sparkline (rolling productivity)
function Sparkline({ data, width=120, height=32, color='var(--honey)' }) {
  const min = Math.min(...data), max = Math.max(...data);
  const pad = 2;
  const stepX = (width - pad*2) / (data.length - 1);
  const norm = (v) => max === min ? height/2 : pad + (height - pad*2) * (1 - (v - min)/(max - min));
  const d = data.map((v,i) => `${i===0?'M':'L'}${(pad + i*stepX).toFixed(1)},${norm(v).toFixed(1)}`).join(' ');
  const area = d + ` L${(width-pad).toFixed(1)},${height-pad} L${pad},${height-pad} Z`;
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
      <path d={area} fill={color} opacity="0.12"/>
      <path d={d} fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
      <circle cx={width-pad} cy={norm(data[data.length-1])} r="2.5" fill={color}/>
    </svg>
  );
}

// Donut for productivity score (svg)
function ScoreDonut({ value=72, size=120, stroke=10, color='var(--honey)' }) {
  const r = (size - stroke)/2;
  const c = 2 * Math.PI * r;
  const off = c * (1 - value/100);
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <circle cx={size/2} cy={size/2} r={r} stroke="rgba(255,255,255,0.06)" strokeWidth={stroke} fill="none"/>
      <circle cx={size/2} cy={size/2} r={r} stroke={color} strokeWidth={stroke} fill="none"
        strokeDasharray={c} strokeDashoffset={off} strokeLinecap="round"
        transform={`rotate(-90 ${size/2} ${size/2})`}/>
    </svg>
  );
}

// Make available globally for other babel scripts
Object.assign(window, { Icon, Phone, useElapsed, Eyebrow, HexCheck, HexProgressRow, Sparkline, ScoreDonut });
