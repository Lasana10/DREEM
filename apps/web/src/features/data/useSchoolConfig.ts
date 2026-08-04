import { useEffect, useState } from "react";
import { defaultSchoolConfig } from "../../shared/data";
import type { SchoolConfig, UserProfile } from "../../shared/types";
import {
  loadSchoolConfig,
  saveSchoolConfig
} from "./repositories/schoolConfigRepository";

type ConfigTextField =
  | "schoolName"
  | "campusName"
  | "academicYear"
  | "activeTerm"
  | "gradingLabel"
  | "currency"
  | "matriculePrefix"
  | "institutionEdition"
  | "countryPack";

export function useSchoolConfig(activeUser: UserProfile | null) {
  const [config, setConfig] = useState<SchoolConfig>(defaultSchoolConfig);

  useEffect(() => {
    let active = true;

    async function hydrateConfig() {
      const loaded = await loadSchoolConfig(activeUser);
      if (active) {
        setConfig(loaded);
      }
    }

    void hydrateConfig();

    return () => {
      active = false;
    };
  }, [activeUser?.schoolId]);

  function updateConfig(nextConfig: SchoolConfig) {
    setConfig(nextConfig);
    void saveSchoolConfig(activeUser, nextConfig);
  }

  function addListItem(field: "classes" | "subjects" | "feeCategories", value: string) {
    const trimmed = value.trim();
    if (!trimmed) {
      return;
    }

    if (config[field].includes(trimmed)) {
      return;
    }

    updateConfig({
      ...config,
      [field]: [...config[field], trimmed]
    });
  }

  function removeListItem(field: "classes" | "subjects" | "feeCategories", value: string) {
    updateConfig({
      ...config,
      [field]: config[field].filter((item) => item !== value)
    });
  }

  function updateField(field: ConfigTextField, value: string) {
    updateConfig({
      ...config,
      [field]: value
    });
  }

  function updateArrayField(field: "enabledModules" | "languages" | "terms", values: string[]) {
    updateConfig({
      ...config,
      [field]: values
    });
  }

  function updateTerminology(key: string, value: string) {
    updateConfig({
      ...config,
      terminology: {
        ...(config.terminology ?? {}),
        [key]: value
      }
    });
  }

  return {
    config,
    addListItem,
    removeListItem,
    updateField,
    updateArrayField,
    updateTerminology
  };
}
