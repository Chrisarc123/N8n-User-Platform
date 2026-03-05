import { useState, useEffect } from 'react';
import api from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow
} from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { Users, GitBranch, Activity, TrendingUp } from 'lucide-react';

function StatCard({ title, value, icon: Icon, color, delay }) {
  return (
    <Card
      className="animate-fade-in-up"
      style={{ animationDelay: `${delay}ms` }}
      data-testid={`stat-${title.toLowerCase().replace(/\s+/g, '-')}`}
    >
      <CardContent className="p-6">
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <p className="text-sm text-muted-foreground uppercase tracking-[0.15em] font-medium">
              {title}
            </p>
            <p className="text-3xl font-heading font-bold tracking-tight">{value}</p>
          </div>
          <div className={`w-12 h-12 rounded-lg flex items-center justify-center ${color}`}>
            <Icon className="w-6 h-6" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function StatusBadge({ status }) {
  const cls =
    status === 'success' ? 'status-success' :
    status === 'error' ? 'status-error' :
    status === 'running' ? 'status-running' : 'status-pending';
  return <Badge variant="outline" className={cls}>{status}</Badge>;
}

export default function AdminDashboard() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/stats')
      .then(res => setStats(res.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-48" />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-28" />)}
        </div>
        <Skeleton className="h-64" />
      </div>
    );
  }

  const successRate = stats?.total_executions > 0
    ? Math.round((stats.successful_executions / stats.total_executions) * 100)
    : 0;

  return (
    <div className="space-y-8" data-testid="admin-dashboard">
      <div>
        <h1 className="text-3xl font-heading font-bold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground mt-1 text-base">Overview of your automation portal</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard title="Total Clients" value={stats?.total_clients || 0} icon={Users} color="bg-indigo-500/15 text-indigo-400" delay={0} />
        <StatCard title="Active Workflows" value={stats?.active_workflows || 0} icon={GitBranch} color="bg-emerald-500/15 text-emerald-400" delay={60} />
        <StatCard title="Total Executions" value={stats?.total_executions || 0} icon={Activity} color="bg-blue-500/15 text-blue-400" delay={120} />
        <StatCard title="Success Rate" value={`${successRate}%`} icon={TrendingUp} color="bg-amber-500/15 text-amber-400" delay={180} />
      </div>

      <Card className="animate-fade-in-up" style={{ animationDelay: '240ms' }}>
        <CardHeader>
          <CardTitle className="text-lg font-heading">Recent Executions</CardTitle>
        </CardHeader>
        <CardContent>
          {stats?.recent_executions?.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Workflow</TableHead>
                  <TableHead>Triggered By</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Time</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {stats.recent_executions.map(exec => (
                  <TableRow key={exec.id} data-testid={`recent-exec-${exec.id}`}>
                    <TableCell className="font-medium">{exec.workflow_name || 'Unknown'}</TableCell>
                    <TableCell className="text-muted-foreground">{exec.triggered_by_name || 'System'}</TableCell>
                    <TableCell><StatusBadge status={exec.status} /></TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {new Date(exec.started_at).toLocaleString()}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <p className="text-muted-foreground text-center py-12">No executions yet. Create workflows and assign them to clients to get started.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
