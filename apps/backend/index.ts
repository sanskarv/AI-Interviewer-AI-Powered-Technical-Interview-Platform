import express from "express";
import { PreInterviewBody } from "./types";
import { scrapeGithub } from "./scrapers/github";
import cors from "cors";
import { prisma } from "./db";
import { initSideband } from "./sideband";
import {
    calculateResult,
    GeminiQuotaError,
} from "./result";
import { generateInterviewQuestion } from "./interviewer";

const evaluatingInterviews = new Set<string>();

const app = express();

app.use(express.json());
app.use(cors());
app.use(express.text({ type: ["application/sdp", "text/plain"] }));

app.post("/api/v1/pre-interview", async (req, res) => {
    try {
        const { success, data } = PreInterviewBody.safeParse(req.body);

        if (!success) {
            res.status(411).json({
                message: "Incorrect body",
            });
            return;
        }

        const githubUrl = data.github.endsWith("/")
            ? data.github.slice(0, -1)
            : data.github;

        const githubUsername = githubUrl.split("/").pop()!;

        const githubData = await scrapeGithub(githubUsername);

        const interview = await prisma.interview.create({
            data: {
                githubMetadata: JSON.stringify(githubData),
                status: "Pre",
            },
        });

        res.json({ id: interview.id });
    } catch (error) {
        console.error("Pre-interview error:", error);

        res.status(500).json({
            error: "Failed to create interview",
        });
    }
});

app.post("/api/v1/session/:interviewId", async (req, res) => {
    const sessionConfig = JSON.stringify({
        type: "realtime",
        model: "gpt-realtime",
        audio: {
            output: {
                voice: "marin",
            },
        },
    });

    const fd = new FormData();

    fd.set("sdp", req.body);
    fd.set("session", sessionConfig);

    try {
        const sdpResponse = await fetch(
            "https://api.openai.com/v1/realtime/calls",
            {
                method: "POST",
                headers: {
                    Authorization: `Bearer ${process.env.OPENAI_KEY}`,
                    "OpenAI-Safety-Identifier": "hashed-user-id",
                    Accept: "application/sdp",
                },
                body: fd,
            },
        );

        const sdp = await sdpResponse.text();

        console.log(
            "OpenAI status:",
            sdpResponse.status,
        );

        console.log(
            "OpenAI content-type:",
            sdpResponse.headers.get("content-type"),
        );

        if (!sdpResponse.ok) {
            console.error(
                "OpenAI response:",
                sdp,
            );

            res.status(500).json({
                error: "OpenAI Realtime request failed",
                status: sdpResponse.status,
                details: sdp,
            });

            return;
        }

        const location =
            sdpResponse.headers.get("Location");

        const callId =
            location?.split("/").pop();

        console.log(
            "OpenAI call ID:",
            callId,
        );

        res.type("application/sdp").send(sdp);

        if (callId) {
            initSideband(
                callId,
                req.params.interviewId,
            );
        }
    } catch (error) {
        console.error(
            "OpenAI Realtime error:",
            error,
        );

        res.status(500).json({
            error: "Failed to create realtime session",
        });
    }
});

app.post(
    "/api/v1/session/user/response/:interviewId",
    async (req, res) => {
        try {
            const { message } = req.body;

            if (
                typeof message !== "string" ||
                !message.trim()
            ) {
                res.status(400).json({
                    message: "Message is required",
                });

                return;
            }

            await prisma.message.create({
                data: {
                    interviewId:
                        req.params.interviewId,
                    type: "User",
                    message: message.trim(),
                },
            });

            res.json({
                message: "Message saved",
            });
        } catch (error) {
            console.error(
                "Save user response error:",
                error,
            );

            res.status(500).json({
                error: "Failed to save user response",
            });
        }
    },
);

app.get(
    "/api/v1/deepgram-token",
    async (req, res) => {
        try {
            if (!process.env.DEEPGRAM_API_KEY) {
                res.status(500).json({
                    error:
                        "DEEPGRAM_API_KEY is not configured",
                });

                return;
            }

            const response = await fetch(
                "https://api.deepgram.com/v1/auth/grant",
                {
                    method: "POST",
                    headers: {
                        Authorization: `Token ${process.env.DEEPGRAM_API_KEY}`,
                        "Content-Type":
                            "application/json",
                    },
                    body: JSON.stringify({
                        ttl_seconds: 60,
                    }),
                },
            );

            if (!response.ok) {
                const error =
                    await response.text();

                console.error(
                    "Deepgram token error:",
                    error,
                );

                res.status(500).json({
                    error:
                        "Failed to generate Deepgram token",
                });

                return;
            }

            const data =
                (await response.json()) as {
                    access_token?: string;
                };

            if (!data.access_token) {
                res.status(500).json({
                    error:
                        "Deepgram did not return an access token",
                });

                return;
            }

            res.json({
                token: data.access_token,
            });
        } catch (error) {
            console.error(
                "Deepgram token error:",
                error,
            );

            res.status(500).json({
                error:
                    "Failed to generate Deepgram token",
            });
        }
    },
);

