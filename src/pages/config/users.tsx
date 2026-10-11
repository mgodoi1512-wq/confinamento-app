import { useTranslation } from "react-i18next";
import { Users } from "lucide-react";
import { toast } from "sonner";

import { DataTable, type Column } from "@/components/app/data-table";
import { EmptyState } from "@/components/app/empty-state";
import { PageHeader } from "@/components/app/page-header";
import { SelectField } from "@/components/form/select-field";
import { useAuth } from "@/hooks/use-auth";
import { useProfiles, useUpdateProfile } from "@/hooks/use-users";
import { ROLE_OPTIONS } from "@/lib/constants";
import type { Profile, Role } from "@/lib/domain";
import { formatDate } from "@/lib/format";

const SettingsUsers = () => {
  const { t } = useTranslation();
  const { isGestor, profile: currentProfile } = useAuth();

  const profilesQuery = useProfiles();
  const updateProfile = useUpdateProfile();

  const profiles = profilesQuery.data ?? [];

  const changeRole = async (target: Profile, role: Role) => {
    try {
      await updateProfile.mutateAsync({ id: target.id, role });
      toast.success(
        t("config.users.roleUpdated", {
          name: target.full_name ?? target.id,
          role: t(`status.role.${role}`),
        }),
      );
    } catch {
      toast.error(t("toast.error.generic"));
    }
  };

  const columns: Column<Profile>[] = [
    {
      key: "name",
      headerKey: "field.fullName",
      render: (row) => (
        <div className="min-w-0">
          <p className="font-display text-sm font-semibold">{row.full_name ?? "—"}</p>
          {row.id === currentProfile?.id ? (
            <p className="text-xs text-muted-foreground">{t("config.users.you")}</p>
          ) : null}
        </div>
      ),
    },
    {
      key: "role",
      headerKey: "field.role",
      render: (row) =>
        isGestor ? (
          <SelectField
            className="w-40"
            value={row.role}
            onChange={(value) => void changeRole(row, value as Role)}
            triggerClassName="h-9"
            options={ROLE_OPTIONS}
          />
        ) : (
          t(`status.role.${row.role}`)
        ),
    },
    {
      key: "created",
      headerKey: "field.date",
      numeric: true,
      render: (row) => formatDate(row.created_at.slice(0, 10)),
    },
  ];

  if (!isGestor) {
    return (
      <EmptyState
        icon={Users}
        titleKey="empty.permission.title"
        descriptionKey="empty.permission.description"
      />
    );
  }

  return (
    <div className="space-y-5">
      <PageHeader titleKey="config.users.title" subtitleKey="config.users.subtitle" />

      <DataTable
        rows={profiles}
        columns={columns}
        getRowKey={(row) => row.id}
        loading={profilesQuery.isLoading}
        emptyState={
          <EmptyState icon={Users} titleKey="empty.title" descriptionKey="empty.description" />
        }
      />
    </div>
  );
};

export default SettingsUsers;
