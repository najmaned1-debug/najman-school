// @ts-nocheck
// Najman USSD - single file (paste into Supabase Edge Function "ussd"). Generated from core.ts + handler.src.ts
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
// Najman USSD - menu logic (pure; data comes from `repo`). Language: Kiswahili.
const SCHOOL = {
  name: "Najman Education Centre",
  phone: "+255 742 415 133",
  email: "najmaned1@gmail.com",
  box: "P.O. Box 1333, Mwanza",
  place: "Kishili, Mwanza",
};
const MAX = 180; // USSD screens must stay short (~182 chars)

function phoneVariants(p) {
  const d = String(p || "").replace(/\D/g, "");
  if (d.length < 9) return [];
  const n = d.slice(-9); // 7xxxxxxxx
  return [n, "0" + n, "255" + n, "+255" + n];
}

const fmt = (n) => Number(n || 0).toLocaleString("en-US");
const clip = (s) => (s.length > MAX ? s.slice(0, MAX - 3) + "..." : s);
const short = (name, n = 18) => {
  const t = String(name || "").trim().replace(/\s+/g, " ");
  if (t.length <= n) return t;
  const p = t.split(" ");
  return p.length > 1 ? (p[0] + " " + p.slice(1).map((x) => x[0]).join("")).slice(0, n) : t.slice(0, n);
};

// Same rule as the dashboard: academic year starts July; admission on/after day 25 starts next month.
function expectedFee(st, hist, now = new Date()) {
  const ref0 = now;
  const ref = st.status === "Left" && st.left_date && new Date(st.left_date) < ref0 ? new Date(st.left_date) : ref0;
  const y = ref.getFullYear(), startY = ref.getMonth() >= 6 ? y : y - 1;
  let start = new Date(startY, 6, 1);
  if (st.admission_date) {
    const ad = new Date(st.admission_date);
    if (!isNaN(ad.getTime())) {
      const a = ad.getDate() >= 25 ? new Date(ad.getFullYear(), ad.getMonth() + 1, 1) : new Date(ad.getFullYear(), ad.getMonth(), 1);
      if (a > start) start = a;
    }
  }
  const list = (hist || []).slice().sort((a, b) => new Date(a.effective_from) - new Date(b.effective_from));
  let total = 0, cur = new Date(start.getFullYear(), start.getMonth(), 1);
  const endM = new Date(ref.getFullYear(), ref.getMonth(), 1);
  let g = 0;
  while (cur <= endM && g < 240) {
    const monthEnd = new Date(cur.getFullYear(), cur.getMonth() + 1, 0, 23, 59, 59);
    let ap = null;
    for (const h of list) { if (new Date(h.effective_from) <= monthEnd) ap = h; else break; }
    total += Number((ap ? ap.term_fee : st.term_fee) || 0);
    cur = new Date(cur.getFullYear(), cur.getMonth() + 1, 1); g++;
  }
  return Math.max(0, total - Number(st.paused_months || 0) * Number(st.term_fee || 0));
}

const SUB = [
  [/hisabati/i, "HES"], [/math/i, "MATH"], [/english/i, "ENG"], [/kiswahili/i, "KSW"], [/sayansi/i, "SAY"],
  [/geogra/i, "GEO"], [/kusoma/i, "KUS"], [/kuandika/i, "KUA"], [/biolog/i, "BIO"], [/chem/i, "CHEM"],
  [/physic/i, "PHY"], [/business/i, "BUS"], [/civic/i, "CIV"], [/histor/i, "HIS"],
];
const subCode = (n) => { for (const [r, c] of SUB) if (r.test(n || "")) return c; return String(n || "").replace(/[^A-Za-z]/g, "").slice(0, 3).toUpperCase(); };

const ROOT = "Karibu Najman Education Centre\n1. Ada/Deni\n2. Matokeo\n3. Mahudhurio\n4. Taarifa za Shule\n0. Toka";
const END_ = (s) => "END " + clip(s);
const CON_ = (s) => "CON " + clip(s);

