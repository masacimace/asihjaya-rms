import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (path: string) => readFileSync(path, "utf8");

const schema = read("src/db/schema/index.ts");
const session = read("src/lib/auth/session.ts");
const heartbeat = read("src/components/auth/presence-heartbeat.tsx");
const heartbeatRoute = read("src/app/api/presence/heartbeat/route.ts");
const presenceRoute = read("src/app/api/admin/presence/route.ts");
const presenceServer = read("src/features/presence/server.ts");
const presenceCard = read(
  "src/components/admin/dashboard/online-users-card.tsx",
);
const adminLayout = read("src/app/(admin)/admin/layout.tsx");
const posLayout = read("src/app/(pos)/pos/layout.tsx");
const adminDashboard = read("src/app/(admin)/admin/page.tsx");

assert.match(schema, /lastSeenAt: timestamp\("last_seen_at"/);
assert.match(session, /export async function touchCurrentSession/);
assert.match(session, /lastSeenAt: now/);
assert.match(heartbeatRoute, /touchCurrentSession\(\)/);
assert.match(heartbeat, /60_000/);
assert.match(heartbeat, /visibilitychange/);
assert.match(heartbeat, /window\.addEventListener\("focus"/);
assert.match(adminLayout, /<PresenceHeartbeat \/>/);
assert.match(posLayout, /<PresenceHeartbeat \/>/);

assert.match(presenceRoute, /hasPermission\(auth, "admin\.access"\)/);
assert.match(presenceRoute, /getOnlinePresence\(auth\)/);
assert.match(presenceRoute, /getPresenceActivities\(auth, userId\)/);

assert.match(presenceServer, /PRESENCE_ONLINE_WINDOW_MS = 2 \* 60_000/);
assert.match(
  presenceServer,
  /PRESENCE_HISTORY_WINDOW_MS = 12 \* 60 \* 60_000/,
);
assert.match(presenceServer, /"sale\.completed"/);
assert.match(presenceServer, /"buyback\.completed"/);
assert.match(presenceServer, /"pos\.held_cart\.create"/);
assert.match(presenceServer, /PRESENCE_ACTIVITY_LIMIT = 10/);
assert.match(presenceServer, /inArray\(auditLogs\.actorUserId, userIds\)/);

assert.match(presenceCard, /User Online/);
assert.match(presenceCard, /expandedUserId/);
assert.match(presenceCard, /user\.activityCount <= 0/);
assert.match(presenceCard, /Maks\. 10 terbaru/);
assert.match(presenceCard, /\/api\/admin\/presence/);

const presencePosition = adminDashboard.indexOf("<OnlineUsersCard />");
const attentionPosition = adminDashboard.indexOf("Perlu Perhatian");
assert.ok(presencePosition >= 0, "OnlineUsersCard harus tampil di Dashboard.");
assert.ok(
  attentionPosition > presencePosition,
  "OnlineUsersCard harus berada di atas card Perlu Perhatian.",
);

console.log(
  "Admin online presence contracts: OK — 60s heartbeat, 2m online window, 12h session activity, single-open lazy history.",
);
