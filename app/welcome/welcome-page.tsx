"use client";

import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import Image from "next/image";
import Link from "next/link";
import {
  ArrowDown, ArrowRight, ArrowUpRight, Bell, CalendarDays, Check, CheckCheck,
  ChevronDown, ClipboardCheck, Clock3, Coffee, Globe2, LayoutDashboard, Menu,
  MessageCircle, RotateCcw, Send, Sparkles, Users, X,
} from "lucide-react";
import { AIVision, FeatureDirectory, HeroWorkspace, WorkspacePreview } from "./workspace-previews";
import styles from "./welcome.module.css";

const team = [
  { name: "Maja Nilsson", initials: "MN", role: "Shift leader", tone: "sage" },
  { name: "Elias Andersson", initials: "EA", role: "Service", tone: "sand" },
  { name: "Sofia Lind", initials: "SL", role: "Service", tone: "rose" },
  { name: "Noah Karlsson", initials: "NK", role: "Rutin", tone: "blue" },
];

const weekShifts = [
  ["07–15", "07–15", null, "07–15", "10–18", null, "07–15"],
  ["11–17", null, "11–17", "11–17", "11–17", "11–17", null],
  [null, "14–22", "14–22", null, "14–22", "14–22", "14–22"],
  ["08–14", "08–14", "08–14", "08–14", null, null, "08–14"],
];

function Brand({ light = false }: { light?: boolean }) {
  return (
    <span className={`${styles.brand} ${light ? styles.brandLight : ""}`}>
      <svg viewBox="0 0 32 32" fill="none" aria-hidden="true">
        <path d="M6 7h8v8H6zM18 7h8v8h-8zM6 19h8v8H6z" fill="currentColor" />
        <path d="m21.5 17 6 6-6 6-6-6 6-6Z" fill="currentColor" opacity=".62" />
      </svg>
      skift<span className={styles.brandDot}>.</span>
    </span>
  );
}

function Avatar({ person, small = false }: { person: typeof team[number]; small?: boolean }) {
  return <span className={`${styles.avatar} ${styles[person.tone]} ${small ? styles.avatarSmall : ""}`}>{person.initials}</span>;
}

function HeroPreview({ onReplay }: { onReplay: () => void }) {
  return (
    <div className={styles.heroPreview} aria-label="Illustrative Skift product previews">
      <svg className={styles.heroConnections} viewBox="0 0 1100 340" fill="none" aria-hidden="true">
        <path d="M205 146 C270 146 265 40 350 40" pathLength="1" />
        <path d="M895 166 C830 166 835 60 750 60" pathLength="1" />
      </svg>
      <div className={`${styles.glassCard} ${styles.teamCard}`}>
        <div className={styles.glassCardHeading}><Users size={16} /> The team, together <span className={styles.liveDot} /></div>
        <div className={styles.heroTeamList}>
          {team.slice(0, 3).map((person) => (
            <div className={styles.heroTeamRow} key={person.name}>
              <Avatar person={person} small />
              <span><strong>{person.name.split(" ")[0]}</strong><small>{person.role}</small></span>
              <span className={styles.teamTime}>On shift</span>
            </div>
          ))}
        </div>
        <div className={styles.glassFoot}><CheckCheck size={14} /> People, roles, and shared progress.</div>
      </div>

      <div className={styles.heroSchedule}>
        <HeroWorkspace />
      </div>

      <div className={`${styles.glassCard} ${styles.aiCard}`}>
        <div className={styles.glassCardHeading}><Bell size={16} /> Activity, in the moment</div>
        <div className={styles.aiNote}>
          <span className={styles.aiNoteIcon}><Bell size={17} /></span>
          <p>Stock is running low.<br /><strong>Catch it before the rush.</strong></p>
          <div className={styles.aiShift}><span>Brioche buns</span><strong>Needs attention</strong></div>
        </div>
        <div className={styles.glassFoot}><Check size={14} /> The right information, in view.</div>
      </div>
      <div className={styles.heroPreviewCaption}><span>Illustrative workspace · cross-workspace AI is a product vision preview</span><button type="button" className={styles.heroReplay} onClick={onReplay}><RotateCcw size={11} /> Replay intro</button></div>
    </div>
  );
}

