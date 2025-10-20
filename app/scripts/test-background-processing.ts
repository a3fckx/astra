/**
 * Test if background transcript processing works for a conversation
 */

const CONVERSATION_ID = "conv_8801k7q7x3xsewxar4amj9876ywq"; // Latest conversation

async function testProcessing() {
	console.log("\n🧪 Testing Background Transcript Processing\n");
	console.log("Conversation ID:", CONVERSATION_ID);
	
	try {
		console.log("\n📤 Triggering processing via API...");
		const response = await fetch("http://localhost:3000/api/tasks/transcript", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ conversation_id: CONVERSATION_ID }),
		});
		
		console.log("Response status:", response.status, response.statusText);
		
		const result = await response.json();
		console.log("Response:", JSON.stringify(result, null, 2));
		
		if (response.ok) {
			console.log("\n✅ Processing triggered successfully!");
		} else {
			console.log("\n❌ Processing failed!");
		}
	} catch (error) {
		console.error("\n❌ Error:", error);
	}
}

testProcessing();
