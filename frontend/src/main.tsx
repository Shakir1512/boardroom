import React, { useEffect, useState } from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter, NavLink, Route, Routes, useNavigate } from "react-router-dom";
import { QueryClient, QueryClientProvider, useQuery, useMutation } from "@tanstack/react-query";
import ReactECharts from "echarts-for-react";
import {
  BarChart3, Database, ShieldCheck, Sparkles, FileText, History, LayoutDashboard, Upload, Search,
  LogOut, ChevronDown, Download,
} from "lucide-react";
import "./styles.css";
import "./analysis.css";
import "./chat.css";

const queryClient = new QueryClient();
const API = "";

async function api<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = localStorage.getItem("boardroom_token");
  const response = await fetch(`${API}${path}`, {
    ...options,
    headers: {
      ...(options.body instanceof FormData ? {} : { "Content-Type": "application/json" }),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  });
  if (!response.ok) {
    const body = await response.json().catch(() => ({ detail: response.statusText }));
    throw new Error(body.detail || "Request failed");
  }
  return response.json();
}

type Dataset = { id: string; name: string; file_type: string; row_count: number; status: string; workspace_id: string };
type Workspace = { id: string; name: string; slug: string };
type User = { id: string; email: string; full_name: string; is_superuser: boolean; permissions: string[] };

function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    if (!localStorage.getItem("boardroom_token")) { setLoading(false); return; }
    api<User>("/api/v1/auth/me").then(setUser).catch(() => localStorage.removeItem("boardroom_token")).finally(() => setLoading(false));
  }, []);
  return { user, loading };
}

function Login() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("admin@boardroom.local");
  const [password, setPassword] = useState("admin123");
  const [error, setError] = useState("");
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    try {
      const result = await fetch("/api/v1/auth/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email, password }) }).then(async r => {
        const body = await r.json();
        if (!r.ok) throw new Error(body.detail);
        return body;
      });
      localStorage.setItem("boardroom_token", result.access_token);
      navigate("/");
      window.location.reload();
    } catch (err) { setError(err instanceof Error ? err.message : "Login failed"); }
  };
  return <main className="login-page">
    <section className="login-card">
      <div className="brand-mark"><BarChart3 /></div>
      <p className="eyebrow">BOARDROOM</p>
      <h1>Analytics Copilot</h1>
      <p className="muted">Sign in to access your governed intelligence workspace.</p>
      <form onSubmit={submit}>
        <label>Email<input value={email} onChange={e => setEmail(e.target.value)} type="email" /></label>
        <label>Password<input value={password} onChange={e => setPassword(e.target.value)} type="password" /></label>
        {error && <div className="error">{error}</div>}
        <button className="primary" type="submit">Sign in</button>
      </form>
    </section>
  </main>;
}

const nav = [
  { path: "/", label: "Overview", icon: LayoutDashboard },
  { path: "/data", label: "Data Workspace", icon: Database },
  { path: "/health", label: "Data Health", icon: ShieldCheck },
  { path: "/ask", label: "Ask Analytics", icon: Sparkles },
  { path: "/reports", label: "Report Studio", icon: FileText },
  { path: "/runs", label: "Run History", icon: History },
];

function Shell({ user }: { user: User }) {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const workspace = useQuery({ queryKey: ["workspaces"], queryFn: () => api<Workspace[]>("/api/v1/workspaces") });
  return <div className="app-shell">
    <aside className={sidebarOpen ? "sidebar" : "sidebar collapsed"}>
      <div className="brand"><div className="brand-mark small"><BarChart3 /></div>{sidebarOpen && <div><strong>Boardroom</strong><span>Analytics Copilot</span></div>}</div>
      <nav>{nav.map(({ path, label, icon: Icon }) => <NavLink key={path} to={path} end={path === "/"} className={({ isActive }) => isActive ? "nav-item active" : "nav-item"}><Icon size={18}/>{sidebarOpen && <span>{label}</span>}</NavLink>)}</nav>
      <button className="collapse" onClick={() => setSidebarOpen(v => !v)}>‹</button>
    </aside>
    <div className="main">
      <header>
        <button className="workspace-select"><span>{workspace.data?.[0]?.name || "Workspace"}</span><ChevronDown size={16}/></button>
        <div className="header-actions"><div className="avatar">{user.full_name.slice(0, 1)}</div><div><strong>{user.full_name}</strong><span>{user.is_superuser ? "Super Administrator" : "Workspace Member"}</span></div><button className="icon-button" title="Sign out" onClick={() => { localStorage.removeItem("boardroom_token"); window.location.reload(); }}><LogOut size={17}/></button></div>
      </header>
      <Routes>
        <Route path="/" element={<Overview workspaceId={workspace.data?.[0]?.id}/>} />
        <Route path="/data" element={<DataWorkspace workspaceId={workspace.data?.[0]?.id}/>} />
        <Route path="/health" element={<DataHealth workspaceId={workspace.data?.[0]?.id}/>} />
        <Route path="/ask" element={<AskAnalytics workspaceId={workspace.data?.[0]?.id} user={user}/>} />
        <Route path="/reports" element={<Reports workspaceId={workspace.data?.[0]?.id}/>} />
        <Route path="/runs" element={<Runs workspaceId={workspace.data?.[0]?.id}/>} />
        <Route path="*" element={<Overview workspaceId={workspace.data?.[0]?.id}/>} />
      </Routes>
    </div>
  </div>;
}

