import { useState, useEffect } from 'react';
import api from '@/lib/api';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow
} from '@/components/ui/table';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter
} from '@/components/ui/dialog';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger
} from '@/components/ui/dropdown-menu';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { Plus, MoreHorizontal, Pencil, Trash2, Loader2, X } from 'lucide-react';

const emptyField = { name: '', label: '', type: 'text', required: false, options: [] };

function SchemaBuilder({ schema, onChange }) {
  const addField = () => onChange([...schema, { ...emptyField }]);
  const removeField = (i) => onChange(schema.filter((_, idx) => idx !== i));
  const updateField = (i, key, val) => {
    const updated = [...schema];
    updated[i] = { ...updated[i], [key]: val };
    onChange(updated);
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <Label className="text-sm font-medium">Input Fields</Label>
        <Button type="button" variant="outline" size="sm" onClick={addField} data-testid="add-field-btn">
          <Plus className="w-3 h-3 mr-1" /> Add Field
        </Button>
      </div>
      {schema.map((field, i) => (
        <div key={i} className="flex flex-col gap-2 p-3 rounded-lg bg-secondary/50 border">
          <div className="grid grid-cols-12 gap-2 items-center">
            <div className="col-span-3">
              <Input placeholder="name" value={field.name} onChange={e => updateField(i, 'name', e.target.value)} className="text-sm" data-testid={`field-name-${i}`} />
            </div>
            <div className="col-span-3">
              <Input placeholder="Label" value={field.label} onChange={e => updateField(i, 'label', e.target.value)} className="text-sm" data-testid={`field-label-${i}`} />
            </div>
            <div className="col-span-3">
              <Select value={field.type} onValueChange={v => updateField(i, 'type', v)}>
                <SelectTrigger className="text-sm" data-testid={`field-type-${i}`}><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="text">Text</SelectItem>
                  <SelectItem value="number">Number</SelectItem>
                  <SelectItem value="email">Email</SelectItem>
                  <SelectItem value="textarea">Textarea</SelectItem>
                  <SelectItem value="select">Select</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="col-span-2 flex items-center gap-1.5">
              <Checkbox checked={field.required} onCheckedChange={v => updateField(i, 'required', !!v)} data-testid={`field-required-${i}`} />
              <span className="text-xs text-muted-foreground">Req</span>
            </div>
            <div className="col-span-1 flex justify-end">
              <Button type="button" variant="ghost" size="icon" onClick={() => removeField(i)} className="h-8 w-8 text-muted-foreground hover:text-destructive">
                <X className="w-3.5 h-3.5" />
              </Button>
            </div>
          </div>
          {field.type === 'select' && (
            <Input
              placeholder="Options (comma separated)"
              value={(field.options || []).join(', ')}
              onChange={e => updateField(i, 'options', e.target.value.split(',').map(s => s.trim()).filter(Boolean))}
              className="text-sm"
              data-testid={`field-options-${i}`}
            />
          )}
        </div>
      ))}
      {schema.length === 0 && (
        <p className="text-sm text-muted-foreground text-center py-4 border border-dashed rounded-lg">
          No input fields defined. Workflow will be triggered without parameters.
        </p>
      )}
    </div>
  );
}

