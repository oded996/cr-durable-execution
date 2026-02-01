"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.myDurableFunction = void 0;
const index_1 = require("../src/index");
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
    const { userId } = event;
    // 1. This step runs once and its result is saved
    const profile = await ctx.step("fetch-profile", async () => {
        return await fetchProfile(userId);
    });
    // 2. The function stops here and resumes in 24 hours
    // You don't pay for the 24 hours of idle time!
    console.log("Entering sleep...");
    await ctx.sleep(86400);
    // 3. Execution resumes here with 'profile' restored
    await ctx.step("send-follow-up", async () => {
        await sendEmail(profile.email, "Welcome back!");
    });
    return { success: true };
};
exports.myDurableFunction = (0, index_1.withDurableExecution)(workflow);
//# sourceMappingURL=workflow.js.map