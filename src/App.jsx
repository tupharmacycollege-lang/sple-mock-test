import { useState, useEffect } from "react";

const API_URL = "https://y0ww5f6rnf.execute-api.eu-north-1.amazonaws.com/prod";

const DB = {
  getUsers: () => JSON.parse(localStorage.getItem("sple_users") || "[]"),
  saveUsers: (u) => localStorage.setItem("sple_users", JSON.stringify(u)),
  getResults: () => JSON.parse(localStorage.getItem("sple_results") || "[]"),
  saveResults: (r) => localStorage.setItem("sple_results", JSON.stringify(r)),
  getQuestions: () => { const s = localStorage.getItem("sple_questions"); return s ? JSON.parse(s) : DEFAULT_QUESTIONS; },
  saveQuestions: (q) => localStorage.setItem("sple_questions", JSON.stringify(q)),
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

// ===================== AI GENERATOR =====================
function AIGenerator({ questions, onAddQuestions }) {
  const [mode, setMode] = useState("balanced"); // balanced | custom
  const [customSection, setCustomSection] = useState("Pharmaceutical Sciences");
  const [customSub, setCustomSub] = useState("Pharmacology & Toxicology");
  const [difficulty, setDifficulty] = useState("متوسط");
  const [totalCount, setTotalCount] = useState(10);
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState("");
  const [generated, setGenerated] = useState([]);
  const [selected, setSelected] = useState([]);
  const [err, setErr] = useState("");
  const diffCol = {"سهل":"#22c55e","متوسط":"#f59e0b","صعب":"#ef4444"};

  // Calculate balanced distribution
  const getBalancedPlan = (count) => {
    return SECTIONS.map(sec => {
      const bp = BLUEPRINT[sec];
      const n = Math.max(1, Math.round(count * bp.pct / 100));
      const sub = bp.sub[Math.floor(Math.random() * bp.sub.length)];
      return { section:sec, subcategory:sub, n };
    });
  };

  const callClaude = async (section, subcategory, count, diff) => {
    const bp = BLUEPRINT[section];
    const prompt = `You are an expert pharmacist exam question writer for the Saudi Pharmacist Licensure Examination (SPLE) by SCHS.

Generate exactly ${count} high-quality multiple-choice questions:
- Section: ${section} (${bp.pct}% of SPLE)
- Subcategory: ${subcategory}
- Difficulty: ${diff==="سهل"?"Easy (recall-based factual)":diff==="متوسط"?"Medium (mechanism/pathophysiology-based)":"Hard (clinical scenarios, complex interactions, calculations)"}

Rules:
- Relevant to Saudi pharmacy practice and SCHS standards
- Exactly 4 options, ONE correct answer
- answer is 0-indexed (0=A, 1=B, 2=C, 3=D)
- Detailed explanation for the correct answer

Respond ONLY with a JSON array, no markdown:
[{"question":"...","options":["A","B","C","D"],"answer":0,"explanation":"..."}]`;

    const res = await fetch(`${API_URL}/generate`, {
      method:"POST",
      headers:{ "Content-Type":"application/json" },
      body: JSON.stringify({ section, subcategory, count, difficulty })
    });
    const data = await res.json();
    if (data.error) throw new Error(data.error);
    return data.questions;
  };

  const generate = async () => {
    setLoading(true); setErr(""); setGenerated([]); setSelected([]);

    try {
      let allQuestions = [];

      if (mode === "balanced") {
        const plan = getBalancedPlan(totalCount);
        for (const item of plan) {
          setProgress(`Generating ${item.n} questions for ${item.section.split(" ")[0]}...`);
          const qs = await callClaude(item.section, item.subcategory, item.n, difficulty);
          allQuestions = [...allQuestions, ...qs.map((q,i) => ({ id:"ai_"+Date.now()+"_"+Math.random(), section:item.section, category:item.subcategory, difficulty, question:q.question, options:q.options, answer:q.answer, explanation:q.explanation }))];
        }
      } else {
        setProgress(`Generating questions for ${customSection.split(" ")[0]}...`);
        const qs = await callClaude(customSection, customSub, totalCount, difficulty);
        allQuestions = qs.map((q,i) => ({ id:"ai_"+Date.now()+"_"+i, section:customSection, category:customSub, difficulty, question:q.question, options:q.options, answer:q.answer, explanation:q.explanation }));
      }

      setGenerated(allQuestions);
      setSelected(allQuestions.map(q=>q.id));
      setProgress("");
    } catch(e) {
      setErr(e.message || "Generation failed. Check your API key and try again.");
      setProgress("");
    } finally { setLoading(false); }
  };

  const handleAdd = () => { onAddQuestions(generated.filter(q=>selected.includes(q.id))); setGenerated([]); setSelected([]); };

  // Balanced preview
  const balancedPreview = getBalancedPlan(totalCount);

  return (
    <div>
      <div style={{ marginBottom:20 }}>
        <h1 style={{ fontSize:22, fontWeight:800, margin:"0 0 4px" }}>🤖 AI Question Generator</h1>
        <p style={{ color:"#64748b", margin:0 }}>Auto-generate balanced SPLE questions using Claude AI based on the official SCHS blueprint</p>
      </div>

      {/* Mode selector */}
      <div style={{ display:"flex", background:"rgba(255,255,255,0.04)", borderRadius:12, padding:4, marginBottom:16 }}>
        <button onClick={()=>setMode("balanced")} style={{ flex:1, padding:"10px", borderRadius:10, border:"none", cursor:"pointer", fontWeight:700, fontSize:14, background:mode==="balanced"?"linear-gradient(135deg,#3b82f6,#6366f1)":"transparent", color:mode==="balanced"?"#fff":"#64748b" }}>
          ⚖️ Balanced (All Sections)
        </button>
        <button onClick={()=>setMode("custom")} style={{ flex:1, padding:"10px", borderRadius:10, border:"none", cursor:"pointer", fontWeight:700, fontSize:14, background:mode==="custom"?"linear-gradient(135deg,#10b981,#059669)":"transparent", color:mode==="custom"?"#fff":"#64748b" }}>
          🎯 Custom Section
        </button>
      </div>

      <div style={{ ...S.card, marginBottom:16 }}>
        {mode==="balanced" ? (
          <div>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:14 }}>
              <div>
                <div style={{ fontWeight:700, marginBottom:2 }}>Balanced Generation</div>
                <div style={{ color:"#64748b", fontSize:12 }}>Questions distributed by blueprint percentages across all 4 sections</div>
              </div>
              <div style={{ textAlign:"right" }}>
                <div style={{ fontSize:22, fontWeight:800, color:"#3b82f6" }}>{totalCount}</div>
                <div style={{ color:"#64748b", fontSize:11 }}>total</div>
              </div>
            </div>
            <input type="range" min={4} max={40} value={totalCount} onChange={e=>setTotalCount(+e.target.value)} style={{ width:"100%", accentColor:"#3b82f6", marginBottom:12 }} />
            {/* Preview */}
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:8, marginBottom:14 }}>
              {SECTIONS.map(sec => {
                const bp = BLUEPRINT[sec]; const n = Math.max(1,Math.round(totalCount*bp.pct/100));
                const short = sec==="Social/Behavioral/Administrative Sciences"?"Social/Admin":sec.split(" ")[0];
                return (
                  <div key={sec} style={{ background:bp.color+"11", border:`1px solid ${bp.color}33`, borderRadius:10, padding:"8px 12px", display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                    <span style={{ color:"#94a3b8", fontSize:12 }}>{short}</span>
                    <span style={{ color:bp.color, fontWeight:800 }}>~{n} q</span>
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12, marginBottom:14 }}>
            <div>
              <label style={S.label}>Section</label>
              <select style={S.input} value={customSection} onChange={e=>{ setCustomSection(e.target.value); setCustomSub(BLUEPRINT[e.target.value].sub[0]); }}>
                {SECTIONS.map(s=><option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div>
              <label style={S.label}>Subcategory</label>
              <select style={S.input} value={customSub} onChange={e=>setCustomSub(e.target.value)}>
                {BLUEPRINT[customSection].sub.map(s=><option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div>
              <label style={S.label}>Questions: <span style={{ color:"#10b981", fontWeight:800 }}>{totalCount}</span></label>
              <input type="range" min={1} max={10} value={totalCount} onChange={e=>setTotalCount(+e.target.value)} style={{ width:"100%", accentColor:"#10b981", marginTop:8 }} />
            </div>
          </div>
        )}

        {/* Difficulty */}
        <div style={{ marginBottom:14 }}>
          <label style={S.label}>Difficulty Level</label>
          <div style={{ display:"flex", gap:8 }}>
            {DIFFICULTIES.map(d=><button key={d} onClick={()=>setDifficulty(d)} style={{ flex:1, padding:10, borderRadius:8, border:`2px solid ${difficulty===d?diffCol[d]:"rgba(255,255,255,0.1)"}`, cursor:"pointer", fontWeight:700, fontSize:13, background:difficulty===d?diffCol[d]+"22":"transparent", color:difficulty===d?diffCol[d]:"#64748b" }}>{d}</button>)}
          </div>
        </div>

        <button onClick={generate} disabled={loading} style={{ ...S.btn(mode==="balanced"?"#3b82f6":"#10b981"), width:"100%", padding:13, fontSize:15, opacity:loading?0.7:1 }}>
          {loading ? `⏳ ${progress||"Generating..."}` : `✨ Generate ${totalCount} ${mode==="balanced"?"Balanced ":""}AI Questions`}
        </button>
      </div>

      {err && <div style={{ background:"rgba(239,68,68,0.1)", border:"1px solid rgba(239,68,68,0.3)", borderRadius:12, padding:14, marginBottom:16, color:"#fca5a5", fontSize:13 }}>⚠️ {err}</div>}

      {generated.length > 0 && (
        <div>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:14 }}>
            <div><div style={{ fontWeight:700 }}>Review Generated Questions</div><div style={{ color:"#64748b", fontSize:12 }}>{selected.length}/{generated.length} selected</div></div>
            <div style={{ display:"flex", gap:8 }}>
              <button onClick={()=>setSelected(generated.map(q=>q.id))} style={{ ...S.ghost, padding:"7px 12px", fontSize:12 }}>All</button>
              <button onClick={()=>setSelected([])} style={{ ...S.ghost, padding:"7px 12px", fontSize:12 }}>None</button>
            </div>
          </div>
          <div style={{ display:"flex", flexDirection:"column", gap:10, marginBottom:16 }}>
            {generated.map((q,idx) => {
              const on = selected.includes(q.id); const col = SC[q.section]||{accent:"#3b82f6"};
              return (
                <div key={q.id} onClick={()=>setSelected(p=>p.includes(q.id)?p.filter(x=>x!==q.id):[...p,q.id])} style={{ ...S.card, cursor:"pointer", border:`1.5px solid ${on?col.accent:"rgba(255,255,255,0.08)"}`, background:on?col.accent+"08":"rgba(255,255,255,0.03)", padding:14 }}>
                  <div style={{ display:"flex", gap:8, marginBottom:8, alignItems:"center" }}>
                    <div style={{ width:16, height:16, borderRadius:4, border:`2px solid ${on?col.accent:"rgba(255,255,255,0.2)"}`, background:on?col.accent:"transparent", display:"flex", alignItems:"center", justifyContent:"center", fontSize:10, color:"#fff", flexShrink:0 }}>{on&&"✓"}</div>
                    <span style={{ color:"#475569", fontSize:11 }}>Q{idx+1}</span>
                    <span style={S.tag(col.accent)}>{q.section.split(" ")[0]}</span>
                    <span style={S.tag(diffCol[q.difficulty])}>{q.difficulty}</span>
                    <span style={{ color:"#475569", fontSize:11 }}>{q.category}</span>
                  </div>
                  <p style={{ color:"#e2e8f0", fontSize:13, margin:"0 0 8px", lineHeight:1.6 }}>{q.question}</p>
                  <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:5, marginBottom:8 }}>
                    {q.options.map((opt,i)=><div key={i} style={{ background:i===q.answer?"rgba(34,197,94,0.1)":"rgba(255,255,255,0.04)", border:`1px solid ${i===q.answer?"rgba(34,197,94,0.3)":"rgba(255,255,255,0.06)"}`, borderRadius:7, padding:"5px 8px", fontSize:11, color:i===q.answer?"#86efac":"#94a3b8" }}><strong>{["A","B","C","D"][i]}.</strong> {opt}</div>)}
                  </div>
                  <div style={{ background:"rgba(255,255,255,0.04)", borderRadius:7, padding:"6px 10px" }}>
                    <span style={{ color:"#64748b", fontSize:11 }}>💡 </span><span style={{ color:"#94a3b8", fontSize:11 }}>{q.explanation}</span>
                  </div>
                </div>
              );
            })}
          </div>
          <button onClick={handleAdd} disabled={selected.length===0} style={{ ...S.btn("#10b981"), width:"100%", padding:13, fontSize:15, opacity:selected.length===0?0.5:1 }}>
            ✅ Add {selected.length} Questions to Question Bank
          </button>
        </div>
      )}
    </div>
  );
}

// ===================== ADMIN QUESTIONS =====================

const sectionColors2 = { "Basic Biomedical Sciences":{accent:"#3b82f6"}, "Pharmaceutical Sciences":{accent:"#10b981"}, "Social/Behavioral/Administrative Sciences":{accent:"#8b5cf6"}, "Clinical Sciences":{accent:"#ef4444"} };

function ExcelImport({ onImport }) {
  const [importing, setImporting] = useState(false);
  const [preview, setPreview] = useState([]);
  const [err, setErr] = useState("");
  const [success, setSuccess] = useState("");
  const diffCol = {"\u0633\u0647\u0644":"#22c55e","\u0645\u062a\u0648\u0633\u0637":"#f59e0b","\u0635\u0639\u0628":"#ef4444"};

  const handleFile = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setImporting(true); setErr(""); setPreview([]); setSuccess("");
    try {
      const text = await file.text();
      const lines = text.split("\n").filter(l => l.trim());
      const headers = lines[0].split(",").map(h => h.trim().replace(/"/g,""));
      const mapped = lines.slice(1).map((line, i) => {
        const cols = line.split(",").map(c => c.trim().replace(/"/g,""));
        const row = {};
        headers.forEach((h, idx) => { row[h] = cols[idx] || ""; });
        if (!row.question || !row.option_a) return null;
        return {
          id: "xl_" + Date.now() + "_" + i,
          section: row.section || "Pharmaceutical Sciences",
          category: row.category || "General",
          difficulty: row.difficulty || "متوسط",
          question: row.question,
          options: [row.option_a, row.option_b, row.option_c, row.option_d],
          answer: parseInt(row.correct_answer) || 0,
          explanation: row.explanation || "",
        };
      }).filter(Boolean);
      if (mapped.length === 0) { setErr("No valid questions found. Use CSV format with correct column names."); setImporting(false); return; }
      setPreview(mapped);
    } catch(e) { setErr("Error: " + e.message); }
    setImporting(false);
  };

  const confirmImport = () => { onImport(preview); setSuccess("\u2705 Imported " + preview.length + " questions successfully!"); setPreview([]); };

  return (
    <div style={{ ...S.card, marginBottom:16, border:"1px solid rgba(16,185,129,0.3)", background:"rgba(16,185,129,0.04)" }}>
      <div style={{ fontWeight:700, fontSize:15, marginBottom:10 }}>📊 Import from CSV</div>
      <div style={{ display:"flex", gap:10, marginBottom:12, alignItems:"center" }}>
        <label style={{ ...S.btn("#10b981"), padding:"10px 16px", cursor:"pointer", fontSize:13 }}>
          {importing ? "⏳ Reading..." : "📂 Choose .csv File"}
          <input type="file" accept=".csv" onChange={handleFile} style={{ display:"none" }} />
        </label>
        <span style={{ color:"#64748b", fontSize:12 }}>CSV columns: section, category, difficulty, question, option_a, option_b, option_c, option_d, correct_answer (0-3), explanation</span>
      </div>
      {err && <div style={{ background:"rgba(239,68,68,0.1)", border:"1px solid rgba(239,68,68,0.3)", borderRadius:8, padding:"10px 14px", color:"#fca5a5", fontSize:13, marginBottom:10 }}>\u26a0\ufe0f {err}</div>}
      {success && <div style={{ background:"rgba(34,197,94,0.1)", border:"1px solid rgba(34,197,94,0.3)", borderRadius:8, padding:"10px 14px", color:"#86efac", fontSize:13, marginBottom:10 }}>{success}</div>}
      {preview.length > 0 && (
        <div>
          <div style={{ fontWeight:700, marginBottom:8, color:"#10b981", fontSize:13 }}>Preview: {preview.length} questions found</div>
          <div style={{ maxHeight:200, overflowY:"auto", marginBottom:10, display:"flex", flexDirection:"column", gap:5 }}>
            {preview.slice(0,4).map((q,i) => (
              <div key={i} style={{ background:"rgba(255,255,255,0.04)", borderRadius:8, padding:"8px 12px", fontSize:12 }}>
                <div style={{ display:"flex", gap:5, marginBottom:3 }}>
                  <span style={S.tag((sectionColors2[q.section]||{accent:"#3b82f6"}).accent)}>{q.section.split(" ")[0]}</span>
                  <span style={S.tag(diffCol[q.difficulty]||"#f59e0b")}>{q.difficulty}</span>
                </div>
                <div style={{ color:"#e2e8f0" }}>{q.question.substring(0,90)}{q.question.length>90?"...":""}</div>
              </div>
            ))}
            {preview.length > 4 && <div style={{ color:"#64748b", fontSize:11, textAlign:"center" }}>+{preview.length-4} more...</div>}
          </div>
          <div style={{ display:"flex", gap:8 }}>
            <button onClick={confirmImport} style={{ ...S.btn("#10b981"), flex:1, padding:11 }}>\u2705 Add {preview.length} Questions to Bank</button>
            <button onClick={()=>setPreview([])} style={{ ...S.ghost, padding:11 }}>Cancel</button>
          </div>
        </div>
      )}
    </div>
  );
}

function AdminQuestions({ questions, onChange }) {
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ section:SECTIONS[0], category:"", difficulty:"متوسط", question:"", options:["","","",""], answer:0, explanation:"" });
  const [search, setSearch] = useState("");
  const [filterSec, setFilterSec] = useState("All");
  const [showImport, setShowImport] = useState(true);
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
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:16 }}>
        <div><h2 style={{ margin:0, fontSize:18, fontWeight:700 }}>All Questions</h2><span style={{ color:"#64748b", fontSize:13 }}>{filtered.length} shown</span></div>
        <button style={{ ...S.btn("#10b981"), width:"auto" }} onClick={()=>{ reset(); setEditing(null); setShowForm(true); }}>+ Add</button>
      </div>

      {showForm && (
        <div style={{ ...S.card, marginBottom:16, border:"1px solid rgba(16,185,129,0.3)" }}>
          <div style={{ fontWeight:700, marginBottom:14 }}>{editing?"Edit Question":"New Question"}</div>
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10, marginBottom:10 }}>
            <div><label style={S.label}>Section</label><select style={S.input} value={form.section} onChange={e=>setForm({...form,section:e.target.value})}>{SECTIONS.map(s=><option key={s}>{s}</option>)}</select></div>
            <div><label style={S.label}>Category</label><input style={S.input} value={form.category} onChange={e=>setForm({...form,category:e.target.value})} placeholder="Pharmacology" /></div>
            <div><label style={S.label}>Difficulty</label><select style={S.input} value={form.difficulty} onChange={e=>setForm({...form,difficulty:e.target.value})}>{DIFFICULTIES.map(d=><option key={d}>{d}</option>)}</select></div>
          </div>
          <div style={{ marginBottom:10 }}><label style={S.label}>Question</label><textarea style={{ ...S.input, minHeight:70, resize:"vertical" }} value={form.question} onChange={e=>setForm({...form,question:e.target.value})} /></div>
          <div style={{ marginBottom:10 }}>
            <label style={S.label}>Options (click radio = correct answer)</label>
            {form.options.map((opt,i)=>(
              <div key={i} style={{ display:"flex", gap:8, marginBottom:6, alignItems:"center" }}>
                <input type="radio" checked={form.answer===i} onChange={()=>setForm({...form,answer:i})} style={{ accentColor:"#10b981" }} />
                <input style={{ ...S.input, flex:1 }} value={opt} onChange={e=>{ const o=[...form.options]; o[i]=e.target.value; setForm({...form,options:o}); }} placeholder={`Option ${["A","B","C","D"][i]}`} />
              </div>
            ))}
          </div>
          <div style={{ marginBottom:14 }}><label style={S.label}>Explanation</label><textarea style={{ ...S.input, minHeight:55, resize:"vertical" }} value={form.explanation} onChange={e=>setForm({...form,explanation:e.target.value})} /></div>
          <div style={{ display:"flex", gap:8 }}>
            <button style={S.btn("#10b981")} onClick={save}>💾 Save</button>
            <button style={{ ...S.ghost, flex:1 }} onClick={()=>{ setShowForm(false); setEditing(null); reset(); }}>Cancel</button>
          </div>
        </div>
      )}

      <div style={{ display:"flex", gap:8, marginBottom:10, flexWrap:"wrap" }}>
        {["All",...SECTIONS].map(s=>{
          const bp = s!=="All"?BLUEPRINT[s]:null; const on=filterSec===s;
          return <button key={s} onClick={()=>setFilterSec(s)} style={{ padding:"5px 12px", borderRadius:20, border:`1.5px solid ${on&&bp?bp.color:on?"#3b82f6":"rgba(255,255,255,0.15)"}`, cursor:"pointer", fontSize:11, fontWeight:600, background:on&&bp?bp.color+"22":on?"#3b82f644":"transparent", color:on&&bp?bp.color:on?"#60a5fa":"#94a3b8" }}>{s==="All"?"All":s==="Social/Behavioral/Administrative Sciences"?"Social/Admin":s.split(" ")[0]}</button>;
        })}
      </div>
      <input style={{ ...S.input, marginBottom:12 }} value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search questions..." />

      <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
        {filtered.map(q=>{
          const col=SC[q.section]||{accent:"#3b82f6"};
          return (
            <div key={q.id} style={{ ...S.card, padding:"12px 16px" }}>
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", gap:10 }}>
                <div style={{ flex:1 }}>
                  <div style={{ display:"flex", gap:5, marginBottom:6, flexWrap:"wrap" }}>
                    <span style={S.tag(col.accent)}>{q.section.split(" ")[0]}</span>
                    <span style={S.tag("#94a3b8")}>{q.category}</span>
                    <span style={S.tag(diffCol[q.difficulty])}>{q.difficulty}</span>
                    {q.id?.startsWith("ai_")&&<span style={S.tag("#f59e0b")}>🤖 AI</span>}
                  </div>
                  <p style={{ color:"#e2e8f0", fontSize:13, margin:0 }}>{q.question}</p>
                </div>
                <div style={{ display:"flex", gap:6, flexShrink:0 }}>
                  <button onClick={()=>{ setForm({...q,options:[...q.options]}); setEditing(q.id); setShowForm(true); }} style={{ ...S.ghost, padding:"5px 10px" }}>✏️</button>
                  <button onClick={()=>{ if(window.confirm("Delete?")) onChange(questions.filter(x=>x.id!==q.id)); }} style={{ ...S.ghost, padding:"5px 10px", color:"#fca5a5" }}>🗑️</button>
                </div>
              </div>
            </div>
          );
        })}
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

