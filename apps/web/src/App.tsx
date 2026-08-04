import { useEffect, useState } from "react";
import { AnnouncementComposer } from "./features/announcements/AnnouncementComposer";
import { AnnouncementFeed } from "./features/announcements/AnnouncementFeed";
import { useAuth } from "./features/auth/AuthProvider";
import { LoginScreen } from "./features/auth/LoginScreen";
import { ClassroomContinuity } from "./features/classroom/ClassroomContinuity";
import { useOperationsData } from "./features/data/useOperationsData";
import { useSchoolConfig } from "./features/data/useSchoolConfig";
import { useSchoolData } from "./features/data/useSchoolData";
import { useStorageConnections } from "./features/data/useStorageConnections";
import { AcademicsModule } from "./features/modules/AcademicsModule";
import { FinanceModule } from "./features/modules/FinanceModule";
import { OperationsModule } from "./features/modules/OperationsModule";
import { ReportingModule } from "./features/modules/ReportingModule";
import { TransportModule } from "./features/modules/TransportModule";
import { PlatformOverview } from "./features/overview/PlatformOverview";
import { WorkspaceHeader } from "./features/shell/WorkspaceHeader";
import { WorkspaceCommandCenter } from "./features/shell/WorkspaceCommandCenter";
import { WorkspaceNav } from "./features/shell/WorkspaceNav";
import { SessionPanel } from "./features/session/SessionPanel";
import { StorageStrategyPanel } from "./features/storage/StorageStrategyPanel";
import { roleWorkspaceAccess } from "./shared/data";
import type { WorkspaceView } from "./shared/types";

