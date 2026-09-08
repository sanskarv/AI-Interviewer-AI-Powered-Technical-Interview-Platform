import { BACKEND_URL } from "@/lib/config";
import axios from "axios";
import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router";
import {
    AlertTriangle,
    Bot,
    Loader2,
    Sparkles,
    User,
} from "lucide-react";
import { Button } from "./ui/button";
import { cn } from "@/lib/utils";

interface TranscriptMessage {
    type: "Assistant" | "User";
    content: string;
    createdAt: string;
}

type ResultStatus =
    | "Done"
    | "InProgress"
    | "Pre"
    | "QuotaExceeded"
    | "Error";

interface ResultData {
    transcript: TranscriptMessage[];
    score: number;
    feedback: string;
    status: ResultStatus;
}

export function Result() {
    const { interviewId } = useParams();
    const navigate = useNavigate();

    const [result, setResult] =
        useState<ResultData>({
            score: 0,
            feedback: "",
            transcript: [],
            status: "InProgress",
        });

    const [loading, setLoading] =
        useState(true);

    const [error, setError] =
        useState("");

    useEffect(() => {
        if (!interviewId) {
            setError("Interview ID is missing.");
            setLoading(false);
            return;
        }

        let cancelled = false;

        const fetchResult = async () => {
            try {
                console.log(
                    "📊 Fetching interview result...",
                );

                const response =
                    await axios.get(
                        `${BACKEND_URL}/api/v1/result/${interviewId}`,
                        {
                            timeout: 30000,
                        },
                    );

                if (cancelled) {
                    return;
                }

                console.log(
                    "📊 Result received:",
                    response.data,
                );

                setResult(response.data);
                setError("");
            } catch (err: any) {
                if (cancelled) {
                    return;
                }

                console.error(
                    "❌ Failed to fetch result:",
                    err.response?.data ??
                        err,
                );

                // Gemini quota exceeded.
                if (
                    err.response?.status ===
                    429
                ) {
                    const data =
                        err.response?.data;

                    setResult({
                        score:
                            data?.score ??
                            0,
                        feedback:
                            data?.message ??
                            "Your interview transcript was saved, but AI evaluation is temporarily unavailable because the Gemini free-tier quota has been reached.",
                        transcript:
                            data?.transcript ??
                            [],
                        status:
                            "QuotaExceeded",
                    });

                    setError("");
                    return;
                }

                setError(
                    err.response?.data
                        ?.message ??
                        "Unable to load your interview result.",
                );
            } finally {
                if (!cancelled) {
                    setLoading(false);
                }
            }
        };

        fetchResult();

        return () => {
            cancelled = true;
        };
    }, [interviewId]);

    const ready =
        result.status === "Done";

    const quotaExceeded =
        result.status ===
        "QuotaExceeded";

    return (
        <main className="mx-auto min-h-screen w-full max-w-3xl px-6 py-12">
            <header className="mb-10 flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-semibold tracking-tight">
                        Interview results
                    </h1>

                    <p className="mt-1 text-sm text-muted-foreground">
                        Your feedback and full conversation transcript.
                    </p>
                </div>

                <Button
                    variant="outline"
                    onClick={() =>
                        navigate("/")
                    }
                >
                    New interview
                </Button>
            </header>

            {/* Loading */}

            {loading && (
                <div className="flex flex-col items-center justify-center gap-4 rounded-xl border border-border bg-card/50 py-24 text-center">
                    <Loader2 className="size-7 animate-spin text-muted-foreground" />

                    <div>
                        <p className="font-medium">
                            Analyzing your interview…
                        </p>

                        <p className="mt-1 text-sm text-muted-foreground">
                            This usually takes a few seconds.
                        </p>
                    </div>
                </div>
            )}

            {/* General error */}

            {!loading &&
                error && (
                    <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-6">
                        <div className="flex items-center gap-2 font-medium">
                            <AlertTriangle className="size-5" />

                            Unable to load results
                        </div>

                        <p className="mt-3 text-sm text-muted-foreground">
                            {error}
                        </p>

                        <Button
                            className="mt-5"
                            onClick={() =>
                                window.location.reload()
                            }
                        >
                            Try again
                        </Button>
                    </div>
                )}

            {/* Gemini quota */}

            {!loading &&
                !error &&
                quotaExceeded && (
                    <div className="mb-8 rounded-xl border border-amber-500/30 bg-amber-500/10 p-6">
                        <div className="flex items-center gap-2 font-medium">
                            <AlertTriangle className="size-5" />

                            AI evaluation temporarily unavailable
                        </div>

                        <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                            Your interview was
                            completed and the
                            transcript was saved
                            successfully.
                        </p>

                        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                            Gemini's free-tier
                            quota has been reached,
                            so an AI score and
                            feedback cannot be
                            generated right now.
                        </p>
                    </div>
                )}

            {/* Successful result */}

            {!loading &&
                !error &&
                ready && (
                    <section className="rounded-xl border border-border bg-card/60 p-6 backdrop-blur">
                        <div className="flex items-start justify-between gap-6">
                            <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                                <Sparkles className="size-4 text-violet-400" />

                                AI Feedback
                            </div>

                            <div className="flex shrink-0 items-baseline gap-1">
                                <span className="text-3xl font-bold tracking-tight">
                                    {result.score}
                                </span>

                                <span className="text-sm text-muted-foreground">
                                    / 10
                                </span>
                            </div>
                        </div>

                        <p className="mt-4 whitespace-pre-wrap text-sm leading-relaxed text-foreground/90">
                            {result.feedback}
                        </p>
                    </section>
                )}

            {/* Transcript */}

            {!loading &&
                !error && (
                    <section className="mt-8">
                        <h2 className="mb-4 text-sm font-medium text-muted-foreground">
                            Conversation
                        </h2>

                        {result.transcript
                            .length ===
                        0 ? (
                            <p className="text-sm text-muted-foreground">
                                No messages were recorded for this interview.
                            </p>
                        ) : (
                            <div className="flex flex-col gap-4">
                                {result.transcript.map(
                                    (m, i) => {
                                        const isAi =
                                            m.type ===
                                            "Assistant";

                                        return (
                                            <div
                                                key={
                                                    i
                                                }
                                                className={cn(
                                                    "flex gap-3",
                                                    isAi
                                                        ? "justify-start"
                                                        : "flex-row-reverse",
                                                )}
                                            >
                                                <div
                                                    className={cn(
                                                        "grid size-8 shrink-0 place-items-center rounded-full text-white",
                                                        isAi
                                                            ? "bg-gradient-to-br from-violet-400 to-indigo-600"
                                                            : "bg-gradient-to-br from-emerald-300 to-teal-600",
                                                    )}
                                                >
                                                    {isAi ? (
                                                        <Bot className="size-4" />
                                                    ) : (
                                                        <User className="size-4" />
                                                    )}
                                                </div>

                                                <div
                                                    className={cn(
                                                        "max-w-[80%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed",
                                                        isAi
                                                            ? "rounded-tl-sm bg-card text-foreground"
                                                            : "rounded-tr-sm bg-primary text-primary-foreground",
                                                    )}
                                                >
                                                    {
                                                        m.content
                                                    }
                                                </div>
                                            </div>
                                        );
                                    },
                                )}
                            </div>
                        )}
                    </section>
                )}
        </main>
    );
}