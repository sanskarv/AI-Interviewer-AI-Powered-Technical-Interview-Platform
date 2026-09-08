import { GoogleGenAI } from "@google/genai";
import { prisma } from "./db";

const ai = new GoogleGenAI({
    apiKey: process.env.GEMINI_API_KEY!,
});

export async function generateInterviewQuestion(interviewId: string) {
    const interview = await prisma.interview.findUnique({
        where: {
            id: interviewId,
        },
        include: {
            conversations: {
                orderBy: {
                    createdAt: "asc",
                },
            },
        },
    });

    if (!interview) {
        throw new Error("Interview not found");
    }

    const githubMetadata = JSON.stringify(interview.githubMetadata);

    const conversation = interview.conversations
        .map((message) => `${message.type}: ${message.message}`)
        .join("\n");

    const prompt = `
You are an AI technical interviewer.

You are interviewing a Computer Science candidate.

Ask around 2-3 technical questions based on the candidate's GitHub projects and previous answers.

Rules:
- Speak only English.
- Ask ONE question at a time.
- Keep the question concise.
- Questions should be technical and relevant to the candidate's experience.
- If the candidate has already answered a topic, move to another topic.
- Do not give the answer to the question.
- Do not add unnecessary commentary.
- Return ONLY the next interview question.

Candidate GitHub information:
${githubMetadata}

Previous conversation:
${conversation || "No previous conversation. Start the interview."}
`;

    const response = await ai.models.generateContent({
        model: "gemini-3.5-flash",
        contents: prompt,
    });

    const question = response.text?.trim();

    if (!question) {
        throw new Error("Gemini returned an empty question");
    }

    await prisma.message.create({
    data: {
        interviewId,
        type: "Assistant",
        message: question,
    },
    });

    await prisma.interview.update({
        where: {
            id: interviewId,
        },
        data: {
            status: "InProgress",
        },
    });

    return question;
}