function Page({ title, subtitle, action, children }: { title: string; subtitle: string; action?: React.ReactNode; children: React.ReactNode }) {
  return <section className="page"><div className="page-head"><div><p className="eyebrow">BOARDROOM WORKSPACE</p><h1>{title}</h1><p>{subtitle}</p></div>{action}</div>{children}</section>;
}

function Overview({ workspaceId }: { workspaceId?: string }) {
  const overview = useQuery({ queryKey: ["overview", workspaceId], queryFn: () => api<any>(`/api/v1/overview${workspaceId ? `?workspace_id=${workspaceId}` : ""}`) });
  const datasets = useQuery({ queryKey: ["datasets-overview", workspaceId], queryFn: () => api<Dataset[]>(`/api/v1/datasets${workspaceId ? `?workspace_id=${workspaceId}` : ""}`) });
  const stats = [
    ["Datasets", overview.data?.dataset_count ?? "—", "Governed sources"],
    ["Data rows", overview.data?.row_count?.toLocaleString() ?? "—", "Across active datasets"],
    ["Analytics runs", overview.data?.run_count ?? "—", `${overview.data?.completed_runs ?? 0} completed`],
    ["Executive reports", overview.data?.report_count ?? "—", "Saved review-ready outputs"],
  ];
  return <Page title="Executive Overview" subtitle="Your enterprise analytics command center">
    <div className="stat-grid">{stats.map(([label, value, note]) => <article className="stat-card" key={label}><span>{label}</span><strong>{value}</strong><small>{note}</small></article>)}</div>
    <div className="grid-two">
      <article className="panel"><div className="panel-head"><div><h2>Workspace activity</h2><p>Analytics and reporting utilization</p></div></div>
        {overview.data?.activity ? <ReactECharts option={{ tooltip:{trigger:"axis"}, grid:{left:36,right:16,top:20,bottom:34}, xAxis:{type:"category",data:overview.data.activity.map((day:any)=>day.date.slice(5))}, yAxis:{type:"value",minInterval:1}, series:[{type:"bar",name:"Analytics runs",data:overview.data.activity.map((day:any)=>day.runs),itemStyle:{color:"#315efb"},barWidth:"38%",borderRadius:[4,4,0,0]}]}} style={{height:280}} /> : <div className="empty">Loading activity…</div>}
      </article>
      <article className="panel"><div className="panel-head"><div><h2>Datasets</h2><p>Recently available sources</p></div></div>
        {datasets.isLoading ? <div className="empty">Loading datasets…</div> : datasets.data?.length ? <div className="list">{datasets.data.map(d => <div className="list-row" key={d.id}><div className="file-icon"><Database size={17}/></div><div><strong>{d.name}</strong><span>{d.row_count?.toLocaleString()} rows · {d.file_type.toUpperCase()}</span></div><span className={`status ${d.status}`}>{d.status}</span></div>)}</div> : <div className="empty">No datasets uploaded yet</div>}
      </article>
    </div>
  </Page>;
}

