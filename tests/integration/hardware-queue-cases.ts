import assert from "node:assert/strict";
import { randomBytes, randomUUID } from "node:crypto";

import { NextRequest } from "next/server";

import { POST as claimV1 } from "@/app/api/hardware-jobs/claim/route";
import { PATCH as updateV1 } from "@/app/api/hardware-jobs/[jobId]/route";
import { POST as claimV2 } from "@/app/api/hardware/v2/jobs/claim/route";
import { PATCH as updateV2 } from "@/app/api/hardware/v2/jobs/[jobId]/attempts/[attemptId]/route";
import { POST as renewLeaseV2 } from "@/app/api/hardware/v2/jobs/[jobId]/attempts/[attemptId]/lease/route";
import { db, pool } from "@/db";
import { enforcePdfRenderRateLimit } from "@/features/sales/documents/pdf-render-rate-limit";
import { consumeSecurityRateLimit } from "@/lib/security/rate-limit";
import { hardwareAgents, hardwareJobs } from "@/db/schema";
import { encryptHardwareAgentSecret } from "@/lib/hardware/agent-credential";
import { authenticateHardwareAgent, authenticateOptionalHardwareAgent } from "@/lib/hardware/agent-auth";
import {
  buildInventoryLabelPayloadV2,
  buildReceiptDocumentPayloadV2,
} from "@/lib/hardware/job-payload-contracts-v2";
import { createHardwareJobV2 } from "@/lib/hardware/job-producer-v2";
import { recoverStaleHardwareJobs } from "@/lib/hardware/job-recovery";
import {
  createHardwareRequestSignature,
  hashHardwareRequestBody,
} from "@/lib/hardware/request-signing";

type HardwareFixture = {
  organizationId: string;
  outletId: string;
  registerId: string;
  makerId: string;
  itemIds: string[];
};
type Agent = { id: string; secret: string };
type JobType = "print_label_sato" | "print_receipt_certificate";
type Claim = {
  job: { id: string; protocolVersion?: number } | null;
  attempt: { id: string; leaseToken: string } | null;
};
const capabilities = ["print_label_sato", "print_document_pdf"];

async function createAgent(f: HardwareFixture): Promise<Agent> {
  const agent = { id: randomUUID(), secret: randomBytes(32).toString("hex") };
  await db.insert(hardwareAgents).values({
    id: agent.id,
    organizationId: f.organizationId,
    outletId: f.outletId,
    registerId: f.registerId,
    code: `QUEUE-${agent.id}`,
    name: "Queue regression test",
    secretHash: encryptHardwareAgentSecret(agent.id, agent.secret),
    capabilities: Object.fromEntries(capabilities.map((value) => [value, true])),
  });
  return agent;
}

function request(agent: Agent, path: string, body: object, options: {
  method?: "POST" | "PATCH"; protocolVersion?: string; leaseToken?: string;
  idempotencyKey?: string;
} = {}) {
  const method = options.method ?? "POST";
  const payload = JSON.stringify(body);
  const timestamp = String(Date.now());
  const nonce = randomBytes(18).toString("base64url");
  const contentSha256 = hashHardwareRequestBody(Buffer.from(payload));
  return new NextRequest(`http://localhost${path}`, {
    method,
    body: payload,
    headers: {
      "content-type": "application/json",
      "x-hardware-agent-id": agent.id,
      "x-hardware-auth-version": "2",
      "x-hardware-timestamp": timestamp,
      "x-hardware-nonce": nonce,
      "x-hardware-content-sha256": contentSha256,
      "x-hardware-signature": createHardwareRequestSignature({
        agentId: agent.id, secret: agent.secret, method, pathAndQuery: path,
        timestamp, nonce, contentSha256, ...options,
      }),
      ...(options.protocolVersion ? { "x-hardware-protocol-version": options.protocolVersion } : {}),
      ...(options.leaseToken ? { "x-hardware-lease-token": options.leaseToken } : {}),
      ...(options.idempotencyKey ? { "idempotency-key": options.idempotencyKey } : {}),
    },
  });
}

