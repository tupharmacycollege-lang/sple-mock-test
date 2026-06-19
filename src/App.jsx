import { useState, useEffect } from "react";
import * as XLSX from "xlsx";

const API_URL = "https://y0ww5f6rnf.execute-api.eu-north-1.amazonaws.com/prod";

const DB = {
  getUsers: () => JSON.parse(localStorage.getItem("sple_users") || "[]"),
  saveUsers: (u) => localStorage.setItem("sple_users", JSON.stringify(u)),
  getResults: () => JSON.parse(localStorage.getItem("sple_results") || "[]"),
  saveResults: (r) => localStorage.setItem("sple_results", JSON.stringify(r)),
  // Shared bank (legacy + manual)
  getQuestions: () => { const s = localStorage.getItem("sple_questions"); return s ? JSON.parse(s) : DEFAULT_QUESTIONS; },
  saveQuestions: (q) => localStorage.setItem("sple_questions", JSON.stringify(q)),
  // Study-only bank
  getStudyQuestions: () => { const s = localStorage.getItem("sple_study_questions"); return s ? JSON.parse(s) : []; },
  saveStudyQuestions: (q) => localStorage.setItem("sple_study_questions", JSON.stringify(q)),
  // Exam-only bank
  getExamQuestions: () => { const s = localStorage.getItem("sple_exam_questions"); return s ? JSON.parse(s) : []; },
  saveExamQuestions: (q) => localStorage.setItem("sple_exam_questions", JSON.stringify(q)),
  getStudySettings: () => JSON.parse(localStorage.getItem("sple_study_settings") || "null") || { totalQ: 50, diffPct: { "سهل": 33, "متوسط": 34, "صعب": 33 } },
  saveStudySettings: (s) => localStorage.setItem("sple_study_settings", JSON.stringify(s)),
  getExamSettings: () => JSON.parse(localStorage.getItem("sple_exam_settings") || "null") || { totalQ: 100, timeMins: 120, diffPct: { "سهل": 30, "متوسط": 40, "صعب": 30 } },
  saveExamSettings: (s) => localStorage.setItem("sple_exam_settings", JSON.stringify(s)),
};

const ADMIN = { email: "admin123", password: "123456" };

const DEFAULT_QUESTIONS = [
  { id:"q1", section:"Pharmaceutical Sciences", category:"Pharmacology", difficulty:"متوسط", question:"Which of the following is the mechanism of action of ACE inhibitors?", options:["Block AT1 receptors","Inhibit conversion of angiotensin I to angiotensin II","Block aldosterone receptors","Inhibit renin secretion"], answer:1, explanation:"ACE inhibitors block angiotensin-converting enzyme, preventing conversion of Ang I to Ang II, also decrease bradykinin degradation causing dry cough." },
  { id:"q2", section:"Pharmaceutical Sciences", category:"Pharmacology", difficulty:"سهل", question:"What is the antidote for acetaminophen (paracetamol) overdose?", options:["Naloxone","Flumazenil","N-acetylcysteine (NAC)","Activated charcoal only"], answer:2, explanation:"NAC replenishes glutathione stores and detoxifies NAPQI, the toxic metabolite of acetaminophen overdose." },
  { id:"q3", section:"Pharmaceutical Sciences", category:"Pharmacokinetics", difficulty:"صعب", question:"A drug has Vd of 500L in a 70kg patient. This suggests:", options:["Confined to plasma","ECF distribution only","Extensively distributed into tissues","Primarily protein-bound"], answer:2, explanation:"Large Vd (>200L) indicates extensive tissue distribution beyond plasma (~3L), ECF (~14L), and TBW (~42L)." },
  { id:"q4", section:"Clinical Sciences", category:"Clinical Pharmacology", difficulty:"متوسط", question:"Target INR range for atrial fibrillation on warfarin therapy:", options:["1.0–1.5","2.0–3.0","2.5–3.5","3.5–4.5"], answer:1, explanation:"For AF, target INR is 2.0–3.0. INR 2.5–3.5 is for mechanical heart valves (mitral position)." },
  { id:"q5", section:"Basic Biomedical Sciences", category:"Immunology", difficulty:"صعب", question:"Anaphylaxis hypersensitivity reaction is mediated by:", options:["IgG + complement","IgE on mast cells","Immune complex deposition","Cytotoxic T-cells"], answer:1, explanation:"Anaphylaxis is Type I (IgE-mediated) hypersensitivity. IgE on mast cells releases histamine on antigen exposure." },
  { id:"q6", section:"Social/Behavioral/Administrative Sciences", category:"Pharmacy Law", difficulty:"سهل", question:"Which authority is responsible for drug registration in KSA?", options:["MOH","SCHS","SFDA","National Guard Health Affairs"], answer:2, explanation:"SFDA (Saudi Food and Drug Authority) registers, licenses, and regulates pharmaceuticals in KSA." },
  { id:"q7", section:"Pharmaceutical Sciences", category:"Pharmacology", difficulty:"صعب", question:"A patient on warfarin started on metronidazole. Expected interaction:", options:["Metronidazole induces CYP2C9 — decreasing warfarin","Metronidazole inhibits CYP2C9 — increasing warfarin and bleeding risk","Increases warfarin renal clearance","No significant interaction"], answer:1, explanation:"Metronidazole inhibits CYP2C9, increasing warfarin levels, prolonging INR, and raising bleeding risk significantly." },
  { id:"q8", section:"Clinical Sciences", category:"Clinical Pharmacology", difficulty:"متوسط", question:"A patient with eGFR <60 requires contrast CT. Regarding metformin:", options:["Continue normally","Hold 48h before and after contrast","Stop metformin permanently","Switch to insulin permanently"], answer:1, explanation:"Metformin held 48h before/after contrast in eGFR <60 due to risk of contrast-induced nephropathy leading to lactic acidosis." },
];

const BLUEPRINT = {
  "Basic Biomedical Sciences":                   { pct:10, color:"#3b82f6", sub:["Physiology","Biochemistry","Microbiology","Immunology"] },
  "Pharmaceutical Sciences":                      { pct:35, color:"#10b981", sub:["Medicinal Chemistry","Pharmacology & Toxicology","Pharmacognosy","Pharmaceutics","Pharmacokinetics","Sterile Compounding"] },
  "Social/Behavioral/Administrative Sciences":    { pct:20, color:"#8b5cf6", sub:["Health Care Delivery (KSA)","Pharmacoepidemiology","Pharmacy Management","Pharmacy Law & SFDA","Biostatistics","Ethics"] },
  "Clinical Sciences":                            { pct:35, color:"#ef4444", sub:["Drug Information & EBP","Clinical Pharmacokinetics","Patient Assessment","Clinical Pharmacology","Special Populations"] },
};

const SECTIONS = Object.keys(BLUEPRINT);
const DIFFICULTIES = ["سهل","متوسط","صعب"];
const SC = { "Basic Biomedical Sciences":{accent:"#3b82f6",bg:"#1e3a5f"}, "Pharmaceutical Sciences":{accent:"#10b981",bg:"#1e4a3a"}, "Social/Behavioral/Administrative Sciences":{accent:"#8b5cf6",bg:"#4a1e5f"}, "Clinical Sciences":{accent:"#ef4444",bg:"#5f1e1e"} };

// Build a SCHS-blueprint-aligned exam with difficulty distribution
function buildExam(allQuestions, settings) {
  const { totalQ, diffPct } = settings;
  const shuffle = arr => [...arr].sort(() => Math.random() - 0.5);
  const result = [];

  // For each section, pick questions proportionally
  SECTIONS.forEach(sec => {
    const bp = BLUEPRINT[sec];
    const secCount = Math.round(totalQ * bp.pct / 100);
    const pool = allQuestions.filter(q => q.section === sec);

    // Pick by difficulty distribution
    DIFFICULTIES.forEach(diff => {
      const need = Math.round(secCount * (diffPct[diff] || 33) / 100);
      const diffPool = shuffle(pool.filter(q => q.difficulty === diff));
      result.push(...diffPool.slice(0, need));
    });
  });

  // Fill up to totalQ if rounding left gaps
  const chosen = shuffle(result).slice(0, totalQ);
  if (chosen.length < totalQ) {
    const usedIds = new Set(chosen.map(q => q.id));
    const remaining = shuffle(allQuestions.filter(q => !usedIds.has(q.id)));
    chosen.push(...remaining.slice(0, totalQ - chosen.length));
  }
  return shuffle(chosen);
}

const S = {
  page: { minHeight:"100vh", background:"#0f172a", fontFamily:"system-ui,sans-serif", color:"#f1f5f9", direction:"ltr" },
  card: { background:"rgba(255,255,255,0.05)", border:"1px solid rgba(255,255,255,0.1)", borderRadius:16, padding:20 },
  input: { width:"100%", background:"rgba(255,255,255,0.07)", border:"1px solid rgba(255,255,255,0.15)", borderRadius:10, padding:"11px 14px", color:"#f1f5f9", fontSize:14, boxSizing:"border-box", outline:"none" },
  btn: (c="#3b82f6") => ({ background:`linear-gradient(135deg,${c},${c}bb)`, color:"#fff", border:"none", borderRadius:10, padding:"11px 18px", cursor:"pointer", fontSize:14, fontWeight:700 }),
  ghost: { background:"rgba(255,255,255,0.06)", border:"1px solid rgba(255,255,255,0.12)", color:"#94a3b8", borderRadius:10, padding:"10px 16px", cursor:"pointer", fontSize:13, fontWeight:600 },
  label: { color:"#94a3b8", fontSize:12, fontWeight:600, display:"block", marginBottom:5 },
  tag: (c) => ({ background:c+"22", color:c, padding:"2px 9px", borderRadius:20, fontSize:11, fontWeight:700, display:"inline-block" }),
};

// ===================== LOGIN =====================
function LoginScreen({ onLogin }) {
  const [tab, setTab] = useState("student");
  const [email, setEmail] = useState("");
  const [pass, setPass] = useState("");
  const [err, setErr] = useState("");

  const login = () => {
    setErr("");
    if (tab === "admin") {
      if (email === ADMIN.email && pass === ADMIN.password) onLogin({ role:"admin", email, name:"Administrator" });
      else setErr("Invalid admin credentials.");
    } else {
      const u = DB.getUsers().find(u => u.email===email && u.password===pass);
      if (u) onLogin({ role:"student", ...u });
      else setErr("Account not found or wrong password.");
    }
  };

  return (
    <div style={{ ...S.page, display:"flex", alignItems:"center", justifyContent:"center", padding:24 }}>
      <div style={{ width:"100%", maxWidth:400 }}>
        <div style={{ textAlign:"center", marginBottom:28 }}>
          <div style={{ width:56, height:56, borderRadius:14, background:"linear-gradient(135deg,#3b82f6,#10b981)", display:"flex", alignItems:"center", justifyContent:"center", fontSize:28, margin:"0 auto 10px" }}>💊</div>
          <div style={{ fontSize:26, fontWeight:800 }}>SPLE Platform</div>
          <div style={{ color:"#64748b", fontSize:13 }}>Saudi Pharmacist Licensure Exam</div>
        </div>
        <div style={{ display:"flex", background:"rgba(255,255,255,0.05)", borderRadius:12, padding:4, marginBottom:20 }}>
          {["student","admin"].map(t=>(
            <button key={t} onClick={()=>{setTab(t);setErr("");}} style={{ flex:1, padding:"9px", borderRadius:10, border:"none", cursor:"pointer", fontWeight:700, fontSize:14, background:tab===t?"linear-gradient(135deg,#3b82f6,#6366f1)":"transparent", color:tab===t?"#fff":"#64748b" }}>
              {t==="student"?"🎓 Student":"⚙️ Admin"}
            </button>
          ))}
        </div>
        <div style={S.card}>
          <div style={{ marginBottom:14 }}><label style={S.label}>Email</label><input style={S.input} type="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder={tab==="admin"?"admin123":"student@email.com"} onKeyDown={e=>e.key==="Enter"&&login()} /></div>
          <div style={{ marginBottom:18 }}><label style={S.label}>Password</label><input style={S.input} type="password" value={pass} onChange={e=>setPass(e.target.value)} placeholder="••••••••" onKeyDown={e=>e.key==="Enter"&&login()} /></div>
          {err && <div style={{ background:"rgba(239,68,68,0.1)", border:"1px solid rgba(239,68,68,0.3)", borderRadius:8, padding:"9px 14px", color:"#fca5a5", fontSize:13, marginBottom:14 }}>⚠️ {err}</div>}
          <button style={{ ...S.btn(tab==="admin"?"#8b5cf6":"#3b82f6"), width:"100%", padding:13 }} onClick={login}>{tab==="admin"?"Sign in as Admin":"Sign in as Student"}</button>
        </div>
        {tab==="admin" && <p style={{ textAlign:"center", color:"#334155", fontSize:11, marginTop:10 }}>admin123 / 123456</p>}
      </div>
    </div>
  );
}

