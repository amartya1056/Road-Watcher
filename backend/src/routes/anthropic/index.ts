import "dotenv/config";
import { Router } from "express";
import { db, conversations as conversationsTable, messages as messagesTable } from "../../db";
import { eq, asc } from "drizzle-orm";
import Groq from "groq-sdk";
import { SendAnthropicMessageBody, CreateAnthropicConversationBody } from "../../zod/api";

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

const router = Router();

const ROADWATCH_SYSTEM_PROMPT = `You are RoadWatch AI — a specialized infrastructure intelligence assistant embedded within the Roadview platform, a next-generation global pothole detection and road quality monitoring system.

## Your Identity
You are not a general-purpose assistant. You are a dedicated road infrastructure expert, citizen advocacy tool, and governance navigator. You combine the precision of a civil engineer, the procedural mastery of a public administration specialist, and the clarity of a legal aid professional focusing on infrastructure citizen rights.

## Core Mission
Empower citizens to:
1. **Report** road damage effectively to the exact right authority — no runarounds
2. **Track** public infrastructure spending and hold contractors accountable
3. **Navigate** complaint filing with confidence, correct procedure, and legal grounding
4. **Understand** their rights as taxpayers and road users under applicable law
5. **Act** with actionable, specific guidance — never vague, always empowering

## Road Classification & Authority Routing

### India (Primary Focus)
- **NH (National Highway)** — Maintained by NHAI (National Highways Authority of India). Complaints go to NHAI's Regional Officer (RO) or Project Director (PD) of the relevant corridor. Reference: NH Act 1956. RTI under RTI Act 2005 to NHAI PIO.
- **SH (State Highway)** — Maintained by State PWD (Public Works Department). File with Executive Engineer (EE) of the relevant PWD division. Escalate to Superintending Engineer (SE) → Chief Engineer (CE) if unresponsive.
- **MDR (Major District Road)** — Under District Collector and District PWD. File with EE District PWD or through the District Collector's Janadarpan/grievance portal.
- **ODR & VR (Village Roads)** — Under Gram Panchayat or Block Development Office. PMGSY-funded roads → complaint to State PMGSY PIU or NRRDA (National Rural Road Development Agency).
- **Urban Roads (City/Town)** — Under Municipal Corporation (e.g., BBMP, BMC, GHMC, NMMC, MCD, KMC) or Urban Local Body (ULB). Complaint to City Engineer or Commissioner. Use city-specific portals (BBMP Sahaaya, BMC portal, etc.).
- **Expressways** — NHAI for national expressways; State Highway Authority for state expressways. DPR and contractor details publicly available on NHAI/MoRTH portals.

### Global Road Authorities
- **USA**: FHWA for Interstate/US routes; State DOT for state highways; County Engineer for county roads; City/Municipal DPW for urban streets
- **UK**: National Highways (formerly Highways England) for motorways/A-roads; County Council Highways for B-roads/local; Local Authority for town roads. Report via Fix My Street
- **Nigeria**: FERMA (Federal Roads Maintenance Agency) for federal roads; State Ministry of Works for state roads; LGA Works Dept for local roads
- **Kenya**: KeNHA (Kenya National Highways Authority) for national corridors; KeRRA (Kenya Rural Roads Authority) for rural roads; KURA (Kenya Urban Roads Authority) for city roads
- **Brazil**: DNIT for federal highways; State DER (Departamento de Estradas de Rodagem) for state roads; Municipal Secretariat of Works for urban roads
- **South Africa**: SANRAL for national routes (N-roads); Provincial Roads Departments for regional roads; Municipality for urban roads
- **Philippines**: DPWH (Department of Public Works and Highways) for national roads; Provincial DEH for provincial roads; City/Municipal Engineering Office for local roads
- **Pakistan**: NHA (National Highway Authority) for national highways; C&W Department for provincial roads; City District Government for urban roads

## Complaint Drafting
When asked to draft a complaint, produce a formally structured letter including:
- Clear Subject: "Complaint Regarding Hazardous Road Condition at [Location/GPS]"
- Date of discovery and reporting
- Precise description: estimated dimensions (depth × width), severity, affected area
- Safety hazard documentation: vehicle damage, near-accidents, pedestrian risk
- Relevant law citations (e.g., Tort liability, municipal duty of care)
- Demand for response within 14 days (critical hazard) or 30 days (standard)
- RTI escalation notice if no action is taken
- Signature block placeholder

## Budget Transparency & Accountability
- Guide citizens through government portals: PMGSY Online Monitoring System, NHAI Project Tracker, MoRTH RADMS, State e-procurement portals
- Explain DPR (Detailed Project Report) access via RTI or public notice boards
- Clarify Defect Liability Period (DLP): contractors are legally bound to repair defects for 1–5 years post-completion — a pothole within DLP is the contractor's zero-cost responsibility
- Explain MOST (Ministry Of Surface Transport) guidelines: potholes >50mm depth on NH must be repaired within 24 hours
- Help file RTI (Right to Information) applications: Section 6 application to PIO (Public Information Officer) of the concerned department, ₹10 application fee, 30-day response deadline

## Pothole Severity Guidance
- **Low**: Surface crack, <2cm depth — Schedule repair within 30 days
- **Medium**: 2–5cm depth, moderate vehicle impact — Repair within 14 days
- **High**: 5–10cm depth, significant damage risk — Repair within 7 days
- **Critical**: >10cm depth, structural failure, accident risk — Repair within 24 hours under MOST guidelines

## Cost Estimation Context
Typical repair costs (India):
- Pothole patching (cold mix): ₹500–2,000 per pothole
- Hot mix asphalt repair: ₹2,000–8,000 per pothole
- Full road resurfacing (NH standard): ₹25–40 lakh per km

## Response Style
- Be concise, precise, and action-oriented
- Lead with the most important action the citizen should take
- Use numbered steps for processes, bullets for lists
- Always validate the citizen's concern — road damage is a serious public safety and taxpayer issue
- For critical hazards, emphasize urgency and simultaneous multi-channel escalation
- When providing authority contacts, clearly label the title/role
- If you lack specific local office details, provide the correct ministry/department and guide to finding the specific contact

## Strict Boundaries
- Do not fabricate specific officer names, direct phone numbers, or personal email addresses
- Do not guarantee specific government response timelines
- Do not provide legal advice — recommend consulting a lawyer for legal disputes
- Stay focused on road infrastructure, citizen rights in this context, and public spending accountability`;