async function claim(agent: Agent, version: 1 | 2): Promise<Claim> {
  const response = version === 1
    ? await claimV1(request(agent, "/api/hardware-jobs/claim", {}))
    : await claimV2(request(agent, "/api/hardware/v2/jobs/claim", {
        supportedCapabilities: capabilities,
      }, { protocolVersion: "2" }));
  assert.equal(response.status, 200, await response.clone().text());
  return response.json();
}

async function addV2Job(f: HardwareFixture, jobType: JobType) {
  const sourceId = randomUUID();
  const payload = jobType === "print_receipt_certificate"
    ? buildReceiptDocumentPayloadV2({
        saleId: sourceId, invoiceNumber: sourceId, requestSource: "queue-test",
        reprint: false, requestedAt: new Date(),
      })
    : buildInventoryLabelPayloadV2({
        itemId: f.itemIds[0]!, copies: 1, sku: sourceId, barcode: "003037",
        masterProductName: "Gelang", itemDisplayName: "Gelang Test", weightGram: "2.5",
        purityPercent: "30", exchangePurityPercent: "28", size: null, color: null,
        gemstone: null, sellingAmount: "2000000",
      });
  return (await createHardwareJobV2({
    organizationId: f.organizationId, outletId: f.outletId, registerId: f.registerId,
    createdByUserId: f.makerId, jobType, mode: "automatic", payload,
    idempotencyKey: `queue-test:${sourceId}`, sourceType: "queue_test", sourceId,
  })).job;
}

async function addV1Job(f: HardwareFixture) {
  const [job] = await db.insert(hardwareJobs).values({
    organizationId: f.organizationId, outletId: f.outletId, registerId: f.registerId,
    protocolVersion: 1, jobType: "print_label_sato", deviceType: "label_printer", payload: {},
  }).returning();
  return job!;
}

async function completeV2(agent: Agent, claimed: Claim, renewDuringDispatch = false) {
  assert.ok(claimed.job);
  assert.ok(claimed.attempt);
  const { job, attempt } = claimed;
  const path = `/api/hardware/v2/jobs/${job.id}/attempts/${attempt.id}`;
  const statuses = ["processing", "dispatching", "submitted", "acknowledged"];
  for (let index = 0; index < statuses.length; index++) {
    const response = await updateV2(request(agent, path, {
      status: statuses[index], eventSequence: index + 1,
      result: { simulated: true },
    }, {
      method: "PATCH", protocolVersion: "2", leaseToken: attempt.leaseToken,
      idempotencyKey: `${attempt.id}:${index + 1}`,
    }), { params: Promise.resolve({ jobId: job.id, attemptId: attempt.id }) });
    assert.equal(response.status, 200, await response.clone().text());
    if (renewDuringDispatch && statuses[index] === "dispatching") {
      const renewal = await renewLeaseV2(request(agent, `${path}/lease`, {}, {
        protocolVersion: "2", leaseToken: attempt.leaseToken,
      }), { params: Promise.resolve({ jobId: job.id, attemptId: attempt.id }) });
      assert.equal(renewal.status, 200, await renewal.clone().text());
      assert.equal((await pool.query("select status from hardware_job_attempts where id=$1", [attempt.id])).rows[0].status, "dispatching");
    }
  }
}

async function jobState(id: string) {
  return (await pool.query(
    "select status, attempts, current_attempt_id from hardware_jobs where id=$1", [id],
  )).rows[0];
}

