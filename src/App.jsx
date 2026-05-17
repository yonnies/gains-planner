import React from "react";
import gymData from "../storage/gym_data.json";

// Global fallbacks if API hasn't loaded yet
const EXERCISE_LIBRARY = gymData.exerciseLibrary;
const GROUP_LABELS = gymData.groupLabels;
const DAY_TEMPLATES = gymData.dayTemplates;
// flat sorted list of all unique exercises for the knowledge library picker
const ALL_EXERCISES = [...new Set(Object.values(EXERCISE_LIBRARY).flat())].sort();

const STORAGE_KEY = "gym-split-v4";
const DAY_ACCENTS = { lowerA:"#E8FF47", upperA:"#47FFD4", lowerB:"#E8FF47", upperB:"#47FFD4" };
const DAY_INDEX   = { lowerA:1, upperA:2, lowerB:3, upperB:4 };

const WISDOM_CATEGORIES = ["Technique","Programming","Recovery","Nutrition","Mindset","General"];

// ─── State helpers ────────────────────────────────────────────────────────────
function buildDefault() {
  const days = {};
  for (const [key, tpl] of Object.entries(DAY_TEMPLATES)) {
    days[key] = { title:tpl.title, subtitle:tpl.subtitle, allGroups:[...tpl.allGroups], activeGroups:[...tpl.activeGroups], selected:{...tpl.selected} };
  }
  return { 
    days, 
    history: [], 
    exerciseNotes: { ...gymData.exerciseNotes }, 
    wisdomEntries: [],
    exerciseLibrary: { ...EXERCISE_LIBRARY }
  };
}

function loadState() {
  try { 
    const r = localStorage.getItem(STORAGE_KEY); 
    if (r) {
      const parsed = JSON.parse(r);
      // Ensure library is always up to date and merge new notes from JSON into local state
      parsed.exerciseLibrary = { ...EXERCISE_LIBRARY };
      parsed.exerciseNotes = { ...gymData.exerciseNotes, ...(parsed.exerciseNotes || {}) };
      return parsed;
    }
  } catch {}
  return buildDefault();
}

function extractYouTubeId(url) {
  if (!url) return null;
  const m = url.match(/(?:youtu\.be\/|v=|embed\/)([A-Za-z0-9_-]{11})/);
  return m ? m[1] : null;
}

// ─── Drag-to-reorder hook ─────────────────────────────────────────────────────
function useDragReorder(list, onReorder) {
  const dragItem = React.useRef(null);
  const dragOver = React.useRef(null);
  return {
    handleDragStart: i => { dragItem.current = i; },
    handleDragEnter: i => { dragOver.current = i; },
    handleDragEnd: () => {
      if (dragItem.current === null || dragOver.current === null || dragItem.current === dragOver.current) { dragItem.current = dragOver.current = null; return; }
      const copy = [...list]; const [moved] = copy.splice(dragItem.current, 1); copy.splice(dragOver.current, 0, moved);
      dragItem.current = dragOver.current = null; onReorder(copy);
    },
  };
}

// ─── GroupRow ─────────────────────────────────────────────────────────────────
function GroupRow({ group, library, value, onSelect, onDeactivate, dragHandlers, index }) {
  const exercises = library[group] || [];
  return (
    <div draggable onDragStart={() => dragHandlers.handleDragStart(index)} onDragEnter={() => dragHandlers.handleDragEnter(index)} onDragEnd={dragHandlers.handleDragEnd} onDragOver={e => e.preventDefault()}
      style={{ display:"flex", alignItems:"center", gap:8, padding:"9px 0", borderBottom:"1px solid #1C1C1C", userSelect:"none" }}>
      <div title="Drag to reorder" style={{ color:"#2E2E2E", fontSize:16, cursor:"grab", flexShrink:0, lineHeight:1 }}>⠿</div>
      <div style={{ fontFamily:"'Barlow Condensed',sans-serif", fontWeight:800, fontSize:11, letterSpacing:"0.1em", textTransform:"uppercase", color:"#555", width:86, flexShrink:0 }}>{GROUP_LABELS[group]}</div>
      <select className="ex-select" value={value || exercises[0]} onChange={e => onSelect(group, e.target.value)} onMouseDown={e => e.stopPropagation()} draggable={false}>
        {exercises.map(ex => <option key={ex} value={ex}>{ex}</option>)}
      </select>
      <button onClick={() => onDeactivate(group)} className="deact-btn">✕</button>
    </div>
  );
}