async function ussdReply({ text, phone }, repo, now = new Date()) {
  const parts = String(text || "").split("*").map((s) => s.trim()).filter((s) => s !== "");
  if (parts.length === 0) return CON_(ROOT);
  const opt = parts[0];
  if (opt === "0") return END_("Asante. " + SCHOOL.name + ". Play Your Part.");

  // 4: school info (no child needed)
  if (opt === "4") {
    if (parts.length === 1) return CON_("Taarifa za Shule\n1. Mawasiliano\n2. Namba za malipo\n0. Rudi");
    if (parts[1] === "1") return END_(SCHOOL.name + "\n" + SCHOOL.place + "\nSimu: " + SCHOOL.phone + "\n" + SCHOOL.box);
    if (parts[1] === "2") {
      const pi = await repo.paymentInfo();
      return END_(pi ? "Namba za malipo:\n" + pi : "Wasiliana na shule kwa namba za malipo: " + SCHOOL.phone);
    }
    if (parts[1] === "0") return CON_(ROOT);
    return END_("Chaguo si sahihi.");
  }

  if (!["1", "2", "3"].includes(opt)) return END_("Chaguo si sahihi. Piga tena.");

  const kids = await repo.findStudents(phone);
  if (!kids || kids.length === 0)
    return END_("Namba hii haijasajiliwa kwa mwanafunzi yeyote. Wasiliana na shule: " + SCHOOL.phone);

  let kid, next;
  if (kids.length === 1) { kid = kids[0]; next = 1; }
  else {
    if (parts.length === 1) {
      const lines = kids.slice(0, 5).map((k, i) => (i + 1) + ". " + short(k.name, 24));
      return CON_("Chagua mwanafunzi:\n" + lines.join("\n"));
    }
    const ix = Number(parts[1]) - 1;
    if (!(ix >= 0 && ix < Math.min(kids.length, 5))) return END_("Chaguo si sahihi.");
    kid = kids[ix]; next = 2;
  }
  const nm = short(kid.name, 26);

  if (opt === "1") {
    const { expected, paid } = await repo.feeInfo(kid, now);
    const bal = expected - paid;
    let s = nm + " (" + (kid.class_name || "") + ")\nAda hadi sasa: TZS " + fmt(expected) + "\nUmelipa: TZS " + fmt(paid) + "\n";
    s += bal > 0 ? "DENI: TZS " + fmt(bal) : bal < 0 ? "Umezidisha: TZS " + fmt(-bal) : "Hauna deni. Asante!";
    return END_(s);
  }

  if (opt === "2") {
    const r = await repo.latestResult(kid);
    if (!r) return END_(nm + ": Hakuna matokeo yaliyohifadhiwa bado.");
    if (parts[next] === "0") return END_("Asante. " + SCHOOL.name + ".");
    if (parts[next] === "1") {
      const subs = r.rows.map((x) => subCode(x.subject) + " " + Math.round(x.marks)).join(" ");
      return END_(short(r.exam, 20) + ":\n" + subs);
    }
    const line2 = "Wst " + (r.average ?? "-") + (r.position ? " Nafasi " + r.position + (r.of ? "/" + r.of : "") : "") + (r.division ? " " + String(r.division).replace("Division", "Div") : "");
    return CON_(nm + "\n" + short(r.exam, 24) + "\n" + line2 + "\n1. Alama za masomo\n0. Toka");
  }

  if (opt === "3") {
    const a = await repo.attendance(kid, now);
    const c = { P: 0, A: 0, L: 0 };
    a.forEach((x) => { if (c[x.status] !== undefined) c[x.status]++; });
    const today = now.toISOString().slice(0, 10);
    const t = a.find((x) => x.att_date === today);
    const ts = t ? ({ P: "Yupo shuleni", A: "Hayupo", L: "Ana ruhusa" })[t.status] || t.status : "Bado haijarekodiwa";
    return END_(nm + "\nLeo: " + ts + "\nSiku 7: Amehudhuria " + c.P + ", Hakuhudhuria " + c.A + ", Ruhusa " + c.L);
  }
  return END_("Chaguo si sahihi.");
}

// Najman USSD callback (Africa's Talking format: sessionId, phoneNumber, text -> "CON ..." / "END ...").

