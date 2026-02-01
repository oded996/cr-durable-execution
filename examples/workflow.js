"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.durableEventFunction = void 0;
const src_1 = require("../src");
// Mock functions to simulate external calls
const fetchProfile = async (userId) => {
    console.log(`Fetching profile for ${userId}...`);
    return { id: userId, email: `${userId}@example.com` };
};
const sendEmail = async (email, message) => {
    console.log(`Sending email to ${email}: ${message}`);
    return { success: true };
};
const workflow = async (event, ctx) => {
    const payload = event;
    // Atomic step: executed once, result persisted
    const profile = await ctx.step("fetch-profile", async () => {
        return await fetchProfile(payload.userId);
    });
    // Suspend execution for 24 hours (simulated here)
    console.log("Entering sleep...");
    await ctx.sleep(86400);
    // Resume with state restored
    await ctx.step("send-follow-up", async () => {
        await sendEmail(profile.email, "How was your day?");
    });
    return { finished: true };
};
exports.durableEventFunction = (0, src_1.withDurableExecution)(workflow);
//# sourceMappingURL=workflow.js.map