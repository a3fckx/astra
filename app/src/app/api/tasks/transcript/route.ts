import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { Julep } from "@julep/sdk";
import { logger } from "@/lib/logger";
import { getUsers, getElevenLabsConversations } from "@/lib/mongo";
import { env } from "@/lib/env";
import fs from "fs";
import yaml from "yaml";

const transcriptLogger = logger.child("api:tasks:transcript");

const julepClient = new Julep({
  apiKey: env.julepApiKey!,
  environment: "production",
});

/**
 * Fetch conversation transcript from ElevenLabs API
 */
async function fetchTranscriptFromElevenLabs(
  conversationId: string,
): Promise<string | null> {
  try {
    const response = await fetch(
      `https://api.elevenlabs.io/v1/convai/conversations/${conversationId}`,
      {
        headers: {
          Authorization: `Bearer ${env.elevenLabsApiKey}`,
        },
      },
    );

    if (!response.ok) {
      transcriptLogger.error("Failed to fetch transcript from ElevenLabs", {
        conversationId,
        status: response.status,
      });
      return null;
    }

    const data = await response.json();

    // Extract transcript text from messages
    if (!data.transcript?.messages) {
      transcriptLogger.warn("No transcript messages found", { conversationId });
      return null;
    }

    const transcriptText = data.transcript.messages
      .map(
        (msg: { role: string; message: string }) =>
          `${msg.role.toUpperCase()}: ${msg.message}`,
      )
      .join("\n\n");

    return transcriptText;
  } catch (error) {
    transcriptLogger.error("Error fetching transcript", {
      conversationId,
      error: error instanceof Error ? error.message : String(error),
    });
    return null;
  }
}

/**
 * POST /api/tasks/transcript
 *
 * Triggers transcript processing task and syncs results to MongoDB user_overview
 *
 * Request body:
 * {
 *   conversation_id: string;
 *   user_id?: string;  // Optional, defaults to authenticated user
 * }
 */
