import { withDurableExecution, DurableContext } from 'cr-durable-execution';
const workflow = async (event, ctx) => {
    console.log("Starting workflow for event:", JSON.stringify(event));
    const { userId = "default-user" } = event;
    // 1. This step runs once and its result is saved
    const profile = await ctx.step("fetch-profile", async () => {
        console.log("Fetching profile for", userId);
        return { id: userId, email: `${userId}@example.com`, name: "Test User" };
    });
    console.log("Profile fetched:", JSON.stringify(profile));
    // 2. The function stops here and resumes in 40 seconds
    // We use 40 seconds to trigger the Cloud Tasks logic (which README says is > 30s)
    console.log("Sleeping for 40 seconds...");
    await ctx.sleep(40);
    // 3. Execution resumes here with 'profile' restored
    const result = await ctx.step("send-follow-up", async () => {
        console.log("Sending follow-up to", profile.email);
        return { sent: true, to: profile.email };
    });
    console.log("Workflow complete. Result:", JSON.stringify(result));
    return { success: true, result };
};
export const myDurableFunction = withDurableExecution(workflow);
export const shortSleepFunction = withDurableExecution(async (event, ctx) => {
    console.log("Starting short sleep workflow");
    await ctx.step("step-1", async () => {
        console.log("Step 1 executed");
    });
    console.log("Sleeping for 5 seconds (should NOT suspend)...");
    await ctx.sleep(5);
    await ctx.step("step-2", async () => {
        console.log("Step 2 executed");
    });
    console.log("Short sleep workflow complete");
    return { success: true };
});
//# sourceMappingURL=index.js.map