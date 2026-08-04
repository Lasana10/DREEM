import { useEffect, useState } from "react";
import type {
  Announcement,
  AssignmentSubmission,
  ClassroomItem,
  UserProfile
} from "../../shared/types";
import { createAnnouncementRecord, listAnnouncements } from "./repositories/announcementRepository";
import {
  createClassroomMaterial,
  createAssignmentSubmission,
  listAssignmentSubmissions,
  listClassroomMaterials,
  reviewAssignmentSubmission
} from "./repositories/classroomRepository";

export function useSchoolData(activeUser: UserProfile | null) {
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [continuityItems, setContinuityItems] = useState<ClassroomItem[]>([]);
  const [assignmentSubmissions, setAssignmentSubmissions] = useState<AssignmentSubmission[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;

    async function loadData() {
      if (!activeUser) {
        setAnnouncements([]);
        setContinuityItems([]);
        setAssignmentSubmissions([]);
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      setError("");

      try {
        const [announcementData, classroomData, submissionData] = await Promise.all([
          listAnnouncements(activeUser),
          listClassroomMaterials(activeUser),
          listAssignmentSubmissions(activeUser)
        ]);

        if (!active) {
          return;
        }

        setAnnouncements(announcementData);
        setContinuityItems(classroomData);
        setAssignmentSubmissions(submissionData);
      } catch (loadError) {
        if (!active) {
          return;
        }

        setError(
          loadError instanceof Error
            ? loadError.message
            : "Unable to load school data."
        );
      } finally {
        if (active) {
          setIsLoading(false);
        }
      }
    }

    void loadData();

    return () => {
      active = false;
    };
  }, [activeUser]);

  async function createAnnouncement(announcement: Announcement) {
    if (!activeUser) {
      throw new Error("No active user session.");
    }

    const savedAnnouncement = await createAnnouncementRecord(announcement, activeUser);
    setAnnouncements((current) => [savedAnnouncement, ...current]);
  }

  async function createContinuityItem(item: ClassroomItem) {
    if (!activeUser) {
      throw new Error("No active user session.");
    }

    const savedItem = await createClassroomMaterial(item, activeUser);
    setContinuityItems((current) => [savedItem, ...current]);
  }

  async function submitAssignment(
    submission: Omit<AssignmentSubmission, "id" | "submittedAt" | "status">
  ) {
    if (!activeUser) {
      throw new Error("No active user session.");
    }

    const savedSubmission = await createAssignmentSubmission(submission, activeUser);
    setAssignmentSubmissions((current) => [savedSubmission, ...current]);
  }

  async function reviewSubmission(
    submissionId: string,
    review: Pick<AssignmentSubmission, "feedback" | "score" | "status">
  ) {
    if (!activeUser) {
      throw new Error("No active user session.");
    }

    const updatedSubmissions = await reviewAssignmentSubmission(submissionId, review, activeUser);
    setAssignmentSubmissions(updatedSubmissions);
  }

  return {
    announcements,
    continuityItems,
    assignmentSubmissions,
    createAnnouncement,
    createContinuityItem,
    submitAssignment,
    reviewSubmission,
    isLoading,
    error
  };
}