export default function AdminWorkflows() {
  const [workflows, setWorkflows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showDialog, setShowDialog] = useState(false);
  const [editing, setEditing] = useState(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    name: '', description: '', webhook_url: '', n8n_workflow_id: '', input_schema: []
  });

  const fetchWorkflows = async () => {
    try {
      const res = await api.get('/workflows');
      setWorkflows(res.data);
    } catch {
      toast.error('Failed to load workflows');
    }
    setLoading(false);
  };

  useEffect(() => { fetchWorkflows(); }, []);

  const openCreate = () => {
    setEditing(null);
    setForm({ name: '', description: '', webhook_url: '', n8n_workflow_id: '', input_schema: [] });
    setShowDialog(true);
  };

  const openEdit = (wf) => {
    setEditing(wf);
    setForm({
      name: wf.name,
      description: wf.description || '',
      webhook_url: wf.webhook_url,
      n8n_workflow_id: wf.n8n_workflow_id || '',
      input_schema: wf.input_schema || []
    });
    setShowDialog(true);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      if (editing) {
        await api.put(`/workflows/${editing.id}`, form);
        toast.success('Workflow updated');
      } else {
        await api.post('/workflows', form);
        toast.success('Workflow created');
      }
      setShowDialog(false);
      fetchWorkflows();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to save');
    }
    setSaving(false);
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this workflow and all its executions?')) return;
    try {
      await api.delete(`/workflows/${id}`);
      toast.success('Workflow deleted');
      fetchWorkflows();
    } catch {
      toast.error('Failed to delete');
    }
  };

  return (
    <div className="space-y-6" data-testid="admin-workflows">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-heading font-bold tracking-tight">Workflows</h1>
          <p className="text-muted-foreground mt-1">Configure n8n workflows and webhooks</p>
        </div>
        <Button onClick={openCreate} data-testid="add-workflow-btn">
          <Plus className="w-4 h-4 mr-2" /> Add Workflow
        </Button>
      </div>

      <Card>
        <CardContent className="p-4">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Webhook URL</TableHead>
                <TableHead>Fields</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-12"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {workflows.map(wf => (
                <TableRow key={wf.id} data-testid={`workflow-row-${wf.id}`}>
                  <TableCell>
                    <div>
                      <p className="font-medium">{wf.name}</p>
                      {wf.description && <p className="text-xs text-muted-foreground mt-0.5 truncate max-w-[200px]">{wf.description}</p>}
                    </div>
                  </TableCell>
                  <TableCell>
                    <code className="font-mono text-xs text-muted-foreground max-w-[200px] truncate block">{wf.webhook_url}</code>
                  </TableCell>
                  <TableCell>
                    <Badge variant="secondary">{(wf.input_schema || []).length} fields</Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className={wf.is_active ? 'status-success' : 'status-error'}>
                      {wf.is_active ? 'Active' : 'Inactive'}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" data-testid={`workflow-actions-${wf.id}`}>
                          <MoreHorizontal className="w-4 h-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => openEdit(wf)} data-testid={`edit-workflow-${wf.id}`}>
                          <Pencil className="w-4 h-4 mr-2" /> Edit
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleDelete(wf.id)} className="text-destructive" data-testid={`delete-workflow-${wf.id}`}>
                          <Trash2 className="w-4 h-4 mr-2" /> Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
              {workflows.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground py-12">
                    {loading ? 'Loading...' : 'No workflows configured. Add your first workflow.'}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-heading">{editing ? 'Edit Workflow' : 'Add Workflow'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Workflow Name</Label>
                <Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g. Lead Processing" data-testid="workflow-name-input" />
              </div>
              <div className="space-y-2">
                <Label>n8n Workflow ID <span className="text-xs text-muted-foreground">(optional)</span></Label>
                <Input value={form.n8n_workflow_id} onChange={e => setForm(f => ({ ...f, n8n_workflow_id: e.target.value }))} placeholder="e.g. 123" data-testid="workflow-n8n-id-input" />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Webhook URL</Label>
              <Input value={form.webhook_url} onChange={e => setForm(f => ({ ...f, webhook_url: e.target.value }))} placeholder="https://your-n8n.com/webhook/..." data-testid="workflow-webhook-input" />
            </div>
            <div className="space-y-2">
              <Label>Description</Label>
              <Textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="What does this workflow do?" rows={2} data-testid="workflow-desc-input" />
            </div>
            <SchemaBuilder schema={form.input_schema} onChange={schema => setForm(f => ({ ...f, input_schema: schema }))} />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDialog(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={saving} data-testid="save-workflow-btn">
              {saving && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
              {editing ? 'Update' : 'Create'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