function DataWorkspace({ workspaceId }: { workspaceId?: string }) {
  const [selected, setSelected] = useState("");
  const datasets = useQuery({ queryKey:["datasets",workspaceId], queryFn:()=>api<Dataset[]>(`/api/v1/datasets${workspaceId ? `?workspace_id=${workspaceId}` : ""}`) });
  const upload = useMutation({
    mutationFn: async (file: File) => {
      const form = new FormData(); form.append("file", file);
      return api<{id:string}>(`/api/v1/datasets/upload?workspace_id=${workspaceId}`, {method:"POST", body:form});
    },
    onSuccess:()=>datasets.refetch(),
  });
  return <Page title="Data Workspace" subtitle="Upload, inspect and govern analytical datasets" action={<label className="primary upload-label"><Upload size={16}/> Upload data<input type="file" accept=".csv,.sqlite,.sqlite3,.db" onChange={e=>{if(e.target.files?.[0]) upload.mutate(e.target.files[0]);}} /></label>}>
    {upload.isError && <div className="error">{upload.error.message}</div>}
    {upload.isSuccess && <div className="success">Dataset uploaded and profiled successfully.</div>}
    <article className="panel"><div className="panel-head"><div><h2>Datasets</h2><p>{datasets.data?.length || 0} sources in this workspace</p></div></div>
      {datasets.isLoading ? <div className="empty">Loading…</div> : datasets.data?.length ? <table><thead><tr><th>Name</th><th>Type</th><th>Rows</th><th>Status</th><th></th></tr></thead><tbody>{datasets.data.map(d=><tr key={d.id} className={selected===d.id?"selected":""} onClick={()=>setSelected(d.id)}><td><strong>{d.name}</strong></td><td>{d.file_type.toUpperCase()}</td><td>{d.row_count?.toLocaleString()}</td><td><span className={`status ${d.status}`}>{d.status}</span></td><td><button className="icon-button" title="Select dataset"><Search size={15}/></button></td></tr>)}</tbody></table> : <div className="drop-zone"><Upload/><strong>Upload a CSV or SQLite file</strong><span>Schema profiling starts automatically</span></div>}
    </article>
  </Page>;
}

function DataHealth({ workspaceId }: { workspaceId?: string }) {
  const datasets = useQuery({ queryKey:["health-datasets",workspaceId],queryFn:()=>api<Dataset[]>(`/api/v1/datasets${workspaceId ? `?workspace_id=${workspaceId}` : ""}`) });
  const [datasetId,setDatasetId]=useState("");
  const effective=datasetId || datasets.data?.[0]?.id;
  const schema=useQuery({queryKey:["schema",effective],enabled:!!effective,queryFn:()=>api<any[]>(`/api/v1/schema/datasets/${effective}`)});
  const report=useQuery({queryKey:["quality",effective],enabled:!!effective,queryFn:()=>api<any>(`/api/v1/quality/datasets/${effective}`).catch(()=>null)});
  const scan=useMutation({mutationFn:()=>api<any>(`/api/v1/quality/datasets/${effective}/scan`,{method:"POST"}),onSuccess:()=>report.refetch()});
  return <Page title="Data Health" subtitle="Completeness, consistency and schema quality" action={effective?<button className="primary" onClick={()=>scan.mutate()} disabled={scan.isPending}>Run quality scan</button>:undefined}>
    {datasets.data?.length ? <div className="toolbar"><label>Dataset<select value={effective} onChange={e=>setDatasetId(e.target.value)}>{datasets.data.map(d=><option key={d.id} value={d.id}>{d.name}</option>)}</select></label></div>:<div className="empty">Upload a dataset to begin.</div>}
    {scan.isError&&<div className="error">{scan.error.message}</div>}
    {report.data && <div className="stat-grid three"><article className="stat-card"><span>Overall health</span><strong>{report.data.overall_score}%</strong></article><article className="stat-card"><span>Completeness</span><strong>{report.data.completeness_score}%</strong></article><article className="stat-card"><span>Consistency</span><strong>{report.data.consistency_score}%</strong></article></div>}
    <article className="panel"><div className="panel-head"><h2>Inferred schema</h2></div>{schema.data?.length?<table><thead><tr><th>Column</th><th>Data type</th><th>Semantic type</th><th>Unique</th><th>Missing</th></tr></thead><tbody>{schema.data.map(c=><tr key={c.id}><td><strong>{c.column_name}</strong></td><td>{c.data_type}</td><td><span className="tag">{c.semantic_type}</span></td><td>{c.unique_count ?? "—"}</td><td>{c.null_count ?? "—"}</td></tr>)}</tbody></table>:<div className="empty">No schema data available</div>}</article>
  </Page>;
}

