"use client";

import { useEffect, useCallback } from "react";

interface ModalOverlayProps {
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;
}

export default function ModalOverlay({ open, onClose, children }: ModalOverlayProps) {
  const handleKey = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    },
    [onClose],
  );

  useEffect(() => {
    if (open) document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [open, handleKey]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* 배경 딤 */}
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-sm animate-fade-in"
        onClick={onClose}
      />
      {/* 모달 본체 */}
      <div className="relative z-10 w-full max-w-lg animate-fade-in">
        {children}
      </div>
    </div>
  );
}
