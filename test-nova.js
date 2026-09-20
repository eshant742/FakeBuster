const { BedrockRuntimeClient, ConverseCommand } = require('@aws-sdk/client-bedrock-runtime');

const client = new BedrockRuntimeClient({
  region: process.env.AWS_REGION || 'us-east-1',
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
});

async function test() {
  try {
    const command = new ConverseCommand({
      modelId: 'amazon.nova-2-lite-v1:0',
      messages: [
        {
          role: 'user',
          content: [{ text: 'hello' }]
        }
      ]
    });
    const response = await client.send(command);
    console.log("Success:", response.output.message.content[0].text);
  } catch (err) {
    console.error("Error Name:", err.name);
    console.error("Error Message:", err.message);
  }
}
test();
