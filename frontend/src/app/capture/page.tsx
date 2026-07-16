"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { ApiRequestError, useAuthenticatedApi } from "../apiClient";
import { PrimaryAction } from "../preferences/components";

const MAX_CAPTURE_DIMENSION = 1600;
const CAMERA_ERROR_MESSAGE =
  "Camera access is unavailable. You can still choose a photo from your library.";
const PREVIEW_FRAME_CLASS =
  "overflow-hidden rounded-2xl border border-[#4A413C]/15 bg-[#D8D3CC]/45 " +
  "shadow-[0_24px_70px_rgba(62,46,41,0.10)]";
const SECONDARY_ACTION_CLASS =
  "rounded-md border border-[#4A413C]/20 px-6 py-3 font-sans text-sm " +
  "font-semibold text-[#3E2E29] transition hover:bg-[#D8D3CC]/45";
const VIEWFINDER_FRAME_CLASS =
  "relative overflow-hidden rounded-2xl border border-[#4A413C]/15 " +
  "bg-[#D8D3CC]/45 shadow-[0_24px_70px_rgba(62,46,41,0.10)]";
const PROCESSING_SECTION_CLASS =
  "mx-auto flex min-h-[calc(100vh-4rem)] w-full max-w-3xl flex-col " +
  "justify-center gap-8";
const SPINNER_CLASS =
  "h-9 w-9 animate-spin rounded-full border-[3px] border-[#4A413C]/15 " +
  "border-t-[#B8674A]";
const VIEWFINDER_CONTROLS_CLASS =
  "absolute inset-x-0 bottom-0 flex items-center justify-center px-6 pb-6";
const LIBRARY_ICON_BUTTON_CLASS =
  "absolute left-6 flex h-12 w-12 items-center justify-center rounded-full " +
  "bg-[#3E2E29]/40 text-[#FAF9F8] backdrop-blur-sm transition " +
  "hover:bg-[#3E2E29]/55";
const CAMERA_BUTTON_CLASS =
  "flex h-[72px] w-[72px] items-center justify-center rounded-full " +
  "border-[4px] border-[#FAF9F8] p-1 " +
  "shadow-[0_6px_18px_rgba(62,46,41,0.35)] transition active:scale-95";
const VIEWFINDER_OVERLAY_CLASS =
  "absolute inset-0 flex items-center justify-center px-6 text-center";

type ScanResponse = {
  classificationFailed?: boolean;
  id: string;
};

function revokePreviewUrl(previewUrl: string | null) {
  if (previewUrl?.startsWith("blob:")) {
    URL.revokeObjectURL(previewUrl);
  }
}

function getScaledDimensions(width: number, height: number) {
  const scale = Math.min(MAX_CAPTURE_DIMENSION / Math.max(width, height), 1);

  return {
    height: Math.round(height * scale),
    width: Math.round(width * scale),
  };
}

function makeCanvasBlob(canvas: HTMLCanvasElement): Promise<Blob | null> {
  return new Promise((resolve) => {
    canvas.toBlob(resolve, "image/jpeg", 0.9);
  });
}

