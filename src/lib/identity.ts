import { supabase } from "./supabase";

export interface LearnerIdentityProfile {
  id: string;
  schoolId: string;
  matricule: string;
  name: string;
  className: string;
  photoUrl?: string;
  dateOfBirth?: string;
  sex?: string;
  credential?: {
    status: string;
    validUntil?: string;
    cardNumber?: string;
    cardVersion: number;
    issuedAt?: string;
  };
  guardians: Array<{
    guardianId: string;
    name: string;
    relationship: string;
    isPrimary: boolean;
    canCollect: boolean;
    phone?: string;
    email?: string;
    photoUrl?: string;
    collectorLabel?: string;
    collectorPhotoUrl?: string;
    collectionNotes?: string;
  }>;
}

function requireClient() {
  if (!supabase) throw new Error("DREEM is not connected to Supabase.");
  return supabase;
}

export async function loadLearnerIdentity(studentId: string): Promise<LearnerIdentityProfile> {
  const client = requireClient();
  const studentResult = await client
    .from("students")
    .select("id,school_id,matricule,full_name,class_name,photo_url,date_of_birth,sex")
    .eq("id", studentId)
    .single();
  if (studentResult.error) throw studentResult.error;
  const student = studentResult.data;

  const [linkResult, credentialResult] = await Promise.all([
    client
      .from("dreem_student_guardians")
      .select("guardian_id,relationship,is_primary,can_collect,collector_label,collector_photo_url,collection_notes")
      .eq("student_id", studentId),
    client
      .from("dreem_student_credentials")
      .select("status,valid_until,card_number,card_version,issued_at")
      .eq("student_id", studentId)
      .order("issued_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);
  if (linkResult.error) throw linkResult.error;
  if (credentialResult.error) throw credentialResult.error;

  const links = linkResult.data ?? [];
  const guardianIds = links.map((row) => String(row.guardian_id));
  let guardians: Array<Record<string, unknown>> = [];
  if (guardianIds.length) {
    const guardianResult = await client
      .from("dreem_guardians")
      .select("id,full_name,phone,email,photo_url")
      .in("id", guardianIds);
    if (guardianResult.error) throw guardianResult.error;
    guardians = guardianResult.data ?? [];
  }
  const guardianById = new Map(guardians.map((row) => [String(row.id), row]));
  const credential = credentialResult.data;

  return {
    id: String(student.id),
    schoolId: String(student.school_id),
    matricule: String(student.matricule),
    name: String(student.full_name),
    className: String(student.class_name ?? "Unassigned"),
    photoUrl: student.photo_url ? String(student.photo_url) : undefined,
    dateOfBirth: student.date_of_birth ? String(student.date_of_birth) : undefined,
    sex: student.sex ? String(student.sex) : undefined,
    credential: credential
      ? {
          status: String(credential.status),
          validUntil: credential.valid_until ? String(credential.valid_until) : undefined,
          cardNumber: credential.card_number ? String(credential.card_number) : undefined,
          cardVersion: Number(credential.card_version ?? 1),
          issuedAt: credential.issued_at ? String(credential.issued_at) : undefined,
        }
      : undefined,
    guardians: links.map((link) => {
      const guardian = guardianById.get(String(link.guardian_id));
      return {
        guardianId: String(link.guardian_id),
        name: String(guardian?.full_name ?? "Guardian"),
        relationship: String(link.relationship ?? "guardian"),
        isPrimary: Boolean(link.is_primary),
        canCollect: Boolean(link.can_collect),
        phone: guardian?.phone ? String(guardian.phone) : undefined,
        email: guardian?.email ? String(guardian.email) : undefined,
        photoUrl: guardian?.photo_url ? String(guardian.photo_url) : undefined,
        collectorLabel: link.collector_label ? String(link.collector_label) : undefined,
        collectorPhotoUrl: link.collector_photo_url ? String(link.collector_photo_url) : undefined,
        collectionNotes: link.collection_notes ? String(link.collection_notes) : undefined,
      };
    }),
  };
}

export async function uploadLearnerPhoto(studentId: string, file: File): Promise<string> {
  const client = requireClient();
  if (!file.type.startsWith("image/")) throw new Error("Choose a JPG, PNG or WebP image.");
  if (file.size > 5 * 1024 * 1024) throw new Error("Identity photos must be 5 MB or smaller.");
  const identity = await loadLearnerIdentity(studentId);
  const extension = file.type === "image/png" ? "png" : file.type === "image/webp" ? "webp" : "jpg";
  const path = `${identity.schoolId}/${studentId}/learner-${crypto.randomUUID()}.${extension}`;
  const upload = await client.storage.from("dreem-identity-media").upload(path, file, { upsert: false, contentType: file.type });
  if (upload.error) throw upload.error;
  const { data: signed, error: signedError } = await client.storage.from("dreem-identity-media").createSignedUrl(path, 60 * 60 * 24 * 365);
  if (signedError) throw signedError;
  const update = await client.from("students").update({ photo_url: signed.signedUrl, updated_at: new Date().toISOString() }).eq("id", studentId);
  if (update.error) throw update.error;
  return signed.signedUrl;
}

export async function updateGuardianIdentity(input: {
  studentId: string;
  guardianId: string;
  collectorLabel?: string;
  collectionNotes?: string;
  canCollect?: boolean;
}) {
  const client = requireClient();
  const update = await client
    .from("dreem_student_guardians")
    .update({
      collector_label: input.collectorLabel?.trim() || null,
      collection_notes: input.collectionNotes?.trim() || null,
      ...(typeof input.canCollect === "boolean" ? { can_collect: input.canCollect } : {}),
    })
    .eq("student_id", input.studentId)
    .eq("guardian_id", input.guardianId);
  if (update.error) throw update.error;
}