// ─── DayCard ──────────────────────────────────────────────────────────────────
function DayCard({ dayKey, day, library, onUpdate, accent }) {
  const [inactiveOpen, setInactiveOpen] = React.useState(false);
  const inactiveGroups = day.allGroups.filter(g => !day.activeGroups.includes(g));
  const activate   = g => onUpdate(dayKey, { activeGroups:[...day.activeGroups, g] });
  const deactivate = g => onUpdate(dayKey, { activeGroups:day.activeGroups.filter(x => x !== g) });
  const onSelect   = (g, v) => onUpdate(dayKey, { selected:{...day.selected, [g]:v} });
  const drag       = useDragReorder(day.activeGroups, newOrder => onUpdate(dayKey, { activeGroups:newOrder }));
  return (
    <div style={{ background:"#141414", border:"1px solid #242424", borderRadius:12, padding:"20px 18px", position:"relative", overflow:"hidden" }}>
      <div style={{ position:"absolute", right:12, top:6, fontFamily:"'Barlow Condensed',sans-serif", fontWeight:900, fontSize:68, lineHeight:1, opacity:0.055, pointerEvents:"none", color:"#fff", userSelect:"none" }}>{DAY_INDEX[dayKey]}</div>
      <div style={{ marginBottom:14 }}>
        <div style={{ display:"flex", alignItems:"center", gap:7, marginBottom:3 }}>
          <div style={{ width:6, height:6, borderRadius:"50%", background:accent, boxShadow:`0 0 8px ${accent}99`, flexShrink:0 }} />
          <span style={{ fontFamily:"'DM Mono',monospace", fontSize:10, color:"#444", letterSpacing:"0.08em" }}>Day {DAY_INDEX[dayKey]} of 4</span>
        </div>
        <div style={{ fontFamily:"'Barlow Condensed',sans-serif", fontWeight:900, fontSize:24, textTransform:"uppercase", letterSpacing:"0.01em", lineHeight:1.1 }}>{day.title}</div>
        <div style={{ fontFamily:"'DM Mono',monospace", fontSize:11, color:"#555", marginTop:2 }}>{day.subtitle}</div>
      </div>
      <div style={{ height:1, background:"#1E1E1E", marginBottom:2 }} />
      {day.activeGroups.map((group, i) => (
        <GroupRow key={group} group={group} library={library} value={day.selected[group] || library[group]?.[0]} onSelect={onSelect} onDeactivate={deactivate} dragHandlers={drag} index={i} />
      ))}
      {inactiveGroups.length > 0 && (
        <div style={{ marginTop:10 }}>
          <button onClick={() => setInactiveOpen(o => !o)} style={{ width:"100%", background:"#0A0A0A", border:"1px solid #1E1E1E", borderRadius:7, padding:"7px 12px", display:"flex", alignItems:"center", justifyContent:"space-between", cursor:"pointer", fontFamily:"'Barlow Condensed',sans-serif", fontWeight:800, fontSize:11, letterSpacing:"0.1em", textTransform:"uppercase", color:"#3A3A3A" }}>
            <span>Inactive Groups ({inactiveGroups.length})</span>
            <span style={{ display:"inline-block", transform:inactiveOpen?"rotate(180deg)":"none", transition:"transform 0.2s" }}>▾</span>
          </button>
          {inactiveOpen && (
            <div style={{ marginTop:4, background:"#0A0A0A", border:"1px solid #1A1A1A", borderRadius:7, overflow:"hidden" }}>
              {inactiveGroups.map((group, gi) => (
                <div key={group} style={{ display:"flex", alignItems:"center", justifyContent:"space-between", padding:"8px 12px", borderBottom:gi<inactiveGroups.length-1?"1px solid #141414":"none" }}>
                  <span style={{ fontFamily:"'Barlow Condensed',sans-serif", fontWeight:800, fontSize:11, letterSpacing:"0.1em", textTransform:"uppercase", color:"#3A3A3A" }}>{GROUP_LABELS[group]}</span>
                  <button onClick={() => activate(group)} className="add-btn">+ Add</button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── History View ─────────────────────────────────────────────────────────────
function HistoryView({ history, onBack, onRestore }) {
  return (
    <div style={{ padding:"28px" }}>
      <div style={{ display:"flex", alignItems:"center", gap:16, marginBottom:28, flexWrap:"wrap" }}>
        <button onClick={onBack} className="ghost-btn">← Back to Plan</button>
        <div>
          <div style={{ fontFamily:"'Barlow Condensed',sans-serif", fontWeight:900, fontSize:42, textTransform:"uppercase", lineHeight:1 }}>Workout <span style={{ color:"#E8FF47" }}>History</span></div>
          <div style={{ fontFamily:"'DM Mono',monospace", fontSize:11, color:"#555", marginTop:3 }}>{history.length} saved session{history.length!==1?"s":""}</div>
        </div>
      </div>
      {history.length === 0 ? (
        <div style={{ border:"1px dashed #1E1E1E", borderRadius:12, padding:"48px", textAlign:"center", color:"#3A3A3A", fontFamily:"'DM Mono',monospace", fontSize:13 }}>No sessions saved yet. Hit "Save to History" from your plan.</div>
      ) : (
        <div style={{ display:"flex", flexDirection:"column", gap:14 }}>
          {[...history].reverse().map((session, ri) => {
            const i = history.length - 1 - ri;
            return (
              <div key={session.savedAt} style={{ background:"#141414", border:"1px solid #222", borderRadius:12, padding:"18px 20px" }}>
                <div style={{ display:"flex", alignItems:"flex-start", justifyContent:"space-between", marginBottom:14, flexWrap:"wrap", gap:10 }}>
                  <div>
                    <div style={{ fontFamily:"'Barlow Condensed',sans-serif", fontWeight:900, fontSize:15, textTransform:"uppercase", letterSpacing:"0.06em", color:"#E8FF47" }}>Session #{i+1}</div>
                    <div style={{ fontFamily:"'DM Mono',monospace", fontSize:11, color:"#555", marginTop:2 }}>{new Date(session.savedAt).toLocaleDateString("en-GB",{weekday:"short",day:"numeric",month:"short",year:"numeric",hour:"2-digit",minute:"2-digit"})}</div>
                  </div>
                  <button onClick={() => onRestore(i)} className="restore-btn">Restore Plan</button>
                </div>
                <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(200px,1fr))", gap:8 }}>
                  {Object.entries(session.days).map(([dayKey, day]) => (
                    <div key={dayKey} style={{ background:"#0D0D0D", border:"1px solid #1C1C1C", borderRadius:8, padding:"10px 12px" }}>
                      <div style={{ fontFamily:"'Barlow Condensed',sans-serif", fontWeight:900, fontSize:12, textTransform:"uppercase", letterSpacing:"0.08em", color:"#555", marginBottom:6 }}>{day.title}</div>
                      {day.activeGroups.map(group => (
                        <div key={group} style={{ display:"flex", justifyContent:"space-between", alignItems:"baseline", padding:"3px 0", borderBottom:"1px solid #141414", gap:8 }}>
                          <span style={{ fontFamily:"'DM Mono',monospace", fontSize:9, color:"#3A3A3A", textTransform:"uppercase", letterSpacing:"0.06em", flexShrink:0 }}>{GROUP_LABELS[group]}</span>
                          <span style={{ fontFamily:"'DM Mono',monospace", fontSize:10, color:"#777", textAlign:"right" }}>{day.selected[group]}</span>
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── YouTube Embed ────────────────────────────────────────────────────────────
function YouTubeThumbnail({ url, onRemove }) {
  const id = extractYouTubeId(url);
  if (!id) return null;
  return (
    <div style={{ position:"relative", borderRadius:8, overflow:"hidden", border:"1px solid #222" }}>
      <a href={`https://www.youtube.com/watch?v=${id}`} target="_blank" rel="noreferrer" style={{ display:"block" }}>
        <img src={`https://img.youtube.com/vi/${id}/mqdefault.jpg`} alt="video" style={{ width:"100%", display:"block", aspectRatio:"16/9", objectFit:"cover" }} />
        <div style={{ position:"absolute", inset:0, display:"flex", alignItems:"center", justifyContent:"center", background:"rgba(0,0,0,0.35)", transition:"background 0.15s" }}
          onMouseEnter={e => e.currentTarget.style.background="rgba(0,0,0,0.15)"}
          onMouseLeave={e => e.currentTarget.style.background="rgba(0,0,0,0.35)"}>
          <div style={{ width:44, height:44, background:"rgba(232,255,71,0.92)", borderRadius:"50%", display:"flex", alignItems:"center", justifyContent:"center" }}>
            <svg width="16" height="16" viewBox="0 0 16 16" fill="#0D0D0D"><path d="M6 3.5l7 4.5-7 4.5V3.5z"/></svg>
          </div>
        </div>
      </a>
      {onRemove && (
        <button onClick={onRemove} style={{ position:"absolute", top:6, right:6, background:"rgba(13,13,13,0.8)", border:"none", color:"#888", width:22, height:22, borderRadius:"50%", cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center", fontSize:12, lineHeight:1 }}>✕</button>
      )}
    </div>
  );
}

// ─── Exercise Notes Modal ─────────────────────────────────────────────────────
function ExerciseModal({ name, data, onSave, onClose }) {
  const [notes, setNotes] = React.useState(data?.notes || "");
  const [videoUrl, setVideoUrl] = React.useState("");
  const [videos, setVideos] = React.useState(data?.videos || []);

  const addVideo = () => {
    const trimmed = videoUrl.trim();
    if (!trimmed) return;
    const id = extractYouTubeId(trimmed);
    if (!id) { alert("Paste a valid YouTube URL"); return; }
    setVideos(v => [...v, trimmed]);
    setVideoUrl("");
  };

  const save = () => { onSave({ notes, videos }); onClose(); };

  return (
    <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.75)", zIndex:100, display:"flex", alignItems:"center", justifyContent:"center", padding:20 }} onClick={onClose}>
      <div style={{ background:"#161616", border:"1px solid #2A2A2A", borderRadius:14, width:"100%", maxWidth:560, maxHeight:"90vh", overflowY:"auto", padding:"28px" }} onClick={e => e.stopPropagation()}>
        <div style={{ display:"flex", alignItems:"flex-start", justifyContent:"space-between", marginBottom:22 }}>
          <div>
            <div style={{ fontFamily:"'DM Mono',monospace", fontSize:10, color:"#444", letterSpacing:"0.08em", marginBottom:4 }}>EXERCISE NOTES</div>
            <div style={{ fontFamily:"'Barlow Condensed',sans-serif", fontWeight:900, fontSize:26, textTransform:"uppercase", lineHeight:1 }}>{name}</div>
          </div>
          <button onClick={onClose} style={{ background:"none", border:"none", color:"#555", cursor:"pointer", fontSize:20, lineHeight:1, paddingTop:2 }}>✕</button>
        </div>

        {/* Notes */}
        <div style={{ marginBottom:22 }}>
          <div style={{ fontFamily:"'Barlow Condensed',sans-serif", fontWeight:800, fontSize:11, letterSpacing:"0.1em", textTransform:"uppercase", color:"#555", marginBottom:8 }}>Personal Notes</div>
          <textarea
            value={notes} onChange={e => setNotes(e.target.value)}
            placeholder="Cues, tips, common mistakes to avoid..."
            style={{ width:"100%", background:"#0D0D0D", border:"1px solid #2A2A2A", borderRadius:8, color:"#F5F0E8", padding:"12px 14px", fontFamily:"'DM Mono',monospace", fontSize:12, lineHeight:1.6, resize:"vertical", minHeight:110, outline:"none" }}
            onFocus={e => e.target.style.borderColor="#E8FF47"}
            onBlur={e => e.target.style.borderColor="#2A2A2A"}
          />
        </div>

        {/* Video thumbnails */}
        {videos.length > 0 && (
          <div style={{ marginBottom:18 }}>
            <div style={{ fontFamily:"'Barlow Condensed',sans-serif", fontWeight:800, fontSize:11, letterSpacing:"0.1em", textTransform:"uppercase", color:"#555", marginBottom:10 }}>Videos ({videos.length})</div>
            <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(180px,1fr))", gap:8 }}>
              {videos.map((url, i) => <YouTubeThumbnail key={url+i} url={url} onRemove={() => setVideos(v => v.filter((_,j)=>j!==i))} />)}
            </div>
          </div>
        )}

        {/* Add video */}
        <div style={{ marginBottom:24 }}>
          <div style={{ fontFamily:"'Barlow Condensed',sans-serif", fontWeight:800, fontSize:11, letterSpacing:"0.1em", textTransform:"uppercase", color:"#555", marginBottom:8 }}>Add YouTube Video</div>
          <div style={{ display:"flex", gap:8 }}>
            <input
              value={videoUrl} onChange={e => setVideoUrl(e.target.value)}
              onKeyDown={e => { if (e.key==="Enter") addVideo(); }}
              placeholder="https://youtube.com/watch?v=..."
              style={{ flex:1, background:"#0D0D0D", border:"1px solid #2A2A2A", borderRadius:8, color:"#F5F0E8", padding:"9px 12px", fontFamily:"'DM Mono',monospace", fontSize:12, outline:"none" }}
              onFocus={e => e.target.style.borderColor="#E8FF47"}
              onBlur={e => e.target.style.borderColor="#2A2A2A"}
            />
            <button onClick={addVideo} className="accent-btn">Add</button>
          </div>
        </div>

        <div style={{ display:"flex", gap:10, justifyContent:"flex-end" }}>
          <button onClick={onClose} className="ghost-btn">Cancel</button>
          <button onClick={save} className="accent-btn" style={{ padding:"9px 24px" }}>Save</button>
        </div>
      </div>
    </div>
  );
}

// ─── Knowledge Library View ───────────────────────────────────────────────────
function KnowledgeView({ exerciseLibrary, onUpdateLibrary, exerciseNotes, onUpdateExerciseNotes }) {
  const [search, setSearch] = React.useState("");
  const [modal, setModal] = React.useState(null); // exercise name
  const [groupFilter, setGroupFilter] = React.useState("all");
  const [expanded, setExpanded] = React.useState({});

  // Add exercise state
  const [addName, setAddName] = React.useState("");
  const [addCat, setAddCat] = React.useState(Object.keys(GROUP_LABELS)[0]);
  const [addLink, setAddLink] = React.useState("");

  const groupEntries = Object.entries(exerciseLibrary);

  const filtered = groupEntries.map(([group, exercises]) => ({
    group,
    exercises: exercises.filter(ex => {
      const matchSearch = ex.toLowerCase().includes(search.toLowerCase());
      const matchGroup  = groupFilter === "all" || groupFilter === group;
      return matchSearch && matchGroup;
    }),
  })).filter(g => g.exercises.length > 0);

  const totalWithNotes = Object.keys(exerciseNotes).filter(k => exerciseNotes[k]?.notes || exerciseNotes[k]?.videos?.length).length;

  const handleAddExercise = () => {
    if (!addName.trim()) return;
    const updated = { ...exerciseLibrary, [addCat]: [...(exerciseLibrary[addCat] || []), addName.trim()] };
    onUpdateLibrary(updated);
    if (addLink.trim()) {
      onUpdateExerciseNotes(addName.trim(), { ...exerciseNotes[addName.trim()], videos: [addLink.trim()] });
    }
    setAddName("");
    setAddLink("");
    setExpanded(prev => ({ ...prev, [addCat]: true }));
  };

  const handleDeleteExercise = (group, ex) => {
    if (window.confirm(`Are you sure you want to delete "${ex}" from the library?`)) {
      const updated = { ...exerciseLibrary, [group]: exerciseLibrary[group].filter(e => e !== ex) };
      onUpdateLibrary(updated);
    }
  };

  const exportLibrary = () => {
    const fullData = {
      groupLabels: GROUP_LABELS,
      exerciseLibrary: exerciseLibrary,
      exerciseNotes: exerciseNotes,
      dayTemplates: DAY_TEMPLATES
    };
    const blob = new Blob([JSON.stringify(fullData, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "gym_data.json";
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div style={{ padding:"28px" }}>
      {modal && (
        <ExerciseModal
          name={modal}
          data={exerciseNotes[modal]}
          onSave={data => onUpdateExerciseNotes(modal, data)}
          onClose={() => setModal(null)}
        />
      )}

      {/* Header */}
      <div style={{ marginBottom:24 }}>
        <div style={{ fontFamily:"'Barlow Condensed',sans-serif", fontWeight:900, fontSize:46, lineHeight:1, textTransform:"uppercase" }}>
          Exercise <span style={{ color:"#E8FF47" }}>Library</span>
        </div>
        <div style={{ fontFamily:"'DM Mono',monospace", fontSize:11, color:"#444", marginTop:5 }}>
          {totalWithNotes} exercise{totalWithNotes!==1?"s":""} with notes · click any exercise to add notes or videos
        </div>
      </div>

      {/* Controls */}
      <div style={{ display:"flex", gap:10, marginBottom:22, flexWrap:"wrap" }}>
        <input
          value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Search exercises..."
          style={{ flex:1, minWidth:180, background:"#141414", border:"1px solid #242424", borderRadius:8, color:"#F5F0E8", padding:"9px 14px", fontFamily:"'DM Mono',monospace", fontSize:12, outline:"none" }}
          onFocus={e => e.target.style.borderColor="#E8FF47"}
          onBlur={e => e.target.style.borderColor="#242424"}
        />
        <select
          value={groupFilter} onChange={e => setGroupFilter(e.target.value)}
          style={{ background:"#141414", border:"1px solid #242424", borderRadius:8, color:groupFilter==="all"?"#555":"#F5F0E8", padding:"9px 14px", fontFamily:"'DM Mono',monospace", fontSize:12, outline:"none", cursor:"pointer", appearance:"none", paddingRight:32,
            backgroundImage:"url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath d='M2 4l4 4 4-4' stroke='%23666' stroke-width='1.5' fill='none' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E\")",
            backgroundRepeat:"no-repeat", backgroundPosition:"right 10px center" }}
        >
          <option value="all">All Groups</option>
          {Object.entries(GROUP_LABELS).map(([k,v]) => <option key={k} value={k}>{v}</option>)}
        </select>
      </div>

      {/* Add New Exercise Section */}
      <div style={{ background: "#141414", border: "1px solid #242424", borderRadius: 12, padding: "20px", marginBottom: "28px" }}>
        <div style={{ fontFamily: "'Barlow Condensed',sans-serif", fontWeight: 800, fontSize: 11, letterSpacing: "0.1em", textTransform: "uppercase", color: "#555", marginBottom: "14px" }}>Add to Library</div>
        <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
          <input value={addName} onChange={e => setAddName(e.target.value)} placeholder="Exercise Name" style={{ flex: 1, minWidth: 160, background: "#0D0D0D", border: "1px solid #2A2A2A", borderRadius: 8, color: "#F5F0E8", padding: "9px 12px", fontFamily: "'DM Mono',monospace", fontSize: 12, outline: "none" }} />
          <input value={addLink} onChange={e => setAddLink(e.target.value)} placeholder="YouTube Link (Optional)" style={{ flex: 1, minWidth: 160, background: "#0D0D0D", border: "1px solid #2A2A2A", borderRadius: 8, color: "#F5F0E8", padding: "9px 12px", fontFamily: "'DM Mono',monospace", fontSize: 12, outline: "none" }} />
          <select value={addCat} onChange={e => setAddCat(e.target.value)} className="ex-select" style={{ flex: "0 0 150px" }}>
            {Object.entries(GROUP_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
          <button onClick={handleAddExercise} className="accent-btn" style={{ padding: "9px 20px" }}>Add</button>
        </div>
      </div>

      {/* Groups */}
      <div style={{ display:"flex", flexDirection:"column", gap:16 }}>
        {filtered.map(({ group, exercises }) => (
          <div key={group} style={{ background:"#141414", border:"1px solid #1E1E1E", borderRadius:12, overflow:"hidden" }}>
            <button 
              onClick={() => setExpanded(prev => ({ ...prev, [group]: !prev[group] }))}
              style={{ width: "100%", background: "none", border: "none", padding: "14px 18px", borderBottom: expanded[group] ? "1px solid #1E1E1E" : "none", display: "flex", alignItems: "center", justifyContent: "space-between", cursor: "pointer" }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <div style={{ fontFamily: "'Barlow Condensed',sans-serif", fontWeight: 900, fontSize: 13, textTransform: "uppercase", letterSpacing: "0.1em", color: "#666" }}>{GROUP_LABELS[group]}</div>
                <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 10, color: "#333" }}>{exercises.length} exercises</div>
              </div>
              <span style={{ color: "#333", transform: expanded[group] ? "rotate(180deg)" : "none", transition: "transform 0.2s" }}>▾</span>
            </button>

            {expanded[group] && (
              <div style={{ display:"flex", flexDirection: "column" }}>
                {exercises.map((ex) => {
                  const hasData = exerciseNotes[ex]?.notes || exerciseNotes[ex]?.videos?.length;
                  const firstVideo = exerciseNotes[ex]?.videos?.[0];
                  return (
                    <div key={ex} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 18px", borderBottom: "1px solid #1A1A1A" }}>
                      <button
                        onClick={() => setModal(ex)}
                        style={{ background: "none", border: "none", cursor: "pointer", textAlign: "left", flex: 1, padding: 0 }}
                      >
                        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                          <span style={{ fontFamily: "'DM Mono',monospace", fontSize: 12, color: hasData ? "#E8FF47" : "#888" }}>{ex}</span>
                          {firstVideo && (
                            <a 
                              href={firstVideo} target="_blank" rel="noreferrer" 
                              onClick={e => e.stopPropagation()}
                              style={{ background: "#1A2200", border: "1px solid #3A5500", borderRadius: 4, padding: "2px 6px", fontFamily: "'DM Mono',monospace", fontSize: 9, color: "#8ACA00", textDecoration: "none" }}
                            >
                              VIDEO
                            </a>
                          )}
                        </div>
                      </button>
                      <button 
                        onClick={() => handleDeleteExercise(group, ex)}
                        style={{ background: "none", border: "none", color: "#2E2E2E", cursor: "pointer", padding: "4px", fontSize: "14px" }}
                        onMouseEnter={e => e.target.style.color = "#FF6B6B"}
                        onMouseLeave={e => e.target.style.color = "#2E2E2E"}
                      >
                        ✕
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Wisdom Modal ─────────────────────────────────────────────────────────────
function WisdomModal({ entry, onSave, onClose }) {
  const isNew = !entry;
  const [title,    setTitle]    = React.useState(entry?.title    || "");
  const [category, setCategory] = React.useState(entry?.category || WISDOM_CATEGORIES[0]);
  const [notes,    setNotes]    = React.useState(entry?.notes    || "");
  const [videoUrl, setVideoUrl] = React.useState("");
  const [videos,   setVideos]   = React.useState(entry?.videos   || []);

  const addVideo = () => {
    const trimmed = videoUrl.trim(); if (!trimmed) return;
    if (!extractYouTubeId(trimmed)) { alert("Paste a valid YouTube URL"); return; }
    setVideos(v => [...v, trimmed]); setVideoUrl("");
  };
  const save = () => {
    if (!title.trim()) { alert("Please add a title"); return; }
    onSave({ title:title.trim(), category, notes, videos, updatedAt: new Date().toISOString() });
    onClose();
  };

  return (
    <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.75)", zIndex:100, display:"flex", alignItems:"center", justifyContent:"center", padding:20 }} onClick={onClose}>
      <div style={{ background:"#161616", border:"1px solid #2A2A2A", borderRadius:14, width:"100%", maxWidth:560, maxHeight:"90vh", overflowY:"auto", padding:"28px" }} onClick={e => e.stopPropagation()}>
        <div style={{ display:"flex", alignItems:"flex-start", justifyContent:"space-between", marginBottom:22 }}>
          <div style={{ fontFamily:"'Barlow Condensed',sans-serif", fontWeight:900, fontSize:24, textTransform:"uppercase" }}>{isNew?"New Wisdom Entry":"Edit Entry"}</div>
          <button onClick={onClose} style={{ background:"none", border:"none", color:"#555", cursor:"pointer", fontSize:20, lineHeight:1 }}>✕</button>
        </div>

        <div style={{ marginBottom:16 }}>
          <div className="field-label">Title</div>
          <input value={title} onChange={e => setTitle(e.target.value)} placeholder="e.g. How to brace for heavy squats"
            style={{ width:"100%", background:"#0D0D0D", border:"1px solid #2A2A2A", borderRadius:8, color:"#F5F0E8", padding:"9px 12px", fontFamily:"'DM Mono',monospace", fontSize:13, outline:"none" }}
            onFocus={e => e.target.style.borderColor="#E8FF47"} onBlur={e => e.target.style.borderColor="#2A2A2A"} />
        </div>

        <div style={{ marginBottom:16 }}>
          <div className="field-label">Category</div>
          <div style={{ display:"flex", gap:6, flexWrap:"wrap" }}>
            {WISDOM_CATEGORIES.map(cat => (
              <button key={cat} onClick={() => setCategory(cat)} style={{ background:category===cat?"#1A2200":"#0D0D0D", border:`1px solid ${category===cat?"#E8FF47":"#2A2A2A"}`, borderRadius:6, color:category===cat?"#E8FF47":"#555", padding:"5px 12px", fontFamily:"'Barlow Condensed',sans-serif", fontWeight:800, fontSize:11, letterSpacing:"0.08em", textTransform:"uppercase", cursor:"pointer" }}>
                {cat}
              </button>
            ))}
          </div>
        </div>

        <div style={{ marginBottom:16 }}>
          <div className="field-label">Notes</div>
          <textarea value={notes} onChange={e => setNotes(e.target.value)} placeholder="Write your insight, cue, or summary..."
            style={{ width:"100%", background:"#0D0D0D", border:"1px solid #2A2A2A", borderRadius:8, color:"#F5F0E8", padding:"12px 14px", fontFamily:"'DM Mono',monospace", fontSize:12, lineHeight:1.6, resize:"vertical", minHeight:100, outline:"none" }}
            onFocus={e => e.target.style.borderColor="#E8FF47"} onBlur={e => e.target.style.borderColor="#2A2A2A"} />
        </div>

        {videos.length > 0 && (
          <div style={{ marginBottom:16 }}>
            <div className="field-label">Videos ({videos.length})</div>
            <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(160px,1fr))", gap:8 }}>
              {videos.map((url,i) => <YouTubeThumbnail key={url+i} url={url} onRemove={() => setVideos(v => v.filter((_,j)=>j!==i))} />)}
            </div>
          </div>
        )}

        <div style={{ marginBottom:24 }}>
          <div className="field-label">Add YouTube Video</div>
          <div style={{ display:"flex", gap:8 }}>
            <input value={videoUrl} onChange={e => setVideoUrl(e.target.value)} onKeyDown={e => { if(e.key==="Enter") addVideo(); }} placeholder="https://youtube.com/watch?v=..."
              style={{ flex:1, background:"#0D0D0D", border:"1px solid #2A2A2A", borderRadius:8, color:"#F5F0E8", padding:"9px 12px", fontFamily:"'DM Mono',monospace", fontSize:12, outline:"none" }}
              onFocus={e => e.target.style.borderColor="#E8FF47"} onBlur={e => e.target.style.borderColor="#2A2A2A"} />
            <button onClick={addVideo} className="accent-btn">Add</button>
          </div>
        </div>

        <div style={{ display:"flex", gap:10, justifyContent:"flex-end" }}>
          <button onClick={onClose} className="ghost-btn">Cancel</button>
          <button onClick={save} className="accent-btn" style={{ padding:"9px 24px" }}>Save</button>
        </div>
      </div>
    </div>
  );
}

// ─── General Wisdom View ──────────────────────────────────────────────────────
function WisdomView({ entries, onUpdate }) {
  const [modal, setModal]           = React.useState(null); // null | "new" | index
  const [catFilter, setCatFilter]   = React.useState("all");
  const [search, setSearch]         = React.useState("");
  const [expanded, setExpanded]     = React.useState({});

  const save = (data) => {
    if (modal === "new") {
      onUpdate([...entries, data]);
    } else {
      const copy = [...entries]; copy[modal] = data; onUpdate(copy);
    }
  };
  const remove = (i) => { if (confirm("Delete this entry?")) { const copy=[...entries]; copy.splice(i,1); onUpdate(copy); } };
  const toggle = (i) => setExpanded(e => ({ ...e, [i]: !e[i] }));

  const cats = ["all", ...WISDOM_CATEGORIES];
  const filtered = entries.map((e,i)=>({...e,_i:i})).filter(e => {
    const matchCat = catFilter==="all" || e.category===catFilter;
    const matchSearch = !search || e.title.toLowerCase().includes(search.toLowerCase()) || e.notes?.toLowerCase().includes(search.toLowerCase());
    return matchCat && matchSearch;
  });

  // group by category
  const grouped = {};
  filtered.forEach(e => { if (!grouped[e.category]) grouped[e.category]=[]; grouped[e.category].push(e); });

  return (
    <div style={{ padding:"28px" }}>
      {(modal==="new" || typeof modal==="number") && (
        <WisdomModal entry={typeof modal==="number"?entries[modal]:null} onSave={save} onClose={() => setModal(null)} />
      )}

      <div style={{ display:"flex", alignItems:"flex-end", justifyContent:"space-between", marginBottom:24, flexWrap:"wrap", gap:14 }}>
        <div>
          <div style={{ fontFamily:"'Barlow Condensed',sans-serif", fontWeight:900, fontSize:46, lineHeight:1, textTransform:"uppercase" }}>
            General <span style={{ color:"#47FFD4" }}>Wisdom</span>
          </div>
          <div style={{ fontFamily:"'DM Mono',monospace", fontSize:11, color:"#444", marginTop:5 }}>{entries.length} entr{entries.length!==1?"ies":"y"} across {[...new Set(entries.map(e=>e.category))].length} categories</div>
        </div>
        <button onClick={() => setModal("new")} className="accent-btn" style={{ padding:"10px 20px" }}>+ New Entry</button>
      </div>

      {/* Controls */}
      <div style={{ display:"flex", gap:10, marginBottom:22, flexWrap:"wrap" }}>
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search..."
          style={{ flex:1, minWidth:160, background:"#141414", border:"1px solid #242424", borderRadius:8, color:"#F5F0E8", padding:"9px 14px", fontFamily:"'DM Mono',monospace", fontSize:12, outline:"none" }}
          onFocus={e => e.target.style.borderColor="#47FFD4"} onBlur={e => e.target.style.borderColor="#242424"} />
        <div style={{ display:"flex", gap:6, flexWrap:"wrap" }}>
          {cats.map(cat => (
            <button key={cat} onClick={() => setCatFilter(cat)} style={{ background:catFilter===cat?"#001A18":"#141414", border:`1px solid ${catFilter===cat?"#47FFD4":"#242424"}`, borderRadius:6, color:catFilter===cat?"#47FFD4":"#555", padding:"6px 12px", fontFamily:"'Barlow Condensed',sans-serif", fontWeight:800, fontSize:11, letterSpacing:"0.08em", textTransform:"uppercase", cursor:"pointer" }}>
              {cat}
            </button>
          ))}
        </div>
      </div>

      {entries.length === 0 ? (
        <div style={{ border:"1px dashed #1E1E1E", borderRadius:12, padding:"48px", textAlign:"center", color:"#3A3A3A", fontFamily:"'DM Mono',monospace", fontSize:13 }}>
          No entries yet. Hit "+ New Entry" to capture your first insight.
        </div>
      ) : filtered.length === 0 ? (
        <div style={{ border:"1px dashed #1E1E1E", borderRadius:12, padding:"32px", textAlign:"center", color:"#3A3A3A", fontFamily:"'DM Mono',monospace", fontSize:13 }}>No entries match your filter.</div>
      ) : (
        <div style={{ display:"flex", flexDirection:"column", gap:20 }}>
          {Object.entries(grouped).map(([cat, catEntries]) => (
            <div key={cat}>
              <div style={{ fontFamily:"'Barlow Condensed',sans-serif", fontWeight:900, fontSize:12, letterSpacing:"0.14em", textTransform:"uppercase", color:"#47FFD4", marginBottom:10, opacity:0.7 }}>{cat}</div>
              <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
                {catEntries.map(entry => {
                  const isOpen = expanded[entry._i];
                  const videoCount = entry.videos?.length || 0;
                  return (
                    <div key={entry._i} style={{ background:"#141414", border:"1px solid #1E1E1E", borderRadius:10, overflow:"hidden" }}>
                      <div
                        onClick={() => toggle(entry._i)}
                        style={{ display:"flex", alignItems:"center", justifyContent:"space-between", padding:"14px 18px", cursor:"pointer", gap:12 }}
                        onMouseEnter={e => e.currentTarget.style.background="#191919"}
                        onMouseLeave={e => e.currentTarget.style.background=""}
                      >
                        <div style={{ flex:1, minWidth:0 }}>
                          <div style={{ fontFamily:"'DM Mono',monospace", fontSize:13, color:"#E0E0E0", marginBottom:3 }}>{entry.title}</div>
                          {!isOpen && entry.notes && (
                            <div style={{ fontFamily:"'DM Mono',monospace", fontSize:11, color:"#444", overflow:"hidden", whiteSpace:"nowrap", textOverflow:"ellipsis" }}>{entry.notes}</div>
                          )}
                        </div>
                        <div style={{ display:"flex", alignItems:"center", gap:8, flexShrink:0 }}>
                          {videoCount > 0 && <span style={{ background:"#001A18", border:"1px solid #1A4A44", borderRadius:4, padding:"2px 7px", fontFamily:"'DM Mono',monospace", fontSize:9, color:"#47FFD4" }}>▶ {videoCount}</span>}
                          <button onClick={e => { e.stopPropagation(); setModal(entry._i); }} style={{ background:"none", border:"1px solid #252525", borderRadius:5, color:"#444", fontSize:11, cursor:"pointer", padding:"3px 9px", fontFamily:"'DM Mono',monospace", transition:"color 0.12s, border-color 0.12s" }}
                            onMouseEnter={e => { e.target.style.color="#47FFD4"; e.target.style.borderColor="#47FFD4"; }}
                            onMouseLeave={e => { e.target.style.color="#444"; e.target.style.borderColor="#252525"; }}>
                            Edit
                          </button>
                          <button onClick={e => { e.stopPropagation(); remove(entry._i); }} style={{ background:"none", border:"none", color:"#2E2E2E", cursor:"pointer", fontSize:14, lineHeight:1, transition:"color 0.12s" }}
                            onMouseEnter={e => e.target.style.color="#FF6B6B"}
                            onMouseLeave={e => e.target.style.color="#2E2E2E"}>✕</button>
                          <span style={{ color:"#333", fontSize:13, display:"inline-block", transform:isOpen?"rotate(180deg)":"none", transition:"transform 0.2s" }}>▾</span>
                        </div>
                      </div>

                      {isOpen && (
                        <div style={{ borderTop:"1px solid #1A1A1A", padding:"16px 18px" }}>
                          {entry.notes && (
                            <div style={{ fontFamily:"'DM Mono',monospace", fontSize:12, color:"#888", lineHeight:1.7, marginBottom:videoCount?16:0, whiteSpace:"pre-wrap" }}>{entry.notes}</div>
                          )}
                          {videoCount > 0 && (
                            <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(200px,1fr))", gap:8 }}>
                              {entry.videos.map((url,i) => <YouTubeThumbnail key={url+i} url={url} />)}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── App Root ─────────────────────────────────────────────────────────────────
export default function GymSplitPlanner() {
  const [state, setState] = React.useState(loadState);
  const [view, setView]   = React.useState("plan"); // "plan" | "history" | "library" | "wisdom"
  const [savedFlash, setSavedFlash] = React.useState(false);

  React.useEffect(() => {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch {}
  }, [state]);

  const updateDay = (dayKey, patch) => setState(prev => ({ ...prev, days:{ ...prev.days, [dayKey]:{ ...prev.days[dayKey], ...patch } } }));

  const saveToHistory = () => {
    const snapshot = {
      savedAt: new Date().toISOString(),
      days: Object.fromEntries(Object.entries(state.days).map(([k,d]) => [k, { title:d.title, activeGroups:[...d.activeGroups], selected:{...d.selected} }])),
    };
    setState(prev => ({ ...prev, history:[...prev.history, snapshot] }));
    setSavedFlash(true); setTimeout(() => setSavedFlash(false), 2000);
  };

  const restoreFromHistory = (index) => {
    const session = state.history[index];
    const newDays = { ...state.days };
    for (const [key, saved] of Object.entries(session.days)) {
      newDays[key] = { ...newDays[key], activeGroups:saved.activeGroups, selected:{ ...newDays[key].selected, ...saved.selected } };
    }
    setState(prev => ({ ...prev, days:newDays }));
    setView("plan");
  };

  const updateExerciseNotes = (name, data) => {
    setState(prev => ({ ...prev, exerciseNotes:{ ...prev.exerciseNotes, [name]:data } }));
  };

  const updateWisdom = (entries) => setState(prev => ({ ...prev, wisdomEntries:entries }));

  const updateLibrary = (newLib) => setState(prev => ({ ...prev, exerciseLibrary: newLib }));

  const NAV = [
    { key:"plan",    label:"Program" },
    { key:"library", label:"Exercise Library" },
    { key:"wisdom",  label:"General Wisdom" },
    { key:"history", label:`History (${(state.history||[]).length})` },
  ];

  return (
    <div style={{ minHeight:"100vh", background:"#0D0D0D", color:"#F5F0E8"}}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Mono:wght@300;400;500&family=Barlow+Condensed:wght@700;800;900&display=swap');
        *, *::before, *::after { box-sizing:border-box; margin:0; padding:0; }

        .ex-select { flex:1; min-width:0; background:#0D0D0D; border:1px solid #2A2A2A; color:#F5F0E8; padding:8px 28px 8px 10px; font-family:'DM Mono',monospace; font-size:12px; border-radius:6px; outline:none; appearance:none; -webkit-appearance:none; cursor:pointer; transition:border-color 0.15s,background 0.15s; background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath d='M2 4l4 4 4-4' stroke='%23666' stroke-width='1.5' fill='none' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E"); background-repeat:no-repeat; background-position:right 8px center; }
        .ex-select:hover { border-color:#444; background-color:#181818; }
        .ex-select:focus { border-color:#E8FF47; }
        .ex-select option { background:#1A1A1A; color:#F5F0E8; }

        .deact-btn { background:none; border:none; color:#2E2E2E; cursor:pointer; font-size:13px; line-height:1; padding:2px 4px; flex-shrink:0; transition:color 0.15s; font-family:'DM Mono',monospace; }
        .deact-btn:hover { color:#E8FF47; }

        .add-btn { background:none; border:1px solid #252525; border-radius:5px; color:#555; font-size:11px; cursor:pointer; padding:3px 10px; font-family:'DM Mono',monospace; transition:border-color 0.15s,color 0.15s; }
        .add-btn:hover { border-color:#E8FF47; color:#E8FF47; }

        .ghost-btn { background:transparent; color:#666; border:1px solid #242424; border-radius:7px; padding:8px 16px; cursor:pointer; font-family:'Barlow Condensed',sans-serif; font-weight:800; font-size:12px; letter-spacing:0.08em; text-transform:uppercase; transition:border-color 0.15s,color 0.15s; }
        .ghost-btn:hover { border-color:#444; color:#aaa; }

        .accent-btn { background:#E8FF47; color:#0D0D0D; border:none; border-radius:7px; padding:8px 16px; cursor:pointer; font-family:'Barlow Condensed',sans-serif; font-weight:900; font-size:12px; letter-spacing:0.08em; text-transform:uppercase; transition:opacity 0.15s; }
        .accent-btn:hover { opacity:0.85; }

        .restore-btn { background:#1A1E00; border:1px solid #E8FF47; border-radius:7px; color:#E8FF47; cursor:pointer; padding:6px 14px; font-family:'Barlow Condensed',sans-serif; font-weight:900; font-size:11px; letter-spacing:0.08em; text-transform:uppercase; }
        .restore-btn:hover { background:#252E00; }

        .field-label { font-family:'Barlow Condensed',sans-serif; font-weight:800; font-size:11px; letter-spacing:0.1em; text-transform:uppercase; color:#555; margin-bottom:8px; }
      `}</style>

      {/* Top Bar */}
      <div style={{ borderBottom:"1px solid #181818", padding:"13px 24px", display:"flex", alignItems:"center", justifyContent:"space-between", gap:12, flexWrap:"wrap" }}>
        <div style={{ display:"flex", alignItems:"center", gap:14 }}>
          <div style={{ width:28, height:28, background:"#E8FF47", borderRadius:6, display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#0D0D0D" strokeWidth="2.5" strokeLinecap="round"><path d="M6 4v16M18 4v16M2 8h4M18 8h4M2 16h4M18 16h4"/></svg>
          </div>
          <div>
            <div style={{ fontFamily:"'Barlow Condensed',sans-serif", fontWeight:900, fontSize:16, letterSpacing:"0.04em", textTransform:"uppercase", lineHeight:1 }}>Split Planner</div>
            <div style={{ fontSize:10, color:"#3A3A3A", marginTop:1, fontFamily:"'DM Mono',monospace" }}>4-day upper / lower</div>
          </div>
        </div>

        {/* Nav */}
        <div style={{ display:"flex", alignItems:"center", gap:4, flexWrap:"wrap" }}>
          {NAV.map(({ key, label }) => (
            <button key={key} onClick={() => setView(key)} style={{
              background:view===key?"#1A1A1A":"none",
              border:`1px solid ${view===key?"#333":"transparent"}`,
              borderRadius:7, padding:"7px 14px", cursor:"pointer",
              fontFamily:"'Barlow Condensed',sans-serif", fontWeight:800,
              fontSize:12, letterSpacing:"0.08em", textTransform:"uppercase",
              color:view===key?"#F5F0E8":"#444",
              transition:"color 0.15s, background 0.15s",
            }}
            onMouseEnter={e => { if(view!==key) e.currentTarget.style.color="#888"; }}
            onMouseLeave={e => { if(view!==key) e.currentTarget.style.color="#444"; }}>
              {label}
            </button>
          ))}
        </div>

        {/* Save to history (only on plan view) */}
        <div style={{ display:"flex", alignItems:"center", gap:10, flexWrap:"wrap" }}>
          <div style={{ fontSize:11, color:"#E8FF47", display:"flex", alignItems:"center", gap:5, opacity:savedFlash?1:0, transition:"opacity 0.4s", fontFamily:"'DM Mono',monospace" }}>
            <svg width="10" height="10" viewBox="0 0 10 10" fill="none"><circle cx="5" cy="5" r="4.5" stroke="#E8FF47"/><path d="M3 5l1.5 1.5L7 3.5" stroke="#E8FF47" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/></svg>
            saved
          </div>
          {view==="plan" && (
            <button onClick={saveToHistory} className="accent-btn">Save to History</button>
          )}
        </div>
      </div>

      {/* Views */}
      {view==="plan" && (
        <div style={{ padding:"24px" }}>
          <div style={{ marginBottom:22 }}>
            <div style={{ fontFamily:"'Barlow Condensed',sans-serif", fontWeight:900, fontSize:46, lineHeight:1, textTransform:"uppercase" }}>Your <span style={{ color:"#E8FF47" }}>Program</span></div>
            <div style={{ fontFamily:"'DM Mono',monospace", fontSize:11, color:"#3A3A3A", marginTop:5 }}>⠿ drag to reorder · ✕ to deactivate · expand inactive to add groups</div>
          </div>
          <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(290px,1fr))", gap:12 }}>
            {Object.entries(state.days).map(([dayKey,day]) => (
              <DayCard key={dayKey} dayKey={dayKey} day={day} library={state.exerciseLibrary} onUpdate={updateDay} accent={DAY_ACCENTS[dayKey]} />
            ))}
          </div>
        </div>
      )}

      {view==="library" && (
        <KnowledgeView exerciseLibrary={state.exerciseLibrary} onUpdateLibrary={updateLibrary} exerciseNotes={state.exerciseNotes||{}} onUpdateExerciseNotes={updateExerciseNotes} />
      )}

      {view==="wisdom" && (
        <WisdomView entries={state.wisdomEntries||[]} onUpdate={updateWisdom} />
      )}

      {view==="history" && (
        <HistoryView history={state.history||[]} onBack={() => setView("plan")} onRestore={restoreFromHistory} />
      )}
    </div>
  );
}