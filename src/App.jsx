import { useState, useEffect, useRef } from "react";

// ─── MOCK FIREBASE LAYER ────────────────────────────────────────────────────
let mockStudents = [
  { id: "1", name: "Amara Okonkwo",  school: "Greenfield Academy", score: "88", subject: "Mathematics", uid: "demo" },
  { id: "2", name: "Chidi Eze",      school: "Riverside High",     score: "74", subject: "English",     uid: "demo" },
  { id: "3", name: "Ngozi Adeyemi",  school: "Greenfield Academy", score: "95", subject: "Science",     uid: "demo" },
];
let mockCurrentUser = null;
let snapshotCallback = null;

const mockAuth = {
  currentUser: null,
  onAuthStateChanged: (cb) => { cb(mockCurrentUser); return () => {}; },
  createUserWithEmailAndPassword: async (email) => {
    mockCurrentUser = { email, uid: "demo" };
    mockAuth.currentUser = mockCurrentUser;
    return { user: mockCurrentUser };
  },
  signInWithEmailAndPassword: async (email) => {
    mockCurrentUser = { email, uid: "demo" };
    mockAuth.currentUser = mockCurrentUser;
    return { user: mockCurrentUser };
  },
  signOut: async () => { mockCurrentUser = null; mockAuth.currentUser = null; },
};

const mockDb = {
  addStudent: async (data) => {
    const doc = { id: Date.now().toString() + Math.random(), ...data };
    mockStudents.push(doc);
    if (snapshotCallback) snapshotCallback([...mockStudents]);
    return doc;
  },
  addStudentsBulk: async (rows) => {
    const docs = rows.map(r => ({ id: Date.now().toString() + Math.random(), ...r }));
    mockStudents.push(...docs);
    if (snapshotCallback) snapshotCallback([...mockStudents]);
    return docs;
  },
  deleteStudent: async (id) => {
    mockStudents = mockStudents.filter(s => s.id !== id);
    if (snapshotCallback) snapshotCallback([...mockStudents]);
  },
  onSnapshot: (cb) => {
    snapshotCallback = cb;
    cb([...mockStudents]);
    return () => { snapshotCallback = null; };
  },
};
// ────────────────────────────────────────────────────────────────────────────

const DEFAULT_SCALE = [
  { min: 90, label: "A", color: "#00C9A7", remark: "Distinction" },
  { min: 80, label: "B", color: "#4ECDC4", remark: "Merit"       },
  { min: 70, label: "C", color: "#FFE66D", remark: "Credit"      },
  { min: 60, label: "D", color: "#FFA07A", remark: "Pass"        },
  { min: 0,  label: "F", color: "#FF6B6B", remark: "Fail"        },
];

function getGrade(score, scale = DEFAULT_SCALE) {
  const n = parseInt(score);
  for (const g of [...scale].sort((a, b) => b.min - a.min)) {
    if (n >= g.min) return g;
  }
  return scale[scale.length - 1];
}

const AVATAR_COLORS = ["#00C9A7","#FF6B6B","#4ECDC4","#FFE66D","#A8EDEA","#FED9B7","#C9B1FF","#FFB347"];

function Avatar({ name, size = 40 }) {
  const initials = name.split(" ").map(w => w[0]).join("").slice(0,2).toUpperCase();
  const ci = name.charCodeAt(0) % AVATAR_COLORS.length;
  return (
    <div style={{ width:size, height:size, borderRadius:"50%", background:AVATAR_COLORS[ci],
      display:"flex", alignItems:"center", justifyContent:"center",
      fontFamily:"'Syne',sans-serif", fontWeight:700, fontSize:size*0.38,
      color:"#1a1a2e", flexShrink:0 }}>{initials}</div>
  );
}

function ScoreRing({ score, scale = DEFAULT_SCALE, size = 72 }) {
  const n = Math.min(Math.max(parseInt(score)||0, 0), 100);
  const g = getGrade(n, scale);
  const r = size*0.39, circ = 2*Math.PI*r, offset = circ - (n/100)*circ;
  return (
    <div style={{ position:"relative", width:size, height:size, flexShrink:0 }}>
      <svg width={size} height={size} style={{ transform:"rotate(-90deg)" }}>
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="#2a2a4a" strokeWidth="5"/>
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={g.color} strokeWidth="5"
          strokeDasharray={circ} strokeDashoffset={offset} strokeLinecap="round"
          style={{ transition:"stroke-dashoffset 0.8s ease" }}/>
      </svg>
      <div style={{ position:"absolute", inset:0, display:"flex", flexDirection:"column",
        alignItems:"center", justifyContent:"center" }}>
        <span style={{ fontFamily:"'Syne',sans-serif", fontWeight:800, fontSize:size*0.21, color:"#fff", lineHeight:1 }}>{n}</span>
        <span style={{ fontFamily:"'DM Sans',sans-serif", fontSize:size*0.13, color:g.color, fontWeight:600 }}>{g.label}</span>
      </div>
    </div>
  );
}

function Toast({ msg, type, onClose }) {
  useEffect(() => { const t = setTimeout(onClose, 3500); return () => clearTimeout(t); }, []);
  const colors = { success:"#00C9A7", error:"#FF6B6B", info:"#4ECDC4", warn:"#FFE66D" };
  return (
    <div style={{ position:"fixed", bottom:32, right:32, zIndex:9999,
      background:"#1a1a2e", border:`1.5px solid ${colors[type]||colors.info}`,
      borderRadius:12, padding:"14px 22px", fontFamily:"'DM Sans',sans-serif",
      color:"#fff", fontSize:14, boxShadow:`0 8px 32px ${colors[type]||colors.info}33`,
      animation:"slideUp 0.3s ease", display:"flex", alignItems:"center", gap:10 }}>
      <span style={{ color:colors[type]||colors.info, fontSize:18 }}>
        {type==="success"?"✓":type==="error"?"✗":type==="warn"?"⚠":"ℹ"}
      </span>
      {msg}
    </div>
  );
}

