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
  const payload = event;

  // Atomic step: executed once, result persisted
  const profile = await ctx.step("fetch-profile", async () => {
    return await fetchProfile(payload.userId);
  });

  // Suspend execution for 40 seconds
  console.log("Entering sleep...");
  await ctx.sleep(40);

  // Resume with state restored
  await ctx.step("send-follow-up", async () => {
    await sendEmail(profile.email, "How was your day?");
  });

  return { finished: true };
};

export const durableEventFunction = withDurableExecution(workflow);
