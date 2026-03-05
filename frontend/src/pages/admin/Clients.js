import { useState, useEffect } from 'react';
import api from '@/lib/api';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow
} from '@/components/ui/table';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter
} from '@/components/ui/dialog';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger
} from '@/components/ui/dropdown-menu';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { MoreHorizontal, Pencil, Trash2, Shield, Loader2, UserPlus, Search } from 'lucide-react';

export default function AdminClients() {
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showAdd, setShowAdd] = useState(false);
  const [showEdit, setShowEdit] = useState(false);
  const [showPerms, setShowPerms] = useState(false);
  const [selected, setSelected] = useState(null);
  const [form, setForm] = useState({ name: '', email: '', password: '' });
  const [saving, setSaving] = useState(false);
  const [workflows, setWorkflows] = useState([]);
  const [assignments, setAssignments] = useState([]);

  const fetchClients = async () => {
    try {
      const res = await api.get('/users');
      setClients(res.data.filter(u => u.role === 'client'));
    } catch {
      toast.error('Failed to load clients');
    }
    setLoading(false);
  };

  useEffect(() => { fetchClients(); }, []);

  const handleCreate = async () => {
    setSaving(true);
    try {
      await api.post('/users', { ...form, role: 'client' });
      toast.success('Client created');
      setShowAdd(false);
      setForm({ name: '', email: '', password: '' });
      fetchClients();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to create');
    }
    setSaving(false);
  };

  const handleUpdate = async () => {
    setSaving(true);
    try {
      const data = { name: form.name, email: form.email };
      if (form.password) data.password = form.password;
      await api.put(`/users/${selected.id}`, data);
      toast.success('Client updated');
      setShowEdit(false);
      fetchClients();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to update');
    }
    setSaving(false);
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this client? This will remove all their permissions.')) return;
    try {
      await api.delete(`/users/${id}`);
      toast.success('Client deleted');
      fetchClients();
    } catch {
      toast.error('Failed to delete');
    }
  };

  const openPerms = async (client) => {
    setSelected(client);
    try {
      const [wfRes, assignRes] = await Promise.all([
        api.get('/workflows'),
        api.get(`/assignments?user_id=${client.id}`)
      ]);
      setWorkflows(wfRes.data);
      setAssignments(assignRes.data);
      setShowPerms(true);
    } catch {
      toast.error('Failed to load permissions');
    }
  };

  const togglePerm = async (workflowId, field, current) => {
    const existing = assignments.find(a => a.workflow_id === workflowId);
    try {
      if (existing) {
        const res = await api.put(`/assignments/${existing.id}`, { [field]: !current });
        setAssignments(prev => prev.map(a => a.id === existing.id ? res.data : a));
      } else {
        const payload = {
          user_id: selected.id,
          workflow_id: workflowId,
          can_view: field === 'can_view',
          can_trigger: field === 'can_trigger',
          can_download: field === 'can_download',
        };
        const res = await api.post('/assignments', payload);
        setAssignments(prev => [...prev, res.data]);
      }
      toast.success('Permission updated');
    } catch {
      toast.error('Failed to update permission');
    }
  };

  const filtered = clients.filter(c =>
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    c.email.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6" data-testid="admin-clients">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-heading font-bold tracking-tight">Clients</h1>
          <p className="text-muted-foreground mt-1">Manage client accounts and permissions</p>
        </div>
        <Button onClick={() => { setForm({ name: '', email: '', password: '' }); setShowAdd(true); }} data-testid="add-client-btn">
          <UserPlus className="w-4 h-4 mr-2" /> Add Client
        </Button>
      </div>

      <Card>
        <CardContent className="p-4">
          <div className="flex items-center gap-2 mb-4">
            <Search className="w-4 h-4 text-muted-foreground shrink-0" />
            <Input
              placeholder="Search clients..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="max-w-sm"
              data-testid="search-clients-input"
            />
          </div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Created</TableHead>
                <TableHead className="w-12"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map(client => (
                <TableRow key={client.id} data-testid={`client-row-${client.id}`}>
                  <TableCell className="font-medium">{client.name}</TableCell>
                  <TableCell className="text-muted-foreground">{client.email}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className={client.is_active ? 'status-success' : 'status-error'}>
                      {client.is_active ? 'Active' : 'Inactive'}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground text-sm">
                    {new Date(client.created_at).toLocaleDateString()}
                  </TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" data-testid={`client-actions-${client.id}`}>
                          <MoreHorizontal className="w-4 h-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => {
                          setSelected(client);
                          setForm({ name: client.name, email: client.email, password: '' });
                          setShowEdit(true);
                        }} data-testid={`edit-client-${client.id}`}>
                          <Pencil className="w-4 h-4 mr-2" /> Edit
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => openPerms(client)} data-testid={`perms-client-${client.id}`}>
                          <Shield className="w-4 h-4 mr-2" /> Permissions
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleDelete(client.id)} className="text-destructive" data-testid={`delete-client-${client.id}`}>
                          <Trash2 className="w-4 h-4 mr-2" /> Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
              {filtered.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground py-12">
                    {loading ? 'Loading...' : 'No clients found. Add your first client to get started.'}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Add Dialog */}
      <Dialog open={showAdd} onOpenChange={setShowAdd}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="font-heading">Add Client</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Name</Label>
              <Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Client name" data-testid="client-name-input" />
            </div>
            <div className="space-y-2">
              <Label>Email</Label>
              <Input type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} placeholder="client@example.com" data-testid="client-email-input" />
            </div>
            <div className="space-y-2">
              <Label>Password</Label>
              <Input type="password" value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))} placeholder="Set password" data-testid="client-password-input" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAdd(false)}>Cancel</Button>
            <Button onClick={handleCreate} disabled={saving} data-testid="save-client-btn">
              {saving && <Loader2 className="w-4 h-4 animate-spin mr-2" />} Create
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={showEdit} onOpenChange={setShowEdit}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="font-heading">Edit Client</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Name</Label>
              <Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} data-testid="edit-name-input" />
            </div>
            <div className="space-y-2">
              <Label>Email</Label>
              <Input type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} data-testid="edit-email-input" />
            </div>
            <div className="space-y-2">
              <Label>New Password (leave empty to keep current)</Label>
              <Input type="password" value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))} data-testid="edit-password-input" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowEdit(false)}>Cancel</Button>
            <Button onClick={handleUpdate} disabled={saving} data-testid="update-client-btn">
              {saving && <Loader2 className="w-4 h-4 animate-spin mr-2" />} Update
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Permissions Dialog */}
      <Dialog open={showPerms} onOpenChange={setShowPerms}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="font-heading">Permissions for {selected?.name}</DialogTitle>
          </DialogHeader>
          {workflows.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Workflow</TableHead>
                  <TableHead className="text-center">View</TableHead>
                  <TableHead className="text-center">Trigger</TableHead>
                  <TableHead className="text-center">Download</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {workflows.map(wf => {
                  const a = assignments.find(x => x.workflow_id === wf.id);
                  return (
                    <TableRow key={wf.id}>
                      <TableCell className="font-medium">{wf.name}</TableCell>
                      <TableCell className="text-center">
                        <Switch
                          checked={a?.can_view || false}
                          onCheckedChange={() => togglePerm(wf.id, 'can_view', a?.can_view || false)}
                          data-testid={`perm-view-${wf.id}`}
                        />
                      </TableCell>
                      <TableCell className="text-center">
                        <Switch
                          checked={a?.can_trigger || false}
                          onCheckedChange={() => togglePerm(wf.id, 'can_trigger', a?.can_trigger || false)}
                          data-testid={`perm-trigger-${wf.id}`}
                        />
                      </TableCell>
                      <TableCell className="text-center">
                        <Switch
                          checked={a?.can_download || false}
                          onCheckedChange={() => togglePerm(wf.id, 'can_download', a?.can_download || false)}
                          data-testid={`perm-download-${wf.id}`}
                        />
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          ) : (
            <p className="text-muted-foreground text-center py-8">No workflows configured. Create workflows first.</p>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