function analysisChartOption(chart: any) {
  if (!chart) return null;
  const isScatter = chart.type === "scatter";
  return {
    tooltip: { trigger: "axis" },
    grid: { left: 48, right: 24, top: 24, bottom: 56 },
    xAxis: isScatter
      ? { type: "value", name: chart.x_key, nameLocation: "middle", nameGap: 32 }
      : { type: "category", name: chart.x_key, data: chart.data.map((point: any) => point.x), axisLabel: { rotate: chart.data.length > 8 ? 30 : 0 } },
    yAxis: { type: "value", name: chart.y_key },
    series: [{
      type: chart.type,
      name: chart.y_key,
      data: isScatter ? chart.data.map((point: any) => [point.x, point.y]) : chart.data.map((point: any) => point.y),
      smooth: chart.type === "line",
      itemStyle: { color: "#315efb" },
      areaStyle: chart.type === "line" ? { color: "#315efb18" } : undefined,
    }],
  };
}

function AskAnalytics({ workspaceId, user }: { workspaceId?: string; user: User }) {
  const datasets=useQuery({queryKey:["ask-datasets",workspaceId],queryFn:()=>api<Dataset[]>(`/api/v1/datasets${workspaceId?`?workspace_id=${workspaceId}`:""}`)});
  const conversations=useQuery({
    queryKey:["conversations",workspaceId],
    enabled:!!workspaceId,
    queryFn:()=>api<any[]>(`/api/v1/conversations?workspace_id=${workspaceId}`),
  });
  const [datasetId,setDatasetId]=useState("");
  const [conversationId,setConversationId]=useState("");
  const [historyInitialized,setHistoryInitialized]=useState(false);
  const [question,setQuestion]=useState("");
  const [exportError,setExportError]=useState("");
  const effective=datasetId||datasets.data?.[0]?.id;
  useEffect(()=>{
    if(!historyInitialized&&conversations.isSuccess){
      const newest=conversations.data?.[0];
      if(newest){
        setConversationId(newest.id);
        setDatasetId(newest.dataset_id);
      }
      setHistoryInitialized(true);
    }
  },[conversations.data,conversations.isSuccess,historyInitialized]);
  const conversation=useQuery({
    queryKey:["conversation",conversationId],
    enabled:!!conversationId,
    queryFn:()=>api<any>(`/api/v1/conversations/${conversationId}`),
  });
  const canSelectModel=user.is_superuser||user.permissions.includes("model:select");
  const canCreateReport=user.is_superuser||(
    user.permissions.includes("report:create")&&user.permissions.includes("model:select")
  );
  const models=useQuery({
    queryKey:["models"],
    enabled:canSelectModel,
    queryFn:()=>api<any[]>("/api/v1/models"),
  });
  const availableModels=models.data?.filter(model=>model.configured)||[];
  const [modelId,setModelId]=useState("");
  const selectedModelId=availableModels.some(model=>model.id===modelId)?modelId:availableModels[0]?.id||"";
  const execute=useMutation({
    mutationFn:({text,existingConversationId}:{text:string;existingConversationId:string})=>api<any>("/api/v1/analytics/query",{
      method:"POST",
      body:JSON.stringify({
        workspace_id:workspaceId,
        dataset_id:effective,
        question:text,
        conversation_id:existingConversationId||undefined,
      }),
    }),
    onSuccess:result=>{
      setConversationId(result.conversation_id);
      queryClient.invalidateQueries({queryKey:["conversations",workspaceId]});
      queryClient.invalidateQueries({queryKey:["conversation",result.conversation_id]});
    },
  });
  const generateReport=useMutation({
    mutationFn:({sourceConversationId,messageId}:{sourceConversationId:string;messageId:string})=>api<any>("/api/v1/reports/generate",{
      method:"POST",
      body:JSON.stringify({
        conversation_id:sourceConversationId,
        message_id:messageId,
        model_id:selectedModelId,
      }),
    }),
    onSuccess:()=>queryClient.invalidateQueries({queryKey:["reports",workspaceId]}),
  });
  const messages=conversation.data?.messages||[];
  const ask=()=>execute.mutate({text:question,existingConversationId:conversationId});
  const startConversation=()=>{
    setConversationId("");
    setHistoryInitialized(true);
    setQuestion("");
    execute.reset();
    generateReport.reset();
  };
  const selectConversation=(id:string)=>{
    setConversationId(id);
    setQuestion("");
    execute.reset();
    generateReport.reset();
    const item=conversations.data?.find(item=>item.id===id);
    if(item) setDatasetId(item.dataset_id);
  };
  return <Page title="Ask Analytics" subtitle="Ask governed questions about your uploaded data">
    <div className="ask-layout"><aside className="panel ask-context"><div className="panel-head"><h2>Context</h2><button className="secondary" onClick={startConversation}>New chat</button></div><label>Dataset<select value={effective||""} onChange={e=>{setDatasetId(e.target.value);setConversationId("");execute.reset();}}>{datasets.data?.map(d=><option key={d.id} value={d.id}>{d.name}</option>)}</select></label>
      {canSelectModel&&<label>Report model<select value={selectedModelId} onChange={e=>setModelId(e.target.value)} disabled={!availableModels.length}><option value="">{availableModels.length?"Select a model":"No configured model"}</option>{availableModels.map(model=><option key={model.id} value={model.id}>{model.display_name} · {model.provider}</option>)}</select>{models.isError&&<small className="error">{models.error.message}</small>}</label>}
      <div className="suggestions"><span>Try asking</span><button onClick={()=>setQuestion("Show monthly net sales trend")}>Monthly sales trend</button><button onClick={()=>setQuestion("Compare net sales by region")}>Sales by region</button><button onClick={()=>setQuestion("Which products have the highest profit?")}>Top products by profit</button></div>
      <div className="conversation-list"><strong>Saved conversations</strong>{conversations.data?.length?conversations.data.map(item=><button key={item.id} className={conversationId===item.id?"active":""} onClick={()=>selectConversation(item.id)}><span>{item.title}</span><small>{item.dataset_name}</small></button>):<small>No saved conversations yet</small>}</div>
    </aside>
    <div className="ask-main"><div className="chat-history">
      {messages.map((message:any)=><article className={`chat-message ${message.role}`} key={message.id}>
        <strong>{message.role==="user"?"You":"Analytics Copilot"}</strong><p>{message.content}</p>
        {message.metadata?.sql&&<div className="sql"><code>{message.metadata.sql}</code></div>}
        {message.metadata?.chart&&<div className="analysis-chart"><ReactECharts option={analysisChartOption(message.metadata.chart)} style={{height:320}}/></div>}
        {!!message.metadata?.outliers?.length&&<div className="outlier-callouts"><h3>Statistical outliers</h3><div className="outlier-grid">{message.metadata.outliers.map((item:any)=><div className="outlier-card" key={item.column}><strong>{item.column}</strong><span>{item.count} value(s) outside the 1.5×IQR range</span><small>Bounds {item.lower_bound.toPrecision(4)} to {item.upper_bound.toPrecision(4)} · examples {item.examples.join(", ")}</small></div>)}</div></div>}
        {message.metadata?.columns?.length>0&&<table><thead><tr>{message.metadata.columns.map((column:string)=><th key={column}>{column}</th>)}</tr></thead><tbody>{message.metadata.rows.slice(0,20).map((row:any,index:number)=><tr key={index}>{message.metadata.columns.map((column:string)=><td key={column}>{String(row[column]??"")}</td>)}</tr>)}</tbody></table>}
        {canCreateReport&&message.metadata?.run_id&&<button className="secondary" disabled={!selectedModelId||generateReport.isPending} onClick={()=>generateReport.mutate({sourceConversationId:conversationId,messageId:message.id})}>{generateReport.isPending?"Generating…":"Generate executive report"}</button>}
      </article>)}
      {!messages.length&&<div className="empty">{conversation.isLoading?"Loading saved conversation…":"Ask a question to begin a persisted analytics conversation."}</div>}
    </div>
    <article className="prompt"><textarea value={question} onChange={e=>setQuestion(e.target.value)} placeholder="Ask a question about sales, customers, or trends…" onKeyDown={e=>{if(e.key==="Enter"&&!e.shiftKey){e.preventDefault();if(question.trim()&&!execute.isPending)ask();}}}/><button className="primary" disabled={!effective||!question.trim()||execute.isPending} onClick={ask}><Sparkles size={16}/>{execute.isPending?"Running…":"Analyze"}</button></article>
    {execute.isError&&<div className="error">{execute.error.message}</div>}
    {generateReport.isSuccess&&<div className="success">Report generated: {generateReport.data.title}
      <button className="secondary" onClick={()=>downloadReport(generateReport.data.id,"markdown").catch(e=>setExportError(e.message))}>Download Markdown</button>
      <button className="secondary" onClick={()=>downloadReport(generateReport.data.id,"pdf").catch(e=>setExportError(e.message))}>Download PDF</button>
    </div>}
    {exportError&&<div className="error">{exportError}</div>}
    {generateReport.isError&&<div className="error">{generateReport.error.message}</div>}
    </div></div>
  </Page>;
}

