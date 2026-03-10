'use client';
import Link from 'next/link';
import { useApp } from '@/context/AppContext';
import { Nav } from '@/components/Nav';

// Mini grid mockup — shows a small calendar preview
function MiniGrid({ cells, colors, label }: { cells: number[][]; colors: string[]; label: string }) {
  const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'];
  return (
    <div className="rounded-lg p-3" style={{ background: 'var(--card-bg)', border: '1px solid var(--border)' }}>
      <p className="text-xs font-medium mb-2" style={{ color: 'var(--foreground)' }}>{label}</p>
      <div className="flex gap-0.5">
        <div className="flex flex-col gap-0.5 pr-1" style={{ fontSize: '0.5rem', color: 'var(--subtle)', paddingTop: 12 }}>
          {['9', '10', '11', '12', '1', '2'].map(h => (
            <div key={h} style={{ height: 8, lineHeight: '8px' }}>{h}</div>
          ))}
        </div>
        {days.map((d, ci) => (
          <div key={d} className="flex flex-col gap-0.5">
            <div className="text-center" style={{ fontSize: '0.5rem', color: 'var(--subtle)', marginBottom: 1 }}>{d}</div>
            {[0, 1, 2, 3, 4, 5].map(ri => {
              const cellColors: string[] = [];
              cells.forEach((row, pi) => {
                if (row[ci * 6 + ri]) cellColors.push(colors[pi]);
              });
              const bg = cellColors.length === 0
                ? 'var(--slot-free)'
                : cellColors.length === 1
                  ? cellColors[0]
                  : `linear-gradient(to right, ${cellColors.map((c, i) => `${c} ${i * 100 / cellColors.length}% ${(i + 1) * 100 / cellColors.length}%`).join(', ')})`;
              return (
                <div
                  key={ri}
                  style={{
                    width: 18,
                    height: 8,
                    borderRadius: 2,
                    background: bg,
                    border: cellColors.length === 0 ? '1px solid var(--border)' : 'none',
                  }}
                />
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}

// Personal calendar mock data — one person's busy slots
const personalCells = [
  //Mon          Tue          Wed          Thu          Fri
  [1,1,0,0,0,0, 0,0,1,1,0,0, 1,1,1,0,0,0, 0,0,0,1,1,0, 0,1,1,0,0,0],
];

// Group calendar mock data — 3 people
const groupCells = [
  [1,1,0,0,0,0, 0,0,1,0,0,0, 1,0,0,0,0,0, 0,0,0,1,1,0, 0,1,0,0,0,0],
  [0,1,1,0,0,0, 0,0,1,1,0,0, 0,0,0,0,0,0, 0,0,1,1,0,0, 0,0,1,0,0,0],
  [0,0,0,0,0,0, 0,1,1,0,0,0, 1,1,0,0,0,0, 0,0,0,0,1,0, 1,1,0,0,0,0],
];

const groupColors = [
  'hsl(25, 35%, 65%)',
  'hsl(210, 35%, 65%)',
  'hsl(150, 35%, 65%)',
];

export default function Home() {
  const { state, hydrated } = useApp();
  const hasGroups = state.groups.length > 0;

  if (!hydrated) {
    return (
      <>
        <Nav />
        <main className="page-container page-container--narrow" />
      </>
    );
  }

  return (
    <>
      <Nav />
      <main className="page-container" style={{ maxWidth: '40rem', paddingTop: '5rem' }}>
        <h1 className="text-2xl font-semibold tracking-tight mb-2" style={{ color: 'var(--foreground)' }}>
          CalShare
        </h1>
        <p className="text-sm mb-8" style={{ color: 'var(--subtle)' }}>
          Share your availability. Find a time that works.
        </p>

        <div className="flex flex-col gap-3 mb-10" style={{ maxWidth: '16rem' }}>
          <Link href={state.sessionId ? `/me?id=${state.sessionId}` : '/me'} className="btn btn-primary" style={{ justifyContent: 'center' }}>
            My Calendar
          </Link>

          {hasGroups && (
            <div className="flex flex-col gap-1.5 mt-4">
              <p className="text-xs font-medium" style={{ color: 'var(--subtle)' }}>Your groups</p>
              {state.groups.map((g) => (
                <Link
                  key={g.sessionId}
                  href={`/group?id=${g.sessionId}`}
                  className="text-sm px-3 py-2 rounded-lg transition-colors"
                  style={{ background: 'var(--card-bg)', border: '1px solid var(--border)', color: 'var(--foreground)' }}
                >
                  {g.name}
                </Link>
              ))}
            </div>
          )}
        </div>

        <section style={{ color: 'var(--muted)' }}>
          <h2 className="text-sm font-semibold mb-4" style={{ color: 'var(--foreground)' }}>How it works</h2>

          <div className="flex flex-col gap-6">
            <div className="flex gap-4 items-start">
              <div className="flex-1">
                <p className="text-sm mb-1"><strong style={{ color: 'var(--foreground)' }}>1. Mark your busy hours</strong></p>
                <p className="text-sm" style={{ lineHeight: 1.6 }}>Drag on the calendar grid to toggle time slots as busy or free.</p>
              </div>
              <div className="flex-shrink-0">
                <MiniGrid cells={personalCells} colors={['var(--slot-busy)']} label="My calendar" />
              </div>
            </div>

            <div className="flex gap-4 items-start">
              <div className="flex-1">
                <p className="text-sm mb-1"><strong style={{ color: 'var(--foreground)' }}>2. Create or join a group</strong></p>
                <p className="text-sm" style={{ lineHeight: 1.6 }}>Share the link so others can add their availability.</p>
              </div>
              <div className="flex-shrink-0">
                <div
                  className="rounded-lg px-3 py-2 flex items-center gap-2"
                  style={{ background: 'var(--card-bg)', border: '1px solid var(--border)' }}
                >
                  <span className="text-xs font-mono truncate" style={{ color: 'var(--subtle)', maxWidth: 80 }}>
                    calshare.app/g/x4kf
                  </span>
                  <span
                    className="text-xs font-medium px-2 py-0.5 rounded"
                    style={{ background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--foreground)' }}
                  >
                    Share
                  </span>
                </div>
              </div>
            </div>

            <div className="flex gap-4 items-start">
              <div className="flex-1">
                <p className="text-sm mb-1"><strong style={{ color: 'var(--foreground)' }}>3. See everyone at a glance</strong></p>
                <p className="text-sm" style={{ lineHeight: 1.6 }}>Colored cells show who is busy when. Hover a name to highlight their slots.</p>
              </div>
              <div className="flex-shrink-0">
                <MiniGrid cells={groupCells} colors={groupColors} label="Team sync" />
              </div>
            </div>

            <div className="flex gap-4 items-start">
              <div className="flex-1">
                <p className="text-sm mb-1"><strong style={{ color: 'var(--foreground)' }}>4. Suggest a meetup</strong></p>
                <p className="text-sm" style={{ lineHeight: 1.6 }}>Propose a time, then everyone picks the hours that work for them.</p>
              </div>
              <div className="flex-shrink-0">
                <div className="rounded-lg p-3" style={{ background: 'var(--card-bg)', border: '1px solid var(--border)', width: 148 }}>
                  <p className="text-xs font-medium mb-1" style={{ color: 'var(--foreground)' }}>Team lunch</p>
                  <p style={{ fontSize: '0.5625rem', color: 'var(--subtle)', marginBottom: 6 }}>
                    <span style={{ color: groupColors[0] }}>Alex</span>, <span style={{ color: groupColors[1] }}>Sam</span>, <span style={{ color: groupColors[2] }}>Jo</span>
                  </p>
                  <div className="flex gap-0.5">
                    {['W', 'T', 'F'].map((d, ci) => (
                      <div key={d} className="flex flex-col gap-0.5">
                        <div className="text-center" style={{ fontSize: '0.5rem', color: 'var(--subtle)', marginBottom: 1 }}>{d}</div>
                        {[0, 1, 2, 3].map(ri => {
                          const highlighted = (ci === 0 && (ri === 1 || ri === 2)) || (ci === 2 && ri === 1);
                          return (
                            <div
                              key={ri}
                              style={{
                                width: 18,
                                height: 8,
                                borderRadius: 2,
                                position: 'relative' as const,
                                background: highlighted ? 'rgba(192, 106, 24, 0.12)' : 'var(--slot-free)',
                                border: highlighted ? 'none' : '1px solid var(--border)',
                                boxShadow: highlighted ? 'inset 0 0 0 1px rgba(192, 106, 24, 0.4)' : 'none',
                              }}
                            >
                              {highlighted && groupColors.map((c, i) => (
                                <div
                                  key={i}
                                  style={{
                                    position: 'absolute',
                                    top: 1,
                                    right: 1 + i * 4,
                                    width: 4,
                                    height: 4,
                                    borderRadius: '50%',
                                    background: c,
                                    boxShadow: '0 0 0 0.5px rgba(255,255,255,0.8)',
                                  }}
                                />
                              ))}
                            </div>
                          );
                        })}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>
    </>
  );
}
