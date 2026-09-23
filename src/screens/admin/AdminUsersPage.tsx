"use client";

import { useMemo, useState, useEffect } from "react";
import {
  deleteUser,
  listAllUsers,
  reviewUser,
  setUserRole,
  type PendingUser,
} from "@/services/adminService";
import { useAuth } from "@/contexts/AuthContext";
import AddUserModal from "@/components/ui/AddUserModal";
import EditUserModal from "@/components/ui/EditUserModal";
import AdminSetPasswordModal from "@/components/ui/AdminSetPasswordModal";
import ConfirmModal from "@/components/ui/ConfirmModal";

// "user" is a legacy/placeholder role, no longer assignable -- only shown
// below if an existing account still has it, so it can be reassigned away.
const ROLES = ["source", "testing", "central-admin", "admin"] as const;

const ROLE_LABELS: Record<string, string> = {
  source: "Source",
  testing: "Testing",
  "central-admin": "Central Admin",
  admin: "Admin",
};

const ROLE_BADGE_CLASSES: Record<string, string> = {
  source: "text-text-muted border-text-muted",
  testing: "text-info border-info",
  "central-admin": "text-[#9a6b00] border-[#9a6b00]",
  admin: "text-accent border-accent",
};

const STATUS_BADGE_CLASSES: Record<string, string> = {
  active: "bg-pos-soft text-pos-strong",
  pending: "bg-warn-soft text-warn",
  rejected: "bg-neg-soft text-neg-strong",
};

const btnBase =
  "inline-flex items-center rounded-md px-3.5 py-2 text-xs font-semibold text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60";

