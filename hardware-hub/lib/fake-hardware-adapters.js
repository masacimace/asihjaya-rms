/* eslint-disable */
const fs = require("fs");
const path = require("path");

function writeJsonExclusive(controller, filePath, value) {
  controller.writeExclusive(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function createFakeHardwareBackend({ controller, agentVersion, logger = console }) {
  function createBaseContext({ job, attemptId, adapter, target = "fake" }) {
    const resolvedAttemptId = attemptId || `v1-${job.id}`;
    const registered = controller.registerAttempt(job, resolvedAttemptId);
    return {
      ...registered,
      adapter,
      target,
      agentVersion,
    };
  }

  async function prepareLabel({ job, attemptId, command, label, copies, labelProfile }) {
    const context = createBaseContext({
      job,
      attemptId,
      adapter: "fake_label_file",
      target: "fake://label-printer",
    });
    await controller.beforePrepare(context);
    const attemptDir = controller.getAttemptDir(context);
    const artifactPath = path.join(attemptDir, "label.sbpl");
    const metadataPath = path.join(attemptDir, "artifact.json");

    return {
      adapter: context.adapter,
      target: context.target,
      async dispatch() {
        await controller.beforeArtifactWrite(context);
        controller.writeExclusive(artifactPath, command, "binary");
        writeJsonExclusive(controller, metadataPath, {
          kind: "fake_label_dispatch",
          scenario: context.scenario,
          jobId: context.jobId,
          attemptId: context.attemptId,
          jobType: context.jobType,
          deviceType: context.deviceType,
          labelProfile,
          copies,
          label,
          bytes: Buffer.byteLength(command, "binary"),
          agentVersion,
          dispatchedAt: new Date().toISOString(),
        });
        await controller.afterArtifactWrite(context);
        return {
          mode: "fake",
          scenario: context.scenario,
          outputFile: artifactPath,
          metadataFile: metadataPath,
          copies,
          bytes: Buffer.byteLength(command, "binary"),
        };
      },
      async cleanup() {},
    };
  }

  async function prepareDocument({
    job,
    attemptId,
    sourcePath,
    download,
    documentProfileId,
    pdfContract,
    printProfile,
    printProfileId,
    skipBeforePrepare = false,
  }) {
    const context = createBaseContext({
      job,
      attemptId,
      adapter: "fake_document_file",
      target: "fake://document-printer",
    });
    if (!skipBeforePrepare) await controller.beforePrepare(context);
    const attemptDir = controller.getAttemptDir(context);
    const artifactPath = path.join(attemptDir, "document.pdf");
    const metadataPath = path.join(attemptDir, "artifact.json");

    return {
      adapter: context.adapter,
      target: context.target,
      async dispatch() {
        await controller.beforeArtifactWrite(context);
        const content = fs.readFileSync(sourcePath);
        controller.writeExclusive(artifactPath, content);
        writeJsonExclusive(controller, metadataPath, {
          kind: "fake_document_dispatch",
          scenario: context.scenario,
          jobId: context.jobId,
          attemptId: context.attemptId,
          jobType: context.jobType,
          deviceType: context.deviceType,
          documentProfileId: documentProfileId || null,
          printProfileId: printProfileId || null,
          paper: printProfile?.paper || null,
          orientation: printProfile?.orientation || null,
          printSettings: printProfile?.printSettings || null,
          pdfContract: pdfContract || null,
          bytes: content.length,
          sha256: download.sha256,
          contentType: download.contentType,
          agentVersion,
          dispatchedAt: new Date().toISOString(),
        });
        await controller.afterArtifactWrite(context);
        return {
          mode: "fake",
          scenario: context.scenario,
          outputFile: artifactPath,
          metadataFile: metadataPath,
          documentProfileId: documentProfileId || null,
          printProfileId: printProfileId || null,
          paper: printProfile?.paper || null,
          orientation: printProfile?.orientation || null,
          printSettings: printProfile?.printSettings || null,
          pdfContract: pdfContract || null,
          ...download,
        };
      },
      async cleanup() {
        try {
          fs.unlinkSync(sourcePath);
        } catch (error) {
          if (error?.code !== "ENOENT") logger.warn(`[!] Fake document cleanup gagal: ${error.message}`);
        }
      },
    };
  }

  async function prepareCashDrawer({ job, attemptId, drawerProfileId }) {
    const context = createBaseContext({
      job,
      attemptId,
      adapter: "fake_cash_drawer_file",
      target: "fake://cash-drawer",
    });
    await controller.beforePrepare(context);
    const attemptDir = controller.getAttemptDir(context);
    const artifactPath = path.join(attemptDir, "drawer.json");

    return {
      adapter: context.adapter,
      target: context.target,
      async dispatch() {
        await controller.beforeArtifactWrite(context);
        writeJsonExclusive(controller, artifactPath, {
          kind: "fake_cash_drawer_dispatch",
          scenario: context.scenario,
          jobId: context.jobId,
          attemptId: context.attemptId,
          jobType: context.jobType,
          deviceType: context.deviceType,
          drawerProfileId,
          agentVersion,
          dispatchedAt: new Date().toISOString(),
        });
        await controller.afterArtifactWrite(context);
        return {
          mode: "fake",
          scenario: context.scenario,
          outputFile: artifactPath,
          drawerProfileId,
        };
      },
      async cleanup() {},
    };
  }

  return {
    prepareLabel,
    prepareDocument,
    prepareCashDrawer,
  };
}

module.exports = {
  createFakeHardwareBackend,
};
