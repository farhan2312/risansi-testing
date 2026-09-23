"use client";

import { useEffect, useState } from "react";
import {
  deleteUser,
  listAllUsers,
  listPendingUsers,
  reviewUser,
  setUserActive,
  type PendingUser,
  type UserStats,
} from "@/services/adminService";
import { useAuth } from "@/contexts/AuthContext";
import { avatarColor, initialsOf } from "@/lib/avatar";
import AddUserModal from "@/components/ui/AddUserModal";
import EditUserModal from "@/components/ui/EditUserModal";
import AdminSetPasswordModal from "@/components/ui/AdminSetPasswordModal";
import ConfirmModal from "@/components/ui/ConfirmModal";
import Pagination from "@/components/ui/Pagination";
import PageHeader, { pageHeaderButton } from "@/components/ui/PageHeader";
import { SkeletonTableRows } from "@/components/ui/Skeleton";

const PAGE_SIZE = 25;

const ROLES = ["source", "testing", "central-admin", "admin"] as const;

const ROLE_LABELS: Record<string, string> = {
  source: "Source",
  testing: "Testing",
  "central-admin": "Central Admin",
  admin: "System Admin",
};

const ROLE_PILL_CLASSES: Record<string, string> = {
  source: "bg-surface-hover text-text-muted",
  testing: "bg-info-soft text-info",
  "central-admin": "bg-[#fef3c7] text-[#9a6b00]",
  admin: "bg-[#ede9fe] text-[#7c3aed]",
};

const STATUS_LABELS: Record<string, string> = {
  active: "Active",
  pending: "Pending",
  rejected: "Rejected",
  inactive: "Inactive",
};

const STATUS_DOT_CLASSES: Record<string, string> = {
  active: "bg-pos",
  pending: "bg-warn",
  rejected: "bg-neg",
  inactive: "bg-text-faint",
};

const STATUS_PILL_CLASSES: Record<string, string> = {
  active: "bg-pos-soft text-pos-strong",
  pending: "bg-warn-soft text-warn",
  rejected: "bg-neg-soft text-neg-strong",
  inactive: "bg-surface-hover text-text-muted",
};

const smallBtnBase =
  "inline-flex items-center gap-1 rounded-md px-2.5 py-1.5 text-xs font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-60";
const smallBtnSecondary = `${smallBtnBase} border border-border bg-surface text-text hover:bg-surface-hover`;
const iconBtn =
  "inline-flex h-7 w-7 items-center justify-center rounded-md text-sm transition-colors hover:bg-surface-hover disabled:cursor-not-allowed disabled:opacity-60";

const formatShortDate = (iso: string) =>
  new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });

/** "Added by" (admin-direct-creation, reviewed_at ~= created_at) vs
 * "Approved by" (signed up, reviewed later) vs the terminal statuses --
 * inferred from existing fields rather than a separate "what kind of
 * review was this" column. */
const reviewedLabel = (u: PendingUser): string => {
  if (u.status === "rejected") return "Rejected by";
  if (u.status === "inactive") return "Deactivated by";
  const created = new Date(u.created_at).getTime();
  const reviewed = u.reviewed_at ? new Date(u.reviewed_at).getTime() : created;
  return reviewed - created < 5000 ? "Added by" : "Approved by";
};

const EMPTY_STATS: UserStats = { total: 0, pending: 0, active: 0, admins: 0 };

