import { withDurableExecution, DurableContext } from '../src/index';

// Mock functions to simulate external calls
const fetchProfile = async (userId: string) => {
  console.log(`Fetching profile for ${userId}...`);
  return { id: userId, email: `${userId}@example.com` };
};

const sendEmail = async (email: string, message: string) => {
  console.log(`Sending email to ${email}: ${message}`);
  return { success: true };
};

const workflow = async (event: any, ctx: DurableContext) => {
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

export const myDurableFunction = withDurableExecution(workflow);