const AdminUsersPage = () => {
  const [users, setUsers] = useState<PendingUser[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  const [showAddUser, setShowAddUser] = useState(false);
  const [editTarget, setEditTarget] = useState<PendingUser | null>(null);
  const [passwordTarget, setPasswordTarget] = useState<PendingUser | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<PendingUser | null>(null);

  const [roleUpdatingId, setRoleUpdatingId] = useState<string | null>(null);
  const [reviewingId, setReviewingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const { user: loggedInUser } = useAuth();
  const currentUserId = loggedInUser?.id;

  const load = () => {
    setIsLoading(true);
    setError(null);
    listAllUsers()
      .then(setUsers)
      .catch(() => setError("Couldn't load users."))
      .finally(() => setIsLoading(false));
  };

  useEffect(load, []);

  const pendingUsers = useMemo(() => users.filter((u) => u.status === "pending"), [users]);

  const stats = useMemo(
    () => ({
      total: users.length,
      pending: pendingUsers.length,
      active: users.filter((u) => u.status === "active").length,
      admins: users.filter((u) => u.role === "admin" || u.role === "central-admin").length,
    }),
    [users, pendingUsers]
  );

  const filteredUsers = useMemo(() => {
    const term = search.trim().toLowerCase();
    return users.filter((u) => {
      if (roleFilter !== "all" && u.role !== roleFilter) return false;
      if (statusFilter !== "all" && u.status !== statusFilter) return false;
      if (term && !(u.name ?? "").toLowerCase().includes(term) && !u.email.toLowerCase().includes(term)) {
        return false;
      }
      return true;
    });
  }, [users, search, roleFilter, statusFilter]);

  const handleReview = async (id: string, status: "active" | "rejected") => {
    setReviewingId(id);
    try {
      const updated = await reviewUser(id, status);
      setUsers((prev) => prev.map((u) => (u.id === id ? updated : u)));
    } catch {
      setError("Couldn't update this request. Please try again.");
    } finally {
      setReviewingId(null);
    }
  };

  const handleRoleChange = async (userId: string, role: (typeof ROLES)[number]) => {
    setRoleUpdatingId(userId);
    try {
      const updated = await setUserRole(userId, role);
      setUsers((prev) => prev.map((u) => (u.id === userId ? updated : u)));
    } catch {
      setError("Couldn't update this user's role.");
    } finally {
      setRoleUpdatingId(null);
    }
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    const user = deleteTarget;
    setDeletingId(user.id);
    try {
      await deleteUser(user.id);
      setUsers((prev) => prev.filter((u) => u.id !== user.id));
      setDeleteTarget(null);
    } catch {
      setError("Couldn't delete this user.");
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="min-h-screen bg-bg-app p-10">
      <div className="sticky-page-header flex flex-wrap items-start justify-between gap-5">
        <div>
          <h1 className="mb-1.5 text-2xl font-semibold text-text-h">Users &amp; Access</h1>
          <p className="text-sm text-text-muted">
            Review access requests, manage every account, and control roles from one place.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setShowAddUser(true)}
          className="inline-flex items-center gap-2 whitespace-nowrap rounded-lg bg-accent px-5 py-3 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-accent-hover"
        >
          + Add User
        </button>
      </div>

      <div className="mb-6 grid grid-cols-2 gap-5 rounded-md border border-border bg-surface px-6 py-5 shadow-sm sm:grid-cols-4">
        <div className="flex flex-col gap-1">
          <span className="text-2xl font-semibold tabular-nums text-text-h">{stats.total}</span>
          <span className="text-[11px] font-semibold uppercase tracking-wide text-text-muted">Total Users</span>
        </div>
        <div className="flex flex-col gap-1">
          <span className={`text-2xl font-semibold tabular-nums ${stats.pending > 0 ? "text-warn" : "text-text-h"}`}>
            {stats.pending}
          </span>
          <span className="text-[11px] font-semibold uppercase tracking-wide text-text-muted">Pending Requests</span>
        </div>
        <div className="flex flex-col gap-1">
          <span className="text-2xl font-semibold tabular-nums text-pos">{stats.active}</span>
          <span className="text-[11px] font-semibold uppercase tracking-wide text-text-muted">Active Accounts</span>
        </div>
        <div className="flex flex-col gap-1">
          <span className="text-2xl font-semibold tabular-nums text-text-h">{stats.admins}</span>
          <span className="text-[11px] font-semibold uppercase tracking-wide text-text-muted">
            Admins &amp; Central Admins
          </span>
        </div>
      </div>

      {error && <p className="mb-4 text-sm font-medium text-neg">{error}</p>}

      {!isLoading && pendingUsers.length > 0 && (
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
                      <span
                        className={`inline-block rounded-full border px-2.5 py-0.5 text-xs font-semibold ${ROLE_BADGE_CLASSES[request.role] ?? "text-text-muted border-text-muted"}`}
                      >
                        {ROLE_LABELS[request.role] ?? request.role}
                      </span>
                    </td>
                    <td className="px-4 py-3.5 text-sm text-text-muted">
                      {new Date(request.created_at).toLocaleString()}
                    </td>
                    <td className="px-4 py-3.5">
                      <div className="flex gap-2.5">
                        <button
                          className={`${btnBase} bg-pos`}
                          disabled={reviewingId === request.id}
                          onClick={() => handleReview(request.id, "active")}
                        >
                          Approve
                        </button>
                        <button
                          className={`${btnBase} bg-neg`}
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

      <div className="mb-4 flex flex-wrap gap-2.5">
        <input
          type="text"
          placeholder="Search by name or email..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="min-w-[220px] flex-1 rounded-lg border border-border bg-surface px-3.5 py-2.5 text-sm text-text-h outline-none focus:border-accent focus:ring-2 focus:ring-accent-line"
        />
        <select
          value={roleFilter}
          onChange={(e) => setRoleFilter(e.target.value)}
          className="rounded-lg border border-border bg-surface px-3 py-2.5 text-sm text-text"
        >
          <option value="all">All roles</option>
          {ROLES.map((r) => (
            <option key={r} value={r}>
              {ROLE_LABELS[r]}
            </option>
          ))}
        </select>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="rounded-lg border border-border bg-surface px-3 py-2.5 text-sm text-text"
        >
          <option value="all">All statuses</option>
          <option value="active">Active</option>
          <option value="pending">Pending</option>
          <option value="rejected">Rejected</option>
        </select>
      </div>

      {isLoading && <p className="text-sm text-text-muted">Loading users...</p>}

      {!isLoading && !error && filteredUsers.length === 0 && (
        <p className="rounded-lg bg-surface p-8 text-center text-sm text-text-muted">No users match these filters.</p>
      )}

      {!isLoading && !error && filteredUsers.length > 0 && (
        <div className="overflow-hidden rounded-lg border border-border shadow-sm">
          <table className="w-full border-collapse">
            <thead>
              <tr>
                <th className="bg-accent px-4 py-3 text-left text-sm font-semibold text-white">Name</th>
                <th className="bg-accent px-4 py-3 text-left text-sm font-semibold text-white">Email</th>
                <th className="bg-accent px-4 py-3 text-left text-sm font-semibold text-white">Role</th>
                <th className="bg-accent px-4 py-3 text-left text-sm font-semibold text-white">Status</th>
                <th className="bg-accent px-4 py-3 text-left text-sm font-semibold text-white">Joined</th>
                <th className="bg-accent px-4 py-3 text-left text-sm font-semibold text-white">Action</th>
              </tr>
            </thead>
            <tbody className="bg-surface">
              {filteredUsers.map((u) => (
                <tr key={u.id} className="border-t border-border transition-colors hover:bg-surface-hover">
                  <td className="px-4 py-3.5 text-sm text-text">{u.name ?? "—"}</td>
                  <td className="px-4 py-3.5 text-sm text-text">{u.email}</td>
                  <td className="px-4 py-3.5">
                    <select
                      value={u.role}
                      disabled={roleUpdatingId === u.id}
                      onChange={(e) => handleRoleChange(u.id, e.target.value as (typeof ROLES)[number])}
                      className="rounded-md border border-border bg-bg-app px-2.5 py-1.5 text-xs text-text capitalize disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {!(ROLES as readonly string[]).includes(u.role) && (
                        <option value={u.role}>{u.role} (unassigned)</option>
                      )}
                      {ROLES.map((role) => (
                        <option key={role} value={role}>
                          {ROLE_LABELS[role]}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="px-4 py-3.5">
                    <span
                      className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold capitalize ${STATUS_BADGE_CLASSES[u.status] ?? "bg-surface-hover text-text-muted"}`}
                    >
                      {u.status}
                    </span>
                  </td>
                  <td className="px-4 py-3.5 text-sm text-text-muted">
                    {new Date(u.created_at).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-3.5">
                    <div className="flex flex-wrap gap-2.5">
                      <button className={`${btnBase} bg-info`} onClick={() => setEditTarget(u)}>
                        Edit
                      </button>
                      <button className={`${btnBase} bg-pos`} onClick={() => setPasswordTarget(u)}>
                        Reset Password
                      </button>
                      {u.id !== currentUserId && (
                        <button
                          className={`${btnBase} bg-neg`}
                          disabled={deletingId === u.id}
                          onClick={() => setDeleteTarget(u)}
                        >
                          {deletingId === u.id ? "Deleting..." : "Delete"}
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showAddUser && (
        <AddUserModal
          onClose={() => setShowAddUser(false)}
          onCreated={(user) => {
            setUsers((prev) => [...prev, user]);
            setShowAddUser(false);
          }}
        />
      )}

      {editTarget && (
        <EditUserModal
          user={editTarget}
          onClose={() => setEditTarget(null)}
          onSaved={(updated) => {
            setUsers((prev) => prev.map((u) => (u.id === updated.id ? updated : u)));
            setEditTarget(null);
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
