import fs from "node:fs";
import path from "node:path";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

const root = process.cwd();
const read = (relative: string) => fs.readFileSync(path.join(root, relative), "utf8");

const pageSource = read("src/app/(admin)/admin/integrasi/telegram/page.tsx");
const detailSource = read(
  "src/app/(admin)/admin/integrasi/telegram/delivery/[deliveryId]/page.tsx",
);
const actionSource = read("src/app/actions/telegram-settings.ts");
const serviceSource = read(
  "src/server/integrations/telegram/telegram-admin-service.ts",
);
const repositorySource = read(
  "src/server/integrations/telegram/telegram-outbox-repository.ts",
);
const shellSource = read("src/components/layout/admin-shell.tsx");

assert(
  pageSource.includes('requirePermission("settings.manage")') &&
    detailSource.includes('requirePermission("settings.manage")') &&
    actionSource.includes('requirePermission("settings.manage")'),
  "Admin Telegram wajib memakai permission settings.manage pada page/detail/actions.",
);
assert(
  shellSource.includes('href: "/admin/integrasi/telegram"') &&
    shellSource.includes('access: "settings"'),
  "Navigation Integrasi Telegram harus mengikuti access settings.",
);
assert(
  !pageSource.includes("TELEGRAM_BOT_TOKEN") &&
    !detailSource.includes("TELEGRAM_BOT_TOKEN"),
  "Bot token tidak boleh direferensikan pada React admin page yang dikirim ke browser.",
);
assert(
  serviceSource.includes('reportType: "test"') &&
    serviceSource.includes("maxAttempts: 1") &&
    serviceSource.includes("client.sendMessage"),
  "Admin test message harus menjadi report_type=test yang dikirim langsung server-side dan diaudit.",
);
assert(
  serviceSource.includes("getTelegramAdminBotStatus") &&
    serviceSource.includes("client.getMe()"),
  "Admin integration status harus dapat menampilkan bot identity tanpa mengekspos token.",
);
assert(
  actionSource.includes("saveTelegramDestinationAction") &&
    actionSource.includes("sendTelegramTestMessageAction") &&
    actionSource.includes("retryTelegramDeliveryAction"),
  "Action destination/test/manual retry wajib tersedia.",
);
assert(
  repositorySource.includes("manuallyRetryTelegramDelivery") &&
    repositorySource.includes('from: "failed"') &&
    repositorySource.includes('to: "retry"'),
  "Manual retry harus menggunakan row failed yang sama, bukan event baru.",
);
assert(
  repositorySource.includes("maxAttempts: input.maxAttempts"),
  "Transition repository harus dapat menyimpan allowance attempt tambahan untuk manual retry.",
);
assert(
  pageSource.includes("Delivery history") &&
    detailSource.includes("Attempt audit") &&
    detailSource.includes("Message snapshot"),
  "Admin UI harus menyediakan history, detail message snapshot, dan attempt audit.",
);

