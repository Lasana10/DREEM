import { defaultSchoolConfig } from "../../../shared/data";
import type { SchoolConfig, UserProfile } from "../../../shared/types";
import { env } from "../../../lib/env";
import { supabase } from "../../../lib/supabase";

type SchoolSettingsRow = {
  school_name: string;
  grading_label: string;
  currency: string;
  campus_name: string | null;
  academic_year: string | null;
  active_term: string | null;
  matricule_prefix: string | null;
  institution_edition: SchoolConfig["institutionEdition"] | null;
  country_pack: SchoolConfig["countryPack"] | null;
  enabled_modules: string[] | null;
  languages: SchoolConfig["languages"] | null;
  terminology: SchoolConfig["terminology"] | null;
};

type SchoolClassRow = {
  class_name: string;
};

type SchoolSubjectRow = {
  subject_name: string;
};

type FeeCategoryRow = {
  category_name: string;
};

const STORAGE_KEY = "dreem:school-config";

function getConfigKey(schoolId?: string) {
  return `${STORAGE_KEY}:${schoolId ?? "demo-school"}`;
}

function loadLocalConfig(schoolId?: string) {
  if (typeof window === "undefined") {
    return defaultSchoolConfig;
  }

  const raw = window.localStorage.getItem(getConfigKey(schoolId));
  if (!raw) {
    return defaultSchoolConfig;
  }

  try {
    return JSON.parse(raw) as SchoolConfig;
  } catch {
    return defaultSchoolConfig;
  }
}

function saveLocalConfig(schoolId: string | undefined, config: SchoolConfig) {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(getConfigKey(schoolId), JSON.stringify(config));
}

async function syncNamedCollection(
  schoolId: string,
  table: "school_classes" | "school_subjects" | "fee_categories",
  column: "class_name" | "subject_name" | "category_name",
  values: string[]
) {
  if (!supabase) {
    return;
  }

  const { data, error } = await supabase.from(table).select(`id,${column}`).eq("school_id", schoolId);
  if (error) {
    throw error;
  }

  const existing = (data ?? []) as Array<{ id: string } & Record<typeof column, string>>;
  const currentValues = existing.map((item) => item[column]);

  const toInsert = values.filter((item) => !currentValues.includes(item));
  const toDelete = existing.filter((item) => !values.includes(item[column]));

  if (toInsert.length > 0) {
    const { error: insertError } = await supabase.from(table).insert(
      toInsert.map((value) => ({
        school_id: schoolId,
        [column]: value
      }))
    );

    if (insertError) {
      throw insertError;
    }
  }

  if (toDelete.length > 0) {
    const { error: deleteError } = await supabase.from(table).delete().in(
      "id",
      toDelete.map((item) => item.id)
    );

    if (deleteError) {
      throw deleteError;
    }
  }
}

export async function loadSchoolConfig(activeUser: UserProfile | null) {
  if (!activeUser?.schoolId) {
    return defaultSchoolConfig;
  }

  if (env.demoMode || !supabase) {
    return loadLocalConfig(activeUser.schoolId);
  }

  const [settingsResponse, classesResponse, subjectsResponse, feeCategoriesResponse] =
    await Promise.all([
      supabase
        .from("school_settings")
        .select("school_name,grading_label,currency,campus_name,academic_year,active_term,matricule_prefix,institution_edition,country_pack,enabled_modules,languages,terminology")
        .eq("school_id", activeUser.schoolId)
        .maybeSingle(),
      supabase
        .from("school_classes")
        .select("class_name")
        .eq("school_id", activeUser.schoolId)
        .order("class_name"),
      supabase
        .from("school_subjects")
        .select("subject_name")
        .eq("school_id", activeUser.schoolId)
        .order("subject_name"),
      supabase
        .from("fee_categories")
        .select("category_name")
        .eq("school_id", activeUser.schoolId)
        .order("category_name")
    ]);

  const errors = [
    settingsResponse.error,
    classesResponse.error,
    subjectsResponse.error,
    feeCategoriesResponse.error
  ].filter(Boolean);

  if (errors.length > 0) {
    throw errors[0];
  }

  const settings = settingsResponse.data as SchoolSettingsRow | null;
  const localConfig = loadLocalConfig(activeUser.schoolId);
  const config: SchoolConfig = {
    ...defaultSchoolConfig,
    ...localConfig,
    schoolName: settings?.school_name ?? defaultSchoolConfig.schoolName,
    gradingLabel: settings?.grading_label ?? defaultSchoolConfig.gradingLabel,
    currency: settings?.currency ?? defaultSchoolConfig.currency,
    campusName: settings?.campus_name ?? localConfig.campusName,
    academicYear: settings?.academic_year ?? localConfig.academicYear,
    activeTerm: settings?.active_term ?? localConfig.activeTerm,
    matriculePrefix: settings?.matricule_prefix ?? localConfig.matriculePrefix,
    institutionEdition: settings?.institution_edition ?? localConfig.institutionEdition,
    countryPack: settings?.country_pack ?? localConfig.countryPack,
    enabledModules: settings?.enabled_modules ?? localConfig.enabledModules,
    languages: settings?.languages ?? localConfig.languages,
    terminology: settings?.terminology ?? localConfig.terminology,
    classes:
      ((classesResponse.data ?? []) as SchoolClassRow[]).map((item) => item.class_name).length > 0
        ? ((classesResponse.data ?? []) as SchoolClassRow[]).map((item) => item.class_name)
        : localConfig.classes,
    subjects:
      ((subjectsResponse.data ?? []) as SchoolSubjectRow[]).map((item) => item.subject_name).length > 0
        ? ((subjectsResponse.data ?? []) as SchoolSubjectRow[]).map((item) => item.subject_name)
        : localConfig.subjects,
    feeCategories:
      ((feeCategoriesResponse.data ?? []) as FeeCategoryRow[]).map((item) => item.category_name).length > 0
        ? ((feeCategoriesResponse.data ?? []) as FeeCategoryRow[]).map((item) => item.category_name)
        : localConfig.feeCategories
  };

  saveLocalConfig(activeUser.schoolId, config);
  return config;
}

export async function saveSchoolConfig(activeUser: UserProfile | null, config: SchoolConfig) {
  if (!activeUser?.schoolId) {
    return config;
  }

  saveLocalConfig(activeUser.schoolId, config);

  if (env.demoMode || !supabase) {
    return config;
  }

  const { error: settingsError } = await supabase.from("school_settings").upsert({
    school_id: activeUser.schoolId,
    school_name: config.schoolName,
    grading_label: config.gradingLabel,
    currency: config.currency,
    campus_name: config.campusName,
    academic_year: config.academicYear,
    active_term: config.activeTerm,
    matricule_prefix: config.matriculePrefix,
    institution_edition: config.institutionEdition,
    country_pack: config.countryPack,
    enabled_modules: config.enabledModules,
    languages: config.languages,
    terminology: config.terminology
  });

  if (settingsError) {
    throw settingsError;
  }

  await Promise.all([
    syncNamedCollection(activeUser.schoolId, "school_classes", "class_name", config.classes),
    syncNamedCollection(activeUser.schoolId, "school_subjects", "subject_name", config.subjects),
    syncNamedCollection(activeUser.schoolId, "fee_categories", "category_name", config.feeCategories)
  ]);

  return config;
}
