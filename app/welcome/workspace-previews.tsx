"use client";

import { useEffect, useRef, useState } from "react";
import {
  ArrowRight, Bell, Bot, CalendarDays, ChartNoAxesCombined, Check,
  CheckCheck, ClipboardCheck, Clock3, FileText, FolderOpen, Heart,
  LayoutDashboard, MessageCircle, Newspaper, Package, Sparkles, Trophy, Users,
} from "lucide-react";
import styles from "./welcome.module.css";

export function HeroWorkspace() {
  return (
    <>
      <div className={styles.miniToolbar}>
        <span className={styles.miniBrand}><LayoutDashboard size={17} /> Your restaurant, connected</span>
        <span className={styles.miniTag}>Workspace</span>
      </div>
      <div className={styles.heroMetrics}>
        <div><Users size={13} /><strong>4</strong><span>People on shift</span></div>
        <div><ClipboardCheck size={13} /><strong>3</strong><span>Tasks to finish</span></div>
        <div><Bell size={13} /><strong>1</strong><span>Needs attention</span></div>
      </div>
      <div className={styles.heroAssistant}><span><Sparkles size={14} /> YOUR AI WORKSPACE · VISION PREVIEW</span><p>“Help me get the team ready for lunch.”</p><div><span>Check coverage</span><ArrowRight size={10} /><span>Prepare tasks</span><ArrowRight size={10} /><span>Brief the team</span></div></div>
      <div className={styles.heroWorkspaceFoot}><CheckCheck size={12} /> People, work, and the next step. In one place.</div>
    </>
  );
}

export function WorkspacePreview() {
  const [done, setDone] = useState([true, false, false, false]);
  const [celebrated, setCelebrated] = useState(false);
  const tasks = ["Check opening stock", "Set up the service station", "Brief the lunch team", "Complete the shift handover"];

  return (
    <div className={styles.workspaceApp}>
      <aside className={styles.workspaceSidebar}>
        <div className={styles.workspaceIdentity}><span><LayoutDashboard size={17} /></span><strong>The restaurant<small>Your shared workspace</small></strong></div>
        <div className={styles.workspaceNavActive}><LayoutDashboard size={14} /> Overview</div>
        <div><CalendarDays size={14} /> Schedule</div><div><ClipboardCheck size={14} /> Tasks</div><div><MessageCircle size={14} /> Messages</div><div><Newspaper size={14} /> Team feed</div><div><ChartNoAxesCombined size={14} /> Reports</div>
        <span className={styles.workspaceSidebarNote}>ONE TEAM. A SHARED PICTURE.</span>
      </aside>
      <div className={styles.workspaceMain}>
        <div className={styles.workspaceTop}><div><span className={styles.appEyebrow}>YOUR WORKSPACE AT A GLANCE</span><h3>Good morning, Maja.</h3><p>Here’s what’s happening across your restaurant.</p></div><span className={styles.workspaceSample}>Illustrative workspace</span></div>
        <div className={styles.workspaceStats}><div><Users size={15} /><strong>4</strong><span>People on shift</span></div><div><ClipboardCheck size={15} /><strong>{done.filter(value => !value).length}</strong><span>Open tasks</span></div><div><Bell size={15} /><strong>1</strong><span>Stock alert</span></div><div><Trophy size={15} /><strong>1</strong><span>Team milestone</span></div></div>
        <div className={styles.workspaceCards}>
          <div className={styles.workspaceTasks}><div className={styles.workspaceCardTitle}><ClipboardCheck size={14} /><strong>Work that moves the day forward</strong></div>{tasks.map((task, i) => <button className={styles.workspaceTask} type="button" key={task} aria-pressed={done[i]} onClick={() => setDone(prev => prev.map((value, index) => index === i ? !value : value))}><span className={done[i] ? styles.checkedBox : styles.emptyBox}>{done[i] && <Check size={12} />}</span><span className={done[i] ? styles.completedTask : ""}>{task}</span><small>{i < 3 ? "Opening" : "Evening"}</small></button>)}</div>
          <div className={styles.achievementCard}><span className={styles.achievementLabel}><Newspaper size={13} /> FROM THE TEAM FEED</span><div className={styles.achievementPerson}><span className={`${styles.avatar} ${styles.avatarSmall} ${styles.rose}`}>SL</span><span><strong>Sofia Lind</strong><small>Shared a personal achievement</small></span></div><p>First week as a shift leader, complete! Thanks to everyone who helped me find my feet.</p><div className={styles.achievementMilestone}><Trophy size={18} /><span>Small wins. A stronger team.</span></div><button type="button" aria-pressed={celebrated} onClick={() => setCelebrated(!celebrated)}><Heart size={13} fill={celebrated ? "currentColor" : "none"} /> Celebrate <span>{celebrated ? 9 : 8}</span></button></div>
        </div>
        <div className={styles.workspaceAlert}><span><Bell size={15} /></span><div><strong>Stock needs a look before service</strong><p>Brioche buns are below the low-stock threshold.</p></div><small>Needs attention</small></div>
        <div className={styles.previewBottom}><span>Try completing a task or celebrating the team.</span><span>Preview changes stay on this page</span></div>
      </div>
    </div>
  );
}

