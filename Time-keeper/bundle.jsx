/* Time Keeper — TODAY v2 · radically simple
   Three states. Only one visible at a time. */

const { useState: uS, useEffect: uE } = React;

// ---------- shared chrome ----------
function HeaderBar({ unread = false }) {
  return (
    <div className="px-5 pt-1 pb-2 shrink-0 flex items-center justify-between">
      <div className="flex items-center gap-2">
        <span className="text-[var(--honey)] opacity-90"><Icon.HexFill size={11}/></span>
        <span className="text-[12px] font-medium tracking-[0.02em] text-[var(--ink-2)]">Time Keeper</span>
      </div>
      <div className="flex items-center gap-3 text-[var(--ink-3)]">
        <button className="hover:text-[var(--ink)] relative p-1 -m-1">
          <Icon.Bell size={17}/>
          {unread && <span className="absolute top-0.5 right-0.5 w-1.5 h-1.5 rounded-full bg-[var(--honey)]"></span>}
        </button>
        <button className="hover:text-[var(--ink)] p-1 -m-1 opacity-60 hover:opacity-100">
          <Icon.Gear size={15}/>
        </button>
      </div>
    </div>
  );
}

function AccordionRow({ label, count, open, onToggle }) {
  return (
    <button onClick={onToggle}
      className="w-full px-5 py-4 flex items-center justify-between border-t border-[var(--line)] active:bg-[rgba(255,255,255,0.02)]">
      <div className="flex items-center gap-3">
        <span className="text-[14px] text-[var(--ink-2)]">{label}</span>
        {count != null && <span className="mono tnum text-[11px] text-[var(--ink-4)]">{count}</span>}
      </div>
      <span className="text-[var(--ink-4)] transition-transform" style={{ transform: open ? 'rotate(90deg)' : 'none' }}>
        <Icon.Chevron size={14}/>
      </span>
    </button>
  );
}

