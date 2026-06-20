import { useState, useEffect } from "react";
import * as XLSX from "xlsx";

const API_URL = "https://y0ww5f6rnf.execute-api.eu-north-1.amazonaws.com/prod";

// ===================== API HELPERS =====================
const api = {
  getQuestions: async () => {
    try {
      const res = await fetch(`${API_URL}/questions`);
      if (!res.ok) throw new Error("API error " + res.status);
      const data = await res.json();
      const questions = Array.isArray(data) ? data.filter(q => q.id !== "config") : [];
      if (questions.length > 0) {
        // Merge: prefer assign from DynamoDB (already stored there via PATCH)
        // DynamoDB is source of truth for assign field
        localStorage.setItem("sple_questions_cache", JSON.stringify(questions));
        localStorage.setItem("sple_questions_cache_time", Date.now().toString());
      }
      return questions.length > 0 ? questions : DEFAULT_QUESTIONS;
    } catch (e) {
      console.error("Failed to fetch questions from API:", e);
      const cached = localStorage.getItem("sple_questions_cache");
      return cached ? JSON.parse(cached) : DEFAULT_QUESTIONS;
    }
  },
  updateQuestion: async (id, fields) => {
    try {
      await fetch(`${API_URL}/questions/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(fields)
      });
    } catch (e) { console.error(e); }
  },
  getBankQuestions: async (bank) => {
    try {
      const res = await fetch(`${API_URL}/${bank}`);
      if (!res.ok) throw new Error("API error");
      return await res.json();
    } catch (e) { console.error(e); return []; }
  },
  uploadToBank: async (bank, questions) => {
    const res = await fetch(`${API_URL}/${bank}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(questions)
    });
    return await res.json();
  },
  clearBank: async (bank) => {
    const res = await fetch(`${API_URL}/${bank}`, { method: "DELETE" });
    return await res.json();
  },
};

const DB = {
  getUsers: () => JSON.parse(localStorage.getItem("sple_users") || "[]"),
  saveUsers: (u) => localStorage.setItem("sple_users", JSON.stringify(u)),
  getResults: () => JSON.parse(localStorage.getItem("sple_results") || "[]"),
  saveResults: (r) => localStorage.setItem("sple_results", JSON.stringify(r)),
  getQuestions: () => { const s = localStorage.getItem("sple_questions_cache"); return s ? JSON.parse(s) : DEFAULT_QUESTIONS; },
  saveQuestions: (q) => localStorage.setItem("sple_questions_cache", JSON.stringify(q)),
  getStudyQuestions: () => { const s = localStorage.getItem("sple_study_questions"); return s ? JSON.parse(s) : []; },
  saveStudyQuestions: (q) => localStorage.setItem("sple_study_questions", JSON.stringify(q)),
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
  "Basic Biomedical Sciences":                   { pct:10, color:"#2563A8", sub:["Physiology","Biochemistry","Microbiology","Immunology"] },
  "Pharmaceutical Sciences":                      { pct:35, color:"#1A7A5E", sub:["Medicinal Chemistry","Pharmacology & Toxicology","Pharmacognosy","Pharmaceutics","Pharmacokinetics","Sterile Compounding"] },
  "Social/Behavioral/Administrative Sciences":    { pct:20, color:"#7C4BA0", sub:["Health Care Delivery (KSA)","Pharmacoepidemiology","Pharmacy Management","Pharmacy Law & SFDA","Biostatistics","Ethics"] },
  "Clinical Sciences":                            { pct:35, color:"#B83B2A", sub:["Drug Information & EBP","Clinical Pharmacokinetics","Patient Assessment","Clinical Pharmacology","Special Populations"] },
};

// Design tokens — warm professional beige
const T = {
  bg:      "#F5F0E8",   // warm parchment base
  bg2:     "#EDE8DF",   // slightly darker card bg
  bg3:     "#E4DECE",   // borders/dividers
  surface: "#FDFAF5",   // card surface (lightest)
  ink:     "#1C1814",   // near-black text
  ink2:    "#4A3F35",   // secondary text
  ink3:    "#8C7B6E",   // muted text
  accent:  "#2B5FA6",   // primary blue (professional)
  green:   "#1A7A5E",   // pharmaceutical green
  purple:  "#6B3F96",   // social/admin purple
  red:     "#B83B2A",   // clinical red
  gold:    "#C47A1E",   // warm amber/gold accent
  border:  "rgba(140,110,80,0.18)",
  shadow:  "0 2px 12px rgba(60,40,20,0.08)",
  shadow2: "0 4px 24px rgba(60,40,20,0.13)",
};

const SECTIONS = Object.keys(BLUEPRINT);
const DIFFICULTIES = ["سهل","متوسط","صعب"];
const SC = {
  "Basic Biomedical Sciences":                 { accent:"#2563A8", bg:T.bg },
  "Pharmaceutical Sciences":                    { accent:"#1A7A5E", bg:T.bg },
  "Social/Behavioral/Administrative Sciences":  { accent:"#7C4BA0", bg:T.bg },
  "Clinical Sciences":                          { accent:"#B83B2A", bg:T.bg },
};

// Build a SCHS-blueprint-aligned exam with difficulty distribution
function buildExam(allQuestions, settings) {
  const { totalQ, diffPct } = settings;
  const shuffle = arr => [...arr].sort(() => Math.random() - 0.5);
  const result = [];
  SECTIONS.forEach(sec => {
    const bp = BLUEPRINT[sec];
    const secCount = Math.round(totalQ * bp.pct / 100);
    const pool = allQuestions.filter(q => q.section === sec);
    DIFFICULTIES.forEach(diff => {
      const need = Math.round(secCount * (diffPct[diff] || 33) / 100);
      const diffPool = shuffle(pool.filter(q => q.difficulty === diff));
      result.push(...diffPool.slice(0, need));
    });
  });
  const chosen = shuffle(result).slice(0, totalQ);
  if (chosen.length < totalQ) {
    const usedIds = new Set(chosen.map(q => q.id));
    const remaining = shuffle(allQuestions.filter(q => !usedIds.has(q.id)));
    chosen.push(...remaining.slice(0, totalQ - chosen.length));
  }
  return shuffle(chosen);
}

const S = {
  page:  { minHeight:"100vh", background:T.bg, fontFamily:"'Georgia', 'Times New Roman', serif", color:T.ink, direction:"ltr" },
  card:  { background:T.surface, border:`1px solid ${T.border}`, borderRadius:14, padding:20, boxShadow:T.shadow },
  input: { width:"100%", background:T.surface, border:`1.5px solid ${T.border}`, borderRadius:9, padding:"11px 14px", color:T.ink, fontSize:14, boxSizing:"border-box", outline:"none", fontFamily:"system-ui,sans-serif" },
  btn:   (c=T.accent) => ({ background:c, color:"#fff", border:"none", borderRadius:9, padding:"11px 18px", cursor:"pointer", fontSize:14, fontWeight:700, fontFamily:"system-ui,sans-serif", letterSpacing:"0.01em" }),
  ghost: { background:"transparent", border:`1.5px solid ${T.border}`, color:T.ink2, borderRadius:9, padding:"10px 16px", cursor:"pointer", fontSize:13, fontWeight:600, fontFamily:"system-ui,sans-serif" },
  label: { color:T.ink3, fontSize:12, fontWeight:600, display:"block", marginBottom:5, fontFamily:"system-ui,sans-serif", textTransform:"uppercase", letterSpacing:"0.06em" },
  tag:   (c) => ({ background:c+"18", color:c, padding:"2px 10px", borderRadius:20, fontSize:11, fontWeight:700, display:"inline-block", fontFamily:"system-ui,sans-serif", border:`1px solid ${c}33` }),
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
          <div style={{ width:56, height:56, borderRadius:14, background:"linear-gradient(135deg,#2B5FA6,#1A7A5E)", display:"flex", alignItems:"center", justifyContent:"center", fontSize:28, margin:"0 auto 10px" }}>💊</div>
          <div style={{ fontSize:26, fontWeight:800 }}>SPLE Platform</div>
          <div style={{ color:"#8C7B6E", fontSize:13 }}>Saudi Pharmacist Licensure Exam</div>
        </div>
        <div style={{ display:"flex", background:T.surface, borderRadius:12, padding:4, marginBottom:20 }}>
          {["student","admin"].map(t=>(
            <button key={t} onClick={()=>{setTab(t);setErr("");}} style={{ flex:1, padding:"9px", borderRadius:10, border:"none", cursor:"pointer", fontWeight:700, fontSize:14, background:tab===t?"linear-gradient(135deg,#3b82f6,#6366f1)":"transparent", color:tab===t?"#fff":"#8C7B6E" }}>
              {t==="student"?"🎓 Student":"⚙️ Admin"}
            </button>
          ))}
        </div>
        <div style={S.card}>
          <div style={{ marginBottom:14 }}><label style={S.label}>Email</label><input style={S.input} type="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder={tab==="admin"?"admin123":"student@email.com"} onKeyDown={e=>e.key==="Enter"&&login()} /></div>
          <div style={{ marginBottom:18 }}><label style={S.label}>Password</label><input style={S.input} type="password" value={pass} onChange={e=>setPass(e.target.value)} placeholder="••••••••" onKeyDown={e=>e.key==="Enter"&&login()} /></div>
          {err && <div style={{ background:"rgba(184,59,42,0.08)", border:"1px solid rgba(184,59,42,0.30)", borderRadius:8, padding:"9px 14px", color:"#B83B2A", fontSize:13, marginBottom:14 }}>⚠️ {err}</div>}
          <button style={{ ...S.btn(tab==="admin"?"#7C4BA0":"#2B5FA6"), width:"100%", padding:13 }} onClick={login}>{tab==="admin"?"Sign in as Admin":"Sign in as Student"}</button>
        </div>
        {tab==="admin" && <p style={{ textAlign:"center", color:"#4A3F35", fontSize:11, marginTop:10 }}>admin123 / 123456</p>}
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
        <span style={{ color:"#8C7B6E", fontSize:13 }}>{total} total questions</span>
      </div>

      {/* Section breakdown */}
      <div style={{ marginBottom:16 }}>
        <div style={{ color:"#8C7B6E", fontSize:12, fontWeight:600, marginBottom:10 }}>BY SECTION vs BLUEPRINT TARGET</div>
        {SECTIONS.map(sec => {
          const bp = BLUEPRINT[sec];
          const count = questions.filter(q=>q.section===sec).length;
          const actual = total ? Math.round(count/total*100) : 0;
          const target = bp.pct;
          const short = sec==="Social/Behavioral/Administrative Sciences"?"Social/Admin":sec.split(" ")[0]+" "+sec.split(" ")[1];
          return (
            <div key={sec} style={{ marginBottom:12 }}>
              <div style={{ display:"flex", justifyContent:"space-between", marginBottom:4, fontSize:12 }}>
                <span style={{ color:T.ink2 }}>{short}</span>
                <div style={{ display:"flex", gap:8, alignItems:"center" }}>
                  <span style={{ color:bp.color, fontWeight:700 }}>{count} q ({actual}%)</span>
                  <span style={{ color:T.ink3 }}>target {target}%</span>
                </div>
              </div>
              <div style={{ height:6, background:T.bg3, borderRadius:3, position:"relative" }}>
                <div style={{ width:`${Math.min(actual,100)}%`, height:"100%", borderRadius:3, background:bp.color, transition:"width 0.5s" }} />
                {/* Target marker */}
                <div style={{ position:"absolute", top:-2, left:`${target}%`, width:2, height:10, background:"rgba(140,110,80,0.30)", borderRadius:1 }} />
              </div>
            </div>
          );
        })}
      </div>

      {/* Difficulty + AI row */}
      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12 }}>
        <div>
          <div style={{ color:"#8C7B6E", fontSize:12, fontWeight:600, marginBottom:10 }}>BY DIFFICULTY</div>
          <div style={{ display:"flex", gap:8 }}>
            {[["سهل","#1A7A5E"],["متوسط","#C47A1E"],["صعب","#B83B2A"]].map(([d,c])=>(
              <div key={d} style={{ flex:1, background:c+"11", border:`1px solid ${c}33`, borderRadius:10, padding:"10px 8px", textAlign:"center" }}>
                <div style={{ color:c, fontSize:18, fontWeight:800 }}>{diffCounts[d]}</div>
                <div style={{ color:"#8C7B6E", fontSize:11 }}>{d}</div>
              </div>
            ))}
          </div>
        </div>
        <div>
          <div style={{ color:"#8C7B6E", fontSize:12, fontWeight:600, marginBottom:10 }}>SOURCE</div>
          <div style={{ display:"flex", gap:8 }}>
            <div style={{ flex:1, background:T.bg2, border:`1px solid ${T.border}`, borderRadius:10, padding:"10px 8px", textAlign:"center" }}>
              <div style={{ fontSize:18, fontWeight:800 }}>{total-aiCount}</div>
              <div style={{ color:"#8C7B6E", fontSize:11 }}>Manual</div>
            </div>
            <div style={{ flex:1, background:"rgba(245,158,11,0.08)", border:"1px solid rgba(245,158,11,0.2)", borderRadius:10, padding:"10px 8px", textAlign:"center" }}>
              <div style={{ color:"#C47A1E", fontSize:18, fontWeight:800 }}>{aiCount}</div>
              <div style={{ color:"#8C7B6E", fontSize:11 }}>🤖 AI</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ===================== ADMIN QUESTIONS =====================

const sectionColors2 = { "Basic Biomedical Sciences":{accent:"#2B5FA6"}, "Pharmaceutical Sciences":{accent:"#1A7A5E"}, "Social/Behavioral/Administrative Sciences":{accent:"#7C4BA0"}, "Clinical Sciences":{accent:"#B83B2A"} };

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

