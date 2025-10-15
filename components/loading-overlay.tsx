"use client";

import { Spinner } from "@heroui/react";

export function LoadingOverlay() {
  return (
    <div className="flex h-full min-h-[280px] w-full items-center justify-center bg-content1/70">
      <Spinner color="success" label="Loading map data..." />
    </div>
  );
}