// ===================== ADMIN DASHBOARD =====================
function AdminDashboard({ user, onLogout }) {
  const [tab, setTab] = useState("overview");
  const [questions, setQuestions] = useState(DB.getQuestions());
  const [users, setUsers] = useState(DB.getUsers());
  const [results] = useState(DB.getResults());
  const saveQ = q => { DB.saveQuestions(q); setQuestions(q); };
  const saveU = u => { DB.saveUsers(u); setUsers(u); };
  const TABS = [{id:"overview",icon:"📊",label:"Overview"},{id:"ai",icon:"🤖",label:"AI Generator",badge:"NEW"},{id:"questions",icon:"❓",label:"Questions"},{id:"students",icon:"🎓",label:"Students"},{id:"reports",icon:"📈",label:"Reports"}];

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
        {tab==="ai" && <AIGenerator questions={questions} onAddQuestions={qs=>{ const u=[...questions,...qs]; saveQ(u); setTab("questions"); }} />}
        {tab==="questions" && <AdminQuestions questions={questions} onChange={saveQ} />}
        {tab==="students" && <AdminStudents users={users} onChange={saveU} />}
        {tab==="reports" && <AdminReports users={users} results={results} />}
      </div>
    </div>
  );
}

// ===================== STUDENT =====================
function StudentDashboard({ user, onLogout }) {
  const [screen, setScreen] = useState("home");
  const [examQ, setExamQ] = useState([]);
  const [examA, setExamA] = useState({});
  const [myResults, setMyResults] = useState(DB.getResults().filter(r=>r.userId===user.id));
  const questions = DB.getQuestions();
  const shuffle = arr=>[...arr].sort(()=>Math.random()-0.5);
  const startExam = n=>{ setExamQ(shuffle(questions).slice(0,Math.min(n,questions.length))); setScreen("exam"); };
  const finishExam = answers=>{
    const correct=examQ.filter(q=>answers[q.id]===q.answer).length;
    const score=Math.round((correct/examQ.length)*100);
    const result={userId:user.id,userName:user.name,date:new Date().toLocaleDateString(),score,correct,total:examQ.length};
    const all=[...DB.getResults(),result]; DB.saveResults(all);
    setMyResults(all.filter(r=>r.userId===user.id)); setExamA(answers); setScreen("results");
  };
  if(screen==="exam") return <ExamScreen questions={examQ} onFinish={finishExam} />;
  if(screen==="results") return <ResultsScreen questions={examQ} answers={examA} onRetry={()=>setScreen("home")} onHome={()=>setScreen("home")} userName={user.name} />;
  const avg=myResults.length?Math.round(myResults.reduce((a,r)=>a+r.score,0)/myResults.length):0;
  const best=myResults.length?Math.max(...myResults.map(r=>r.score)):0;
  return (
    <div style={{ minHeight:"100vh", background:"#0f172a", fontFamily:"system-ui,sans-serif", color:"#f1f5f9" }}>
      <div style={{ background:"rgba(255,255,255,0.03)", borderBottom:"1px solid rgba(255,255,255,0.08)", padding:"12px 24px", display:"flex", justifyContent:"space-between", alignItems:"center" }}>
        <div style={{ display:"flex", alignItems:"center", gap:10 }}><span style={{ fontSize:20 }}>💊</span><div><div style={{ fontWeight:800 }}>SPLE Platform</div><div style={{ color:"#64748b", fontSize:11 }}>Student Portal</div></div></div>
        <div style={{ display:"flex", alignItems:"center", gap:10 }}>
          <div style={{ textAlign:"right" }}><div style={{ fontWeight:700, fontSize:13 }}>{user.name}</div><div style={{ color:"#64748b", fontSize:11 }}>{user.university||user.email}</div></div>
          <button onClick={onLogout} style={{ ...S.ghost, padding:"7px 12px" }}>Logout</button>
        </div>
      </div>
      <div style={{ maxWidth:680, margin:"0 auto", padding:24 }}>
        <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:14, marginBottom:24 }}>
          {[["📝",myResults.length,"Exams Taken","#3b82f6"],["📊",`${avg}%`,"Average Score","#10b981"],["🏆",`${best}%`,"Best Score","#f59e0b"]].map(([icon,val,label,color])=>(
            <div key={label} style={{ background:"rgba(255,255,255,0.04)", border:`1px solid ${color}33`, borderRadius:14, padding:18 }}><div style={{ fontSize:22 }}>{icon}</div><div style={{ fontSize:26, fontWeight:800, color, marginTop:6 }}>{val}</div><div style={{ color:"#64748b", fontSize:12 }}>{label}</div></div>
          ))}
        </div>
        <div style={{ ...S.card, marginBottom:20, border:"1px solid rgba(59,130,246,0.3)" }}>
          <div style={{ fontWeight:700, marginBottom:4 }}>Start New Exam</div>
          <p style={{ color:"#64748b", fontSize:13, marginBottom:16 }}>{questions.length} questions available · All SPLE content areas</p>
          <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:10 }}>
            {[10,20,questions.length].map(n=>(
              <button key={n} onClick={()=>startExam(n)} style={{ ...S.btn("#3b82f6"), padding:13 }}>{n>=questions.length?`All (${questions.length})`:`${n} Questions`}</button>
            ))}
          </div>
        </div>
        <div style={S.card}>
          <div style={{ fontWeight:700, marginBottom:14 }}>Exam History</div>
          {myResults.length===0?<p style={{ color:"#475569", textAlign:"center", padding:"16px 0" }}>No exams yet.</p>:(
            <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
              {[...myResults].reverse().map((r,i)=>(
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

function ExamScreen({ questions, onFinish }) {
  const [cur, setCur] = useState(0);
  const [answers, setAnswers] = useState({});
  const [showExp, setShowExp] = useState(false);
  const q=questions[cur]; const answered=answers[q.id]!==undefined; const correct=answers[q.id]===q.answer;
  const col=SC[q.section]||{accent:"#3b82f6",bg:"#1e3a5f"};
  const diffCol={"سهل":"#22c55e","متوسط":"#f59e0b","صعب":"#ef4444"};
  const next=()=>{ setShowExp(false); if(cur<questions.length-1) setCur(p=>p+1); else onFinish(answers); };
  return (
    <div style={{ minHeight:"100vh", background:"#0f172a", fontFamily:"system-ui,sans-serif", color:"#f1f5f9" }}>
      <div style={{ background:col.bg, borderBottom:`1px solid ${col.accent}44`, padding:"11px 22px", display:"flex", justifyContent:"space-between", alignItems:"center" }}>
        <span style={{ color:"#94a3b8", fontSize:13 }}>Q {cur+1}/{questions.length}</span>
        <span style={{ color:diffCol[q.difficulty], fontWeight:700, fontSize:13 }}>{q.difficulty}</span>
      </div>
      <div style={{ height:4, background:"rgba(255,255,255,0.08)" }}><div style={{ width:`${((cur+1)/questions.length)*100}%`, height:"100%", background:col.accent, transition:"width 0.3s" }} /></div>
      <div style={{ maxWidth:700, margin:"0 auto", padding:22 }}>
        <div style={{ color:col.accent, fontSize:10, fontWeight:700, marginBottom:8, textTransform:"uppercase", letterSpacing:1 }}>{q.section} · {q.category}</div>
        <div style={{ ...S.card, border:`1px solid ${col.accent}33`, marginBottom:18 }}><p style={{ fontSize:16, lineHeight:1.7, margin:0, fontWeight:500 }}>{q.question}</p></div>
        <div style={{ display:"flex", flexDirection:"column", gap:9, marginBottom:18 }}>
          {q.options.map((opt,i)=>{
            let bg="rgba(255,255,255,0.04)",border="1px solid rgba(255,255,255,0.1)",c="#e2e8f0";
            if(answered){ if(i===q.answer){bg="rgba(34,197,94,0.12)";border="1.5px solid #22c55e";c="#86efac";} else if(i===answers[q.id]){bg="rgba(239,68,68,0.12)";border="1.5px solid #ef4444";c="#fca5a5";} }
            return <button key={i} onClick={()=>{ if(!answered){ setAnswers(p=>({...p,[q.id]:i})); setShowExp(true); } }} style={{ background:bg,border,borderRadius:11,padding:"12px 16px",cursor:answered?"default":"pointer",textAlign:"left",color:c,fontSize:13,display:"flex",alignItems:"center",gap:10 }}><span style={{ width:26,height:26,borderRadius:7,background:"rgba(255,255,255,0.08)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:11,fontWeight:700,flexShrink:0,color:"#94a3b8" }}>{["A","B","C","D"][i]}</span>{opt}{answered&&i===q.answer&&<span style={{ marginLeft:"auto" }}>✓</span>}{answered&&i===answers[q.id]&&i!==q.answer&&<span style={{ marginLeft:"auto" }}>✗</span>}</button>;
          })}
        </div>
        {showExp && <div style={{ background:correct?"rgba(34,197,94,0.08)":"rgba(239,68,68,0.08)", border:`1px solid ${correct?"rgba(34,197,94,0.3)":"rgba(239,68,68,0.3)"}`, borderRadius:12, padding:16, marginBottom:16 }}><div style={{ fontWeight:700, marginBottom:6, color:correct?"#86efac":"#fca5a5", fontSize:13 }}>{correct?"✅ Correct!":"❌ Incorrect"}</div><p style={{ color:"#cbd5e1", fontSize:13, lineHeight:1.7, margin:0 }}>💡 {q.explanation}</p></div>}
        {answered && <button onClick={next} style={{ ...S.btn(col.accent), width:"100%", padding:13 }}>{cur<questions.length-1?"Next →":"🏁 Finish Exam"}</button>}
      </div>
    </div>
  );
}

function ResultsScreen({ questions, answers, onRetry, onHome, userName }) {
  const correct=questions.filter(q=>answers[q.id]===q.answer).length;
  const score=Math.round((correct/questions.length)*100);
  const grade=score>=85?{label:"Excellent",color:"#22c55e",emoji:"🏆"}:score>=70?{label:"Good",color:"#3b82f6",emoji:"🎯"}:score>=60?{label:"Pass",color:"#f59e0b",emoji:"📈"}:{label:"Needs Review",color:"#ef4444",emoji:"📚"};
  const circ=2*Math.PI*52;
  const bySection=SECTIONS.reduce((acc,sec)=>{ const qs=questions.filter(q=>q.section===sec); if(!qs.length) return acc; const c=qs.filter(q=>answers[q.id]===q.answer).length; acc[sec]={total:qs.length,correct:c,pct:Math.round(c/qs.length*100)}; return acc; },{});
  return (
    <div style={{ minHeight:"100vh", background:"#0f172a", fontFamily:"system-ui,sans-serif", color:"#f1f5f9", padding:24 }}>
      <div style={{ maxWidth:600, margin:"0 auto" }}>
        <h2 style={{ textAlign:"center", fontSize:22, fontWeight:800, marginBottom:4 }}>Exam Complete!</h2>
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
              {[["✅",correct,"Correct"],["❌",questions.length-correct,"Wrong"]].map(([e,n,l])=><div key={l}><div style={{ fontSize:18, fontWeight:800 }}>{n}</div><div style={{ color:"#64748b", fontSize:12 }}>{e} {l}</div></div>)}
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
          <button onClick={onRetry} style={{ flex:1, ...S.btn("#3b82f6"), padding:13 }}>🔄 New Exam</button>
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