const scenarios = [
  {
    label: "Prepare a shift", icon: ClipboardCheck,
    prompt: "Help me get the restaurant ready for Friday lunch.",
    context: ["Schedule", "Tasks", "Team channels"],
    title: "One request. A connected shift plan.",
    steps: [
      { icon: CalendarDays, title: "Review the coverage", detail: "Suggest a service shift where the lunch plan needs support.", output: "Schedule draft" },
      { icon: ClipboardCheck, title: "Prepare the work", detail: "Turn the opening routine into a checklist for the shift leader.", output: "Task checklist" },
      { icon: MessageCircle, title: "Get everyone in sync", detail: "Draft a short team brief with the plan and outstanding actions.", output: "Team update" },
    ],
  },
  {
    label: "Coordinate the team", icon: Users,
    prompt: "Help me hand over to the evening team and recognise today’s wins.",
    context: ["Shift notes", "Messages", "Social feed"],
    title: "A handover with the important things included.",
    steps: [
      { icon: FileText, title: "Bring the details together", detail: "Summarise shift notes, unfinished tasks, and changes worth sharing.", output: "Handover summary" },
      { icon: MessageCircle, title: "Prepare a clear update", detail: "Draft the next team’s briefing with owners and follow-up actions.", output: "Message draft" },
      { icon: Trophy, title: "Make room for recognition", detail: "Help write a feed post celebrating a teammate’s achievement.", output: "Recognition draft" },
    ],
  },
  {
    label: "Review activity", icon: Bell,
    prompt: "What needs my attention across the restaurant today?",
    context: ["Activity", "Stock", "Attendance"],
    title: "A clearer picture, with a way forward.",
    steps: [
      { icon: Bell, title: "Surface what matters", detail: "Bring stock warnings, unfinished work, and attendance exceptions together.", output: "Priority overview" },
      { icon: Bot, title: "Explain the context", detail: "Show why an item needs a look, with the relevant workspace information.", output: "Context & explanation" },
      { icon: ClipboardCheck, title: "Prepare the follow-up", detail: "Suggest a task, an owner, and a team update for your review.", output: "Action plan" },
    ],
  },
  {
    label: "Reports & documents", icon: FolderOpen,
    prompt: "Prepare a weekly report and find our closing procedure.",
    context: ["Reports", "Workspace records", "Documents"],
    title: "Less searching. Answers you can use.",
    steps: [
      { icon: ChartNoAxesCombined, title: "Shape the report around your question", detail: "Build a draft summary of the week’s hours, attendance, and operations.", output: "Custom report draft" },
      { icon: FolderOpen, title: "Find the right procedure", detail: "Locate the relevant document and point to the information you need.", output: "Document & source" },
      { icon: ClipboardCheck, title: "Turn information into next steps", detail: "Prepare a closing checklist from the procedure for someone to review.", output: "Suggested checklist" },
    ],
  },
];

