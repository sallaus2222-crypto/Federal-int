const cfg = window.FEDERAL_CONFIG || {};
const hasConfig = cfg.supabaseUrl && cfg.supabaseAnonKey &&
  !cfg.supabaseUrl.includes("SEU-PROJETO") && !cfg.supabaseAnonKey.includes("SUA_CHAVE");
const supabase = hasConfig && window.supabase ? window.supabase.createClient(cfg.supabaseUrl, cfg.supabaseAnonKey) : null;
let contests = [];

const $ = (id) => document.getElementById(id);
const pad = (value, size) => String(value).padStart(size, "0");
const fmtDate = (value) => value ? new Date(`${value}T12:00:00`).toLocaleDateString("pt-BR") : "—";

function setConnection(text, ok=false) {
  $("connectionLabel").textContent = text;
  document.querySelector(".live-dot").style.background = ok ? "var(--green)" : "#d5a64d";
}
function getTickets(rows) {
  return rows.flatMap(c => (c.premios || []).sort((a,b)=>a.posicao-b.posicao).map(p=>p.bilhete));
}
function rankValues(values, minCount=2) {
  const counts = new Map();
  values.forEach(v => counts.set(v, (counts.get(v)||0)+1));
  return [...counts.entries()].map(([value,count])=>({value,count}))
    .filter(x=>x.count>=minCount).sort((a,b)=>b.count-a.count || a.value.localeCompare(b.value)).slice(0,8);
}
function renderRank(id, values, width) {
  const el = $(id);
  const ranked = rankValues(values);
  if (!ranked.length) {
    el.className = "rank-list empty";
    el.textContent = "Nenhuma repetição nesta janela. Isso não significa ausência de chance.";
    return;
  }
  const max = Math.max(...ranked.map(x=>x.count));
  el.className = "rank-list";
  el.innerHTML = ranked.map(x=>`<div class="rank-row"><span class="rank-value">${x.value}</span><div class="bar"><i style="width:${Math.max(5,x.count/max*100)}%"></i></div><span class="rank-count">${x.count}×</span></div>`).join("");
}
function render() {
  const tickets = getTickets(contests);
  $("windowCount").textContent = `${contests.length}/20`;
  $("ticketCount").textContent = tickets.length;
  const last = contests[0];
  $("lastContest").textContent = last ? `#${last.numero}` : "—";
  $("lastDate").textContent = last ? fmtDate(last.data_concurso) : "Aguardando dados";
  const lastSync = last?.created_at;
  $("lastSync").textContent = lastSync ? new Date(lastSync).toLocaleString("pt-BR") : "—";
  $("syncStatus").textContent = contests.length ? "Histórico carregado" : "Sem concursos";
  renderRank("terminacoes", tickets.map(n=>n.slice(-2)), 2);
  renderRank("centenas", tickets.map(n=>n.slice(-3)), 3);
  renderRank("milhares", tickets.map(n=>n.slice(-4)), 4);
  $("resultsBody").innerHTML = contests.length ? contests.map(c=>{
    const prizes = [...(c.premios||[])].sort((a,b)=>a.posicao-b.posicao);
    return `<tr><td>#${c.numero}</td><td>${fmtDate(c.data_concurso)}</td>${[0,1,2,3,4].map(i=>`<td class="ticket">${prizes[i]?.bilhete || "—"}</td>`).join("")}</tr>`;
  }).join("") : `<tr><td colspan="7" class="empty-cell">Nenhum concurso no banco. Configure o Supabase e faça a primeira coleta.</td></tr>`;
}
async function loadData() {
  if (!supabase) {
    setConnection("Configure app/config.js");
    $("resultsBody").innerHTML = `<tr><td colspan="7" class="empty-cell">Preencha a URL e a chave pública do Supabase em config.js.</td></tr>`;
    return;
  }
  setConnection("Conectando...");
  const {data, error} = await supabase.from("concursos")
    .select("numero,data_concurso,created_at,premios(posicao,bilhete)")
    .order("data_concurso",{ascending:false}).limit(20);
  if (error) {
    setConnection("Falha na conexão");
    $("resultsBody").innerHTML = `<tr><td colspan="7" class="empty-cell">${escapeHtml(error.message)}</td></tr>`;
    return;
  }
  contests = data || [];
  setConnection("Banco conectado", true);
  render();
}
function escapeHtml(value) { return String(value).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c])); }

$("refreshBtn").addEventListener("click", loadData);
$("importBtn").addEventListener("click", ()=>{
  const file = $("csvFile").files[0];
  $("importMessage").textContent = file
    ? `Arquivo selecionado: ${file.name}. Por segurança, a carga é feita pelo importador local coletor/importar_csv.py, nunca expondo o segredo no navegador. Consulte o README.`
    : "Selecione um CSV e siga as instruções de importação no README.";
});
loadData();