function SchedulePreview() {
  const [view, setView] = useState<"week" | "day">("week");
  return (
    <div className={styles.scheduleApp}>
      <div className={styles.previewToolbar}>
        <div><span className={styles.appEyebrow}>THE RESTAURANT</span><h3>{view === "week" ? "A good week starts here." : "Wednesday, at a glance."}</h3></div>
        <div className={styles.segmented} aria-label="Schedule view">
          <button type="button" aria-pressed={view === "week"} onClick={() => setView("week")}>Week</button>
          <button type="button" aria-pressed={view === "day"} onClick={() => setView("day")}>Day</button>
        </div>
      </div>
      <div className={styles.scheduleScroll} tabIndex={0} aria-label="Example schedule, scroll horizontally on small screens">
        {view === "week" ? (
          <div className={styles.weekGrid}>
            <div className={styles.gridCorner}><Users size={14} /> Your team <span>4</span></div>
            {["MON 26", "TUE 27", "WED 28", "THU 29", "FRI 30", "SAT 31", "SUN 01"].map((day, i) => <div className={`${styles.gridDay} ${i === 2 ? styles.gridToday : ""}`} key={day}>{day.split(" ")[0]}<strong>{day.split(" ")[1]}</strong></div>)}
            {team.map((person, i) => (
              <div className={styles.gridRow} key={person.name}>
                <div className={styles.gridPerson}><Avatar person={person} small /><span><strong>{person.name}</strong><small>{person.role}</small></span></div>
                {weekShifts[i].map((time, d) => <div className={`${styles.gridCell} ${d === 2 ? styles.gridCellToday : ""}`} key={d}>{time ? <div className={`${styles.shiftBlock} ${styles[person.tone]}`}><strong>{time}</strong><span>{person.role}</span></div> : <span className={styles.dayOff}>—</span>}</div>)}
              </div>
            ))}
          </div>
        ) : (
          <div className={styles.dayGrid}>
            <div className={styles.dayHeader}><span>Your team</span><div>{["06:00", "10:00", "14:00", "18:00", "22:00"].map(time => <span key={time}>{time}</span>)}</div></div>
            {team.map((person, i) => <div className={styles.dayRow} key={person.name}><div className={styles.gridPerson}><Avatar person={person} small /><span><strong>{person.name}</strong><small>{person.role}</small></span></div><div className={styles.dayTrack}>{i !== 0 ? <div className={`${styles.dayShift} ${styles[person.tone]}`} style={{ left: `${[0, 31.25, 50, 12.5][i]}%`, width: `${[0, 37.5, 50, 37.5][i]}%` }}>{["", "11:00–17:00", "14:00–22:00", "08:00–14:00"][i]}</div> : <span className={styles.dayOff}>Day off</span>}</div></div>)}
          </div>
        )}
      </div>
      <div className={styles.previewBottom}><span><span className={styles.statusDot} /> A clear view for the whole team</span><span>26 Oct – 1 Nov · Example schedule</span></div>
    </div>
  );
}

function AttendancePreview() {
  const [clockedIn, setClockedIn] = useState([true, true, false, false]);
  return (
    <div className={styles.attendanceApp}>
      <div className={styles.previewToolbar}><div><span className={styles.appEyebrow}>THE RESTAURANT · WEB PUNCH</span><h3>Hello, team. Let’s get started.</h3></div><span className={styles.attendanceCount}><span className={styles.statusDot} /> {clockedIn.filter(Boolean).length} clocked in</span></div>
      <div className={styles.punchGrid}>
        {team.map((person, i) => <div className={styles.punchCard} key={person.name}><Avatar person={person} /><strong>{person.name}</strong><span>{person.role}</span><div key={String(clockedIn[i])} className={styles.punchStatus}><span className={clockedIn[i] ? styles.statusDot : styles.offlineDot} />{clockedIn[i] ? "On shift" : "Ready when you are"}</div><button type="button" className={clockedIn[i] ? styles.punchOut : styles.punchIn} onClick={() => setClockedIn(prev => prev.map((value, index) => index === i ? !value : value))}><Clock3 size={14} />{clockedIn[i] ? "Clock out" : "Clock in"}<span className={styles.srOnly}> {person.name} in the preview</span></button></div>)}
      </div>
      <div className={styles.previewBottom}><span><Clock3 size={13} /> A simple start and finish to every shift</span><span>Interactive preview · No attendance records are saved</span></div>
    </div>
  );
}