if (process.argv.includes("--database")) {
  const [{ db }, schema, adminService, adminQueries, outboxRepository, mockModule] =
    await Promise.all([
      import("@/db"),
      import("@/db/schema"),
      import("@/server/integrations/telegram/telegram-admin-service"),
      import("@/features/telegram/admin-queries"),
      import("@/server/integrations/telegram/telegram-outbox-repository"),
      import("./telegram-mock-server"),
    ]);

  const now = new Date("2026-08-07T12:30:00.000Z");
  const [organization] = await db
    .insert(schema.organizations)
    .values({ name: "ASIHJAYA Admin Test", slug: `telegram-admin-${process.pid}` })
    .returning();
  assert(organization, "Organization test gagal dibuat.");

  const [outlet] = await db
    .insert(schema.outlets)
    .values({ organizationId: organization.id, code: "TADM", name: "Outlet Admin Telegram" })
    .returning();
  assert(outlet, "Outlet test gagal dibuat.");

  const [user] = await db
    .insert(schema.users)
    .values({
      organizationId: organization.id,
      email: `telegram-admin-${process.pid}@example.test`,
      username: `telegram_admin_${process.pid}`,
      fullName: "Telegram Admin Test",
    })
    .returning();
  assert(user, "User test gagal dibuat.");

  const [destination] = await db
    .insert(schema.telegramDestinations)
    .values({
      organizationId: organization.id,
      outletId: outlet.id,
      name: "Telegram Admin Development",
      chatId: "-1001234567890",
      isActive: true,
      createdBy: user.id,
      updatedBy: user.id,
    })
    .returning();
  assert(destination, "Destination test gagal dibuat.");

  await db.insert(schema.telegramReportSettings).values({
    destinationId: destination.id,
    timezone: "Asia/Jakarta",
    isActive: true,
  });

  const mock = await mockModule.startTelegramMockServer({ port: 0, silent: true });
  const previous = {
    enabled: process.env.TELEGRAM_INTEGRATION_ENABLED,
    token: process.env.TELEGRAM_BOT_TOKEN,
    baseUrl: process.env.TELEGRAM_API_BASE_URL,
    timeout: process.env.TELEGRAM_REQUEST_TIMEOUT_MS,
  };

  try {
    process.env.TELEGRAM_INTEGRATION_ENABLED = "false";
    process.env.TELEGRAM_BOT_TOKEN = ["123456789", "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghi"].join(":");
    process.env.TELEGRAM_API_BASE_URL = mock.origin;
    process.env.TELEGRAM_REQUEST_TIMEOUT_MS = "1000";

    const botStatus = await adminService.getTelegramAdminBotStatus();
    assert(botStatus.state === "reachable", "Bot status mocked harus reachable.");
    assert(
      botStatus.username === "@asihjaya_dev_mock_bot",
      "Bot username mocked tidak sesuai contract.",
    );

    const testResult = await adminService.sendTelegramAdminTestMessage({
      organizationId: organization.id,
      destinationId: destination.id,
      actorUserId: user.id,
      timezone: "Asia/Jakarta",
      ipAddress: "127.0.0.1",
      userAgent: "telegram-admin-test",
    });

    const detail = await adminQueries.getTelegramDeliveryDetail({
      organizationId: organization.id,
      deliveryId: testResult.deliveryId,
    });
    assert(detail, "Test delivery detail tidak ditemukan.");
    assert(detail.delivery.reportType === "test", "Test message tidak boleh menjadi finance report.");
    assert(detail.delivery.status === "sent", "Mocked admin test message harus sent.");
    assert(detail.delivery.attemptCount === 1, "Admin test message harus mencatat satu attempt.");
    assert(detail.attempts.length === 1, "Attempt audit admin test message harus tercatat.");
    assert(detail.attempts[0]?.telegramOk === true, "Attempt mocked harus Telegram OK.");

    const [failed] = await db
      .insert(schema.telegramDeliveryOutbox)
      .values({
        organizationId: organization.id,
        eventKey: `test:manual-retry:${process.pid}`,
        destinationId: destination.id,
        outletId: outlet.id,
        reportType: "test",
        payloadSnapshotJson: { reportType: "test" },
        messageText: "Manual retry test",
        status: "failed",
        attemptCount: 1,
        maxAttempts: 1,
        nextAttemptAt: now,
        lastErrorCode: "TELEGRAM_500",
        lastErrorMessage: "Temporary test failure",
      })
      .returning();
    assert(failed, "Failed delivery test gagal dibuat.");

    const retried = await outboxRepository.manuallyRetryTelegramDelivery({
      organizationId: organization.id,
      deliveryId: failed.id,
      now,
    });
    assert(retried, "Manual retry tidak mengembalikan row.");
    assert(retried.after.id === failed.id, "Manual retry harus memakai delivery ID yang sama.");
    assert(retried.after.status === "retry", "Manual retry harus mengubah failed menjadi retry.");
    assert(retried.after.maxAttempts === 2, "Exhausted manual retry harus menambah satu attempt allowance.");
    assert(retried.after.attemptCount === 1, "Manual retry tidak boleh menghapus attempt history.");

    const overview = await adminQueries.getTelegramAdminOverview(organization.id);
    assert(overview.destinations.length === 1, "Destination mapping admin tidak terbaca.");
    assert(
      overview.deliveries.some((row) => row.id === testResult.deliveryId),
      "Delivery history admin tidak memuat test message.",
    );
  } finally {
    await new Promise<void>((resolve) => mock.server.close(() => resolve()));
    const restore = (name: string, value: string | undefined) => {
      if (value === undefined) delete process.env[name];
      else process.env[name] = value;
    };
    restore("TELEGRAM_INTEGRATION_ENABLED", previous.enabled);
    restore("TELEGRAM_BOT_TOKEN", previous.token);
    restore("TELEGRAM_API_BASE_URL", previous.baseUrl);
    restore("TELEGRAM_REQUEST_TIMEOUT_MS", previous.timeout);
  }
}

console.log(
  process.argv.includes("--database")
    ? "Telegram 2C.9 admin checks passed: permission guard, destination mapping, bot status, direct audited test message, delivery history/detail, dan same-row manual retry."
    : "Telegram 2C.9 admin contract checks passed: permission guard, token isolation, destination/settings, test message, history/detail, dan manual retry contract.",
);
