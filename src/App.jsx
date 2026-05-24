import React from "react";
import ReactMarkdown from "react-markdown";

// These will be populated after fetching /api/gymdata on mount.
// We use module-level vars so helper functions outside the component can access them.
let EXERCISE_LIBRARY = {};
let GROUP_LABELS = {};
let DAY_TEMPLATES = {};

const DAY_ACCENTS = { lowerA:"#E8FF47", upperA:"#47FFD4", lowerB:"#E8FF47", upperB:"#47FFD4" };
const DAY_INDEX   = { lowerA:1, upperA:2, lowerB:3, upperB:4 };

const WISDOM_CATEGORIES = ["Technique","Programming","Recovery","Nutrition","Mindset","General"];

// ─── State helpers ────────────────────────────────────────────────────────────
function buildDefault(gymData) {
  const days = {};
  for (const [key, tpl] of Object.entries(gymData.dayTemplates || {})) {
    // Build index-keyed selected so groups can repeat
    const selected = {};
    (tpl.activeGroups || []).forEach((group, i) => {
      selected[String(i)] = tpl.selected?.[group] || tpl.selected?.[String(i)] || (gymData.exerciseLibrary?.[group]?.[0] ?? "");
    });
    days[key] = { title:tpl.title, subtitle:tpl.subtitle, allGroups:[...tpl.allGroups], activeGroups:[...tpl.activeGroups], selected };
  }
  return { 
    days, 
    history: [], 
    exerciseNotes: { ...(gymData.exerciseNotes || {}) }, 
    wisdomEntries: [],
    exerciseLibrary: { ...(gymData.exerciseLibrary || {}) }
  };
}

// Debounce helper — auto-save waits 300ms after the last change before writing
function debounce(fn, ms) {
  let timer;
  return (...args) => { clearTimeout(timer); timer = setTimeout(() => fn(...args), ms); };
}

const saveStateToServer = debounce(async (state) => {
  try {
    await fetch("/api/state", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(state),
    });
  } catch (err) {
    console.error("Auto-save failed:", err);
  }
}, 300);

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
      const from = dragItem.current, to = dragOver.current;
      const copy = [...list]; const [moved] = copy.splice(from, 1); copy.splice(to, 0, moved);
      dragItem.current = dragOver.current = null; onReorder(copy, from, to);
    },
  };
}

// ─── GroupRow ─────────────────────────────────────────────────────────────────
function GroupRow({ group, rowIndex, library, value, onSelect, onDeactivate, dragHandlers, index }) {
  const exercises = library[group] || [];
  return (
    <div draggable onDragStart={() => dragHandlers.handleDragStart(index)} onDragEnter={() => dragHandlers.handleDragEnter(index)} onDragEnd={dragHandlers.handleDragEnd} onDragOver={e => e.preventDefault()}
      style={{ display:"flex", alignItems:"center", gap:8, padding:"9px 0", borderBottom:"1px solid #1C1C1C", userSelect:"none" }}>
      <div title="Drag to reorder" style={{ color:"#2E2E2E", fontSize:16, cursor:"grab", flexShrink:0, lineHeight:1 }}>⠿</div>
      <div style={{ fontFamily:"'Barlow Condensed',sans-serif", fontWeight:800, fontSize:11, letterSpacing:"0.1em", textTransform:"uppercase", color:"#555", width:86, flexShrink:0 }}>{GROUP_LABELS[group]}</div>
      <select className="ex-select" value={value || exercises[0]} onChange={e => onSelect(rowIndex, e.target.value)} onMouseDown={e => e.stopPropagation()} draggable={false}>
        {exercises.map(ex => <option key={ex} value={ex}>{ex}</option>)}
      </select>
      <button onClick={() => onDeactivate(rowIndex)} className="deact-btn">✕</button>
    </div>
  );
}

