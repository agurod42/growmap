"use client";

import {
  Accordion,
  AccordionItem,
  Autocomplete,
  AutocompleteItem,
  Button,
  Checkbox,
  CheckboxGroup,
  Radio,
  RadioGroup
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

  const handleClubModeChange = (mode: string) => {
    if (mode !== "off" && mode !== "enabled" && mode !== "restricted") return;
    onChange({
      ...value,
      clubZoneMode: mode
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
        <AccordionItem key="zones" aria-label="Club Zones" title="Club Zones">
          <div className="flex flex-col gap-4">
            <RadioGroup
              size="sm"
              value={value.clubZoneMode}
              onValueChange={handleClubModeChange}
            >
              <Radio value="off">Hide club zones</Radio>
              <Radio value="enabled">Show club-enabled zones</Radio>
              <Radio value="restricted">Show club-restricted zones</Radio>
            </RadioGroup>
          </div>
        </AccordionItem>
      </Accordion>

      <Button variant="flat" color="secondary" onPress={handleReset}>
        Reset filters
      </Button>
    </div>
  );
}
