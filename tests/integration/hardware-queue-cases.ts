import assert from "node:assert/strict";
import { randomBytes, randomUUID } from "node:crypto";

import { NextRequest } from "next/server";

import { POST as claimV1 } from "@/app/api/hardware-jobs/claim/route";
import { PATCH as updateV1 } from "@/app/api/hardware-jobs/[jobId]/route";
import { POST as claimV2 } from "@/app/api/hardware/v2/jobs/claim/route";
import { PATCH as updateV2 } from "@/app/api/hardware/v2/jobs/[jobId]/attempts/[attemptId]/route";
import { db, pool } from "@/db";
import { hardwareAgents, hardwareJobs } from "@/db/schema";
import { encryptHardwareAgentSecret } from "@/lib/hardware/agent-credential";
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

async function completeV2(agent: Agent, claimed: Claim) {
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
}