// ─── DayCard ──────────────────────────────────────────────────────────────────
function DayCard({ dayKey, day, library, onUpdate, accent }) {
  const [addGroupKey, setAddGroupKey] = React.useState(day.allGroups[0] || "");

  const deactivate = (rowIndex) => {
    const newGroups = [...day.activeGroups];
    newGroups.splice(rowIndex, 1);
    const newSelected = {};
    newGroups.forEach((g, i) => {
      const oldIdx = i < rowIndex ? i : i + 1;
      newSelected[String(i)] = day.selected[String(oldIdx)] || library[g]?.[0] || "";
    });
    onUpdate(dayKey, { activeGroups: newGroups, selected: newSelected });
  };

  const onSelect = (rowIndex, value) => {
    onUpdate(dayKey, { selected: { ...day.selected, [String(rowIndex)]: value } });
  };

  const addGroup = () => {
    if (!addGroupKey) return;
    const newIndex = day.activeGroups.length;
    onUpdate(dayKey, {
      activeGroups: [...day.activeGroups, addGroupKey],
      selected: { ...day.selected, [String(newIndex)]: library[addGroupKey]?.[0] || "" },
    });
  };

  const drag = useDragReorder(day.activeGroups, (newOrder, from, to) => {
    const oldValues = day.activeGroups.map((_, i) => day.selected[String(i)]);
    const newValues = [...oldValues];
    const [movedVal] = newValues.splice(from, 1);
    newValues.splice(to, 0, movedVal);
    const newSelected = {};
    newValues.forEach((v, i) => { newSelected[String(i)] = v; });
    onUpdate(dayKey, { activeGroups: newOrder, selected: newSelected });
  });

  return (
    <div style={{ background:"#141414", border:"1px solid #242424", borderRadius:12, padding:"26px 22px", position:"relative", overflow:"hidden" }}>
      <div style={{ position:"absolute", right:12, top:6, fontFamily:"'Barlow Condensed',sans-serif", fontWeight:900, fontSize:68, lineHeight:1, opacity:0.055, pointerEvents:"none", color:"#fff", userSelect:"none" }}>{DAY_INDEX[dayKey]}</div>
      <div style={{ marginBottom:20 }}>
        <div style={{ display:"flex", alignItems:"center", gap:7, marginBottom:3 }}>
          <div style={{ width:6, height:6, borderRadius:"50%", background:accent, boxShadow:`0 0 8px ${accent}99`, flexShrink:0 }} />
          <span style={{ fontFamily:"'DM Mono',monospace", fontSize:10, color:"#444", letterSpacing:"0.08em" }}>Day {DAY_INDEX[dayKey]} of 4</span>
        </div>
        <div style={{ fontFamily:"'Barlow Condensed',sans-serif", fontWeight:900, fontSize:28, textTransform:"uppercase", letterSpacing:"0.01em", lineHeight:1.1, marginTop:4 }}>{day.title}</div>
      </div>
      <div style={{ height:1, background:"#1E1E1E", marginBottom:2 }} />
      {day.activeGroups.map((group, i) => (
        <GroupRow key={`${group}-${i}`} group={group} rowIndex={i} library={library} value={day.selected[String(i)] || library[group]?.[0]} onSelect={onSelect} onDeactivate={deactivate} dragHandlers={drag} index={i} />
      ))}
      {/* ── Add Group ── */}
      <div style={{ marginTop:10, display:"flex", gap:8, alignItems:"center" }}>
        <select
          value={addGroupKey}
          onChange={e => setAddGroupKey(e.target.value)}
          style={{ flex:1, background:"#0A0A0A", border:"1px solid #1E1E1E", borderRadius:7, color:"#555", padding:"7px 10px", fontFamily:"'Barlow Condensed',sans-serif", fontWeight:800, fontSize:11, letterSpacing:"0.08em", textTransform:"uppercase", cursor:"pointer", outline:"none", appearance:"none",
            backgroundImage:"url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath d='M2 4l4 4 4-4' stroke='%23666' stroke-width='1.5' fill='none' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E\")",
            backgroundRepeat:"no-repeat", backgroundPosition:"right 10px center", paddingRight:30 }}
        >
          {day.allGroups.map(g => (
            <option key={g} value={g}>{GROUP_LABELS[g] || g}</option>
          ))}
        </select>
        <button onClick={addGroup} className="add-btn" style={{ padding:"7px 14px", whiteSpace:"nowrap", flexShrink:0 }}>+ Add</button>
      </div>
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
                      {day.activeGroups.map((group, gi) => (
                        <div key={`${group}-${gi}`} style={{ display:"flex", justifyContent:"space-between", alignItems:"baseline", padding:"3px 0", borderBottom:"1px solid #141414", gap:8 }}>
                          <span style={{ fontFamily:"'DM Mono',monospace", fontSize:9, color:"#3A3A3A", textTransform:"uppercase", letterSpacing:"0.06em", flexShrink:0 }}>{GROUP_LABELS[group]}</span>
                          <span style={{ fontFamily:"'DM Mono',monospace", fontSize:10, color:"#777", textAlign:"right" }}>{day.selected[String(gi)] ?? day.selected[group]}</span>
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
        <div style={{ position:"absolute", inset:0, display:"flex", alignItems:"center", justifyContent:"center", background:"rgba(0,0,0,0.1)", transition:"background 0.15s" }}
          onMouseEnter={e => e.currentTarget.style.background="rgba(0,0,0,0.0)"}
          onMouseLeave={e => e.currentTarget.style.background="rgba(0,0,0,0.1)"}>
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

// ─── Exercise Group Body (with drag-to-reorder) ─────────────────────────────
function ExerciseGroupBody({ group, exercises, exerciseNotes, onModal, onDelete, onReorder, canDrag, addState, onAddChange, onAddSubmit }) {
  const drag = useDragReorder(exercises, onReorder);
  return (
    <div style={{ display:"flex", flexDirection:"column" }}>
      {exercises.map((ex, i) => {
        const hasData = exerciseNotes[ex]?.notes || exerciseNotes[ex]?.videos?.length;
        const firstVideo = exerciseNotes[ex]?.videos?.[0];
        return (
          <div key={ex}
            draggable={canDrag}
            onDragStart={canDrag ? () => drag.handleDragStart(i) : undefined}
            onDragEnter={canDrag ? () => drag.handleDragEnter(i) : undefined}
            onDragEnd={canDrag ? drag.handleDragEnd : undefined}
            onDragOver={canDrag ? e => e.preventDefault() : undefined}
            style={{ display:"flex", alignItems:"center", justifyContent:"space-between", padding:"10px 18px", borderBottom:"1px solid #1A1A1A", userSelect:"none" }}
          >
            {canDrag && (
              <div title="Drag to reorder" style={{ color:"#2A2A2A", fontSize:16, cursor:"grab", flexShrink:0, lineHeight:1, marginRight:8 }}>⠿</div>
            )}
            <button onClick={() => onModal(ex)} style={{ background:"none", border:"none", cursor:"pointer", textAlign:"left", flex:1, padding:0 }}>
              <div style={{ display:"flex", alignItems:"center", gap:12 }}>
                <span style={{ fontFamily:"'DM Mono',monospace", fontSize:12, color: hasData ? "#E8FF47" : "#888" }}>{ex}</span>
                {firstVideo && (
                  <a href={firstVideo} target="_blank" rel="noreferrer" onClick={e => e.stopPropagation()}
                    style={{ background:"#1A2200", border:"1px solid #3A5500", borderRadius:4, padding:"2px 6px", fontFamily:"'DM Mono',monospace", fontSize:9, color:"#8ACA00", textDecoration:"none" }}>
                    VIDEO
                  </a>
                )}
              </div>
            </button>
            <button onClick={() => onDelete(ex)}
              style={{ background:"none", border:"none", color:"#2E2E2E", cursor:"pointer", padding:"4px", fontSize:"14px" }}
              onMouseEnter={e => e.target.style.color = "#FF6B6B"}
              onMouseLeave={e => e.target.style.color = "#2E2E2E"}>
              ✕
            </button>
          </div>
        );
      })}
      {/* ── Inline add row ── */}
      <div style={{ display:"flex", gap:8, padding:"10px 14px", borderTop:"1px solid #1E1E1E", background:"#0E0E0E", alignItems:"center", flexWrap:"wrap" }}>
        <input
          value={addState.name}
          onChange={e => onAddChange({ name: e.target.value })}
          onKeyDown={e => { if (e.key === "Enter") onAddSubmit(); }}
          placeholder="New exercise name..."
          style={{ flex:2, minWidth:140, background:"#141414", border:"1px solid #252525", borderRadius:6, color:"#F5F0E8", padding:"7px 10px", fontFamily:"'DM Mono',monospace", fontSize:11, outline:"none" }}
          onFocus={e => e.target.style.borderColor = "#E8FF47"}
          onBlur={e => e.target.style.borderColor = "#252525"}
        />
        <input
          value={addState.link}
          onChange={e => onAddChange({ link: e.target.value })}
          onKeyDown={e => { if (e.key === "Enter") onAddSubmit(); }}
          placeholder="YouTube link (optional)"
          style={{ flex:3, minWidth:160, background:"#141414", border:"1px solid #252525", borderRadius:6, color:"#F5F0E8", padding:"7px 10px", fontFamily:"'DM Mono',monospace", fontSize:11, outline:"none" }}
          onFocus={e => e.target.style.borderColor = "#E8FF47"}
          onBlur={e => e.target.style.borderColor = "#252525"}
        />
        <button onClick={onAddSubmit} className="add-btn" style={{ padding:"6px 14px", fontSize:11, whiteSpace:"nowrap" }}>+ Add</button>
      </div>
    </div>
  );
}

// ─── Knowledge Library View ───────────────────────────────────────────────────
function KnowledgeView({ exerciseLibrary, onUpdateLibrary, exerciseNotes, onUpdateExerciseNotes }) {
  const [search, setSearch] = React.useState("");
  const [modal, setModal] = React.useState(null);
  const [groupFilter, setGroupFilter] = React.useState("all");
  const [expanded, setExpanded] = React.useState({});
  // Per-group inline add form state: { [group]: { name, link } }
  const [addState, setAddState] = React.useState({});

  const getAdd = (group) => addState[group] || { name: "", link: "" };
  const setAdd = (group, patch) => setAddState(prev => ({ ...prev, [group]: { ...getAdd(group), ...patch } }));

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

  const handleAddExercise = (group) => {
    const { name, link } = getAdd(group);
    if (!name.trim()) return;
    const updated = { ...exerciseLibrary, [group]: [...(exerciseLibrary[group] || []), name.trim()] };
    onUpdateLibrary(updated);
    if (link.trim()) {
      onUpdateExerciseNotes(name.trim(), { ...exerciseNotes[name.trim()], videos: [link.trim()] });
    }
    setAdd(group, { name: "", link: "" });
    setExpanded(prev => ({ ...prev, [group]: true }));
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


      {/* Groups */}
      <div style={{ display:"flex", flexDirection:"column", gap:16 }}>
        {filtered.map(({ group, exercises }) => (
          <div key={group} style={{ background:"#141414", border:"1px solid #1E1E1E", borderRadius:12, overflow:"hidden" }}>
            <button 
              onClick={() => setExpanded(prev => ({ ...prev, [group]: !prev[group] }))}
              style={{ width: "100%", background: "none", border: "none", padding: "14px 18px", borderBottom: expanded[group] ? "1px solid #1E1E1E" : "none", display: "flex", alignItems: "center", justifyContent: "space-between", cursor: "pointer" }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <div style={{ fontFamily: "'Barlow Condensed',sans-serif", fontWeight: 900, fontSize: 13, textTransform: "uppercase", letterSpacing: "0.1em", color: "#E8FF47" }}>{GROUP_LABELS[group]}</div>
                <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 10, color: "#333" }}>{exercises.length} exercises</div>
              </div>
              <span style={{ color: "#333", transform: expanded[group] ? "rotate(180deg)" : "none", transition: "transform 0.2s" }}>▾</span>
            </button>

            {expanded[group] && (
              <ExerciseGroupBody
                group={group}
                exercises={search === "" ? (exerciseLibrary[group] || []) : exercises}
                exerciseNotes={exerciseNotes}
                onModal={setModal}
                onDelete={(ex) => handleDeleteExercise(group, ex)}
                onReorder={(newList) => onUpdateLibrary({ ...exerciseLibrary, [group]: newList })}
                canDrag={search === ""}
                addState={getAdd(group)}
                onAddChange={(patch) => setAdd(group, patch)}
                onAddSubmit={() => handleAddExercise(group)}
              />
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
  const [title, setTitle] = React.useState(entry?.title || "");
  const [video, setVideo] = React.useState(entry?.video || (entry?.videos && entry.videos[0]) || "");
  const [markdownContent, setMarkdownContent] = React.useState("");

  const save = async () => {
    if (!title.trim()) { alert("Please add a title"); return; }
    let videoUrl = video.trim();
    if (videoUrl && !extractYouTubeId(videoUrl)) { alert("Paste a valid YouTube URL"); return; }
    
    let filename = entry?.filename;

    if (isNew && markdownContent.trim()) {
      filename = title.trim().toLowerCase().replace(/[^a-z0-9]+/g, '_') + '.md';
      try {
        await fetch(`/api/notes/${filename}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ content: markdownContent })
        });
      } catch(err) {
        console.error("Failed to save markdown", err);
        alert("Failed to save markdown file to the backend.");
        return;
      }
    }
    
    onSave({ ...entry, title:title.trim(), video:videoUrl, filename, updatedAt: new Date().toISOString() });
    onClose();
  };

  return (
    <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.75)", zIndex:100, display:"flex", alignItems:"center", justifyContent:"center", padding:20 }} onClick={onClose}>
      <div style={{ background:"#161616", border:"1px solid #2A2A2A", borderRadius:14, width:"100%", maxWidth:560, maxHeight:"90vh", overflowY:"auto", padding:"28px" }} onClick={e => e.stopPropagation()}>
        <div style={{ display:"flex", alignItems:"flex-start", justifyContent:"space-between", marginBottom:22 }}>
          <div style={{ fontFamily:"'Barlow Condensed',sans-serif", fontWeight:900, fontSize:24, textTransform:"uppercase" }}>{isNew?"New Wisdom Entry":"Edit Metadata"}</div>
          <button onClick={onClose} style={{ background:"none", border:"none", color:"#555", cursor:"pointer", fontSize:20, lineHeight:1 }}>✕</button>
        </div>

        <div style={{ marginBottom:16 }}>
          <div className="field-label">Title</div>
          <input value={title} onChange={e => setTitle(e.target.value)} placeholder="e.g. How to brace for heavy squats"
            style={{ width:"100%", background:"#0D0D0D", border:"1px solid #2A2A2A", borderRadius:8, color:"#F5F0E8", padding:"9px 12px", fontFamily:"'DM Mono',monospace", fontSize:13, outline:"none" }}
            onFocus={e => e.target.style.borderColor="#E8FF47"} onBlur={e => e.target.style.borderColor="#2A2A2A"} />
        </div>

        <div style={{ marginBottom: isNew ? 16 : 24 }}>
          <div className="field-label">YouTube Video Link</div>
          <input value={video} onChange={e => setVideo(e.target.value)} placeholder="https://youtube.com/watch?v=..."
            style={{ width:"100%", background:"#0D0D0D", border:"1px solid #2A2A2A", borderRadius:8, color:"#F5F0E8", padding:"9px 12px", fontFamily:"'DM Mono',monospace", fontSize:13, outline:"none" }}
            onFocus={e => e.target.style.borderColor="#E8FF47"} onBlur={e => e.target.style.borderColor="#2A2A2A"} />
        </div>

        {isNew && (
          <div style={{ marginBottom:24 }}>
            <div className="field-label">Markdown Content</div>
            <textarea value={markdownContent} onChange={e => setMarkdownContent(e.target.value)} placeholder="Paste your raw markdown here..."
              style={{ width:"100%", background:"#0D0D0D", border:"1px solid #2A2A2A", borderRadius:8, color:"#F5F0E8", padding:"12px 14px", fontFamily:"'DM Mono',monospace", fontSize:12, lineHeight:1.6, resize:"vertical", minHeight:150, outline:"none" }}
              onFocus={e => e.target.style.borderColor="#E8FF47"} onBlur={e => e.target.style.borderColor="#2A2A2A"} />
          </div>
        )}

        <div style={{ display:"flex", gap:10, justifyContent:"flex-end" }}>
          <button onClick={onClose} className="ghost-btn">Cancel</button>
          <button onClick={save} className="accent-btn" style={{ padding:"9px 24px" }}>Save</button>
        </div>
      </div>
    </div>
  );
}

// ─── Wisdom Entry Detail (Markdown + Editing) ─────────────────────────────────
function WisdomEntryDetail({ entry, onUpdateEntry }) {
  const [content, setContent] = React.useState("");
  const [editing, setEditing] = React.useState(false);
  const [loading, setLoading] = React.useState(!!entry.filename);

  React.useEffect(() => {
    if (entry.filename && !editing) {
      setLoading(true);
      fetch(`/api/notes/${entry.filename}`)
        .then(res => res.json())
        .then(data => { setContent(data.content || ""); setLoading(false); })
        .catch(err => { console.error(err); setLoading(false); });
    } else if (!entry.filename) {
      setContent(entry.notes || "");
    }
  }, [entry.filename, editing]);

  const handleSave = async () => {
    if (entry.filename) {
      await fetch(`/api/notes/${entry.filename}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content })
      });
      setEditing(false);
    } else {
      onUpdateEntry({ ...entry, notes: content });
      setEditing(false);
    }
  };

  const videoCount = entry.video ? 1 : entry.videos?.length || 0;
  const videos = entry.video ? [entry.video] : entry.videos || [];

  return (
    <div style={{ borderTop:"1px solid #1A1A1A", padding:"16px 18px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 12 }}>
        <h3 style={{ margin: 0, color: "#47FFD4", fontFamily:"'Barlow Condensed',sans-serif", letterSpacing:"0.05em", textTransform:"uppercase" }}>Notes {entry.filename && "(Markdown)"}</h3>
        <button onClick={() => editing ? handleSave() : setEditing(true)} className="accent-btn" style={{ padding: "4px 12px", fontSize: 11 }}>
          {editing ? "Save" : "Edit Markdown"}
        </button>
      </div>

      {!entry.video && videoCount > 0 && (
        <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(200px,1fr))", gap:8, marginBottom: 16 }}>
          {videos.map((url,i) => <YouTubeThumbnail key={url+i} url={url} />)}
        </div>
      )}

      {loading ? (
        <div style={{ color: "#888", fontFamily:"'DM Mono',monospace", fontSize:12 }}>Loading notes...</div>
      ) : editing ? (
        <textarea
          value={content} onChange={e => setContent(e.target.value)}
          style={{ width:"100%", background:"#0D0D0D", border:"1px solid #2A2A2A", borderRadius:8, color:"#F5F0E8", padding:"12px 14px", fontFamily:"'DM Mono',monospace", fontSize:12, lineHeight:1.6, resize:"vertical", minHeight:300, outline:"none" }}
        />
      ) : (
        <div style={{ fontFamily:"system-ui, sans-serif", fontSize:14, color:"#A0A0A0", lineHeight:1.7 }} className="markdown-body">
          {entry.filename ? <ReactMarkdown>{content}</ReactMarkdown> : <div style={{ fontFamily: "'DM Mono',monospace", whiteSpace:"pre-wrap" }}>{content}</div>}
        </div>
      )}
    </div>
  );
}

// ─── General Wisdom View ──────────────────────────────────────────────────────
function WisdomView({ entries, onUpdate }) {
  const [modal, setModal]           = React.useState(null); // null | "new" | index
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
  
  const updateSingleEntry = (index, newData) => {
    const copy = [...entries]; copy[index] = newData; onUpdate(copy);
  };

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
          <div style={{ fontFamily:"'DM Mono',monospace", fontSize:11, color:"#444", marginTop:5 }}>{entries.length} entr{entries.length!==1?"ies":"y"}</div>
        </div>
        <button onClick={() => setModal("new")} className="accent-btn" style={{ padding:"10px 20px" }}>+ New Entry</button>
      </div>

      {entries.length === 0 ? (
        <div style={{ border:"1px dashed #1E1E1E", borderRadius:12, padding:"48px", textAlign:"center", color:"#3A3A3A", fontFamily:"'DM Mono',monospace", fontSize:13 }}>
          No entries yet. Hit "+ New Entry" to capture your first insight.
        </div>
      ) : (
        <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
          {entries.map((entry, index) => {
            const _i = index;
            const isOpen = expanded[_i];
            const videoCount = entry.video ? 1 : entry.videos?.length || 0;
            return (
              <div key={_i} style={{ background:"#141414", border:"1px solid #1E1E1E", borderRadius:10, overflow:"hidden" }}>
                <div
                  onClick={() => toggle(_i)}
                  style={{ display:"flex", alignItems:"center", justifyContent:"space-between", padding:"14px 18px", cursor:"pointer", gap:12 }}
                  onMouseEnter={e => e.currentTarget.style.background="#191919"}
                  onMouseLeave={e => e.currentTarget.style.background=""}
                >
                        <div style={{ flex:1, minWidth:0, display:"flex", alignItems:"center", gap: 14 }}>
                          {(entry.video || (entry.videos && entry.videos[0])) && (
                            <div style={{ width: 80, flexShrink:0 }}>
                              <YouTubeThumbnail url={entry.video || entry.videos[0]} />
                            </div>
                          )}
                          <div>
                            <div style={{ fontFamily:"'DM Mono',monospace", fontSize:13, color:"#E0E0E0", marginBottom:3 }}>{entry.title}</div>
                            {!isOpen && entry.notes && (
                              <div style={{ fontFamily:"'DM Mono',monospace", fontSize:11, color:"#444", overflow:"hidden", whiteSpace:"nowrap", textOverflow:"ellipsis", maxWidth:"300px" }}>{entry.notes}</div>
                            )}
                          </div>
                        </div>
                        <div style={{ display:"flex", alignItems:"center", gap:8, flexShrink:0 }}>
                          <button onClick={e => { e.stopPropagation(); setModal(_i); }} style={{ background:"none", border:"1px solid #252525", borderRadius:5, color:"#444", fontSize:11, cursor:"pointer", padding:"3px 9px", fontFamily:"'DM Mono',monospace", transition:"color 0.12s, border-color 0.12s" }}
                            onMouseEnter={e => { e.target.style.color="#47FFD4"; e.target.style.borderColor="#47FFD4"; }}
                            onMouseLeave={e => { e.target.style.color="#444"; e.target.style.borderColor="#252525"; }}>
                            Edit Metadata
                          </button>
                          <button onClick={e => { e.stopPropagation(); remove(_i); }} style={{ background:"none", border:"none", color:"#2E2E2E", cursor:"pointer", fontSize:14, lineHeight:1, transition:"color 0.12s" }}
                            onMouseEnter={e => e.target.style.color="#FF6B6B"}
                            onMouseLeave={e => e.target.style.color="#2E2E2E"}>✕</button>
                          <span style={{ color:"#333", fontSize:13, display:"inline-block", transform:isOpen?"rotate(180deg)":"none", transition:"transform 0.2s" }}>▾</span>
                        </div>
                      </div>

                      {isOpen && (
                        <WisdomEntryDetail entry={entry} onUpdateEntry={(updated) => updateSingleEntry(_i, updated)} />
                      )}
                    </div>
                  );
          })}
        </div>
      )}
    </div>
  );
}

// ─── App Root ─────────────────────────────────────────────────────────────────
export default function GymSplitPlanner() {
  const [state, setState]       = React.useState(null); // null = loading
  const [view, setView]         = React.useState("plan");
  const [savedFlash, setSavedFlash] = React.useState(false);

  // ── On mount: load gym data + saved state from server ──────────────────────
  React.useEffect(() => {
    async function init() {
      try {
        // 1. Always fetch the gym data (exercise library, group labels, day templates)
        const gymRes  = await fetch("/api/gymdata");
        const gymData = await gymRes.json();

        // Populate module-level vars so helper components can use them
        EXERCISE_LIBRARY = gymData.exerciseLibrary  || {};
        GROUP_LABELS     = gymData.groupLabels       || {};
        DAY_TEMPLATES    = gymData.dayTemplates      || {};

        // 2. Try to load previously saved state
        const stateRes = await fetch("/api/state");
        const saved    = await stateRes.json();

        if (saved && saved.days && Object.keys(saved.days).length > 0) {
          // Always keep exercise library in sync with gym_data.json
          saved.exerciseLibrary = { ...EXERCISE_LIBRARY, ...(saved.exerciseLibrary || {}) };
          // Merge new notes from gym_data.json without overwriting user edits
          saved.exerciseNotes = { ...(gymData.exerciseNotes || {}), ...(saved.exerciseNotes || {}) };
          // Migrate selected from old group-name keys → index keys
          for (const key of Object.keys(saved.days || {})) {
            const day = saved.days[key];
            if (day && day.activeGroups && day.activeGroups.length > 0 && day.selected && day.selected["0"] === undefined) {
              const newSelected = {};
              day.activeGroups.forEach((group, i) => {
                newSelected[String(i)] = day.selected[group] || day.selected[String(i)] || (EXERCISE_LIBRARY[group]?.[0] ?? "");
              });
              saved.days[key] = { ...day, selected: newSelected };
            }
          }
          setState(saved);
        } else {
          // First run — build defaults from gym_data.json
          setState(buildDefault(gymData));
        }
      } catch (err) {
        console.error("Failed to load data from server:", err);
        // Fallback: render with empty state so the app is usable
        setState({ days:{}, history:[], exerciseNotes:{}, wisdomEntries:[], exerciseLibrary:{} });
      }
    }
    init();
  }, []);

  // ── Auto-save: debounced write to disk on every state change ────────────────
  React.useEffect(() => {
    if (state === null) return; // don't save while still loading
    saveStateToServer(state);
  }, [state]);

  // Show a loading screen while fetching initial data
  if (state === null) {
    return (
      <div style={{ minHeight:"100vh", background:"#0D0D0D", color:"#F5F0E8", display:"flex", alignItems:"center", justifyContent:"center", fontFamily:"'DM Mono',monospace", fontSize:13, color:"#444" }}>
        Loading...
      </div>
    );
  }

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
            <div style={{ fontFamily:"'Barlow Condensed',sans-serif", fontWeight:900, fontSize:16, letterSpacing:"0.04em", textTransform:"uppercase", lineHeight:1 }}>Gains Planner</div>
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
            <div style={{ fontFamily:"'Barlow Condensed',sans-serif", fontWeight:900, fontSize:46, lineHeight:1, textTransform:"uppercase" }}>Weekly <span style={{ color:"#E8FF47" }}>Split</span></div>
            <div style={{ fontFamily:"'DM Mono',monospace", fontSize:11, color:"#3A3A3A", marginTop:5 }}>⠿ drag to reorder · ✕ to deactivate · expand inactive to add groups</div>
          </div>
          <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(290px,1fr))", gap:12 }}>
            {Object.entries(state.days || {}).map(([dayKey,day]) => (
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