// ─── CSV PARSER ──────────────────────────────────────────────────────────────
function parseCSV(text) {
  const lines = text.trim().split(/\r?\n/);
  if (lines.length < 2) return { rows:[], errors:["File has no data rows."] };
  const headers = lines[0].split(",").map(h => h.trim().toLowerCase());
  const required = ["name","school","score"];
  const missing = required.filter(r => !headers.includes(r));
  if (missing.length) return { rows:[], errors:[`Missing columns: ${missing.join(", ")}`] };
  const rows = [], errors = [];
  lines.slice(1).forEach((line, i) => {
    if (!line.trim()) return;
    const vals = line.split(",").map(v => v.trim().replace(/^"|"$/g,""));
    const row = {};
    headers.forEach((h, idx) => { row[h] = vals[idx] || ""; });
    const score = parseInt(row.score);
    if (!row.name)                                    errors.push(`Row ${i+2}: missing name`);
    else if (!row.school)                             errors.push(`Row ${i+2}: missing school`);
    else if (isNaN(score)||score<0||score>100)        errors.push(`Row ${i+2}: score "${row.score}" invalid (0–100)`);
    else rows.push({ name:row.name, school:row.school, score:String(score), subject:row.subject||"General" });
  });
  return { rows, errors };
}

// ─── UPLOAD TAB ──────────────────────────────────────────────────────────────
function UploadTab({ user, scale, notify, onDone }) {
  const [dragging, setDragging] = useState(false);
  const [preview,  setPreview]  = useState(null);
  const [loading,  setLoading]  = useState(false);
  const [done,     setDone]     = useState(false);
  const fileRef = useRef();

  const processFile = (file) => {
    if (!file) return;
    if (!file.name.endsWith(".csv")) return notify("Please upload a .csv file.", "error");
    const reader = new FileReader();
    reader.onload = (e) => {
      const { rows, errors } = parseCSV(e.target.result);
      setPreview({ rows, errors, fileName: file.name });
      setDone(false);
    };
    reader.readAsText(file);
  };

  const handleDrop = (e) => {
    e.preventDefault(); setDragging(false);
    processFile(e.dataTransfer.files[0]);
  };

  const handleImport = async () => {
    if (!preview?.rows?.length) return;
    setLoading(true);
    await mockDb.addStudentsBulk(preview.rows.map(r => ({ ...r, uid: user?.uid })));
    setLoading(false); setDone(true);
    notify(`${preview.rows.length} students imported!`, "success");
    setTimeout(onDone, 1200);
  };

  return (
    <div style={{ maxWidth:680, margin:"0 auto", animation:"fadeIn 0.3s ease" }}>
      <div style={{ fontFamily:"'Syne',sans-serif", fontWeight:700, fontSize:22, color:"#fff", marginBottom:6 }}>
        📂 Bulk Upload Class
      </div>
      <p style={{ color:"#8888aa", fontSize:14, marginBottom:20 }}>
        Upload a CSV. Required columns: <code style={{ color:"#00C9A7" }}>name, school, score</code> — Optional: <code style={{ color:"#4ECDC4" }}>subject</code>
      </p>

      <div style={{ display:"flex", gap:10, marginBottom:20 }}>
        <button style={{ padding:"9px 16px", borderRadius:8, border:"1px solid #2a2a4a", background:"#13132a",
          color:"#aaaacc", fontFamily:"'DM Sans',sans-serif", fontSize:13, cursor:"pointer" }}
          onClick={() => {
            const csv = "name,school,score,subject\nAmara Okonkwo,Greenfield Academy,88,Mathematics\nChidi Eze,Riverside High,74,English\nNgozi Adeyemi,Greenfield Academy,95,Science";
            const a = document.createElement("a");
            a.href = "data:text/csv," + encodeURIComponent(csv);
            a.download = "smartclass_template.csv"; a.click();
          }}>⬇ Download Template</button>
        <button style={{ padding:"9px 16px", borderRadius:8, border:"1px solid #2a2a4a", background:"#13132a",
          color:"#8888aa", fontFamily:"'DM Sans',sans-serif", fontSize:13, cursor:"pointer" }}
          onClick={() => { setPreview(null); setDone(false); }}>✕ Clear</button>
      </div>

      {/* Drop zone */}
      <div style={{ border:`2px dashed ${dragging?"#00C9A7":"#2a2a4a"}`, borderRadius:16,
        padding:"48px 24px", textAlign:"center", background:dragging?"#00C9A711":"#13132a",
        cursor:"pointer", transition:"all 0.2s", marginBottom:20 }}
        onDragOver={e => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
        onClick={() => fileRef.current.click()}>
        <input ref={fileRef} type="file" accept=".csv" style={{ display:"none" }}
          onChange={e => processFile(e.target.files[0])}/>
        <div style={{ fontSize:38, marginBottom:10 }}>{dragging?"📥":"📄"}</div>
        <div style={{ fontFamily:"'Syne',sans-serif", fontWeight:700, color:"#fff", fontSize:16 }}>
          {dragging ? "Drop it!" : "Drag & drop your CSV here"}
        </div>
        <div style={{ color:"#555577", fontSize:13, marginTop:6 }}>or click to browse</div>
      </div>

      {/* Preview panel */}
      {preview && (
        <div style={{ background:"#1a1a2e", border:"1px solid #2a2a4a", borderRadius:14, padding:20 }}>
          <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:16, flexWrap:"wrap", gap:8 }}>
            <div style={{ fontFamily:"'Syne',sans-serif", fontWeight:700, color:"#fff" }}>📋 {preview.fileName}</div>
            <div style={{ display:"flex", gap:8 }}>
              <span style={{ background:"#00C9A722", color:"#00C9A7", borderRadius:6, padding:"4px 10px", fontSize:13, fontWeight:600 }}>
                ✓ {preview.rows.length} valid
              </span>
              {preview.errors.length > 0 && (
                <span style={{ background:"#FF6B6B22", color:"#FF6B6B", borderRadius:6, padding:"4px 10px", fontSize:13, fontWeight:600 }}>
                  ✗ {preview.errors.length} errors
                </span>
              )}
            </div>
          </div>

          {preview.errors.map((e,i) => (
            <div key={i} style={{ color:"#FF6B6B", fontSize:13, background:"#2a0a0a",
              border:"1px solid #FF6B6B33", borderRadius:6, padding:"8px 12px", marginBottom:6 }}>⚠ {e}</div>
          ))}

          {preview.rows.slice(0,8).map((r,i) => {
            const g = getGrade(r.score, scale);
            return (
              <div key={i} style={{ display:"flex", alignItems:"center", gap:12, padding:"10px 14px",
                borderRadius:8, background:"#13132a", border:"1px solid #2a2a4a", marginBottom:6, animation:"fadeIn 0.2s ease" }}>
                <Avatar name={r.name} size={32}/>
                <div style={{ flex:1 }}>
                  <div style={{ fontFamily:"'Syne',sans-serif", fontWeight:700, color:"#fff", fontSize:14 }}>{r.name}</div>
                  <div style={{ color:"#8888aa", fontSize:12 }}>{r.school} · {r.subject}</div>
                </div>
                <div style={{ background:g.color+"22", color:g.color, borderRadius:6,
                  padding:"3px 10px", fontFamily:"'Syne',sans-serif", fontWeight:700, fontSize:13 }}>
                  {r.score} · {g.label}
                </div>
              </div>
            );
          })}
          {preview.rows.length > 8 && (
            <div style={{ color:"#555577", fontSize:13, textAlign:"center", padding:"8px 0" }}>
              … and {preview.rows.length - 8} more rows
            </div>
          )}

          {preview.rows.length > 0 && (
            <button style={{ marginTop:16, width:"100%", padding:"13px", borderRadius:10, border:"none",
              background: done?"#00C9A7":"linear-gradient(135deg,#00C9A7,#4ECDC4)",
              color:"#0f0f23", fontFamily:"'Syne',sans-serif", fontWeight:700, fontSize:15,
              cursor:loading||done?"default":"pointer", opacity:loading?0.8:1, transition:"all 0.2s" }}
              onClick={handleImport} disabled={loading||done}>
              {done?"✓ Imported!":loading?"Importing…":`Import ${preview.rows.length} Students →`}
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// ─── GRADING TAB ─────────────────────────────────────────────────────────────
function GradingTab({ scale, setScale, notify }) {
  const [local, setLocal] = useState(scale.map(g => ({ ...g })));
  const [saved, setSaved] = useState(false);
  const PRESET_COLORS = ["#00C9A7","#4ECDC4","#FFE66D","#FFA07A","#FF6B6B","#C9B1FF","#FFB347","#A8EDEA"];

  const update = (i, field, val) => {
    setLocal(prev => prev.map((g,idx) => idx===i ? { ...g, [field]: field==="min"?parseInt(val)||0:val } : g));
    setSaved(false);
  };
  const addBand = () => { setLocal(prev => [...prev, { min:50, label:"E", color:"#C9B1FF", remark:"New Band" }]); setSaved(false); };
  const removeBand = (i) => {
    if (local.length <= 2) return notify("Need at least 2 grade bands.", "warn");
    setLocal(prev => prev.filter((_,idx)=>idx!==i)); setSaved(false);
  };
  const handleSave = () => {
    const sorted = [...local].sort((a,b) => b.min-a.min);
    const mins = sorted.map(g=>g.min);
    if (new Set(mins).size !== mins.length) return notify("Each band needs a unique minimum score.", "error");
    setScale(sorted); setSaved(true);
    notify("Grading scale saved!", "success");
  };
  const handleReset = () => { setLocal(DEFAULT_SCALE.map(g=>({...g}))); setSaved(false); notify("Reset to default.", "info"); };

  const sorted = [...local].sort((a,b) => b.min-a.min);

  return (
    <div style={{ maxWidth:700, margin:"0 auto", animation:"fadeIn 0.3s ease" }}>
      <div style={{ fontFamily:"'Syne',sans-serif", fontWeight:700, fontSize:22, color:"#fff", marginBottom:6 }}>
        🎯 Grading Scale
      </div>
      <p style={{ color:"#8888aa", fontSize:14, marginBottom:20 }}>
        Define custom grade bands, labels, colors, and remarks. Changes apply across all records instantly.
      </p>

      {/* Visual scale bar */}
      <div style={{ background:"#1a1a2e", border:"1px solid #2a2a4a", borderRadius:12, padding:"14px 18px", marginBottom:22 }}>
        <div style={{ color:"#555577", fontSize:11, fontWeight:600, letterSpacing:1, marginBottom:8 }}>SCALE PREVIEW</div>
        <div style={{ display:"flex", height:14, borderRadius:7, overflow:"hidden", gap:2 }}>
          {sorted.map((g,i) => {
            const next = sorted[i+1];
            const width = next ? g.min - next.min : g.min;
            return <div key={i} style={{ flex:width, background:g.color, borderRadius:3 }} title={`${g.label} ≥${g.min}`}/>;
          })}
        </div>
        <div style={{ display:"flex", gap:14, flexWrap:"wrap", marginTop:10 }}>
          {sorted.map(g => (
            <span key={g.label} style={{ display:"flex", alignItems:"center", gap:5, fontSize:12, color:"#aaaacc" }}>
              <span style={{ width:10, height:10, borderRadius:2, background:g.color, display:"inline-block" }}/>
              {g.label} · {g.remark} (≥{g.min})
            </span>
          ))}
        </div>
      </div>

      {/* Band editors */}
      {sorted.map((g,i) => (
        <div key={i} style={{ background:"#1a1a2e", border:`1px solid ${g.color}44`,
          borderLeft:`4px solid ${g.color}`, borderRadius:12, padding:"16px 18px", marginBottom:12 }}>
          <div style={{ display:"flex", gap:10, alignItems:"flex-end", flexWrap:"wrap" }}>
            {/* Label */}
            <div style={{ flex:"0 0 58px" }}>
              <div style={{ color:"#555577", fontSize:11, marginBottom:5 }}>LABEL</div>
              <input value={g.label} onChange={e=>update(i,"label",e.target.value)}
                style={{ width:"100%", padding:"9px 10px", borderRadius:8, background:"#13132a",
                  border:"1.5px solid #2a2a4a", color:g.color, fontFamily:"'Syne',sans-serif",
                  fontWeight:800, fontSize:17, textAlign:"center", outline:"none" }}/>
            </div>
            {/* Min */}
            <div style={{ flex:"0 0 88px" }}>
              <div style={{ color:"#555577", fontSize:11, marginBottom:5 }}>MIN SCORE</div>
              <input type="number" min="0" max="100" value={g.min} onChange={e=>update(i,"min",e.target.value)}
                style={{ width:"100%", padding:"9px 10px", borderRadius:8, background:"#13132a",
                  border:"1.5px solid #2a2a4a", color:"#fff", fontFamily:"'DM Sans',sans-serif", fontSize:15, outline:"none" }}/>
            </div>
            {/* Remark */}
            <div style={{ flex:1, minWidth:100 }}>
              <div style={{ color:"#555577", fontSize:11, marginBottom:5 }}>REMARK</div>
              <input value={g.remark} onChange={e=>update(i,"remark",e.target.value)}
                style={{ width:"100%", padding:"9px 10px", borderRadius:8, background:"#13132a",
                  border:"1.5px solid #2a2a4a", color:"#fff", fontFamily:"'DM Sans',sans-serif",
                  fontSize:14, outline:"none", boxSizing:"border-box" }}/>
            </div>
            {/* Colors */}
            <div>
              <div style={{ color:"#555577", fontSize:11, marginBottom:5 }}>COLOR</div>
              <div style={{ display:"flex", gap:4, flexWrap:"wrap", maxWidth:120 }}>
                {PRESET_COLORS.map(c => (
                  <div key={c} onClick={()=>update(i,"color",c)}
                    style={{ width:22, height:22, borderRadius:5, background:c, cursor:"pointer",
                      border:g.color===c?"2.5px solid #fff":"2.5px solid transparent", transition:"border 0.15s" }}/>
                ))}
              </div>
            </div>
            {/* Remove */}
            <button onClick={()=>removeBand(i)}
              style={{ padding:"9px 12px", borderRadius:8, border:"1px solid #FF6B6B33",
                background:"transparent", color:"#FF6B6B", cursor:"pointer",
                fontFamily:"'DM Sans',sans-serif", fontSize:14 }}>✕</button>
          </div>
        </div>
      ))}

      <div style={{ display:"flex", gap:10, marginTop:6 }}>
        <button onClick={addBand}
          style={{ flex:1, padding:"12px", borderRadius:10, border:"1px solid #2a2a4a",
            background:"#13132a", color:"#aaaacc", fontFamily:"'Syne',sans-serif",
            fontWeight:600, fontSize:14, cursor:"pointer" }}>+ Add Band</button>
        <button onClick={handleReset}
          style={{ padding:"12px 16px", borderRadius:10, border:"1px solid #2a2a4a",
            background:"#13132a", color:"#8888aa", fontFamily:"'DM Sans',sans-serif", fontSize:14, cursor:"pointer" }}>Reset</button>
        <button onClick={handleSave}
          style={{ flex:2, padding:"12px", borderRadius:10, border:"none",
            background:saved?"#00C9A7":"linear-gradient(135deg,#00C9A7,#4ECDC4)",
            color:"#0f0f23", fontFamily:"'Syne',sans-serif", fontWeight:700,
            fontSize:15, cursor:"pointer", transition:"all 0.2s" }}>
          {saved?"✓ Saved":"Save Scale →"}
        </button>
      </div>

      {/* Reference table */}
      <div style={{ background:"#1a1a2e", border:"1px solid #2a2a4a", borderRadius:12, padding:18, marginTop:24 }}>
        <div style={{ color:"#555577", fontSize:11, fontWeight:600, letterSpacing:1, marginBottom:12 }}>CURRENT SCALE REFERENCE</div>
        {sorted.map((g,i) => {
          const upper = i===0 ? 100 : sorted[i-1].min - 1;
          const lower = i < sorted.length-1 ? sorted[i+1].min : 0;
          return (
            <div key={g.label} style={{ display:"flex", alignItems:"center", gap:12,
              padding:"9px 0", borderBottom:"1px solid #2a2a4a" }}>
              <div style={{ width:34, height:34, borderRadius:8, background:g.color+"22",
                border:`1px solid ${g.color}44`, display:"flex", alignItems:"center",
                justifyContent:"center", fontFamily:"'Syne',sans-serif",
                fontWeight:800, color:g.color, fontSize:16 }}>{g.label}</div>
              <div style={{ flex:1 }}>
                <span style={{ color:"#fff", fontWeight:600, fontSize:14 }}>{g.remark}</span>
                <span style={{ color:"#555577", fontSize:12, marginLeft:8 }}>{lower} – {upper}</span>
              </div>
              <div style={{ background:g.color+"22", color:g.color,
                borderRadius:6, padding:"3px 10px", fontSize:13, fontWeight:600 }}>≥ {g.min}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── MAIN APP ─────────────────────────────────────────────────────────────────
export default function App() {
  const [user, setUser]           = useState(null);
  const [students, setStudents]   = useState([]);
  const [tab, setTab]             = useState("dashboard");
  const [toast, setToast]         = useState(null);
  const [loading, setLoading]     = useState(false);
  const [search, setSearch]       = useState("");
  const [deleting, setDeleting]   = useState(null);
  const [scale, setScale]         = useState(DEFAULT_SCALE);
  const [filterGrade, setFilterGrade] = useState("all");

  const [email, setEmail]         = useState("");
  const [password, setPassword]   = useState("");
  const [authMode, setAuthMode]   = useState("login");

  const [sName, setSName]         = useState("");
  const [sSchool, setSSchool]     = useState("");
  const [sScore, setSScore]       = useState("");
  const [sSubject, setSSubject]   = useState("");

  const notify = (msg, type="info") => setToast({ msg, type });

  useEffect(() => { return mockAuth.onAuthStateChanged(setUser); }, []);
  useEffect(() => { return mockDb.onSnapshot(setStudents); }, []);

  const handleAuth = async () => {
    if (!email||!password) return notify("Fill in email and password.", "error");
    setLoading(true);
    try {
      authMode==="register"
        ? await mockAuth.createUserWithEmailAndPassword(email, password)
        : await mockAuth.signInWithEmailAndPassword(email, password);
      notify(authMode==="register"?"Account created! Welcome.":"Logged in successfully.", "success");
      setTab("dashboard");
    } catch(e) { notify(e.message||"Auth failed.", "error"); }
    setLoading(false);
  };

  const handleSave = async () => {
    if (!sName||!sSchool||!sScore) return notify("All fields are required.", "error");
    const n = parseInt(sScore);
    if (isNaN(n)||n<0||n>100) return notify("Score must be 0–100.", "error");
    setLoading(true);
    try {
      await mockDb.addStudent({ name:sName, school:sSchool, score:String(n), subject:sSubject||"General", uid:user?.uid });
      setSName(""); setSSchool(""); setSScore(""); setSSubject("");
      notify("Student record saved!", "success");
      setTab("dashboard");
    } catch(e) { notify("Failed to save.", "error"); }
    setLoading(false);
  };

  const handleDelete = async (id) => {
    setDeleting(id);
    await mockDb.deleteStudent(id);
    notify("Record removed.", "info");
    setDeleting(null);
  };

  const avgScore = students.length
    ? Math.round(students.reduce((a,s)=>a+(parseInt(s.score)||0),0)/students.length) : 0;
  const topStudent = students.length
    ? students.reduce((a,b)=>parseInt(b.score)>parseInt(a.score)?b:a, students[0]) : null;

  const filtered = students.filter(s => {
    const q = search.toLowerCase();
    const matchSearch = s.name.toLowerCase().includes(q)||s.school.toLowerCase().includes(q)||(s.subject||"").toLowerCase().includes(q);
    const matchGrade  = filterGrade==="all" || getGrade(s.score, scale).label===filterGrade;
    return matchSearch && matchGrade;
  });

  const fonts = (
    <style>{`
      @import url('https://fonts.googleapis.com/css2?family=Syne:wght@700;800&family=DM+Sans:wght@400;500;600&display=swap');
      * { box-sizing:border-box; }
      input:focus { border-color:#00C9A7 !important; }
      @keyframes slideUp { from{opacity:0;transform:translateY(16px)} to{opacity:1;transform:translateY(0)} }
      @keyframes fadeIn  { from{opacity:0;transform:translateY(8px)}  to{opacity:1;transform:translateY(0)} }
      .s-row:hover { border-color:#00C9A733 !important; }
      .del-btn:hover { background:#FF6B6B22 !important; }
      .ntab:hover { color:#cccce8 !important; }
    `}</style>
  );

  const TABS = [
    { id:"dashboard", icon:"📊", label:"Dashboard"  },
    { id:"add",       icon:"➕", label:"Add Student" },
    { id:"upload",    icon:"📂", label:"Upload Class"},
    { id:"grading",   icon:"🎯", label:"Grading"    },
    { id:"account",   icon:"👤", label:"Account"    },
  ];

  const rootStyle = { minHeight:"100vh", background:"#0f0f23",
    backgroundImage:"radial-gradient(ellipse at 20% 0%,#1a0a3a 0%,transparent 60%),radial-gradient(ellipse at 80% 100%,#0a2a3a 0%,transparent 60%)",
    fontFamily:"'DM Sans',sans-serif", color:"#e8e8ff", paddingBottom:60 };

  const inp = { width:"100%", padding:"12px 14px", borderRadius:10, background:"#13132a",
    border:"1.5px solid #2a2a4a", color:"#e8e8ff", fontFamily:"'DM Sans',sans-serif",
    fontSize:15, outline:"none", transition:"border-color 0.2s", marginBottom:11, boxSizing:"border-box" };

  const btn = (v="primary") => ({ padding:"12px 22px", borderRadius:10, border:"none", cursor:"pointer",
    fontFamily:"'Syne',sans-serif", fontWeight:700, fontSize:15,
    background: v==="primary"?"linear-gradient(135deg,#00C9A7,#4ECDC4)":v==="danger"?"transparent":"#1a1a3a",
    color: v==="primary"?"#0f0f23":v==="danger"?"#FF6B6B":"#aaaacc",
    border: v==="danger"?"1px solid #FF6B6B33":v==="sec"?"1px solid #2a2a4a":"none",
    transition:"all 0.2s" });

  // ── Auth ───────────────────────────────────────────────────────────────────
  if (!user) return (
    <div style={rootStyle}>
      {fonts}
      <div style={{ maxWidth:420, margin:"60px auto", padding:"0 24px" }}>
        <div style={{ textAlign:"center", marginBottom:28 }}>
          <div style={{ width:54, height:54, borderRadius:14, background:"linear-gradient(135deg,#00C9A7,#4ECDC4)",
            display:"flex", alignItems:"center", justifyContent:"center", fontSize:26, margin:"0 auto 14px" }}>🎓</div>
          <div style={{ fontFamily:"'Syne',sans-serif", fontWeight:800, fontSize:26, color:"#fff" }}>SmartClass</div>
          <div style={{ color:"#8888aa", fontSize:14, marginTop:4 }}>Ihe Student Portal</div>
        </div>
        <div style={{ background:"#1a1a2e", border:"1px solid #2a2a4a", borderRadius:20, padding:34 }}>
          <div style={{ display:"flex", marginBottom:26, borderRadius:10, overflow:"hidden", border:"1px solid #2a2a4a" }}>
            {["login","register"].map(m=>(
              <button key={m} onClick={()=>setAuthMode(m)}
                style={{ flex:1, padding:"11px 0", border:"none", cursor:"pointer",
                  fontFamily:"'Syne',sans-serif", fontWeight:700, fontSize:14,
                  background:authMode===m?"#00C9A7":"transparent",
                  color:authMode===m?"#0f0f23":"#8888aa", transition:"all 0.2s" }}>
                {m==="login"?"Sign In":"Register"}
              </button>
            ))}
          </div>
          <input style={inp} placeholder="Email address" value={email}
            onChange={e=>setEmail(e.target.value)} type="email" onKeyDown={e=>e.key==="Enter"&&handleAuth()}/>
          <input style={inp} placeholder="Password" value={password}
            onChange={e=>setPassword(e.target.value)} type="password" onKeyDown={e=>e.key==="Enter"&&handleAuth()}/>
          <button style={{ ...btn("primary"), width:"100%", marginTop:4 }} onClick={handleAuth} disabled={loading}>
            {loading?"Please wait…":authMode==="login"?"Sign In →":"Create Account →"}
          </button>
          <p style={{ textAlign:"center", color:"#555577", fontSize:12, marginTop:18 }}>Demo: any email + password works</p>
        </div>
      </div>
      {toast && <Toast msg={toast.msg} type={toast.type} onClose={()=>setToast(null)}/>}
    </div>
  );

  // ── Main ───────────────────────────────────────────────────────────────────
  return (
    <div style={rootStyle}>
      {fonts}

      {/* Header */}
      <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between",
        padding:"18px 28px", borderBottom:"1px solid #2a2a4a", marginBottom:26, flexWrap:"wrap", gap:10 }}>
        <div style={{ fontFamily:"'Syne',sans-serif", fontWeight:800, fontSize:19, color:"#fff",
          display:"flex", alignItems:"center", gap:10 }}>
          <div style={{ width:32, height:32, borderRadius:9, background:"linear-gradient(135deg,#00C9A7,#4ECDC4)",
            display:"flex", alignItems:"center", justifyContent:"center", fontSize:16 }}>🎓</div>
          SmartClass <span style={{ color:"#00C9A7" }}>Ihe</span>
        </div>
        <div style={{ display:"flex", gap:2, flexWrap:"wrap" }}>
          {TABS.map(t => (
            <button key={t.id} className="ntab"
              style={{ padding:"8px 13px", borderRadius:8, border:"none", cursor:"pointer",
                fontFamily:"'DM Sans',sans-serif", fontWeight:600, fontSize:13,
                background:tab===t.id?"#00C9A7":"transparent",
                color:tab===t.id?"#0f0f23":"#8888aa", transition:"all 0.2s" }}
              onClick={()=>setTab(t.id)}>
              {t.icon} {t.label}
            </button>
          ))}
        </div>
        <div style={{ display:"flex", alignItems:"center", gap:8, background:"#1a1a3a",
          borderRadius:20, padding:"6px 14px 6px 6px", fontSize:13, color:"#aaaacc" }}>
          <div style={{ width:26, height:26, borderRadius:"50%", background:"#00C9A7",
            display:"flex", alignItems:"center", justifyContent:"center",
            fontSize:12, color:"#0f0f23", fontWeight:700 }}>
            {user.email?.[0]?.toUpperCase()}
          </div>
          {user.email?.split("@")[0]}
        </div>
      </div>

      <div style={{ maxWidth:960, margin:"0 auto", padding:"0 22px" }}>

        {/* ── DASHBOARD ── */}
        {tab==="dashboard" && (
          <div style={{ animation:"fadeIn 0.3s ease" }}>
            {/* Stats */}
            <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(150px,1fr))", gap:14, marginBottom:22 }}>
              {[
                { label:"Total Students",  value:students.length,               accent:"#4ECDC4", icon:"👥" },
                { label:"Average Score",   value:`${avgScore}%`,                accent:"#00C9A7", icon:"📈" },
                { label:"Top Performer",   value:topStudent?.name?.split(" ")[0]||"—", accent:"#FFE66D", icon:"🏆" },
                { label:"Grade Bands",     value:scale.length,                  accent:"#C9B1FF", icon:"🎯" },
              ].map(stat=>(
                <div key={stat.label} style={{ background:"#1a1a2e", border:`1px solid ${stat.accent}33`,
                  borderRadius:14, padding:"17px 18px", position:"relative", overflow:"hidden" }}>
                  <div style={{ position:"absolute", top:-30, right:-30, width:80, height:80, borderRadius:"50%",
                    background:stat.accent, opacity:0.12, filter:"blur(20px)" }}/>
                  <div style={{ fontSize:20, marginBottom:6 }}>{stat.icon}</div>
                  <div style={{ fontFamily:"'Syne',sans-serif", fontWeight:800, fontSize:22, color:"#fff" }}>{stat.value}</div>
                  <div style={{ color:"#8888aa", fontSize:12, marginTop:2 }}>{stat.label}</div>
                </div>
              ))}
            </div>

            {/* Search + filter */}
            <div style={{ display:"flex", gap:10, marginBottom:14, flexWrap:"wrap" }}>
              <div style={{ position:"relative", flex:1, minWidth:180 }}>
                <span style={{ position:"absolute", left:12, top:"50%", transform:"translateY(-50%)", color:"#555577" }}>🔍</span>
                <input style={{ ...inp, marginBottom:0, paddingLeft:38 }}
                  placeholder="Search name, school, subject…" value={search} onChange={e=>setSearch(e.target.value)}/>
              </div>
              <select value={filterGrade} onChange={e=>setFilterGrade(e.target.value)}
                style={{ padding:"12px 14px", borderRadius:10, background:"#13132a",
                  border:"1.5px solid #2a2a4a", color:"#e8e8ff",
                  fontFamily:"'DM Sans',sans-serif", fontSize:14, outline:"none", cursor:"pointer" }}>
                <option value="all">All Grades</option>
                {[...scale].sort((a,b)=>b.min-a.min).map(g=>(
                  <option key={g.label} value={g.label}>{g.label} – {g.remark}</option>
                ))}
              </select>
              <button style={{ ...btn("sec"), padding:"12px 16px", fontSize:13,
                background:"#13132a", border:"1px solid #2a2a4a", color:"#aaaacc" }}
                onClick={()=>setTab("upload")}>📂 Upload</button>
            </div>

            <div style={{ fontFamily:"'Syne',sans-serif", fontWeight:700, fontSize:16, color:"#fff", marginBottom:12 }}>
              Student Records <span style={{ color:"#555577", fontWeight:400, fontSize:14 }}>({filtered.length})</span>
            </div>

            {filtered.length===0 ? (
              <div style={{ textAlign:"center", padding:"48px 0", color:"#555577" }}>
                <div style={{ fontSize:40, marginBottom:12 }}>📋</div>
                {search||filterGrade!=="all"?"No students match your filters.":"No records yet — add or upload students!"}
              </div>
            ) : filtered.map((s,i) => {
              const g = getGrade(s.score, scale);
              return (
                <div key={s.id} className="s-row"
                  style={{ display:"flex", alignItems:"center", gap:12, padding:"13px 15px", borderRadius:12,
                    background:"#13132a", border:"1px solid #2a2a4a", marginBottom:8,
                    transition:"border-color 0.2s", animationDelay:`${i*0.03}s`, animation:"fadeIn 0.3s ease both" }}>
                  <Avatar name={s.name}/>
                  <div style={{ flex:1 }}>
                    <div style={{ fontFamily:"'Syne',sans-serif", fontWeight:700, color:"#fff", fontSize:15 }}>{s.name}</div>
                    <div style={{ color:"#8888aa", fontSize:12, marginTop:2 }}>
                      🏫 {s.school}
                      {s.subject && <span style={{ marginLeft:8, color:"#555577" }}>· {s.subject}</span>}
                    </div>
                  </div>
                  <div style={{ background:g.color+"18", color:g.color, borderRadius:6,
                    padding:"3px 10px", fontSize:12, fontWeight:600, whiteSpace:"nowrap" }}>
                    {g.label} · {g.remark}
                  </div>
                  <ScoreRing score={s.score} scale={scale} size={58}/>
                  <button className="del-btn" style={{ ...btn("danger"), padding:"8px 12px", fontSize:13 }}
                    onClick={()=>handleDelete(s.id)} disabled={deleting===s.id}>
                    {deleting===s.id?"…":"✕"}
                  </button>
                </div>
              );
            })}
          </div>
        )}

        {/* ── ADD STUDENT ── */}
        {tab==="add" && (
          <div style={{ maxWidth:500, margin:"0 auto", animation:"fadeIn 0.3s ease" }}>
            <div style={{ background:"#1a1a2e", border:"1px solid #2a2a4a", borderRadius:16, padding:24 }}>
              <div style={{ fontFamily:"'Syne',sans-serif", fontWeight:700, fontSize:18, color:"#fff", marginBottom:16 }}>Add Student Record</div>
              <input style={inp} placeholder="Full Name"   value={sName}    onChange={e=>setSName(e.target.value)}/>
              <input style={inp} placeholder="School"      value={sSchool}  onChange={e=>setSSchool(e.target.value)}/>
              <input style={inp} placeholder="Subject (e.g. Mathematics)" value={sSubject} onChange={e=>setSSubject(e.target.value)}/>
              <input style={inp} placeholder="Score (0–100)" value={sScore} onChange={e=>setSScore(e.target.value)} type="number" min="0" max="100"/>
              {sScore && !isNaN(parseInt(sScore)) && (
                <div style={{ display:"flex", alignItems:"center", gap:14, marginBottom:14,
                  padding:"14px 16px", background:"#13132a", borderRadius:10 }}>
                  <ScoreRing score={sScore} scale={scale} size={62}/>
                  <div>
                    <div style={{ color:"#8888aa", fontSize:13 }}>Grade preview</div>
                    <div style={{ fontFamily:"'Syne',sans-serif", fontWeight:700, color:"#fff", fontSize:18 }}>
                      {getGrade(sScore, scale).label} — {getGrade(sScore, scale).remark}
                    </div>
                    <div style={{ color:"#555577", fontSize:12 }}>{sScore} / 100</div>
                  </div>
                </div>
              )}
              <button style={{ ...btn("primary"), width:"100%" }} onClick={handleSave} disabled={loading}>
                {loading?"Saving…":"Save Record →"}
              </button>
            </div>
          </div>
        )}

        {/* ── UPLOAD CLASS ── */}
        {tab==="upload" && (
          <UploadTab user={user} scale={scale} notify={notify} onDone={()=>setTab("dashboard")}/>
        )}

        {/* ── GRADING ── */}
        {tab==="grading" && (
          <GradingTab scale={scale} setScale={setScale} notify={notify}/>
        )}

        {/* ── ACCOUNT ── */}
        {tab==="account" && (
          <div style={{ maxWidth:440, margin:"0 auto", animation:"fadeIn 0.3s ease" }}>
            <div style={{ background:"#1a1a2e", border:"1px solid #2a2a4a", borderRadius:16, padding:24 }}>
              <div style={{ textAlign:"center", marginBottom:22 }}>
                <div style={{ width:68, height:68, borderRadius:"50%",
                  background:"linear-gradient(135deg,#00C9A7,#4ECDC4)",
                  margin:"0 auto 12px", display:"flex", alignItems:"center",
                  justifyContent:"center", fontSize:27, color:"#0f0f23",
                  fontWeight:800, fontFamily:"'Syne',sans-serif" }}>
                  {user.email?.[0]?.toUpperCase()}
                </div>
                <div style={{ fontFamily:"'Syne',sans-serif", fontWeight:700, fontSize:17, color:"#fff" }}>{user.email}</div>
                <div style={{ color:"#555577", fontSize:13, marginTop:4 }}>Portal Administrator</div>
              </div>
              <div style={{ background:"#13132a", borderRadius:10, padding:"14px 18px", marginBottom:18 }}>
                {[
                  ["Records managed",     students.length],
                  ["Average class score", `${avgScore}%`],
                  ["Top score",           students.length?Math.max(...students.map(s=>parseInt(s.score)||0)):"—"],
                  ["Grade bands defined", scale.length],
                ].map(([label,val])=>(
                  <div key={label} style={{ display:"flex", justifyContent:"space-between",
                    padding:"8px 0", borderBottom:"1px solid #2a2a4a" }}>
                    <span style={{ color:"#8888aa", fontSize:14 }}>{label}</span>
                    <span style={{ fontFamily:"'Syne',sans-serif", fontWeight:700, color:"#fff" }}>{val}</span>
                  </div>
                ))}
              </div>
              <div style={{ display:"flex", gap:10 }}>
                <button style={{ ...btn(), flex:1, background:"#13132a", border:"1px solid #2a2a4a",
                  color:"#aaaacc", fontSize:14 }} onClick={()=>setTab("grading")}>⚙ Manage Grading</button>
                <button style={{ ...btn("danger"), flex:1 }}
                  onClick={()=>{mockAuth.signOut();notify("Signed out.","info");}}>Sign Out</button>
              </div>
            </div>
          </div>
        )}

      </div>
      {toast && <Toast msg={toast.msg} type={toast.type} onClose={()=>setToast(null)}/>}
    </div>
  );
}

/*
─────────────────────────────────────────────────
  FIREBASE INTEGRATION

  Bulk upload → use Firestore batched writes:
    const batch = writeBatch(db);
    rows.forEach(r => batch.set(doc(collection(db,"students")), r));
    await batch.commit();

  Persist grading scale across sessions:
    await setDoc(doc(db,"config","grading"), { scale });
    onSnapshot(doc(db,"config","grading"), snap => setScale(snap.data().scale));
─────────────────────────────────────────────────
*/
