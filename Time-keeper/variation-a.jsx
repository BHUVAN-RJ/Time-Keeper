/* Variation A — Workshop Ledger
   Dense, organized, list-rhythm. Subtle hex dividers between sections.
   Timer is running by default to show that state. */

function VariationA() {
  const [running, setRunning] = useState(true);
  const [startedAt, setStartedAt] = useState(Date.now() - (38*60 + 12)*1000);
  const { hh, mm, ss } = useElapsed(running, startedAt);

  const [habits, setHabits] = useState({ read: 2, walk: 1, stretch: 0, water: 5 });
  const inc = (k, max) => setHabits(h => ({...h, [k]: Math.min(max, h[k]+1) }));

  return (
    <Phone>
      {/* Header */}
      <div className="px-5 pt-1 pb-3 shrink-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-[var(--honey)]"><Icon.HexFill size={16}/></span>
            <div className="text-[15px] font-semibold tracking-tight">Time Keeper</div>
          </div>
          <div className="flex items-center gap-3 text-[var(--ink-2)]">
            <div className="mono tnum text-[11px] flex items-center gap-1 px-2 py-1 rounded-md border border-[var(--line)] bg-[rgba(240,180,41,0.05)] text-[var(--honey)]">
              <Icon.Coin size={12}/> 1,248
            </div>
            <button className="text-[var(--ink-2)] hover:text-[var(--ink)]"><Icon.Bell/></button>
            <button className="text-[var(--ink-2)] hover:text-[var(--ink)]"><Icon.Gear/></button>
          </div>
        </div>
        <div className="mt-3 flex items-baseline justify-between">
          <div>
            <div className="text-[22px] font-semibold tracking-tight leading-none">Thursday</div>
            <div className="text-[12px] text-[var(--ink-3)] mt-1">May 15 · Week 20</div>
          </div>
          <div className="text-right">
            <Eyebrow>Day</Eyebrow>
            <div className="mono tnum text-[13px] text-[var(--ink-2)] mt-0.5">04 : 22 elapsed</div>
          </div>
        </div>
      </div>

      {/* Running timer pill (sticky-style) */}
      <div className="mx-4 mb-3 shrink-0 rounded-2xl overflow-hidden ring-honey"
        style={{ background: 'linear-gradient(180deg, #1c160d 0%, #14100a 100%)' }}>
        <div className="px-4 pt-3 pb-4 hex-bg-warm" style={{ backgroundColor: 'transparent' }}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-[11px]">
              <span className="w-1.5 h-1.5 rounded-full bg-[var(--honey)] pulse-dot"></span>
              <span className="mono uppercase tracking-[0.16em] text-[var(--honey)]">Tracking</span>
              <span className="text-[var(--ink-3)]">·</span>
              <span className="text-[var(--ink-2)]">Deep work</span>
            </div>
            <span className="chip chip-line">Hive #03</span>
          </div>
          <div className="mt-2 flex items-end justify-between">
            <div className="mono tnum text-[44px] font-semibold leading-none text-[var(--cream)]">
              {hh}<span className="text-[var(--ink-3)]">:</span>{mm}<span className="text-[var(--ink-3)]">:</span><span className="text-[var(--ink-2)]">{ss}</span>
            </div>
            <button
              onClick={() => setRunning(false)}
              className="btn-stop px-4 h-10 flex items-center gap-2 text-[13px] font-semibold">
              <Icon.Stop size={11}/> Stop
            </button>
          </div>
          <div className="mt-2 text-[12px] text-[var(--ink-2)] truncate">
            Draft Q3 OKRs · planning doc
          </div>
        </div>
      </div>

      {/* Scrollable body */}
      <div className="flex-1 overflow-y-auto scroll-y px-4 pb-28">
        {/* Productivity score */}
        <section className="card p-4">
          <div className="flex items-start justify-between">
            <Eyebrow>Productivity</Eyebrow>
            <button className="text-[11px] text-[var(--ink-3)] hover:text-[var(--ink)] flex items-center gap-1">Details <Icon.Chevron size={11}/></button>
          </div>

          <div className="mt-2 flex items-end gap-4">
            <div>
              <div className="eyebrow text-[9px]">7-day avg</div>
              <div className="mono tnum text-[64px] font-semibold leading-none tracking-tight text-[var(--cream)]">67</div>
              <div className="text-[11px] text-[var(--ink-3)] mt-1">Trailing average</div>
            </div>
            <div className="flex-1 flex flex-col items-end">
              <Sparkline data={[58,62,55,71,64,68,72]} width={140} height={36}/>
              <div className="mono tnum text-[10px] text-[var(--ink-3)] mt-1">Fri · Sat · Sun · Mon · Tue · Wed · Thu</div>
            </div>
          </div>

          <div className="mt-3 pt-3 border-t border-dashed border-[var(--line)] flex items-baseline justify-between">
            <div className="flex items-baseline gap-3">
              <div className="eyebrow text-[9px]">Today</div>
              <div className="mono tnum text-[28px] font-semibold leading-none text-[var(--honey)]">72</div>
              <div className="text-[11px]" style={{ color: 'var(--green)' }}>+5 vs avg</div>
            </div>
            <div className="text-[11px] text-[var(--ink-3)] mono tnum">3h 41m tracked</div>
          </div>
        </section>

        <div className="hex-divider my-4 opacity-70"></div>

        {/* Pinned tasks */}
        <section>
          <div className="flex items-baseline justify-between mb-2">
            <div className="flex items-center gap-2">
              <Eyebrow>Top 3 · pinned</Eyebrow>
              <span className="text-[10px] text-[var(--ink-4)] mono">from last review</span>
            </div>
            <button className="text-[11px] text-[var(--ink-3)] flex items-center gap-1">Tasks <Icon.Chevron size={11}/></button>
          </div>
          <div className="card divide-y divide-[var(--line)]">
            {[
              { n: 1, title: 'Draft Q3 OKRs', est: '45m', tag: 'Planning', urgent: true, important: true },
              { n: 2, title: 'Review pricing v3 deck', est: '30m', tag: 'Pricing', urgent: false, important: true },
              { n: 3, title: 'Reply to onboarding emails', est: '20m', tag: 'Inbox', urgent: true, important: false, resched: true },
            ].map(t => (
              <div key={t.n} className="px-3.5 py-3 flex items-center gap-3">
                <div className="w-6 h-6 grid place-items-center text-[10px] mono text-[var(--honey)] relative">
                  <Icon.Hex size={22}/>
                  <span className="absolute mono tnum">{t.n}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-[13.5px] font-medium truncate leading-tight">{t.title}</div>
                  <div className="flex items-center gap-2 mt-1 text-[11px] text-[var(--ink-3)]">
                    <span className="mono tnum">{t.est}</span>
                    <span className="text-[var(--ink-4)]">·</span>
                    <span>{t.tag}</span>
                    {t.urgent && <span className="chip chip-amber">U</span>}
                    {t.important && <span className="chip chip-honey">I</span>}
                    {t.resched && <span className="chip chip-red"><Icon.Warn size={10}/> 3×</span>}
                  </div>
                </div>
                <button className="text-[var(--ink-3)]"><Icon.Play size={14}/></button>
              </div>
            ))}
          </div>
        </section>

        <div className="hex-divider my-4 opacity-70"></div>

        {/* Habits */}
        <section>
          <div className="flex items-baseline justify-between mb-2">
            <Eyebrow>Habits · today</Eyebrow>
            <span className="text-[10px] mono text-[var(--ink-3)]">2 rescues available</span>
          </div>
          <div className="card p-3 space-y-2.5">
            {[
              { k:'read',    label:'Read 20 pages',  done: 2, goal: 3 },
              { k:'walk',    label:'Walk',            done: 1, goal: 1 },
              { k:'stretch', label:'Stretch',         done: 0, goal: 1 },
              { k:'water',   label:'Water',           done: 5, goal: 8 },
            ].map(h => {
              const v = habits[h.k]; const complete = v >= h.goal;
              return (
                <div key={h.k} className="flex items-center gap-3">
                  <span style={{ color: complete ? 'var(--honey)' : 'var(--ink-4)' }}>
                    {complete ? <Icon.HexFill size={14}/> : <Icon.Hex size={14}/>}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className={`text-[13px] ${complete ? 'text-[var(--ink-2)]' : 'text-[var(--ink)]'}`}>{h.label}</div>
                    <div className="mt-1 flex items-center gap-2">
                      <HexProgressRow total={h.goal} done={v}/>
                      <span className="mono tnum text-[10px] text-[var(--ink-3)]">{v}/{h.goal}</span>
                    </div>
                  </div>
                  <button onClick={() => inc(h.k, h.goal)}
                    className="btn-ghost h-8 px-2.5 text-[12px] flex items-center gap-1 mono">
                    <Icon.Plus size={12}/> 1
                  </button>
                </div>
              );
            })}
          </div>
        </section>

        <div className="hex-divider my-4 opacity-70"></div>

        {/* Reminders */}
        <section>
          <div className="flex items-baseline justify-between mb-2">
            <Eyebrow>Reminders</Eyebrow>
            <span className="text-[10px] mono text-[var(--ink-3)]">2 due</span>
          </div>
          <div className="card divide-y divide-[var(--line)]">
            <div className="px-3.5 py-3 flex items-center gap-3">
              <Icon.Clock />
              <div className="flex-1">
                <div className="text-[13px]">Stand-up sync</div>
                <div className="mono tnum text-[11px] text-[var(--ink-3)]">in 18m · 14:00</div>
              </div>
              <span className="chip chip-amber">Soon</span>
            </div>
            <div className="px-3.5 py-3 flex items-center gap-3">
              <Icon.Flag />
              <div className="flex-1">
                <div className="text-[13px]">Lab results follow-up</div>
                <div className="mono tnum text-[11px] text-[var(--ink-3)]">15:30 · 1h 48m</div>
              </div>
            </div>
          </div>
        </section>
      </div>

      {/* End Day CTA pinned */}
      <div className="absolute left-0 right-0 bottom-0 px-4 pb-6 pt-3"
        style={{ background: 'linear-gradient(180deg, rgba(14,12,10,0) 0%, rgba(14,12,10,0.95) 50%)' }}>
        <button className="btn-primary w-full h-14 flex items-center justify-center gap-2 text-[15px]">
          End day &amp; review
          <Icon.Arrow size={14}/>
        </button>
      </div>
    </Phone>
  );
}

window.VariationA = VariationA;