const sb = createClient(Deno.env.get("SUPABASE_URL"), Deno.env.get("SUPABASE_SERVICE_ROLE_KEY"));
const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "*", "Access-Control-Allow-Methods": "POST, GET, OPTIONS" };

const repo = {
  async findStudents(phone) {
    const v = phoneVariants(phone);
    if (!v.length) return [];
    const { data } = await sb.from("students")
      .select("id,name,class_name,term_fee,admission_no,status,admission_date,left_date,paused_months")
      .in("phone", v).eq("status", "Active").order("name").limit(6);
    return data || [];
  },
  async feeInfo(st, now) {
    const [{ data: pay }, { data: hist }] = await Promise.all([
      sb.from("payments").select("amount").eq("student_id", st.id),
      sb.from("fee_history").select("term_fee,effective_from").eq("student_id", st.id).order("effective_from"),
    ]);
    const paid = (pay || []).reduce((a, p) => a + Number(p.amount || 0), 0);
    return { expected: expectedFee(st, hist || [], now), paid };
  },
  async latestResult(st) {
    const { data } = await sb.from("exam_results")
      .select("exam_id,marks_obtained,average,division,position,subjects(name),examinations(name,created_at)")
      .eq("student_id", st.id);
    if (!data || !data.length) return null;
    const byExam = {};
    data.forEach((r) => { (byExam[r.exam_id] = byExam[r.exam_id] || []).push(r); });
    const latest = Object.values(byExam).sort((a, b) =>
      new Date(b[0].examinations?.created_at || 0) - new Date(a[0].examinations?.created_at || 0))[0];
    const f = latest[0];
    const { data: peers } = await sb.from("exam_results").select("student_id,students(class_name)").eq("exam_id", f.exam_id);
    const same = new Set((peers || []).filter((p) => p.students?.class_name === st.class_name).map((p) => p.student_id));
    return {
      exam: f.examinations?.name || "Mtihani", average: f.average, position: f.position, division: f.division,
      of: same.size || null,
      rows: latest.map((r) => ({ subject: r.subjects?.name, marks: Number(r.marks_obtained) }))
        .sort((a, b) => (/business/i.test(a.subject || "") ? 1 : 0) - (/business/i.test(b.subject || "") ? 1 : 0)),
    };
  },
  async attendance(st, now) {
    const from = new Date(now.getTime() - 6 * 86400000).toISOString().slice(0, 10);
    const { data } = await sb.from("attendance").select("att_date,status").eq("student_id", st.id).gte("att_date", from);
    return data || [];
  },
  async paymentInfo() {
    const { data } = await sb.from("settings").select("fee_config").eq("id", 1).single();
    try {
      const g = JSON.parse(data?.fee_config || "{}"), s = [];
      if (g.bank_account) s.push((g.bank_name || "Benki") + " " + g.bank_account + (g.bank_account_name ? " (" + g.bank_account_name + ")" : ""));
      if (g.mpesa_number) s.push("M-Pesa " + g.mpesa_number + (g.mpesa_name ? " (" + g.mpesa_name + ")" : ""));
      if (g.tigopesa_number) s.push("Tigo Pesa " + g.tigopesa_number);
      if (g.airtel_number) s.push("Airtel " + g.airtel_number);
      return s.join("\n");
    } catch { return ""; }
  },
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  const url = new URL(req.url);
  const secret = Deno.env.get("USSD_KEY");
  if (!secret || url.searchParams.get("key") !== secret) return new Response("Forbidden", { status: 403, headers: cors });
  let p = {};
  try {
    const ct = req.headers.get("content-type") || "";
    if (ct.includes("json")) p = await req.json();
    else if (req.method === "POST") p = Object.fromEntries(new URLSearchParams(await req.text()));
    else p = Object.fromEntries(url.searchParams);
  } catch { /* ignore */ }
  const phone = p.phoneNumber || p.msisdn || p.phone || "";
  const text = p.text ?? p.input ?? "";
  let out;
  try { out = await ussdReply({ text, phone }, repo); }
  catch (e) { console.error(e); out = "END Samahani, huduma haipatikani kwa sasa. Jaribu tena baadaye."; }
  return new Response(out, { headers: { ...cors, "Content-Type": "text/plain; charset=utf-8" } });
});
