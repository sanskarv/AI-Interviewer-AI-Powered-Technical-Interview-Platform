import { GoogleGenAI } from "@google/genai";
import { z } from "zod";
import { zodToJsonSchema } from "zod-to-json-schema";

const ai = new GoogleGenAI({
    apiKey: process.env.GEMINI_API_KEY!,
});

const outputSchema = z.object({
    feedback: z.string(),
    score: z.number().int().min(0).max(10),
});

const RESULT_PROMPT = `
You are an expert technical interviewer evaluating a Computer Science candidate.

Evaluate the interview transcript below.

Give:
1. A score from 0 to 10.
2. Detailed but concise feedback.
3. Focus on:
   - Technical knowledge
   - Understanding of projects
   - Problem solving
   - Communication
   - Accuracy of answers
   - Depth of responses

Important:
- If the candidate gave very short or incomplete answers, mention that.
- Do not invent answers that the candidate did not provide.
- Do not assume knowledge that is not present in the transcript.
- Return ONLY valid JSON.

Required format:

{
    "feedback": "string",
    "score": number
}

Interview transcript:
{{USER_TRANSCRIPT}}
`;

export class GeminiQuotaError extends Error {
    constructor(
        message = "Gemini API quota exceeded",
    ) {
        super(message);
        this.name = "GeminiQuotaError";
    }
}

export async function calculateResult(
    messages: {
        type: "Assistant" | "User";
        message: string;
        createdAt: Date;
    }[],
) {
    if (
        !messages ||
        messages.length === 0
    ) {
        return {
            feedback:
                "No interview transcript or responses were provided. Please complete an interview with detailed answers so your technical skills can be evaluated.",
            score: 0,
        };
    }

    const transcript = JSON.stringify(
        messages.map((message) => ({
            type: message.type,
            message: message.message,
        })),
    );

    const prompt =
        RESULT_PROMPT.replace(
            "{{USER_TRANSCRIPT}}",
            transcript,
        );

    try {
        console.log(
            "🧠 Sending interview to Gemini for evaluation...",
        );

        const response =
            await ai.models.generateContent(
                {
                    model:
                        "gemini-3.5-flash",
                    contents: prompt,
                    config: {
                        responseFormat: {
                            text: {
                                mimeType:
                                    "application/json",
                                schema:
                                    zodToJsonSchema(
                                        outputSchema,
                                    ),
                            },
                        },
                    },
                },
            );

        const text =
            response.text?.trim();

        console.log(
            "🤖 Gemini evaluation response:",
            text,
        );

        if (!text) {
            throw new Error(
                "Gemini returned an empty evaluation",
            );
        }

        const parsed =
            JSON.parse(text);

        return outputSchema.parse(
            parsed,
        );
    } catch (error: any) {
        const errorString =
            String(error);

        console.error(
            "❌ Gemini evaluation error:",
            errorString,
        );

        if (
            errorString.includes(
                "429",
            ) ||
            errorString.includes(
                "RESOURCE_EXHAUSTED",
            ) ||
            errorString.includes(
                "QuotaFailure",
            ) ||
            errorString.includes(
                "quota",
            )
        ) {
            throw new GeminiQuotaError();
        }

        throw error;
    }
}