async function downloadReport(reportId: string, format: "markdown" | "pdf") {
  const token=localStorage.getItem("boardroom_token");
  const response=await fetch(`/api/v1/reports/${reportId}/export?format=${format}`,{headers:token?{Authorization:`Bearer ${token}`}:{}})
  if(!response.ok) throw new Error("Report export failed");
  const blob=await response.blob();
  const url=URL.createObjectURL(blob);
  const anchor=document.createElement("a");
  anchor.href=url;
  anchor.download=`boardroom-report.${format === "markdown" ? "md" : "pdf"}`;
  anchor.click();
  window.setTimeout(()=>URL.revokeObjectURL(url),1000);
}

function Reports({ workspaceId }: { workspaceId?: string }) {
  const reports=useQuery({queryKey:["reports",workspaceId],queryFn:()=>api<any[]>(`/api/v1/reports${workspaceId?`?workspace_id=${workspaceId}`:""}`)});
  const [exportError,setExportError]=useState("");
  return <Page title="Report Studio" subtitle="Review model-generated analysis grounded in saved query results">
    {exportError&&<div className="error">{exportError}</div>}
    <div className="report-list">{reports.data?.length?reports.data.map(report=><article className="panel saved-report" key={report.id}>
      <div className="panel-head"><div><h2>{report.title}</h2><p>{report.description||"Evidence-backed executive report"} · {new Date(report.created_at).toLocaleString()}</p></div><div><button className="secondary" onClick={()=>downloadReport(report.id,"markdown").catch(e=>setExportError(e.message))}><Download size={15}/> Markdown</button><button className="secondary" onClick={()=>downloadReport(report.id,"pdf").catch(e=>setExportError(e.message))}>PDF</button></div></div>
      <h3>Executive summary</h3><p className="report-summary">{report.content?.summary||"No summary was saved."}</p>
      {report.content?.question&&<p><strong>Analysis question:</strong> {report.content.question}</p>}
      {report.content?.chart&&<div className="analysis-chart"><ReactECharts option={analysisChartOption(report.content.chart)} style={{height:320}}/></div>}
      {report.content?.model&&<small>Generated with {report.content.model.name} · {report.content.model.provider}</small>}
    </article>):<div className="empty">{reports.isLoading?"Loading reports…":"No generated reports yet. Generate one from a saved Ask Analytics result."}</div>}</div>
  </Page>;
}

