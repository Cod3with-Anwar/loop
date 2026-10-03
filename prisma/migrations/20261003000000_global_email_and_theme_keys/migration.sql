-- Login identifies accounts by email, so email must be unique across workspaces.
DROP INDEX IF EXISTS "User_workspaceId_email_key";
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");
CREATE UNIQUE INDEX "Theme_workspaceId_name_key" ON "Theme"("workspaceId", "name");