export function registerHardwareQueueTests(test: (name: string, run: (fixture: {
  organizationA: HardwareFixture; organizationB: HardwareFixture;
}) => Promise<void>) => void) {
  for (const jobType of ["print_label_sato", "print_receipt_certificate"] as const) {
    test(`v1 fallback cannot steal ${jobType} arriving after an empty v2 claim`, async ({ organizationA: f }) => {
      const agent = await createAgent(f);
      assert.equal((await claim(agent, 2)).job, null);
      // Deterministically reproduce the interval between the agent's two requests.
      const job = await addV2Job(f, jobType);
      assert.equal((await claim(agent, 1)).job, null, "Legacy claim must leave v2 jobs untouched.");
      assert.deepEqual(await jobState(job.id), { status: "pending", attempts: 0, current_attempt_id: null });
      const claimed = await claim(agent, 2);
      assert.equal(claimed.job?.id, job.id);
      assert.ok(claimed.attempt?.id);
      await completeV2(agent, claimed);
      assert.equal((await jobState(job.id)).status, "completed");
    });
  }

  test("legacy updates cannot bypass attempts for claimed v2 jobs", async ({ organizationA: f }) => {
    const agent = await createAgent(f);
    const job = await addV2Job(f, "print_label_sato");
    const claimed = await claim(agent, 2);
    for (const status of ["printing", "completed", "failed"]) {
      const response = await updateV1(request(agent, `/api/hardware-jobs/${job.id}`, {
        status, result: { legacy: true },
      }, { method: "PATCH" }), { params: Promise.resolve({ jobId: job.id }) });
      assert.equal(response.status, 404);
      assert.equal((await jobState(job.id)).status, "claimed");
      assert.equal((await jobState(job.id)).current_attempt_id, claimed.attempt?.id);
    }
    await completeV2(agent, claimed);
  });

  test("burst arrivals and mixed protocol claims complete without orphaned v2 jobs", async ({ organizationA: f, organizationB }) => {
    const agent = await createAgent(f);
    const otherJob = await addV2Job(organizationB, "print_label_sato");
    const completed = new Set<string>();
    for (let batch = 0; batch < 3; batch++) {
      assert.equal((await claim(agent, 2)).job, null);
      const jobs = await Promise.all([
        addV2Job(f, "print_label_sato"), addV2Job(f, "print_receipt_certificate"),
        addV2Job(f, "print_receipt_certificate"), addV1Job(f),
      ]);
      // Both protocol endpoints run while a new batch is available.
      const [legacy, first] = await Promise.all([claim(agent, 1), claim(agent, 2)]);
      assert.equal(legacy.job?.id, jobs[3]!.id);
      assert.equal(legacy.job?.protocolVersion, 1);
      const legacyResponse = await updateV1(request(agent, `/api/hardware-jobs/${legacy.job.id}`, {
        status: "completed",
      }, { method: "PATCH" }), { params: Promise.resolve({ jobId: legacy.job.id }) });
      assert.equal(legacyResponse.status, 200);
      let current = first;
      while (current.job) {
        assert.ok(current.attempt);
        assert.equal(completed.has(current.job.id), false, "A job must be claimed only once.");
        completed.add(current.job.id);
        await completeV2(agent, current);
        current = await claim(agent, 2);
      }
      for (const job of jobs) assert.equal((await jobState(job.id)).status, "completed");
    }
    assert.equal(completed.size, 9);
    const recovery = await recoverStaleHardwareJobs({
      organizationId: f.organizationId, now: new Date(Date.now() + 121 * 60_000),
    });
    assert.equal(recovery.orphanedV2Failed, 0);
    assert.equal((await jobState(otherJob.id)).status, "pending", "Other tenants must stay untouched.");
  });

  test("concurrent legacy claims skip locked jobs and preserve every queued job", async ({ organizationA: f }) => {
    const agent = await createAgent(f);
    const jobs = await Promise.all(Array.from({ length: 6 }, () => addV1Job(f)));
    const claims = await Promise.all(jobs.map(() => claim(agent, 1)));
    assert.ok(claims.every((value) => value.job));
    assert.equal(new Set(claims.map((value) => value.job!.id)).size, jobs.length);
    assert.equal((await claim(agent, 1)).job, null);
  });

  test("dispatching lease can be renewed while the physical print command is still running", async ({ organizationA: f }) => {
    const agent = await createAgent(f);
    const job = await addV2Job(f, "print_label_sato");
    await completeV2(agent, await claim(agent, 2), true);
    assert.equal((await jobState(job.id)).status, "completed");
    assert.equal((await jobState(job.id)).attempts, 1);
  });

  for (const code of ["DOCUMENT_RATE_LIMITED", "DOCUMENT_SERVER_BUSY"]) {
    test(`${code} persists the server delay, pauses other PDFs and keeps labels moving`, async ({ organizationA: f }) => {
      const agent = await createAgent(f);
      const delayed = await addV2Job(f, "print_receipt_certificate");
      assert.equal(delayed.maxAttempts, 5);
      const first = await claim(agent, 2);
      assert.equal(first.job?.id, delayed.id);
      assert.ok(first.attempt);
      const path = `/api/hardware/v2/jobs/${delayed.id}/attempts/${first.attempt.id}`;
      const retryBody = { status: "failed_before_dispatch", eventSequence: 1,
        error: { code, message: "PDF server busy", retrySafe: true, retryAfterMs: 60_000 } };
      const before = Date.now();
      const options = { method: "PATCH" as const, protocolVersion: "2", leaseToken: first.attempt.leaseToken,
        idempotencyKey: `${first.attempt.id}:busy` };
      const update = await updateV2(request(agent, path, retryBody, options), {
        params: Promise.resolve({ jobId: delayed.id, attemptId: first.attempt.id }),
      });
      assert.equal(update.status, 200, await update.clone().text());
      const response = await update.json();
      assert.equal(response.disposition, "requeued");
      const available = Date.parse(response.job.availableAt);
      assert(available >= before + 61_000 && available <= Date.now() + 61_000);
      const duplicate = await updateV2(request(agent, path, retryBody, options), {
        params: Promise.resolve({ jobId: delayed.id, attemptId: first.attempt.id }),
      });
      assert.equal(duplicate.status, 200);
      assert.equal((await duplicate.json()).duplicate, true, "Lost ACK must not postpone/consume the retry twice.");
      for (const [body, changedOptions, expected] of [
        [retryBody, { ...options, leaseToken: "incorrect-token" }, 401],
        [{ ...retryBody, eventSequence: 2 }, options, 409],
        [retryBody, { ...options, idempotencyKey: "different-failure-event" }, 409],
      ] as const) {
        const rejected = await updateV2(request(agent, path, body, changedOptions), {
          params: Promise.resolve({ jobId: delayed.id, attemptId: first.attempt.id }),
        });
        assert.equal(rejected.status, expected, "Retired attempts may only replay their authenticated committed failure.");
      }

      const otherPdf = await addV2Job(f, "print_receipt_certificate");
      const label = await addV2Job(f, "print_label_sato");
      const next = await claim(agent, 2);
      assert.equal(next.job?.id, label.id);
      await completeV2(agent, next);
      assert.equal((await claim(agent, 2)).job, null, "Register PDF cooldown must survive stateless polling/restarts.");
      assert.equal((await jobState(otherPdf.id)).attempts, 0, "Waiting PDFs must not burn attempts while throttled.");

      // Advance the persisted schedule without waiting a wall-clock minute.
      await pool.query("update hardware_jobs set available_at=now()-interval '1 second' where id=$1", [delayed.id]);
      const completed = new Set<string>();
      for (let i = 0; i < 2; i++) {
        const ready = await claim(agent, 2);
        assert.ok(ready.job);
        completed.add(ready.job.id);
        if (ready.job.id === delayed.id) {
          const oldReplay = await updateV2(request(agent, path, retryBody, options), {
            params: Promise.resolve({ jobId: delayed.id, attemptId: first.attempt.id }),
          });
          assert.equal(oldReplay.status, 200);
          assert.equal((await jobState(delayed.id)).current_attempt_id, ready.attempt?.id, "Old ACK replay must not detach the new attempt.");
        }
        await completeV2(agent, ready);
      }
      assert.deepEqual(completed, new Set([delayed.id, otherPdf.id]));
      assert.equal((await jobState(delayed.id)).attempts, 2);
    });
  }

  test("authenticated Hub PDF quotas are separate from manual users and honor the longest block", async ({ organizationA: f }) => {
    const settings = { TRUST_PROXY: "true", TRUST_PROXY_HOPS: "1", PDF_RATE_LIMIT_ACTOR_REQUESTS: "1",
      PDF_RATE_LIMIT_IP_REQUESTS: "2", PDF_RATE_LIMIT_HARDWARE_AGENT_REQUESTS: "3",
      PDF_RATE_LIMIT_HARDWARE_IP_REQUESTS: "5", PDF_RATE_LIMIT_WINDOW_MS: "60000", PDF_RATE_LIMIT_BLOCK_MS: "60000" };
    const previous = Object.fromEntries(Object.keys(settings).map((key) => [key, process.env[key]]));
    Object.assign(process.env, settings);
    const pdfRequest = (ip = "192.0.2.40") => new Request("http://localhost/pdf", { headers: { "x-forwarded-for": ip } });
    const check = (type: "user" | "hardware-agent", id: string) => enforcePdfRenderRateLimit({ request: pdfRequest(), actor: { type, id } });
    try {
      assert.equal(await check("user", f.makerId), null);
      const hub = randomUUID();
      for (let i = 0; i < 3; i++) assert.equal(await check("hardware-agent", hub), null);
      assert.equal((await check("hardware-agent", hub))?.status, 429);
      assert.equal(await check("user", randomUUID()), null, "Hub downloads must not consume manual IP quota.");
      assert.equal((await check("user", randomUUID()))?.status, 429);
      const otherHub = randomUUID();
      assert.equal(await check("hardware-agent", otherHub), null);
      assert.equal((await check("hardware-agent", otherHub))?.status, 429, "Hub IP quota must still be enforced.");

      const blockedHub = randomUUID();
      for (const [scope, key, blockMs] of [
        ["pdf.render.actor", `hardware-agent:${blockedHub}`, 5_000],
        ["pdf.render.hardware_ip", "192.0.2.41", 15_000],
      ] as const) {
        const input = { scope, key, policy: { limit: 1, windowMs: 60_000, blockMs } };
        await consumeSecurityRateLimit(input);
        await consumeSecurityRateLimit(input);
      }
      const rejected = await enforcePdfRenderRateLimit({ request: pdfRequest("192.0.2.41"), actor: { type: "hardware-agent", id: blockedHub } });
      assert.equal(rejected?.status, 429);
      assert(Number(rejected?.headers.get("Retry-After")) >= 14, "Retry-After must cover every rejected bucket.");
    } finally {
      for (const [key, value] of Object.entries(previous)) {
        if (value === undefined) delete process.env[key]; else process.env[key] = value;
      }
    }
  });

  test("ordinary PDF traffic cannot poison Hardware Hub authentication failures on a shared IP", async ({ organizationA: f }) => {
    const agent = await createAgent(f);
    const settings = { TRUST_PROXY: "true", TRUST_PROXY_HOPS: "1", HARDWARE_AGENT_AUTH_FAILURE_LIMIT_PER_IP: "1" };
    const previous = Object.fromEntries(Object.keys(settings).map((key) => [key, process.env[key]]));
    Object.assign(process.env, settings);
    const ip = "192.0.2.52";
    const signed = () => {
      const req = request(agent, "/api/hardware-jobs/claim", {});
      req.headers.set("x-forwarded-for", ip);
      return req;
    };
    try {
      for (let i = 0; i < 3; i++) {
        assert.equal(await authenticateOptionalHardwareAgent(new Request("http://localhost/pdf", {
          headers: { "x-forwarded-for": ip },
        })), null);
      }
      assert.equal((await authenticateHardwareAgent(signed()))?.agent.id, agent.id);
      assert.equal(await authenticateOptionalHardwareAgent(new Request("http://localhost/pdf", {
        headers: { "x-forwarded-for": ip, "x-hardware-agent-id": "invalid-agent" },
      })), null);
      assert.equal(await authenticateHardwareAgent(signed()), null, "Explicit invalid Hub authentication must still be failure-limited.");
    } finally {
      for (const [key, value] of Object.entries(previous)) {
        if (value === undefined) delete process.env[key]; else process.env[key] = value;
      }
    }
  });
}