const AdminUsersPage = () => {
  const [users, setUsers] = useState<PendingUser[]>([]);
  const [total, setTotal] = useState(0);
  const [stats, setStats] = useState<UserStats>(EMPTY_STATS);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [pendingUsers, setPendingUsers] = useState<PendingUser[]>([]);

  const [page, setPage] = useState(1);
  // searchInput is the live textbox value, appliedSearch is what was
  // actually submitted (Search button or Enter) -- matches the Audit Log
  // Activity tab's search convention elsewhere in this app, rather than
  // firing a request on every keystroke.
  const [searchInput, setSearchInput] = useState("");
  const [appliedSearch, setAppliedSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  const [showAddUser, setShowAddUser] = useState(false);
  const [editTarget, setEditTarget] = useState<PendingUser | null>(null);
  const [passwordTarget, setPasswordTarget] = useState<PendingUser | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<PendingUser | null>(null);

  const [reviewingId, setReviewingId] = useState<string | null>(null);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const { user: loggedInUser } = useAuth();
  const currentUserId = loggedInUser?.id;

  const loadPending = () => {
    listPendingUsers()
      .then(setPendingUsers)
      .catch(() => {});
  };

  const load = () => {
    setIsLoading(true);
    setError(null);
    listAllUsers(page, {
      search: appliedSearch || undefined,
      role: roleFilter === "all" ? undefined : roleFilter,
      status: statusFilter === "all" ? undefined : statusFilter,
    })
      .then((result) => {
        setUsers(result.entries);
        setTotal(result.total);
        setStats(result.stats);
      })
      .catch(() => setError("Couldn't load users."))
      .finally(() => setIsLoading(false));
  };

  useEffect(load, [page, appliedSearch, roleFilter, statusFilter]);
  useEffect(loadPending, []);

  const submitSearch = () => {
    setPage(1);
    setAppliedSearch(searchInput.trim());
  };

  const changeRoleFilter = (value: string) => {
    setRoleFilter(value);
    setPage(1);
  };

  const changeStatusFilter = (value: string) => {
    setStatusFilter(value);
    setPage(1);
  };

  const handleReview = async (id: string, status: "active" | "rejected") => {
    setReviewingId(id);
    try {
      await reviewUser(id, status);
      loadPending();
      load();
    } catch {
      setError("Couldn't update this request. Please try again.");
    } finally {
      setReviewingId(null);
    }
  };

  const handleToggleActive = async (u: PendingUser, active: boolean) => {
    setTogglingId(u.id);
    try {
      await setUserActive(u.id, active);
      load();
    } catch {
      setError(`Couldn't ${active ? "reactivate" : "deactivate"} this user.`);
    } finally {
      setTogglingId(null);
    }
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    const user = deleteTarget;
    setDeletingId(user.id);
    try {
      await deleteUser(user.id);
      setDeleteTarget(null);
      load();
    } catch {
      setError("Couldn't delete this user.");
    } finally {
      setDeletingId(null);
    }
  };

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="min-h-screen bg-bg-app p-10">
      <PageHeader
        icon="👥"
        title="Users & Access"
        subtitle={isLoading ? "Loading…" : `${stats.total} users · ${stats.active} active${stats.pending > 0 ? ` · ${stats.pending} pending` : ""}`}
        actions={
          <>
            <input
              type="text"
              placeholder="Search name, email, role..."
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && submitSearch()}
              className="min-w-[220px] rounded-lg border border-border bg-surface px-3.5 py-2.5 text-sm text-text-h outline-none focus:border-accent focus:ring-2 focus:ring-accent-line"
            />
            <select
              value={statusFilter}
              onChange={(e) => changeStatusFilter(e.target.value)}
              className="rounded-lg border border-border bg-surface px-3 py-2.5 text-sm text-text"
            >
              <option value="all">All status</option>
              <option value="active">Active</option>
              <option value="pending">Pending</option>
              <option value="inactive">Inactive</option>
              <option value="rejected">Rejected</option>
            </select>
            <select
              value={roleFilter}
              onChange={(e) => changeRoleFilter(e.target.value)}
              className="rounded-lg border border-border bg-surface px-3 py-2.5 text-sm text-text"
            >
              <option value="all">All roles</option>
              {ROLES.map((r) => (
                <option key={r} value={r}>
                  {ROLE_LABELS[r]}
                </option>
              ))}
            </select>
            <button type="button" onClick={() => setShowAddUser(true)} className={pageHeaderButton("primary")}>
              <span aria-hidden="true">+</span> Add User
            </button>
          </>
        }
      />

      {error && <p className="mb-4 text-sm font-medium text-neg">{error}</p>}

      {pendingUsers.length > 0 && (
        <div className="mb-6 rounded-md border border-warn bg-warn-soft px-5 py-5">
          <div className="mb-3.5 flex items-center gap-2.5">
            <h2 className="m-0 text-base font-semibold text-text-h">Pending Requests</h2>
            <span className="rounded-full bg-warn px-2.5 py-0.5 text-xs font-bold text-white">
              {pendingUsers.length}
            </span>
          </div>
          <div className="overflow-hidden rounded-lg border border-border">
            <table className="w-full border-collapse">
              <thead>
                <tr>
                  <th className="bg-accent px-4 py-3 text-left text-sm font-semibold text-white">Name</th>
                  <th className="bg-accent px-4 py-3 text-left text-sm font-semibold text-white">Email</th>
                  <th className="bg-accent px-4 py-3 text-left text-sm font-semibold text-white">Requested Role</th>
                  <th className="bg-accent px-4 py-3 text-left text-sm font-semibold text-white">Requested</th>
                  <th className="bg-accent px-4 py-3 text-left text-sm font-semibold text-white">Action</th>
                </tr>
              </thead>
              <tbody className="bg-surface">
                {pendingUsers.map((request) => (
                  <tr key={request.id} className="border-t border-border transition-colors hover:bg-surface-hover">
                    <td className="px-4 py-3.5 text-sm text-text">{request.name}</td>
                    <td className="px-4 py-3.5 text-sm text-text">{request.email}</td>
                    <td className="px-4 py-3.5">
                      <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold ${ROLE_PILL_CLASSES[request.role] ?? "bg-surface-hover text-text-muted"}`}>
                        {ROLE_LABELS[request.role] ?? request.role}
                      </span>
                    </td>
                    <td className="px-4 py-3.5 text-sm text-text-muted">{formatShortDate(request.created_at)}</td>
                    <td className="px-4 py-3.5">
                      <div className="flex gap-2.5">
                        <button
                          className={`${smallBtnBase} bg-pos text-white hover:opacity-90`}
                          disabled={reviewingId === request.id}
                          onClick={() => handleReview(request.id, "active")}
                        >
                          Approve
                        </button>
                        <button
                          className={`${smallBtnBase} bg-neg text-white hover:opacity-90`}
                          disabled={reviewingId === request.id}
                          onClick={() => handleReview(request.id, "rejected")}
                        >
                          Reject
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {!isLoading && !error && users.length === 0 && (
        <p className="rounded-lg bg-surface p-8 text-center text-sm text-text-muted">No users match these filters.</p>
      )}

      {(isLoading || (!error && users.length > 0)) && (
        <div className="overflow-hidden rounded-lg border border-border shadow-sm">
          <table className="w-full border-collapse">
            <thead>
              <tr className="bg-bg-sunk">
                <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wide text-text-muted">User</th>
                <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wide text-text-muted">Role</th>
                <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wide text-text-muted">Status</th>
                <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wide text-text-muted">Requested</th>
                <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wide text-text-muted">Reviewed</th>
                <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wide text-text-muted">Actions</th>
              </tr>
            </thead>
            <tbody className="bg-surface">
              {isLoading && <SkeletonTableRows columns={6} cellClassName="px-4 py-3.5" />}
              {!isLoading &&
                users.map((u) => {
                  const displayName = u.name ?? u.email;
                  return (
                    <tr key={u.id} className="border-t border-border transition-colors hover:bg-surface-hover">
                      <td className="px-4 py-3.5">
                        <div className="flex items-center gap-3">
                          <span
                            className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full text-xs font-bold text-white"
                            style={{ background: avatarColor(displayName) }}
                          >
                            {initialsOf(displayName)}
                          </span>
                          <div className="min-w-0">
                            <div className="truncate text-sm font-semibold text-text-h">{u.name ?? u.email}</div>
                            <div className="truncate text-xs text-text-muted">{u.email}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3.5">
                        <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold ${ROLE_PILL_CLASSES[u.role] ?? "bg-surface-hover text-text-muted"}`}>
                          {ROLE_LABELS[u.role] ?? u.role}
                        </span>
                      </td>
                      <td className="px-4 py-3.5">
                        <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold ${STATUS_PILL_CLASSES[u.status] ?? "bg-surface-hover text-text-muted"}`}>
                          <span className={`h-1.5 w-1.5 rounded-full ${STATUS_DOT_CLASSES[u.status] ?? "bg-text-faint"}`} />
                          {STATUS_LABELS[u.status] ?? u.status}
                        </span>
                      </td>
                      <td className="px-4 py-3.5 text-sm text-text-muted">{formatShortDate(u.created_at)}</td>
                      <td className="px-4 py-3.5">
                        {u.reviewed_at ? (
                          <div className="flex flex-col gap-0.5">
                            <span className="text-xs text-text-muted">
                              {reviewedLabel(u)} <strong className="font-semibold text-text-h">{u.reviewed_by_name ?? "someone"}</strong>
                            </span>
                            <span className="text-[11px] text-text-faint">{formatShortDate(u.reviewed_at)}</span>
                          </div>
                        ) : (
                          <span className="text-text-faint">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3.5">
                        <div className="flex flex-wrap items-center gap-1.5">
                          {u.status === "active" && u.id !== currentUserId && (
                            <button
                              className={smallBtnSecondary}
                              disabled={togglingId === u.id}
                              onClick={() => handleToggleActive(u, false)}
                            >
                              ⏸ Deactivate
                            </button>
                          )}
                          {u.status === "inactive" && (
                            <button
                              className={smallBtnSecondary}
                              disabled={togglingId === u.id}
                              onClick={() => handleToggleActive(u, true)}
                            >
                              ▶ Activate
                            </button>
                          )}
                          <button className={smallBtnSecondary} onClick={() => setEditTarget(u)}>
                            ✏️ Edit
                          </button>
                          <button
                            className={iconBtn}
                            onClick={() => setPasswordTarget(u)}
                            title="Reset Password"
                            aria-label="Reset Password"
                          >
                            🔑
                          </button>
                          {u.id !== currentUserId && (
                            <button
                              className={`${iconBtn} text-neg`}
                              disabled={deletingId === u.id}
                              onClick={() => setDeleteTarget(u)}
                              title="Delete"
                              aria-label="Delete"
                            >
                              <svg
  xmlns="http://www.w3.org/2000/svg"
  viewBox="0 0 24 24"
  fill="none"
  stroke="currentColor"
  strokeWidth="2"
  strokeLinecap="round"
  strokeLinejoin="round"
  className="w-5 h-5 text-red-500 hover:text-red-700 cursor-pointer transition-colors"
>
  <path d="M3 6h18" />
  <path d="M8 6V4h8v2" />
  <path d="M19 6l-1 14H6L5 6" />
  <path d="M10 11v5" />
  <path d="M14 11v5" />
</svg>
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
            </tbody>
          </table>
        </div>
      )}

      <Pagination page={page} totalPages={totalPages} total={total} pageSize={PAGE_SIZE} onPageChange={setPage} />

      {showAddUser && (
        <AddUserModal
          onClose={() => setShowAddUser(false)}
          onCreated={() => {
            setShowAddUser(false);
            load();
          }}
        />
      )}

      {editTarget && (
        <EditUserModal
          user={editTarget}
          onClose={() => setEditTarget(null)}
          onSaved={() => {
            setEditTarget(null);
            load();
          }}
        />
      )}

      {passwordTarget && (
        <AdminSetPasswordModal
          userId={passwordTarget.id}
          userLabel={passwordTarget.name ?? passwordTarget.email}
          onClose={() => setPasswordTarget(null)}
        />
      )}

      {deleteTarget && (
        <ConfirmModal
          title="Delete user"
          message={`Delete ${deleteTarget.name ?? deleteTarget.email}? This cannot be undone.`}
          confirmLabel="Delete"
          danger
          isConfirming={deletingId === deleteTarget.id}
          onConfirm={confirmDelete}
          onCancel={() => setDeleteTarget(null)}
        />
      )}
    </div>
  );
};

export default AdminUsersPage;
