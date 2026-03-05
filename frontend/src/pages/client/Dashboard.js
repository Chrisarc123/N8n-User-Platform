import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Play, Eye, ArrowRight, GitBranch, Activity } from 'lucide-react';

export default function ClientDashboard() {
  const [workflows, setWorkflows] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    Promise.all([
      api.get('/workflows'),
      api.get('/client/stats')
    ]).then(([wfRes, statsRes]) => {
      setWorkflows(wfRes.data);
      setStats(statsRes.data);
    }).catch(() => {}).finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-48" />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {[...Array(2)].map((_, i) => <Skeleton key={i} className="h-24" />)}
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-48" />)}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8" data-testid="client-dashboard">
      <div>
        <h1 className="text-3xl font-heading font-bold tracking-tight">My Workflows</h1>
        <p className="text-muted-foreground mt-1 text-base">Access your assigned automation workflows</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Card className="animate-fade-in-up">
          <CardContent className="p-6 flex items-center gap-4">
            <div className="w-12 h-12 rounded-lg bg-indigo-500/15 flex items-center justify-center shrink-0">
              <GitBranch className="w-6 h-6 text-indigo-400" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Available Workflows</p>
              <p className="text-2xl font-heading font-bold">{stats?.total_workflows || 0}</p>
            </div>
          </CardContent>
        </Card>
        <Card className="animate-fade-in-up" style={{ animationDelay: '60ms' }}>
          <CardContent className="p-6 flex items-center gap-4">
            <div className="w-12 h-12 rounded-lg bg-emerald-500/15 flex items-center justify-center shrink-0">
              <Activity className="w-6 h-6 text-emerald-400" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Total Runs</p>
              <p className="text-2xl font-heading font-bold">{stats?.total_executions || 0}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {workflows.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {workflows.map((wf, i) => (
            <Card
              key={wf.id}
              className="group cursor-pointer hover:border-primary/50 transition-all duration-200 animate-fade-in-up"
              style={{ animationDelay: `${(i + 2) * 60}ms` }}
              onClick={() => navigate(`/workflows/${wf.id}`)}
              data-testid={`workflow-card-${wf.id}`}
            >
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base font-heading">{wf.name}</CardTitle>
                  <ArrowRight className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors" />
                </div>
              </CardHeader>
              <CardContent>
                {wf.description && (
                  <p className="text-sm text-muted-foreground mb-4 line-clamp-2">{wf.description}</p>
                )}
                <div className="flex flex-wrap items-center gap-2">
                  {wf.permissions?.can_trigger && (
                    <Badge variant="outline" className="text-xs bg-indigo-500/10 text-indigo-400 border-indigo-500/20">
                      <Play className="w-3 h-3 mr-1" /> Trigger
                    </Badge>
                  )}
                  {wf.permissions?.can_download && (
                    <Badge variant="outline" className="text-xs bg-emerald-500/10 text-emerald-400 border-emerald-500/20">
                      Download
                    </Badge>
                  )}
                  {wf.permissions?.can_view && !wf.permissions?.can_trigger && (
                    <Badge variant="outline" className="text-xs">
                      <Eye className="w-3 h-3 mr-1" /> View Only
                    </Badge>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <Card>
          <CardContent className="py-16 text-center">
            <GitBranch className="w-12 h-12 text-muted-foreground mx-auto mb-4 opacity-50" />
            <p className="text-muted-foreground font-medium">No workflows assigned to you yet</p>
            <p className="text-sm text-muted-foreground mt-1">Contact your administrator to get access.</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
