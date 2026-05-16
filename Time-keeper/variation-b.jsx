/* Variation B — Focus Stack
   Single-column, larger breathing room. Timer NOT running → shows Start CTA + category picker.
   Score as donut with rolling avg dominant. */

function VariationB() {
  const categories = [
    { id: 'deep',   label: 'Deep work',   color: 'var(--honey)' },
    { id: 'admin',  label: 'Admin',       color: 'var(--amber)' },
    { id: 'meet',   label: 'Meetings',    color: '#a48a55' },
    { id: 'learn',  label: 'Learning',    color: '#c9b078' },
    { id: 'break',  label: 'Break',       color: '#7a6e4e' },
  ];
  const [cat, setCat] = useState('deep');
  const [running, setRunning] = useState(false);
  const [startedAt, setStartedAt] = useState(null);
  const start = () => { setStartedAt(Date.now()); setRunning(true); };

  const { hh, mm, ss } = useElapsed(running, startedAt || Date.now());

  const [habits, setHabits] = useState({ read: 2, walk: 1, stretch: 0, water: 5 });
  const inc = (k, max) => setHabits(h => ({...h, [k]: Math.min(max, h[k]+1) }));

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
          <button className="hover:text-[var(--ink)] relative">
            <Icon.Bell/>
            <span className="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 rounded-full bg-[var(--honey)]"></span>
          </button>
          <button className="hover:text-[var(--ink)]"><Icon.Gear/></button>
        </div>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto scroll-y px-5 pb-28">
        {/* Greeting line */}
        <div className="mt-2 mb-5">
          <div className="eyebrow">Thursday · 13:42</div>
          <div className="text-[26px] font-semibold tracking-tight leading-tight mt-1">
            Steady this week. <span className="text-[var(--ink-3)]">Pick the next one.</span>
          </div>
        </div>

        {/* Score donut + breakdown */}
        <section className="card p-5">
          <div className="flex items-center gap-5">
            <div className="relative w-[120px] h-[120px] grid place-items-center">
              <ScoreDonut value={67} size={120} stroke={8} color="var(--honey)"/>
              <div className="absolute text-center">
                <div className="eyebrow text-[9px]">7-day</div>
                <div className="mono tnum text-[40px] leading-none font-semibold text-[var(--cream)]">67</div>
                <div className="eyebrow text-[9px] mt-0.5">avg</div>
              </div>
            </div>
            <div className="flex-1 min-w-0">
              <Eyebrow className="text-[9px]">Today</Eyebrow>
              <div className="flex items-baseline gap-2 mt-0.5">
                <div className="mono tnum text-[36px] leading-none font-semibold text-[var(--honey)]">72</div>
                <div className="text-[12px]" style={{ color: 'var(--green)' }}>+5</div>
              </div>
              <div className="text-[11px] text-[var(--ink-3)] mt-2 mono tnum leading-relaxed">
                3h 41m tracked<br/>
                2 / 4 habits<br/>
                <span className="text-[var(--ink-2)]">2 rescues</span> in pocket
              </div>
            </div>
          </div>
        </section>

        {/* Start tracking card */}
        <section className="card-2 mt-4 p-4 hex-bg-warm" style={{ backgroundColor: 'rgba(28,22,13,0.7)' }}>
          <div className="flex items-center justify-between">
            <Eyebrow>Not tracking</Eyebrow>
            <div className="mono tnum text-[11px] text-[var(--ink-3)]">last: 02:18 PM</div>
          </div>

          <div className="mt-2 mono tnum text-[34px] font-semibold leading-none text-[var(--ink-2)]">
            {running ? (<>{hh}<span className="text-[var(--ink-3)]">:</span>{mm}<span className="text-[var(--ink-3)]">:</span><span className="text-[var(--ink-2)]">{ss}</span></>) : '00:00:00'}
          </div>

          {/* Category picker */}
          <div className="mt-3 -mx-1 flex gap-1.5 overflow-x-auto pb-1" style={{ scrollbarWidth: 'none' }}>
            {categories.map(c => (
              <button key={c.id} onClick={() => setCat(c.id)}
                className={`shrink-0 px-3 h-8 rounded-lg text-[12px] flex items-center gap-1.5 border ${cat===c.id ? 'border-[var(--honey)] text-[var(--honey)] bg-[rgba(240,180,41,0.08)]' : 'border-[var(--line-strong)] text-[var(--ink-2)]'}`}>
                <span className="w-1.5 h-1.5 rounded-full" style={{ background: c.color }}></span>
                {c.label}
              </button>
            ))}
          </div>

          <div className="mt-3 flex items-center gap-2">
            <input
              type="text"
              placeholder="What are you working on?"
              className="flex-1 h-11 px-3 rounded-xl bg-[#11100c] border border-[var(--line)] text-[13px] placeholder:text-[var(--ink-4)] focus:outline-none focus:border-[var(--honey-deep)]"
            />
            <button onClick={start} className="btn-primary h-11 px-5 flex items-center gap-2 text-[13px]">
              <Icon.Play size={13}/> Start
            </button>
          </div>
        </section>

        {/* Top 3 */}
        <section className="mt-5">
          <div className="flex items-baseline justify-between mb-2.5">
            <div className="flex items-center gap-2">
              <Eyebrow>Today's three</Eyebrow>
              <span className="text-[var(--ink-4)]"><Icon.HexFill size={6}/></span>
              <span className="text-[10px] mono text-[var(--ink-3)]">from PM review</span>
            </div>
          </div>
          <div className="space-y-2">
            {[
              { title: 'Draft Q3 OKRs', est: '45m', tag: 'Planning', state: 'now' },
              { title: 'Review pricing v3 deck', est: '30m', tag: 'Pricing', state: 'next' },
              { title: 'Reply to onboarding emails', est: '20m', tag: 'Inbox', state: 'later', resched: true },
            ].map((t, i) => (
              <div key={i} className={`card-2 p-3.5 flex items-center gap-3 ${t.state==='now' ? 'ring-1 ring-[rgba(240,180,41,0.25)]' : ''}`}>
                <div className="w-8 h-9 grid place-items-center relative" style={{ color: t.state==='now' ? 'var(--honey)' : 'var(--ink-4)' }}>
                  <Icon.Hex size={32}/>
                  <span className="absolute mono tnum text-[12px] font-semibold">{i+1}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-[14px] font-medium leading-tight truncate">{t.title}</div>
                  <div className="flex items-center gap-2 mt-1 text-[11px] text-[var(--ink-3)] mono tnum">
                    <span>{t.est}</span><span className="text-[var(--ink-4)]">·</span><span className="font-sans">{t.tag}</span>
                    {t.resched && <span className="chip chip-red"><Icon.Warn size={10}/> rescheduled 3×</span>}
                  </div>
                </div>
                <button className="btn-ghost h-9 w-9 grid place-items-center"><Icon.Play size={12}/></button>
              </div>
            ))}
          </div>
        </section>

        {/* Habits horizontal */}
        <section className="mt-5">
          <div className="flex items-baseline justify-between mb-2.5">
            <Eyebrow>Habits</Eyebrow>
            <span className="text-[10px] mono text-[var(--ink-3)]">2 rescues available</span>
          </div>
          <div className="grid grid-cols-2 gap-2">
            {[
              { k:'read',    label:'Read',    goal: 3, unit:'pages·20' },
              { k:'walk',    label:'Walk',    goal: 1, unit:'15 min' },
              { k:'stretch', label:'Stretch', goal: 1, unit:'5 min' },
              { k:'water',   label:'Water',   goal: 8, unit:'glasses' },
            ].map(h => {
              const v = habits[h.k]; const complete = v>=h.goal;
              return (
                <button key={h.k} onClick={() => inc(h.k, h.goal)}
                  className="card p-3 text-left active:scale-[0.98] transition-transform">
                  <div className="flex items-center justify-between">
                    <div className="text-[12px] text-[var(--ink-2)]">{h.label}</div>
                    <span style={{ color: complete ? 'var(--honey)' : 'var(--ink-4)' }}>
                      {complete ? <Icon.HexFill size={11}/> : <Icon.Hex size={11}/>}
                    </span>
                  </div>
                  <div className="mt-1 flex items-baseline gap-1">
                    <span className="mono tnum text-[22px] font-semibold leading-none text-[var(--cream)]">{v}</span>
                    <span className="mono tnum text-[12px] text-[var(--ink-3)]">/ {h.goal}</span>
                  </div>
                  <div className="mt-2 flex items-center gap-2">
                    <div className="flex-1 h-1 rounded-full bg-[var(--line)] overflow-hidden">
                      <div className="h-full bg-[var(--honey)]" style={{ width: `${(v/h.goal)*100}%` }}></div>
                    </div>
                    <span className="text-[10px] mono text-[var(--ink-4)]">+1</span>
                  </div>
                </button>
              );
            })}
          </div>
        </section>

        {/* Reminders */}
        <section className="mt-5">
          <Eyebrow className="mb-2.5">Reminders</Eyebrow>
          <div className="space-y-2">
            <div className="card p-3 flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-[rgba(200,124,44,0.10)] text-[var(--amber)] grid place-items-center"><Icon.Clock/></div>
              <div className="flex-1">
                <div className="text-[13px]">Stand-up sync</div>
                <div className="mono tnum text-[11px] text-[var(--ink-3)]">in 18m · 14:00</div>
              </div>
              <span className="chip chip-amber">Soon</span>
            </div>
            <div className="card p-3 flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-[rgba(240,180,41,0.08)] text-[var(--honey)] grid place-items-center"><Icon.Flag/></div>
              <div className="flex-1">
                <div className="text-[13px]">Lab results follow-up</div>
                <div className="mono tnum text-[11px] text-[var(--ink-3)]">15:30 · 1h 48m</div>
              </div>
            </div>
          </div>
        </section>
      </div>

      {/* End Day */}
      <div className="absolute left-0 right-0 bottom-0 px-5 pb-6 pt-4"
        style={{ background: 'linear-gradient(180deg, rgba(14,12,10,0) 0%, rgba(14,12,10,0.97) 50%)' }}>
        <button className="btn-primary w-full h-14 flex items-center justify-center gap-2 text-[15px]">
          End day &amp; review
          <Icon.Arrow size={14}/>
        </button>
      </div>
    </Phone>
  );
}

window.VariationB = VariationB;