// ============================================================
// STATE 1 — TIMER RUNNING
// ============================================================
function State1Running() {
  const [startedAt] = uS(Date.now() - (1*3600 + 14*60 + 36)*1000);
  const { hh, mm, ss } = useElapsed(true, startedAt);
  const [openTasks, setOpenTasks] = uS(false);
  const [openHabits, setOpenHabits] = uS(false);

  return (
    <Phone>
      <HeaderBar unread />

      {/* Scroll area */}
      <div className="flex-1 overflow-y-auto scroll-y flex flex-col">

        {/* HERO — fills the visible viewport so nothing else shows above the fold */}
        <div className="shrink-0 flex flex-col items-center justify-center px-6"
             style={{ minHeight: 'calc(812px - 44px - 44px - 14px)' }}>
          {/* Category eyebrow */}
          <div className="eyebrow text-[10px] mb-7 flex items-center gap-2">
            <span className="w-1 h-1 rounded-full bg-[var(--honey)] pulse-dot"></span>
            Deep work
          </div>

          {/* Big elapsed time */}
          <div className="mono tnum text-[64px] font-medium leading-none text-[var(--cream)] tracking-[-0.02em]"
               style={{ fontVariantNumeric: 'tabular-nums' }}>
            {hh}<span className="text-[var(--ink-4)] mx-0.5">:</span>{mm}<span className="text-[var(--ink-4)] mx-0.5">:</span><span className="text-[var(--ink-3)]">{ss}</span>
          </div>

          {/* Label */}
          <div className="mt-6 text-[15px] text-[var(--ink-2)] text-center max-w-[260px] leading-snug">
            Draft Q3 OKRs
          </div>

          {/* Stop button */}
          <button className="mt-12 w-full max-w-[280px] h-16 rounded-2xl text-[16px] font-semibold flex items-center justify-center gap-2"
                  style={{
                    background: 'linear-gradient(180deg, #f0b429 0%, #d9991f 100%)',
                    color: '#1a1207',
                    boxShadow: '0 1px 0 rgba(255,255,255,0.25) inset, 0 -1px 0 rgba(0,0,0,0.2) inset, 0 14px 30px -14px rgba(240,180,41,0.5)'
                  }}>
            <Icon.Stop size={13}/> Stop
          </button>

          {/* faint scroll-for-more affordance */}
          <div className="mt-auto pt-10 pb-2 text-[var(--ink-4)] flex flex-col items-center gap-1">
            <svg width="16" height="10" viewBox="0 0 16 10" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"><path d="m2 7 6-4 6 4"/></svg>
          </div>
        </div>

        {/* Below the fold — collapsed accordions */}
        <div>
          <AccordionRow label="Today's tasks"  count="3 pinned"   open={openTasks}  onToggle={() => setOpenTasks(o => !o)}/>
          {openTasks && (
            <div className="px-5 pb-4 space-y-2.5">
              {[
                { title: 'Draft Q3 OKRs',        est: '45m', tag: 'Planning' },
                { title: 'Review pricing v3',     est: '30m', tag: 'Pricing'  },
                { title: 'Reply onboarding mail', est: '20m', tag: 'Inbox'    },
              ].map((t, i) => (
                <div key={i} className="flex items-center gap-3 py-1">
                  <span className="mono tnum text-[11px] text-[var(--ink-4)] w-3">{i+1}</span>
                  <div className="flex-1 min-w-0">
                    <div className="text-[13.5px] text-[var(--ink)] truncate">{t.title}</div>
                    <div className="text-[11px] text-[var(--ink-4)] mt-0.5 mono tnum">{t.est} · <span className="font-sans">{t.tag}</span></div>
                  </div>
                </div>
              ))}
            </div>
          )}
          <AccordionRow label="Habits"         count="2 / 4 today" open={openHabits} onToggle={() => setOpenHabits(o => !o)}/>
          {openHabits && (
            <div className="px-5 pb-6 space-y-2">
              {[
                { label:'Read',    done:2, goal:3 },
                { label:'Walk',    done:1, goal:1 },
                { label:'Stretch', done:0, goal:1 },
                { label:'Water',   done:5, goal:8 },
              ].map(h => (
                <div key={h.label} className="flex items-center gap-3 py-1">
                  <span style={{ color: h.done >= h.goal ? 'var(--honey)' : 'var(--ink-4)' }}>
                    {h.done >= h.goal ? <Icon.HexFill size={11}/> : <Icon.Hex size={11}/>}
                  </span>
                  <div className="flex-1 text-[13.5px] text-[var(--ink-2)]">{h.label}</div>
                  <span className="mono tnum text-[11px] text-[var(--ink-4)]">{h.done}/{h.goal}</span>
                </div>
              ))}
            </div>
          )}
          {/* trailing border-line cap */}
          <div className="border-t border-[var(--line)]"></div>
          <div className="h-12"></div>
        </div>
      </div>
    </Phone>
  );
}

