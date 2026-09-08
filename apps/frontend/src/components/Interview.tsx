import { BACKEND_URL } from "@/lib/config";
import axios from "axios";
import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router";
import {
    Bot,
    Loader2,
    PhoneOff,
    User,
    Volume2,
} from "lucide-react";
import { Button } from "./ui/button";
import { VoiceOrb } from "./VoiceOrb";

type Status = "connecting" | "live" | "ending";

/**
 * Creates a simple microphone volume meter.
 */
function createLevelMeter(
    ctx: AudioContext,
    stream: MediaStream,
) {
    const source = ctx.createMediaStreamSource(stream);
    const analyser = ctx.createAnalyser();

    analyser.fftSize = 512;
    analyser.smoothingTimeConstant = 0.8;

    source.connect(analyser);

    const data = new Uint8Array(analyser.fftSize);

    return () => {
        analyser.getByteTimeDomainData(data);

        let sum = 0;

        for (let i = 0; i < data.length; i++) {
            const v = (data[i]! - 128) / 128;
            sum += v * v;
        }

        const rms = Math.sqrt(sum / data.length);

        return Math.min(1, rms * 3.2);
    };
}

export function Interview() {
    const { interviewId } = useParams();
    const navigate = useNavigate();

    const [status, setStatus] =
        useState<Status>("connecting");

    const [aiLevel, setAiLevel] = useState(0);
    const [userLevel, setUserLevel] = useState(0);

    // NEW:
    // Show the actual question on screen.
    const [currentQuestion, setCurrentQuestion] =
        useState("");

    // Shows whether we are currently accepting the user's answer.
    const [isListening, setIsListening] =
        useState(false);

    // -----------------------------------------
    // Resources
    // -----------------------------------------

    const socketRef =
        useRef<WebSocket | null>(null);

    const recorderRef =
        useRef<MediaRecorder | null>(null);

    const userStreamRef =
        useRef<MediaStream | null>(null);

    const audioCtxRef =
        useRef<AudioContext | null>(null);

    const rafRef =
        useRef<number | null>(null);

    // -----------------------------------------
    // Interview state
    // -----------------------------------------

    const askingQuestionRef =
        useRef(false);

    const aiSpeakingRef =
        useRef(false);

    const listeningForUserRef =
        useRef(false);

    const processingAnswerRef =
        useRef(false);

    const cancelledRef =
        useRef(false);

    // -----------------------------------------
    // Generate Gemini question
    // -----------------------------------------

    async function askGeminiQuestion() {
        if (!interviewId) {
            throw new Error(
                "Interview ID is missing",
            );
        }

        // Prevent duplicate Gemini requests.
        if (askingQuestionRef.current) {
            console.log(
                "Gemini question request already running",
            );

            return;
        }

        askingQuestionRef.current = true;

        // While Gemini is generating the next question,
        // don't accept microphone input as an answer.
        listeningForUserRef.current = false;
        setIsListening(false);

        try {
            console.log(
                "🤖 Asking Gemini for question...",
            );

            const response = await axios.post(
                `${BACKEND_URL}/api/v1/interview/question/${interviewId}`,
                {},
                {
                    timeout: 30000,
                },
            );

            const question =
                response.data?.question?.trim();

            if (!question) {
                throw new Error(
                    "Gemini returned an empty question",
                );
            }

            console.log(
                "🤖 Gemini question:",
                question,
            );

            if (cancelledRef.current) {
                return;
            }

            // Display question on screen.
            setCurrentQuestion(question);

            // Give browser time to render the question.
            await new Promise((resolve) =>
                setTimeout(resolve, 100),
            );

            if (!cancelledRef.current) {
                speakQuestion(question);
            }
        } catch (error: any) {
            console.error(
                "❌ Failed to generate interview question:",
                error,
            );

            // Gemini 429 = quota/rate limit.
            if (error?.response?.status === 429) {
                console.error(
                    "⚠️ Gemini rate limit/quota reached.",
                );
            }

            // Don't leave the user permanently stuck.
            aiSpeakingRef.current = false;

            listeningForUserRef.current = true;

            setIsListening(true);
            setAiLevel(0);
        } finally {
            askingQuestionRef.current = false;
        }
    }

    // -----------------------------------------
    // Browser Text-to-Speech
    // -----------------------------------------

    function speakQuestion(question: string) {
        if (
            !("speechSynthesis" in window)
        ) {
            console.warn(
                "Speech synthesis is not supported.",
            );

            // Question is still visible on screen.
            // Let the user answer manually.
            aiSpeakingRef.current = false;

            listeningForUserRef.current = true;

            setIsListening(true);

            return;
        }

        // Stop any previous speech.
        window.speechSynthesis.cancel();

        const utterance =
            new SpeechSynthesisUtterance(
                question,
            );

        utterance.lang = "en-US";
        utterance.rate = 0.95;
        utterance.pitch = 1;
        utterance.volume = 1;

        // Select an English voice if available.
        const voices =
            window.speechSynthesis.getVoices();

        const englishVoice =
            voices.find((voice) =>
                voice.lang
                    .toLowerCase()
                    .startsWith("en-us"),
            ) ??
            voices.find((voice) =>
                voice.lang
                    .toLowerCase()
                    .startsWith("en"),
            );

        if (englishVoice) {
            utterance.voice = englishVoice;
        }

        // -----------------------------------------
        // AI starts speaking
        // -----------------------------------------

        utterance.onstart = () => {
            console.log(
                "🔊 AI started speaking",
            );

            aiSpeakingRef.current = true;

            listeningForUserRef.current = false;

            setIsListening(false);

            setAiLevel(0.45);
        };

        // -----------------------------------------
        // IMPORTANT:
        // AI finished speaking
        // -----------------------------------------

        utterance.onend = () => {
            console.log(
                "🔊 AI finished speaking",
            );

            aiSpeakingRef.current = false;

            // NOW we accept the user's answer.
            listeningForUserRef.current = true;

            setIsListening(true);

            setAiLevel(0);

            console.log(
                "🎤 Listening for user's answer...",
            );
        };

        // -----------------------------------------
        // TTS error
        // -----------------------------------------

        utterance.onerror = (event) => {
            console.error(
                "❌ Speech synthesis error:",
                event,
            );

            aiSpeakingRef.current = false;

            // Even if TTS fails, the question is
            // visible on screen, so allow the user
            // to answer.
            listeningForUserRef.current = true;

            setIsListening(true);

            setAiLevel(0);

            console.log(
                "🎤 TTS failed; listening for user's answer.",
            );
        };

        window.speechSynthesis.speak(
            utterance,
        );
    }

    // -----------------------------------------
    // Replay current question
    // -----------------------------------------

    function replayQuestion() {
        if (
            !currentQuestion ||
            status === "ending"
        ) {
            return;
        }

        listeningForUserRef.current = false;

        setIsListening(false);

        speakQuestion(currentQuestion);
    }

    // -----------------------------------------
    // Start interview
    // -----------------------------------------

    useEffect(() => {
        let cancelled = false;

        cancelledRef.current = false;

        async function startInterview() {
            try {
                if (!interviewId) {
                    throw new Error(
                        "Interview ID is missing",
                    );
                }

                // -----------------------------------------
                // 1. Audio context
                // -----------------------------------------

                const audioCtx =
                    new AudioContext();

                audioCtxRef.current =
                    audioCtx;

                if (
                    audioCtx.state ===
                    "suspended"
                ) {
                    await audioCtx
                        .resume()
                        .catch(() => {});
                }

                let userMeter:
                    | (() => number)
                    | null = null;

                // -----------------------------------------
                // 2. Microphone
                // -----------------------------------------

                console.log(
                    "🎤 Requesting microphone...",
                );

                const mediaStream =
                    await navigator.mediaDevices.getUserMedia(
                        {
                            audio: {
                                echoCancellation: true,
                                noiseSuppression: true,
                                autoGainControl: true,
                            },
                        },
                    );

                if (cancelled) {
                    mediaStream
                        .getTracks()
                        .forEach((track) =>
                            track.stop(),
                        );

                    return;
                }

                userStreamRef.current =
                    mediaStream;

                userMeter =
                    createLevelMeter(
                        audioCtx,
                        mediaStream,
                    );

                console.log(
                    "🎤 Microphone ready",
                );

                // -----------------------------------------
                // 3. Deepgram token
                // -----------------------------------------

                console.log(
                    "🔑 Requesting Deepgram token...",
                );

                const tokenResponse =
                    await axios.get(
                        `${BACKEND_URL}/api/v1/deepgram-token`,
                        {
                            timeout: 15000,
                        },
                    );

                const deepgramToken =
                    tokenResponse.data?.token;

                console.log(
                    "🔑 Deepgram token received:",
                    deepgramToken
                        ? "YES"
                        : "NO",
                );

                if (!deepgramToken) {
                    throw new Error(
                        "Deepgram token was not received",
                    );
                }

                // -----------------------------------------
                // 4. Connect Deepgram
                // -----------------------------------------

                console.log(
                    "🔌 Connecting to Deepgram...",
                );

                const socket =
                    new WebSocket(
                        "wss://api.deepgram.com/v1/listen?model=nova-3&language=en-US&interim_results=true&smart_format=true",
                        [
                            "bearer",
                            deepgramToken,
                        ],
                    );

                socketRef.current =
                    socket;

                // -----------------------------------------
                // 5. Deepgram connected
                // -----------------------------------------

                socket.onopen = async () => {
                    console.log(
                        "✅ Connected to Deepgram",
                    );

                    if (cancelled) {
                        return;
                    }

                    try {
                        const recorder =
                            new MediaRecorder(
                                mediaStream,
                                {
                                    mimeType:
                                        "audio/webm",
                                },
                            );

                        recorderRef.current =
                            recorder;

                        recorder.addEventListener(
                            "dataavailable",
                            (event) => {
                                if (
                                    event.data
                                        .size >
                                        0 &&
                                    socket.readyState ===
                                        WebSocket.OPEN
                                ) {
                                    socket.send(
                                        event.data,
                                    );
                                }
                            },
                        );

                        // Send microphone chunks
                        // every 250ms.
                        recorder.start(250);

                        console.log(
                            "🎙️ Microphone streaming started",
                        );

                        // -----------------------------------------
                        // Generate first question
                        // -----------------------------------------

                        await askGeminiQuestion();

                        if (!cancelled) {
                            setStatus(
                                "live",
                            );
                        }
                    } catch (error) {
                        console.error(
                            "❌ Failed to start interview:",
                            error,
                        );
                    }
                };

                // -----------------------------------------
                // 6. Deepgram transcripts
                // -----------------------------------------

                socket.onmessage =
                    async (message) => {
                        try {
                            const received =
                                JSON.parse(
                                    message.data,
                                );

                            const transcript =
                                received.channel
                                    ?.alternatives?.[0]
                                    ?.transcript;

                            // Only process final speech.
                            if (
                                !transcript ||
                                !received.speech_final
                            ) {
                                return;
                            }

                            const finalTranscript =
                                transcript.trim();

                            if (
                                !finalTranscript
                            ) {
                                return;
                            }

                            // -----------------------------------------
                            // Ignore AI speech
                            // -----------------------------------------

                            if (
                                aiSpeakingRef.current
                            ) {
                                console.log(
                                    "🔇 Ignoring transcript while AI is speaking:",
                                    finalTranscript,
                                );

                                return;
                            }

                            // -----------------------------------------
                            // Ignore speech until AI has finished
                            // the question.
                            // -----------------------------------------

                            if (
                                !listeningForUserRef.current
                            ) {
                                console.log(
                                    "⏳ Ignoring transcript before listening starts:",
                                    finalTranscript,
                                );

                                return;
                            }

                            // -----------------------------------------
                            // Prevent duplicate answer processing
                            // -----------------------------------------

                            if (
                                processingAnswerRef.current
                            ) {
                                console.log(
                                    "⏳ Already processing user answer:",
                                    finalTranscript,
                                );

                                return;
                            }

                            processingAnswerRef.current =
                                true;

                            // Stop accepting additional
                            // transcript events while
                            // this answer is processed.
                            listeningForUserRef.current =
                                false;

                            setIsListening(
                                false,
                            );

                            console.log(
                                "👤 User transcript:",
                                finalTranscript,
                            );

                            // -----------------------------------------
                            // Save user answer
                            // -----------------------------------------

                            await axios.post(
                                `${BACKEND_URL}/api/v1/session/user/response/${interviewId}`,
                                {
                                    message:
                                        finalTranscript,
                                },
                                {
                                    timeout: 15000,
                                },
                            );

                            console.log(
                                "💾 User answer saved",
                            );

                            // -----------------------------------------
                            // Generate next question
                            // -----------------------------------------

                            await askGeminiQuestion();
                        } catch (error) {
                            console.error(
                                "❌ Error processing transcript:",
                                error,
                            );

                            if (
                                !aiSpeakingRef.current &&
                                !cancelledRef.current
                            ) {
                                listeningForUserRef.current =
                                    true;

                                setIsListening(
                                    true,
                                );
                            }
                        } finally {
                            processingAnswerRef.current =
                                false;
                        }
                    };

                // -----------------------------------------
                // 7. Deepgram errors
                // -----------------------------------------

                socket.onerror = (
                    event,
                ) => {
                    console.error(
                        "❌ Deepgram WebSocket error:",
                        event,
                    );
                };

                socket.onclose = (
                    event,
                ) => {
                    if (
                        !cancelledRef.current
                    ) {
                        console.error(
                            "❌ Deepgram WebSocket closed unexpectedly:",
                            "code =",
                            event.code,
                            "reason =",
                            event.reason,
                        );
                    } else {
                        console.log(
                            "🔌 Deepgram WebSocket closed during cleanup",
                        );
                    }
                };

                // -----------------------------------------
                // 8. Volume meter
                // -----------------------------------------

                const tick = () => {
                    if (
                        userMeter &&
                        !cancelledRef.current
                    ) {
                        setUserLevel(
                            userMeter(),
                        );
                    }

                    rafRef.current =
                        requestAnimationFrame(
                            tick,
                        );
                };

                rafRef.current =
                    requestAnimationFrame(
                        tick,
                    );
            } catch (error) {
                console.error(
                    "❌ Failed to start interview:",
                    error,
                );
            }
        }

        startInterview();

        return () => {
            cancelled = true;

            cancelledRef.current =
                true;

            cleanup();
        };

        // interviewId controls the interview lifecycle.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [interviewId]);

    // -----------------------------------------
    // Cleanup
    // -----------------------------------------

    function cleanup() {
        console.log(
            "🧹 Cleaning up interview...",
        );

        cancelledRef.current = true;

        askingQuestionRef.current =
            false;

        aiSpeakingRef.current =
            false;

        listeningForUserRef.current =
            false;

        processingAnswerRef.current =
            false;

        setIsListening(false);

        setAiLevel(0);

        if (rafRef.current) {
            cancelAnimationFrame(
                rafRef.current,
            );

            rafRef.current = null;
        }

        if (
            "speechSynthesis" in
            window
        ) {
            window.speechSynthesis.cancel();
        }

        if (recorderRef.current) {
            if (
                recorderRef.current
                    .state !==
                "inactive"
            ) {
                recorderRef.current.stop();
            }

            recorderRef.current = null;
        }

        socketRef.current?.close();

        socketRef.current = null;

        userStreamRef.current
            ?.getTracks()
            .forEach((track) =>
                track.stop(),
            );

        userStreamRef.current =
            null;

        audioCtxRef.current
            ?.close()
            .catch(() => {});

        audioCtxRef.current =
            null;
    }

    // -----------------------------------------
    // End interview
    // -----------------------------------------

    function endInterview() {
        if (status === "ending") {
            return;
        }

        setStatus("ending");

        cleanup();

        navigate(
            `/result/${interviewId}`,
        );
    }

    const aiSpeaking =
        aiLevel > 0.06;

    const userSpeaking =
        userLevel > 0.06;

    // -----------------------------------------
    // UI
    // -----------------------------------------

    return (
        <main className="flex h-screen w-screen flex-col overflow-hidden">
            {/* Header */}

            <header className="flex items-center justify-between px-6 py-5">
                <div className="flex items-center gap-2 text-sm font-medium">
                    <span className="relative flex size-2.5">
                        <span
                            className={
                                status ===
                                "live"
                                    ? "absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75"
                                    : "hidden"
                            }
                        />

                        <span
                            className={
                                "relative inline-flex size-2.5 rounded-full " +
                                (status ===
                                "live"
                                    ? "bg-emerald-400"
                                    : "bg-amber-400")
                            }
                        />
                    </span>

                    {status ===
                    "connecting"
                        ? "Connecting…"
                        : status ===
                            "ending"
                          ? "Wrapping up…"
                          : "Interview live"}
                </div>

                <span className="text-sm text-muted-foreground">
                    AI Interview
                </span>
            </header>

            {/* Main stage */}

            <div className="flex flex-1 flex-col items-center justify-center px-6">
                {status ===
                "connecting" ? (
                    <div className="flex flex-col items-center gap-3 text-muted-foreground">
                        <Loader2 className="size-7 animate-spin" />

                        <p className="text-sm">
                            Setting up your interview & microphone…
                        </p>
                    </div>
                ) : (
                    <div className="flex w-full max-w-4xl flex-col items-center gap-8">
                        {/* Question */}

                        <section className="w-full max-w-3xl rounded-2xl border border-border bg-card/60 p-6 text-center shadow-sm">
                            <div className="mb-3 flex items-center justify-center gap-2 text-sm font-medium text-muted-foreground">
                                <Bot className="size-4" />

                                Interviewer
                            </div>

                            {currentQuestion ? (
                                <p className="text-lg leading-relaxed">
                                    {
                                        currentQuestion
                                    }
                                </p>
                            ) : (
                                <p className="text-sm text-muted-foreground">
                                    Preparing your first question…
                                </p>
                            )}

                            <div className="mt-5 flex items-center justify-center gap-3">
                                <span className="text-sm text-muted-foreground">
                                    {aiSpeaking
                                        ? "Interviewer is speaking…"
                                        : isListening
                                          ? "Listening for your answer…"
                                          : "Preparing next question…"}
                                </span>

                                {currentQuestion &&
                                    !aiSpeaking && (
                                        <Button
                                            type="button"
                                            variant="ghost"
                                            size="sm"
                                            onClick={
                                                replayQuestion
                                            }
                                            className="gap-2"
                                        >
                                            <Volume2 className="size-4" />

                                            Replay
                                        </Button>
                                    )}
                            </div>
                        </section>

                        {/* Voice orbs */}

                        <div className="flex w-full items-center justify-center gap-12 sm:gap-24">
                            <VoiceOrb
                                level={
                                    aiLevel
                                }
                                speaking={
                                    aiSpeaking
                                }
                                label="Interviewer"
                                sublabel={
                                    aiSpeaking
                                        ? "Speaking"
                                        : "AI interviewer"
                                }
                                icon={
                                    Bot
                                }
                                accent="violet"
                            />

                            <VoiceOrb
                                level={
                                    userLevel
                                }
                                speaking={
                                    userSpeaking
                                }
                                label="You"
                                sublabel={
                                    isListening
                                        ? "Listening"
                                        : "Mic on"
                                }
                                icon={
                                    User
                                }
                                accent="emerald"
                            />
                        </div>
                    </div>
                )}
            </div>

            {/* Controls */}

            <footer className="flex justify-center px-6 py-8">
                <Button
                    variant="destructive"
                    size="lg"
                    onClick={
                        endInterview
                    }
                    disabled={
                        status ===
                        "ending"
                    }
                    className="gap-2 rounded-full px-6"
                >
                    {status ===
                    "ending" ? (
                        <Loader2 className="size-4 animate-spin" />
                    ) : (
                        <PhoneOff className="size-4" />
                    )}

                    End interview
                </Button>
            </footer>
        </main>
    );
}