"use client";

import React, { memo, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion, useMotionValue, useReducedMotion, useSpring, useTransform } from "motion/react";

export function AnimatedNumber({ value, instant = false }: { value: number; instant?: boolean }) {
  const motionValue = useMotionValue(value);
  const shouldReduceMotion = useReducedMotion();
  const springValue = useSpring(motionValue, {
    stiffness: shouldReduceMotion ? 99999 : 90,
    damping: shouldReduceMotion ? 999 : 18,
  });
  const displayValue = useTransform(springValue, (latest) => Math.round(latest));

  useEffect(() => {
    motionValue.set(value);
  }, [value, motionValue]);

  if (instant) {
    return <span className="tabular-nums">{Math.round(value)}</span>;
  }

  return <motion.span className="tabular-nums">{displayValue}</motion.span>;
}

interface MicroInteractionButtonProps
  extends Omit<
    React.ButtonHTMLAttributes<HTMLButtonElement>,
    | "onAnimationStart"
    | "onAnimationEnd"
    | "onAnimationIteration"
    | "onDrag"
    | "onDragEnd"
    | "onDragEnter"
    | "onDragExit"
    | "onDragLeave"
    | "onDragOver"
    | "onDragStart"
    | "onDrop"
    | "style"
  > {
  loading?: boolean;
  style?: React.CSSProperties;
}

export const MicroInteractionButton = React.forwardRef<HTMLButtonElement, MicroInteractionButtonProps>(
  ({ children, onClick, disabled = false, loading = false, className = "", type = "button", style = {}, ...props }, ref) => {
    const fallbackRef = useRef<HTMLButtonElement>(null);
    const resolvedRef = (ref || fallbackRef) as React.RefObject<HTMLButtonElement | null>;
    const [width, setWidth] = useState<number | undefined>(undefined);
    const shouldReduceMotion = useReducedMotion();

    useEffect(() => {
      if (resolvedRef.current && !loading) {
        setWidth(resolvedRef.current.offsetWidth);
      }
    }, [loading, children, resolvedRef]);

    return (
      <motion.button
        ref={resolvedRef}
        type={type}
        disabled={disabled || loading}
        onClick={onClick}
        className={`focus-ring relative select-none transition disabled:opacity-45 ${className}`}
        style={{ ...style, width: loading ? width : undefined }}
        whileTap={disabled || loading || shouldReduceMotion ? {} : { scale: 0.98 }}
        transition={{ type: shouldReduceMotion ? "tween" : "spring", stiffness: 340, damping: 24 }}
        {...props}
      >
        <AnimatePresence mode="wait">
          {loading ? (
            <motion.span
              key="spinner"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: shouldReduceMotion ? 0.01 : 0.12 }}
              className="flex w-full items-center justify-center"
            >
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
            </motion.span>
          ) : (
            <motion.span
              key="content"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: shouldReduceMotion ? 0.01 : 0.12 }}
              className="inline-flex w-full items-center justify-center gap-1.5"
            >
              {children}
            </motion.span>
          )}
        </AnimatePresence>
      </motion.button>
    );
  }
);

MicroInteractionButton.displayName = "MicroInteractionButton";

export function MotionCard({
  children,
  onClick,
  className = "",
  index,
  style = {},
  ...props
}: {
  children: React.ReactNode;
  onClick?: () => void;
  className?: string;
  index?: number;
  style?: React.CSSProperties;
} & Omit<
  React.HTMLAttributes<HTMLDivElement>,
  | "onAnimationStart"
  | "onAnimationEnd"
  | "onAnimationIteration"
  | "onDrag"
  | "onDragEnd"
  | "onDragEnter"
  | "onDragExit"
  | "onDragLeave"
  | "onDragOver"
  | "onDragStart"
  | "onDrop"
  | "style"
>) {
  const shouldReduceMotion = useReducedMotion();
  const isClickable = Boolean(onClick);

  return (
    <motion.div
      onClick={onClick}
      initial={index !== undefined ? { opacity: 0, y: shouldReduceMotion ? 0 : 8 } : undefined}
      animate={index !== undefined ? { opacity: 1, y: 0 } : undefined}
      transition={{
        duration: shouldReduceMotion ? 0.01 : 0.2,
        ease: [0, 0, 0.2, 1],
        delay: index !== undefined && !shouldReduceMotion ? index * 0.025 : 0,
      }}
      whileTap={isClickable && !shouldReduceMotion ? { scale: 0.995 } : {}}
      className={`premium-card premium-card-hover ${isClickable ? "cursor-pointer select-none" : ""} ${className}`}
      style={style}
      {...props}
    >
      {children}
    </motion.div>
  );
}

export function EmptyState({
  mark = "--",
  title,
  description,
  actionLabel,
  onAction,
  loading = false,
  className = "",
}: {
  mark?: string;
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
  loading?: boolean;
  className?: string;
}) {
  const shouldReduceMotion = useReducedMotion();

  return (
    <motion.div
      initial={{ opacity: 0, y: shouldReduceMotion ? 0 : 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: shouldReduceMotion ? 0.01 : 0.2, ease: [0, 0, 0.2, 1] }}
      className={`surface-flat flex flex-col items-center justify-center p-6 text-center ${className}`}
    >
      <span className="mb-3 grid h-10 w-10 place-items-center rounded-lg bg-[var(--accent-soft)] text-xs font-semibold text-[var(--accent)]">
        {mark}
      </span>
      <h3 className="text-sm font-semibold tracking-tight text-[var(--text-primary)]">{title}</h3>
      <p className="mt-2 max-w-sm text-xs font-medium leading-5 text-[var(--text-secondary)]">{description}</p>
      {actionLabel && onAction ? (
        <MicroInteractionButton onClick={onAction} loading={loading} className="btn-primary mt-5">
          {actionLabel}
        </MicroInteractionButton>
      ) : null}
    </motion.div>
  );
}

const toneVars = {
  blue: "var(--accent)",
  green: "var(--success)",
  amber: "var(--sun)",
  rose: "var(--danger)",
  teal: "var(--teal)",
};

export const ProgressBar = memo(function ProgressBar({ value, tone = "blue" }: { value: number; tone?: "blue" | "green" | "amber" | "rose" | "teal" }) {
  const safeValue = Math.max(0, Math.min(100, value));

  return (
    <div className="h-2 w-full overflow-hidden rounded-full bg-[var(--track)]" role="progressbar" aria-valuenow={safeValue} aria-valuemin={0} aria-valuemax={100}>
      <div
        className="h-full origin-left rounded-full transition-transform duration-100 ease-out"
        style={{ transform: `scaleX(${safeValue / 100})`, backgroundColor: toneVars[tone] }}
      />
    </div>
  );
});

export const StatusBadge = memo(function StatusBadge({ label = "Updated", tone = "blue" }: { label?: string; tone?: "blue" | "green" | "amber" | "rose" | "teal" }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-[var(--border)] bg-[var(--bg-elevated)] px-2 py-1 text-[10px] font-semibold text-[var(--text-secondary)]">
      <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: toneVars[tone] }} />
      {label}
    </span>
  );
});