// ===================== STATS PANEL =====================
function QuestionStats({ questions }) {
  const total = questions.length;
  const diffCounts = { "سهل":0, "متوسط":0, "صعب":0 };
  questions.forEach(q => { if(diffCounts[q.difficulty]!==undefined) diffCounts[q.difficulty]++; });
  const aiCount = questions.filter(q=>q.id?.startsWith("ai_")).length;

  return (
    <div style={{ ...S.card, marginBottom:20 }}>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:16 }}>
        <h2 style={{ margin:0, fontSize:16, fontWeight:700 }}>📊 Question Bank Statistics</h2>
        <span style={{ color:"#64748b", fontSize:13 }}>{total} total questions</span>
      </div>

      {/* Section breakdown */}
      <div style={{ marginBottom:16 }}>
        <div style={{ color:"#64748b", fontSize:12, fontWeight:600, marginBottom:10 }}>BY SECTION vs BLUEPRINT TARGET</div>
        {SECTIONS.map(sec => {
          const bp = BLUEPRINT[sec];
          const count = questions.filter(q=>q.section===sec).length;
          const actual = total ? Math.round(count/total*100) : 0;
          const target = bp.pct;
          const short = sec==="Social/Behavioral/Administrative Sciences"?"Social/Admin":sec.split(" ")[0]+" "+sec.split(" ")[1];
          return (
            <div key={sec} style={{ marginBottom:12 }}>
              <div style={{ display:"flex", justifyContent:"space-between", marginBottom:4, fontSize:12 }}>
                <span style={{ color:"#cbd5e1" }}>{short}</span>
                <div style={{ display:"flex", gap:8, alignItems:"center" }}>
                  <span style={{ color:bp.color, fontWeight:700 }}>{count} q ({actual}%)</span>
                  <span style={{ color:"#475569" }}>target {target}%</span>
                </div>
              </div>
              <div style={{ height:6, background:"rgba(255,255,255,0.08)", borderRadius:3, position:"relative" }}>
                <div style={{ width:`${Math.min(actual,100)}%`, height:"100%", borderRadius:3, background:bp.color, transition:"width 0.5s" }} />
                {/* Target marker */}
                <div style={{ position:"absolute", top:-2, left:`${target}%`, width:2, height:10, background:"rgba(255,255,255,0.3)", borderRadius:1 }} />
              </div>
            </div>
          );
        })}
      </div>

      {/* Difficulty + AI row */}
      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12 }}>
        <div>
          <div style={{ color:"#64748b", fontSize:12, fontWeight:600, marginBottom:10 }}>BY DIFFICULTY</div>
          <div style={{ display:"flex", gap:8 }}>
            {[["سهل","#22c55e"],["متوسط","#f59e0b"],["صعب","#ef4444"]].map(([d,c])=>(
              <div key={d} style={{ flex:1, background:c+"11", border:`1px solid ${c}33`, borderRadius:10, padding:"10px 8px", textAlign:"center" }}>
                <div style={{ color:c, fontSize:18, fontWeight:800 }}>{diffCounts[d]}</div>
                <div style={{ color:"#64748b", fontSize:11 }}>{d}</div>
              </div>
            ))}
          </div>
        </div>
        <div>
          <div style={{ color:"#64748b", fontSize:12, fontWeight:600, marginBottom:10 }}>SOURCE</div>
          <div style={{ display:"flex", gap:8 }}>
            <div style={{ flex:1, background:"rgba(255,255,255,0.04)", border:"1px solid rgba(255,255,255,0.1)", borderRadius:10, padding:"10px 8px", textAlign:"center" }}>
              <div style={{ fontSize:18, fontWeight:800 }}>{total-aiCount}</div>
              <div style={{ color:"#64748b", fontSize:11 }}>Manual</div>
            </div>
            <div style={{ flex:1, background:"rgba(245,158,11,0.08)", border:"1px solid rgba(245,158,11,0.2)", borderRadius:10, padding:"10px 8px", textAlign:"center" }}>
              <div style={{ color:"#f59e0b", fontSize:18, fontWeight:800 }}>{aiCount}</div>
              <div style={{ color:"#64748b", fontSize:11 }}>🤖 AI</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ===================== ADMIN QUESTIONS =====================

const sectionColors2 = { "Basic Biomedical Sciences":{accent:"#3b82f6"}, "Pharmaceutical Sciences":{accent:"#10b981"}, "Social/Behavioral/Administrative Sciences":{accent:"#8b5cf6"}, "Clinical Sciences":{accent:"#ef4444"} };

function parseExcelFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const wb = XLSX.read(e.target.result, { type:"array" });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const rows = XLSX.utils.sheet_to_json(ws, { defval:"" });
        const diffMap = { "easy":"سهل", "medium":"متوسط", "hard":"صعب" };
        const answerMap = { "A":0, "B":1, "C":2, "D":3 };
        const sectionMap = {
          "Basic Biomedical Sciences":"Basic Biomedical Sciences",
          "Pharmaceutical Sciences":"Pharmaceutical Sciences",
          "Social-Behavioral-Administrative":"Social/Behavioral/Administrative Sciences",
          "Social/Behavioral/Administrative Sciences":"Social/Behavioral/Administrative Sciences",
          "Clinical Sciences":"Clinical Sciences",
        };
        const mapped = rows.filter(r => (r.question||r.Question) && (r.option_a||r.A)).map((r,i) => {
          const isOrion = r.A !== undefined && r.option_a === undefined;
          const question = String(r.question || r.Question || "");
          const options = isOrion ? [String(r.A),String(r.B),String(r.C),String(r.D)] : [String(r.option_a),String(r.option_b),String(r.option_c),String(r.option_d)];
          const answer = isOrion ? (answerMap[String(r.Correct||"A").trim().toUpperCase()]??0) : (parseInt(r.correct_answer)||0);
          let section = "Pharmaceutical Sciences", difficulty = "متوسط";
          if (isOrion && r.Specialty) {
            const sp = String(r.Specialty);
            for (const [k,v] of Object.entries(sectionMap)) { if(sp.startsWith(k)){section=v;break;} }
            difficulty = diffMap[String(r.Difficulty||"medium").toLowerCase()]||"متوسط";
          } else {
            section = sectionMap[r.section]||r.section||"Pharmaceutical Sciences";
            difficulty = diffMap[String(r.difficulty||"medium").toLowerCase()]||r.difficulty||"متوسط";
          }
          return { id:"xl_"+Date.now()+"_"+i, section, category: r.category||r.Specialty?.split(" [")[0]||"General", difficulty, question, options, answer, explanation:String(r.explanation||r.Explanation||"") };
        });
        resolve(mapped);
      } catch(e) { reject(e); }
    };
    reader.readAsArrayBuffer(file);
  });
}

function ExcelImportCard({ title, accentColor, onImport }) {
  const [importing, setImporting] = useState(false);
  const [preview, setPreview] = useState([]);
  const [err, setErr] = useState("");
  const [success, setSuccess] = useState("");
  const diffCol = {"سهل":"#22c55e","متوسط":"#f59e0b","صعب":"#ef4444"};

  const handleFile = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    e.target.value = "";
    setImporting(true); setErr(""); setPreview([]); setSuccess("");
    try {
      const mapped = await parseExcelFile(file);
      if (mapped.length === 0) { setErr("No valid questions found."); setImporting(false); return; }
      setPreview(mapped);
    } catch(e) { setErr("Error: " + e.message); }
    setImporting(false);
  };

  const confirm = () => { onImport(preview); setSuccess(`✅ Imported ${preview.length} questions!`); setPreview([]); };

  return (
    <div style={{ ...S.card, marginBottom:16, border:`1px solid ${accentColor}33`, background:accentColor+"06" }}>
      <div style={{ fontWeight:700, fontSize:14, marginBottom:10, color:accentColor }}>📥 {title}</div>
      <div style={{ display:"flex", gap:10, marginBottom:10, alignItems:"center", flexWrap:"wrap" }}>
        <label style={{ ...S.btn(accentColor), padding:"9px 16px", cursor:"pointer", fontSize:13, flexShrink:0 }}>
          {importing ? "⏳ Reading..." : "📂 Choose .xlsx"}
          <input type="file" accept=".xlsx,.xls" onChange={handleFile} style={{ display:"none" }} />
        </label>
        <span style={{ color:"#64748b", fontSize:11 }}>Columns: section, category, difficulty, question, option_a…d, correct_answer (0-3), explanation</span>
      </div>
      {err && <div style={{ background:"rgba(239,68,68,0.1)", border:"1px solid rgba(239,68,68,0.3)", borderRadius:8, padding:"9px 12px", color:"#fca5a5", fontSize:13, marginBottom:8 }}>⚠️ {err}</div>}
      {success && <div style={{ background:"rgba(34,197,94,0.1)", border:"1px solid rgba(34,197,94,0.3)", borderRadius:8, padding:"9px 12px", color:"#86efac", fontSize:13, marginBottom:8 }}>{success}</div>}
      {preview.length > 0 && (
        <div>
          <div style={{ fontWeight:700, marginBottom:8, color:accentColor, fontSize:13 }}>Preview: {preview.length} questions found</div>
          <div style={{ maxHeight:160, overflowY:"auto", marginBottom:10, display:"flex", flexDirection:"column", gap:4 }}>
            {preview.slice(0,4).map((q,i) => (
              <div key={i} style={{ background:"rgba(255,255,255,0.04)", borderRadius:8, padding:"7px 10px", fontSize:12 }}>
                <div style={{ display:"flex", gap:5, marginBottom:2 }}>
                  <span style={S.tag((sectionColors2[q.section]||{accent:"#3b82f6"}).accent)}>{q.section.split(" ")[0]}</span>
                  <span style={S.tag(diffCol[q.difficulty]||"#f59e0b")}>{q.difficulty}</span>
                </div>
                <div style={{ color:"#e2e8f0" }}>{q.question.substring(0,85)}{q.question.length>85?"...":""}</div>
              </div>
            ))}
            {preview.length > 4 && <div style={{ color:"#64748b", fontSize:11, textAlign:"center" }}>+{preview.length-4} more…</div>}
          </div>
          <div style={{ display:"flex", gap:8 }}>
            <button onClick={confirm} style={{ ...S.btn(accentColor), flex:1, padding:10 }}>✅ Add {preview.length} Questions</button>
            <button onClick={()=>setPreview([])} style={{ ...S.ghost, padding:10 }}>Cancel</button>
          </div>
        </div>
      )}
    </div>
  );
}

