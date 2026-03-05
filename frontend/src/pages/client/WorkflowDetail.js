import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import api from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from '@/components/ui/select';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow
} from '@/components/ui/table';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';
import { Play, Loader2, FileJson, FileSpreadsheet } from 'lucide-react';

function StatusBadge({ status }) {
  const cls =
    status === 'success' ? 'status-success' :
    status === 'error' ? 'status-error' :
    status === 'running' ? 'status-running' : 'status-pending';
  return <Badge variant="outline" className={cls}>{status}</Badge>;
}

export default function ClientWorkflowDetail() {
  const { id } = useParams();
  const [workflow, setWorkflow] = useState(null);
  const [executions, setExecutions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [triggering, setTriggering] = useState(false);
  const [formData, setFormData] = useState({});
  const [selectedExec, setSelectedExec] = useState(null);
  const [activeTab, setActiveTab] = useState('trigger');

  const fetchData = useCallback(async () => {
    try {
      const [wfRes, execRes] = await Promise.all([
        api.get(`/workflows/${id}`),
        api.get(`/executions?workflow_id=${id}`)
      ]);
      setWorkflow(wfRes.data);
      setExecutions(execRes.data);
      const initial = {};
      (wfRes.data.input_schema || []).forEach(f => { initial[f.name] = ''; });
      setFormData(initial);
      if (!wfRes.data.permissions?.can_trigger) setActiveTab('history');
    } catch {
      toast.error('Failed to load workflow');
    }
    setLoading(false);
  }, [id]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleTrigger = async () => {
    setTriggering(true);
    try {
      const res = await api.post(`/workflows/${id}/trigger`, { input_data: formData });
      toast.success('Workflow triggered!');
      setExecutions(prev => [res.data, ...prev]);
      setSelectedExec(res.data);
      setActiveTab('result');
      const reset = {};
      (workflow.input_schema || []).forEach(f => { reset[f.name] = ''; });
      setFormData(reset);
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to trigger workflow');
    }
    setTriggering(false);
  };

  const downloadJSON = (data, name) => {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `${name}.json`; a.click();
    URL.revokeObjectURL(url);
  };

  const downloadCSV = (data, name) => {
    let csvContent = '';
    const items = Array.isArray(data) ? data : [data];
    if (items.length > 0 && typeof items[0] === 'object') {
      const headers = Object.keys(items[0]);
      csvContent = headers.join(',') + '\n';
      items.forEach(row => {
        csvContent += headers.map(h => JSON.stringify(row[h] ?? '')).join(',') + '\n';
      });
    } else {
      csvContent = JSON.stringify(data);
    }
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `${name}.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-10 w-48" />
        <Skeleton className="h-64" />
      </div>
    );
  }

  if (!workflow) {
    return <p className="text-muted-foreground">Workflow not found or you don't have access.</p>;
  }

  const canTrigger = workflow.permissions?.can_trigger;
  const canDownload = workflow.permissions?.can_download;
  const schema = workflow.input_schema || [];

  return (
    <div className="space-y-6" data-testid="workflow-detail">
      <div>
        <h1 className="text-3xl font-heading font-bold tracking-tight">{workflow.name}</h1>
        {workflow.description && <p className="text-muted-foreground mt-1">{workflow.description}</p>}
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList data-testid="workflow-tabs">
          {canTrigger && <TabsTrigger value="trigger" data-testid="tab-trigger">Trigger</TabsTrigger>}
          <TabsTrigger value="history" data-testid="tab-history">History</TabsTrigger>
          {selectedExec && <TabsTrigger value="result" data-testid="tab-result">Latest Result</TabsTrigger>}
        </TabsList>

        {canTrigger && (
          <TabsContent value="trigger">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg font-heading">Run Workflow</CardTitle>
                <CardDescription>Fill in the parameters and trigger the workflow</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {schema.length > 0 ? (
                  schema.map(field => (
                    <div key={field.name} className="space-y-2">
                      <Label>
                        {field.label || field.name}
                        {field.required && <span className="text-destructive ml-1">*</span>}
                      </Label>
                      {field.type === 'textarea' ? (
                        <Textarea
                          value={formData[field.name] || ''}
                          onChange={e => setFormData(f => ({ ...f, [field.name]: e.target.value }))}
                          placeholder={`Enter ${field.label || field.name}`}
                          data-testid={`input-${field.name}`}
                        />
                      ) : field.type === 'select' ? (
                        <Select value={formData[field.name] || ''} onValueChange={v => setFormData(f => ({ ...f, [field.name]: v }))}>
                          <SelectTrigger data-testid={`input-${field.name}`}>
                            <SelectValue placeholder={`Select ${field.label || field.name}`} />
                          </SelectTrigger>
                          <SelectContent>
                            {(field.options || []).map(opt => (
                              <SelectItem key={opt} value={opt}>{opt}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      ) : (
                        <Input
                          type={field.type || 'text'}
                          value={formData[field.name] || ''}
                          onChange={e => setFormData(f => ({ ...f, [field.name]: e.target.value }))}
                          placeholder={`Enter ${field.label || field.name}`}
                          data-testid={`input-${field.name}`}
                        />
                      )}
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-muted-foreground py-2">This workflow requires no input parameters.</p>
                )}
                <Button
                  onClick={handleTrigger}
                  disabled={triggering}
                  className="w-full sm:w-auto"
                  data-testid="trigger-workflow-btn"
                >
                  {triggering ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Play className="w-4 h-4 mr-2" />}
                  {triggering ? 'Running...' : 'Trigger Workflow'}
                </Button>
              </CardContent>
            </Card>
          </TabsContent>
        )}

        <TabsContent value="history">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg font-heading">Execution History</CardTitle>
            </CardHeader>
            <CardContent>
              {executions.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Status</TableHead>
                      <TableHead>Started</TableHead>
                      <TableHead>Completed</TableHead>
                      <TableHead className="w-24">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {executions.map(exec => (
                      <TableRow
                        key={exec.id}
                        className="cursor-pointer hover:bg-muted/50"
                        onClick={() => { setSelectedExec(exec); setActiveTab('result'); }}
                        data-testid={`hist-exec-${exec.id}`}
                      >
                        <TableCell><StatusBadge status={exec.status} /></TableCell>
                        <TableCell className="text-sm text-muted-foreground">{new Date(exec.started_at).toLocaleString()}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">{exec.completed_at ? new Date(exec.completed_at).toLocaleString() : '-'}</TableCell>
                        <TableCell>
                          <div className="flex gap-1" onClick={e => e.stopPropagation()}>
                            {canDownload && exec.output_data && (
                              <>
                                <Button variant="ghost" size="icon" onClick={() => downloadJSON(exec.output_data, `exec-${exec.id}`)} data-testid={`dl-json-${exec.id}`}>
                                  <FileJson className="w-4 h-4" />
                                </Button>
                                <Button variant="ghost" size="icon" onClick={() => downloadCSV(exec.output_data, `exec-${exec.id}`)} data-testid={`dl-csv-${exec.id}`}>
                                  <FileSpreadsheet className="w-4 h-4" />
                                </Button>
                              </>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <p className="text-muted-foreground text-center py-12">No executions yet. Trigger the workflow to see results here.</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {selectedExec && (
          <TabsContent value="result">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div>
                    <CardTitle className="text-lg font-heading">Result</CardTitle>
                    <CardDescription>Execution from {new Date(selectedExec.started_at).toLocaleString()}</CardDescription>
                  </div>
                  <StatusBadge status={selectedExec.status} />
                </div>
              </CardHeader>
              <CardContent>
                {selectedExec.output_data ? (
                  <div className="space-y-4">
                    <ScrollArea className="max-h-[500px]">
                      <pre className="json-viewer" data-testid="result-json">{JSON.stringify(selectedExec.output_data, null, 2)}</pre>
                    </ScrollArea>
                    {canDownload && (
                      <div className="flex gap-2">
                        <Button variant="outline" size="sm" onClick={() => downloadJSON(selectedExec.output_data, `result-${selectedExec.id}`)} data-testid="download-json-btn">
                          <FileJson className="w-4 h-4 mr-2" /> Download JSON
                        </Button>
                        <Button variant="outline" size="sm" onClick={() => downloadCSV(selectedExec.output_data, `result-${selectedExec.id}`)} data-testid="download-csv-btn">
                          <FileSpreadsheet className="w-4 h-4 mr-2" /> Download CSV
                        </Button>
                      </div>
                    )}
                  </div>
                ) : (
                  <p className="text-muted-foreground text-center py-12">
                    {selectedExec.status === 'running' ? 'Workflow is still running...' : 'No output data available'}
                  </p>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}