export function AIVision() {
  const [active, setActive] = useState(0);
  const [stage, setStage] = useState(0);
  const [manual, setManual] = useState(false);
  const storyRef = useRef<HTMLDivElement>(null);
  const scenario = scenarios[active];
  useEffect(() => {
    const story = storyRef.current;
    if (!story) return;
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    let frame = 0;
    const update = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        if (manual || media.matches || window.innerWidth < 900 || window.innerHeight < 800) return;
        const rect = story.getBoundingClientRect();
        const progress = Math.max(0, Math.min(1, -rect.top / (rect.height - window.innerHeight)));
        setStage(Math.min(3, Math.floor(progress * 4)));
      });
    };
    window.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update);
    media.addEventListener("change", update);
    update();
    return () => { cancelAnimationFrame(frame); window.removeEventListener("scroll", update); window.removeEventListener("resize", update); media.removeEventListener("change", update); };
  }, [manual]);
  const stages = ["The goal", "The context", "Suggested work", "Your review"];
  const explanations = [
    "Start with what you need. No workflow to figure out first.",
    "AI brings the relevant workspace information together.",
    "Review the suggested outputs, prepared around your request.",
    "You decide what to use, adjust, or share with the team.",
  ];
  return (
    <section id="ai-workspace" className={`${styles.container} ${styles.aiVisionSection}`} aria-labelledby="ai-title">
      <div className={styles.aiVisionHeading}><div><span className={styles.visionBadge}><Sparkles size={12} /> PRODUCT VISION PREVIEW</span><h2 id="ai-title">Say what needs doing.<br />Let AI find the next steps.</h2></div><p>The vision is simple: AI agents that help across your workspace. Less manual planning, searching, writing, and chasing. More time for the team and the guests in front of you.</p></div>
      <div ref={storyRef} className={styles.aiStory}><div className={styles.aiSticky}><span className={styles.visionBadge}>PRODUCT VISION PREVIEW</span><div className={styles.aiScenarioButtons} role="group" aria-label="Explore AI workspace scenarios">{scenarios.map((item, i) => <button type="button" key={item.label} aria-pressed={active === i} onClick={() => { setActive(i); setStage(0); setManual(true); }}><item.icon size={15} />{item.label}</button>)}</div>
      <div className={styles.storyControls} role="group" aria-label="AI walkthrough steps">{stages.map((label, i) => <button key={label} type="button" aria-pressed={stage === i} onClick={() => { setStage(i); setManual(true); }}><span>0{i + 1}</span>{label}</button>)}<button type="button" onClick={() => { setStage(0); setManual(false); storyRef.current?.scrollIntoView({ behavior: "instant", block: "start" }); }}>Replay walkthrough</button></div>
      <p className={styles.storyExplanation} aria-live="polite">{explanations[stage]}</p>
      <div key={active} className={styles.aiVisionDemo} data-stage={stage}>
        <div className={styles.aiRequest}><span className={styles.aiRequestLabel}><Sparkles size={16} /> YOU BRING THE GOAL</span><p>“{scenario.prompt}”</p><div className={styles.aiContextLabel}>CONNECTED WORKSPACE CONTEXT</div><div className={styles.aiContextChips}>{scenario.context.map(item => <span key={item}>{item}</span>)}</div><div className={styles.aiHumanReview}><CheckCheck size={15} /><span>You review the plan.<br />You choose what happens next.</span></div></div>
        <div className={styles.aiPlan}><span className={styles.aiRequestLabel}><Bot size={16} /> SKIFT HELPS WORK OUT THE HOW</span><h3>{scenario.title}</h3><div className={styles.aiPlanSteps}>{scenario.steps.map((step, i) => <div key={step.title}><span className={styles.aiStepIcon}><step.icon size={17} /></span><div><span className={styles.aiStepNumber}>0{i + 1} / {step.output}</span><h4>{step.title}</h4><p>{step.detail}</p></div></div>)}</div><span className={styles.aiPlanFooter}>Illustrative workflow · prepared for human review</span></div>
      </div>
      </div></div><p className={styles.visionNote}><Sparkles size={13} /><span>AI scheduling is available today. These examples preview the wider vision for AI across tasks, communication, activity, reports, and documents.</span></p>
    </section>
  );
}