function ChatPreview() {
  const [draft, setDraft] = useState("");
  const [messages, setMessages] = useState<string[]>([]);
  return (
    <div className={styles.chatApp}>
      <aside className={styles.chatSidebar}><Brand /><span>TEAM CHANNELS</span><div className={styles.channelActive}># the-whole-team <span>4</span></div><div># shift-leaders</div><div># announcements</div><div className={styles.chatSidebarFoot}><span className={styles.statusDot} /> One team. In the loop.</div></aside>
      <div className={styles.chatMain}>
        <div className={styles.chatHeader}><strong># the-whole-team</strong><span><Users size={14} /> 4 members</span></div>
        <div className={styles.chatMessages} aria-live="polite">
          <span className={styles.chatDate}>A LITTLE LESS BACK-AND-FORTH</span>
          <div className={styles.chatMessage}><Avatar person={team[0]} small /><div><strong>Maja <span>10:42</span></strong><p>Lunch team, we’re ready for you. Opening checklist is done. 👌</p></div></div>
          <div className={styles.chatMessage}><Avatar person={team[1]} small /><div><strong>Elias <span>10:44</span></strong><p>On my way. I’ll check the stock before service.</p></div></div>
          {messages.map((message, i) => <div className={styles.chatMessage} key={i}><span className={`${styles.avatar} ${styles.avatarSmall} ${styles.sage}`}>YO</span><div><strong>You <span>Just now</span></strong><p>{message}</p></div></div>)}
        </div>
        <form className={styles.chatComposer} onSubmit={event => { event.preventDefault(); if (draft.trim()) { setMessages(prev => [...prev.slice(-2), draft.trim()]); setDraft(""); } }}><input aria-label="Try a message in this local preview" placeholder="Try a message in this preview…" value={draft} maxLength={180} onChange={event => setDraft(event.target.value)} /><button type="submit" aria-label="Add message to preview" disabled={!draft.trim()}><Send size={16} /></button></form>
        <p className={styles.chatNote}>Interactive preview · Messages stay on this page</p>
      </div>
    </div>
  );
}

const productTabs = [
  { title: "Workspace", icon: LayoutDashboard, description: "Start with the whole picture: people, tasks, timely alerts, and personal achievements. Try completing a task or celebrating a teammate." },
  { title: "Scheduling", icon: CalendarDays, description: "Plan one part of the bigger picture. See shifts, roles, hours, and coverage together, with AI draft generation in the app." },
  { title: "Attendance", icon: Clock3, description: "Give the team a simple clock-in and clock-out kiosk, then review actual time alongside scheduled shifts." },
  { title: "Communication", icon: MessageCircle, description: "Keep the conversation close to the work. Share updates in team channels so everyone knows what comes next." },
];