function ExcelImportCard({ title, accentColor, onImport, onReplace }) {
  const [importing, setImporting] = useState(false);
  const [preview, setPreview] = useState([]);
  const [err, setErr] = useState("");
  const [success, setSuccess] = useState("");
  const [mode, setMode] = useState("add"); // "replace" | "add"
  const [assignTo, setAssignTo] = useState("none"); // "study" | "exam" | "both" | "none"
  const diffCol = {"سهل":"#1A7A5E","متوسط":"#C47A1E","صعب":"#B83B2A"};
  const assignOpts = [
    { val:"study", label:"📚 دورة المراجعة", color:"#1A7A5E" },
    { val:"exam",  label:"🎯 الاختبار الرسمي", color:"#B83B2A" },
    { val:"both",  label:"📖 كليهما",          color:"#2B5FA6" },
    { val:"none",  label:"— بدون تحديد",       color:"#8C7B6E" },
  ];

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

  const confirm = () => {
    const tagged = preview.map(q => ({ ...q, assign: assignTo === "none" ? undefined : assignTo }));
    if (mode === "replace") onReplace(tagged);
    else onImport(tagged);
    const dest = assignOpts.find(o=>o.val===assignTo)?.label || "بدون تحديد";
    setSuccess(`✅ تم ${mode === "replace" ? "استبدال" : "إضافة"} ${preview.length} سؤال → ${dest}`);
    setPreview([]);
  };

  return (
    <div style={{ ...S.card, marginBottom:16, border:`1px solid ${accentColor}33`, background:accentColor+"06" }}>
      <div style={{ fontWeight:700, fontSize:14, marginBottom:12, color:accentColor }}>📥 {title}</div>

      {/* Replace / Add toggle */}
      <div style={{ display:"flex", background:T.bg2, borderRadius:8, padding:3, marginBottom:14, border:`1px solid ${T.border}` }}>
        <button onClick={()=>setMode("add")} style={{ flex:1, padding:"7px", borderRadius:6, border:"none", cursor:"pointer", fontWeight:700, fontSize:12, fontFamily:"system-ui,sans-serif", background:mode==="add"?accentColor:"transparent", color:mode==="add"?"#fff":T.ink3, transition:"all 0.2s" }}>
          ➕ إضافة للموجود
        </button>
        <button onClick={()=>setMode("replace")} style={{ flex:1, padding:"7px", borderRadius:6, border:"none", cursor:"pointer", fontWeight:700, fontSize:12, fontFamily:"system-ui,sans-serif", background:mode==="replace"?"#B83B2A":"transparent", color:mode==="replace"?"#fff":T.ink3, transition:"all 0.2s" }}>
          🔄 استبدال الكل
        </button>
      </div>

      {/* Assign destination */}
      <div style={{ marginBottom:14 }}>
        <div style={{ color:T.ink3, fontSize:11, fontWeight:700, marginBottom:8, textTransform:"uppercase", letterSpacing:"0.05em" }}>وجهة الأسئلة المرفوعة:</div>
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:6 }}>
          {assignOpts.map(o => (
            <button key={o.val} onClick={()=>setAssignTo(o.val)}
              style={{ padding:"9px 10px", borderRadius:9, border:`2px solid ${assignTo===o.val?o.color:"rgba(140,110,80,0.18)"}`, cursor:"pointer", fontWeight:700, fontSize:12, fontFamily:"system-ui,sans-serif", background:assignTo===o.val?o.color+"18":"transparent", color:assignTo===o.val?o.color:T.ink3, transition:"all 0.2s", textAlign:"center" }}>
              {o.label}
              {assignTo===o.val && <span style={{ marginRight:6 }}>✓</span>}
            </button>
          ))}
        </div>
      </div>

      {mode==="replace" && (
        <div style={{ background:"rgba(196,122,30,0.08)", border:"1px solid rgba(196,122,30,0.3)", borderRadius:7, padding:"7px 12px", marginBottom:10, fontSize:12, color:T.ink2 }}>
          ⚠️ سيتم حذف جميع الأسئلة الحالية واستبدالها بالملف الجديد
        </div>
      )}

      <div style={{ display:"flex", gap:10, marginBottom:10, alignItems:"center", flexWrap:"wrap" }}>
        <label style={{ ...S.btn(accentColor), padding:"9px 16px", cursor:"pointer", fontSize:13, flexShrink:0 }}>
          {importing ? "⏳ جاري القراءة..." : "📂 اختر ملف Excel"}
          <input type="file" accept=".xlsx,.xls" onChange={handleFile} style={{ display:"none" }} />
        </label>
        <span style={{ color:"#8C7B6E", fontSize:11 }}>الأعمدة: section, category, difficulty, question, option_a…d, correct_answer (0-3), explanation</span>
      </div>

      {err && <div style={{ background:"rgba(184,59,42,0.08)", border:"1px solid rgba(184,59,42,0.30)", borderRadius:8, padding:"9px 12px", color:"#B83B2A", fontSize:13, marginBottom:8 }}>⚠️ {err}</div>}
      {success && <div style={{ background:"rgba(26,122,94,0.10)", border:"1px solid rgba(26,122,94,0.35)", borderRadius:8, padding:"9px 12px", color:"#1A7A5E", fontSize:13, marginBottom:8 }}>{success}</div>}

      {preview.length > 0 && (
        <div>
          <div style={{ fontWeight:700, marginBottom:8, color:accentColor, fontSize:13 }}>
            معاينة: {preview.length} سؤال ·
            <span style={{ color:mode==="replace"?"#B83B2A":"#1A7A5E", marginRight:6 }}>{mode==="replace"?"استبدال":"إضافة"}</span>→
            <span style={{ color:assignOpts.find(o=>o.val===assignTo)?.color, marginRight:6 }}>{assignOpts.find(o=>o.val===assignTo)?.label}</span>
          </div>
          <div style={{ maxHeight:160, overflowY:"auto", marginBottom:10, display:"flex", flexDirection:"column", gap:4 }}>
            {preview.slice(0,4).map((q,i) => (
              <div key={i} style={{ background:T.bg2, borderRadius:8, padding:"7px 10px", fontSize:12 }}>
                <div style={{ display:"flex", gap:5, marginBottom:2 }}>
                  <span style={S.tag((sectionColors2[q.section]||{accent:"#2B5FA6"}).accent)}>{q.section.split(" ")[0]}</span>
                  <span style={S.tag(diffCol[q.difficulty]||"#C47A1E")}>{q.difficulty}</span>
                </div>
                <div style={{ color:T.ink }}>{q.question.substring(0,85)}{q.question.length>85?"...":""}</div>
              </div>
            ))}
            {preview.length > 4 && <div style={{ color:"#8C7B6E", fontSize:11, textAlign:"center" }}>+{preview.length-4} سؤال إضافي…</div>}
          </div>
          <div style={{ display:"flex", gap:8 }}>
            <button onClick={confirm} style={{ ...S.btn(mode==="replace"?"#B83B2A":accentColor), flex:1, padding:10 }}>
              {mode==="replace" ? `🔄 استبدال بـ ${preview.length} سؤال` : `➕ إضافة ${preview.length} سؤال`}
            </button>
            <button onClick={()=>setPreview([])} style={{ ...S.ghost, padding:10 }}>إلغاء</button>
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
  const diffCol = {"سهل":"#1A7A5E","متوسط":"#C47A1E","صعب":"#B83B2A"};

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
      <ExcelImportCard title={importTitle} accentColor={accentColor} onImport={qs=>onChange([...questions,...qs])} onReplace={qs=>onChange(qs)} />

      {/* Header row */}
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:14, flexWrap:"wrap", gap:8 }}>
        <div><h2 style={{ margin:0, fontSize:16, fontWeight:700 }}>All Questions <span style={{ color:"#8C7B6E", fontSize:13, fontWeight:400 }}>({filtered.length} shown / {questions.length} total)</span></h2></div>
        <div style={{ display:"flex", gap:8 }}>
          <button style={{ ...S.btn(accentColor), padding:"8px 14px", fontSize:13 }} onClick={()=>{ reset(); setEditing(null); setShowForm(true); }}>+ Add</button>
          {confirmClear
            ? <div style={{ display:"flex", gap:6, alignItems:"center" }}>
                <span style={{ color:"#B83B2A", fontSize:12 }}>Delete all {questions.length}?</span>
                <button onClick={()=>{ onChange([]); setConfirmClear(false); }} style={{ ...S.btn("#B83B2A"), padding:"6px 12px", fontSize:12 }}>Yes, Delete</button>
                <button onClick={()=>setConfirmClear(false)} style={{ ...S.ghost, padding:"6px 10px", fontSize:12 }}>Cancel</button>
              </div>
            : <button onClick={()=>setConfirmClear(true)} style={{ ...S.ghost, padding:"8px 14px", fontSize:13, color:"#B83B2A", border:"1px solid rgba(184,59,42,0.30)" }}>🗑️ Clear All</button>
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
          return <button key={s} onClick={()=>setFilterSec(s)} style={{ padding:"4px 11px", borderRadius:20, border:`1.5px solid ${on&&bp?bp.color:on?accentColor:"rgba(140,110,80,0.18)"}`, cursor:"pointer", fontSize:11, fontWeight:600, background:on&&bp?bp.color+"22":on?accentColor+"22":"transparent", color:on&&bp?bp.color:on?accentColor:"#8C7B6E" }}>{s==="All"?"All":s==="Social/Behavioral/Administrative Sciences"?"Social/Admin":s.split(" ")[0]}</button>;
        })}
      </div>
      <input style={{ ...S.input, marginBottom:12 }} value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search questions..." />

      {/* List */}
      <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
        {filtered.length===0 && <div style={{ ...S.card, textAlign:"center", padding:30, color:T.ink3 }}>No questions found.</div>}
        {filtered.map(q=>{
          const col=SC[q.section]||{accent:"#2B5FA6"};
          return (
            <div key={q.id} style={{ ...S.card, padding:"11px 15px" }}>
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", gap:10 }}>
                <div style={{ flex:1 }}>
                  <div style={{ display:"flex", gap:5, marginBottom:5, flexWrap:"wrap" }}>
                    <span style={S.tag(col.accent)}>{q.section.split(" ")[0]}</span>
                    <span style={S.tag("#8C7B6E")}>{q.category}</span>
                    <span style={S.tag(diffCol[q.difficulty])}>{q.difficulty}</span>
                  </div>
                  <p style={{ color:T.ink, fontSize:13, margin:0, lineHeight:1.5 }}>{q.question}</p>
                </div>
                <div style={{ display:"flex", gap:6, flexShrink:0 }}>
                  <button onClick={()=>{ setForm({...q,options:[...q.options]}); setEditing(q.id); setShowForm(true); }} style={{ ...S.ghost, padding:"5px 10px" }}>✏️</button>
                  <button onClick={()=>{ if(window.confirm("Delete this question?")) onChange(questions.filter(x=>x.id!==q.id)); }} style={{ ...S.ghost, padding:"5px 10px", color:"#B83B2A" }}>🗑️</button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}


// ===================== BANK MANAGER =====================
function BankManager() {
  const [activeTab, setActiveTab] = useState("course"); // course | exam
  const [questions, setQuestions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [msg, setMsg] = useState("");
  const [preview, setPreview] = useState([]);
  const diffCol = {"سهل":"#1A7A5E","متوسط":"#C47A1E","صعب":"#B83B2A"};

  const bankKey  = activeTab === "course" ? "course-bank" : "exam-bank";
  const bankName = activeTab === "course" ? "SPLE-Course-Bank" : "SPLE-Exam-Bank";
  const bankColor = activeTab === "course" ? "#1A7A5E" : "#B83B2A";
  const bankIcon  = activeTab === "course" ? "📚" : "🎯";

  useEffect(() => { loadQuestions(); }, [activeTab]);

  const loadQuestions = async () => {
    setLoading(true); setMsg("");
    const qs = await api.getBankQuestions(bankKey);
    setQuestions(qs);
    setLoading(false);
  };

  const handleFile = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    e.target.value = "";
    setUploading(true); setMsg(""); setPreview([]);
    try {
      const mapped = await parseExcelFile(file);
      if (mapped.length === 0) { setMsg("❌ No valid questions found."); setUploading(false); return; }
      setPreview(mapped);
    } catch(err) { setMsg("❌ Error: " + err.message); }
    setUploading(false);
  };

  const confirmUpload = async (mode) => {
    setUploading(true); setMsg("");
    try {
      if (mode === "replace") await api.clearBank(bankKey);
      const tagged = preview.map((q, i) => ({ ...q, id: q.id || `${bankKey}_${Date.now()}_${i}`, bank: bankKey }));
      const res = await api.uploadToBank(bankKey, tagged);
      setMsg(`✅ تم رفع ${res.uploaded} سؤال إلى ${bankName}`);
      setPreview([]);
      await loadQuestions();
    } catch(err) { setMsg("❌ " + err.message); }
    setUploading(false);
  };

  const clearAll = async () => {
    if (!window.confirm(`حذف جميع أسئلة ${bankName}؟`)) return;
    setLoading(true);
    const res = await api.clearBank(bankKey);
    setMsg(`🗑️ تم حذف ${res.deleted} سؤال`);
    setQuestions([]);
    setLoading(false);
  };

  return (
    <div>
      <h1 style={{ margin:"0 0 4px", fontSize:22, fontWeight:800 }}>🗄️ Question Banks</h1>
      <p style={{ color:"#8C7B6E", margin:"0 0 20px", fontSize:13 }}>رفع وإدارة أسئلة الدورة والاختبار بشكل منفصل</p>

      {/* Tab selector */}
      <div style={{ display:"flex", gap:10, marginBottom:24 }}>
        {[["course","📚 Course Bank","#1A7A5E","SPLE-Course-Bank"],["exam","🎯 Exam Bank","#B83B2A","SPLE-Exam-Bank"]].map(([key,label,color,table])=>(
          <button key={key} onClick={()=>setActiveTab(key)} style={{ flex:1, padding:"14px", borderRadius:12, border:`2px solid ${activeTab===key?color:"rgba(140,110,80,0.15)"}`, cursor:"pointer", fontWeight:700, fontSize:14, background:activeTab===key?color+"18":"transparent", color:activeTab===key?color:"#8C7B6E", transition:"all 0.2s" }}>
            <div style={{ fontSize:22, marginBottom:4 }}>{label.split(" ")[0]}</div>
            <div>{label.split(" ").slice(1).join(" ")}</div>
            <div style={{ fontSize:11, fontWeight:400, marginTop:4, color:activeTab===key?color:T.ink3 }}>{table}</div>
          </button>
        ))}
      </div>

      {/* Stats */}
      <div style={{ ...S.card, marginBottom:16, display:"flex", gap:20, alignItems:"center" }}>
        <div style={{ fontSize:36 }}>{bankIcon}</div>
        <div style={{ flex:1 }}>
          <div style={{ fontWeight:800, fontSize:18, color:bankColor }}>{bankName}</div>
          <div style={{ color:T.ink3, fontSize:13 }}>{loading ? "جاري التحميل..." : `${questions.length} سؤال في البنك`}</div>
        </div>
        <div style={{ display:"flex", gap:8 }}>
          <button onClick={loadQuestions} style={{ ...S.ghost, padding:"8px 14px" }}>🔄 Refresh</button>
          {questions.length > 0 && <button onClick={clearAll} style={{ ...S.ghost, padding:"8px 14px", color:"#B83B2A", border:"1px solid rgba(184,59,42,0.3)" }}>🗑️ Clear All</button>}
        </div>
      </div>

      {/* Upload */}
      <div style={{ ...S.card, marginBottom:16, border:`1px solid ${bankColor}33`, background:bankColor+"06" }}>
        <div style={{ fontWeight:700, fontSize:14, marginBottom:12, color:bankColor }}>📥 رفع أسئلة Excel إلى {bankName}</div>
        <div style={{ color:T.ink3, fontSize:12, marginBottom:12 }}>الأعمدة المطلوبة: section, category, difficulty, question, option_a, option_b, option_c, option_d, correct_answer (0-3), explanation</div>

        <label style={{ ...S.btn(bankColor), padding:"9px 16px", cursor:"pointer", fontSize:13, display:"inline-block" }}>
          {uploading ? "⏳ جاري القراءة..." : "📂 اختر ملف Excel"}
          <input type="file" accept=".xlsx,.xls" onChange={handleFile} style={{ display:"none" }} disabled={uploading} />
        </label>

        {msg && <div style={{ marginTop:12, padding:"9px 14px", borderRadius:8, background:msg.startsWith("✅")?"rgba(26,122,94,0.1)":"rgba(184,59,42,0.08)", border:`1px solid ${msg.startsWith("✅")?"rgba(26,122,94,0.3)":"rgba(184,59,42,0.3)"}`, color:msg.startsWith("✅")?"#1A7A5E":"#B83B2A", fontSize:13 }}>{msg}</div>}

        {preview.length > 0 && (
          <div style={{ marginTop:14 }}>
            <div style={{ fontWeight:700, color:bankColor, marginBottom:8 }}>معاينة: {preview.length} سؤال</div>
            <div style={{ maxHeight:160, overflowY:"auto", marginBottom:12, display:"flex", flexDirection:"column", gap:4 }}>
              {preview.slice(0,4).map((q,i)=>(
                <div key={i} style={{ background:T.bg2, borderRadius:8, padding:"7px 10px", fontSize:12 }}>
                  <div style={{ display:"flex", gap:5, marginBottom:3 }}>
                    <span style={S.tag(bankColor)}>{q.section?.split(" ")[0]}</span>
                    <span style={S.tag(diffCol[q.difficulty]||"#C47A1E")}>{q.difficulty}</span>
                  </div>
                  <div>{q.question?.substring(0,90)}{q.question?.length>90?"...":""}</div>
                </div>
              ))}
              {preview.length > 4 && <div style={{ color:"#8C7B6E", fontSize:11, textAlign:"center" }}>+{preview.length-4} more…</div>}
            </div>
            <div style={{ display:"flex", gap:8 }}>
              <button onClick={()=>confirmUpload("replace")} style={{ ...S.btn("#B83B2A"), flex:1, padding:10 }}>🔄 استبدال الكل ({preview.length} سؤال)</button>
              <button onClick={()=>confirmUpload("add")} style={{ ...S.btn(bankColor), flex:1, padding:10 }}>➕ إضافة للموجود</button>
              <button onClick={()=>setPreview([])} style={{ ...S.ghost, padding:10 }}>إلغاء</button>
            </div>
          </div>
        )}
      </div>

      {/* Questions list preview */}
      {!loading && questions.length > 0 && (
        <div style={{ ...S.card }}>
          <div style={{ fontWeight:700, marginBottom:12 }}>أسئلة {bankName} ({questions.length})</div>
          <div style={{ maxHeight:400, overflowY:"auto", display:"flex", flexDirection:"column", gap:6 }}>
            {questions.slice(0,20).map(q=>{
              const col = SC[q.section]||{accent:"#2B5FA6"};
              return (
                <div key={q.id} style={{ background:T.bg2, borderRadius:8, padding:"8px 12px", fontSize:12 }}>
                  <div style={{ display:"flex", gap:5, marginBottom:4, flexWrap:"wrap" }}>
                    <span style={S.tag(col.accent)}>{q.section==="Social/Behavioral/Administrative Sciences"?"Social":q.section?.split(" ")[0]}</span>
                    <span style={S.tag(diffCol[q.difficulty]||"#C47A1E")}>{q.difficulty}</span>
                  </div>
                  <div style={{ color:T.ink }}>{q.question?.substring(0,100)}{q.question?.length>100?"...":""}</div>
                </div>
              );
            })}
            {questions.length > 20 && <div style={{ color:"#8C7B6E", fontSize:12, textAlign:"center", padding:8 }}>+{questions.length-20} سؤال إضافي…</div>}
          </div>
        </div>
      )}
    </div>
  );
}

function BankSelector({ label, icon, color, bankKey, allBanks, onSelectBank }) {
  const [open, setOpen] = useState(false);
  const active = allBanks.find(b => b.key === bankKey);

  return (
    <div style={{ ...S.card, border:`2px solid ${color}44`, background:color+"06", marginBottom:12 }}>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
        <div style={{ display:"flex", alignItems:"center", gap:12 }}>
          <span style={{ fontSize:28 }}>{icon}</span>
          <div>
            <div style={{ fontWeight:800, fontSize:15, color }}>{label}</div>
            <div style={{ color:T.ink3, fontSize:12, marginTop:2 }}>
              البنك الفعال: {active ? <span style={{ color, fontWeight:700 }}>✅ {active.name} ({active.count} سؤال)</span> : <span style={{ color:"#8C7B6E" }}>— غير محدد</span>}
            </div>
          </div>
        </div>
        <button onClick={()=>setOpen(!open)} style={{ ...S.btn(color), padding:"8px 16px", fontSize:13 }}>
          {open ? "إغلاق ▲" : "تغيير البنك ▼"}
        </button>
      </div>

      {open && (
        <div style={{ marginTop:14, borderTop:`1px solid ${color}22`, paddingTop:14 }}>
          <div style={{ color:T.ink3, fontSize:12, fontWeight:700, marginBottom:10 }}>اختر البنك لهذا المسار:</div>
          <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
            {allBanks.map(b => (
              <div key={b.key} onClick={()=>{ onSelectBank(b.key); setOpen(false); }}
                style={{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:"10px 14px", borderRadius:10, border:`1.5px solid ${bankKey===b.key?color:"rgba(140,110,80,0.2)"}`, background:bankKey===b.key?color+"12":"transparent", cursor:"pointer" }}>
                <div>
                  <div style={{ fontWeight:700, color:bankKey===b.key?color:T.ink }}>{b.name}</div>
                  <div style={{ color:T.ink3, fontSize:12 }}>{b.count} سؤال · {b.table}</div>
                </div>
                {bankKey===b.key && <span style={{ color, fontWeight:800, fontSize:18 }}>✓</span>}
              </div>
            ))}
            <div onClick={()=>{ onSelectBank(null); setOpen(false); }}
              style={{ padding:"10px 14px", borderRadius:10, border:`1.5px solid ${!bankKey?"#B83B2A":"rgba(140,110,80,0.2)"}`, background:!bankKey?"rgba(184,59,42,0.06)":"transparent", cursor:"pointer", color:!bankKey?"#B83B2A":T.ink3, fontWeight:600, fontSize:13 }}>
              — إلغاء التحديد
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function AdminQuestions({ questions, onChangeQuestions }) {
  // Bank state
  const [banks, setBanks] = useState([]);
  const [loadingBanks, setLoadingBanks] = useState(true);
  const [courseBank, setCourseBank] = useState(() => localStorage.getItem("active_course_bank") || "course-bank");
  const [examBank, setExamBank]   = useState(() => localStorage.getItem("active_exam_bank")   || "exam-bank");

  // Upload state
  const [uploadTab, setUploadTab] = useState("course-bank");
  const [uploading, setUploading] = useState(false);
  const [uploadMsg, setUploadMsg] = useState("");
  const [uploadPreview, setUploadPreview] = useState([]);
  const [uploadMode, setUploadMode] = useState("add");

  // Questions browsing
  const [search, setSearch] = useState("");
  const [filterSec, setFilterSec] = useState("All");
  const [browseBank, setBrowseBank] = useState("course-bank");
  const [browseQ, setBrowseQ] = useState([]);
  const [loadingBrowse, setLoadingBrowse] = useState(false);

  const diffCol = {"سهل":"#1A7A5E","متوسط":"#C47A1E","صعب":"#B83B2A"};

  // Load bank stats on mount
  useEffect(() => {
    loadBankStats();
  }, []);

  const loadBankStats = async () => {
    setLoadingBanks(true);
    const [courseQs, examQs] = await Promise.all([
      api.getBankQuestions("course-bank"),
      api.getBankQuestions("exam-bank"),
    ]);
    setBanks([
      { key:"course-bank", name:"SPLE Course Bank", table:"SPLE-Course-Bank", count: courseQs.length },
      { key:"exam-bank",   name:"SPLE Exam Bank",   table:"SPLE-Exam-Bank",   count: examQs.length  },
    ]);
    setLoadingBanks(false);
  };

  const selectCourseBank = (key) => {
    setCourseBank(key);
    if (key) localStorage.setItem("active_course_bank", key);
    else localStorage.removeItem("active_course_bank");
  };

  const selectExamBank = (key) => {
    setExamBank(key);
    if (key) localStorage.setItem("active_exam_bank", key);
    else localStorage.removeItem("active_exam_bank");
  };

  // Upload Excel to a bank
  const handleUploadFile = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    e.target.value = "";
    setUploading(true); setUploadMsg(""); setUploadPreview([]);
    try {
      const mapped = await parseExcelFile(file);
      if (!mapped.length) { setUploadMsg("❌ لا توجد أسئلة صالحة"); setUploading(false); return; }
      setUploadPreview(mapped);
    } catch(err) { setUploadMsg("❌ خطأ: " + err.message); }
    setUploading(false);
  };

  const confirmUpload = async () => {
    setUploading(true); setUploadMsg("");
    try {
      if (uploadMode === "replace") await api.clearBank(uploadTab);
      const tagged = uploadPreview.map((q,i) => ({ ...q, id: q.id || `${uploadTab}_${Date.now()}_${i}`, bank: uploadTab }));
      const res = await api.uploadToBank(uploadTab, tagged);
      setUploadMsg(`✅ تم رفع ${res.uploaded} سؤال`);
      setUploadPreview([]);
      await loadBankStats();
    } catch(err) { setUploadMsg("❌ " + err.message); }
    setUploading(false);
  };

  // Browse bank questions
  useEffect(() => {
    loadBrowseQ();
  }, [browseBank]);

  const loadBrowseQ = async () => {
    setLoadingBrowse(true);
    const qs = await api.getBankQuestions(browseBank);
    setBrowseQ(qs);
    setLoadingBrowse(false);
  };

  const filtered = browseQ.filter(q =>
    (filterSec==="All" || q.section===filterSec) &&
    (!search || q.question?.toLowerCase().includes(search.toLowerCase()))
  );

  const bankColor = { "course-bank":"#1A7A5E", "exam-bank":"#B83B2A" };
  const bankName  = { "course-bank":"📚 Course Bank", "exam-bank":"🎯 Exam Bank" };

  return (
    <div>
      <h1 style={{ margin:"0 0 4px", fontSize:22, fontWeight:800 }}>🗄️ إدارة البنوك</h1>
      <p style={{ color:"#8C7B6E", margin:"0 0 20px", fontSize:13 }}>حدد البنك الفعال لكل مسار وارفع الأسئلة</p>

      {/* ── Active Banks ── */}
      {loadingBanks
        ? <div style={{ ...S.card, padding:20, textAlign:"center", color:T.ink3 }}>⏳ جاري تحميل البنوك...</div>
        : <>
          <BankSelector label="📚 دورة المراجعة" icon="📚" color="#1A7A5E"
            bankKey={courseBank} allBanks={banks} onSelectBank={selectCourseBank} />
          <BankSelector label="🎯 الاختبار الرسمي" icon="🎯" color="#B83B2A"
            bankKey={examBank} allBanks={banks} onSelectBank={selectExamBank} />
        </>
      }

      {/* ── Upload Section ── */}
      <div style={{ ...S.card, marginTop:20, marginBottom:16 }}>
        <div style={{ fontWeight:800, fontSize:15, marginBottom:14 }}>📥 رفع أسئلة Excel</div>

        {/* Bank selector tabs */}
        <div style={{ display:"flex", gap:8, marginBottom:14 }}>
          {[["course-bank","📚 Course Bank","#1A7A5E"],["exam-bank","🎯 Exam Bank","#B83B2A"]].map(([key,label,color])=>(
            <button key={key} onClick={()=>{ setUploadTab(key); setUploadPreview([]); setUploadMsg(""); }}
              style={{ flex:1, padding:"10px", borderRadius:10, border:`2px solid ${uploadTab===key?color:"rgba(140,110,80,0.15)"}`, cursor:"pointer", fontWeight:700, fontSize:13, background:uploadTab===key?color+"15":"transparent", color:uploadTab===key?color:"#8C7B6E" }}>
              {label}
            </button>
          ))}
        </div>

        {/* Mode */}
        <div style={{ display:"flex", background:T.bg2, borderRadius:8, padding:3, marginBottom:12, border:`1px solid ${T.border}` }}>
          <button onClick={()=>setUploadMode("add")} style={{ flex:1, padding:"7px", borderRadius:6, border:"none", cursor:"pointer", fontWeight:700, fontSize:12, fontFamily:"system-ui,sans-serif", background:uploadMode==="add"?bankColor[uploadTab]:"transparent", color:uploadMode==="add"?"#fff":T.ink3 }}>➕ إضافة للموجود</button>
          <button onClick={()=>setUploadMode("replace")} style={{ flex:1, padding:"7px", borderRadius:6, border:"none", cursor:"pointer", fontWeight:700, fontSize:12, fontFamily:"system-ui,sans-serif", background:uploadMode==="replace"?"#B83B2A":"transparent", color:uploadMode==="replace"?"#fff":T.ink3 }}>🔄 استبدال الكل</button>
        </div>

        <label style={{ ...S.btn(bankColor[uploadTab]), padding:"9px 16px", cursor:"pointer", fontSize:13, display:"inline-block" }}>
          {uploading ? "⏳ جاري القراءة..." : `📂 اختر Excel للـ ${bankName[uploadTab]}`}
          <input type="file" accept=".xlsx,.xls" onChange={handleUploadFile} style={{ display:"none" }} disabled={uploading} />
        </label>

        {uploadMsg && <div style={{ marginTop:10, padding:"9px 14px", borderRadius:8, background:uploadMsg.startsWith("✅")?"rgba(26,122,94,0.1)":"rgba(184,59,42,0.08)", color:uploadMsg.startsWith("✅")?"#1A7A5E":"#B83B2A", fontSize:13 }}>{uploadMsg}</div>}

        {uploadPreview.length > 0 && (
          <div style={{ marginTop:12 }}>
            <div style={{ fontWeight:700, color:bankColor[uploadTab], marginBottom:8 }}>معاينة: {uploadPreview.length} سؤال → {bankName[uploadTab]}</div>
            <div style={{ maxHeight:140, overflowY:"auto", marginBottom:10, display:"flex", flexDirection:"column", gap:4 }}>
              {uploadPreview.slice(0,3).map((q,i)=>(
                <div key={i} style={{ background:T.bg2, borderRadius:8, padding:"7px 10px", fontSize:12 }}>
                  <span style={S.tag(diffCol[q.difficulty]||"#C47A1E")}>{q.difficulty}</span>
                  <span style={{ marginRight:6, color:T.ink }}> {q.question?.substring(0,80)}...</span>
                </div>
              ))}
              {uploadPreview.length > 3 && <div style={{ color:"#8C7B6E", fontSize:11, textAlign:"center" }}>+{uploadPreview.length-3} سؤال</div>}
            </div>
            <div style={{ display:"flex", gap:8 }}>
              <button onClick={confirmUpload} style={{ ...S.btn(uploadMode==="replace"?"#B83B2A":bankColor[uploadTab]), flex:1, padding:10 }}>
                {uploadMode==="replace"?`🔄 استبدال بـ ${uploadPreview.length} سؤال`:`➕ إضافة ${uploadPreview.length} سؤال`}
              </button>
              <button onClick={()=>setUploadPreview([])} style={{ ...S.ghost, padding:10 }}>إلغاء</button>
            </div>
          </div>
        )}
      </div>

      {/* ── Browse Questions ── */}
      <div style={{ ...S.card }}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:14 }}>
          <div style={{ fontWeight:800, fontSize:15 }}>📋 تصفح الأسئلة</div>
          <div style={{ display:"flex", gap:6 }}>
            {[["course-bank","📚","#1A7A5E"],["exam-bank","🎯","#B83B2A"]].map(([key,icon,color])=>(
              <button key={key} onClick={()=>{ setBrowseBank(key); setFilterSec("All"); setSearch(""); }}
                style={{ padding:"6px 14px", borderRadius:8, border:`1.5px solid ${browseBank===key?color:"rgba(140,110,80,0.2)"}`, cursor:"pointer", fontSize:12, fontWeight:700, background:browseBank===key?color:"transparent", color:browseBank===key?"#fff":color }}>
                {icon}
              </button>
            ))}
            <button onClick={loadBrowseQ} style={{ ...S.ghost, padding:"6px 12px", fontSize:12 }}>🔄</button>
          </div>
        </div>

        <div style={{ display:"flex", gap:8, marginBottom:10, flexWrap:"wrap" }}>
          {["All",...SECTIONS].map(s=>{
            const bp = s!=="All"?BLUEPRINT[s]:null; const on=filterSec===s;
            return <button key={s} onClick={()=>setFilterSec(s)} style={{ padding:"3px 10px", borderRadius:20, border:`1.5px solid ${on&&bp?bp.color:on?bankColor[browseBank]:"rgba(140,110,80,0.18)"}`, cursor:"pointer", fontSize:11, fontWeight:600, background:on&&bp?bp.color+"22":"transparent", color:on&&bp?bp.color:on?bankColor[browseBank]:"#8C7B6E" }}>
              {s==="All"?"الكل":s==="Social/Behavioral/Administrative Sciences"?"Social":s.split(" ")[0]}
            </button>;
          })}
        </div>

        <input style={{ ...S.input, marginBottom:10 }} value={search} onChange={e=>setSearch(e.target.value)} placeholder={`🔍 بحث في ${bankName[browseBank]}...`} />

        <div style={{ color:T.ink3, fontSize:12, marginBottom:8 }}>{filtered.length} / {browseQ.length} سؤال</div>

        {loadingBrowse
          ? <div style={{ textAlign:"center", padding:20, color:T.ink3 }}>⏳ جاري التحميل...</div>
          : <div style={{ maxHeight:400, overflowY:"auto", display:"flex", flexDirection:"column", gap:6 }}>
              {filtered.length===0 && <div style={{ textAlign:"center", padding:20, color:T.ink3 }}>لا توجد أسئلة</div>}
              {filtered.map(q=>{
                const col=SC[q.section]||{accent:"#2B5FA6"};
                return <div key={q.id} style={{ background:T.bg2, borderRadius:9, padding:"9px 12px" }}>
                  <div style={{ display:"flex", gap:5, marginBottom:4, flexWrap:"wrap" }}>
                    <span style={S.tag(col.accent)}>{q.section==="Social/Behavioral/Administrative Sciences"?"Social":q.section?.split(" ")[0]}</span>
                    <span style={S.tag(diffCol[q.difficulty]||"#C47A1E")}>{q.difficulty}</span>
                  </div>
                  <div style={{ color:T.ink, fontSize:12, lineHeight:1.5 }}>{q.question?.substring(0,120)}{q.question?.length>120?"...":""}</div>
                </div>;
              })}
            </div>
        }
      </div>
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
        <div><h2 style={{ margin:0, fontSize:18, fontWeight:700 }}>Students</h2><span style={{ color:"#8C7B6E", fontSize:13 }}>{users.length} enrolled</span></div>
        <button style={{ ...S.btn("#2B5FA6"), width:"auto" }} onClick={()=>setShowForm(!showForm)}>+ Add Student</button>
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
          {err&&<div style={{ color:"#B83B2A", fontSize:13, marginBottom:10 }}>⚠️ {err}</div>}
          <div style={{ display:"flex", gap:8 }}>
            <button style={S.btn("#2B5FA6")} onClick={add}>Add Student</button>
            <button style={{ ...S.ghost, flex:1 }} onClick={()=>{ setShowForm(false); setErr(""); }}>Cancel</button>
          </div>
        </div>
      )}
      {users.length===0 ? <div style={{ ...S.card, textAlign:"center", padding:40 }}><div style={{ fontSize:36 }}>🎓</div><p style={{ color:"#8C7B6E" }}>No students yet.</p></div> : (
        <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
          {users.map(u=>(
            <div key={u.id} style={{ ...S.card, padding:"12px 16px", display:"flex", justifyContent:"space-between", alignItems:"center" }}>
              <div style={{ display:"flex", alignItems:"center", gap:12 }}>
                <div style={{ width:38, height:38, borderRadius:10, background:"linear-gradient(135deg,#2B5FA6,#7C4BA0)", display:"flex", alignItems:"center", justifyContent:"center", fontSize:16, fontWeight:800, color:"#fff" }}>{u.name[0]}</div>
                <div><div style={{ fontWeight:700 }}>{u.name}</div><div style={{ color:"#8C7B6E", fontSize:12 }}>{u.email}{u.university&&` · ${u.university}`}</div></div>
              </div>
              <div style={{ display:"flex", gap:8, alignItems:"center" }}>
                <span style={{ color:T.ink3, fontSize:12 }}>{u.joinDate}</span>
                <button onClick={()=>{ if(window.confirm("Remove?")) onChange(users.filter(x=>x.id!==u.id)); }} style={{ ...S.ghost, padding:"5px 10px", color:"#B83B2A" }}>🗑️</button>
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
      {rows.length===0 ? <div style={{ ...S.card, textAlign:"center", padding:40 }}><p style={{ color:"#8C7B6E" }}>No data yet.</p></div> : (
        <div style={{ ...S.card, padding:0, overflow:"hidden" }}>
          <table style={{ width:"100%", borderCollapse:"collapse", fontSize:13 }}>
            <thead><tr style={{ background:T.surface }}>{["Student","University","Exams","Avg Score","Last Exam"].map(h=><th key={h} style={{ padding:"11px 14px", textAlign:"left", color:"#8C7B6E", fontWeight:600, borderBottom:`1px solid ${T.border}` }}>{h}</th>)}</tr></thead>
            <tbody>{rows.map(u=>(
              <tr key={u.id} style={{ borderBottom:"1px solid rgba(140,110,80,0.06)" }}>
                <td style={{ padding:"11px 14px" }}><div style={{ fontWeight:700 }}>{u.name}</div><div style={{ color:"#8C7B6E", fontSize:11 }}>{u.email}</div></td>
                <td style={{ padding:"11px 14px", color:"#8C7B6E" }}>{u.university||"—"}</td>
                <td style={{ padding:"11px 14px", color:"#8C7B6E" }}>{u.exams}</td>
                <td style={{ padding:"11px 14px" }}>{u.avg!==null?<span style={{ color:u.avg>=70?"#1A7A5E":u.avg>=60?"#C47A1E":"#B83B2A", fontWeight:700 }}>{u.avg}%</span>:<span style={{ color:T.ink3 }}>—</span>}</td>
                <td style={{ padding:"11px 14px", color:"#8C7B6E" }}>{u.last||"—"}</td>
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
  const diffCol = { "سهل": "#1A7A5E", "متوسط": "#C47A1E", "صعب": "#B83B2A" };
  const diffTotal = Object.values(s.diffPct).reduce((a, b) => a + b, 0);
  const update = (key, val) => setS(p => ({ ...p, [key]: val }));
  const updateDiff = (diff, val) => { const v = Math.max(0, Math.min(100, Number(val))); setS(p => ({ ...p, diffPct: { ...p.diffPct, [diff]: v } })); };
  const save = () => { onSave(s); setSaved(true); setTimeout(() => setSaved(false), 2000); };
  const preview = SECTIONS.map(sec => { const bp = BLUEPRINT[sec]; const secCount = Math.round(s.totalQ * bp.pct / 100); const available = questions.filter(q => q.section === sec).length; return { sec, secCount, available, bp }; });

  return (
    <div style={{ ...S.card, border:`1px solid ${accentColor}33`, marginBottom:24 }}>
      <div style={{ fontWeight:800, fontSize:17, marginBottom:16, color: accentColor }}>{icon} {title}</div>
      <div style={{ display:"grid", gridTemplateColumns: showTime ? "1fr 1fr" : "1fr", gap:14, marginBottom:16 }}>
        <div style={{ background:T.bg2, borderRadius:12, padding:14 }}>
          <label style={S.label}>Number of Questions: <span style={{ color:accentColor, fontWeight:800 }}>{s.totalQ}</span></label>
          <input type="range" min={10} max={200} step={5} value={s.totalQ} onChange={e => update("totalQ", Number(e.target.value))} style={{ width:"100%", accentColor, margin:"8px 0 4px" }} />
          <div style={{ display:"flex", justifyContent:"space-between", color:T.ink3, fontSize:11 }}><span>10</span><span>100</span><span>200</span></div>
        </div>
        {showTime && (
          <div style={{ background:T.bg2, borderRadius:12, padding:14 }}>
            <label style={S.label}>Time: <span style={{ color:accentColor, fontWeight:800 }}>{s.timeMins} min ({Math.floor(s.timeMins/60)}h {s.timeMins%60}m)</span></label>
            <input type="range" min={10} max={300} step={5} value={s.timeMins} onChange={e => update("timeMins", Number(e.target.value))} style={{ width:"100%", accentColor, margin:"8px 0 4px" }} />
            <div style={{ display:"flex", justifyContent:"space-between", color:T.ink3, fontSize:11 }}><span>10m</span><span>120m</span><span>300m</span></div>
          </div>
        )}
      </div>

      <div style={{ marginBottom:14 }}>
        <div style={{ display:"flex", justifyContent:"space-between", marginBottom:10 }}>
          <span style={{ ...S.label, margin:0 }}>Difficulty Distribution</span>
          <span style={{ fontSize:11, color: diffTotal===100?"#1A7A5E":"#B83B2A", fontWeight:700 }}>Total: {diffTotal}% {diffTotal!==100?"⚠️":"✅"}</span>
        </div>
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:10 }}>
          {DIFFICULTIES.map(diff => (
            <div key={diff} style={{ background:diffCol[diff]+"11", border:`1px solid ${diffCol[diff]}33`, borderRadius:10, padding:12, textAlign:"center" }}>
              <div style={{ color:diffCol[diff], fontWeight:700, fontSize:12, marginBottom:6 }}>{diff==="سهل"?"🟢":"diff"==="متوسط"?"🟡":"🔴"} {diff}</div>
              <input type="number" min={0} max={100} value={s.diffPct[diff]} onChange={e=>updateDiff(diff,e.target.value)} style={{ ...S.input, width:"100%", textAlign:"center", padding:"6px", fontSize:16, fontWeight:800, color:diffCol[diff] }} />
              <div style={{ color:"#8C7B6E", fontSize:10, marginTop:4 }}>{Math.round(s.totalQ*s.diffPct[diff]/100)} q</div>
            </div>
          ))}
        </div>
      </div>

      <div style={{ marginBottom:14 }}>
        <div style={{ color:"#8C7B6E", fontSize:12, fontWeight:600, marginBottom:8 }}>SECTION PREVIEW (SCHS Blueprint)</div>
        {preview.map(({sec,secCount,available,bp}) => {
          const short = sec==="Social/Behavioral/Administrative Sciences"?"Social/Admin":sec.split(" ")[0];
          const ok = available >= secCount;
          return <div key={sec} style={{ display:"flex", alignItems:"center", gap:10, marginBottom:6 }}>
            <span style={{ color:"#8C7B6E", fontSize:11, width:80, flexShrink:0 }}>{short}</span>
            <div style={{ flex:1, height:6, background:T.bg2, borderRadius:3 }}>
              <div style={{ width:`${bp.pct}%`, height:"100%", background:bp.color, borderRadius:3 }} />
            </div>
            <span style={{ color: ok?bp.color:"#B83B2A", fontSize:11, fontWeight:700, width:70, textAlign:"right" }}>{secCount} {!ok&&"⚠️"}</span>
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
      <p style={{ color:"#8C7B6E", marginBottom:24 }}>Configure both study session and exam parameters</p>
      <SettingsPanel
        title="Study Session — دورة المراجعة"
        icon="📚" accentColor="#1A7A5E"
        settings={DB.getStudySettings()}
        onSave={DB.saveStudySettings}
        showTime={false}
      />
      <SettingsPanel
        title="Exam — الاختبار الرسمي"
        icon="🎯" accentColor="#B83B2A"
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
  const TABS = [{id:"overview",icon:"📊",label:"Overview"},{id:"questions",icon:"🗄️",label:"البنوك"},{id:"students",icon:"🎓",label:"Students"},{id:"reports",icon:"📈",label:"Reports"},{id:"settings",icon:"⚙️",label:"Exam Settings"}];
  const avg = results.length?Math.round(results.reduce((a,r)=>a+r.score,0)/results.length):0;

  const [loadingQ, setLoadingQ] = useState(true);
  useEffect(() => {
    // Force fresh fetch from DynamoDB (bypass cache)
    localStorage.removeItem("sple_questions_cache_time");
    api.getQuestions().then(qs => { 
      setQuestions(qs); 
      DB.saveQuestions(qs); 
      setLoadingQ(false);
    });
  }, []);

  return (
    <div style={{ minHeight:"100vh", background:T.bg, fontFamily:"system-ui,sans-serif", color:"#1C1814", display:"flex" }}>
      <div style={{ width:210, background:T.bg2, borderRight:`1px solid ${T.border}`, padding:18, display:"flex", flexDirection:"column", gap:4, flexShrink:0 }}>
        <div style={{ marginBottom:20 }}><div style={{ fontSize:17, fontWeight:800 }}>💊 SPLE</div><div style={{ color:"#7C4BA0", fontSize:10, fontWeight:700 }}>ADMIN PANEL</div></div>
        {TABS.map(t=>(
          <button key={t.id} onClick={()=>setTab(t.id)} style={{ background:tab===t.id?"rgba(139,92,246,0.15)":"transparent", border:tab===t.id?"1px solid rgba(139,92,246,0.3)":"1px solid transparent", borderRadius:9, padding:"9px 12px", cursor:"pointer", textAlign:"left", color:tab===t.id?"#9B6DBF":"#8C7B6E", fontSize:13, fontWeight:600, display:"flex", alignItems:"center", gap:6 }}>
            {t.icon} {t.label} {t.badge&&<span style={{ background:"#C47A1E22",color:"#C47A1E",fontSize:9,padding:"1px 5px",borderRadius:6,marginLeft:"auto" }}>{t.badge}</span>}
          </button>
        ))}
        <div style={{ marginTop:"auto" }}>
          <div style={{ color:"#4A3F35", fontSize:11, marginBottom:6 }}>{user.name}</div>
          <button onClick={onLogout} style={{ ...S.ghost, width:"100%", textAlign:"left", fontSize:12 }}>🚪 Logout</button>
        </div>
      </div>
      <div style={{ flex:1, padding:24, overflowY:"auto" }}>
        {tab==="overview" && (
          <div>
            <h1 style={{ fontSize:22, fontWeight:800, margin:"0 0 4px" }}>Overview</h1>
            <p style={{ color:"#8C7B6E", marginBottom:20 }}>Platform summary</p>
            <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:14, marginBottom:20 }}>
              {[["❓",questions.length,"Total Questions","#2B5FA6"],["📚",questions.filter(q=>q.assign==="study"||q.assign==="both").length,"Course Bank","#1A7A5E"],["🎯",questions.filter(q=>q.assign==="exam"||q.assign==="both").length,"Exam Bank","#B83B2A"],["📊",`${avg}%`,"Avg Score","#C47A1E"]].map(([icon,val,label,color])=>(
                <div key={label} style={{ background:T.bg2, border:`1px solid ${color}33`, borderRadius:14, padding:18 }}>
                  <div style={{ fontSize:24 }}>{icon}</div>
                  <div style={{ fontSize:28, fontWeight:800, color, marginTop:6 }}>{val}</div>
                  <div style={{ color:"#8C7B6E", fontSize:12 }}>{label}</div>
                </div>
              ))}
            </div>
            <QuestionStats questions={questions} />
          </div>
        )}
        {tab==="questions" && (loadingQ 
          ? <div style={{ textAlign:"center", padding:60 }}><div style={{ fontSize:40 }}>⏳</div><div style={{ fontWeight:700, marginTop:12 }}>جاري تحميل الأسئلة من DynamoDB...</div><div style={{ color:"#8C7B6E", fontSize:13, marginTop:8 }}>يتم جلب 1,958 سؤال</div></div>
          : <AdminQuestions questions={questions} onChangeQuestions={saveQ} />
        )}
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
  const [questions, setQuestions] = useState(DB.getQuestions());
  const [loadingQ, setLoadingQ] = useState(true);
  const studySettings = DB.getStudySettings();
  const examSettings = DB.getExamSettings();

  useEffect(() => {
    api.getQuestions().then(qs => { setQuestions(qs); setLoadingQ(false); });
  }, []);

  const startSession = async (sessionMode) => {
    const settings = sessionMode === "study" ? studySettings : examSettings;
    // Load from active bank stored in localStorage
    const bankKey = sessionMode === "study"
      ? (localStorage.getItem("active_course_bank") || "course-bank")
      : (localStorage.getItem("active_exam_bank")   || "exam-bank");
    let pool = await api.getBankQuestions(bankKey);
    if (pool.length < 10) pool = questions; // fallback to main questions
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

  if (loadingQ && questions.length === 0) return <div style={{ minHeight:"100vh", background:T.bg, display:"flex", alignItems:"center", justifyContent:"center", flexDirection:"column", gap:16 }}><div style={{ fontSize:36 }}>⏳</div><div style={{ color:T.ink2, fontWeight:700 }}>جاري تحميل الأسئلة...</div></div>;
  if (screen === "materials") return <StudyMaterialsScreen onBack={()=>setScreen("home")} onStartStudy={()=>startSession("study")} allQuestions={questions} />;
  if (screen === "study") return <StudyScreen questions={examQ} onFinish={finishSession} onHome={()=>setScreen("home")} />;
  if (screen === "exam") return <ExamScreen questions={examQ} onFinish={finishSession} timeMins={examSettings.timeMins} onHome={()=>setScreen("home")} />;
  if (screen === "results") return <ResultsScreen questions={examQ} answers={examA} mode={mode} onRetry={()=>setScreen("home")} onHome={()=>setScreen("home")} userName={user.name} />;

  const examResults = myResults.filter(r => r.mode === "exam" || !r.mode);
  const studyResults = myResults.filter(r => r.mode === "study");
  const avg = examResults.length ? Math.round(examResults.reduce((a,r)=>a+r.score,0)/examResults.length) : 0;
  const best = examResults.length ? Math.max(...examResults.map(r=>r.score)) : 0;

  return (
    <div style={{ minHeight:"100vh", background:T.bg, fontFamily:"system-ui,sans-serif", color:"#1C1814" }}>
      {/* Header */}
      <div style={{ background:T.bg2, borderBottom:`1px solid ${T.border}`, padding:"12px 24px", display:"flex", justifyContent:"space-between", alignItems:"center" }}>
        <div style={{ display:"flex", alignItems:"center", gap:10 }}><span style={{ fontSize:20 }}>💊</span><div><div style={{ fontWeight:800 }}>SPLE Platform</div><div style={{ color:"#8C7B6E", fontSize:11 }}>Student Portal</div></div></div>
        <div style={{ display:"flex", alignItems:"center", gap:10 }}>
          <div style={{ textAlign:"right" }}><div style={{ fontWeight:700, fontSize:13 }}>{user.name}</div><div style={{ color:"#8C7B6E", fontSize:11 }}>{user.university||user.email}</div></div>
          <button onClick={onLogout} style={{ ...S.ghost, padding:"7px 12px" }}>Logout</button>
        </div>
      </div>

      <div style={{ maxWidth:720, margin:"0 auto", padding:24 }}>
        {/* Stats */}
        <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:14, marginBottom:24 }}>
          {[["📝",examResults.length,"Exams Taken","#2B5FA6"],["📊",`${avg}%`,"Avg Score","#1A7A5E"],["🏆",`${best}%`,"Best Score","#C47A1E"]].map(([icon,val,label,color])=>(
            <div key={label} style={{ background:T.bg2, border:`1px solid ${color}33`, borderRadius:14, padding:18 }}><div style={{ fontSize:22 }}>{icon}</div><div style={{ fontSize:26, fontWeight:800, color, marginTop:6 }}>{val}</div><div style={{ color:"#8C7B6E", fontSize:12 }}>{label}</div></div>
          ))}
        </div>

        {/* Mode cards */}
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:14, marginBottom:14 }}>

          {/* Study Session */}
          <div style={{ ...S.card, border:"2px solid rgba(16,185,129,0.4)", background:"rgba(16,185,129,0.04)", display:"flex", flexDirection:"column" }}>
            <div style={{ fontSize:32, marginBottom:8 }}>📚</div>
            <div style={{ fontWeight:800, fontSize:16, color:"#1A7A5E", marginBottom:6 }}>وضع الدراسة</div>
            <div style={{ color:"#8C7B6E", fontSize:12, marginBottom:10, lineHeight:1.7, flex:1 }}>
              تدرّب مع <strong>إجابة فورية وشرح</strong> بعد كل سؤال — مثالي للمراجعة والتعلم
            </div>
            <div style={{ display:"flex", gap:6, marginBottom:14, flexWrap:"wrap" }}>
              <span style={{ background:"rgba(16,185,129,0.12)", color:"#1A7A5E", fontSize:10, fontWeight:700, padding:"3px 8px", borderRadius:20 }}>📝 {studySettings.totalQ} سؤال</span>
              <span style={{ background:"rgba(16,185,129,0.12)", color:"#1A7A5E", fontSize:10, fontWeight:700, padding:"3px 8px", borderRadius:20 }}>✅ شرح فوري</span>
              <span style={{ background:"rgba(16,185,129,0.12)", color:"#1A7A5E", fontSize:10, fontWeight:700, padding:"3px 8px", borderRadius:20 }}>⏮️ رجوع للسؤال</span>
            </div>
            <button onClick={()=>startSession("study")} style={{ ...S.btn("#1A7A5E"), width:"100%", padding:12, fontSize:14 }}>ابدأ الدراسة ←</button>
          </div>

          {/* Exam Simulator */}
          <div style={{ ...S.card, border:"2px solid rgba(184,59,42,0.4)", background:"rgba(184,59,42,0.04)", display:"flex", flexDirection:"column" }}>
            <div style={{ fontSize:32, marginBottom:8 }}>🎯</div>
            <div style={{ fontWeight:800, fontSize:16, color:"#B83B2A", marginBottom:6 }}>محاكي اختبار الهيئة</div>
            <div style={{ color:"#8C7B6E", fontSize:12, marginBottom:10, lineHeight:1.7, flex:1 }}>
              بيئة <strong>مطابقة لاختبار SCHS</strong> — بدون شرح، وقت محدد، نتيجة في النهاية
            </div>
            <div style={{ display:"flex", gap:6, marginBottom:14, flexWrap:"wrap" }}>
              <span style={{ background:"rgba(184,59,42,0.10)", color:"#B83B2A", fontSize:10, fontWeight:700, padding:"3px 8px", borderRadius:20 }}>📝 {examSettings.totalQ} سؤال</span>
              <span style={{ background:"rgba(184,59,42,0.10)", color:"#B83B2A", fontSize:10, fontWeight:700, padding:"3px 8px", borderRadius:20 }}>⏱️ {examSettings.timeMins} دقيقة</span>
              <span style={{ background:"rgba(184,59,42,0.10)", color:"#B83B2A", fontSize:10, fontWeight:700, padding:"3px 8px", borderRadius:20 }}>🔒 بدون شرح</span>
            </div>
            <button onClick={()=>startSession("exam")} style={{ ...S.btn("#B83B2A"), width:"100%", padding:12, fontSize:14 }}>ابدأ الاختبار ←</button>
          </div>
        </div>

        {/* Study Materials */}
        <div style={{ ...S.card, border:"1px solid rgba(139,92,246,0.3)", background:"rgba(139,92,246,0.03)", display:"flex", alignItems:"center", gap:16, marginBottom:24 }}>
          <div style={{ fontSize:32, flexShrink:0 }}>📖</div>
          <div style={{ flex:1 }}>
            <div style={{ fontWeight:800, fontSize:14, color:"#7C4BA0" }}>مواد الدراسة</div>
            <div style={{ color:"#8C7B6E", fontSize:12, marginTop:2 }}>23 درساً شاملاً مع نقاط مراجعة وجداول مرجعية</div>
          </div>
          <button onClick={()=>setScreen("materials")} style={{ ...S.btn("#7C4BA0"), padding:"9px 16px", fontSize:13, flexShrink:0 }}>تصفح ←</button>
        </div>

        {/* History */}
        <div style={S.card}>
          <div style={{ fontWeight:700, marginBottom:14 }}>Exam History</div>
          {examResults.length===0 ? <p style={{ color:T.ink3, textAlign:"center", padding:"16px 0" }}>No exams yet.</p> : (
            <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
              {[...examResults].reverse().slice(0,10).map((r,i)=>(
                <div key={i} style={{ display:"flex", justifyContent:"space-between", alignItems:"center", background:T.bg2, borderRadius:10, padding:"10px 14px" }}>
                  <div><div style={{ fontWeight:700 }}>{r.correct}/{r.total} Correct</div><div style={{ color:"#8C7B6E", fontSize:12 }}>{r.date}</div></div>
                  <div style={{ fontSize:22, fontWeight:800, color:r.score>=70?"#1A7A5E":r.score>=60?"#C47A1E":"#B83B2A" }}>{r.score}%</div>
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
    id:"1.1", section:"Basic Biomedical Sciences", title:"Cardiovascular Physiology", color:"#2B5FA6",
    blocks:[
      { type:"text", content:"The cardiovascular system delivers oxygenated blood to tissues. Understanding the determinants of cardiac output and blood pressure is fundamental for managing hypertension, heart failure, and shock." },
      { type:"formula", label:"Core Formulas", lines:["CO = HR × SV", "MAP = CO × SVR", "MAP = DBP + ⅓(SBP − DBP)", "Normal CO = 4–8 L/min"] },
      { type:"table", headers:["Term","Definition","Clinical Relevance"], rows:[
        ["Preload","End-diastolic ventricular volume (LVEDV)","Reduced by diuretics; increased by IV fluids"],
        ["Afterload","Systemic vascular resistance (SVR)","Reduced by vasodilators (ACE-I, ARBs, nitrates)"],
        ["Contractility","Intrinsic force of myocardial contraction","Increased by digoxin, dobutamine; decreased in HF"],
        ["Ejection Fraction","SV / EDV — Normal ≥ 55%","HFrEF: EF < 40%; HFpEF: EF ≥ 50%"],
        ["MAP","Mean arterial pressure","Target > 65 mmHg for adequate organ perfusion"],
      ]},
      { type:"text", content:"Frank-Starling Law: ↑ preload → ↑ stroke volume, but only up to a point. Beyond optimal stretch, the myocardium is overstretched and SV declines — the basis for diuretic therapy in heart failure." },
      { type:"text", content:"Baroreceptors in the carotid sinus and aortic arch detect changes in BP. When BP drops, they activate the sympathetic nervous system → ↑HR + vasoconstriction to restore pressure." },
    ]
  },
  {
    id:"1.2", section:"Basic Biomedical Sciences", title:"Renal Physiology & GFR", color:"#2B5FA6",
    blocks:[
      { type:"text", content:"The kidneys filter ~180 L/day, regulating fluid balance, electrolytes, acid-base balance, and drug excretion. GFR is the key measure of renal function and drives dose adjustment for many drugs." },
      { type:"formula", label:"Cockcroft-Gault", lines:["CrCl = [(140 − age) × weight (kg)] / [72 × SCr (mg/dL)] × 0.85 for females"] },
      { type:"table", headers:["CKD Stage","GFR (mL/min)","Clinical Implication"], rows:[
        ["G1","≥ 90","Normal/high — kidney damage with normal GFR"],
        ["G2","60–89","Mildly decreased"],
        ["G3a","45–59","Mild-moderate ↓ — start dose adjustments"],
        ["G3b","30–44","Moderate-severe ↓ — many drugs need adjustment"],
        ["G4","15–29","Severe ↓ — avoid nephrotoxic drugs"],
        ["G5","< 15","Kidney failure — dialysis or transplant"],
      ]},
      { type:"text", content:"RAAS pathway: ↓BP → kidneys release Renin → Angiotensin I → ACE → Angiotensin II → vasoconstriction + aldosterone release (Na⁺/water retention)." },
      { type:"text", content:"ACE inhibitors block ACE; ARBs block angiotensin II receptors. Both reduce proteinuria in CKD/diabetes and have renoprotective effects." },
    ]
  },
  {
    id:"1.3", section:"Basic Biomedical Sciences", title:"Acid-Base Balance", color:"#2B5FA6",
    blocks:[
      { type:"text", content:"Acid-base balance maintains arterial pH at 7.35–7.45. The body uses chemical buffers, the lungs (CO₂ excretion), and the kidneys (HCO₃⁻ regulation) to maintain this narrow range." },
      { type:"formula", label:"Normal Values", lines:["pH 7.35–7.45", "PaCO₂ 35–45 mmHg", "PaO₂ 80–100 mmHg", "HCO₃⁻ 22–26 mEq/L"] },
      { type:"table", headers:["Disorder","pH","PaCO₂","HCO₃⁻","Common Causes"], rows:[
        ["Respiratory Acidosis","↓","↑","Normal/↑","COPD, opioid overdose, hypoventilation"],
        ["Respiratory Alkalosis","↑","↓","Normal/↓","Anxiety, PE, fever, mechanical over-ventilation"],
        ["Metabolic Acidosis","↓","Normal/↓","↓","DKA, lactic acidosis, renal failure, diarrhea"],
        ["Metabolic Alkalosis","↑","Normal/↑","↑","Vomiting, loop diuretics, hyperaldosteronism"],
      ]},
      { type:"text", content:"Fast approach: check pH first → then PaCO₂ → then HCO₃⁻. Respiratory disorders involve PaCO₂; metabolic disorders involve HCO₃⁻. Compensation moves the OPPOSITE parameter in the SAME direction as pH." },
      { type:"alert", label:"⚠️ COPD Caution", content:"Target SpO₂ = 88–92% only. Excess O₂ suppresses the hypoxic drive → worsens CO₂ retention → respiratory failure." },
    ]
  },
  {
    id:"1.4", section:"Basic Biomedical Sciences", title:"Enzyme Kinetics (Michaelis-Menten)", color:"#2B5FA6",
    blocks:[
      { type:"text", content:"Michaelis-Menten kinetics describes how enzyme reaction rate depends on substrate concentration. This is foundational for understanding drug metabolism and enzyme inhibitor pharmacology." },
      { type:"formula", label:"Equation", lines:["V = Vmax × [S] / (Km + [S])", "Km = [S] at ½ Vmax", "Lower Km = higher enzyme affinity"] },
      { type:"table", headers:["Inhibitor Type","Effect on Km","Effect on Vmax","Reversible by Excess Substrate?"], rows:[
        ["Competitive","↑ (apparent)","Unchanged","Yes — binds active site"],
        ["Non-competitive","Unchanged","↓","No — binds allosteric site"],
        ["Uncompetitive","↓","↓","No — binds enzyme-substrate complex"],
        ["Mixed","Variable","↓","Partial"],
      ]},
      { type:"text", content:"Most drugs exhibit FIRST-ORDER kinetics (rate proportional to concentration). However, some drugs (Phenytoin, Aspirin in overdose, Ethanol) show ZERO-ORDER (saturable) kinetics — small dose increases cause disproportionate level rises." },
    ]
  },
  {
    id:"1.5", section:"Basic Biomedical Sciences", title:"Microbiology & Gram Stain", color:"#2B5FA6",
    blocks:[
      { type:"text", content:"Bacterial classification by Gram stain guides empirical antibiotic selection. The differential staining reflects fundamental cell wall structure differences with major clinical implications." },
      { type:"table", headers:["Feature","Gram-Positive (+)","Gram-Negative (−)"], rows:[
        ["Cell wall","Thick peptidoglycan","Thin peptidoglycan + outer membrane (LPS)"],
        ["Stain color","Purple/violet","Pink/red"],
        ["Key toxin","Exotoxins (proteins)","Endotoxin (LPS) → septic shock"],
        ["Sepsis","Less common","Massive cytokine release (TNF-α, IL-1)"],
        ["Examples","S. aureus, Streptococcus, Enterococcus, Clostridium","E. coli, Klebsiella, Pseudomonas, H. influenzae"],
      ]},
      { type:"text", content:"Anti-Pseudomonal coverage requires SPECIFIC agents: Piperacillin-Tazobactam, Cefepime, Ceftazidime, Meropenem, Imipenem, Aztreonam, Ciprofloxacin, Aminoglycosides. Standard beta-lactams (Amoxicillin, Ceftriaxone) do NOT cover Pseudomonas." },
      { type:"alert", label:"💊 Atypicals", content:"Mycoplasma, Chlamydia, Legionella have no cell wall — Gram stain doesn't apply. Treat with macrolides, doxycycline, or fluoroquinolones." },
    ]
  },
  {
    id:"1.6", section:"Basic Biomedical Sciences", title:"Immunology — Antibodies & Hypersensitivity", color:"#2B5FA6",
    blocks:[
      { type:"text", content:"The adaptive immune system uses antibodies (immunoglobulins) and T cells to recognize and eliminate pathogens. Dysregulated responses cause hypersensitivity reactions, the foundation of many drug allergies and autoimmune diseases." },
      { type:"table", headers:["Class","% of Serum","Key Property","Clinical Significance"], rows:[
        ["IgG","75%","Crosses placenta","Long-term protection, IVIG therapy"],
        ["IgA","15%","Mucosal secretions","First-line mucosal defense (saliva, breast milk)"],
        ["IgM","8%","Pentameric, first to appear","Marker of acute/recent infection"],
        ["IgE","<0.01%","Binds mast cells","Type I hypersensitivity, parasites"],
        ["IgD","Trace","B-cell surface receptor","Developmental role"],
      ]},
      { type:"table", headers:["Type","Mechanism","Mediator","Classic Example"], rows:[
        ["Type I — Immediate","IgE on mast cells → histamine","IgE","Anaphylaxis, allergic asthma"],
        ["Type II — Cytotoxic","IgG/IgM bind cell antigens","IgG/IgM + Complement","ABO transfusion reaction, hemolytic anemia"],
        ["Type III — Immune complex","Ag-Ab complexes deposit in tissue","Complement","SLE, serum sickness, post-strep GN"],
        ["Type IV — Delayed","T-cell mediated (48–72h)","T cells","TB skin test, contact dermatitis, transplant rejection"],
      ]},
    ]
  },
  {
    id:"2.1", section:"Pharmaceutical Sciences", title:"Pharmacokinetics — ADME Overview", color:"#1A7A5E",
    blocks:[
      { type:"text", content:"Pharmacokinetics describes what the body does to the drug: Absorption, Distribution, Metabolism, Excretion (ADME). Mastering these concepts is essential for dosing, predicting drug interactions, and managing toxicity." },
      { type:"formula", label:"Bioavailability (F)", lines:["F = fraction of dose reaching systemic circulation","IV F = 100% by definition","Oral F reduced by GI degradation, P-gp efflux, and first-pass hepatic metabolism"] },
      { type:"table", headers:["Parameter","Formula","Clinical Use"], rows:[
        ["Half-life (t½)","0.693 × Vd / CL","Time to steady state = 4–5 × t½"],
        ["Clearance (CL)","Dose / AUC","Determines maintenance dose"],
        ["Vd","Dose / Cp(initial)","Large Vd = tissue distribution"],
        ["AUC","Integral of Cp × time","Total drug exposure"],
        ["Loading dose","Vd × Cp(target)","Rapidly achieve target level"],
        ["Maintenance dose","CL × Css × τ / F","Replaces drug eliminated"],
      ]},
      { type:"alert", label:"💊 First-Pass Example", content:"Oral morphine F ~ 30% vs IV F = 100%. Oral dose must be ~3× the IV dose for equivalent analgesia." },
    ]
  },
  {
    id:"2.2", section:"Pharmaceutical Sciences", title:"CYP450 Drug Metabolism", color:"#1A7A5E",
    blocks:[
      { type:"text", content:"The Cytochrome P450 (CYP450) enzyme family metabolizes most drugs in the liver. Understanding CYP inhibitors and inducers predicts the majority of clinically significant drug-drug interactions." },
      { type:"table", headers:["Enzyme","% Drug Metabolism","Major Inhibitors","Major Inducers"], rows:[
        ["CYP3A4","~50%","Erythromycin, Clarithromycin, Ketoconazole, Itraconazole, Ritonavir, Grapefruit","Rifampicin, Carbamazepine, Phenytoin, St. John's Wort"],
        ["CYP2D6","~25%","Fluoxetine, Paroxetine, Bupropion, Quinidine","None clinically significant"],
        ["CYP2C9","~15%","Fluconazole, Amiodarone, Metronidazole","Rifampicin, Carbamazepine"],
        ["CYP2C19","~10%","Omeprazole, Fluvoxamine, Fluconazole","Rifampicin"],
        ["CYP1A2","~5%","Ciprofloxacin, Fluvoxamine","Smoking, Omeprazole, Phenytoin"],
      ]},
      { type:"text", content:"Phase I: oxidation/reduction/hydrolysis by CYP enzymes → often produces active metabolites. Phase II: conjugation (glucuronidation, sulfation, acetylation) → water-soluble, inactive products for excretion." },
      { type:"alert", label:"🍊 Grapefruit Effect", content:"Furanocoumarins in grapefruit IRREVERSIBLY inhibit intestinal CYP3A4 → ↑ levels of CCBs, statins, immunosuppressants. Effect lasts 24–72 hours." },
    ]
  },
  {
    id:"2.3", section:"Pharmaceutical Sciences", title:"Volume of Distribution & Drug Distribution", color:"#1A7A5E",
    blocks:[
      { type:"text", content:"Volume of Distribution (Vd) is a theoretical volume describing how extensively a drug distributes throughout the body. Vd predicts loading doses and explains why some drugs persist despite low plasma levels." },
      { type:"formula", label:"Vd Formula", lines:["Vd = Dose / Cp(initial)", "Units: L or L/kg", "Large Vd → drug sequestered in tissues"] },
      { type:"table", headers:["Vd","Interpretation","Examples"], rows:[
        ["Small (<1 L/kg)","Stays in plasma","Warfarin, Furosemide, Aminoglycosides, Heparin"],
        ["Moderate (1–5 L/kg)","Distributes into tissues","Most drugs"],
        ["Large (>5 L/kg)","Extensive lipid tissue distribution","Digoxin (500L), Amiodarone (5000L), Chlorpromazine"],
      ]},
      { type:"text", content:"Plasma protein binding: drugs bind reversibly to albumin (acidic drugs) or alpha1-acid glycoprotein (basic drugs). Only FREE drug is pharmacologically active. Displacement interactions matter most for high-protein-bound, narrow-TI drugs (Warfarin, Phenytoin)." },
      { type:"text", content:"Crossing the Blood-Brain Barrier (BBB) requires lipophilic, uncharged molecules. Heroin crosses BBB faster than morphine — the basis for its higher addiction potential." },
    ]
  },
  {
    id:"2.4", section:"Pharmaceutical Sciences", title:"Pharmacodynamics & Receptor Theory", color:"#1A7A5E",
    blocks:[
      { type:"table", headers:["Term","Definition","Example"], rows:[
        ["Full agonist","Maximum receptor response (100% efficacy)","Morphine at mu-opioid"],
        ["Partial agonist","Submaximal response (<100% efficacy)","Buprenorphine at mu-opioid"],
        ["Competitive antagonist","Reversible blocker, overcome by ↑ agonist","Propranolol (beta-blocker)"],
        ["Non-competitive antagonist","Irreversible or allosteric blocker","Phenoxybenzamine (alpha-blocker)"],
        ["Inverse agonist","Produces opposite effect of agonist","Mifepristone (progesterone receptor)"],
      ]},
      { type:"table", headers:["Receptor Type","Mechanism","Onset","Examples"], rows:[
        ["Ionotropic","Direct ion channel","Milliseconds","Benzodiazepines (GABA-A), Nicotinic"],
        ["GPCRs","cAMP, IP3, DAG second messengers","Seconds–minutes","Beta-blockers, Opioids, Muscarinic"],
        ["Kinase-linked","Autophosphorylation cascades","Minutes–hours","Insulin, Growth factors"],
        ["Nuclear receptors","Gene transcription","Hours–days","Corticosteroids, Thyroid hormones"],
      ]},
      { type:"alert", label:"⚠️ Therapeutic Index", content:"TI = LD50 / ED50. Higher TI = safer drug. NARROW-TI drugs needing TDM: Warfarin, Lithium, Digoxin, Aminoglycosides, Phenytoin, Cyclosporine." },
    ]
  },
  {
    id:"2.5", section:"Pharmaceutical Sciences", title:"Toxicology & Antidotes", color:"#1A7A5E",
    blocks:[
      { type:"text", content:"Recognizing toxidromes and administering antidotes early can be life-saving. Memorize the major antidotes — they are extremely high-yield on SPLE." },
      { type:"table", headers:["Toxin","Antidote","Critical Notes"], rows:[
        ["Paracetamol","N-Acetylcysteine (NAC)","Most effective < 8–10 hr post-ingestion"],
        ["Opioids","Naloxone","Short t½ — may need infusion"],
        ["Benzodiazepines","Flumazenil","AVOID in seizure patients (lowers threshold)"],
        ["Warfarin","Vitamin K + 4-factor PCC","Vit K onset 6–12 hr; PCC for active bleeding"],
        ["Beta-blockers","Glucagon + Atropine","Glucagon bypasses beta-receptors via cAMP"],
        ["Digoxin","Digoxin Immune Fab (DigiFab)","Correct K⁺ and Mg²⁺ first"],
        ["CO poisoning","100% O₂ (or hyperbaric)","Reduces COHb t½ from 5h to 1h"],
        ["Iron overdose","Deferoxamine","Urine: vin-rosé color"],
        ["Organophosphates","Atropine + Pralidoxime (2-PAM)","2-PAM within 48 hr before enzyme aging"],
        ["Heparin","Protamine Sulfate","1 mg per 100 units of heparin"],
        ["Methanol/Ethylene glycol","Fomepizole or Ethanol","Inhibits alcohol dehydrogenase"],
        ["Methemoglobinemia","Methylene Blue","O₂ won't help — Hb cannot carry O₂"],
        ["Cyanide","Hydroxocobalamin","Binds CN to form cyanocobalamin (B12)"],
      ]},
      { type:"alert", label:"💊 Paracetamol Mechanism", content:"Paracetamol → NAPQI (toxic) depletes hepatic glutathione → hepatic necrosis. NAC replenishes glutathione — give within 8 hours for max benefit." },
    ]
  },
  {
    id:"3.1", section:"Social/Behavioral/Administrative Sciences", title:"Biomedical Ethics — Four Principles", color:"#7C4BA0",
    blocks:[
      { type:"table", headers:["Principle","Definition","Example","Common Conflict"], rows:[
        ["Autonomy","Respect patient's right to decide","Honoring refusal of treatment","vs Beneficence — refusing life-saving treatment"],
        ["Beneficence","Act in patient's best interest","Prescribing optimal therapy","vs Autonomy"],
        ["Non-maleficence","'First, do no harm'","Avoiding toxic drugs when benefit < risk","vs Beneficence in palliative care"],
        ["Justice","Fair distribution of resources","Formulary decisions, transplant lists","Individual vs society"],
      ]},
      { type:"text", content:"Capacity assessment: a patient has decision-making capacity if they can (1) understand the information, (2) appreciate the consequences, (3) reason through options, and (4) communicate a choice. Capacity is decision-specific." },
      { type:"alert", label:"🔒 Confidentiality Exceptions", content:"Allowed disclosures: (1) explicit written patient consent, (2) legal subpoena, (3) imminent serious harm to identifiable third party, (4) mandatory reporting (infectious disease, abuse)." },
    ]
  },
  {
    id:"3.2", section:"Social/Behavioral/Administrative Sciences", title:"KSA Pharmacy Law & Regulation", color:"#7C4BA0",
    blocks:[
      { type:"table", headers:["Authority","Role"], rows:[
        ["SFDA (Saudi FDA)","Drug registration; GMP inspection; pharmacovigilance; recalls"],
        ["MOH (Ministry of Health)","National health policy; Essential Medicines List; MOH hospitals"],
        ["SCFHS","Health profession licensing; SPLE examination administration"],
        ["NUPCO","Central drug procurement for government sector"],
        ["CBAHI","Hospital and healthcare facility accreditation"],
        ["CCHI","Cooperative Council for Health Insurance"],
      ]},
      { type:"alert", label:"📋 Controlled Substances", content:"Schedule I (Morphine, Fentanyl): TRIPLICATE Rx, original only — NO fax/photocopy. Schedule II (Benzodiazepines): duplicate Rx. Schedule III (Codeine combinations): standard Rx." },
      { type:"text", content:"Adverse drug reaction (ADR) reporting to SFDA is mandatory for serious events. Required info: patient demographics, drug details (dose, indication, dates), reaction description (severity, outcome), reporter information." },
    ]
  },
  {
    id:"3.3", section:"Social/Behavioral/Administrative Sciences", title:"Pharmacoeconomics & Health Outcomes", color:"#7C4BA0",
    blocks:[
      { type:"table", headers:["Analysis","Outcome Measure","When to Use"], rows:[
        ["CMA (Cost-Minimization)","Cost only — outcomes assumed equal","Generic substitution; proven equivalence"],
        ["CEA (Cost-Effectiveness)","Cost per clinical outcome unit","Same disease comparison ($/mmHg, $/LYS)"],
        ["CUA (Cost-Utility)","Cost per QALY","Across different diseases"],
        ["CBA (Cost-Benefit)","Net monetary benefit","Full financial ROI analysis"],
      ]},
      { type:"formula", label:"ICER", lines:["ICER = (Cost_new − Cost_old) / (Effect_new − Effect_old)", "If ICER < willingness-to-pay threshold → cost-effective"] },
      { type:"text", content:"QALY = Quality-Adjusted Life Year. Combines length AND quality of life. 1 QALY = 1 year in perfect health. Allows comparison across very different diseases (cancer vs depression vs HIV)." },
    ]
  },
  {
    id:"4.1", section:"Clinical Sciences", title:"Therapeutic Drug Monitoring (TDM)", color:"#B83B2A",
    blocks:[
      { type:"text", content:"TDM is essential for narrow-therapeutic-index drugs with high inter-patient PK variability. Measuring plasma levels prevents toxicity and ensures efficacy." },
      { type:"formula", label:"When TDM is Needed", lines:["Narrow TI + high PK variability + clear concentration-effect relationship + established target range"] },
      { type:"table", headers:["Drug","Target Range","Sampling","Key Notes"], rows:[
        ["Vancomycin","AUC/MIC 400–600","Bayesian preferred","Avoid nephrotoxicity"],
        ["Gentamicin","Peak 5–10, Trough <2 mg/L","Peak: 30 min post-dose; Trough: pre-dose","Once-daily dosing preferred"],
        ["Phenytoin","10–20 mg/L (free 1–2)","Steady state 7–10 days","Non-linear kinetics — small dose → big level rise"],
        ["Lithium","0.6–1.2 mEq/L (acute up to 1.5)","12h post-dose","Toxicity >1.5; precipitated by NSAIDs, dehydration"],
        ["Digoxin","0.5–2 ng/mL (HF: 0.5–0.9)","≥6h post-dose","Hypokalemia ↑ toxicity risk"],
        ["Cyclosporine","100–400 ng/mL","C0 (trough) or C2 (2hr post)","CYP3A4 substrate — many interactions"],
        ["Theophylline","10–20 mcg/mL","Trough","Cardiac arrhythmias above 20"],
      ]},
      { type:"text", content:"Steady-state is reached at 4–5 half-lives. Measure trough levels just BEFORE the next dose. Adjust doses based on the level and clinical response, not the level alone." },
    ]
  },
  {
    id:"4.2", section:"Clinical Sciences", title:"Pregnancy & Lactation", color:"#B83B2A",
    blocks:[
      { type:"text", content:"Pregnancy alters drug pharmacokinetics: ↑ Vd from increased plasma volume, ↑ renal clearance, ↑ hepatic metabolism. Most importantly, drugs can cross the placenta and harm the fetus." },
      { type:"table", headers:["FDA Category","Meaning","Examples"], rows:[
        ["A","Adequate human studies — no risk","Folic acid, Levothyroxine"],
        ["B","Animal studies safe; no adequate human data","Metformin, Penicillins, Metronidazole (after 1st trimester)"],
        ["C","Animal risk; no human data — benefit may outweigh","Fluconazole single-dose, Verapamil"],
        ["D","Human risk evidence — benefit may justify","Phenytoin, Lithium, Tetracyclines (>3rd trim)"],
        ["X","Contraindicated","Warfarin, Isotretinoin, Methotrexate, Thalidomide"],
      ]},
      { type:"alert", label:"🤰 First-line HTN in Pregnancy", content:"Methyldopa, Labetalol, Nifedipine. AVOID ACE-I/ARB (fetal renal damage, oligohydramnios)." },
      { type:"text", content:"Folic acid 0.4 mg/day starting 1 MONTH BEFORE conception prevents neural tube defects (spina bifida). Increase to 4 mg/day if prior NTD pregnancy. Neural tube closes by day 28 — often before woman knows she's pregnant." },
    ]
  },
  {
    id:"4.3", section:"Clinical Sciences", title:"Pediatric Pharmacotherapy", color:"#B83B2A",
    blocks:[
      { type:"text", content:"Children are NOT small adults. Hepatic enzymes mature gradually, renal function develops over 12 months, and body composition differs. Always use weight-based dosing (mg/kg) AND verify against max adult dose." },
      { type:"table", headers:["Drug","Restriction","Reason"], rows:[
        ["Tetracyclines","< 8 years","Tooth discoloration, bone growth depression"],
        ["Fluoroquinolones","< 18 years (generally)","Cartilage damage"],
        ["Aspirin","< 18 years with viral illness","Reye's syndrome (acute liver failure + encephalopathy)"],
        ["Codeine","< 12 years (avoid)","Ultra-rapid metabolizers → fatal respiratory depression"],
        ["Honey","< 1 year","Infant botulism"],
        ["Chloramphenicol","Neonates","Gray Baby Syndrome (cardiovascular collapse)"],
        ["Promethazine","< 2 years","Fatal respiratory depression"],
      ]},
      { type:"alert", label:"🧪 Neonatal Concerns", content:"Immature CYP enzymes (especially CYP2D6, CYP3A4) + glucuronidation in <1 month → drug accumulation. Use neonatal-specific dosing references." },
    ]
  },
  {
    id:"4.4", section:"Clinical Sciences", title:"Hypertension Management", color:"#B83B2A",
    blocks:[
      { type:"text", content:"Hypertension affects 1 in 4 adults and is a major risk factor for stroke, MI, HF, and CKD. Target BP per AHA/ACC 2017: <130/80 in most adults. Diabetes/CKD: <130/80." },
      { type:"table", headers:["Class","First-line For","Avoid In"], rows:[
        ["ACE-I (Ramipril)","HF, post-MI, CKD with proteinuria, DM","Pregnancy, bilateral RAS, hyperkalemia"],
        ["ARB (Losartan)","Same as ACE-I, ACE-I cough","Pregnancy"],
        ["CCB-DHP (Amlodipine)","Elderly, angina, isolated systolic HTN","HFrEF"],
        ["Thiazide (HCTZ)","Elderly, Black patients","Gout, hypokalemia, hyponatremia"],
        ["Beta-blocker (Metoprolol)","Post-MI, HF, angina, tachyarrhythmias","Asthma, AV block 2/3°, bradycardia"],
      ]},
      { type:"alert", label:"💊 ACE-I Cough", content:"5–20% of ACE-I users develop dry cough from bradykinin accumulation. Switch to ARB (no effect on bradykinin) — same BP benefit." },
      { type:"text", content:"Hypertensive urgency (BP >180/120, no end-organ damage): gradual reduction over 24–48 hr with oral agents. Hypertensive emergency (with end-organ damage): IV agents, ICU monitoring, reduce MAP by 25% in 1 hour." },
    ]
  },
  {
    id:"4.5", section:"Clinical Sciences", title:"Type 2 Diabetes Mellitus", color:"#B83B2A",
    blocks:[
      { type:"table", headers:["Drug","Mechanism","Key Benefit","Key Warning"], rows:[
        ["Metformin","↓ Hepatic gluconeogenesis","First-line; weight neutral; CV safe","Stop at CrCl <30 (lactic acidosis); hold before contrast"],
        ["SGLT2-i (Empagliflozin)","↑ Urinary glucose excretion","CV & renal protection; weight loss; BP↓","Genital mycotic infections; euglycemic DKA"],
        ["GLP-1 RA (Semaglutide)","↑ Insulin (glucose-dep); ↓ glucagon","Weight loss; CV benefit","Pancreatitis (rare); nausea"],
        ["DPP-4i (Sitagliptin)","↑ Incretins","Weight neutral; renal safe with adjustment","Pancreatitis (rare)"],
        ["Sulphonylureas (Glibenclamide)","↑ Insulin secretion","Cheap, effective","HYPOGLYCEMIA risk; weight gain"],
        ["Pioglitazone (TZD)","↑ Insulin sensitivity","Effective in insulin resistance","Weight gain, edema, HF, bladder cancer risk"],
        ["Insulin","Direct glucose lowering","Most potent","Hypoglycemia; weight gain; injection"],
      ]},
      { type:"formula", label:"HbA1c Targets", lines:["Most adults: <7%", "Elderly/frail/comorbidities: <8%", "Young/healthy: <6.5%", "Avoid hypoglycemia in elderly"] },
      { type:"text", content:"SGLT2 inhibitors and GLP-1 RAs have CV/renal mortality benefits independent of glucose lowering. Prefer them in patients with established ASCVD, HF, or CKD — regardless of A1c." },
    ]
  },
  {
    id:"4.6", section:"Clinical Sciences", title:"Antibiotic Selection by Pathogen", color:"#B83B2A",
    blocks:[
      { type:"table", headers:["Pathogen","First-line","Alternative","Notes"], rows:[
        ["MSSA","Cloxacillin / Nafcillin / Cefazolin","Clindamycin","NOT Amoxicillin alone (beta-lactamase)"],
        ["MRSA","Vancomycin IV","Linezolid, Daptomycin (NOT in pneumonia)","TDM with AUC/MIC 400–600"],
        ["Strep pneumoniae","Amoxicillin / Penicillin G","Ceftriaxone, Levofloxacin","Check local resistance"],
        ["E. coli UTI","Nitrofurantoin / TMP-SMX","Ciprofloxacin (if susceptible)","Avoid empiric FQ"],
        ["Pseudomonas","Pip-Tazo, Cefepime, Meropenem","Cipro, Aminoglycosides","Combine 2 agents in severe"],
        ["C. difficile","Vancomycin PO / Fidaxomicin","Bezlotoxumab (recurrence prevention)","Metronidazole no longer preferred"],
        ["TB (drug-sensitive)","RIPE: Rifampicin + INH + Pyrazinamide + Ethambutol","Individualized for MDR-TB","6 months total; DOT often required"],
        ["H. pylori","PPI + Amoxicillin + Clarithromycin × 14d","Quadruple therapy with bismuth","Test of cure 4 weeks after"],
      ]},
      { type:"alert", label:"💊 Penicillin Allergy", content:"Verify true allergy (rash + tongue swelling, anaphylaxis) vs intolerance (GI upset). True allergy → alternatives: macrolides, doxycycline, or cephalosporin if rash only (cross-reactivity ~1–3%)." },
    ]
  },
  {
    id:"4.7", section:"Clinical Sciences", title:"Anticoagulation Therapy", color:"#B83B2A",
    blocks:[
      { type:"table", headers:["Drug","Mechanism","Monitoring","Reversal"], rows:[
        ["UFH (Heparin)","Activates Antithrombin III → ↓ IIa, Xa","aPTT (target 60–90s)","Protamine Sulfate"],
        ["LMWH (Enoxaparin)","↓ Factor Xa primarily","Anti-Xa (in CKD, pregnancy, obesity)","Protamine (60% effective)"],
        ["Warfarin","↓ Vitamin K factors II, VII, IX, X","INR (2–3 most; 2.5–3.5 mechanical valve)","Vit K + 4-factor PCC"],
        ["Rivaroxaban, Apixaban","Direct Factor Xa inhibitors (DOAC)","No routine TDM","Andexanet alfa"],
        ["Dabigatran","Direct thrombin (IIa) inhibitor (DOAC)","No routine TDM","Idarucizumab (Praxbind)"],
      ]},
      { type:"formula", label:"CHA₂DS₂-VASc", lines:["Score ≥2 (men) or ≥3 (women) → anticoagulate in AF","DOACs preferred over Warfarin (better safety, no monitoring)"] },
      { type:"alert", label:"⚠️ HIT — Heparin-Induced Thrombocytopenia", content:"Platelets drop 5–10 days after heparin exposure. PARADOXICALLY causes thrombosis (not bleeding). Stop ALL heparin (including LMWH and flushes). Use Argatroban, Bivalirudin, Fondaparinux, or DOAC." },
    ]
  },
  {
    id:"4.8", section:"Clinical Sciences", title:"Asthma & COPD Management", color:"#B83B2A",
    blocks:[
      { type:"text", content:"Asthma is reversible airway inflammation triggered by allergens/exercise. COPD is irreversible airflow limitation from smoking. Both share bronchodilator therapy but differ in steroid responsiveness and prognosis." },
      { type:"table", headers:["GINA Step","Severity","Preferred Controller","Reliever"], rows:[
        ["1","Intermittent","Low-dose ICS-Formoterol PRN","SABA or ICS-Formoterol"],
        ["2","Mild persistent","Low-dose ICS daily","SABA or ICS-Formoterol PRN"],
        ["3","Mild-moderate","Low-dose ICS + LABA","SABA or ICS-Formoterol PRN"],
        ["4","Moderate-severe","Medium-high ICS + LABA +/− LAMA","SABA or ICS-Formoterol PRN"],
        ["5","Severe","Add biologic (anti-IgE: Omalizumab, anti-IL5: Mepolizumab)","Same"],
      ]},
      { type:"alert", label:"⚠️ GINA Update", content:"SABA monotherapy NO LONGER recommended — associated with ↑ asthma deaths. Prefer ICS-Formoterol PRN as reliever (anti-inflammatory effect)." },
      { type:"table", headers:["GOLD Stage","FEV1 % Predicted"], rows:[
        ["GOLD 1 (Mild)","≥ 80%"],
        ["GOLD 2 (Moderate)","50–80%"],
        ["GOLD 3 (Severe)","30–50%"],
        ["GOLD 4 (Very severe)","< 30%"],
      ]},
    ]
  },
  {
    id:"4.9", section:"Clinical Sciences", title:"Major Drug-Drug Interactions", color:"#B83B2A",
    blocks:[
      { type:"table", headers:["Object Drug","Precipitant","Effect","Action"], rows:[
        ["Warfarin","Rifampicin","↓ INR → thrombosis","↑ Warfarin dose; monitor INR"],
        ["Warfarin","Fluconazole / Metronidazole","↑ INR → bleeding","↓ Warfarin dose ~50%; monitor"],
        ["Statins","Erythromycin / Itraconazole","↑ Statin → rhabdomyolysis","Use Rosuvastatin/Pravastatin"],
        ["Methotrexate","NSAIDs","↓ MTX clearance → toxicity","Avoid combination"],
        ["Digoxin","Amiodarone / Verapamil","↑ Digoxin × 2","↓ Digoxin 50%; monitor"],
        ["ACE-I","K-sparing diuretic / K supplement","Hyperkalemia","Monitor K⁺"],
        ["Clopidogrel","Omeprazole / Esomeprazole","↓ Clopidogrel activation (CYP2C19)","Switch to Pantoprazole/Rabeprazole"],
        ["Fluoroquinolones","Antacids / Iron / Calcium","Chelation → ↓ FQ absorption","Separate doses by 2–4 hr"],
        ["SSRI","Tramadol / MAOI","Serotonin syndrome","Avoid combination"],
        ["MAOIs","Tyramine foods (cheese, wine)","Hypertensive crisis","Dietary counseling"],
      ]},
      { type:"alert", label:"⚠️ Serotonin Syndrome", content:"Triad: mental status change + autonomic instability + neuromuscular hyperactivity (clonus, hyperreflexia). Causes: SSRI + Tramadol, SSRI + MAOI, SSRI + Linezolid. Treat: stop drugs, supportive care, Cyproheptadine if severe." },
    ]
  },
];

// ===================== STUDY MATERIALS SCREEN =====================
// ===================== STUDY MATERIALS + SESSION (integrated flow) =====================
function StudyMaterialsScreen({ onBack, onStartStudy, allQuestions }) {
  const [phase, setPhase] = useState("list");
  const [activeSection, setActiveSection] = useState(null);
  const [activeLesson, setActiveLesson] = useState(null);
  const [lessonIdx, setLessonIdx] = useState(0);
  const [sectionPhase, setSectionPhase] = useState("lesson");
  const [cur, setCur] = useState(0);
  const [answers, setAnswers] = useState({});
  const [showExp, setShowExp] = useState(false);
  const [sectionQuestions, setSectionQuestions] = useState([]);

  const secColors = { "Basic Biomedical Sciences":"#2B5FA6","Pharmaceutical Sciences":"#1A7A5E","Social/Behavioral/Administrative Sciences":"#7C4BA0","Clinical Sciences":"#B83B2A" };
  const diffCol = {"سهل":"#1A7A5E","متوسط":"#C47A1E","صعب":"#B83B2A"};
  const grouped = {};
  STUDY_LESSONS.forEach(l => { if(!grouped[l.section]) grouped[l.section]=[]; grouped[l.section].push(l); });
  const sections = Object.keys(grouped);

  // Read ALL question banks merged
  const getAllQ = () => {
    const shared = DB.getQuestions();
    const study  = DB.getStudyQuestions();
    const exam   = DB.getExamQuestions();
    const merged = [...shared, ...study, ...exam];
    // deduplicate by id
    const seen = new Set();
    return merged.filter(q => { if(seen.has(q.id)) return false; seen.add(q.id); return true; });
  };

  const buildSectionQ = (section) => {
    const all = getAllQ();
    const pool = all.filter(q => q.section === section);
    return [...pool].sort(() => Math.random() - 0.5).slice(0, 10);
  };

  const startSection = (section) => {
    setActiveSection(section);
    setLessonIdx(0);
    setSectionPhase("lesson");
    setActiveLesson(grouped[section][0]);
    setCur(0); setAnswers({}); setShowExp(false);
    setSectionQuestions([]); // will be built when questions phase starts
    setPhase("section");
  };

  const [generatingQ, setGeneratingQ] = useState(false);

  const generateAIQuestions = async (section, lessons) => {
    setGeneratingQ(true);
    const lessonTitles = lessons.map(l => l.title).join(", ");
    const keyContent = lessons.map(l =>
      l.blocks.filter(b => b.type === "table" || b.type === "formula")
        .map(b => b.type === "table"
          ? `Table: ${b.headers.join(" | ")}\n${b.rows.map(r=>r.join(" | ")).join("\n")}`
          : `${b.label}: ${b.lines.join(" | ")}`)
        .join("\n")
    ).join("\n\n");

    const prompt = `You are an expert SPLE (Saudi Pharmacist Licensure Examination) question writer following SCHS/SCFHS blueprint standards.

Generate exactly 10 high-quality multiple-choice questions for:
Section: ${section}
Topics covered: ${lessonTitles}

Key content to test:
${keyContent.substring(0, 3000)}

SPLE question requirements:
- Clinical scenario-based when possible (real pharmacy practice situations)
- Exactly 4 options (A, B, C, D), ONE correct answer
- Mix of difficulty: 3 easy (recall), 4 medium (application), 3 hard (clinical judgment)
- Options should be plausible — avoid obviously wrong distractors
- Answer indexed 0-3 (0=A, 1=B, 2=C, 3=D)
- Clear explanation (2-3 sentences, no markdown)
- Relevant to Saudi pharmacy practice and SCHS standards

Respond ONLY with valid JSON array, no markdown, no backticks:
[{"question":"...","options":["A text","B text","C text","D text"],"answer":0,"explanation":"...","difficulty":"سهل"}]
difficulty must be one of: سهل, متوسط, صعب`;

    try {
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "claude-sonnet-4-6",
          max_tokens: 4000,
          messages: [{ role: "user", content: prompt }]
        })
      });
      const data = await res.json();
      const text = data.content?.[0]?.text || "[]";
      const clean = text.replace(/```json|```/g, "").trim();
      const parsed = JSON.parse(clean);
      return parsed.map((q, i) => ({
        id: `ai_${section}_${Date.now()}_${i}`,
        section,
        category: lessons[0]?.title || section,
        difficulty: q.difficulty || "متوسط",
        question: q.question,
        options: q.options,
        answer: q.answer,
        explanation: q.explanation || ""
      }));
    } catch(e) {
      console.error("AI generation failed:", e);
      return buildSectionQ(activeSection); // fallback to existing questions
    } finally {
      setGeneratingQ(false);
    }
  };

  const goNextLesson = async () => {
    const lessons = grouped[activeSection];
    if (lessonIdx + 1 < lessons.length) {
      setLessonIdx(lessonIdx + 1);
      setActiveLesson(lessons[lessonIdx + 1]);
      setSectionPhase("lesson");
    } else {
      // all lessons done — generate AI questions
      setSectionPhase("questions");
      setCur(0); setAnswers({}); setShowExp(false);
      const qs = await generateAIQuestions(activeSection, lessons);
      setSectionQuestions(qs);
    }
  };

  const color = activeSection ? (secColors[activeSection] || "#2B5FA6") : "#2B5FA6";

  // ── PHASE: LIST ─────────────────────────────────────────────
  if (phase === "list") return (
    <div style={{ minHeight:"100vh", background:T.bg, fontFamily:"system-ui,sans-serif", color:T.ink }}>
      <div style={{ background:T.surface, borderBottom:`1px solid ${T.border}`, padding:"14px 24px", display:"flex", alignItems:"center", gap:12, boxShadow:T.shadow }}>
        <button onClick={onBack} style={{ ...S.btn(T.accent), padding:"9px 18px", fontSize:13, display:"flex", alignItems:"center", gap:6 }}>
          ← Dashboard
        </button>
        <div style={{ fontWeight:800, fontSize:16, color:T.ink }}>📚 Study Materials</div>
        <div style={{ marginLeft:"auto", color:T.ink3, fontSize:12 }}>{STUDY_LESSONS.length} Lessons</div>
      </div>
      <div style={{ maxWidth:720, margin:"0 auto", padding:24 }}>
        <div style={{ ...S.card, marginBottom:24, background:"rgba(16,185,129,0.06)", border:"1px solid rgba(16,185,129,0.3)" }}>
          <div style={{ display:"flex", gap:14, alignItems:"center" }}>
            <div style={{ fontSize:36 }}>📖</div>
            <div>
              <div style={{ fontWeight:800, fontSize:16, color:"#1A7A5E" }}>SPLE Study Material</div>
              <div style={{ color:"#8C7B6E", fontSize:13, marginTop:4 }}>اختر قسماً للبدء — ستظهر دروس القسم ثم أسئلة تطبيقية</div>
              <div style={{ display:"flex", gap:8, marginTop:8, flexWrap:"wrap" }}>
                {[["10%","Basic Biomedical","#2B5FA6"],["35%","Pharmaceutical","#1A7A5E"],["20%","Social/Admin","#7C4BA0"],["35%","Clinical","#B83B2A"]].map(([pct,label,c])=>(
                  <span key={label} style={{ background:c+"18", color:c, fontSize:11, fontWeight:700, padding:"2px 10px", borderRadius:20 }}>{pct} {label}</span>
                ))}
              </div>
            </div>
          </div>
        </div>

        {sections.map(section => {
          const c = secColors[section];
          const lessons = grouped[section];
          return (
            <div key={section} style={{ ...S.card, marginBottom:16, border:`1px solid ${c}33`, cursor:"pointer" }}
              onClick={()=>startSection(section)}>
              <div style={{ display:"flex", alignItems:"center", gap:14 }}>
                <div style={{ width:48, height:48, borderRadius:14, background:c+"22", display:"flex", alignItems:"center", justifyContent:"center", fontSize:22, flexShrink:0 }}>
                  {section==="Basic Biomedical Sciences"?"🔬":section==="Pharmaceutical Sciences"?"💊":section==="Social/Behavioral/Administrative Sciences"?"⚖️":"🏥"}
                </div>
                <div style={{ flex:1 }}>
                  <div style={{ fontWeight:800, fontSize:15, color:c }}>{section}</div>
                  <div style={{ color:"#8C7B6E", fontSize:12, marginTop:3 }}>{lessons.length} lessons · {lessons.map(l=>l.title).slice(0,2).join(", ")}{lessons.length>2?` +${lessons.length-2} more`:""}</div>
                </div>
                <div style={{ textAlign:"right" }}>
                  <div style={{ background:c+"22", color:c, fontSize:11, fontWeight:700, padding:"4px 10px", borderRadius:20 }}>{BLUEPRINT[section]?.pct}% of SPLE</div>
                  <div style={{ color:c, fontSize:20, marginTop:4 }}>→</div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );

  // ── PHASE: SECTION (lessons + questions) ─────────────────────
  if (phase === "section") {
    const lessons = grouped[activeSection];

    // — show lesson material —
    if (sectionPhase === "lesson" && activeLesson) {
      const l = activeLesson;
      const isLastLesson = lessonIdx === lessons.length - 1;

      const renderBlock = (block, i) => {
        if (block.type === "text") return (
          <p key={i} style={{ color:T.ink2, fontSize:14.5, lineHeight:1.9, margin:"0 0 18px", fontFamily:"Georgia, serif", direction:"ltr", textAlign:"left" }}>{block.content}</p>
        );
        if (block.type === "formula") return (
          <div key={i} style={{ background:color+"14", border:`1.5px solid ${color}44`, borderRadius:10, padding:"14px 18px", marginBottom:18 }}>
            <div style={{ color:color, fontWeight:700, fontSize:11, marginBottom:10, textTransform:"uppercase", letterSpacing:"0.08em", fontFamily:"system-ui,sans-serif" }}>{block.label}</div>
            <div style={{ display:"flex", flexDirection:"column", gap:6 }}>
              {block.lines.map((line,j)=>(
                <div key={j} style={{ background:T.bg3, borderRadius:7, padding:"9px 14px", fontFamily:"'Courier New', monospace", fontSize:13, color:T.ink, fontWeight:600, border:`1px solid ${T.border}` }}>{line}</div>
              ))}
            </div>
          </div>
        );
        if (block.type === "alert") return (
          <div key={i} style={{ background:"rgba(196,122,30,0.08)", border:"1.5px solid rgba(196,122,30,0.35)", borderRadius:10, padding:"14px 18px", marginBottom:18, display:"flex", gap:12 }}>
            <span style={{ fontSize:18, flexShrink:0 }}>💡</span>
            <div>
              <div style={{ color:T.gold, fontWeight:700, fontSize:13, marginBottom:4, fontFamily:"system-ui,sans-serif" }}>{block.label}</div>
              <div style={{ color:T.ink2, fontSize:13.5, lineHeight:1.7, fontFamily:"Georgia, serif" }}>{block.content}</div>
            </div>
          </div>
        );
        if (block.type === "table") return (
          <div key={i} style={{ marginBottom:20, borderRadius:10, overflow:"hidden", border:`1.5px solid ${T.border}`, boxShadow:T.shadow, direction:"ltr" }}>
            <div style={{ overflowX:"auto" }}>
              <table style={{ width:"100%", borderCollapse:"collapse", fontSize:13.5, fontFamily:"system-ui,sans-serif", direction:"ltr" }}>
                <thead>
                  <tr style={{ background:color+"18" }}>
                    {block.headers.map((h,j)=>(
                      <th key={j} style={{ padding:"11px 15px", textAlign:"left", color:color, fontWeight:700, borderBottom:`2px solid ${color}33`, whiteSpace:"nowrap", fontSize:12, textTransform:"uppercase", letterSpacing:"0.05em" }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {block.rows.map((row,j)=>(
                    <tr key={j} style={{ borderBottom:`1px solid ${T.border}`, background:j%2===0?T.surface:T.bg }}>
                      {row.map((cell,k)=>(
                        <td key={k} style={{ padding:"10px 15px", textAlign:"left", color:k===0?T.ink:T.ink2, fontWeight:k===0?600:400, lineHeight:1.6, fontSize:13 }}>{cell}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        );
        return null;
      };

      return (
        <div style={{ minHeight:"100vh", background:T.bg, fontFamily:"system-ui,sans-serif", color:T.ink }}>
          <div style={{ background:T.surface, borderBottom:`1px solid ${T.border}`, padding:"12px 24px", display:"flex", alignItems:"center", gap:12, boxShadow:T.shadow }}>
            <button onClick={()=>{ if(lessonIdx===0) setPhase("list"); else { setLessonIdx(lessonIdx-1); setActiveLesson(lessons[lessonIdx-1]); setSectionPhase("lesson"); }}} style={{ ...S.ghost, padding:"6px 14px", fontSize:13 }}>← Back</button>
            <div>
              <div style={{ color:color, fontWeight:800, fontSize:14, fontFamily:"system-ui,sans-serif" }}>Lesson {l.id}: {l.title}</div>
              <div style={{ color:T.ink3, fontSize:11, fontFamily:"system-ui,sans-serif" }}>{l.section}</div>
            </div>
            <div style={{ marginLeft:"auto", color:T.ink3, fontSize:12, fontFamily:"system-ui,sans-serif" }}>{lessonIdx+1} / {lessons.length}</div>
          </div>
          <div style={{ height:3, background:T.bg2 }}>
            <div style={{ width:`${((lessonIdx+1)/lessons.length)*100}%`, height:"100%", background:color, transition:"width 0.4s" }} />
          </div>
          <div style={{ maxWidth:800, margin:"0 auto", padding:"24px 24px 40px", direction:"ltr" }}>
            {/* Lesson header like PDF */}
            <div style={{ borderBottom:`2px solid ${color}`, paddingBottom:12, marginBottom:24 }}>
              <div style={{ color:color, fontSize:11, fontWeight:700, textTransform:"uppercase", letterSpacing:2, marginBottom:4 }}>{l.section}</div>
              <h2 style={{ margin:0, fontSize:22, fontWeight:800, color:T.ink }}>Lesson {l.id}: {l.title}</h2>
            </div>
            {/* Render all blocks */}
            {l.blocks.map((block, i) => renderBlock(block, i))}
            {/* Navigation — Back right, Next left, centered */}
            <div style={{ marginTop:32, display:"flex", justifyContent:"center", alignItems:"center", gap:16 }}>
              <button onClick={goNextLesson} style={{ ...S.btn(color), padding:"12px 28px", fontSize:14, display:"flex", alignItems:"center", gap:8 }}>
                {isLastLesson ? "Start Practice Questions ✅" : `← Next`}
              </button>
              <div style={{ color:T.ink3, fontSize:12, fontFamily:"system-ui,sans-serif" }}>{lessonIdx+1} / {lessons.length}</div>
              <button
                onClick={()=>{ if(lessonIdx===0) setPhase("list"); else { setLessonIdx(lessonIdx-1); setActiveLesson(lessons[lessonIdx-1]); setSectionPhase("lesson"); }}}
                style={{ ...S.ghost, padding:"12px 28px", fontSize:14, display:"flex", alignItems:"center", gap:8 }}>
                {lessonIdx===0 ? "Sections →" : "Previous →"}
              </button>
            </div>
          </div>
        </div>
      );
    }

      if (sectionPhase === "questions") {
        // Show loading while AI generates
        if (generatingQ || sectionQuestions.length === 0) {
          return (
            <div style={{ minHeight:"100vh", background:T.bg, fontFamily:"system-ui,sans-serif", display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", gap:20 }}>
              <div style={{ fontSize:48, animation:"spin 1.5s linear infinite" }}>⚕️</div>
              <div style={{ fontWeight:800, fontSize:18, color:color }}>Generating SPLE Questions…</div>
              <div style={{ color:T.ink3, fontSize:14, maxWidth:340, textAlign:"center" }}>
                Claude AI is crafting 10 clinical questions tailored to {activeSection.split(" ")[0]} — per SCHS blueprint standards
              </div>
              <div style={{ display:"flex", gap:6, marginTop:8 }}>
                {[0,1,2].map(i=>(
                  <div key={i} style={{ width:8, height:8, borderRadius:"50%", background:color, opacity:0.4, animation:`pulse 1.2s ease-in-out ${i*0.4}s infinite` }} />
                ))}
              </div>
              <style>{`
                @keyframes spin { from{transform:rotate(0deg)} to{transform:rotate(360deg)} }
                @keyframes pulse { 0%,100%{opacity:0.2;transform:scale(0.8)} 50%{opacity:1;transform:scale(1.2)} }
              `}</style>
            </div>
          );
        }

        const q = sectionQuestions[cur];
        if (!q) {
          return (
            <div style={{ minHeight:"100vh", background:T.bg, fontFamily:"system-ui,sans-serif", color:"#1C1814", display:"flex", alignItems:"center", justifyContent:"center", flexDirection:"column", gap:16, padding:24 }}>
              <div style={{ fontSize:48 }}>📭</div>
              <div style={{ fontWeight:700, fontSize:18, textAlign:"center" }}>No questions uploaded for this section yet</div>
              <p style={{ color:"#8C7B6E", textAlign:"center", maxWidth:400 }}>ارفع أسئلة من صفحة Questions أو ابدأ Study Session الكاملة</p>
              <div style={{ display:"flex", gap:12 }}>
                <button onClick={()=>setPhase("list")} style={{ ...S.ghost, padding:"10px 20px" }}>← Back to Sections</button>
                <button onClick={onStartStudy} style={{ ...S.btn("#1A7A5E"), padding:"10px 20px" }}>📝 Start Full Study Session →</button>
              </div>
            </div>
          );
        }
        const answered = answers[q.id] !== undefined;
        const correct = answers[q.id] === q.answer;
        const col = SC[q.section] || { accent:color, bg:T.bg };
        const goNext = () => { setShowExp(false); if (cur < sectionQuestions.length-1) setCur(p=>p+1); else setPhase("list"); };
        const goPrev = () => { setShowExp(false); if (cur > 0) setCur(p=>p-1); };
        const diffCol2 = {"سهل":"#1A7A5E","متوسط":"#C47A1E","صعب":"#B83B2A"};
        return (
          <div style={{ minHeight:"100vh", background:T.bg, fontFamily:"system-ui,sans-serif", color:T.ink, direction:"ltr" }}>
            {/* Header */}
            <div style={{ background:T.surface, borderBottom:`1px solid ${T.border}`, padding:"11px 22px", display:"flex", justifyContent:"space-between", alignItems:"center", boxShadow:T.shadow }}>
              <button onClick={()=>{ setSectionPhase("lesson"); setLessonIdx(lessons.length-1); setActiveLesson(lessons[lessons.length-1]); }}
                style={{ ...S.ghost, padding:"6px 14px", fontSize:13, display:"flex", alignItems:"center", gap:6 }}>
                ← Study Materials
              </button>
              <span style={{ background:color+"18", color:color, fontSize:12, fontWeight:700, padding:"5px 14px", borderRadius:20, border:`1px solid ${color}33` }}>
                📝 {activeSection.split(" ")[0]} Practice
              </span>
              <span style={{ color:diffCol2[q.difficulty]||T.ink3, fontWeight:700, fontSize:13, background:(diffCol2[q.difficulty]||T.ink3)+"12", padding:"4px 12px", borderRadius:20 }}>{q.difficulty}</span>
            </div>
            {/* Progress */}
            <div style={{ height:3, background:T.bg3 }}>
              <div style={{ width:`${((cur+1)/sectionQuestions.length)*100}%`, height:"100%", background:color, transition:"width 0.3s" }} />
            </div>
            <div style={{ maxWidth:700, margin:"0 auto", padding:"22px 22px 100px" }}>
              <div style={{ color:color, fontSize:10, fontWeight:700, marginBottom:8, textTransform:"uppercase", letterSpacing:"0.08em", fontFamily:"system-ui,sans-serif" }}>{q.section} · {q.category}</div>
              {/* Question */}
              <div style={{ ...S.card, border:`1px solid ${color}33`, marginBottom:18 }}>
                <p style={{ fontSize:16, lineHeight:1.7, margin:0, fontWeight:500, fontFamily:"Georgia,serif", color:T.ink }}>{q.question}</p>
              </div>
              {/* Options */}
              <div style={{ display:"flex", flexDirection:"column", gap:9, marginBottom:18 }}>
                {q.options.map((opt,i)=>{
                  let bg=T.bg2, border=`1px solid ${T.border}`, c=T.ink;
                  if(answered){ if(i===q.answer){bg="rgba(26,122,94,0.12)";border="2px solid #1A7A5E";c="#1A7A5E";} else if(i===answers[q.id]){bg="rgba(184,59,42,0.10)";border="2px solid #B83B2A";c="#B83B2A";} }
                  return <button key={i} onClick={()=>{ if(!answered){setAnswers(p=>({...p,[q.id]:i})); setShowExp(true);}}}
                    style={{ background:bg, border, borderRadius:10, padding:"13px 16px", cursor:answered?"default":"pointer", textAlign:"left", color:c, fontSize:14, display:"flex", alignItems:"center", gap:12, fontFamily:"system-ui,sans-serif", transition:"all 0.15s" }}>
                    <span style={{ minWidth:28, height:28, borderRadius:7, background:T.bg3, border:`1px solid ${T.border}`, display:"flex", alignItems:"center", justifyContent:"center", fontSize:12, fontWeight:700, flexShrink:0, color:T.ink3 }}>{["A","B","C","D"][i]}</span>
                    <span style={{ flex:1 }}>{opt}</span>
                    {answered&&i===q.answer&&<span style={{ color:"#1A7A5E", fontWeight:700 }}>✓</span>}
                    {answered&&i===answers[q.id]&&i!==q.answer&&<span style={{ color:"#B83B2A", fontWeight:700 }}>✗</span>}
                  </button>;
                })}
              </div>
              {/* Explanation */}
              {showExp && (
                <div style={{ background:correct?"rgba(26,122,94,0.08)":"rgba(184,59,42,0.06)", border:`1.5px solid ${correct?"rgba(26,122,94,0.35)":"rgba(184,59,42,0.30)"}`, borderRadius:12, padding:16, marginBottom:20 }}>
                  <div style={{ fontWeight:700, marginBottom:6, color:correct?"#1A7A5E":"#B83B2A", fontSize:13, fontFamily:"system-ui,sans-serif" }}>{correct?"✅ Correct!":"❌ Incorrect"}</div>
                  <p style={{ color:T.ink2, fontSize:13.5, lineHeight:1.7, margin:0, fontFamily:"Georgia,serif" }}>💡 {(q.explanation||"No explanation provided.").replace(/\*\*/g,"").replace(/^#+\s*/gm,"").replace(/`/g,"")}</p>
                </div>
              )}
            </div>
            {/* Fixed Bottom Nav — Back right, Next left */}
            <div style={{ position:"fixed", bottom:0, left:0, right:0, background:T.surface, borderTop:`1px solid ${T.border}`, padding:"14px 24px", display:"flex", justifyContent:"center", alignItems:"center", gap:20, boxShadow:"0 -4px 16px rgba(60,40,20,0.08)" }}>
              {answered
                ? <button onClick={goNext} style={{ ...S.btn(color), padding:"11px 28px", fontSize:14, display:"flex", alignItems:"center", gap:8 }}>
                    {cur<sectionQuestions.length-1 ? "← Next" : "✅ Done"}
                  </button>
                : <button disabled style={{ ...S.btn(T.bg3), padding:"11px 28px", fontSize:14, opacity:0.4, color:T.ink3 }}>← Next</button>
              }
              <span style={{ color:T.ink3, fontSize:13, fontFamily:"system-ui,sans-serif", minWidth:60, textAlign:"center" }}>{cur+1} / {sectionQuestions.length}</span>
              <button onClick={goPrev} disabled={cur===0}
                style={{ ...S.ghost, padding:"11px 28px", fontSize:14, opacity:cur===0?0.35:1, display:"flex", alignItems:"center", gap:8 }}>
                Back →
              </button>
            </div>
          </div>
        );
      }
    }

  return null;
}

function StudyScreen({ questions, onFinish, onHome }) {
  const [cur, setCur] = useState(0);
  const [answers, setAnswers] = useState({});
  const [showExp, setShowExp] = useState(false);
  const q = questions[cur];
  const answered = answers[q.id] !== undefined;
  const correct = answers[q.id] === q.answer;
  const col = SC[q.section] || { accent:"#1A7A5E", bg:T.bg };
  const diffCol = { "سهل":"#1A7A5E", "متوسط":"#C47A1E", "صعب":"#B83B2A" };
  const next = () => { setShowExp(false); if (cur < questions.length-1) setCur(p=>p+1); else onFinish(answers); };
  const prev = () => { setShowExp(false); if (cur > 0) setCur(p=>p-1); };

  return (
    <div style={{ minHeight:"100vh", background:T.bg, fontFamily:"system-ui,sans-serif", color:"#1C1814" }}>
      <div style={{ background:col.bg||T.bg, borderBottom:"1px solid #10b98144", padding:"11px 22px", display:"flex", justifyContent:"space-between", alignItems:"center" }}>
        <div style={{ display:"flex", alignItems:"center", gap:8 }}>
          <button onClick={onHome} style={{ background:"rgba(140,110,80,0.12)", border:"none", borderRadius:8, padding:"5px 12px", color:"#8C7B6E", cursor:"pointer", fontSize:12 }}>🏠 Home</button>
          {cur > 0 && <button onClick={prev} style={{ background:"rgba(140,110,80,0.12)", border:"none", borderRadius:8, padding:"5px 12px", color:"#8C7B6E", cursor:"pointer", fontSize:12 }}>← Back</button>}
        </div>
        <span style={{ background:"rgba(16,185,129,0.15)", color:"#1A7A5E", fontSize:12, fontWeight:700, padding:"4px 12px", borderRadius:20 }}>📚 Study · Q {cur+1}/{questions.length}</span>
        <span style={{ color:diffCol[q.difficulty], fontWeight:700, fontSize:13 }}>{q.difficulty}</span>
      </div>
      <div style={{ height:4, background:T.bg3 }}><div style={{ width:`${((cur+1)/questions.length)*100}%`, height:"100%", background:"#1A7A5E", transition:"width 0.3s" }} /></div>
      <div style={{ maxWidth:700, margin:"0 auto", padding:22 }}>
        <div style={{ color:"#1A7A5E", fontSize:10, fontWeight:700, marginBottom:8, textTransform:"uppercase", letterSpacing:1 }}>{q.section} · {q.category}</div>
        <div style={{ ...S.card, border:"1px solid rgba(16,185,129,0.2)", marginBottom:18 }}><p style={{ fontSize:16, lineHeight:1.7, margin:0, fontWeight:500 }}>{q.question}</p></div>
        <div style={{ display:"flex", flexDirection:"column", gap:9, marginBottom:18 }}>
          {q.options.map((opt,i) => {
            let bg="rgba(140,110,80,0.05)", border=`1px solid ${T.border}`, c=T.ink;
            if (answered) {
              if (i === q.answer) { bg="rgba(26,122,94,0.12)"; border="1.5px solid #1A7A5E"; c="#1A7A5E"; }
              else if (i === answers[q.id]) { bg="rgba(184,59,42,0.10)"; border="1.5px solid #B83B2A"; c="#B83B2A"; }
            }
            return <button key={i} onClick={()=>{ if(!answered){ setAnswers(p=>({...p,[q.id]:i})); setShowExp(true); }}} style={{ background:bg,border,borderRadius:11,padding:"12px 16px",cursor:answered?"default":"pointer",textAlign:"left",color:c||T.ink,fontSize:13,display:"flex",alignItems:"center",gap:10 }}>
              <span style={{ width:26,height:26,borderRadius:7,background:T.bg3,display:"flex",alignItems:"center",justifyContent:"center",fontSize:11,fontWeight:700,flexShrink:0,color:"#8C7B6E" }}>{["A","B","C","D"][i]}</span>
              {opt}
              {answered && i===q.answer && <span style={{ marginLeft:"auto" }}>✓</span>}
              {answered && i===answers[q.id] && i!==q.answer && <span style={{ marginLeft:"auto" }}>✗</span>}
            </button>;
          })}
        </div>
        {showExp && <div style={{ background:correct?"rgba(26,122,94,0.10)":"rgba(184,59,42,0.08)", border:`1px solid ${correct?"rgba(26,122,94,0.35)":"rgba(184,59,42,0.30)"}`, borderRadius:12, padding:16, marginBottom:16 }}>
          <div style={{ fontWeight:700, marginBottom:6, color:correct?"#1A7A5E":"#B83B2A", fontSize:13 }}>{correct?"✅ Correct!":"❌ Incorrect"}</div>
          <p style={{ color:T.ink2, fontSize:13, lineHeight:1.7, margin:0 }}>💡 {(q.explanation || "No explanation provided.").replace(/\*\*/g,"").replace(/^#+\s*/gm,"").replace(/`/g,"")}</p>
        </div>}
        {answered && <button onClick={next} style={{ ...S.btn("#1A7A5E"), width:"100%", padding:13 }}>{cur<questions.length-1?"Next →":"🏁 Finish Study Session"}</button>}
      </div>
    </div>
  );
}

function ExamScreen({ questions, onFinish, timeMins, onHome }) {
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
  const timerColor = timePct > 0.25 ? "#1A7A5E" : timePct > 0.1 ? "#C47A1E" : "#B83B2A";

  const q = questions[cur];
  const answered = answers[q.id] !== undefined;
  const col = SC[q.section] || { accent:"#2B5FA6", bg:T.bg };
  const diffCol = { "سهل":"#1A7A5E", "متوسط":"#C47A1E", "صعب":"#B83B2A" };
  const next = () => { if (cur < questions.length-1) setCur(p=>p+1); else onFinish(answers); };

  return (
    <div style={{ minHeight:"100vh", background:T.bg, fontFamily:"system-ui,sans-serif", color:"#1C1814" }}>
      <div style={{ background:col.bg, borderBottom:`1px solid ${col.accent}44`, padding:"11px 22px", display:"flex", justifyContent:"space-between", alignItems:"center" }}>
        <div style={{ display:"flex", alignItems:"center", gap:8 }}>
          <button onClick={()=>{ if(window.confirm("هل تريد الخروج؟ سيتم إلغاء الاختبار الحالي.")) onHome(); }} style={{ background:"rgba(140,110,80,0.12)", border:"none", borderRadius:8, padding:"5px 12px", color:"#8C7B6E", cursor:"pointer", fontSize:12 }}>🏠 Home</button>
          <span style={{ color:"#8C7B6E", fontSize:13 }}>🎯 محاكي الاختبار · {cur+1}/{questions.length}</span>
        </div>
        <div style={{ display:"flex", alignItems:"center", gap:6, background:"rgba(0,0,0,0.3)", borderRadius:8, padding:"5px 12px" }}>
          <span style={{ fontSize:14 }}>⏱️</span>
          <span style={{ color:timerColor, fontWeight:800, fontSize:15, fontFamily:"monospace" }}>{timeStr}</span>
        </div>
        <span style={{ color:diffCol[q.difficulty], fontWeight:700, fontSize:13 }}>{q.difficulty}</span>
      </div>
      <div style={{ height:4, background:T.bg3 }}><div style={{ width:`${((cur+1)/questions.length)*100}%`, height:"100%", background:col.accent, transition:"width 0.3s" }} /></div>
      <div style={{ height:3, background:T.surface }}><div style={{ width:`${timePct*100}%`, height:"100%", background:timerColor, transition:"width 1s linear" }} /></div>
      <div style={{ maxWidth:700, margin:"0 auto", padding:22 }}>
        <div style={{ color:col.accent, fontSize:10, fontWeight:700, marginBottom:8, textTransform:"uppercase", letterSpacing:1 }}>{q.section} · {q.category}</div>
        <div style={{ ...S.card, border:`1px solid ${col.accent}33`, marginBottom:18 }}><p style={{ fontSize:16, lineHeight:1.7, margin:0, fontWeight:500 }}>{q.question}</p></div>
        <div style={{ display:"flex", flexDirection:"column", gap:9, marginBottom:18 }}>
          {q.options.map((opt,i) => {
            const selected = answers[q.id] === i;
            return <button key={i} onClick={()=>setAnswers(p=>({...p,[q.id]:i}))} style={{ background:selected?"rgba(59,130,246,0.15)":"rgba(140,110,80,0.05)", border:selected?`1.5px solid ${col.accent}`:`1px solid ${T.border}`, borderRadius:11, padding:"12px 16px", cursor:"pointer", textAlign:"left", color:selected?"#2B5FA6":T.ink, fontSize:13, display:"flex", alignItems:"center", gap:10 }}>
              <span style={{ width:26,height:26,borderRadius:7,background:selected?col.accent+"33":"rgba(140,110,80,0.10)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:11,fontWeight:700,flexShrink:0,color:selected?col.accent:"#8C7B6E" }}>{["A","B","C","D"][i]}</span>
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
  const grade=score>=85?{label:"Excellent",color:"#1A7A5E",emoji:"🏆"}:score>=70?{label:"Good",color:"#2B5FA6",emoji:"🎯"}:score>=60?{label:"Pass",color:"#C47A1E",emoji:"📈"}:{label:"Needs Review",color:"#B83B2A",emoji:"📚"};
  const circ=2*Math.PI*52;
  const bySection=SECTIONS.reduce((acc,sec)=>{ const qs=questions.filter(q=>q.section===sec); if(!qs.length) return acc; const c=qs.filter(q=>answers[q.id]===q.answer).length; acc[sec]={total:qs.length,correct:c,pct:Math.round(c/qs.length*100)}; return acc; },{});
  const isExam = mode === "exam" || !mode;
  return (
    <div style={{ minHeight:"100vh", background:T.bg, fontFamily:"system-ui,sans-serif", color:"#1C1814", padding:24 }}>
      <div style={{ maxWidth:600, margin:"0 auto" }}>
        <h2 style={{ textAlign:"center", fontSize:22, fontWeight:800, marginBottom:4 }}>{isExam ? "🎯 Exam Complete!" : "📚 Study Session Complete!"}</h2>
        {userName&&<p style={{ textAlign:"center", color:"#8C7B6E", marginBottom:20 }}>Great effort, {userName}!</p>}
        <div style={{ display:"flex", justifyContent:"center", marginBottom:20 }}>
          <div style={{ ...S.card, textAlign:"center", minWidth:260 }}>
            <svg width="110" height="110" viewBox="0 0 120 120" style={{ marginBottom:10 }}>
              <circle cx="60" cy="60" r="52" fill="none" stroke="rgba(140,110,80,0.10)" strokeWidth="10"/>
              <circle cx="60" cy="60" r="52" fill="none" stroke={grade.color} strokeWidth="10" strokeDasharray={circ} strokeDashoffset={circ-(score/100)*circ} strokeLinecap="round" transform="rotate(-90 60 60)"/>
              <text x="60" y="55" textAnchor="middle" fill={grade.color} fontSize="24" fontWeight="800">{score}%</text>
              <text x="60" y="73" textAnchor="middle" fill="#8C7B6E" fontSize="10">{grade.emoji} {grade.label}</text>
            </svg>
            <div style={{ display:"flex", gap:16, justifyContent:"center" }}>
              {[["✅",correct,"Correct"],["❌",questions.length-correct,"Wrong"],["⬜",questions.length-Object.keys(answers).length,"Skipped"]].map(([e,n,l])=><div key={l}><div style={{ fontSize:18, fontWeight:800 }}>{n}</div><div style={{ color:"#8C7B6E", fontSize:12 }}>{e} {l}</div></div>)}
            </div>
          </div>
        </div>
        {Object.keys(bySection).length>1 && (
          <div style={{ ...S.card, marginBottom:16 }}>
            <div style={{ fontWeight:700, marginBottom:12, fontSize:14 }}>Performance by Section</div>
            {Object.entries(bySection).map(([sec,{total,correct:c,pct}])=>{
              const col=SC[sec]||{accent:"#2B5FA6"};
              const short=sec==="Social/Behavioral/Administrative Sciences"?"Social/Admin":sec.split(" ")[0];
              return <div key={sec} style={{ marginBottom:10 }}>
                <div style={{ display:"flex", justifyContent:"space-between", fontSize:12, marginBottom:4 }}><span style={{ color:T.ink2 }}>{short}</span><span style={{ color:col.accent, fontWeight:700 }}>{c}/{total} ({pct}%)</span></div>
                <div style={{ height:6, background:T.bg3, borderRadius:3 }}><div style={{ width:`${pct}%`, height:"100%", borderRadius:3, background:col.accent }} /></div>
              </div>;
            })}
          </div>
        )}
        <div style={{ display:"flex", gap:10 }}>
          <button onClick={onHome} style={{ flex:1, ...S.ghost, padding:13, fontSize:14 }}>🏠 Dashboard</button>
          <button onClick={onRetry} style={{ flex:1, ...S.btn(isExam?"#B83B2A":"#1A7A5E"), padding:13 }}>🔄 {isExam?"New Exam":"New Study Session"}</button>
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
