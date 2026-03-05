import { useState, useEffect } from 'react';
import api from '@/lib/api';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow
} from '@/components/ui/table';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle
} from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Eye, FileJson } from 'lucide-react';

function StatusBadge({ status }) {
  const cls =
    status === 'success' ? 'status-success' :
    status === 'error' ? 'status-error' :
    status === 'running' ? 'status-running' : 'status-pending';
  return <Badge variant="outline" className={cls}>{status}</Badge>;
}

export default function ClientExecutions() {
  const [executions, setExecutions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);

  useEffect(() => {
    api.get('/executions?limit=100')
      .then(res => setExecutions(res.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const downloadJSON = (exec) => {
    const blob = new Blob([JSON.stringify(exec.output_data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `execution-${exec.id}.json`; a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6" data-testid="client-executions">
      <div>
        <h1 className="text-3xl font-heading font-bold tracking-tight">Execution History</h1>
        <p className="text-muted-foreground mt-1">View your past workflow runs</p>
      </div>

      <Card>
        <CardContent className="p-4">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Workflow</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Started</TableHead>
                <TableHead>Completed</TableHead>
                <TableHead className="w-24">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {executions.map(exec => (
                <TableRow key={exec.id} data-testid={`exec-row-${exec.id}`}>
                  <TableCell className="font-medium">{exec.workflow_name || 'Unknown'}</TableCell>
                  <TableCell><StatusBadge status={exec.status} /></TableCell>
                  <TableCell className="text-muted-foreground text-sm">{new Date(exec.started_at).toLocaleString()}</TableCell>
                  <TableCell className="text-muted-foreground text-sm">{exec.completed_at ? new Date(exec.completed_at).toLocaleString() : '-'}</TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="icon" onClick={() => setSelected(exec)} data-testid={`view-exec-${exec.id}`}>
                        <Eye className="w-4 h-4" />
                      </Button>
                      {exec.output_data && (
                        <Button variant="ghost" size="icon" onClick={() => downloadJSON(exec)} data-testid={`dl-exec-${exec.id}`}>
                          <FileJson className="w-4 h-4" />
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {executions.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground py-12">
                    {loading ? 'Loading...' : 'No executions yet'}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={!!selected} onOpenChange={() => setSelected(null)}>
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-heading">Execution Details</DialogTitle>
          </DialogHeader>
          {selected && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div><span className="text-muted-foreground">Workflow:</span> <span className="font-medium ml-2">{selected.workflow_name}</span></div>
                <div className="flex items-center gap-2"><span className="text-muted-foreground">Status:</span> <StatusBadge status={selected.status} /></div>
                <div><span className="text-muted-foreground">Started:</span> <span className="ml-2">{new Date(selected.started_at).toLocaleString()}</span></div>
                <div><span className="text-muted-foreground">Completed:</span> <span className="ml-2">{selected.completed_at ? new Date(selected.completed_at).toLocaleString() : '-'}</span></div>
              </div>
              {selected.input_data && Object.keys(selected.input_data).length > 0 && (
                <div>
                  <p className="text-sm font-medium mb-2">Input Data</p>
                  <pre className="json-viewer">{JSON.stringify(selected.input_data, null, 2)}</pre>
                </div>
              )}
              {selected.output_data && (
                <div>
                  <p className="text-sm font-medium mb-2">Output Data</p>
                  <ScrollArea className="max-h-[400px]">
                    <pre className="json-viewer">{JSON.stringify(selected.output_data, null, 2)}</pre>
                  </ScrollArea>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
