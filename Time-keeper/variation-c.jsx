/* Variation C — Comb Grid
   Honeycomb cluster as the hero. Score, today, tracked, habits, rescues — each in its own hex tile.
   Timer running, docked above End Day. */

function VariationC() {
  const [running, setRunning] = useState(true);
  const [startedAt] = useState(Date.now() - (22*60 + 47)*1000);
  const { hh, mm, ss } = useElapsed(running, startedAt);

  const [habits, setHabits] = useState({ read: 2, walk: 1, stretch: 0, water: 5 });
  const inc = (k, max) => setHabits(h => ({...h, [k]: Math.min(max, h[k]+1) }));

  // Pointy-top hex tile
  const HexTile = ({ w, h, children, bg, border, className='', style={} }) => (
    <div
      className={`hex-tile relative ${className}`}
      style={{
        width: w, height: h,
        background: bg,
        ...style,
      }}>
      {/* Inner border via second clipped layer */}
      {border && (
        <div
          className="hex-tile absolute inset-[1.5px]"
          style={{ background: 'var(--surface)' }}>
        </div>
      )}
      <div className="absolute inset-0 flex flex-col items-center justify-center text-center px-2">
        {children}
      </div>
    </div>
  );

  return (
    <Phone>
      {/* Header */}
      <div className="px-5 pt-1 pb-2 shrink-0 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-[var(--honey)]"><Icon.HexFill size={14}/></span>
          <span className="text-[14px] font-semibold tracking-tight">Time Keeper</span>
        </div>
        <div className="flex items-center gap-3 text-[var(--ink-2)]">
          <div className="mono tnum text-[11px] flex items-center gap-1 px-2 py-1 rounded-md text-[var(--honey)]">
            <Icon.Coin size={12}/> 1,248
          </div>
          <button className="hover:text-[var(--ink)]"><Icon.Bell/></button>
          <button className="hover:text-[var(--ink)]"><Icon.Gear/></button>
        </div>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto scroll-y px-4 pb-[200px]">
        {/* Greeting */}
        <div className="px-1 mb-2">
          <div className="eyebrow">Thu · May 15</div>
          <div className="text-[20px] font-semibold tracking-tight mt-0.5">Today's hive</div>
        </div>

        {/* HONEYCOMB CLUSTER ====================================== */}
        <div className="relative mx-auto mb-3" style={{ width: 343, height: 270 }}>
          {/* Faint hex backdrop */}
          <div className="absolute inset-0 hex-bg-warm rounded-2xl opacity-60"
               style={{ backgroundColor: 'rgba(20,16,11,0.5)' }}></div>

          {/* CENTER — 7d avg */}
          <div className="absolute" style={{ left: 110, top: 64, width: 124, height: 142 }}>
            <div className="hex-tile w-full h-full"
              style={{ background: 'linear-gradient(180deg, #f0b429 0%, #b8801b 100%)' }}>
              <div className="hex-tile absolute inset-[2px]"
                style={{ background: 'linear-gradient(180deg, #1a140a 0%, #120e08 100%)' }}>
              </div>
            </div>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <div className="eyebrow text-[var(--honey)] text-[8px]">7-day avg</div>
              <div className="mono tnum text-[48px] font-semibold leading-none text-[var(--cream)] mt-0.5">67</div>
              <div className="mt-1 flex items-center gap-1">
                <Sparkline data={[58,62,55,71,64,68,72]} width={62} height={14} color="var(--honey)"/>
              </div>
            </div>
          </div>

          {/* TOP LEFT — Today */}
          <div className="absolute" style={{ left: 16, top: 12, width: 104, height: 120 }}>
            <div className="hex-tile w-full h-full" style={{ background: 'var(--line-strong)' }}>
              <div className="hex-tile absolute inset-[1.5px]" style={{ background: 'var(--surface)' }}></div>
            </div>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <div className="eyebrow text-[8px]">Today</div>
              <div className="mono tnum text-[32px] leading-none font-semibold text-[var(--honey)] mt-0.5">72</div>
              <div className="text-[10px] mt-1" style={{ color: 'var(--green)' }}>+5 vs avg</div>
            </div>
          </div>

          {/* TOP RIGHT — Tracked */}
          <div className="absolute" style={{ left: 224, top: 12, width: 104, height: 120 }}>
            <div className="hex-tile w-full h-full" style={{ background: 'var(--line-strong)' }}>
              <div className="hex-tile absolute inset-[1.5px]" style={{ background: 'var(--surface)' }}></div>
            </div>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <div className="eyebrow text-[8px]">Tracked</div>
              <div className="mono tnum text-[24px] leading-none font-semibold text-[var(--cream)] mt-1">3<span className="text-[var(--ink-3)] text-[16px]">h</span>41<span className="text-[var(--ink-3)] text-[16px]">m</span></div>
              <div className="text-[10px] text-[var(--ink-3)] mt-1 mono">goal 5h</div>
            </div>
          </div>

          {/* BOTTOM LEFT — Habits */}
          <div className="absolute" style={{ left: 16, top: 138, width: 104, height: 120 }}>
            <div className="hex-tile w-full h-full" style={{ background: 'var(--line-strong)' }}>
              <div className="hex-tile absolute inset-[1.5px]" style={{ background: 'var(--surface)' }}></div>
            </div>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <div className="eyebrow text-[8px]">Habits</div>
              <div className="mono tnum text-[28px] leading-none font-semibold text-[var(--cream)] mt-0.5">2<span className="text-[var(--ink-3)] text-[18px]">/4</span></div>
              <div className="mt-1.5"><HexProgressRow total={4} done={2}/></div>
            </div>
          </div>

          {/* BOTTOM RIGHT — Rescues */}
          <div className="absolute" style={{ left: 224, top: 138, width: 104, height: 120 }}>
            <div className="hex-tile w-full h-full" style={{ background: 'var(--line-strong)' }}>
              <div className="hex-tile absolute inset-[1.5px]" style={{ background: 'var(--surface)' }}></div>
            </div>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <div className="eyebrow text-[8px]">Rescues</div>
              <div className="mono tnum text-[32px] leading-none font-semibold text-[var(--amber)] mt-0.5">2</div>
              <div className="text-[10px] text-[var(--ink-3)] mt-1">available</div>
            </div>
          </div>
        </div>

        {/* Top 3 tasks */}
        <section className="px-1">
          <div className="flex items-baseline justify-between mb-2 mt-1">
            <Eyebrow>Today's three</Eyebrow>
            <span className="text-[10px] mono text-[var(--ink-3)]">tap to start</span>
          </div>
          <div className="space-y-1.5">
            {[
              { title: 'Draft Q3 OKRs', est: '45m', tag: 'Planning', urgent: true, important: true },
              { title: 'Review pricing v3', est: '30m', tag: 'Pricing', important: true },
              { title: 'Reply onboarding emails', est: '20m', tag: 'Inbox', urgent: true, resched: true },
            ].map((t, i) => (
              <button key={i} className="w-full card px-3 py-2.5 flex items-center gap-3 text-left">
                <div className="relative w-8 h-9 grid place-items-center text-[var(--honey)]">
                  <Icon.HexFill size={32}/>
                  <span className="absolute mono tnum text-[12px] font-semibold text-[#1a1207]">{i+1}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-[13.5px] font-medium truncate leading-tight">{t.title}</div>
                  <div className="flex items-center gap-1.5 mt-1 text-[11px] text-[var(--ink-3)]">
                    <span className="mono tnum">{t.est}</span>
                    <span className="text-[var(--ink-4)]">·</span>
                    <span>{t.tag}</span>
                    {t.urgent && <span className="chip chip-amber" style={{ padding: '1px 6px', fontSize: 10 }}>U</span>}
                    {t.important && <span className="chip chip-honey" style={{ padding: '1px 6px', fontSize: 10 }}>I</span>}
                    {t.resched && <span className="chip chip-red" style={{ padding: '1px 6px', fontSize: 10 }}><Icon.Warn size={9}/> 3×</span>}
                  </div>
                </div>
                <Icon.Play size={13}/>
              </button>
            ))}
          </div>
        </section>

        {/* Habits hex strip */}
        <section className="px-1 mt-4">
          <div className="flex items-baseline justify-between mb-2">
            <Eyebrow>Habits · today</Eyebrow>
            <span className="text-[10px] mono text-[var(--ink-3)]">+1 to log</span>
          </div>
          <div className="flex items-center justify-between gap-1">
            {[
              { k:'read',    label:'Read',    goal: 3 },
              { k:'walk',    label:'Walk',    goal: 1 },
              { k:'stretch', label:'Stretch', goal: 1 },
              { k:'water',   label:'Water',   goal: 8 },
            ].map(h => {
              const v = habits[h.k]; const complete = v >= h.goal;
              return (
                <button key={h.k} onClick={() => inc(h.k, h.goal)} className="flex-1 flex flex-col items-center">
                  <div className="relative w-14 h-16">
                    <div className="hex-tile absolute inset-0"
                      style={{ background: complete ? 'var(--honey)' : 'var(--line-strong)' }}></div>
                    <div className="hex-tile absolute inset-[1.5px]"
                      style={{ background: complete ? 'rgba(240,180,41,0.15)' : 'var(--surface)' }}></div>
                    <div className="absolute inset-0 grid place-items-center">
                      <div className="text-center">
                        <div className="mono tnum text-[16px] font-semibold leading-none"
                          style={{ color: complete ? 'var(--honey)' : 'var(--cream)' }}>{v}</div>
                        <div className="mono tnum text-[9px] text-[var(--ink-3)] mt-0.5">/{h.goal}</div>
                      </div>
                    </div>
                  </div>
                  <div className="text-[10px] text-[var(--ink-2)] mt-1">{h.label}</div>
                </button>
              );
            })}
          </div>
        </section>

        {/* Reminders */}
        <section className="px-1 mt-4">
          <Eyebrow className="mb-2">Reminders</Eyebrow>
          <div className="card divide-y divide-[var(--line)]">
            <div className="px-3 py-2.5 flex items-center gap-3">
              <Icon.Clock />
              <div className="flex-1">
                <div className="text-[13px]">Stand-up sync</div>
                <div className="mono tnum text-[11px] text-[var(--ink-3)]">in 18m</div>
              </div>
              <span className="chip chip-amber">Soon</span>
            </div>
            <div className="px-3 py-2.5 flex items-center gap-3">
              <Icon.Flag />
              <div className="flex-1">
                <div className="text-[13px]">Lab results follow-up</div>
                <div className="mono tnum text-[11px] text-[var(--ink-3)]">15:30</div>
              </div>
            </div>
          </div>
        </section>
      </div>

      {/* Sticky bottom — running timer + End Day */}
      <div className="absolute left-0 right-0 bottom-0 px-3 pb-5 pt-3"
        style={{ background: 'linear-gradient(180deg, rgba(14,12,10,0) 0%, rgba(14,12,10,0.98) 35%)' }}>
        {/* Timer dock */}
        <div className="rounded-2xl border border-[rgba(240,180,41,0.30)] overflow-hidden mb-2.5"
          style={{ background: 'linear-gradient(180deg, #1c160d 0%, #14100a 100%)' }}>
          <div className="px-3.5 py-3 flex items-center gap-3">
            <span className="text-[var(--honey)]"><Icon.HexFill size={20}/></span>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5 text-[10px]">
                <span className="w-1 h-1 rounded-full bg-[var(--honey)] pulse-dot"></span>
                <span className="mono uppercase tracking-[0.16em] text-[var(--honey)]">Tracking</span>
                <span className="text-[var(--ink-3)]">·</span>
                <span className="text-[var(--ink-2)] truncate">Deep work · Draft Q3 OKRs</span>
              </div>
              <div className="mono tnum text-[24px] leading-none font-semibold text-[var(--cream)] mt-1">
                {hh}<span className="text-[var(--ink-3)]">:</span>{mm}<span className="text-[var(--ink-3)]">:</span><span className="text-[var(--ink-2)]">{ss}</span>
              </div>
            </div>
            <button onClick={() => setRunning(r => !r)}
              className="btn-stop h-10 w-10 grid place-items-center">
              {running ? <Icon.Stop size={12}/> : <Icon.Play size={14}/>}
            </button>
          </div>
        </div>
        <button className="btn-primary w-full h-13 py-3.5 flex items-center justify-center gap-2 text-[15px]">
          End day &amp; review <Icon.Arrow size={14}/>
        </button>
      </div>
    </Phone>
  );
}

window.VariationC = VariationC;
