"use client";

import { Accordion, AccordionItem, Button, Checkbox, CheckboxGroup, Slider } from "@heroui/react";

import {
  cannabisCategoryOptions,
  defaultFilterState,
  restrictedCategoryOptions
} from "./filter-schema";
import { MapFilterState } from "@/types/map";

type FilterSidebarProps = {
  value: MapFilterState;
  onChange: (value: MapFilterState) => void;
  onReset?: () => void;
};

export function FilterSidebar({ value, onChange, onReset }: FilterSidebarProps) {
  const handleCannabisChange = (keys: string[]) => {
    onChange({
      ...value,
      cannabisCategories: keys as MapFilterState["cannabisCategories"]
    });
  };

  const handleRestrictedChange = (keys: string[]) => {
    onChange({
      ...value,
      restrictedCategories: keys as MapFilterState["restrictedCategories"]
    });
  };

  const handleClubToggle = (checked: boolean) => {
    onChange({
      ...value,
      showClubEnabledAreas: checked
    });
  };

  const handleRadiusChange = (radius: number | number[]) => {
    const nextRadius = Array.isArray(radius) ? radius[0] : radius;
    onChange({
      ...value,
      searchRadius: nextRadius
    });
  };

  const handleReset = () => {
    onChange(defaultFilterState);
    onReset?.();
  };

  return (
    <div className="flex h-full flex-col gap-6 p-6">
      <div>
        <h1 className="text-2xl font-semibold">GrowMap</h1>
        <p className="text-small text-foreground-500">
          Explore cannabis ecosystem data and compliance insights around you.
        </p>
      </div>

      <Accordion variant="splitted">
        <AccordionItem key="cannabis" aria-label="Cannabis Business Types" title="Cannabis Types">
          <CheckboxGroup value={value.cannabisCategories} onChange={handleCannabisChange}>
            {Object.entries(cannabisCategoryOptions).map(([key, label]) => (
              <Checkbox key={key} value={key}>
                {label}
              </Checkbox>
            ))}
          </CheckboxGroup>
        </AccordionItem>
        <AccordionItem key="restricted" aria-label="Restricted Places" title="Sensitive Places">
          <CheckboxGroup value={value.restrictedCategories} onChange={handleRestrictedChange}>
            {Object.entries(restrictedCategoryOptions).map(([key, label]) => (
              <Checkbox key={key} value={key}>
                {label}
              </Checkbox>
            ))}
          </CheckboxGroup>
        </AccordionItem>
        <AccordionItem key="zones" aria-label="Club Zones" title="Club Enabled Areas">
          <div className="flex flex-col gap-4">
            <Checkbox
              isSelected={value.showClubEnabledAreas}
              onValueChange={handleClubToggle}
              className="max-w-fit"
            >
              Highlight eligible areas
            </Checkbox>
            <div>
              <p className="text-small text-foreground-500">Search radius (meters)</p>
              <Slider
                size="sm"
                maxValue={5000}
                minValue={300}
                step={50}
                value={value.searchRadius}
                onChange={handleRadiusChange}
                showTooltip
              />
              <p className="mt-2 text-tiny text-foreground-500">
                Current radius: <span className="font-semibold text-foreground">{value.searchRadius}</span> m
              </p>
            </div>
          </div>
        </AccordionItem>
      </Accordion>

      <Button variant="flat" color="secondary" onPress={handleReset}>
        Reset filters
      </Button>
    </div>
  );
}
