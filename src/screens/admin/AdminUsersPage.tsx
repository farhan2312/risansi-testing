"use client";

import { useEffect, useState } from "react";
import "./AdminAccessRequestsPage.css";
import { listAllUsers, setUserRole, type PendingUser } from "@/services/adminService";
import AdminSetPasswordModal from "@/components/ui/AdminSetPasswordModal";

// "user" is a legacy/placeholder role, no longer assignable — only shown
// below if an existing account still has it, so it can be reassigned away.
const ROLES = ["source", "testing", "central-admin", "admin"] as const;

const AdminUsersPage = () => {
  const [users, setUsers] = useState<PendingUser[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [passwordTarget, setPasswordTarget] = useState<PendingUser | null>(null);
  const [roleUpdatingId, setRoleUpdatingId] = useState<string | null>(null);

  useEffect(() => {
    listAllUsers()
      .then(setUsers)
      .catch(() => setError("Couldn't load users."))
      .finally(() => setIsLoading(false));
  }, []);

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

  return (
    <div className="admin-requests-page">
      <div className="admin-requests-header">
        <h1>Manage Users</h1>
        <p>View every user, assign roles, and set a new password on their behalf.</p>
      </div>

      {isLoading && <p>Loading users...</p>}
      {error && <p className="error-message">{error}</p>}

      {!isLoading && !error && users.length === 0 && (
        <p className="empty-state">No users found.</p>
      )}

      {!isLoading && !error && users.length > 0 && (
        <table className="admin-requests-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Email</th>
              <th>Role</th>
              <th>Status</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id}>
                <td>{u.name ?? "—"}</td>
                <td>{u.email}</td>
                <td>
                  <select
                    className="role-select"
                    value={u.role}
                    disabled={roleUpdatingId === u.id}
                    onChange={(e) => handleRoleChange(u.id, e.target.value as (typeof ROLES)[number])}
                  >
                    {!(ROLES as readonly string[]).includes(u.role) && (
                      <option value={u.role}>{u.role} (unassigned)</option>
                    )}
                    {ROLES.map((role) => (
                      <option key={role} value={role}>
                        {role}
                      </option>
                    ))}
                  </select>
                </td>
                <td>{u.status}</td>
                <td>
                  <div className="action-buttons">
                    <button className="approve-btn" onClick={() => setPasswordTarget(u)}>
                      Reset Password
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {passwordTarget && (
        <AdminSetPasswordModal
          userId={passwordTarget.id}
          userLabel={passwordTarget.name ?? passwordTarget.email}
          onClose={() => setPasswordTarget(null)}
        />
      )}
    </div>
  );
};

export default AdminUsersPage;
