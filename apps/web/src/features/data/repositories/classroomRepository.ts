import { classroomItems } from "../../../shared/data";
import type { AssignmentSubmission, ClassroomItem, UserProfile } from "../../../shared/types";
import { env } from "../../../lib/env";
import { supabase } from "../../../lib/supabase";

type ClassroomRow = {
  id: string;
  title: string;
  subject: string;
  class_name: string | null;
  delivery: string;
  audience: string;
  summary: string;
  due_date: string | null;
  published_by: string | null;
  status: string | null;
  storage_provider: string;
};

type AssignmentSubmissionRow = {
  id: string;
  classroom_material_id: string;
  classroom_title: string;
  student_id: string;
  student_name: string;
  class_name: string | null;
  submitted_by: string;
  submitted_at: string;
  response: string;
  status: AssignmentSubmission["status"];
  reviewed_by: string | null;
  reviewed_at: string | null;
  feedback: string | null;
  score: string | null;
};

const SUBMISSIONS_KEY = "dreem:assignment-submissions";

function isBrowser() {
  return typeof window !== "undefined";
}

function getSubmissionStorageKey(activeUser: UserProfile) {
  return `${SUBMISSIONS_KEY}:${activeUser.schoolId ?? "demo-school"}`;
}

function readLocalSubmissions(activeUser: UserProfile): AssignmentSubmission[] {
  if (!isBrowser()) {
    return [];
  }

  const raw = window.localStorage.getItem(getSubmissionStorageKey(activeUser));
  if (!raw) {
    return [];
  }

  try {
    return JSON.parse(raw) as AssignmentSubmission[];
  } catch {
    return [];
  }
}

function writeLocalSubmissions(activeUser: UserProfile, submissions: AssignmentSubmission[]) {
  if (!isBrowser()) {
    return;
  }

  window.localStorage.setItem(getSubmissionStorageKey(activeUser), JSON.stringify(submissions));
}

function mapClassroomItem(row: ClassroomRow): ClassroomItem {
  return {
    id: row.id,
    title: row.title,
    subject: row.subject,
    className: row.class_name ?? undefined,
    delivery: row.delivery as ClassroomItem["delivery"],
    audience: row.audience as ClassroomItem["audience"],
    summary: row.summary,
    dueDate: row.due_date ?? undefined,
    publishedBy: row.published_by ?? undefined,
    status: (row.status as ClassroomItem["status"]) ?? undefined,
    storageProvider: row.storage_provider as ClassroomItem["storageProvider"]
  };
}

function mapAssignmentSubmission(row: AssignmentSubmissionRow): AssignmentSubmission {
  return {
    id: row.id,
    classroomItemId: row.classroom_material_id,
    classroomTitle: row.classroom_title,
    studentId: row.student_id,
    studentName: row.student_name,
    className: row.class_name ?? undefined,
    submittedBy: row.submitted_by,
    submittedAt: row.submitted_at,
    response: row.response,
    status: row.status,
    reviewedBy: row.reviewed_by ?? undefined,
    reviewedAt: row.reviewed_at ?? undefined,
    feedback: row.feedback ?? undefined,
    score: row.score ?? undefined
  };
}

export async function listClassroomMaterials(activeUser: UserProfile) {
  if (env.demoMode || !supabase || !activeUser.schoolId) {
    return classroomItems;
  }

  const { data, error } = await supabase
    .from("classroom_materials")
    .select("id,title,subject,class_name,delivery,audience,summary,due_date,published_by,status,storage_provider")
    .eq("school_id", activeUser.schoolId)
    .order("created_at", { ascending: false });

  if (error) {
    throw error;
  }

  return (data as ClassroomRow[]).map(mapClassroomItem);
}