function Runs({ workspaceId }: { workspaceId?: string }) {
  const runs=useQuery({queryKey:["runs",workspaceId],queryFn:()=>api<any[]>(`/api/v1/runs${workspaceId?`?workspace_id=${workspaceId}`:""}`)});
  return <Page title="Run History" subtitle="Trace persisted analytics execution and reproducible SQL"><article className="panel">{runs.data?.length?<table><thead><tr><th>Question</th><th>Status</th><th>SQL</th><th>Created</th></tr></thead><tbody>{runs.data.map(r=><tr key={r.id}><td><strong>{r.question}</strong></td><td><span className={`status ${r.status}`}>{r.status}</span></td><td><code className="truncate">{r.sql}</code></td><td>{new Date(r.created_at).toLocaleString()}</td></tr>)}</tbody></table>:<div className="empty">No analytics runs yet</div>}</article></Page>;
}

function App() {
  const {user,loading}=useAuth();
  if(loading) return <main className="login-page"><div className="loading">Loading workspace…</div></main>;
  if(!user) return <Login />;
  return <Shell user={user}/>;
}

ReactDOM.createRoot(document.getElementById("root")!).render(<React.StrictMode><QueryClientProvider client={queryClient}><BrowserRouter><App/></BrowserRouter></QueryClientProvider></React.StrictMode>);