// ============================================================
// STATE 2 — NO TIMER, NEXT TASK AVAILABLE
// ============================================================
function State2NextTask() {
  const afterSix = true; // mock: simulating 18:00+ so End day shows
  return (
    <Phone time="18:42">
      <HeaderBar/>
      <div className="flex-1 flex flex-col px-6 pt-2 pb-6">
        <div className="flex-1 flex flex-col justify-center">
          {/* Eyebrow */}
          <div className="eyebrow text-[10px] mb-5">Next up</div>

          {/* One task card */}
          <div className="rounded-2xl border border-[var(--line)] p-5"
               style={{ background: 'linear-gradient(180deg, #181410 0%, #14110d 100%)' }}>
            <div className="flex items-start justify-between gap-3">
              <div className="text-[20px] font-semibold tracking-tight leading-tight text-[var(--cream)] max-w-[230px]">
                Draft Q3 OKRs
              </div>
              <span className="shrink-0 inline-flex items-center gap-1.5 px-2 py-1 rounded-md text-[10px] mono uppercase tracking-[0.12em]"
                    style={{ color: 'var(--honey)', background: 'rgba(240,180,41,0.08)', border: '1px solid rgba(240,180,41,0.20)' }}>
                <Icon.HexFill size={8}/> Q2
              </span>
            </div>
            <div className="mt-4 flex items-center gap-3 text-[12px] text-[var(--ink-3)]">
              <span className="mono tnum">est 45m</span>
              <span className="text-[var(--ink-4)]">·</span>
              <span>Planning</span>
              <span className="text-[var(--ink-4)]">·</span>
              <span>due Fri</span>
            </div>
          </div>

          {/* Primary CTA */}
          <button className="mt-6 w-full h-16 rounded-2xl text-[16px] font-semibold flex items-center justify-center gap-2"
                  style={{
                    background: 'linear-gradient(180deg, #f0b429 0%, #d9991f 100%)',
                    color: '#1a1207',
                    boxShadow: '0 1px 0 rgba(255,255,255,0.25) inset, 0 -1px 0 rgba(0,0,0,0.2) inset, 0 14px 30px -14px rgba(240,180,41,0.5)'
                  }}>
            <Icon.Play size={14}/> Start working
          </button>

          {/* Muted secondary */}
          <button className="mt-3 w-full h-12 rounded-xl text-[13px] text-[var(--ink-3)] hover:text-[var(--ink-2)] flex items-center justify-center gap-2">
            Skip <span className="text-[var(--ink-4)]">→ next</span>
          </button>

          {/* Faint footer link */}
          <button className="mt-8 mx-auto text-[12px] text-[var(--ink-4)] hover:text-[var(--ink-2)] flex items-center gap-1.5">
            <span className="mono tnum">5</span> more scheduled today
            <Icon.Chevron size={11}/>
          </button>
        </div>

        {/* End day — only after 18:00 */}
        {afterSix && (
          <button className="mt-4 mx-auto text-[12px] text-[var(--ink-3)] hover:text-[var(--ink)] underline-offset-4 hover:underline">
            End day
          </button>
        )}
      </div>
    </Phone>
  );
}

// ============================================================
// STATE 3 — EMPTY
// ============================================================
function State3Empty() {
  return (
    <Phone>
      <HeaderBar/>
      <div className="flex-1 flex flex-col px-6 pt-2 pb-10">
        <div className="flex-1 flex flex-col items-center justify-center">
          {/* Small decorative hex — single, calm */}
          <div className="text-[var(--ink-4)] opacity-50 mb-7">
            <Icon.Hex size={32}/>
          </div>

          {/* Message */}
          <div className="text-[22px] font-semibold tracking-tight text-[var(--ink-2)] text-center leading-snug">
            Nothing planned for today.
          </div>
          <div className="mt-3 text-[13px] text-[var(--ink-4)] text-center max-w-[260px] leading-relaxed">
            Pick something quick, plan a few, or take the morning off. The hive will keep.
          </div>

          {/* Two equal buttons */}
          <div className="mt-10 w-full grid grid-cols-2 gap-2.5 max-w-[320px]">
            <button className="h-14 rounded-2xl text-[14px] font-semibold flex items-center justify-center gap-1.5"
                    style={{
                      background: 'linear-gradient(180deg, #f0b429 0%, #d9991f 100%)',
                      color: '#1a1207',
                      boxShadow: '0 1px 0 rgba(255,255,255,0.25) inset, 0 -1px 0 rgba(0,0,0,0.2) inset, 0 10px 24px -12px rgba(240,180,41,0.5)'
                    }}>
              <Icon.Play size={12}/> Quick start
            </button>
            <button className="h-14 rounded-2xl text-[14px] font-medium text-[var(--ink)] border border-[var(--line-strong)] hover:border-[var(--honey-deep)] flex items-center justify-center gap-1.5"
                    style={{ background: 'var(--surface)' }}>
              Plan something
            </button>
          </div>
        </div>
      </div>
    </Phone>
  );
}

// ============================================================
// APP
// ============================================================
function App() {
  return (
    <DesignCanvas>
      <DCSection id="today" title="Today · v2" subtitle="One screen, one state at a time. The other tools sit on the wall until needed.">
        <DCArtboard id="s1" label="State 1 · Timer running" width={375} height={812}>
          <State1Running/>
        </DCArtboard>
        <DCArtboard id="s2" label="State 2 · Next task ready" width={375} height={812}>
          <State2NextTask/>
        </DCArtboard>
        <DCArtboard id="s3" label="State 3 · Empty" width={375} height={812}>
          <State3Empty/>
        </DCArtboard>
      </DCSection>
    </DesignCanvas>
  );
}

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(<App/>);