export async function createClassroomMaterial(
  item: ClassroomItem,
  activeUser: UserProfile
) {
  const nextItem: ClassroomItem = {
    ...item,
    id: item.id || `classroom-${Date.now()}`,
    publishedBy: item.publishedBy ?? activeUser.name,
    status: item.status ?? "published"
  };

  if (env.demoMode || !supabase || !activeUser.schoolId) {
    return nextItem;
  }

  const { data, error } = await supabase
    .from("classroom_materials")
    .insert({
      school_id: activeUser.schoolId,
      owner_id: activeUser.id,
      title: nextItem.title,
      subject: nextItem.subject,
      class_name: nextItem.className ?? null,
      delivery: nextItem.delivery,
      audience: nextItem.audience,
      summary: nextItem.summary,
      due_date: nextItem.dueDate ?? null,
      published_by: nextItem.publishedBy ?? activeUser.name,
      status: nextItem.status ?? "published",
      storage_provider: nextItem.storageProvider ?? "supabase"
    })
    .select("id,title,subject,class_name,delivery,audience,summary,due_date,published_by,status,storage_provider")
    .single();

  if (error) {
    throw error;
  }

  return mapClassroomItem(data as ClassroomRow);
}

export async function listAssignmentSubmissions(activeUser: UserProfile) {
  if (env.demoMode || !supabase || !activeUser.schoolId) {
    return readLocalSubmissions(activeUser);
  }

  const { data, error } = await supabase
    .from("assignment_submissions")
    .select(
      "id,classroom_material_id,classroom_title,student_id,student_name,class_name,submitted_by,submitted_at,response,status,reviewed_by,reviewed_at,feedback,score"
    )
    .eq("school_id", activeUser.schoolId)
    .order("submitted_at", { ascending: false });

  if (error) {
    throw error;
  }

  const submissions = (data as AssignmentSubmissionRow[]).map(mapAssignmentSubmission);
  writeLocalSubmissions(activeUser, submissions);
  return submissions;
}

export async function createAssignmentSubmission(
  submission: Omit<AssignmentSubmission, "id" | "submittedAt" | "status">,
  activeUser: UserProfile
) {
  const nextSubmission: AssignmentSubmission = {
    ...submission,
    id: `sub-${Date.now()}`,
    submittedAt: new Date().toISOString(),
    status: "submitted"
  };

  if (!env.demoMode && supabase && activeUser.schoolId) {
    const { data, error } = await supabase
      .from("assignment_submissions")
      .insert({
        school_id: activeUser.schoolId,
        classroom_material_id: submission.classroomItemId,
        classroom_title: submission.classroomTitle,
        student_id: submission.studentId,
        student_name: submission.studentName,
        class_name: submission.className ?? null,
        submitted_by: activeUser.id,
        response: submission.response,
        status: "submitted",
        submitted_at: nextSubmission.submittedAt
      })
      .select(
        "id,classroom_material_id,classroom_title,student_id,student_name,class_name,submitted_by,submitted_at,response,status,reviewed_by,reviewed_at,feedback,score"
      )
      .single();

    if (error) {
      throw error;
    }

    const savedSubmission = mapAssignmentSubmission(data as AssignmentSubmissionRow);
    writeLocalSubmissions(activeUser, [savedSubmission, ...readLocalSubmissions(activeUser)]);
    return savedSubmission;
  }

  const submissions = readLocalSubmissions(activeUser);
  writeLocalSubmissions(activeUser, [nextSubmission, ...submissions]);
  return nextSubmission;
}

export async function reviewAssignmentSubmission(
  submissionId: string,
  review: Pick<AssignmentSubmission, "feedback" | "score" | "status">,
  activeUser: UserProfile
) {
  const reviewedAt = new Date().toISOString();
  if (!env.demoMode && supabase && activeUser.schoolId) {
    const { error } = await supabase
      .from("assignment_submissions")
      .update({
        feedback: review.feedback ?? null,
        score: review.score ?? null,
        status: review.status,
        reviewed_by: activeUser.id,
        reviewed_at: reviewedAt
      })
      .eq("school_id", activeUser.schoolId)
      .eq("id", submissionId);

    if (error) {
      throw error;
    }
  }

  const submissions = readLocalSubmissions(activeUser);
  const updatedSubmissions = submissions.map((submission) =>
    submission.id === submissionId
      ? {
          ...submission,
          ...review,
          reviewedBy: activeUser.name,
          reviewedAt
        }
      : submission
  );

  writeLocalSubmissions(activeUser, updatedSubmissions);
  return updatedSubmissions;
}