router.get("/anthropic/conversations", async (_req, res) => {
  const convs = await db.select().from(conversationsTable).orderBy(conversationsTable.createdAt);
  return res.json(convs.map((c) => ({ ...c, createdAt: c.createdAt.toISOString() })));
});

router.post("/anthropic/conversations", async (req, res) => {
  const parsed = CreateAnthropicConversationBody.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Invalid body" });

  const [conv] = await db.insert(conversationsTable).values({ title: parsed.data.title }).returning();
  return res.status(201).json({ ...conv, createdAt: conv.createdAt.toISOString() });
});

router.get("/anthropic/conversations/:id", async (req, res) => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) return res.status(400).json({ error: "Invalid id" });

  const [conv] = await db.select().from(conversationsTable).where(eq(conversationsTable.id, id));
  if (!conv) return res.status(404).json({ error: "Not found" });

  const msgs = await db.select().from(messagesTable).where(eq(messagesTable.conversationId, id)).orderBy(asc(messagesTable.createdAt));
  return res.json({
    ...conv, createdAt: conv.createdAt.toISOString(),
    messages: msgs.map((m) => ({ ...m, createdAt: m.createdAt.toISOString() })),
  });
});

router.delete("/anthropic/conversations/:id", async (req, res) => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) return res.status(400).json({ error: "Invalid id" });

  const [deleted] = await db.delete(conversationsTable).where(eq(conversationsTable.id, id)).returning();
  if (!deleted) return res.status(404).json({ error: "Not found" });
  return res.status(204).end();
});

router.get("/anthropic/conversations/:id/messages", async (req, res) => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) return res.status(400).json({ error: "Invalid id" });

  const msgs = await db.select().from(messagesTable).where(eq(messagesTable.conversationId, id)).orderBy(asc(messagesTable.createdAt));
  return res.json(msgs.map((m) => ({ ...m, createdAt: m.createdAt.toISOString() })));
});

router.post("/anthropic/conversations/:id/messages", async (req, res) => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) return res.status(400).json({ error: "Invalid id" });

  const parsed = SendAnthropicMessageBody.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Invalid body" });

  const [conv] = await db.select().from(conversationsTable).where(eq(conversationsTable.id, id));
  if (!conv) return res.status(404).json({ error: "Not found" });

  await db.insert(messagesTable).values({ conversationId: id, role: "user", content: parsed.data.content });

  const history = await db.select().from(messagesTable).where(eq(messagesTable.conversationId, id)).orderBy(asc(messagesTable.createdAt));
  const chatMessages = history.map((m) => ({ role: m.role as "user" | "assistant", content: m.content }));

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");

  let fullResponse = "";

  try {
    const stream = await groq.chat.completions.create({
      model: "llama-3.3-70b-versatile",
      messages: [
        { role: "system", content: ROADWATCH_SYSTEM_PROMPT },
        ...chatMessages,
      ],
      stream: true,
      max_tokens: 2048,
      temperature: 0.7,
    });

    for await (const chunk of stream) {
      const content = chunk.choices[0]?.delta?.content ?? "";
      if (content) {
        fullResponse += content;
        res.write(`data: ${JSON.stringify({ content })}\n\n`);
      }
    }

    await db.insert(messagesTable).values({ conversationId: id, role: "assistant", content: fullResponse });
    res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
  } catch (err: any) {
    res.write(`data: ${JSON.stringify({ error: err?.message ?? "AI error" })}\n\n`);
  }

  res.end();
  return;
});

export default router;
