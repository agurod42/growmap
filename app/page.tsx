"use client";

import {
  Badge,
  Button,
  Divider,
  Modal,
  ModalBody,
  ModalContent,
  ModalFooter,
  ModalHeader,
  useDisclosure
} from "@heroui/react";
import dynamic from "next/dynamic";
import { Suspense, useMemo, useState } from "react";

import { FilterSidebar } from "@/components/filter-sidebar";
import { defaultFilterState } from "@/components/filter-sidebar/filter-schema";
import { LoadingOverlay } from "@/components/loading-overlay";
import { createDefaultFiltersForCity } from "@/lib/config/cities";
import { MapFilterState } from "@/types/map";

const GrowMap = dynamic(() => import("@/components/map/grow-map"), {
  ssr: false,
  loading: () => <LoadingOverlay />
});

export default function HomePage() {
  const [filters, setFilters] = useState<MapFilterState>(defaultFilterState);
  const disclosure = useDisclosure();
  const handleResetFilters = () =>
    setFilters((previous) => createDefaultFiltersForCity(previous.cityId));

  const hasCustomFilters = useMemo(() => {
    const defaults = createDefaultFiltersForCity(filters.cityId);
    const hasChangedCity = filters.cityId !== defaultFilterState.cityId;

    const arraysDiffer = (current: string[], base: string[]) => {
      if (current.length !== base.length) return true;
      const baseSet = new Set(base);
      return current.some((value) => !baseSet.has(value));
    };

    return (
      hasChangedCity ||
      arraysDiffer(filters.cannabisCategories, defaults.cannabisCategories) ||
      arraysDiffer(filters.restrictedCategories, defaults.restrictedCategories) ||
      filters.clubZoneMode !== defaults.clubZoneMode
    );
  }, [filters]);

  const filterSidebar = useMemo(
    () => (
      <FilterSidebar
        value={filters}
        onChange={setFilters}
        onReset={handleResetFilters}
      />
    ),
    [filters]
  );

  return (
    <div className="flex min-h-screen flex-col md:flex-row">
      <div className="sticky top-0 z-30 flex items-center justify-between gap-4 border-b border-content2 bg-background/80 px-5 py-3 backdrop-blur supports-[backdrop-filter]:bg-background/60 md:hidden">
        <div>
          <h1 className="text-lg font-semibold">GrowMap</h1>
          <p className="text-tiny text-foreground-500">Cannabis ecosystem intelligence</p>
        </div>
        <Badge className="shrink-0" color="success" isDot isInvisible={!hasCustomFilters} placement="top-left">
          <Button color="success" variant="flat" size="sm" onPress={disclosure.onOpen}>
            Filters
          </Button>
        </Badge>
      </div>

      <Modal isOpen={disclosure.isOpen} onClose={disclosure.onClose} size="full" scrollBehavior="inside">
        <ModalContent>
          {(onClose) => (
            <>
              <ModalHeader className="border-b border-content2 bg-content1 text-small uppercase text-foreground-500">
                Refine your map view
              </ModalHeader>
              <ModalBody className="bg-content1 p-0">
                <div className="h-full overflow-y-auto">{filterSidebar}</div>
              </ModalBody>
              <ModalFooter className="border-t border-content2 bg-content1">
                <Button variant="light" onPress={onClose}>
                  Close
                </Button>
              </ModalFooter>
            </>
          )}
        </ModalContent>
      </Modal>

      <aside className="hidden border-r border-content2 bg-content1 md:block md:w-[360px]">
        {filterSidebar}
      </aside>
      <Divider className="md:hidden" />
      <main className="flex w-full flex-1 flex-col h-[calc(100vh-4rem)] min-h-[calc(100vh-4rem)] supports-[height:100dvh]:h-[calc(100dvh-4rem)] supports-[height:100dvh]:min-h-[calc(100dvh-4rem)] supports-[height:100svh]:h-[calc(100svh-4rem)] supports-[height:100svh]:min-h-[calc(100svh-4rem)] md:h-auto md:min-h-screen">
        <Suspense fallback={<LoadingOverlay />}>
          <GrowMap filters={filters} />
        </Suspense>
      </main>
    </div>
  );
}
