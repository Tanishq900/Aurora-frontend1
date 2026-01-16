import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../state/auth.store';
import { adminService, AdminSecurityUser } from '../../services/admin.service';
import AuroraSelect from '../../ui/aurora/AuroraSelect';

export default function AdminDashboard() {
  const { user, logout } = useAuthStore();
  const navigate = useNavigate();

  const [status, setStatus] = useState<'pending' | 'approved' | 'all'>('pending');
  const [users, setUsers] = useState<AdminSecurityUser[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string>('');

  const title = useMemo(() => {
    if (status === 'pending') return 'Pending Security Users';
    if (status === 'approved') return 'Approved Security Users';
    return 'All Security Users';
  }, [status]);

  const load = useCallback(async (nextStatus: 'pending' | 'approved' | 'all' = status) => {
    setIsLoading(true);
    setError('');
    try {
      const list = await adminService.listSecurityUsers(nextStatus);
      setUsers(list);
    } catch (e: any) {
      setError(e?.response?.data?.error || e?.message || 'Failed to load security users');
    } finally {
      setIsLoading(false);
    }
  }, [status]);

  useEffect(() => {
    if (user?.role !== 'admin') {
      navigate('/');
      return;
    }
    load('pending');
  }, [load, navigate, user?.role]);

  const handleApprove = async (id: string) => {
    setError('');
    try {
      await adminService.approveSecurityUser(id);
      await load();
    } catch (e: any) {
      setError(e?.response?.data?.error || e?.message || 'Failed to approve user');
    }
  };

  const handleDelete = async (id: string) => {
    setError('');
    try {
      await adminService.deleteSecurityUser(id);
      await load();
    } catch (e: any) {
      setError(e?.response?.data?.error || e?.message || 'Failed to delete user');
    }
  };

  return (
    <div className="min-h-screen bg-black p-6 relative">
      <div className="aurora-bg" />
      <div className="max-w-7xl mx-auto relative z-10">
        <div className="glass-panel border-b border-border/50 px-6 py-4 flex justify-between items-center mb-8">
          <div>
            <h1 className="text-2xl font-bold aurora-text">Admin Dashboard</h1>
            <p className="text-sm text-muted-foreground">Welcome, {user?.name || user?.email}</p>
          </div>
          <div className="flex gap-4">
            <Link
              to="/"
              className="px-4 py-2 bg-secondary/60 hover:bg-secondary/80 text-foreground rounded-lg transition-colors border border-border/50"
            >
              Home
            </Link>
            <button
              onClick={logout}
              className="px-4 py-2 bg-secondary/60 hover:bg-secondary/80 text-foreground rounded-lg transition-colors border border-border/50"
            >
              Logout
            </button>
          </div>
        </div>

        <div className="glass-panel p-6 border border-border/60">
          <div className="flex items-center justify-between gap-4 pb-3 mb-4 border-b border-border/40">
            <div>
              <h2 className="text-xl font-semibold text-foreground">{title}</h2>
              <div className="text-sm text-muted-foreground">Approve or reject security accounts</div>
            </div>

            <div className="flex items-center gap-3">
              <AuroraSelect
                value={status}
                onChange={(v) => {
                  const next = v as 'pending' | 'approved' | 'all';
                  setStatus(next);
                  load(next);
                }}
                options={[
                  { value: 'pending', label: 'Pending' },
                  { value: 'approved', label: 'Approved' },
                  { value: 'all', label: 'All' },
                ]}
                buttonClassName="w-40 px-4 py-2 bg-card/50 border border-border rounded-lg backdrop-blur-sm hover:bg-card/60 focus:ring-primary/50"
              />

              <button
                type="button"
                onClick={() => load()}
                className="px-4 py-2 bg-secondary/60 hover:bg-secondary/80 text-foreground rounded-lg transition-colors border border-border/50"
              >
                Refresh
              </button>
            </div>
          </div>

          {error ? (
            <div className="mb-4 bg-destructive/20 border border-destructive/40 text-destructive-foreground px-4 py-3 rounded">
              {error}
            </div>
          ) : null}

          {isLoading ? (
            <div className="text-center py-8 text-muted-foreground">Loading...</div>
          ) : users.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">No users found</div>
          ) : (
            <div className="space-y-3">
              {users.map((u) => (
                <div
                  key={u.id}
                  className="bg-black/40 rounded-lg p-4 border border-border/60 shadow-[0_10px_30px_rgba(0,0,0,0.35)]"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <div className="text-foreground font-semibold">{u.name}</div>
                      <div className="text-sm text-muted-foreground">{u.email}</div>
                      <div className="text-xs text-muted-foreground mt-1">{new Date(u.created_at).toLocaleString()}</div>
                    </div>

                    <div className="flex items-center gap-2">
                      {u.security_approved ? (
                        <span className="px-3 py-1 rounded text-xs font-semibold bg-safe/20 text-safe border border-safe/30">
                          APPROVED
                        </span>
                      ) : (
                        <span className="px-3 py-1 rounded text-xs font-semibold bg-warning/20 text-warning border border-warning/30">
                          PENDING
                        </span>
                      )}

                      {!u.security_approved ? (
                        <button
                          type="button"
                          onClick={() => handleApprove(u.id)}
                          className="px-4 py-2 bg-primary/80 hover:bg-primary text-primary-foreground rounded-lg border border-primary/30"
                        >
                          Approve
                        </button>
                      ) : null}

                      <button
                        type="button"
                        onClick={() => handleDelete(u.id)}
                        className="px-4 py-2 bg-danger/80 hover:bg-danger text-white rounded-lg border border-danger/30"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