app.post(
    "/api/v1/interview/question/:interviewId",
    async (req, res) => {
        try {
            const question =
                await generateInterviewQuestion(
                    req.params.interviewId,
                );

            res.json({
                question,
            });
        } catch (error: any) {
            console.error(
                "Interview question error:",
                error,
            );

            const errorString =
                String(error);

            if (
                errorString.includes("429") ||
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
                res.status(429).json({
                    error:
                        "Gemini quota exceeded",
                    message:
                        "The Gemini free-tier quota has been reached. Please try again later.",
                });

                return;
            }

            res.status(500).json({
                error:
                    "Failed to generate interview question",
                details: errorString,
            });
        }
    },
);

app.get(
    "/api/v1/result/:interviewId",
    async (req, res) => {
        const interviewId =
            req.params.interviewId;

        try {
            const interview =
                await prisma.interview.findUnique({
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
                res.status(404).json({
                    message:
                        "Interview not found",
                });

                return;
            }

            const transcript =
                interview.conversations.map(
                    (c) => ({
                        type: c.type,
                        content: c.message,
                        createdAt:
                            c.createdAt,
                    }),
                );

            // -----------------------------------------
            // Already evaluated.
            // Never call Gemini again.
            // -----------------------------------------

            if (
                interview.status ===
                    "Done" &&
                interview.feedback !== null
            ) {
                console.log(
                    "✅ Returning cached result:",
                    interviewId,
                );

                res.json({
                    score:
                        interview.score ??
                        0,
                    feedback:
                        interview.feedback,
                    transcript,
                    status: "Done",
                });

                return;
            }

            // -----------------------------------------
            // No transcript.
            // -----------------------------------------

            if (
                interview.conversations
                    .length === 0
            ) {
                res.json({
                    score: 0,
                    feedback:
                        "No interview transcript or responses were recorded.",
                    transcript: [],
                    status:
                        interview.status,
                });

                return;
            }

            // -----------------------------------------
            // Another request is already evaluating.
            // -----------------------------------------

            if (
                evaluatingInterviews.has(
                    interviewId,
                )
            ) {
                console.log(
                    "⏳ Evaluation already running:",
                    interviewId,
                );

                res.json({
                    score:
                        interview.score ??
                        0,
                    feedback:
                        "Your interview is currently being analyzed. Please wait.",
                    transcript,
                    status: "InProgress",
                });

                return;
            }

            // -----------------------------------------
            // Lock this interview.
            // -----------------------------------------

            evaluatingInterviews.add(
                interviewId,
            );

            try {
                console.log(
                    "🧠 Starting Gemini evaluation:",
                    interviewId,
                );

                const result =
                    await calculateResult(
                        interview.conversations.map(
                            (c) => ({
                                type: c.type as
                                    | "Assistant"
                                    | "User",
                                message:
                                    c.message,
                                createdAt:
                                    c.createdAt,
                            }),
                        ),
                    );

                // -----------------------------------------
                // Save result.
                // -----------------------------------------

                await prisma.interview.update({
                    where: {
                        id: interviewId,
                    },
                    data: {
                        status: "Done",
                        feedback:
                            result.feedback,
                        score: result.score,
                    },
                });

                console.log(
                    "✅ Interview evaluation saved:",
                    interviewId,
                );

                res.json({
                    score: result.score,
                    feedback:
                        result.feedback,
                    transcript,
                    status: "Done",
                });
            } catch (error) {
                // -----------------------------------------
                // Gemini quota.
                // -----------------------------------------

                if (
                    error instanceof
                    GeminiQuotaError
                ) {
                    console.error(
                        "⚠️ Gemini quota exceeded:",
                        interviewId,
                    );

                    res.status(429).json({
                        error:
                            "Gemini quota exceeded",
                        message:
                            "Your interview transcript was saved, but the Gemini free-tier quota has been reached. The AI evaluation can be generated after the quota resets.",
                        transcript,
                        status:
                            interview.status,
                    });

                    return;
                }

                console.error(
                    "❌ Interview evaluation failed:",
                    error,
                );

                res.status(500).json({
                    error:
                        "Failed to calculate interview result",
                    message:
                        "Your interview transcript was saved, but the AI evaluation failed.",
                    transcript,
                    status:
                        interview.status,
                });
            } finally {
                // Always release the lock.
                evaluatingInterviews.delete(
                    interviewId,
                );
            }
        } catch (error) {
            console.error(
                "❌ Result API error:",
                error,
            );

            res.status(500).json({
                error:
                    "Failed to fetch interview result",
            });
        }
    },
);

app.listen(3001, () => {
    console.log(
        "🚀 Backend running at http://localhost:3001",
    );
});