"use client";

import {
  Accordion,
  AccordionItem,
  Autocomplete,
  AutocompleteItem,
  Button,
  Checkbox,
  CheckboxGroup,
  Slider
} from "@heroui/react";
import { useMemo } from "react";

import {
  cannabisCategoryOptions,
  restrictedCategoryOptions
} from "./filter-schema";
import {
  cityOptions,
  createDefaultFiltersForCity,
  getCityRestrictedCategories
} from "@/lib/config/cities";
import { MapFilterState } from "@/types/map";
import type { CityId, RestrictedCategory } from "@/types/map";

type FilterSidebarProps = {
  value: MapFilterState;
  onChange: (value: MapFilterState) => void;
  onReset?: () => void;
};

export function FilterSidebar({ value, onChange, onReset }: FilterSidebarProps) {
  const allowedRestrictedCategories = useMemo(
    () => new Set<RestrictedCategory>(getCityRestrictedCategories(value.cityId)),
    [value.cityId]
  );

  const handleCityChange = (cityKey: string | null) => {
    if (!cityKey) return;
    const cityId = cityKey as CityId;
    const defaults = createDefaultFiltersForCity(cityId);
    onChange({
      ...value,
      ...defaults
    });
  };

  const handleCannabisChange = (keys: string[]) => {
    onChange({
      ...value,
      cannabisCategories: keys as MapFilterState["cannabisCategories"]
    });
  };

  const handleRestrictedChange = (keys: string[]) => {
    const filteredKeys = keys.filter((key): key is RestrictedCategory =>
      allowedRestrictedCategories.has(key as RestrictedCategory)
    );

    onChange({
      ...value,
      restrictedCategories: filteredKeys
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
    const defaults = createDefaultFiltersForCity(value.cityId);
    onChange(defaults);
    onReset?.();
  };

  const restrictedOptions = useMemo(() => {
    return Array.from(allowedRestrictedCategories).map((category) => [
      category,
      restrictedCategoryOptions[category]
    ]) as [RestrictedCategory, string][];
  }, [allowedRestrictedCategories]);

  return (
    <div className="flex h-full flex-col gap-6 p-6">
      <div>
        <h1 className="text-2xl font-semibold">GrowMap</h1>
        <p className="text-small text-foreground-500">
          Explore cannabis ecosystem data and compliance insights around you.
        </p>
      </div>

      <Autocomplete
        label="City"
        defaultItems={cityOptions}
        selectedKey={value.cityId}
        onSelectionChange={(key) => handleCityChange(key as string | null)}
        size="sm"
      >
        {(item) => <AutocompleteItem key={item.id}>{item.label}</AutocompleteItem>}
      </Autocomplete>

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
            {restrictedOptions.map(([key, label]) => (
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
