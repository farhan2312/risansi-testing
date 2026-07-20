"use client";

import { useEffect, useState } from "react";
import "./AdminAccessRequestsPage.css";
import { listAllUsers, type PendingUser } from "@/services/adminService";
import AdminSetPasswordModal from "@/components/ui/AdminSetPasswordModal";

const AdminUsersPage = () => {
  const [users, setUsers] = useState<PendingUser[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [passwordTarget, setPasswordTarget] = useState<PendingUser | null>(null);

  useEffect(() => {
    listAllUsers()
      .then(setUsers)
      .catch(() => setError("Couldn't load users."))
      .finally(() => setIsLoading(false));
  }, []);

  return (
    <div className="admin-requests-page">
      <div className="admin-requests-header">
        <h1>Manage Users</h1>
        <p>View every user and set a new password on their behalf.</p>
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
                <td>{u.role}</td>
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