export async function POST(request: Request) {
  try {
    // Check authentication
    const session = await auth.api.getSession({ headers: request.headers });

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { conversation_id } = body;

    if (!conversation_id) {
      return NextResponse.json(
        { error: "Missing conversation_id" },
        { status: 400 },
      );
    }

    const userId = body.user_id || session.user.id;

    // Get user from MongoDB
    const users = getUsers();
    const user = await users.findOne({ id: userId });

    if (!user) {
      transcriptLogger.error("User not found", { userId });
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    if (!user.julep_user_id) {
      transcriptLogger.error("User missing Julep ID", { userId });
      return NextResponse.json(
        { error: "User not linked to Julep" },
        { status: 500 },
      );
    }

    // Verify conversation belongs to user
    const conversations = getElevenLabsConversations();
    const conversation = await conversations.findOne({
      conversation_id,
      user_id: userId,
    });

    if (!conversation) {
      transcriptLogger.error("Conversation not found or unauthorized", {
        conversationId: conversation_id,
        userId,
      });
      return NextResponse.json(
        { error: "Conversation not found or unauthorized" },
        { status: 404 },
      );
    }

    transcriptLogger.info("Starting transcript processing", {
      conversationId: conversation_id,
      userId,
      julepUserId: user.julep_user_id,
    });

    // Fetch transcript from ElevenLabs
    const transcriptText = await fetchTranscriptFromElevenLabs(conversation_id);

    if (!transcriptText) {
      return NextResponse.json(
        { error: "Failed to fetch transcript from ElevenLabs" },
        { status: 500 },
      );
    }

    transcriptLogger.info("Transcript fetched", {
      conversationId: conversation_id,
      length: transcriptText.length,
    });

    // Load task definition
    const taskYamlPath = "agents/tasks/transcript-processor-simple.yaml";
    const taskYaml = fs.readFileSync(taskYamlPath, "utf8");
    const taskDef = yaml.parse(taskYaml);

    // Create task
    const task = await julepClient.tasks.create(
      env.backgroundWorkerAgentId || env.astraAgentId!,
      taskDef,
    );

    transcriptLogger.info("Task created", { taskId: task.id });

    // Execute task
    const execution = await julepClient.executions.create(task.id, {
      input: {
        julep_user_id: user.julep_user_id,
        conversation_id,
        transcript_text: transcriptText,
      },
    });

    transcriptLogger.info("Task execution started", {
      executionId: execution.id,
    });

    // Poll for completion
    let result;
    let pollCount = 0;
    const maxPolls = 60; // 2 minutes timeout

    while (pollCount < maxPolls) {
      result = await julepClient.executions.get(execution.id);

      if (result.status === "succeeded" || result.status === "failed") {
        break;
      }

      pollCount++;
      await new Promise((resolve) => setTimeout(resolve, 2000));
    }

    if (!result || result.status !== "succeeded") {
      transcriptLogger.error("Task execution failed", {
        executionId: execution.id,
        status: result?.status,
        error: result?.error,
      });

      // Update conversation with error
      await conversations.updateOne(
        { conversation_id },
        {
          $set: {
            status: "completed",
            updated_at: new Date(),
            metadata: {
              ...conversation.metadata,
              transcript_processed: false,
              error: result?.error || "Task execution timeout",
            },
          },
        },
      );

      return NextResponse.json(
        {
          error: "Task execution failed",
          details: result?.error || "Timeout",
        },
        { status: 500 },
      );
    }

    transcriptLogger.info("Task execution succeeded", {
      executionId: execution.id,
      output: result.output,
    });

    // Extract task output
    const extracted = result.output as {
      birth_details?: {
        date?: string;
        time?: string;
        location?: string;
        timezone?: string;
      };
      preferences?: {
        communication_style?: string;
        hinglish_level?: string;
        topics_of_interest?: string[];
        astrology_system?: string;
        emotional_tone?: string;
      };
      summary?: string;
      insights?: string[];
      questions?: string[];
      topics?: string[];
    };

    // Build MongoDB update
    const updates: Record<string, unknown> = {
      "user_overview.last_updated": new Date(),
      "user_overview.updated_by": execution.id,
    };

    // Update birth data if extracted
    if (extracted.birth_details?.date) {
      updates.date_of_birth = new Date(extracted.birth_details.date);
    }
    if (extracted.birth_details?.time) {
      updates.birth_time = extracted.birth_details.time;
    }
    if (extracted.birth_details?.location) {
      updates.birth_location = extracted.birth_details.location;
    }
    if (extracted.birth_details?.timezone) {
      updates.birth_timezone = extracted.birth_details.timezone;
    }

    // Update preferences if extracted
    if (extracted.preferences) {
      updates["user_overview.preferences"] = {
        communication_style: extracted.preferences.communication_style,
        hinglish_level: extracted.preferences.hinglish_level,
        topics_of_interest: extracted.preferences.topics_of_interest || [],
        astrology_system: extracted.preferences.astrology_system,
        emotional_tone: extracted.preferences.emotional_tone,
      };
    }

    // Prepare conversation summary for recent_conversations
    const conversationSummary = {
      conversation_id,
      date: new Date(),
      topics: extracted.topics || [],
      summary: extracted.summary || "",
      key_insights: extracted.insights || [],
      questions_asked: extracted.questions || [],
    };

    // Update MongoDB
    await users.updateOne(
      { id: userId },
      {
        $set: updates,
        $push: {
          "user_overview.recent_conversations": {
            $each: [conversationSummary],
            $slice: -10, // Keep last 10 conversations only
          },
        },
      },
    );

    transcriptLogger.info("MongoDB updated successfully", {
      userId,
      birthDataUpdated: !!extracted.birth_details?.date,
      preferencesUpdated: !!extracted.preferences,
    });

    // Update conversation status
    await conversations.updateOne(
      { conversation_id },
      {
        $set: {
          status: "completed",
          ended_at: new Date(),
          updated_at: new Date(),
          metadata: {
            ...conversation.metadata,
            transcript_processed: true,
            task_id: task.id,
            execution_id: execution.id,
          },
        },
      },
    );

    // Trigger additional tasks asynchronously (don't await)
    const triggerAdditionalTasks = async () => {
      // Trigger chart calculation if birth data is complete
      if (
        extracted.birth_details?.date &&
        extracted.birth_details?.time &&
        extracted.birth_details?.location
      ) {
        transcriptLogger.info("Triggering chart calculation", { userId });
        fetch(`${process.env.NEXT_PUBLIC_APP_URL || ""}/api/tasks/chart`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ user_id: userId }),
        }).catch((err) =>
          transcriptLogger.error("Failed to trigger chart calculation", err),
        );
      }

      // Trigger gamification update
      transcriptLogger.info("Triggering gamification update", { userId });
      fetch(`${process.env.NEXT_PUBLIC_APP_URL || ""}/api/tasks/gamification`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user_id: userId,
          conversation_id,
          event_type: "conversation_completed",
        }),
      }).catch((err) =>
        transcriptLogger.error("Failed to trigger gamification update", err),
      );
    };

    triggerAdditionalTasks();

    return NextResponse.json({
      success: true,
      task_id: task.id,
      execution_id: execution.id,
      conversation_id,
      message: "Transcript processed and MongoDB updated successfully",
      extracted: {
        birth_data_updated: !!extracted.birth_details?.date,
        preferences_updated: !!extracted.preferences,
        insights_count: extracted.insights?.length || 0,
        topics: extracted.topics || [],
      },
    });
  } catch (error) {
    transcriptLogger.error("Failed to process transcript", error as Error);

    return NextResponse.json(
      {
        error: "Internal server error",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}

/**
 * GET /api/tasks/transcript?execution_id=xxx
 *
 * Check status of a transcript processing task
 */
export async function GET(request: Request) {
  try {
    const session = await auth.api.getSession({ headers: request.headers });

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const executionId = searchParams.get("execution_id");

    if (!executionId) {
      return NextResponse.json(
        { error: "Missing execution_id" },
        { status: 400 },
      );
    }

    const execution = await julepClient.executions.get(executionId);

    return NextResponse.json({
      execution_id: executionId,
      status: execution.status,
      output: execution.output,
      error: execution.error,
    });
  } catch (error) {
    transcriptLogger.error("Failed to get execution status", error as Error);

    return NextResponse.json(
      {
        error: "Internal server error",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}
