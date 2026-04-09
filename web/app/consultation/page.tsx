"use client";

import { Suspense } from "react";
import ConsultationForm from "./ConsultationForm";

export default function ConsultationPage() {
  return (
    <Suspense fallback={null}>
      <ConsultationForm />
    </Suspense>
  );
}