const features = [
  { icon: CalendarDays, title: "Scheduling", description: "Plan shifts around roles, coverage, and contracted hours. Review AI-generated schedule drafts.", ai: "Suggest balanced coverage", status: "AI drafting available" },
  { icon: MessageCircle, title: "Team communication", description: "Keep conversations, pinned updates, and day-to-day coordination in shared channels.", ai: "Draft briefs and handovers" },
  { icon: Bot, title: "AI agents", description: "The vision: describe a goal and get help working through it across your workspace.", ai: "Turn requests into practical plans", status: "Product vision preview" },
  { icon: Bell, title: "Activity & timely alerts", description: "Bring stock warnings, employee activity, and operational issues into view when they need attention.", ai: "Explain priorities and next steps" },
  { icon: Users, title: "Team management", description: "Keep employee profiles, roles, contract details, and branch teams organised in one place.", ai: "Help match people to the work" },
  { icon: Newspaper, title: "Social feed & achievements", description: "Share personal milestones, celebrate team wins, and recognise the people behind great service.", ai: "Help put recognition into words" },
  { icon: ClipboardCheck, title: "Tasks & checklists", description: "Assign the work, set due times, and follow opening routines through to completion.", ai: "Break goals into clear tasks" },
  { icon: Clock3, title: "Clock in & out", description: "Give employees a simple attendance kiosk and managers a view of scheduled versus actual time.", ai: "Help review attendance exceptions" },
  { icon: ChartNoAxesCombined, title: "Reports & insights", description: "Review operational and attendance reports today. Custom reports extend that picture in the vision.", ai: "Build a summary around your question", status: "Custom reports · vision" },
  { icon: FolderOpen, title: "Documents & knowledge", description: "The vision: organise restaurant procedures and documents, with help finding the right answer.", ai: "Find and explain the information", status: "Product vision preview" },
  { icon: FileText, title: "Custom forms & shift logs", description: "Create forms for your routines, collect submissions, and keep shift notes ready for the next team.", ai: "Summarise notes and submissions" },
  { icon: Package, title: "Inventory & sales", description: "Keep stock levels, low-stock signals, and daily sales views alongside the rest of your operations.", ai: "Make patterns easier to understand" },
];

const featureGroups = [
  { title: "People & culture", items: [4, 5] },
  { title: "Communication & alerts", items: [1, 3] },
  { title: "Daily work", items: [0, 6, 7, 10, 11] },
  { title: "Insights & knowledge", items: [2, 8, 9] },
];

export function FeatureDirectory() {
  const [selected, setSelected] = useState(0);
  return (
    <>
      <nav className={styles.featureNavigation} aria-label="Workspace feature groups" style={{ "--group-index": selected } as React.CSSProperties}>
        <span className={styles.groupIndicator} aria-hidden="true" />
        {featureGroups.map((group, index) => <a key={group.title} href={`#feature-group-${index}`} aria-current={selected === index ? "location" : undefined} onClick={() => setSelected(index)}>{group.title}</a>)}
      </nav>
      {featureGroups.map((group, index) => <section key={group.title} id={`feature-group-${index}`} className={styles.featureGroup} data-reveal="" aria-labelledby={`feature-heading-${index}`}>
        <h3 id={`feature-heading-${index}`}><span>0{index + 1}</span>{group.title}</h3>
        <div className={styles.featureDirectory}>{group.items.map(item => {
          const feature = features[item];
          return <article key={feature.title}><div className={styles.directoryIcon}><feature.icon size={21} /></div><h4>{feature.title}</h4><p>{feature.description}</p><div className={styles.directoryAI}><Sparkles size={12} /><span><strong>AI vision</strong>{feature.ai}</span></div>{feature.status && <span className={feature.status === "AI drafting available" ? styles.availableBadge : styles.directoryVisionBadge}>{feature.status}</span>}</article>;
        })}</div>
      </section>)}
      <p className={styles.directoryNote}>The AI ideas under each tool are product vision previews. Workspace features shown above reflect current tools except where a vision label is shown.</p>
    </>
  );
}
