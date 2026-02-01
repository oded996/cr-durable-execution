const { withDurableExecution } = require('cr-durable-execution');

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
    const userId = event.userId || (event.body && event.body.userId) || "test-user";
    
    console.log(`Starting workflow for user: ${userId}`);

    // 1. This step runs once and its result is saved
    const profile = await ctx.step("fetch-profile", async () => {
        return await fetchProfile(userId);
    });

    // 2. The function stops here and resumes. 
    console.log("Entering sleep...");
    await ctx.sleep(40); 

    // 3. Execution resumes here with 'profile' restored
    console.log("Resuming after sleep...");
    await ctx.step("send-follow-up", async () => {
        await sendEmail(profile.email, "Welcome back!");
    });

    return { success: true };
};

exports.myDurableFunction = withDurableExecution(workflow);
