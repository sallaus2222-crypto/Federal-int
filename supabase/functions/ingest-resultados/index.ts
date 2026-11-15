import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-collector-secret",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  const json = (body: unknown, status=200) => new Response(JSON.stringify(body), {
    status, headers: { ...cors, "Content-Type": "application/json" }
  });
  if (req.method !== "POST") return json({error:"Método não permitido"},405);

  const secret = Deno.env.get("COLLECTOR_SECRET");
  if (!secret || req.headers.get("x-collector-secret") !== secret) return json({error:"Não autorizado"},401);

  const url = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const db = createClient(url, serviceKey, {auth:{persistSession:false}});

  try {
    const body = await req.json();
    const items = Array.isArray(body) ? body : [body];
    if (!items.length || items.length > 10000) return json({error:"Lote inválido"},400);
    let inserted = 0, skipped = 0;

    for (const item of items) {
      const numero = Number(item.numero);
      const data = String(item.data_concurso || "");
      const premios = item.premios;
      if (!Number.isInteger(numero) || numero <= 0 || !/^\d{4}-\d{2}-\d{2}$/.test(data) ||
          !Array.isArray(premios) || premios.length !== 5) {
        return json({error:`Dados inválidos no concurso ${item.numero ?? "desconhecido"}`},400);
      }
      const normalized = premios.map((p:any, i:number) => ({
        posicao: Number(p.posicao ?? i+1),
        bilhete: String(p.bilhete ?? "").trim().padStart(5,"0")
      })).sort((a:any,b:any)=>a.posicao-b.posicao);
      if (normalized.some((p:any,i:number)=>p.posicao !== i+1 || !/^\d{5}$/.test(p.bilhete))) {
        return json({error:`Os cinco bilhetes do concurso ${numero} não passaram na validação`},400);
      }

      const {data: existing, error: findError} = await db.from("concursos").select("id").eq("numero",numero).maybeSingle();
      if (findError) throw findError;
      if (existing) { skipped++; continue; }

      const {data: contest, error: insertError} = await db.from("concursos").insert({
        numero, data_concurso:data, fonte:item.fonte || "CAIXA", fonte_url:item.fonte_url || null
      }).select("id").single();
      if (insertError) throw insertError;
      const {error: prizesError} = await db.from("premios").insert(normalized.map((p:any)=>({...p,concurso_id:contest.id})));
      if (prizesError) {
        await db.from("concursos").delete().eq("id",contest.id);
        throw prizesError;
      }
      inserted++;
    }

    await db.from("coletas").insert({
      status: inserted ? "sucesso" : "sem_novidade",
      mensagem: `Novos: ${inserted}; já existentes: ${skipped}`,
      concursos_novos: inserted
    });
    return json({ok:true, inseridos:inserted, ignorados:skipped});
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erro desconhecido";
    await db.from("coletas").insert({status:"falha", mensagem:message, concursos_novos:0});
    return json({error:message},500);
  }
});