const faqs = [
  { question: "What can our team manage in Skift?", answer: "Skift brings scheduling, team profiles, communication, a social feed, tasks, checklists, attendance, alerts, inventory, sales views, forms, shift logs, and reporting into one restaurant workspace. It is built for managers, shift leaders, and employees to work from a shared picture of the day." },
  { question: "How does AI help across the workspace?", answer: "The product vision is for AI agents to understand a request, bring together the relevant workspace context, and prepare useful next steps — a schedule, task plan, team update, report, or answer from a document. You review what is prepared and decide how to proceed, with less searching and manual coordination." },
  { question: "Which AI features are available today?", answer: "AI schedule drafting is available in the current app. The broader examples on this page are labelled Product vision preview: AI assistance across tasks, messages, activity, reports, and documents. Full document management and custom report creation are also part of that vision." },
  { question: "Can we use Skift across several restaurants?", answer: "Yes. Regional managers with super-admin access can switch between locations. Each branch has its own employees and schedules, giving managers a focused view of their restaurant." },
  { question: "How does the attendance kiosk work?", answer: "Open your restaurant’s Web Punch link on a shared device. Employees select their name and confirm a clock-in or clock-out. Managers can review attendance records and compare actual time with scheduled shifts." },
  { question: "How do I access my workspace?", answer: "Use Open Skift to sign in with your team account. If you haven’t been given access yet, contact your workspace administrator to arrange your account." },
];

