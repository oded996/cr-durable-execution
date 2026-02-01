import { withDurableExecution, DurableContext } from 'cr-durable-execution';

const workflow = async (event: any, ctx: DurableContext) => {
  console.log('Starting workflow with event:', JSON.stringify(event));
  const userId = event.userId || 'anonymous';

  const profile = await ctx.step("fetch-profile", async () => {
    console.log('Fetching profile for', userId);
    return { id: userId, email: `${userId}@example.com`, name: 'Test User' };
  });

  console.log('Profile fetched:', JSON.stringify(profile));

  const sleepTime = event.sleepSeconds || 31; 
  console.log(`Sleeping for ${sleepTime} seconds...`);
  await ctx.sleep(sleepTime); 

  console.log('Resumed from sleep. Sending follow-up...');
  const result = await ctx.step("send-follow-up", async () => {
    console.log('Sending follow-up email to', profile.email);
    return { sent: true, to: profile.email };
  });

  return { success: true, result };
};

export const myDurableFunction = withDurableExecution(workflow);