export function App() {
  const {
    activeUser,
    users,
    demoMode,
    pendingAccessEmail,
    isAuthenticated,
    isAuthLoading,
    selectDemoUser,
    loginWithMatricule,
    loginWithGoogle,
    provisionAccess,
    updateAccessStatus
  } = useAuth();
  const {
    announcements,
    continuityItems,
    assignmentSubmissions,
    createAnnouncement,
    createContinuityItem,
    submitAssignment,
    reviewSubmission,
    isLoading,
    error
  } =
    useSchoolData(activeUser);
  const {
    students,
    attendance,
    fees,
    payments,
    liabilities,
    settlements,
    reminders,
    routes,
    auditEvents,
    corrections,
    syncMutations,
    recordAttendance,
    postPayment,
    settleBursarCash,
    reversePayment,
    sendFeeReminder,
    updateRouteStatus,
    createStudent,
    linkParent,
    changePlacement,
    adjustFee,
    mergeStudents,
    isLoading: operationsLoading,
    error: operationsError
  } = useOperationsData(activeUser);
  const { config, addListItem, removeListItem, updateField, updateArrayField, updateTerminology } =
    useSchoolConfig(activeUser);
  const {
    storageConnections,
    backupTopology,
    backupJobs,
    error: storageError
  } = useStorageConnections(activeUser);
  const [activeView, setActiveView] = useState<WorkspaceView>("overview");
  const workspaceError = error || operationsError || storageError;
  const workspaceLoading = isLoading || operationsLoading;
  const allowedViews: WorkspaceView[] = activeUser
    ? roleWorkspaceAccess[activeUser.role]
    : ["overview"];
  const enabledViews = new Set<WorkspaceView>([
    "overview",
    "operations",
    ...((config.enabledModules ?? []) as WorkspaceView[])
  ]);
  const availableViews = allowedViews.filter((view) => enabledViews.has(view));

  useEffect(() => {
    if (!availableViews.includes(activeView)) {
      setActiveView(availableViews[0] ?? "overview");
    }
  }, [activeView, availableViews]);

  if (isAuthLoading) {
    return (
      <div className="shell">
        <p className="loading-note">Loading secure school session...</p>
      </div>
    );
  }

  if (!isAuthenticated || !activeUser) {
    return (
      <div className="shell">
        <LoginScreen
          demoMode={demoMode}
          users={users}
          pendingAccessEmail={pendingAccessEmail}
          onDemoLogin={loginWithMatricule}
          onGoogleLogin={loginWithGoogle}
        />
      </div>
    );
  }

  return (
    <div className="shell">
      <WorkspaceHeader activeUser={activeUser} demoMode={demoMode} config={config} />

      <main className="layout-grid">
        <SessionPanel
          demoMode={demoMode}
          users={users}
          activeUser={activeUser}
          onSelectUser={selectDemoUser}
        />

        <WorkspaceNav
          activeView={activeView}
          activeRole={activeUser.role}
          enabledModules={config.enabledModules}
          onChange={setActiveView}
        />

        {workspaceError ? <p className="form-error workspace-error">{workspaceError}</p> : null}
        {workspaceLoading ? <p className="loading-note">Loading school data...</p> : null}

        <div className="workspace-main">
          <WorkspaceCommandCenter
            activeRole={activeUser.role}
            activeView={activeView}
            config={config}
            students={students}
            fees={fees}
            payments={payments}
            liabilities={liabilities}
            routes={routes}
            announcements={announcements}
            continuityItems={continuityItems}
            corrections={corrections}
            syncMutations={syncMutations}
            auditEvents={auditEvents}
            onOpenView={setActiveView}
          />

          {activeView === "overview" ? (
            <>
              <PlatformOverview
                activeRole={activeUser.role}
                demoMode={demoMode}
                announcements={announcements}
                students={students}
                attendance={attendance}
                fees={fees}
                routes={routes}
                continuityItems={continuityItems}
                storageConnections={storageConnections}
                backupTopology={backupTopology}
                schoolConfig={config}
                corrections={corrections}
                syncMutations={syncMutations}
                onOpenView={setActiveView}
              />
              <StorageStrategyPanel
                storageConnections={storageConnections}
                backupTopology={backupTopology}
                backupJobs={backupJobs}
              />
            </>
          ) : null}

          {activeView === "academics" ? (
            <>
              <AcademicsModule
                activeUser={activeUser}
                students={students}
                attendance={attendance}
                continuityItems={continuityItems}
                assignmentSubmissions={assignmentSubmissions}
                onRecordAttendance={recordAttendance}
                onCreateContinuityItem={createContinuityItem}
                onSubmitAssignment={submitAssignment}
                onReviewSubmission={reviewSubmission}
              />
              <ClassroomContinuity items={continuityItems} activeUser={activeUser} />
            </>
          ) : null}

          {activeView === "finance" ? (
            <FinanceModule
              activeUser={activeUser}
              students={students}
              fees={fees}
              payments={payments}
              liabilities={liabilities}
              settlements={settlements}
              reminders={reminders}
              onPostPayment={postPayment}
              onSettleCash={settleBursarCash}
              onAdjustFee={adjustFee}
              onReversePayment={reversePayment}
              corrections={corrections}
              onSendReminder={sendFeeReminder}
            />
          ) : null}

          {activeView === "transport" ? (
            <TransportModule
              activeUser={activeUser}
              routes={routes}
              onUpdateRouteStatus={updateRouteStatus}
            />
          ) : null}

          {activeView === "communications" ? (
            <>
              <AnnouncementComposer
                activeUser={activeUser}
                onCreate={createAnnouncement}
              />
              <AnnouncementFeed announcements={announcements} activeUser={activeUser} />
            </>
          ) : null}

          {activeView === "operations" ? (
            <OperationsModule
              activeUser={activeUser}
              users={users}
              students={students}
              auditEvents={auditEvents}
              syncMutations={syncMutations}
              corrections={corrections}
              storageConnections={storageConnections}
              schoolConfig={config}
              onAddClass={(value) => addListItem("classes", value)}
              onRemoveClass={(value) => removeListItem("classes", value)}
              onAddSubject={(value) => addListItem("subjects", value)}
              onRemoveSubject={(value) => removeListItem("subjects", value)}
              onAddFeeCategory={(value) => addListItem("feeCategories", value)}
              onRemoveFeeCategory={(value) => removeListItem("feeCategories", value)}
              onUpdateSchoolName={(value) => updateField("schoolName", value)}
              onUpdateGradingLabel={(value) => updateField("gradingLabel", value)}
              onUpdateCurrency={(value) => updateField("currency", value)}
              onUpdateCampusName={(value) => updateField("campusName", value)}
              onUpdateAcademicYear={(value) => updateField("academicYear", value)}
              onUpdateActiveTerm={(value) => updateField("activeTerm", value)}
              onUpdateMatriculePrefix={(value) => updateField("matriculePrefix", value)}
              onUpdateInstitutionEdition={(value) => updateField("institutionEdition", value)}
              onUpdateCountryPack={(value) => updateField("countryPack", value)}
              onUpdateEnabledModules={(values) => updateArrayField("enabledModules", values)}
              onUpdateLanguages={(values) => updateArrayField("languages", values)}
              onUpdateTerminology={updateTerminology}
              onProvisionAccess={provisionAccess}
              onUpdateAccessStatus={updateAccessStatus}
              onCreateStudent={createStudent}
              onLinkParent={linkParent}
              onChangePlacement={changePlacement}
              onMergeStudents={mergeStudents}
            />
          ) : null}

          {activeView === "reporting" ? (
            <ReportingModule
              activeUser={activeUser}
              config={config}
              students={students}
              fees={fees}
              routes={routes}
            />
          ) : null}
        </div>
      </main>
    </div>
  );
}