export default function WelcomePage() {
  const heroRef = useRef<HTMLElement>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [activeTab, setActiveTab] = useState(0);
  const [tabDirection, setTabDirection] = useState("forward");
  function selectTab(next: number) {
    setTabDirection(next < activeTab ? "backward" : "forward");
    setActiveTab(next);
  }
  useEffect(() => {
    const observer = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          (entry.target as HTMLElement).dataset.revealed = "true";
          observer.unobserve(entry.target);
        }
      });
    }, { threshold: 0.08 });
    document.querySelectorAll("[data-reveal]").forEach(element => observer.observe(element));
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const context = document.getElementById("why-skift");
    const reveal = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting && context) {
        context.dataset.revealed = "true";
        reveal.disconnect();
      }
    }, { threshold: 0.15 });
    if (context) reveal.observe(context);
    const hero = heroRef.current;
    if (!hero) return;
    let inView = true;
    const updatePlayback = () => {
      hero.dataset.motionPaused = String(!inView || document.hidden);
    };
    const observer = new IntersectionObserver(([entry]) => {
      inView = entry.isIntersecting;
      updatePlayback();
    });
    observer.observe(hero);
    document.addEventListener("visibilitychange", updatePlayback);
    updatePlayback();
    return () => {
      observer.disconnect();
      reveal.disconnect();
      document.removeEventListener("visibilitychange", updatePlayback);
    };
  }, []);

  function replayHero() {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    heroRef.current?.getAnimations({ subtree: true }).forEach(animation => {
      // Only restart the entrance timeline, never hover/focus transitions.
      if (animation instanceof CSSAnimation) animation.currentTime = 0;
    });
  }

  function handleTabKey(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    let next = index;
    if (event.key === "ArrowRight") next = (index + 1) % productTabs.length;
    else if (event.key === "ArrowLeft") next = (index - 1 + productTabs.length) % productTabs.length;
    else if (event.key === "Home") next = 0;
    else if (event.key === "End") next = productTabs.length - 1;
    else return;
    event.preventDefault();
    selectTab(next);
    const buttons = event.currentTarget.parentElement?.querySelectorAll<HTMLButtonElement>('[role="tab"]');
    buttons?.[next]?.focus();
  }

  return (
    <div className={styles.page}>
      <a href="#main-content" className={styles.skipLink}>Skip to content</a>
      <section ref={heroRef} className={styles.hero} aria-labelledby="hero-title">
        <div className={styles.heroLight} aria-hidden="true" />
        <div className={styles.heroHalo} aria-hidden="true" />
        <div className={styles.heroGrain} aria-hidden="true" />
        <header className={styles.header}>
          <a href="#" className={styles.brandLink} aria-label="Skift home"><Brand light /></a>
          <nav className={styles.desktopNav} aria-label="Main navigation"><a href="#product">The workspace</a><a href="#ai-workspace">AI assistance</a><a href="#questions">Questions</a></nav>
          <div className={styles.headerActions}><Link href="/login" className={styles.loginLink}>Sign in</Link><Link href="/login" className={styles.navCta}>Open Skift <ArrowUpRight size={14} /></Link><button className={styles.menuButton} type="button" aria-label={menuOpen ? "Close menu" : "Open menu"} aria-expanded={menuOpen} aria-controls="mobile-navigation" onClick={() => setMenuOpen(!menuOpen)}>{menuOpen ? <X size={22} /> : <Menu size={22} />}</button></div>
          {menuOpen && <nav id="mobile-navigation" className={styles.mobileNav} aria-label="Mobile navigation">{[["The workspace", "#product"], ["AI assistance", "#ai-workspace"], ["Questions", "#questions"]].map(([label, href]) => <a key={href} href={href} onClick={() => setMenuOpen(false)}>{label}<ArrowUpRight size={16} /></a>)}<Link href="/login">Sign in <ArrowRight size={16} /></Link></nav>}
        </header>

        <div className={styles.heroContent} id="main-content" tabIndex={-1}>
          <div className={styles.heroEyebrow}><span /> THE AI-POWERED RESTAURANT WORKSPACE</div>
          <h1 id="hero-title"><span className={styles.heroTitleLine}><span>Your restaurant.</span></span>{" "}<span className={styles.heroTitleLine}><span>One AI workspace.</span></span></h1>
          <p>Bring your people, communication, and daily work together.<br className={styles.desktopBreak} /> Let AI help turn what needs doing into the next clear step.</p>
          <div className={styles.heroActions}><a href="#product" className={styles.primaryButton}>Explore the workspace <ArrowRight size={16} /></a><a href="#ai-workspace" className={styles.heroTextLink}>See the AI vision <ArrowUpRight size={15} /></a></div>
        </div>
        <HeroPreview onReplay={replayHero} />
      </section>

      <main>
        <div className={styles.capabilities}><p>Your whole workplace.<br /><strong>One shared space.</strong></p><div><Sparkles size={19} /><span>AI assistance</span></div><div><Users size={19} /><span>People & teams</span></div><div><MessageCircle size={19} /><span>Communication & culture</span></div><div><ClipboardCheck size={19} /><span>Work & operations</span></div></div>

        <section id="why-skift" className={`${styles.container} ${styles.whySection}`} aria-labelledby="why-title">
          <div className={styles.whyCopy}>
            <span className={styles.eyebrow}>LESS MANUAL WORK. A CLEARER WAY FORWARD.</span>
            <h2 id="why-title">Less figuring it out.<br />More moving forward.</h2>
            <p>Who’s working? What needs attention? Where’s the update? Skift brings the people, information, and work of restaurant life into one workspace — with a vision for AI help at every step.</p>
            <div className={styles.benefits}>
              <div><LayoutDashboard /><h3>One shared picture</h3><p>Bring team activity, outstanding work, and alerts into view.</p></div>
              <div><Sparkles /><h3>AI with a purpose</h3><p>From schedule drafts today to wider workspace assistance in the vision.</p></div>
              <div><ClipboardCheck /><h3>Work with a clear next step</h3><p>Keep tasks, routines, forms, and handovers organised.</p></div>
              <div><MessageCircle /><h3>A team that feels connected</h3><p>Coordinate the work and celebrate the people doing it.</p></div>
            </div>
            <a href="#ai-workspace" className={styles.textLink}>See how the AI vision connects the work <ArrowRight size={16} /></a>
          </div>
          <div className={styles.teamPhoto}>
            <Image src="/images/skift-restaurant-team.webp" alt="Restaurant shift leader reviewing a tablet while a teammate prepares for service" fill sizes="(max-width: 760px) 100vw, 48vw" />
            <div className={styles.photoTag}><span className={styles.liveDot} /> MADE FOR RESTAURANT LIFE</div>
            <div className={styles.photoOverlay}><span className={styles.photoOverlayIcon}><Coffee size={22} /></span><div><small>LESS ADMIN BETWEEN YOU AND YOUR TEAM</small><strong>More room for people.</strong></div><Check size={19} /></div>
          </div>
        </section>

        <AIVision />

        <section id="product" className={`${styles.container} ${styles.productSection}`} aria-labelledby="product-title">
          <div data-reveal="" className={styles.sectionHeading}><span className={styles.eyebrow}>WORKSPACE MANAGEMENT, FROM OPEN TO CLOSE</span><h2 id="product-title">Your whole restaurant.<br />Working as one.</h2><p>People, conversations, everyday work, and the information behind it.<br />Everything has a place — and a direction for AI to help.</p></div>
          <FeatureDirectory />
          <div data-reveal="" className={styles.tourHeading}><span className={styles.eyebrow}>EXPLORE THE WORKSPACE</span><h3>Start with the picture. Get into the work.</h3><p>Try the illustrative overview, then explore a few of the tools behind it.</p></div>
          <div className={styles.productTabs} role="tablist" aria-label="Explore Skift features">
            {productTabs.map((tab, i) => <button key={tab.title} id={`product-tab-${i}`} type="button" role="tab" aria-selected={activeTab === i} aria-controls={`product-panel-${i}`} tabIndex={activeTab === i ? 0 : -1} onKeyDown={event => handleTabKey(event, i)} onClick={() => selectTab(i)}><tab.icon size={17} />{tab.title}<span className={styles.tabNumber}>0{i + 1}</span></button>)}
          </div>
          <div key={activeTab} data-direction={tabDirection} id={`product-panel-${activeTab}`} role="tabpanel" aria-labelledby={`product-tab-${activeTab}`} tabIndex={0} className={styles.productPanel}>
            <div className={styles.panelIntro}><p>{productTabs[activeTab].description}</p><span>TAKE A LOOK AROUND <ArrowDown size={13} /></span></div>
            {activeTab === 0 ? <WorkspacePreview /> : activeTab === 1 ? <SchedulePreview /> : activeTab === 2 ? <AttendancePreview /> : <ChatPreview />}
          </div>

        </section>

        <section data-reveal="" className={`${styles.container} ${styles.builtForSection}`} aria-label="Made for your team">
          <div><span className={styles.builtIcon}><Coffee size={22} /></span><h3>Restaurant life, understood.</h3><p>Built around the rhythm of quick-service teams in Sweden.</p></div>
          <div><span className={styles.builtIcon}><Globe2 size={22} /></span><h3>Your team’s language.</h3><p>English or Svenska. Make your workspace feel familiar.</p></div>
          <div><span className={styles.builtIcon}><Users size={22} /></span><h3>One team. Or a few.</h3><p>A focused view of each branch, with room for regional managers.</p></div>
        </section>

        <section data-reveal="" id="questions" className={`${styles.container} ${styles.faqSection}`} aria-labelledby="faq-title"><div><span className={styles.eyebrow}>A LITTLE MORE CLARITY</span><h2 id="faq-title">Good questions.<br />Straight answers.</h2><p>Getting to know Skift? Start here.</p></div><div className={styles.faqList}>{faqs.map(faq => <details key={faq.question}><summary>{faq.question}<ChevronDown size={17} /></summary><div className={styles.faqAnswer}><p>{faq.answer}</p></div></details>)}</div></section>

        <section data-reveal="" className={`${styles.container} ${styles.finalCta}`} aria-labelledby="cta-title"><div className={styles.ctaOrbit} aria-hidden="true" /><span className={styles.ctaIcon}><Brand light /></span><span className={styles.eyebrow}>LESS EXHAUSTING WORK. MORE HUMAN WORK.</span><h2 id="cta-title">One workspace.<br />More room to do your best.</h2><p>Your people, your operations, and a clearer next step.</p><Link href="/login" className={styles.primaryButton}>Open your workspace <ArrowRight size={16} /></Link><span className={styles.ctaSmall}>For managers, shift leaders, and the whole restaurant team.</span></section>
      </main>

      <footer className={`${styles.container} ${styles.footer}`}><div><a href="#" aria-label="Back to top"><Brand /></a><p>A shared workspace for restaurant life.</p></div><nav aria-label="Footer navigation"><a href="#product">The workspace</a><a href="#ai-workspace">AI assistance</a><Link href="/login">Sign in <ArrowUpRight size={13} /></Link></nav><span>© {new Date().getFullYear()} Skift</span></footer>
    </div>
  );
}
