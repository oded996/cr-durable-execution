import { withDurableExecution, DurableContext } from 'cr-durable-execution';

const workflow = async (event: any, ctx: DurableContext) => {
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
};

export const shortSleepFunction = withDurableExecution(workflow);