function BankTab({ label, accentColor, questions, onChange, importTitle }) {
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ section:SECTIONS[0], category:"", difficulty:"متوسط", question:"", options:["","","",""], answer:0, explanation:"" });
  const [search, setSearch] = useState("");
  const [filterSec, setFilterSec] = useState("All");
  const [confirmClear, setConfirmClear] = useState(false);
  const diffCol = {"سهل":"#22c55e","متوسط":"#f59e0b","صعب":"#ef4444"};

  const filtered = questions.filter(q =>
    (filterSec==="All"||q.section===filterSec) &&
    (q.question.toLowerCase().includes(search.toLowerCase())||q.category.toLowerCase().includes(search.toLowerCase()))
  );
  const reset = () => setForm({ section:SECTIONS[0], category:"", difficulty:"متوسط", question:"", options:["","","",""], answer:0, explanation:"" });
  const save = () => {
    if (!form.question||form.options.some(o=>!o)||!form.category) return;
    if (editing) onChange(questions.map(q=>q.id===editing?{...form,id:editing}:q));
    else onChange([...questions,{...form,id:"q"+Date.now()}]);
    setShowForm(false); setEditing(null); reset();
  };

  return (
    <div>
      <QuestionStats questions={questions} />

      {/* Import */}
      <ExcelImportCard title={importTitle} accentColor={accentColor} onImport={qs=>onChange([...questions,...qs])} />

      {/* Header row */}
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:14, flexWrap:"wrap", gap:8 }}>
        <div><h2 style={{ margin:0, fontSize:16, fontWeight:700 }}>All Questions <span style={{ color:"#64748b", fontSize:13, fontWeight:400 }}>({filtered.length} shown / {questions.length} total)</span></h2></div>
        <div style={{ display:"flex", gap:8 }}>
          <button style={{ ...S.btn(accentColor), padding:"8px 14px", fontSize:13 }} onClick={()=>{ reset(); setEditing(null); setShowForm(true); }}>+ Add</button>
          {confirmClear
            ? <div style={{ display:"flex", gap:6, alignItems:"center" }}>
                <span style={{ color:"#fca5a5", fontSize:12 }}>Delete all {questions.length}?</span>
                <button onClick={()=>{ onChange([]); setConfirmClear(false); }} style={{ ...S.btn("#ef4444"), padding:"6px 12px", fontSize:12 }}>Yes, Delete</button>
                <button onClick={()=>setConfirmClear(false)} style={{ ...S.ghost, padding:"6px 10px", fontSize:12 }}>Cancel</button>
              </div>
            : <button onClick={()=>setConfirmClear(true)} style={{ ...S.ghost, padding:"8px 14px", fontSize:13, color:"#fca5a5", border:"1px solid rgba(239,68,68,0.3)" }}>🗑️ Clear All</button>
          }
        </div>
      </div>

      {/* Add/Edit form */}
      {showForm && (
        <div style={{ ...S.card, marginBottom:16, border:`1px solid ${accentColor}33` }}>
          <div style={{ fontWeight:700, marginBottom:14 }}>{editing?"Edit Question":"New Question"}</div>
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10, marginBottom:10 }}>
            <div><label style={S.label}>Section</label><select style={S.input} value={form.section} onChange={e=>setForm({...form,section:e.target.value})}>{SECTIONS.map(s=><option key={s}>{s}</option>)}</select></div>
            <div><label style={S.label}>Category</label><input style={S.input} value={form.category} onChange={e=>setForm({...form,category:e.target.value})} placeholder="Pharmacology" /></div>
            <div><label style={S.label}>Difficulty</label><select style={S.input} value={form.difficulty} onChange={e=>setForm({...form,difficulty:e.target.value})}>{DIFFICULTIES.map(d=><option key={d}>{d}</option>)}</select></div>
          </div>
          <div style={{ marginBottom:10 }}><label style={S.label}>Question</label><textarea style={{ ...S.input, minHeight:70, resize:"vertical" }} value={form.question} onChange={e=>setForm({...form,question:e.target.value})} /></div>
          <div style={{ marginBottom:10 }}>
            <label style={S.label}>Options (select radio = correct answer)</label>
            {form.options.map((opt,i)=>(
              <div key={i} style={{ display:"flex", gap:8, marginBottom:6, alignItems:"center" }}>
                <input type="radio" checked={form.answer===i} onChange={()=>setForm({...form,answer:i})} style={{ accentColor }} />
                <input style={{ ...S.input, flex:1 }} value={opt} onChange={e=>{ const o=[...form.options]; o[i]=e.target.value; setForm({...form,options:o}); }} placeholder={`Option ${["A","B","C","D"][i]}`} />
              </div>
            ))}
          </div>
          <div style={{ marginBottom:14 }}><label style={S.label}>Explanation</label><textarea style={{ ...S.input, minHeight:55, resize:"vertical" }} value={form.explanation} onChange={e=>setForm({...form,explanation:e.target.value})} /></div>
          <div style={{ display:"flex", gap:8 }}>
            <button style={S.btn(accentColor)} onClick={save}>💾 Save</button>
            <button style={{ ...S.ghost, flex:1 }} onClick={()=>{ setShowForm(false); setEditing(null); reset(); }}>Cancel</button>
          </div>
        </div>
      )}

      {/* Filters */}
      <div style={{ display:"flex", gap:8, marginBottom:10, flexWrap:"wrap" }}>
        {["All",...SECTIONS].map(s=>{ const bp=s!=="All"?BLUEPRINT[s]:null; const on=filterSec===s;
          return <button key={s} onClick={()=>setFilterSec(s)} style={{ padding:"4px 11px", borderRadius:20, border:`1.5px solid ${on&&bp?bp.color:on?accentColor:"rgba(255,255,255,0.15)"}`, cursor:"pointer", fontSize:11, fontWeight:600, background:on&&bp?bp.color+"22":on?accentColor+"22":"transparent", color:on&&bp?bp.color:on?accentColor:"#94a3b8" }}>{s==="All"?"All":s==="Social/Behavioral/Administrative Sciences"?"Social/Admin":s.split(" ")[0]}</button>;
        })}
      </div>
      <input style={{ ...S.input, marginBottom:12 }} value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search questions..." />

      {/* List */}
      <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
        {filtered.length===0 && <div style={{ ...S.card, textAlign:"center", padding:30, color:"#475569" }}>No questions found.</div>}
        {filtered.map(q=>{
          const col=SC[q.section]||{accent:"#3b82f6"};
          return (
            <div key={q.id} style={{ ...S.card, padding:"11px 15px" }}>
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", gap:10 }}>
                <div style={{ flex:1 }}>
                  <div style={{ display:"flex", gap:5, marginBottom:5, flexWrap:"wrap" }}>
                    <span style={S.tag(col.accent)}>{q.section.split(" ")[0]}</span>
                    <span style={S.tag("#94a3b8")}>{q.category}</span>
                    <span style={S.tag(diffCol[q.difficulty])}>{q.difficulty}</span>
                  </div>
                  <p style={{ color:"#e2e8f0", fontSize:13, margin:0, lineHeight:1.5 }}>{q.question}</p>
                </div>
                <div style={{ display:"flex", gap:6, flexShrink:0 }}>
                  <button onClick={()=>{ setForm({...q,options:[...q.options]}); setEditing(q.id); setShowForm(true); }} style={{ ...S.ghost, padding:"5px 10px" }}>✏️</button>
                  <button onClick={()=>{ if(window.confirm("Delete this question?")) onChange(questions.filter(x=>x.id!==q.id)); }} style={{ ...S.ghost, padding:"5px 10px", color:"#fca5a5" }}>🗑️</button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function AdminQuestions({ questions, onChangeQuestions }) {
  const [bankTab, setBankTab] = useState("shared");
  const [studyQ, setStudyQ] = useState(DB.getStudyQuestions());
  const [examQ, setExamQ] = useState(DB.getExamQuestions());

  const saveStudy = q => { DB.saveStudyQuestions(q); setStudyQ(q); };
  const saveExam  = q => { DB.saveExamQuestions(q);  setExamQ(q);  };
  const saveShared = q => { onChangeQuestions(q); };

  const tabs = [
    { id:"shared",  label:"📚 Shared Bank",   color:"#3b82f6", count: questions.length },
    { id:"study",   label:"📖 Study Bank",     color:"#10b981", count: studyQ.length },
    { id:"exam",    label:"🎯 Exam Bank",       color:"#ef4444", count: examQ.length },
  ];

  return (
    <div>
      {/* Bank selector */}
      <div style={{ display:"flex", gap:8, marginBottom:20 }}>
        {tabs.map(t=>(
          <button key={t.id} onClick={()=>setBankTab(t.id)} style={{ flex:1, padding:"11px", borderRadius:12, border:`2px solid ${bankTab===t.id?t.color:"rgba(255,255,255,0.1)"}`, cursor:"pointer", fontWeight:700, fontSize:13, background:bankTab===t.id?t.color+"18":"transparent", color:bankTab===t.id?t.color:"#64748b" }}>
            {t.label}
            <span style={{ display:"block", fontSize:11, fontWeight:400, marginTop:2, color:bankTab===t.id?t.color:"#475569" }}>{t.count} questions</span>
          </button>
        ))}
      </div>
      {bankTab==="shared" && <BankTab label="Shared" accentColor="#3b82f6" questions={questions} onChange={saveShared} importTitle="Import to Shared Bank (used by both Study & Exam)" />}
      {bankTab==="study"  && <BankTab label="Study"  accentColor="#10b981" questions={studyQ}    onChange={saveStudy}  importTitle="Import to Study Bank only" />}
      {bankTab==="exam"   && <BankTab label="Exam"   accentColor="#ef4444" questions={examQ}     onChange={saveExam}   importTitle="Import to Exam Bank only" />}
    </div>
  );
}

// ===================== ADMIN STUDENTS =====================
function AdminStudents({ users, onChange }) {
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name:"", email:"", password:"", university:"" });
  const [err, setErr] = useState("");
  const add = () => {
    if (!form.name||!form.email||!form.password) { setErr("All fields required."); return; }
    if (users.find(u=>u.email===form.email)) { setErr("Email already exists."); return; }
    onChange([...users,{...form,id:"u"+Date.now(),joinDate:new Date().toLocaleDateString()}]);
    setForm({name:"",email:"",password:"",university:""}); setShowForm(false); setErr("");
  };
  return (
    <div>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:16 }}>
        <div><h2 style={{ margin:0, fontSize:18, fontWeight:700 }}>Students</h2><span style={{ color:"#64748b", fontSize:13 }}>{users.length} enrolled</span></div>
        <button style={{ ...S.btn("#3b82f6"), width:"auto" }} onClick={()=>setShowForm(!showForm)}>+ Add Student</button>
      </div>
      {showForm && (
        <div style={{ ...S.card, marginBottom:16, border:"1px solid rgba(59,130,246,0.3)" }}>
          <div style={{ fontWeight:700, marginBottom:14 }}>New Student</div>
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10, marginBottom:10 }}>
            <div><label style={S.label}>Full Name</label><input style={S.input} value={form.name} onChange={e=>setForm({...form,name:e.target.value})} placeholder="Ahmed Al-Rashidi" /></div>
            <div><label style={S.label}>Email</label><input style={S.input} type="email" value={form.email} onChange={e=>setForm({...form,email:e.target.value})} placeholder="student@email.com" /></div>
            <div><label style={S.label}>Password</label><input style={S.input} type="password" value={form.password} onChange={e=>setForm({...form,password:e.target.value})} placeholder="Temporary password" /></div>
            <div><label style={S.label}>University</label><input style={S.input} value={form.university} onChange={e=>setForm({...form,university:e.target.value})} placeholder="KSU, KAU..." /></div>
          </div>
          {err&&<div style={{ color:"#fca5a5", fontSize:13, marginBottom:10 }}>⚠️ {err}</div>}
          <div style={{ display:"flex", gap:8 }}>
            <button style={S.btn("#3b82f6")} onClick={add}>Add Student</button>
            <button style={{ ...S.ghost, flex:1 }} onClick={()=>{ setShowForm(false); setErr(""); }}>Cancel</button>
          </div>
        </div>
      )}
      {users.length===0 ? <div style={{ ...S.card, textAlign:"center", padding:40 }}><div style={{ fontSize:36 }}>🎓</div><p style={{ color:"#64748b" }}>No students yet.</p></div> : (
        <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
          {users.map(u=>(
            <div key={u.id} style={{ ...S.card, padding:"12px 16px", display:"flex", justifyContent:"space-between", alignItems:"center" }}>
              <div style={{ display:"flex", alignItems:"center", gap:12 }}>
                <div style={{ width:38, height:38, borderRadius:10, background:"linear-gradient(135deg,#3b82f6,#6366f1)", display:"flex", alignItems:"center", justifyContent:"center", fontSize:16, fontWeight:800, color:"#fff" }}>{u.name[0]}</div>
                <div><div style={{ fontWeight:700 }}>{u.name}</div><div style={{ color:"#64748b", fontSize:12 }}>{u.email}{u.university&&` · ${u.university}`}</div></div>
              </div>
              <div style={{ display:"flex", gap:8, alignItems:"center" }}>
                <span style={{ color:"#475569", fontSize:12 }}>{u.joinDate}</span>
                <button onClick={()=>{ if(window.confirm("Remove?")) onChange(users.filter(x=>x.id!==u.id)); }} style={{ ...S.ghost, padding:"5px 10px", color:"#fca5a5" }}>🗑️</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ===================== ADMIN REPORTS =====================
function AdminReports({ users, results }) {
  const rows = users.map(u => {
    const ur = results.filter(r=>r.userId===u.id);
    return { ...u, exams:ur.length, avg:ur.length?Math.round(ur.reduce((a,r)=>a+r.score,0)/ur.length):null, last:ur.length?ur[ur.length-1].date:null };
  });
  return (
    <div>
      <h2 style={{ margin:"0 0 16px", fontSize:18, fontWeight:700 }}>Reports</h2>
      {rows.length===0 ? <div style={{ ...S.card, textAlign:"center", padding:40 }}><p style={{ color:"#64748b" }}>No data yet.</p></div> : (
        <div style={{ ...S.card, padding:0, overflow:"hidden" }}>
          <table style={{ width:"100%", borderCollapse:"collapse", fontSize:13 }}>
            <thead><tr style={{ background:"rgba(255,255,255,0.05)" }}>{["Student","University","Exams","Avg Score","Last Exam"].map(h=><th key={h} style={{ padding:"11px 14px", textAlign:"left", color:"#64748b", fontWeight:600, borderBottom:"1px solid rgba(255,255,255,0.08)" }}>{h}</th>)}</tr></thead>
            <tbody>{rows.map(u=>(
              <tr key={u.id} style={{ borderBottom:"1px solid rgba(255,255,255,0.05)" }}>
                <td style={{ padding:"11px 14px" }}><div style={{ fontWeight:700 }}>{u.name}</div><div style={{ color:"#64748b", fontSize:11 }}>{u.email}</div></td>
                <td style={{ padding:"11px 14px", color:"#94a3b8" }}>{u.university||"—"}</td>
                <td style={{ padding:"11px 14px", color:"#94a3b8" }}>{u.exams}</td>
                <td style={{ padding:"11px 14px" }}>{u.avg!==null?<span style={{ color:u.avg>=70?"#86efac":u.avg>=60?"#fde68a":"#fca5a5", fontWeight:700 }}>{u.avg}%</span>:<span style={{ color:"#475569" }}>—</span>}</td>
                <td style={{ padding:"11px 14px", color:"#64748b" }}>{u.last||"—"}</td>
              </tr>
            ))}</tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ===================== ADMIN EXAM SETTINGS =====================
function SettingsPanel({ title, icon, accentColor, settings, onSave, showTime }) {
  const [s, setS] = useState(settings);
  const [saved, setSaved] = useState(false);
  const questions = DB.getQuestions();
  const diffCol = { "سهل": "#22c55e", "متوسط": "#f59e0b", "صعب": "#ef4444" };
  const diffTotal = Object.values(s.diffPct).reduce((a, b) => a + b, 0);
  const update = (key, val) => setS(p => ({ ...p, [key]: val }));
  const updateDiff = (diff, val) => { const v = Math.max(0, Math.min(100, Number(val))); setS(p => ({ ...p, diffPct: { ...p.diffPct, [diff]: v } })); };
  const save = () => { onSave(s); setSaved(true); setTimeout(() => setSaved(false), 2000); };
  const preview = SECTIONS.map(sec => { const bp = BLUEPRINT[sec]; const secCount = Math.round(s.totalQ * bp.pct / 100); const available = questions.filter(q => q.section === sec).length; return { sec, secCount, available, bp }; });

  return (
    <div style={{ ...S.card, border:`1px solid ${accentColor}33`, marginBottom:24 }}>
      <div style={{ fontWeight:800, fontSize:17, marginBottom:16, color: accentColor }}>{icon} {title}</div>
      <div style={{ display:"grid", gridTemplateColumns: showTime ? "1fr 1fr" : "1fr", gap:14, marginBottom:16 }}>
        <div style={{ background:"rgba(255,255,255,0.03)", borderRadius:12, padding:14 }}>
          <label style={S.label}>Number of Questions: <span style={{ color:accentColor, fontWeight:800 }}>{s.totalQ}</span></label>
          <input type="range" min={10} max={200} step={5} value={s.totalQ} onChange={e => update("totalQ", Number(e.target.value))} style={{ width:"100%", accentColor, margin:"8px 0 4px" }} />
          <div style={{ display:"flex", justifyContent:"space-between", color:"#475569", fontSize:11 }}><span>10</span><span>100</span><span>200</span></div>
        </div>
        {showTime && (
          <div style={{ background:"rgba(255,255,255,0.03)", borderRadius:12, padding:14 }}>
            <label style={S.label}>Time: <span style={{ color:accentColor, fontWeight:800 }}>{s.timeMins} min ({Math.floor(s.timeMins/60)}h {s.timeMins%60}m)</span></label>
            <input type="range" min={10} max={300} step={5} value={s.timeMins} onChange={e => update("timeMins", Number(e.target.value))} style={{ width:"100%", accentColor, margin:"8px 0 4px" }} />
            <div style={{ display:"flex", justifyContent:"space-between", color:"#475569", fontSize:11 }}><span>10m</span><span>120m</span><span>300m</span></div>
          </div>
        )}
      </div>

      <div style={{ marginBottom:14 }}>
        <div style={{ display:"flex", justifyContent:"space-between", marginBottom:10 }}>
          <span style={{ ...S.label, margin:0 }}>Difficulty Distribution</span>
          <span style={{ fontSize:11, color: diffTotal===100?"#22c55e":"#ef4444", fontWeight:700 }}>Total: {diffTotal}% {diffTotal!==100?"⚠️":"✅"}</span>
        </div>
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:10 }}>
          {DIFFICULTIES.map(diff => (
            <div key={diff} style={{ background:diffCol[diff]+"11", border:`1px solid ${diffCol[diff]}33`, borderRadius:10, padding:12, textAlign:"center" }}>
              <div style={{ color:diffCol[diff], fontWeight:700, fontSize:12, marginBottom:6 }}>{diff==="سهل"?"🟢":"diff"==="متوسط"?"🟡":"🔴"} {diff}</div>
              <input type="number" min={0} max={100} value={s.diffPct[diff]} onChange={e=>updateDiff(diff,e.target.value)} style={{ ...S.input, width:"100%", textAlign:"center", padding:"6px", fontSize:16, fontWeight:800, color:diffCol[diff] }} />
              <div style={{ color:"#64748b", fontSize:10, marginTop:4 }}>{Math.round(s.totalQ*s.diffPct[diff]/100)} q</div>
            </div>
          ))}
        </div>
      </div>

      <div style={{ marginBottom:14 }}>
        <div style={{ color:"#64748b", fontSize:12, fontWeight:600, marginBottom:8 }}>SECTION PREVIEW (SCHS Blueprint)</div>
        {preview.map(({sec,secCount,available,bp}) => {
          const short = sec==="Social/Behavioral/Administrative Sciences"?"Social/Admin":sec.split(" ")[0];
          const ok = available >= secCount;
          return <div key={sec} style={{ display:"flex", alignItems:"center", gap:10, marginBottom:6 }}>
            <span style={{ color:"#94a3b8", fontSize:11, width:80, flexShrink:0 }}>{short}</span>
            <div style={{ flex:1, height:6, background:"rgba(255,255,255,0.06)", borderRadius:3 }}>
              <div style={{ width:`${bp.pct}%`, height:"100%", background:bp.color, borderRadius:3 }} />
            </div>
            <span style={{ color: ok?bp.color:"#ef4444", fontSize:11, fontWeight:700, width:70, textAlign:"right" }}>{secCount} {!ok&&"⚠️"}</span>
          </div>;
        })}
      </div>

      <button onClick={save} disabled={diffTotal!==100} style={{ ...S.btn(accentColor), opacity:diffTotal!==100?0.5:1 }}>
        {saved?"✅ Saved!":"💾 Save Settings"}
      </button>
    </div>
  );
}

function AdminExamSettings() {
  return (
    <div>
      <h1 style={{ fontSize:22, fontWeight:800, margin:"0 0 4px" }}>⚙️ Exam Settings</h1>
      <p style={{ color:"#64748b", marginBottom:24 }}>Configure both study session and exam parameters</p>
      <SettingsPanel
        title="Study Session — دورة المراجعة"
        icon="📚" accentColor="#10b981"
        settings={DB.getStudySettings()}
        onSave={DB.saveStudySettings}
        showTime={false}
      />
      <SettingsPanel
        title="Exam — الاختبار الرسمي"
        icon="🎯" accentColor="#ef4444"
        settings={DB.getExamSettings()}
        onSave={DB.saveExamSettings}
        showTime={true}
      />
    </div>
  );
}

// ===================== ADMIN DASHBOARD =====================
function AdminDashboard({ user, onLogout }) {
  const [tab, setTab] = useState("overview");
  const [questions, setQuestions] = useState(DB.getQuestions());
  const [users, setUsers] = useState(DB.getUsers());
  const [results] = useState(DB.getResults());
  const saveQ = q => { DB.saveQuestions(q); setQuestions(q); };
  const saveU = u => { DB.saveUsers(u); setUsers(u); };
  const TABS = [{id:"overview",icon:"📊",label:"Overview"},{id:"questions",icon:"❓",label:"Questions"},{id:"students",icon:"🎓",label:"Students"},{id:"reports",icon:"📈",label:"Reports"},{id:"settings",icon:"⚙️",label:"Exam Settings"}];

  const avg = results.length?Math.round(results.reduce((a,r)=>a+r.score,0)/results.length):0;

  return (
    <div style={{ minHeight:"100vh", background:"#0f172a", fontFamily:"system-ui,sans-serif", color:"#f1f5f9", display:"flex" }}>
      <div style={{ width:210, background:"rgba(255,255,255,0.03)", borderRight:"1px solid rgba(255,255,255,0.08)", padding:18, display:"flex", flexDirection:"column", gap:4, flexShrink:0 }}>
        <div style={{ marginBottom:20 }}><div style={{ fontSize:17, fontWeight:800 }}>💊 SPLE</div><div style={{ color:"#8b5cf6", fontSize:10, fontWeight:700 }}>ADMIN PANEL</div></div>
        {TABS.map(t=>(
          <button key={t.id} onClick={()=>setTab(t.id)} style={{ background:tab===t.id?"rgba(139,92,246,0.15)":"transparent", border:tab===t.id?"1px solid rgba(139,92,246,0.3)":"1px solid transparent", borderRadius:9, padding:"9px 12px", cursor:"pointer", textAlign:"left", color:tab===t.id?"#c4b5fd":"#64748b", fontSize:13, fontWeight:600, display:"flex", alignItems:"center", gap:6 }}>
            {t.icon} {t.label} {t.badge&&<span style={{ background:"#f59e0b22",color:"#f59e0b",fontSize:9,padding:"1px 5px",borderRadius:6,marginLeft:"auto" }}>{t.badge}</span>}
          </button>
        ))}
        <div style={{ marginTop:"auto" }}>
          <div style={{ color:"#334155", fontSize:11, marginBottom:6 }}>{user.name}</div>
          <button onClick={onLogout} style={{ ...S.ghost, width:"100%", textAlign:"left", fontSize:12 }}>🚪 Logout</button>
        </div>
      </div>
      <div style={{ flex:1, padding:24, overflowY:"auto" }}>
        {tab==="overview" && (
          <div>
            <h1 style={{ fontSize:22, fontWeight:800, margin:"0 0 4px" }}>Overview</h1>
            <p style={{ color:"#64748b", marginBottom:20 }}>Platform summary</p>
            <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:14, marginBottom:20 }}>
              {[["❓",questions.length,"Questions","#3b82f6"],["🎓",users.length,"Students","#10b981"],["📝",results.length,"Exams","#8b5cf6"],["📊",`${avg}%`,"Avg Score","#f59e0b"]].map(([icon,val,label,color])=>(
                <div key={label} style={{ background:"rgba(255,255,255,0.04)", border:`1px solid ${color}33`, borderRadius:14, padding:18 }}>
                  <div style={{ fontSize:24 }}>{icon}</div>
                  <div style={{ fontSize:28, fontWeight:800, color, marginTop:6 }}>{val}</div>
                  <div style={{ color:"#64748b", fontSize:12 }}>{label}</div>
                </div>
              ))}
            </div>
            <QuestionStats questions={questions} />
          </div>
        )}
        {tab==="questions" && <AdminQuestions questions={questions} onChangeQuestions={saveQ} />}
        {tab==="students" && <AdminStudents users={users} onChange={saveU} />}
        {tab==="reports" && <AdminReports users={users} results={results} />}
        {tab==="settings" && <AdminExamSettings />}
      </div>
    </div>
  );
}

// ===================== STUDENT =====================
function StudentDashboard({ user, onLogout }) {
  const [screen, setScreen] = useState("home"); // home | study | exam | results
  const [examQ, setExamQ] = useState([]);
  const [examA, setExamA] = useState({});
  const [mode, setMode] = useState("exam"); // "study" | "exam"
  const [myResults, setMyResults] = useState(DB.getResults().filter(r=>r.userId===user.id));
  const questions = DB.getQuestions();
  const studySettings = DB.getStudySettings();
  const examSettings = DB.getExamSettings();

  const startSession = (sessionMode) => {
    const settings = sessionMode === "study" ? studySettings : examSettings;
    // Use specific bank if available, fall back to shared bank
    const studyBank = DB.getStudyQuestions();
    const examBank = DB.getExamQuestions();
    const pool = sessionMode === "study"
      ? (studyBank.length > 0 ? studyBank : questions)
      : (examBank.length > 0 ? examBank : questions);
    const q = buildExam(pool, settings);
    setMode(sessionMode);
    setExamQ(q);
    setScreen(sessionMode);
  };

  const finishSession = (answers) => {
    const correct = examQ.filter(q => answers[q.id] === q.answer).length;
    const score = Math.round((correct / examQ.length) * 100);
    const result = { userId:user.id, userName:user.name, date:new Date().toLocaleDateString(), score, correct, total:examQ.length, mode };
    const all = [...DB.getResults(), result];
    DB.saveResults(all);
    setMyResults(all.filter(r => r.userId === user.id));
    setExamA(answers);
    setScreen("results");
  };

  if (screen === "materials") return <StudyMaterialsScreen onBack={()=>setScreen("home")} onStartStudy={()=>startSession("study")} />;
  if (screen === "study") return <StudyScreen questions={examQ} onFinish={finishSession} onHome={()=>setScreen("home")} />;
  if (screen === "exam") return <ExamScreen questions={examQ} onFinish={finishSession} timeMins={examSettings.timeMins} />;
  if (screen === "results") return <ResultsScreen questions={examQ} answers={examA} mode={mode} onRetry={()=>setScreen("home")} onHome={()=>setScreen("home")} userName={user.name} />;

  const examResults = myResults.filter(r => r.mode === "exam" || !r.mode);
  const studyResults = myResults.filter(r => r.mode === "study");
  const avg = examResults.length ? Math.round(examResults.reduce((a,r)=>a+r.score,0)/examResults.length) : 0;
  const best = examResults.length ? Math.max(...examResults.map(r=>r.score)) : 0;

  return (
    <div style={{ minHeight:"100vh", background:"#0f172a", fontFamily:"system-ui,sans-serif", color:"#f1f5f9" }}>
      {/* Header */}
      <div style={{ background:"rgba(255,255,255,0.03)", borderBottom:"1px solid rgba(255,255,255,0.08)", padding:"12px 24px", display:"flex", justifyContent:"space-between", alignItems:"center" }}>
        <div style={{ display:"flex", alignItems:"center", gap:10 }}><span style={{ fontSize:20 }}>💊</span><div><div style={{ fontWeight:800 }}>SPLE Platform</div><div style={{ color:"#64748b", fontSize:11 }}>Student Portal</div></div></div>
        <div style={{ display:"flex", alignItems:"center", gap:10 }}>
          <div style={{ textAlign:"right" }}><div style={{ fontWeight:700, fontSize:13 }}>{user.name}</div><div style={{ color:"#64748b", fontSize:11 }}>{user.university||user.email}</div></div>
          <button onClick={onLogout} style={{ ...S.ghost, padding:"7px 12px" }}>Logout</button>
        </div>
      </div>

      <div style={{ maxWidth:720, margin:"0 auto", padding:24 }}>
        {/* Stats */}
        <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:14, marginBottom:24 }}>
          {[["📝",examResults.length,"Exams Taken","#3b82f6"],["📊",`${avg}%`,"Avg Score","#10b981"],["🏆",`${best}%`,"Best Score","#f59e0b"]].map(([icon,val,label,color])=>(
            <div key={label} style={{ background:"rgba(255,255,255,0.04)", border:`1px solid ${color}33`, borderRadius:14, padding:18 }}><div style={{ fontSize:22 }}>{icon}</div><div style={{ fontSize:26, fontWeight:800, color, marginTop:6 }}>{val}</div><div style={{ color:"#64748b", fontSize:12 }}>{label}</div></div>
          ))}
        </div>

        {/* Three mode cards */}
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:14, marginBottom:24 }}>
          {/* Study Materials */}
          <div style={{ ...S.card, border:"1px solid rgba(139,92,246,0.35)", background:"rgba(139,92,246,0.04)", display:"flex", flexDirection:"column" }}>
            <div style={{ fontSize:28, marginBottom:8 }}>📖</div>
            <div style={{ fontWeight:800, fontSize:15, color:"#8b5cf6", marginBottom:6 }}>Study Materials</div>
            <div style={{ color:"#64748b", fontSize:12, marginBottom:14, lineHeight:1.6, flex:1 }}>23 درساً شاملاً مع نقاط مراجعة وجداول مرجعية</div>
            <div style={{ display:"flex", gap:6, marginBottom:14, flexWrap:"wrap" }}>
              <span style={{ background:"rgba(139,92,246,0.12)", color:"#8b5cf6", fontSize:10, fontWeight:700, padding:"3px 8px", borderRadius:20 }}>📚 23 Lessons</span>
              <span style={{ background:"rgba(139,92,246,0.12)", color:"#8b5cf6", fontSize:10, fontWeight:700, padding:"3px 8px", borderRadius:20 }}>🗒️ Key Points</span>
            </div>
            <button onClick={()=>setScreen("materials")} style={{ ...S.btn("#8b5cf6"), width:"100%", padding:10, fontSize:13 }}>Browse Lessons →</button>
          </div>

          {/* Study Session */}
          <div style={{ ...S.card, border:"1px solid rgba(16,185,129,0.35)", background:"rgba(16,185,129,0.04)", display:"flex", flexDirection:"column" }}>
            <div style={{ fontSize:28, marginBottom:8 }}>📝</div>
            <div style={{ fontWeight:800, fontSize:15, color:"#10b981", marginBottom:6 }}>Study Session</div>
            <div style={{ color:"#64748b", fontSize:12, marginBottom:14, lineHeight:1.6, flex:1 }}>تدرّب مع إجابات فورية وشرح لكل سؤال</div>
            <div style={{ display:"flex", gap:6, marginBottom:14, flexWrap:"wrap" }}>
              <span style={{ background:"rgba(16,185,129,0.12)", color:"#10b981", fontSize:10, fontWeight:700, padding:"3px 8px", borderRadius:20 }}>📝 {studySettings.totalQ} Questions</span>
              <span style={{ background:"rgba(16,185,129,0.12)", color:"#10b981", fontSize:10, fontWeight:700, padding:"3px 8px", borderRadius:20 }}>✅ Instant Feedback</span>
            </div>
            <button onClick={()=>startSession("study")} style={{ ...S.btn("#10b981"), width:"100%", padding:10, fontSize:13 }}>Start Session →</button>
          </div>

          {/* Exam */}
          <div style={{ ...S.card, border:"1px solid rgba(239,68,68,0.35)", background:"rgba(239,68,68,0.04)", display:"flex", flexDirection:"column" }}>
            <div style={{ fontSize:28, marginBottom:8 }}>🎯</div>
            <div style={{ fontWeight:800, fontSize:15, color:"#ef4444", marginBottom:6 }}>Official Exam</div>
            <div style={{ color:"#64748b", fontSize:12, marginBottom:14, lineHeight:1.6, flex:1 }}>اختبار محاكاة حقيقي بدون إجابات أثناء الاختبار</div>
            <div style={{ display:"flex", gap:6, marginBottom:14, flexWrap:"wrap" }}>
              <span style={{ background:"rgba(239,68,68,0.12)", color:"#ef4444", fontSize:10, fontWeight:700, padding:"3px 8px", borderRadius:20 }}>📝 {examSettings.totalQ} Q</span>
              <span style={{ background:"rgba(239,68,68,0.12)", color:"#ef4444", fontSize:10, fontWeight:700, padding:"3px 8px", borderRadius:20 }}>⏱️ {examSettings.timeMins} min</span>
              <span style={{ background:"rgba(239,68,68,0.12)", color:"#ef4444", fontSize:10, fontWeight:700, padding:"3px 8px", borderRadius:20 }}>🔒 No Feedback</span>
            </div>
            <button onClick={()=>startSession("exam")} style={{ ...S.btn("#ef4444"), width:"100%", padding:10, fontSize:13 }}>Start Exam →</button>
          </div>
        </div>

        {/* History */}
        <div style={S.card}>
          <div style={{ fontWeight:700, marginBottom:14 }}>Exam History</div>
          {examResults.length===0 ? <p style={{ color:"#475569", textAlign:"center", padding:"16px 0" }}>No exams yet.</p> : (
            <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
              {[...examResults].reverse().slice(0,10).map((r,i)=>(
                <div key={i} style={{ display:"flex", justifyContent:"space-between", alignItems:"center", background:"rgba(255,255,255,0.04)", borderRadius:10, padding:"10px 14px" }}>
                  <div><div style={{ fontWeight:700 }}>{r.correct}/{r.total} Correct</div><div style={{ color:"#64748b", fontSize:12 }}>{r.date}</div></div>
                  <div style={{ fontSize:22, fontWeight:800, color:r.score>=70?"#86efac":r.score>=60?"#fde68a":"#fca5a5" }}>{r.score}%</div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ===================== STUDY MATERIALS DATA =====================
const STUDY_LESSONS = [
  {
    id:"1.1", section:"Basic Biomedical Sciences", title:"Cardiovascular Physiology",
    color:"#3b82f6",
    summary:"The cardiovascular system delivers oxygenated blood to tissues. CO = HR × SV | MAP = CO × SVR | MAP = DBP + 1/3(SBP−DBP) | Normal CO = 4–8 L/min",
    keyPoints:[
      "Preload = End-diastolic ventricular volume → reduced by diuretics, increased by IV fluids",
      "Afterload = SVR → reduced by vasodilators (ACE-I, ARBs, nitrates)",
      "Contractility → increased by digoxin/dobutamine; decreased in heart failure",
      "Frank-Starling Law: ↑ preload → ↑ stroke volume, but excess preload → ↓ SV (basis for diuretics in HF)",
      "Ejection Fraction = SV/EDV. Normal ≥55%. HFrEF: EF <40%",
      "Baroreceptors: ↓BP → SNS activation → ↑HR + vasoconstriction",
    ],
    table:{ headers:["Term","Definition","Clinical Use"], rows:[["Preload","End-diastolic vol (LVEDV)","Diuretics ↓ preload"],["Afterload","SVR","Vasodilators ↓ afterload"],["EF","SV/EDV","HFrEF: EF<40%"],["MAP","DBP+1/3(PP)","Target >65 mmHg"]] }
  },
  {
    id:"1.2", section:"Basic Biomedical Sciences", title:"Renal Physiology & GFR",
    color:"#3b82f6",
    summary:"Cockcroft-Gault: CrCl = [(140−age) × weight] / [72 × SCr] × 0.85 (females). Kidneys filter ~180 L/day.",
    keyPoints:[
      "CKD G3a (45–59): start dose adjustments | G3b (30–44): many drugs need adjustment | G4 (15–29): avoid nephrotoxics | G5 (<15): dialysis",
      "RAAS: ↓BP → Renin → Ang I → ACE → Ang II → vasoconstriction + aldosterone",
      "ACE-I: block ACE, reduce proteinuria, renoprotective. SE: dry cough (bradykinin↑)",
      "ARBs: block AT1 receptor — same benefit, NO cough",
      "ACE-I contraindicated in: bilateral renal artery stenosis, pregnancy, hyperkalemia",
      "Metformin: hold at CrCl <30 (risk of lactic acidosis)",
    ],
    table:{ headers:["CKD Stage","GFR (mL/min)","Action"], rows:[["G1","≥90","Monitor"],["G2","60–89","Monitor"],["G3a","45–59","Dose adjust"],["G3b","30–44","Many drugs adjust"],["G4","15–29","Avoid nephrotoxics"],["G5","<15","Dialysis"]] }
  },
  {
    id:"1.3", section:"Basic Biomedical Sciences", title:"Acid-Base Balance",
    color:"#3b82f6",
    summary:"Normal: pH 7.35–7.45 | PaCO₂ 35–45 | HCO₃⁻ 22–26. Check pH → PaCO₂ → HCO₃⁻.",
    keyPoints:[
      "Respiratory Acidosis: ↓pH, ↑PaCO₂ → COPD, opioid OD, hypoventilation",
      "Respiratory Alkalosis: ↑pH, ↓PaCO₂ → anxiety, PE, hyperventilation",
      "Metabolic Acidosis: ↓pH, ↓HCO₃⁻ → DKA, lactic acidosis, renal failure, diarrhea",
      "Metabolic Alkalosis: ↑pH, ↑HCO₃⁻ → vomiting, loop diuretics, hyperaldosteronism",
      "COPD: target SpO₂ 88–92% only! Excess O₂ suppresses hypoxic drive → CO₂ retention",
      "Compensation moves the OPPOSITE parameter in the SAME direction as pH",
    ],
    table:{ headers:["Disorder","pH","PaCO₂","HCO₃⁻"], rows:[["Resp Acidosis","↓","↑","Normal/↑"],["Resp Alkalosis","↑","↓","Normal/↓"],["Metab Acidosis","↓","Normal/↓","↓"],["Metab Alkalosis","↑","Normal/↑","↑"]] }
  },
  {
    id:"1.4", section:"Basic Biomedical Sciences", title:"Enzyme Kinetics (Michaelis-Menten)",
    color:"#3b82f6",
    summary:"V = Vmax × [S] / (Km + [S]) | Km = [S] at ½Vmax | Lower Km = higher affinity",
    keyPoints:[
      "Competitive inhibitor: ↑Km (apparent), Vmax unchanged — overcome by excess substrate",
      "Non-competitive inhibitor: Km unchanged, ↓Vmax — binds allosteric site",
      "Uncompetitive inhibitor: ↓both Km and Vmax — binds enzyme-substrate complex",
      "First-order kinetics: rate ∝ concentration (most drugs)",
      "Zero-order (saturable) kinetics: Phenytoin, Aspirin OD, Ethanol — small dose → big level rise",
    ],
    table:{ headers:["Inhibitor","Km","Vmax","Reversed by substrate?"], rows:[["Competitive","↑","Unchanged","Yes"],["Non-competitive","Unchanged","↓","No"],["Uncompetitive","↓","↓","No"]] }
  },
  {
    id:"1.5", section:"Basic Biomedical Sciences", title:"Microbiology & Gram Stain",
    color:"#3b82f6",
    summary:"Gram stain guides empirical antibiotic selection. Gram+ = purple (thick peptidoglycan). Gram− = pink (thin wall + LPS outer membrane).",
    keyPoints:[
      "Gram+: S. aureus, Streptococcus, Enterococcus, Clostridium → Exotoxins",
      "Gram−: E. coli, Klebsiella, Pseudomonas, H. influenzae → Endotoxin (LPS) → septic shock",
      "Anti-Pseudomonal: Pip-Tazo, Cefepime, Meropenem, Ciprofloxacin — NOT Amoxicillin/Ceftriaxone",
      "Atypicals (Mycoplasma, Chlamydia, Legionella): no cell wall → treat with macrolides/doxycycline/FQ",
      "MRSA: Vancomycin IV (monitor AUC/MIC 400–600)",
    ],
    table:{ headers:["Feature","Gram+","Gram−"], rows:[["Color","Purple","Pink"],["Wall","Thick peptidoglycan","Thin + LPS outer membrane"],["Toxin","Exotoxins","Endotoxin (LPS)"],["Examples","S. aureus, Strep","E. coli, Pseudomonas"]] }
  },
  {
    id:"1.6", section:"Basic Biomedical Sciences", title:"Immunology — Antibodies & Hypersensitivity",
    color:"#3b82f6",
    summary:"IgG (75%): crosses placenta. IgA (15%): mucosal. IgM (8%): first in acute infection. IgE (<0.01%): mast cells, Type I reactions.",
    keyPoints:[
      "Type I (Immediate): IgE → mast cells → histamine → Anaphylaxis, allergic asthma",
      "Type II (Cytotoxic): IgG/IgM + complement → ABO transfusion reaction, hemolytic anemia",
      "Type III (Immune complex): Ag-Ab deposits → SLE, serum sickness, post-strep GN",
      "Type IV (Delayed, 48–72h): T-cell mediated → TB skin test, contact dermatitis, transplant rejection",
      "Elevated IgM = recent/acute infection | Elevated IgG = long-term/past immunity",
    ],
    table:{ headers:["Type","Mechanism","Example"], rows:[["I – Immediate","IgE/mast cells","Anaphylaxis"],["II – Cytotoxic","IgG/IgM + complement","Transfusion reaction"],["III – Immune complex","Ag-Ab deposits","SLE, serum sickness"],["IV – Delayed","T-cells (48–72h)","TB test, contact dermatitis"]] }
  },
  {
    id:"2.1", section:"Pharmaceutical Sciences", title:"Pharmacokinetics — ADME Overview",
    color:"#10b981",
    summary:"t½ = 0.693 × Vd / CL | Steady state = 4–5 × t½ | Loading dose = Vd × Cp(target) | F(IV) = 100%",
    keyPoints:[
      "Bioavailability (F): fraction reaching systemic circulation. IV = 100%. Oral reduced by first-pass metabolism",
      "First-pass: GI absorption → portal vein → liver → metabolism BEFORE systemic circulation",
      "Clearance (CL) = Dose/AUC → determines maintenance dose",
      "Vd = Dose/Cp(initial) → large Vd = extensive tissue distribution",
      "AUC = total drug exposure over time",
      "Maintenance dose = CL × Css × τ / F",
    ],
    table:{ headers:["Parameter","Formula","Clinical use"], rows:[["t½","0.693 × Vd/CL","Time to steady state"],["CL","Dose/AUC","Maintenance dose"],["Vd","Dose/Cp","Loading dose"],["Loading dose","Vd × Cp(target)","Rapid target level"]] }
  },
  {
    id:"2.2", section:"Pharmaceutical Sciences", title:"CYP450 Drug Metabolism",
    color:"#10b981",
    summary:"CYP3A4 metabolizes ~50% of drugs. Inhibitors ↑drug levels. Inducers ↓drug levels. Phase I: oxidation. Phase II: conjugation.",
    keyPoints:[
      "CYP3A4 inhibitors: Erythromycin, Clarithromycin, Ketoconazole, Ritonavir, Grapefruit",
      "CYP3A4 inducers: Rifampicin, Carbamazepine, Phenytoin, St. John's Wort",
      "CYP2D6 inhibitors: Fluoxetine, Paroxetine, Bupropion — converts Codeine → Morphine",
      "CYP2C9 inhibitors: Fluconazole, Amiodarone, Metronidazole → ↑Warfarin → bleeding",
      "Grapefruit: irreversibly inhibits intestinal CYP3A4 for 24–72h → ↑CCBs, statins",
      "Rifampicin + Warfarin: ↑CYP2C9 → ↓INR → thrombosis",
    ],
    table:{ headers:["Enzyme","% Drugs","Key Inhibitors","Key Inducers"], rows:[["CYP3A4","~50%","Erythromycin, Ketoconazole, Grapefruit","Rifampicin, Phenytoin, St. John's Wort"],["CYP2D6","~25%","Fluoxetine, Paroxetine","None significant"],["CYP2C9","~15%","Fluconazole, Metronidazole","Rifampicin"],["CYP1A2","~5%","Ciprofloxacin","Smoking"]] }
  },
  {
    id:"2.3", section:"Pharmaceutical Sciences", title:"Volume of Distribution & Drug Distribution",
    color:"#10b981",
    summary:"Vd = Dose/Cp(initial). Small Vd (<1 L/kg) = plasma. Large Vd (>5 L/kg) = tissue sequestration.",
    keyPoints:[
      "Small Vd: Warfarin, Furosemide, Aminoglycosides, Heparin (stay in plasma)",
      "Large Vd: Digoxin (500L), Amiodarone (5000L), Chlorpromazine",
      "Only FREE drug is pharmacologically active — protein binding: albumin (acidic drugs), α1-AGP (basic drugs)",
      "Displacement interactions matter most for high-protein-bound, narrow-TI drugs (Warfarin, Phenytoin)",
      "BBB crossing requires lipophilic, uncharged molecules — Heroin > Morphine (faster BBB penetration)",
    ],
    table:{ headers:["Vd","Interpretation","Examples"], rows:[["<1 L/kg","Plasma-restricted","Warfarin, Heparin, Aminoglycosides"],["1–5 L/kg","Tissue distribution","Most drugs"],[">5 L/kg","Extensive tissue (lipophilic)","Digoxin (500L), Amiodarone (5000L)"]] }
  },
  {
    id:"2.4", section:"Pharmaceutical Sciences", title:"Pharmacodynamics & Receptor Theory",
    color:"#10b981",
    summary:"TI = LD50/ED50. Narrow-TI drugs: Warfarin, Lithium, Digoxin, Aminoglycosides, Phenytoin, Cyclosporine.",
    keyPoints:[
      "Full agonist: 100% efficacy (Morphine) | Partial agonist: <100% — ceiling effect (Buprenorphine)",
      "Competitive antagonist: reversible, overcome by ↑agonist (Propranolol)",
      "Non-competitive antagonist: irreversible/allosteric, ↓Vmax (Phenoxybenzamine)",
      "Ionotropic: direct ion channel, milliseconds (BZD-GABA-A, Nicotinic)",
      "GPCRs: cAMP/IP3 second messengers (beta-blockers, Opioids, Muscarinic)",
      "Nuclear receptors: gene transcription, hours–days (Corticosteroids, Thyroid hormones)",
    ],
    table:{ headers:["Drug type","Efficacy","Example"], rows:[["Full agonist","100%","Morphine"],["Partial agonist","<100% (ceiling)","Buprenorphine"],["Competitive antagonist","Blocks — reversible","Propranolol"],["Non-competitive","Blocks — irreversible","Phenoxybenzamine"]] }
  },
  {
    id:"2.5", section:"Pharmaceutical Sciences", title:"Toxicology & Antidotes",
    color:"#10b981",
    summary:"Memorize antidotes — extremely high-yield on SPLE.",
    keyPoints:[
      "Paracetamol → NAC (within 8–10h). Mechanism: NAPQI depletes glutathione → hepatic necrosis",
      "Opioids → Naloxone (short t½ — may need infusion)",
      "Benzodiazepines → Flumazenil (AVOID in seizure/chronic BZD users)",
      "Warfarin → Vit K + 4-factor PCC (active bleeding)",
      "Beta-blockers → Glucagon + Atropine | Digoxin → DigiFab",
      "Organophosphates → Atropine + Pralidoxime (2-PAM within 48h)",
      "Methanol/Ethylene glycol → Fomepizole | Cyanide → Hydroxocobalamin",
      "Methemoglobinemia → Methylene Blue | CO → 100% O₂",
    ],
    table:{ headers:["Toxin","Antidote","Key Note"], rows:[["Paracetamol","NAC","<8h max benefit"],["Opioids","Naloxone","Short t½, may repeat"],["Warfarin","Vit K + 4F-PCC","PCC for active bleed"],["Organophosphates","Atropine + 2-PAM","2-PAM within 48h"],["Beta-blocker","Glucagon","Bypasses β-receptor"],["CO","100% O₂","↓COHb t½ 5h→1h"]] }
  },
  {
    id:"3.1", section:"Social/Behavioral/Administrative Sciences", title:"Biomedical Ethics — Four Principles",
    color:"#8b5cf6",
    summary:"Autonomy | Beneficence | Non-maleficence | Justice. Capacity = understand + appreciate + reason + communicate.",
    keyPoints:[
      "Autonomy: respect patient's right to decide — competent adult refusal MUST be respected",
      "Beneficence: act in patient's best interest",
      "Non-maleficence: 'First, do no harm' — avoid toxic drugs when benefit < risk",
      "Justice: fair distribution of resources (formulary decisions, transplant lists)",
      "Capacity is decision-specific — mild dementia ≠ automatic incapacity",
      "Confidentiality exceptions: written consent, legal subpoena, imminent harm to 3rd party, mandatory reporting",
    ],
    table:{ headers:["Principle","Definition","Common conflict"], rows:[["Autonomy","Patient's right to decide","vs Beneficence"],["Beneficence","Act in best interest","vs Autonomy"],["Non-maleficence","Do no harm","vs Beneficence in palliation"],["Justice","Fair resource distribution","Individual vs society"]] }
  },
  {
    id:"3.2", section:"Social/Behavioral/Administrative Sciences", title:"KSA Pharmacy Law & Regulation",
    color:"#8b5cf6",
    summary:"SFDA: drug registration + GMP + pharmacovigilance. SCFHS: pharmacist licensing + SPLE. MOH: national health policy.",
    keyPoints:[
      "SFDA: drug registration, GMP inspection, pharmacovigilance, recalls — ADR reporting mandatory",
      "SCFHS: licenses health professionals, administers SPLE exam",
      "MOH: national health policy, Essential Medicines List, MOH hospitals",
      "NUPCO: central drug procurement for government sector",
      "CBAHI: hospital accreditation | CCHI: health insurance",
      "Schedule I (Morphine, Fentanyl): TRIPLICATE Rx — original only, NO fax/photocopy",
      "Schedule II (BZD): duplicate Rx | Schedule III (Codeine combos): standard Rx",
    ],
    table:{ headers:["Authority","Main Role"], rows:[["SFDA","Drug registration, GMP, pharmacovigilance"],["SCFHS","Pharmacist licensing, SPLE"],["MOH","Health policy, Essential Medicines"],["NUPCO","Government drug procurement"],["CBAHI","Hospital accreditation"]] }
  },
  {
    id:"3.3", section:"Social/Behavioral/Administrative Sciences", title:"Pharmacoeconomics & Health Outcomes",
    color:"#8b5cf6",
    summary:"ICER = (Cost_new − Cost_old) / (Effect_new − Effect_old). 1 QALY = 1 year in perfect health.",
    keyPoints:[
      "CMA: cost only — when outcomes are equal (generic substitution)",
      "CEA: cost per clinical unit ($/mmHg, $/LYS) — comparing same disease",
      "CUA: cost per QALY — comparing across different diseases",
      "CBA: net monetary benefit — full financial ROI",
      "ICER < WTP threshold → cost-effective",
      "QALY combines length AND quality of life",
    ],
    table:{ headers:["Analysis","Outcome","When to use"], rows:[["CMA","Cost only","Equal outcomes"],["CEA","$/clinical unit","Same disease"],["CUA","$/QALY","Across diseases"],["CBA","Net $","Full ROI"]] }
  },
  {
    id:"4.1", section:"Clinical Sciences", title:"Therapeutic Drug Monitoring (TDM)",
    color:"#ef4444",
    summary:"TDM = Narrow TI + high PK variability + clear concentration-effect relationship + established target range. Steady state = 4–5 × t½.",
    keyPoints:[
      "Vancomycin: AUC/MIC 400–600 (Bayesian preferred) — avoid nephrotoxicity",
      "Gentamicin: Peak 5–10, Trough <2 mg/L — once-daily preferred",
      "Phenytoin: 10–20 mg/L — NON-LINEAR kinetics (small dose → big level rise)",
      "Lithium: 0.6–1.2 mEq/L — toxicity >1.5. Precipitated by NSAIDs, dehydration, thiazides",
      "Digoxin: 0.5–0.9 ng/mL (HF) — hypokalemia ↑ toxicity. Sample ≥6h post-dose",
      "Measure trough JUST BEFORE next dose at steady state",
    ],
    table:{ headers:["Drug","Target","Sampling","Key Note"], rows:[["Vancomycin","AUC/MIC 400–600","Bayesian","Avoid nephrotoxicity"],["Phenytoin","10–20 mg/L","Steady state 7–10d","Non-linear kinetics"],["Lithium","0.6–1.2 mEq/L","12h post-dose","NSAIDs ↑ toxicity"],["Digoxin","0.5–0.9 ng/mL (HF)","≥6h post-dose","Hypokalemia ↑ toxicity"]] }
  },
  {
    id:"4.2", section:"Clinical Sciences", title:"Pregnancy & Lactation",
    color:"#ef4444",
    summary:"Pregnancy alters PK: ↑Vd, ↑renal clearance, ↑hepatic metabolism. Folic acid 0.4 mg/day starting 1 month BEFORE conception.",
    keyPoints:[
      "First-line HTN in pregnancy: Methyldopa, Labetalol, Nifedipine",
      "AVOID in pregnancy: ACE-I/ARB (fetal renal damage), Warfarin (X), Methotrexate (X), Isotretinoin (X)",
      "Category X: Warfarin, Isotretinoin, Methotrexate, Thalidomide — absolutely contraindicated",
      "Tetracyclines (>1st trim): tooth discoloration + bone growth suppression in fetus",
      "Folic acid 4 mg/day if prior neural tube defect pregnancy",
      "Safest antidiabetics: Metformin + Insulin",
    ],
    table:{ headers:["FDA Cat","Meaning","Examples"], rows:[["A","No risk — human studies","Folic acid, Levothyroxine"],["B","Animal safe, no human data","Penicillins, Metformin"],["C","Animal risk, benefit may outweigh","Fluconazole single-dose"],["D","Human risk — benefit may justify","Phenytoin, Tetracyclines"],["X","Contraindicated","Warfarin, Isotretinoin, MTX"]] }
  },
  {
    id:"4.3", section:"Clinical Sciences", title:"Pediatric Pharmacotherapy",
    color:"#ef4444",
    summary:"Children ≠ small adults. Immature CYP enzymes + renal function. Always use weight-based dosing (mg/kg), cap at max adult dose.",
    keyPoints:[
      "Tetracyclines <8 years: tooth discoloration + bone growth depression",
      "Fluoroquinolones <18 years: cartilage damage",
      "Aspirin <18 years with viral illness: Reye's syndrome (liver failure + encephalopathy)",
      "Codeine <12 years: ultra-rapid CYP2D6 metabolizers → fatal respiratory depression",
      "Honey <1 year: infant botulism",
      "Chloramphenicol in neonates: Gray Baby Syndrome (cardiovascular collapse)",
      "Promethazine <2 years: fatal respiratory depression",
    ],
    table:{ headers:["Drug","Age restriction","Reason"], rows:[["Tetracyclines","<8 years","Teeth/bone damage"],["Fluoroquinolones","<18 years","Cartilage damage"],["Aspirin","<18 + viral illness","Reye's syndrome"],["Codeine","<12 years","Fatal respiratory depression"],["Honey","<1 year","Infant botulism"]] }
  },
  {
    id:"4.4", section:"Clinical Sciences", title:"Hypertension Management",
    color:"#ef4444",
    summary:"Target BP <130/80 (AHA/ACC 2017) in most adults. ACE-I cough: 5–20% → switch to ARB.",
    keyPoints:[
      "ACE-I (Ramipril): HF, post-MI, CKD+proteinuria, DM — avoid: pregnancy, bilateral RAS, hyperkalemia",
      "ARB (Losartan): same as ACE-I, no cough — avoid: pregnancy",
      "CCB-DHP (Amlodipine): elderly, angina, isolated systolic HTN — avoid: HFrEF",
      "Thiazide (HCTZ): elderly, Black patients — avoid: gout, hypokalemia",
      "Beta-blocker: post-MI, HF, angina — avoid: asthma, AV block, bradycardia",
      "HTN urgency (>180/120, no organ damage): gradual ↓ over 24–48h with oral agents",
      "HTN emergency (+ organ damage): IV agents, ICU, ↓MAP by 25% in 1h",
    ],
    table:{ headers:["Class","First-line for","Avoid in"], rows:[["ACE-I","HF, CKD, DM","Pregnancy, bilateral RAS"],["ARB","ACE-I cough","Pregnancy"],["CCB-DHP","Elderly, angina","HFrEF"],["Thiazide","Elderly, Black","Gout"],["Beta-blocker","Post-MI, HF","Asthma, AV block"]] }
  },
  {
    id:"4.5", section:"Clinical Sciences", title:"Type 2 Diabetes Mellitus",
    color:"#ef4444",
    summary:"First-line: Metformin. SGLT2-i + GLP-1 RA have CV/renal mortality benefit. HbA1c target: <7% most adults.",
    keyPoints:[
      "Metformin: ↓hepatic gluconeogenesis, first-line, weight neutral — stop at CrCl <30 (lactic acidosis); hold before contrast",
      "SGLT2-i (Empagliflozin): ↑urinary glucose, CV + renal protection, weight loss — SE: genital infections, euglycemic DKA",
      "GLP-1 RA (Semaglutide): ↑insulin (glucose-dep), weight loss, CV benefit — SE: pancreatitis, nausea",
      "Sulfonylureas: ↑insulin secretion, cheap — SE: hypoglycemia + weight gain",
      "Prefer SGLT2-i or GLP-1 RA in ASCVD, HF, or CKD regardless of A1c",
      "HbA1c targets: most adults <7% | elderly/frail <8% | young/healthy <6.5%",
    ],
    table:{ headers:["Drug","Mechanism","Key Benefit","Warning"], rows:[["Metformin","↓Gluconeogenesis","First-line, weight neutral","Hold if CrCl<30"],["SGLT2-i","↑Urine glucose","CV+renal protection","Genital infections, DKA"],["GLP-1 RA","↑Insulin (glucose-dep)","Weight loss, CV benefit","Pancreatitis"],["Sulphonylureas","↑Insulin secretion","Cheap, effective","Hypoglycemia, weight↑"]] }
  },
  {
    id:"4.6", section:"Clinical Sciences", title:"Antibiotic Selection by Pathogen",
    color:"#ef4444",
    summary:"Always de-escalate based on culture results. MRSA: Vancomycin IV. Pseudomonas: Pip-Tazo/Cefepime/Meropenem.",
    keyPoints:[
      "MSSA: Cloxacillin/Nafcillin/Cefazolin — NOT Amoxicillin alone",
      "MRSA: Vancomycin IV (AUC/MIC 400–600) | Alternative: Linezolid, Daptomycin",
      "Pseudomonas (severe): Pip-Tazo + Aminoglycoside — combine 2 agents",
      "C. difficile: Vancomycin PO or Fidaxomicin (Metronidazole no longer preferred)",
      "TB (RIPE): Rifampicin + INH + Pyrazinamide + Ethambutol × 6 months",
      "H. pylori: PPI + Amoxicillin + Clarithromycin × 14 days",
      "E. coli UTI: Nitrofurantoin/TMP-SMX (avoid empiric FQ)",
    ],
    table:{ headers:["Pathogen","First-line","Avoid"], rows:[["MRSA","Vancomycin IV","Amoxicillin"],["Pseudomonas","Pip-Tazo + Aminoglycoside","Ceftriaxone, Amoxicillin"],["C. difficile","Vancomycin PO / Fidaxomicin","Metronidazole (not preferred)"],["TB","RIPE × 6 months","Monotherapy"],["H. pylori","PPI + Amox + Clarithromycin","—"]] }
  },
  {
    id:"4.7", section:"Clinical Sciences", title:"Anticoagulation Therapy",
    color:"#ef4444",
    summary:"UFH: aPTT 60–90s → Protamine. LMWH: Anti-Xa. Warfarin: INR 2–3. DOACs: preferred in AF (no monitoring).",
    keyPoints:[
      "HIT: platelets ↓5–10 days after heparin → PARADOXICAL thrombosis. Stop ALL heparin → Argatroban/DOAC",
      "Warfarin reversal: Vit K (onset 6–12h) + 4F-PCC (active bleeding)",
      "Dabigatran reversal: Idarucizumab (Praxbind)",
      "Rivaroxaban/Apixaban reversal: Andexanet alfa",
      "INR 2–3: most indications | 2.5–3.5: mechanical mitral valve",
      "CHA₂DS₂-VASc ≥2 (men) or ≥3 (women) → anticoagulate in AF → prefer DOACs",
    ],
    table:{ headers:["Drug","Mechanism","Monitoring","Reversal"], rows:[["UFH","Antithrombin III","aPTT","Protamine"],["LMWH","Factor Xa","Anti-Xa (special cases)","Protamine (60%)"],["Warfarin","Vit K factors II,VII,IX,X","INR","Vit K + 4F-PCC"],["DOACs","Xa or IIa","None routine","Andexanet/Idarucizumab"]] }
  },
  {
    id:"4.8", section:"Clinical Sciences", title:"Asthma & COPD Management",
    color:"#ef4444",
    summary:"GINA: SABA monotherapy no longer recommended. Prefer ICS-Formoterol PRN. COPD GOLD stages by FEV1%.",
    keyPoints:[
      "GINA Step 1: ICS-Formoterol PRN | Step 2: Low-dose ICS daily | Step 3: Low-dose ICS+LABA",
      "Step 4: Medium-high ICS+LABA+/-LAMA | Step 5: Add biologic (Omalizumab anti-IgE, Mepolizumab anti-IL5)",
      "LABA NEVER as monotherapy in asthma → ↑ asthma death risk",
      "COPD GOLD 1: FEV1 ≥80% | GOLD 2: 50–80% | GOLD 3: 30–50% | GOLD 4: <30%",
      "COPD exacerbation: SABA + systemic steroids 5 days + antibiotics if purulent sputum",
      "Acute asthma attack reliever: Salbutamol (SABA) inhaler/nebulizer",
    ],
    table:{ headers:["GINA Step","Severity","Controller"], rows:[["1","Intermittent","ICS-Formoterol PRN"],["2","Mild persistent","Low-dose ICS daily"],["3","Mild-moderate","Low-dose ICS + LABA"],["4","Moderate-severe","Medium-high ICS + LABA ± LAMA"],["5","Severe","+ Biologic"]] }
  },
  {
    id:"4.9", section:"Clinical Sciences", title:"Major Drug-Drug Interactions",
    color:"#ef4444",
    summary:"Most DDIs: CYP450 induction/inhibition, P-gp, or pharmacodynamic synergy. ~5% of hospital admissions.",
    keyPoints:[
      "Warfarin + Rifampicin: ↑CYP2C9 induction → ↓INR → thrombosis",
      "Warfarin + Fluconazole/Metronidazole: inhibit CYP2C9 → ↑INR → bleeding",
      "Statins + Erythromycin/Itraconazole: ↑statin → rhabdomyolysis → use Rosuvastatin/Pravastatin",
      "Clopidogrel + Omeprazole/Esomeprazole: ↓activation via CYP2C19 → switch to Pantoprazole",
      "Digoxin + Amiodarone/Verapamil: ↑digoxin × 2 → ↓dose 50% + monitor",
      "SSRI + Tramadol/MAOI: Serotonin syndrome (mental status ↓ + autonomic instability + clonus)",
      "Fluoroquinolones + Antacids/Iron/Calcium: chelation → ↓FQ absorption → separate by 2–4h",
    ],
    table:{ headers:["Object Drug","Precipitant","Effect","Action"], rows:[["Warfarin","Rifampicin","↓INR → thrombosis","↑Warfarin dose"],["Warfarin","Fluconazole","↑INR → bleeding","↓Warfarin ~50%"],["Statins","Erythromycin","↑statin → rhabdomyo","Rosuvastatin/Pravastatin"],["Clopidogrel","Omeprazole","↓activation","Switch to Pantoprazole"],["Digoxin","Amiodarone","↑Digoxin ×2","↓dose 50%"]] }
  },
];

// ===================== STUDY MATERIALS SCREEN =====================
function StudyMaterialsScreen({ onBack, onStartStudy }) {
  const [selected, setSelected] = useState(null);
  const secColors = { "Basic Biomedical Sciences":"#3b82f6","Pharmaceutical Sciences":"#10b981","Social/Behavioral/Administrative Sciences":"#8b5cf6","Clinical Sciences":"#ef4444" };

  if (selected) {
    const lesson = STUDY_LESSONS.find(l => l.id === selected);
    return (
      <div style={{ minHeight:"100vh", background:"#0f172a", fontFamily:"system-ui,sans-serif", color:"#f1f5f9" }}>
        <div style={{ background:"rgba(255,255,255,0.03)", borderBottom:"1px solid rgba(255,255,255,0.08)", padding:"12px 24px", display:"flex", alignItems:"center", gap:12 }}>
          <button onClick={()=>setSelected(null)} style={{ ...S.ghost, padding:"6px 12px", fontSize:13 }}>← Back</button>
          <div style={{ color:lesson.color, fontWeight:800 }}>Lesson {lesson.id}: {lesson.title}</div>
        </div>
        <div style={{ maxWidth:760, margin:"0 auto", padding:24 }}>
          {/* Summary box */}
          <div style={{ background:lesson.color+"15", border:`1px solid ${lesson.color}44`, borderRadius:14, padding:18, marginBottom:20 }}>
            <div style={{ color:lesson.color, fontWeight:700, fontSize:13, marginBottom:8 }}>📌 Core Concept</div>
            <p style={{ color:"#e2e8f0", fontSize:14, lineHeight:1.7, margin:0 }}>{lesson.summary}</p>
          </div>

          {/* Key points */}
          <div style={{ ...S.card, marginBottom:20 }}>
            <div style={{ fontWeight:700, fontSize:15, marginBottom:14, color:lesson.color }}>🎯 Key Points</div>
            <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
              {lesson.keyPoints.map((pt,i)=>(
                <div key={i} style={{ display:"flex", gap:10, padding:"10px 14px", background:"rgba(255,255,255,0.03)", borderRadius:10, borderLeft:`3px solid ${lesson.color}` }}>
                  <span style={{ color:lesson.color, fontWeight:800, flexShrink:0 }}>{i+1}.</span>
                  <span style={{ color:"#cbd5e1", fontSize:13, lineHeight:1.6 }}>{pt}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Table */}
          {lesson.table && (
            <div style={{ ...S.card, marginBottom:24, padding:0, overflow:"hidden" }}>
              <div style={{ padding:"12px 16px", background:lesson.color+"18", fontWeight:700, fontSize:14, color:lesson.color }}>📊 Quick Reference Table</div>
              <table style={{ width:"100%", borderCollapse:"collapse", fontSize:12 }}>
                <thead><tr style={{ background:"rgba(255,255,255,0.05)" }}>
                  {lesson.table.headers.map(h=><th key={h} style={{ padding:"10px 14px", textAlign:"left", color:"#64748b", fontWeight:600, borderBottom:"1px solid rgba(255,255,255,0.08)" }}>{h}</th>)}
                </tr></thead>
                <tbody>{lesson.table.rows.map((row,i)=>(
                  <tr key={i} style={{ borderBottom:"1px solid rgba(255,255,255,0.05)" }}>
                    {row.map((cell,j)=><td key={j} style={{ padding:"9px 14px", color:j===0?"#f1f5f9":"#94a3b8", fontWeight:j===0?600:400 }}>{cell}</td>)}
                  </tr>
                ))}</tbody>
              </table>
            </div>
          )}

          <button onClick={onStartStudy} style={{ ...S.btn("#10b981"), width:"100%", padding:14, fontSize:15 }}>
            📝 Start Study Session with Questions →
          </button>
        </div>
      </div>
    );
  }

  // Lesson list grouped by section
  const grouped = {};
  STUDY_LESSONS.forEach(l => { if(!grouped[l.section]) grouped[l.section]=[]; grouped[l.section].push(l); });

  return (
    <div style={{ minHeight:"100vh", background:"#0f172a", fontFamily:"system-ui,sans-serif", color:"#f1f5f9" }}>
      <div style={{ background:"rgba(255,255,255,0.03)", borderBottom:"1px solid rgba(255,255,255,0.08)", padding:"12px 24px", display:"flex", alignItems:"center", gap:12 }}>
        <button onClick={onBack} style={{ ...S.ghost, padding:"6px 12px", fontSize:13 }}>← Dashboard</button>
        <div style={{ fontWeight:800, fontSize:16 }}>📚 Study Materials</div>
        <div style={{ marginLeft:"auto", color:"#64748b", fontSize:12 }}>{STUDY_LESSONS.length} Lessons · 23 Topics</div>
      </div>
      <div style={{ maxWidth:760, margin:"0 auto", padding:24 }}>
        <div style={{ ...S.card, marginBottom:24, background:"rgba(16,185,129,0.06)", border:"1px solid rgba(16,185,129,0.3)" }}>
          <div style={{ display:"flex", gap:14, alignItems:"center" }}>
            <div style={{ fontSize:36 }}>📖</div>
            <div>
              <div style={{ fontWeight:800, fontSize:16, color:"#10b981" }}>SPLE Study Material</div>
              <div style={{ color:"#64748b", fontSize:13, marginTop:4 }}>23 lessons covering all 4 SCFHS domains · Per SCFHS Blueprint</div>
              <div style={{ display:"flex", gap:8, marginTop:8, flexWrap:"wrap" }}>
                {[["10%","Basic Biomedical","#3b82f6"],["35%","Pharmaceutical","#10b981"],["20%","Social/Admin","#8b5cf6"],["35%","Clinical","#ef4444"]].map(([pct,label,c])=>(
                  <span key={label} style={{ background:c+"18", color:c, fontSize:11, fontWeight:700, padding:"2px 10px", borderRadius:20 }}>{pct} {label}</span>
                ))}
              </div>
            </div>
          </div>
        </div>

        {Object.entries(grouped).map(([section, lessons])=>(
          <div key={section} style={{ marginBottom:24 }}>
            <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:12 }}>
              <div style={{ width:4, height:20, background:secColors[section], borderRadius:2 }} />
              <div style={{ fontWeight:700, fontSize:14, color:secColors[section] }}>{section}</div>
              <div style={{ color:"#475569", fontSize:12 }}>({lessons.length} lessons)</div>
            </div>
            <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
              {lessons.map(l=>(
                <button key={l.id} onClick={()=>setSelected(l.id)} style={{ background:"rgba(255,255,255,0.04)", border:`1px solid ${l.color}22`, borderRadius:12, padding:"14px 18px", cursor:"pointer", textAlign:"left", display:"flex", alignItems:"center", gap:14, transition:"all 0.2s" }}
                  onMouseEnter={e=>{e.currentTarget.style.background=`${l.color}12`; e.currentTarget.style.borderColor=`${l.color}55`;}}
                  onMouseLeave={e=>{e.currentTarget.style.background="rgba(255,255,255,0.04)"; e.currentTarget.style.borderColor=`${l.color}22`;}}>
                  <div style={{ width:36, height:36, borderRadius:10, background:l.color+"22", display:"flex", alignItems:"center", justifyContent:"center", color:l.color, fontWeight:800, fontSize:13, flexShrink:0 }}>{l.id}</div>
                  <div style={{ flex:1 }}>
                    <div style={{ fontWeight:700, color:"#f1f5f9", fontSize:14 }}>{l.title}</div>
                    <div style={{ color:"#64748b", fontSize:12, marginTop:2 }}>{l.keyPoints.length} key points · Click to study</div>
                  </div>
                  <div style={{ color:l.color, fontSize:18 }}>→</div>
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
function StudyScreen({ questions, onFinish, onHome }) {
  const [cur, setCur] = useState(0);
  const [answers, setAnswers] = useState({});
  const [showExp, setShowExp] = useState(false);
  const q = questions[cur];
  const answered = answers[q.id] !== undefined;
  const correct = answers[q.id] === q.answer;
  const col = SC[q.section] || { accent:"#10b981", bg:"#1e4a3a" };
  const diffCol = { "سهل":"#22c55e", "متوسط":"#f59e0b", "صعب":"#ef4444" };
  const next = () => { setShowExp(false); if (cur < questions.length-1) setCur(p=>p+1); else onFinish(answers); };

  return (
    <div style={{ minHeight:"100vh", background:"#0f172a", fontFamily:"system-ui,sans-serif", color:"#f1f5f9" }}>
      <div style={{ background:col.bg, borderBottom:`1px solid #10b98144`, padding:"11px 22px", display:"flex", justifyContent:"space-between", alignItems:"center" }}>
        <div style={{ display:"flex", alignItems:"center", gap:10 }}>
          <button onClick={onHome} style={{ background:"rgba(255,255,255,0.1)", border:"none", borderRadius:8, padding:"5px 12px", color:"#94a3b8", cursor:"pointer", fontSize:12 }}>🏠 Home</button>
          <span style={{ color:"#94a3b8", fontSize:13 }}>📚 Study · Q {cur+1}/{questions.length}</span>
        </div>
        <span style={{ background:"rgba(16,185,129,0.15)", color:"#10b981", fontSize:12, fontWeight:700, padding:"4px 12px", borderRadius:20 }}>Study Mode</span>
        <span style={{ color:diffCol[q.difficulty], fontWeight:700, fontSize:13 }}>{q.difficulty}</span>
      </div>
      <div style={{ height:4, background:"rgba(255,255,255,0.08)" }}><div style={{ width:`${((cur+1)/questions.length)*100}%`, height:"100%", background:"#10b981", transition:"width 0.3s" }} /></div>
      <div style={{ maxWidth:700, margin:"0 auto", padding:22 }}>
        <div style={{ color:"#10b981", fontSize:10, fontWeight:700, marginBottom:8, textTransform:"uppercase", letterSpacing:1 }}>{q.section} · {q.category}</div>
        <div style={{ ...S.card, border:"1px solid rgba(16,185,129,0.2)", marginBottom:18 }}><p style={{ fontSize:16, lineHeight:1.7, margin:0, fontWeight:500 }}>{q.question}</p></div>
        <div style={{ display:"flex", flexDirection:"column", gap:9, marginBottom:18 }}>
          {q.options.map((opt,i) => {
            let bg="rgba(255,255,255,0.04)", border="1px solid rgba(255,255,255,0.1)", c="#e2e8f0";
            if (answered) {
              if (i === q.answer) { bg="rgba(34,197,94,0.12)"; border="1.5px solid #22c55e"; c="#86efac"; }
              else if (i === answers[q.id]) { bg="rgba(239,68,68,0.12)"; border="1.5px solid #ef4444"; c="#fca5a5"; }
            }
            return <button key={i} onClick={()=>{ if(!answered){ setAnswers(p=>({...p,[q.id]:i})); setShowExp(true); }}} style={{ background:bg,border,borderRadius:11,padding:"12px 16px",cursor:answered?"default":"pointer",textAlign:"left",color:c,fontSize:13,display:"flex",alignItems:"center",gap:10 }}>
              <span style={{ width:26,height:26,borderRadius:7,background:"rgba(255,255,255,0.08)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:11,fontWeight:700,flexShrink:0,color:"#94a3b8" }}>{["A","B","C","D"][i]}</span>
              {opt}
              {answered && i===q.answer && <span style={{ marginLeft:"auto" }}>✓</span>}
              {answered && i===answers[q.id] && i!==q.answer && <span style={{ marginLeft:"auto" }}>✗</span>}
            </button>;
          })}
        </div>
        {showExp && <div style={{ background:correct?"rgba(34,197,94,0.08)":"rgba(239,68,68,0.08)", border:`1px solid ${correct?"rgba(34,197,94,0.3)":"rgba(239,68,68,0.3)"}`, borderRadius:12, padding:16, marginBottom:16 }}>
          <div style={{ fontWeight:700, marginBottom:6, color:correct?"#86efac":"#fca5a5", fontSize:13 }}>{correct?"✅ Correct!":"❌ Incorrect"}</div>
          <p style={{ color:"#cbd5e1", fontSize:13, lineHeight:1.7, margin:0 }}>💡 {q.explanation || "No explanation provided."}</p>
        </div>}
        {answered && <button onClick={next} style={{ ...S.btn("#10b981"), width:"100%", padding:13 }}>{cur<questions.length-1?"Next →":"🏁 Finish Study Session"}</button>}
      </div>
    </div>
  );
}

function ExamScreen({ questions, onFinish, timeMins }) {
  const [cur, setCur] = useState(0);
  const [answers, setAnswers] = useState({});
  const [secsLeft, setSecsLeft] = useState((timeMins || 120) * 60);

  useEffect(() => {
    const t = setInterval(() => {
      setSecsLeft(s => {
        if (s <= 1) { clearInterval(t); onFinish(answers); return 0; }
        return s - 1;
      });
    }, 1000);
    return () => clearInterval(t);
  }, []);

  const h = Math.floor(secsLeft / 3600);
  const m = Math.floor((secsLeft % 3600) / 60);
  const s = secsLeft % 60;
  const timeStr = h > 0 ? `${h}:${String(m).padStart(2,"0")}:${String(s).padStart(2,"0")}` : `${m}:${String(s).padStart(2,"0")}`;
  const timePct = secsLeft / ((timeMins || 120) * 60);
  const timerColor = timePct > 0.25 ? "#22c55e" : timePct > 0.1 ? "#f59e0b" : "#ef4444";

  const q = questions[cur];
  const answered = answers[q.id] !== undefined;
  const col = SC[q.section] || { accent:"#3b82f6", bg:"#1e3a5f" };
  const diffCol = { "سهل":"#22c55e", "متوسط":"#f59e0b", "صعب":"#ef4444" };
  const next = () => { if (cur < questions.length-1) setCur(p=>p+1); else onFinish(answers); };

  return (
    <div style={{ minHeight:"100vh", background:"#0f172a", fontFamily:"system-ui,sans-serif", color:"#f1f5f9" }}>
      <div style={{ background:col.bg, borderBottom:`1px solid ${col.accent}44`, padding:"11px 22px", display:"flex", justifyContent:"space-between", alignItems:"center" }}>
        <span style={{ color:"#94a3b8", fontSize:13 }}>🎯 Exam · Q {cur+1}/{questions.length}</span>
        <div style={{ display:"flex", alignItems:"center", gap:6, background:"rgba(0,0,0,0.3)", borderRadius:8, padding:"5px 12px" }}>
          <span style={{ fontSize:14 }}>⏱️</span>
          <span style={{ color:timerColor, fontWeight:800, fontSize:15, fontFamily:"monospace" }}>{timeStr}</span>
        </div>
        <span style={{ color:diffCol[q.difficulty], fontWeight:700, fontSize:13 }}>{q.difficulty}</span>
      </div>
      <div style={{ height:4, background:"rgba(255,255,255,0.08)" }}><div style={{ width:`${((cur+1)/questions.length)*100}%`, height:"100%", background:col.accent, transition:"width 0.3s" }} /></div>
      <div style={{ height:3, background:"rgba(255,255,255,0.05)" }}><div style={{ width:`${timePct*100}%`, height:"100%", background:timerColor, transition:"width 1s linear" }} /></div>
      <div style={{ maxWidth:700, margin:"0 auto", padding:22 }}>
        <div style={{ color:col.accent, fontSize:10, fontWeight:700, marginBottom:8, textTransform:"uppercase", letterSpacing:1 }}>{q.section} · {q.category}</div>
        <div style={{ ...S.card, border:`1px solid ${col.accent}33`, marginBottom:18 }}><p style={{ fontSize:16, lineHeight:1.7, margin:0, fontWeight:500 }}>{q.question}</p></div>
        <div style={{ display:"flex", flexDirection:"column", gap:9, marginBottom:18 }}>
          {q.options.map((opt,i) => {
            const selected = answers[q.id] === i;
            return <button key={i} onClick={()=>setAnswers(p=>({...p,[q.id]:i}))} style={{ background:selected?"rgba(59,130,246,0.15)":"rgba(255,255,255,0.04)", border:selected?`1.5px solid ${col.accent}`:"1px solid rgba(255,255,255,0.1)", borderRadius:11, padding:"12px 16px", cursor:"pointer", textAlign:"left", color:selected?"#93c5fd":"#e2e8f0", fontSize:13, display:"flex", alignItems:"center", gap:10 }}>
              <span style={{ width:26,height:26,borderRadius:7,background:selected?col.accent+"33":"rgba(255,255,255,0.08)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:11,fontWeight:700,flexShrink:0,color:selected?col.accent:"#94a3b8" }}>{["A","B","C","D"][i]}</span>
              {opt}
              {selected && <span style={{ marginLeft:"auto", color:col.accent }}>●</span>}
            </button>;
          })}
        </div>
        <button onClick={next} style={{ ...S.btn(col.accent), width:"100%", padding:13 }}>
          {cur < questions.length-1 ? (answered ? "Next →" : "Skip →") : "🏁 Finish Exam"}
        </button>
      </div>
    </div>
  );
}

function ResultsScreen({ questions, answers, onRetry, onHome, userName, mode }) {
  const correct=questions.filter(q=>answers[q.id]===q.answer).length;
  const score=Math.round((correct/questions.length)*100);
  const grade=score>=85?{label:"Excellent",color:"#22c55e",emoji:"🏆"}:score>=70?{label:"Good",color:"#3b82f6",emoji:"🎯"}:score>=60?{label:"Pass",color:"#f59e0b",emoji:"📈"}:{label:"Needs Review",color:"#ef4444",emoji:"📚"};
  const circ=2*Math.PI*52;
  const bySection=SECTIONS.reduce((acc,sec)=>{ const qs=questions.filter(q=>q.section===sec); if(!qs.length) return acc; const c=qs.filter(q=>answers[q.id]===q.answer).length; acc[sec]={total:qs.length,correct:c,pct:Math.round(c/qs.length*100)}; return acc; },{});
  const isExam = mode === "exam" || !mode;
  return (
    <div style={{ minHeight:"100vh", background:"#0f172a", fontFamily:"system-ui,sans-serif", color:"#f1f5f9", padding:24 }}>
      <div style={{ maxWidth:600, margin:"0 auto" }}>
        <h2 style={{ textAlign:"center", fontSize:22, fontWeight:800, marginBottom:4 }}>{isExam ? "🎯 Exam Complete!" : "📚 Study Session Complete!"}</h2>
        {userName&&<p style={{ textAlign:"center", color:"#64748b", marginBottom:20 }}>Great effort, {userName}!</p>}
        <div style={{ display:"flex", justifyContent:"center", marginBottom:20 }}>
          <div style={{ ...S.card, textAlign:"center", minWidth:260 }}>
            <svg width="110" height="110" viewBox="0 0 120 120" style={{ marginBottom:10 }}>
              <circle cx="60" cy="60" r="52" fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="10"/>
              <circle cx="60" cy="60" r="52" fill="none" stroke={grade.color} strokeWidth="10" strokeDasharray={circ} strokeDashoffset={circ-(score/100)*circ} strokeLinecap="round" transform="rotate(-90 60 60)"/>
              <text x="60" y="55" textAnchor="middle" fill={grade.color} fontSize="24" fontWeight="800">{score}%</text>
              <text x="60" y="73" textAnchor="middle" fill="#64748b" fontSize="10">{grade.emoji} {grade.label}</text>
            </svg>
            <div style={{ display:"flex", gap:16, justifyContent:"center" }}>
              {[["✅",correct,"Correct"],["❌",questions.length-correct,"Wrong"],["⬜",questions.length-Object.keys(answers).length,"Skipped"]].map(([e,n,l])=><div key={l}><div style={{ fontSize:18, fontWeight:800 }}>{n}</div><div style={{ color:"#64748b", fontSize:12 }}>{e} {l}</div></div>)}
            </div>
          </div>
        </div>
        {Object.keys(bySection).length>1 && (
          <div style={{ ...S.card, marginBottom:16 }}>
            <div style={{ fontWeight:700, marginBottom:12, fontSize:14 }}>Performance by Section</div>
            {Object.entries(bySection).map(([sec,{total,correct:c,pct}])=>{
              const col=SC[sec]||{accent:"#3b82f6"};
              const short=sec==="Social/Behavioral/Administrative Sciences"?"Social/Admin":sec.split(" ")[0];
              return <div key={sec} style={{ marginBottom:10 }}>
                <div style={{ display:"flex", justifyContent:"space-between", fontSize:12, marginBottom:4 }}><span style={{ color:"#cbd5e1" }}>{short}</span><span style={{ color:col.accent, fontWeight:700 }}>{c}/{total} ({pct}%)</span></div>
                <div style={{ height:6, background:"rgba(255,255,255,0.08)", borderRadius:3 }}><div style={{ width:`${pct}%`, height:"100%", borderRadius:3, background:col.accent }} /></div>
              </div>;
            })}
          </div>
        )}
        <div style={{ display:"flex", gap:10 }}>
          <button onClick={onHome} style={{ flex:1, ...S.ghost, padding:13, fontSize:14 }}>🏠 Dashboard</button>
          <button onClick={onRetry} style={{ flex:1, ...S.btn(isExam?"#ef4444":"#10b981"), padding:13 }}>🔄 {isExam?"New Exam":"New Study Session"}</button>
        </div>
      </div>
    </div>
  );
}

export default function App() {
  const [user, setUser] = useState(null);
  if (!user) return <LoginScreen onLogin={setUser} />;
  if (user.role==="admin") return <AdminDashboard user={user} onLogout={()=>setUser(null)} />;
  return <StudentDashboard user={user} onLogout={()=>setUser(null)} />;
}
