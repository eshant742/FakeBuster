require('dotenv').config({ path: '.env.local' });
const { BedrockRuntimeClient, InvokeModelCommand } = require('@aws-sdk/client-bedrock-runtime');

const client = new BedrockRuntimeClient({
  region: process.env.AWS_REGION || 'us-east-1',
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
});

async function test() {
  try {
    console.log("Testing Bedrock with key:", process.env.AWS_ACCESS_KEY_ID);
    const response = await client.send(
      new InvokeModelCommand({
        modelId: 'anthropic.claude-3-haiku-20240307-v1:0',
        contentType: 'application/json',
        accept: 'application/json',
        body: JSON.stringify({
          anthropic_version: 'bedrock-2023-05-31',
          max_tokens: 100,
          messages: [{ role: 'user', content: 'hello' }],
        }),
      })
    );
    console.log("Success:", new TextDecoder().decode(response.body));
  } catch (err) {
    console.error("Error Name:", err.name);
    console.error("Error Message:", err.message);
  }
}
test();
