"use client";

import {
  Button,
  Divider,
  Modal,
  ModalBody,
  ModalContent,
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
      <div className="sticky top-0 z-30 flex items-center justify-between gap-4 border-b border-content2 bg-background/80 px-5 py-3 backdrop-blur md:hidden">
        <div>
          <h1 className="text-lg font-semibold">GrowMap</h1>
          <p className="text-tiny text-foreground-500">Cannabis ecosystem intelligence</p>
        </div>
        <Button color="success" variant="flat" size="sm" onPress={disclosure.onOpen}>
          Filters
        </Button>
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
              <div className="flex items-center justify-end gap-3 border-t border-content2 bg-content1 px-4 py-3">
                <Button variant="light" onPress={onClose}>
                  Close
                </Button>
              </div>
            </>
          )}
        </ModalContent>
      </Modal>

      <aside className="hidden border-r border-content2 bg-content1 md:block md:w-[360px]">
        {filterSidebar}
      </aside>
      <Divider className="md:hidden" />
      <main className="flex-1 min-h-[600px]">
        <Suspense fallback={<LoadingOverlay />}>
          <GrowMap filters={filters} />
        </Suspense>
      </main>
    </div>
  );
}
