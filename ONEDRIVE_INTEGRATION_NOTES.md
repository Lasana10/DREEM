# OneDrive Integration Notes

## Purpose

OneDrive should be supported as a school-owned storage and backup option for DREEM.

## Recommended Use

- backup of important school documents
- controlled file sharing for notes and follow-up materials
- institution-owned storage outside the app vendor
- disaster recovery support

## DREEM Storage Model

DREEM should support:

- `supabase` for cloud-first app file delivery
- `onedrive` for school-owned cloud storage
- `local-node` for offline-sensitive local files

## Product Rule

Schools should choose which storage path fits each type of material:

- assignments and notes can stay in Supabase for easy online access
- school-owned archives can sit in OneDrive
- highly sensitive local files can stay on the school node

## Technical Path

1. Add `storage_connections` to the database.
2. Let admin connect OneDrive from a settings screen.
3. Store file metadata and provider references in DREEM.
4. Use OneDrive for selected document classes and backups.
5. Keep the app UI provider-agnostic so files can be switched later.

## Why you are not seeing "APIs" in OneDrive

That is normal. OneDrive itself is the storage product. The API is managed through Microsoft Graph and app registration.

Direct Microsoft links:

- [Microsoft Entra app registrations](https://entra.microsoft.com/#view/Microsoft_AAD_RegisteredApps/ApplicationsListBlade)
- [Azure app registrations](https://portal.azure.com/#view/Microsoft_AAD_RegisteredApps/ApplicationsListBlade)
- [OneDrive app registration docs](https://learn.microsoft.com/onedrive/developer/rest-api/getting-started/app-registration?view=odsp-graph-online)
- [Microsoft Graph permissions reference](https://learn.microsoft.com/graph/permissions-reference)

## Values DREEM needs from Microsoft

```text
ONEDRIVE_CLIENT_ID=Application client ID
ONEDRIVE_CLIENT_SECRET=Client secret value
ONEDRIVE_TENANT_ID=common for personal/school mixed accounts, or tenant ID for an organization
ONEDRIVE_REDIRECT_URI=https://YOUR_RENDER_SERVICE.onrender.com/oauth/onedrive/callback
```

Recommended starting permissions:

- `offline_access`
- `Files.ReadWrite.AppFolder` if available for the account scenario
- otherwise `Files.ReadWrite` for school-owned document sync

Avoid asking for full tenant/admin-wide permissions until DREEM really needs them.

## Product recommendation

Start with OneDrive as a school-owned backup/document lane, not the primary app file system. Use Supabase Storage first for assignment attachments because it is simpler with existing auth/RLS, then mirror selected records to OneDrive through the Render worker.