export default function CapturePage() {
  const authenticatedApi = useAuthenticatedApi();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();
  const streamRef = useRef<MediaStream | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [isCameraStarting, setIsCameraStarting] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [photoBlob, setPhotoBlob] = useState<Blob | File | null>(null);
  const [photoFileName, setPhotoFileName] = useState("capture.jpg");
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const stopCameraStream = useCallback(() => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;

    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  }, []);

  const startCameraStream = useCallback(async () => {
    if (!navigator.mediaDevices?.getUserMedia) {
      setCameraError(CAMERA_ERROR_MESSAGE);
      setIsCameraStarting(false);
      return;
    }

    setCameraError(null);
    setIsCameraStarting(true);

    try {
      let stream: MediaStream;

      try {
        stream = await navigator.mediaDevices.getUserMedia({
          audio: false,
          video: { facingMode: { ideal: "environment" } },
        });
      } catch {
        stream = await navigator.mediaDevices.getUserMedia({
          audio: false,
          video: true,
        });
      }

      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
    } catch {
      stopCameraStream();
      setCameraError(CAMERA_ERROR_MESSAGE);
    } finally {
      setIsCameraStarting(false);
    }
  }, [stopCameraStream]);

  useEffect(() => {
    if (previewUrl) {
      return;
    }

    const startCameraTimer = window.setTimeout(() => {
      void startCameraStream();
    }, 0);

    return () => {
      window.clearTimeout(startCameraTimer);
      stopCameraStream();
    };
  }, [previewUrl, startCameraStream, stopCameraStream]);

  useEffect(() => {
    return () => {
      stopCameraStream();
      revokePreviewUrl(previewUrl);
    };
  }, [previewUrl, stopCameraStream]);

  function updatePreviewMedia(
    nextPreviewUrl: string,
    nextPhotoBlob: Blob | File,
    nextPhotoFileName: string,
  ) {
    setPreviewUrl((currentPreviewUrl) => {
      revokePreviewUrl(currentPreviewUrl);
      return nextPreviewUrl;
    });
    setPhotoBlob(nextPhotoBlob);
    setPhotoFileName(nextPhotoFileName);
    setSubmitError(null);
  }

  async function captureFrame() {
    const canvas = canvasRef.current;
    const video = videoRef.current;

    if (!canvas || !video || video.videoWidth === 0 || video.videoHeight === 0) {
      setCameraError("The camera is still warming up. Try again in a moment.");
      return;
    }

    const dimensions = getScaledDimensions(video.videoWidth, video.videoHeight);
    const context = canvas.getContext("2d");

    if (!context) {
      setCameraError("Photo capture is unavailable in this browser.");
      return;
    }

    canvas.width = dimensions.width;
    canvas.height = dimensions.height;
    context.drawImage(video, 0, 0, dimensions.width, dimensions.height);

    const capturedFrame = await makeCanvasBlob(canvas);
    if (!capturedFrame) {
      setCameraError("Photo capture is unavailable in this browser.");
      return;
    }

    stopCameraStream();
    updatePreviewMedia(
      URL.createObjectURL(capturedFrame),
      capturedFrame,
      "capture.jpg",
    );
  }

  function chooseFromLibrary() {
    fileInputRef.current?.click();
  }

  function handleFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];

    if (!file) {
      return;
    }

    stopCameraStream();
    updatePreviewMedia(URL.createObjectURL(file), file, file.name || "upload.jpg");
  }

  function retakePhoto() {
    setPreviewUrl((currentPreviewUrl) => {
      revokePreviewUrl(currentPreviewUrl);
      return null;
    });
    setCameraError(null);
    setIsSubmitting(false);
    setPhotoBlob(null);
    setPhotoFileName("capture.jpg");
    setSubmitError(null);

    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }

  async function submitScan() {
    if (!photoBlob || isSubmitting) {
      return;
    }

    setSubmitError(null);
    setIsSubmitting(true);

    const formData = new FormData();
    formData.append("photo", photoBlob, photoFileName);

    try {
      const scanResponse = await authenticatedApi<ScanResponse>("/api/items/scan", {
        body: formData,
        method: "POST",
      });

      if (scanResponse.classificationFailed) {
        router.push(`/items/${scanResponse.id}/correct`);
        return;
      }

      router.push(`/items/${scanResponse.id}`);
    } catch (error) {
      const message =
        error instanceof ApiRequestError
          ? error.message
          : "Scan submission failed. Try again shortly.";
      setSubmitError(message);
      setIsSubmitting(false);
    }
  }

  if (isSubmitting && previewUrl) {
    return (
      <main className="relative min-h-screen bg-background px-6 py-8 text-foreground">
        <div aria-hidden="true" className="grain-overlay" />
        <section className={PROCESSING_SECTION_CLASS}>
          <div className={PREVIEW_FRAME_CLASS}>
            <div className="relative aspect-[3/4] w-full">
              <Image
                alt="Captured item"
                className="object-cover"
                fill
                sizes="(min-width: 768px) 768px, 100vw"
                src={previewUrl}
                unoptimized
              />
            </div>
          </div>

          <div className="flex flex-col items-center gap-3 py-4" role="status">
            <span className={SPINNER_CLASS} />
            <p className="font-sans text-sm font-medium text-[#4A413C]">
              Analyzing your item...
            </p>
          </div>
        </section>
      </main>
    );
  }

  return (
    <main className="relative min-h-screen bg-background px-6 py-8 text-foreground">
      <div aria-hidden="true" className="grain-overlay" />
      <div className="mx-auto flex min-h-[calc(100vh-4rem)] w-full max-w-3xl flex-col">
        <nav>
          <Link href="/" className="auth-back-link">
            Back
          </Link>
        </nav>

        <section className="flex flex-1 flex-col justify-center gap-8 py-10">
          <header className="space-y-4 text-center">
            <h1 className="font-serif text-5xl font-semibold tracking-normal text-[#3E2E29]">
              Capture your item
            </h1>
            <p className="mx-auto max-w-sm text-base leading-7 text-[#4A413C]">
              Center the item in frame
            </p>
          </header>

          {previewUrl ? (
            <section className="space-y-6">
              <div className={PREVIEW_FRAME_CLASS}>
                <div className="relative aspect-[3/4] w-full">
                  <Image
                    alt="Selected item preview"
                    className="object-cover"
                    fill
                    sizes="(min-width: 768px) 768px, 100vw"
                    src={previewUrl}
                    unoptimized
                  />
                </div>
              </div>

              <div className="flex flex-col gap-3 sm:flex-row sm:justify-center">
                <button
                  className={SECONDARY_ACTION_CLASS}
                  onClick={retakePhoto}
                  type="button"
                >
                  Retake
                </button>
                <PrimaryAction disabled={!photoBlob} onClick={submitScan}>
                  Continue
                </PrimaryAction>
              </div>
              {submitError ? (
                <p className="text-center font-sans text-sm text-[#4A413C]">
                  {submitError}
                </p>
              ) : null}
            </section>
          ) : (
            <section className="space-y-6">
              <div className={VIEWFINDER_FRAME_CLASS}>
                <video
                  autoPlay
                  className="aspect-[3/4] w-full bg-[#3E2E29] object-cover"
                  muted
                  playsInline
                  ref={videoRef}
                />

                {isCameraStarting ? (
                  <div className={`${VIEWFINDER_OVERLAY_CLASS} bg-[#D8D3CC]/80`}>
                    <p className="font-sans text-sm font-medium text-[#4A413C]">
                      Starting camera...
                    </p>
                  </div>
                ) : null}

                {cameraError ? (
                  <div className={`${VIEWFINDER_OVERLAY_CLASS} bg-[#D8D3CC]/90`}>
                    <p className="max-w-xs text-sm leading-6 text-[#4A413C]">
                      {cameraError}
                    </p>
                  </div>
                ) : null}

                <div className={VIEWFINDER_CONTROLS_CLASS}>
                  <button
                    aria-label="Choose from library"
                    className={LIBRARY_ICON_BUTTON_CLASS}
                    onClick={chooseFromLibrary}
                    type="button"
                  >
                    <svg
                      aria-hidden="true"
                      className="h-5 w-5"
                      fill="none"
                      stroke="currentColor"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      viewBox="0 0 24 24"
                    >
                      <rect height="18" rx="2" width="18" x="3" y="3" />
                      <circle cx="8.5" cy="8.5" r="1.5" />
                      <path d="M21 15l-5-5L5 21" />
                    </svg>
                  </button>

                  {!isCameraStarting && !cameraError ? (
                    <button
                      aria-label="Capture photo"
                      className={CAMERA_BUTTON_CLASS}
                      onClick={captureFrame}
                      type="button"
                    >
                      <span className="h-full w-full rounded-full bg-[#B8674A]" />
                    </button>
                  ) : null}
                </div>
              </div>
            </section>
          )}

          <input
            accept="image/*"
            className="sr-only"
            onChange={handleFileChange}
            ref={fileInputRef}
            type="file"
          />
          <canvas aria-hidden="true" className="hidden" ref={canvasRef} />
        </section>
      </div>
    </main>
  );
}
