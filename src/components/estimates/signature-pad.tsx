"use client";

import { useEffect, useRef } from "react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function SignaturePad({
  disabled,
  onChange,
}: {
  disabled?: boolean;
  onChange: (dataUrl: string | null) => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const dirty = useRef(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const ratio = Math.max(1, window.devicePixelRatio || 1);
    const width = canvas.clientWidth || 320;
    const height = 140;
    canvas.width = Math.floor(width * ratio);
    canvas.height = Math.floor(height * ratio);
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    ctx.lineWidth = 2.5;
    ctx.lineCap = "round";
    ctx.strokeStyle = "#171717";
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, width, height);
  }, []);

  function pos(e: React.PointerEvent<HTMLCanvasElement>) {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  }

  function emit() {
    const canvas = canvasRef.current;
    if (!canvas || !dirty.current) {
      onChange(null);
      return;
    }
    onChange(canvas.toDataURL("image/png"));
  }

  return (
    <div className="space-y-2">
      <canvas
        ref={canvasRef}
        className={cn(
          "h-[140px] w-full touch-none rounded-lg border border-input bg-white",
          disabled && "opacity-60"
        )}
        onPointerDown={(e) => {
          if (disabled) return;
          const canvas = canvasRef.current;
          const ctx = canvas?.getContext("2d");
          if (!canvas || !ctx) return;
          canvas.setPointerCapture(e.pointerId);
          drawing.current = true;
          const { x, y } = pos(e);
          ctx.beginPath();
          ctx.moveTo(x, y);
        }}
        onPointerMove={(e) => {
          if (disabled || !drawing.current) return;
          const ctx = canvasRef.current?.getContext("2d");
          if (!ctx) return;
          const { x, y } = pos(e);
          ctx.lineTo(x, y);
          ctx.stroke();
          dirty.current = true;
        }}
        onPointerUp={() => {
          drawing.current = false;
          emit();
        }}
        onPointerLeave={() => {
          drawing.current = false;
          emit();
        }}
      />
      <Button
        type="button"
        variant="outline"
        className="min-h-11"
        disabled={disabled}
        onClick={() => {
          const canvas = canvasRef.current;
          const ctx = canvas?.getContext("2d");
          if (!canvas || !ctx) return;
          ctx.setTransform(1, 0, 0, 1, 0, 0);
          const ratio = Math.max(1, window.devicePixelRatio || 1);
          ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
          ctx.fillStyle = "#ffffff";
          ctx.fillRect(0, 0, canvas.clientWidth, 140);
          dirty.current = false;
          onChange(null);
        }}
      >
        Clear signature
      </Button>
    </div>
  );
}
