import { useState, useEffect } from 'react';
import api from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { Loader2, Save, Copy } from 'lucide-react';

export default function AdminSettings() {
  const [settings, setSettings] = useState({ n8n_base_url: '', n8n_api_key: '' });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api.get('/settings')
      .then(res => setSettings(res.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      await api.put('/settings', settings);
      toast.success('Settings saved');
    } catch {
      toast.error('Failed to save settings');
    }
    setSaving(false);
  };

  const backendUrl = process.env.REACT_APP_BACKEND_URL;

  return (
    <div className="space-y-6" data-testid="admin-settings">
      <div>
        <h1 className="text-3xl font-heading font-bold tracking-tight">Settings</h1>
        <p className="text-muted-foreground mt-1">Configure your n8n connection</p>
      </div>

      <div className="grid gap-6 max-w-2xl">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg font-heading">n8n Connection</CardTitle>
            <CardDescription>Connect your n8n instance for workflow management</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>n8n Base URL</Label>
              <Input
                value={settings.n8n_base_url || ''}
                onChange={e => setSettings(s => ({ ...s, n8n_base_url: e.target.value }))}
                placeholder="https://your-n8n-instance.com"
                data-testid="n8n-url-input"
              />
            </div>
            <div className="space-y-2">
              <Label>n8n API Key</Label>
              <Input
                type="password"
                value={settings.n8n_api_key || ''}
                onChange={e => setSettings(s => ({ ...s, n8n_api_key: e.target.value }))}
                placeholder="Enter your n8n API key"
                data-testid="n8n-api-key-input"
              />
            </div>
            <Button onClick={handleSave} disabled={saving || loading} data-testid="save-settings-btn">
              {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />}
              Save Settings
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg font-heading">Webhook Callback URL</CardTitle>
            <CardDescription>Use this URL in your n8n workflows to send results back to FlowPortal</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2 p-3 rounded-lg bg-secondary/50 border">
              <code className="font-mono text-sm text-primary flex-1 break-all" data-testid="callback-url">
                {backendUrl}/api/n8n/callback
              </code>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  navigator.clipboard.writeText(`${backendUrl}/api/n8n/callback`);
                  toast.success('Copied to clipboard');
                }}
                data-testid="copy-callback-btn"
              >
                <Copy className="w-3.5 h-3.5 mr-1.5" /> Copy
              </Button>
            </div>
            <p className="text-xs text-muted-foreground mt-3">
              Send a POST request with <code className="font-mono text-xs bg-secondary px-1 py-0.5 rounded">{"{ execution_id, status, output_data }"}</code> to update execution results asynchronously.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg font-heading">Default Admin Credentials</CardTitle>
            <CardDescription>Use these to log in for the first time</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 text-sm">
              <div className="flex gap-2">
                <span className="text-muted-foreground w-20">Email:</span>
                <code className="font-mono text-foreground">admin@flowportal.com</code>
              </div>
              <div className="flex gap-2">
                <span className="text-muted-foreground w-20">Password:</span>
                <code className="font-mono text-foreground">admin123</code>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
