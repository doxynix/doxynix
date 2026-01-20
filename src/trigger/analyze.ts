// import { logger, task } from "@trigger.dev/sdk/v3";
// import { enhance } from "@zenstackhq/runtime";

// import { prisma } from "@/shared/api/db/db";

// export const analyzeRepoTask = task({
//   id: "analyze-repo",

//   maxDuration: 900,

//   run: async (payload: { repoUrl: string; projectId: string; userId: string }, { ctx }) => {
//     logger.log("🚀 Analysis started!", { projectId: payload.projectId });

//     // const files = await gitClone(payload.repoUrl);
//     // const metrics = await calculateMetrics(files);
//     // const docs = await askGptToWriteDocs(files);

//     // const db = enhance(prisma, {
//     //   user: { publicId: payload.userId },
//     // });

//     await new Promise((r) => setTimeout(r, 5000));
//     const fakeResult = { lines: 5000, complexity: "High", docs: "Readme.md updated" };

//     logger.log("✅ Analysis finished, saving...");

//     // await db.analysis.update({
//     //   where: { publicId: payload.projectId },
//     //   data: {
//     //     status: "DONE",
//     //     metricsJson: JSON.stringify(fakeResult),
//     //   },
//     // });

//     // await pusherServer.trigger(`project-${payload.projectId}`, "analysis-ready", {
//     //   projectId: payload.projectId,
//     //   status: "COMPLETED",
//     // });

//     return { success: true };
//   },
// });
