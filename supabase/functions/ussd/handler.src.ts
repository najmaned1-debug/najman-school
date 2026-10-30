// @ts-nocheck
// Najman USSD callback (Africa's Talking format: sessionId, phoneNumber, text -> "CON ..." / "END ...").
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { ussdReply, phoneVariants, expectedFee } from "./core.ts";

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
