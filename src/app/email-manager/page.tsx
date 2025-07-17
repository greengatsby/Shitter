'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Loader2, Plus, Edit, Trash2, Save, X, Mail, Lightbulb, Search } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface BestPractice {
  id?: string;
  title: string;
  description: string;
  example?: string;
  priority: number;
  practice_type?: 'rule' | 'detailed' | 'guideline';
  source?: string;
  created_at?: string;
  updated_at?: string;
}

interface EmailTemplate {
  id?: string;
  name: string;
  description?: string;
  category?: string;
  subject_line: string;
  body: string;
  is_active?: boolean;
  use_case?: string;
  target_audience?: string;
  tags?: string[];
  variables?: string[];
  created_at?: string;
  updated_at?: string;
}

export default function PracticeManagerPage() {
  // State for best practices
  const [bestPractices, setBestPractices] = useState<BestPractice[]>([]);
  const [editingPractice, setEditingPractice] = useState<BestPractice | null>(null);
  const [practiceDialogOpen, setPracticeDialogOpen] = useState(false);

  // State for email templates
  const [emailTemplates, setEmailTemplates] = useState<EmailTemplate[]>([]);
  const [editingTemplate, setEditingTemplate] = useState<EmailTemplate | null>(null);
  const [templateDialogOpen, setTemplateDialogOpen] = useState(false);

  // Loading states
  const [loadingPractices, setLoadingPractices] = useState(true);
  const [loadingTemplates, setLoadingTemplates] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);

  // Filter states
  const [practiceFilter, setPracticeFilter] = useState('');
  const [templateFilter, setTemplateFilter] = useState('');

  // Error state
  const [error, setError] = useState<string | null>(null);

  // Load best practices
  const loadBestPractices = async () => {
    try {
      setLoadingPractices(true);
      const response = await fetch('/api/best-practices');
      const data = await response.json();

      if (data.success) {
        setBestPractices(data.practices);
      } else {
        setError(data.error || 'Failed to load best practices');
      }
    } catch (err) {
      setError('Failed to connect to API');
    } finally {
      setLoadingPractices(false);
    }
  };

  // Load email templates
  const loadEmailTemplates = async () => {
    try {
      setLoadingTemplates(true);
      const response = await fetch('/api/email-templates');
      const data = await response.json();

      if (data.success) {
        setEmailTemplates(data.templates);
      } else {
        setError(data.error || 'Failed to load email templates');
      }
    } catch (err) {
      setError('Failed to connect to API');
    } finally {
      setLoadingTemplates(false);
    }
  };

  useEffect(() => {
    loadBestPractices();
    loadEmailTemplates();
  }, []);

  // Best Practice CRUD operations
  const saveBestPractice = async (practice: BestPractice) => {
    setSaving(true);
    setError(null);

    try {
      const url = practice.id ? '/api/best-practices' : '/api/save-best-practices';
      const method = practice.id ? 'PUT' : 'POST';
      const body = practice.id
        ? JSON.stringify(practice)
        : JSON.stringify({
          practices: [practice],
          source: practice.source || 'Practice Manager',
          skipDuplicateCheck: true
        });

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body
      });

      const data = await response.json();

      if (data.success) {
        loadBestPractices();
        setPracticeDialogOpen(false);
        setEditingPractice(null);
      } else {
        setError(data.error || 'Failed to save best practice');
      }
    } catch (err) {
      setError('Failed to connect to API');
    } finally {
      setSaving(false);
    }
  };

  const deleteBestPractice = async (id: string) => {
    setDeleting(id);
    setError(null);

    try {
      const response = await fetch(`/api/best-practices?id=${id}`, {
        method: 'DELETE'
      });

      const data = await response.json();

      if (data.success) {
        loadBestPractices();
      } else {
        setError(data.error || 'Failed to delete best practice');
      }
    } catch (err) {
      setError('Failed to connect to API');
    } finally {
      setDeleting(null);
    }
  };

  // Email Template CRUD operations
  const saveEmailTemplate = async (template: EmailTemplate) => {
    setSaving(true);
    setError(null);

    try {
      const method = template.id ? 'PUT' : 'POST';
      const response = await fetch('/api/email-templates', {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(template)
      });

      const data = await response.json();

      if (data.success) {
        loadEmailTemplates();
        setTemplateDialogOpen(false);
        setEditingTemplate(null);
      } else {
        setError(data.error || 'Failed to save email template');
      }
    } catch (err) {
      setError('Failed to connect to API');
    } finally {
      setSaving(false);
    }
  };

  const deleteEmailTemplate = async (id: string) => {
    setDeleting(id);
    setError(null);

    try {
      const response = await fetch(`/api/email-templates?id=${id}`, {
        method: 'DELETE'
      });

      const data = await response.json();

      if (data.success) {
        loadEmailTemplates();
      } else {
        setError(data.error || 'Failed to delete email template');
      }
    } catch (err) {
      setError('Failed to connect to API');
    } finally {
      setDeleting(null);
    }
  };

  // Filter functions
  const filteredPractices = bestPractices.filter(practice =>
    practice.title.toLowerCase().includes(practiceFilter.toLowerCase()) ||
    practice.description.toLowerCase().includes(practiceFilter.toLowerCase()) ||
    (practice.source && practice.source.toLowerCase().includes(practiceFilter.toLowerCase()))
  );

  const filteredTemplates = emailTemplates.filter(template =>
    template.name.toLowerCase().includes(templateFilter.toLowerCase()) ||
    template.subject_line.toLowerCase().includes(templateFilter.toLowerCase()) ||
    (template.category && template.category.toLowerCase().includes(templateFilter.toLowerCase()))
  );

  // Utility functions
  const getPracticeTypeColor = (type?: string) => {
    switch (type) {
      case 'rule': return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200';
      case 'detailed': return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
      case 'guideline': return 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200';
      default: return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200';
    }
  };

  const getPriorityColor = (priority: number) => {
    switch (priority) {
      case 1: return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200';
      case 2: return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200';
      case 3: return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
      default: return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200';
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="max-w-7xl mx-auto px-6 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
            Email Manager
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            Manage your email best practices and templates in one place.
          </p>
        </div>

        {error && (
          <Alert className="mb-6 border-red-200 bg-red-50 dark:bg-red-900/20">
            <AlertDescription className="text-red-700 dark:text-red-400">
              {error}
            </AlertDescription>
          </Alert>
        )}

        <Tabs defaultValue="practices" className="w-full">
          <TabsList className="grid w-full grid-cols-2 mb-6">
            <TabsTrigger value="practices" className="flex items-center gap-2">
              <Lightbulb className="h-4 w-4" />
              Best Practices ({bestPractices.length})
            </TabsTrigger>
            <TabsTrigger value="templates" className="flex items-center gap-2">
              <Mail className="h-4 w-4" />
              Email Templates ({emailTemplates.length})
            </TabsTrigger>
          </TabsList>

          {/* Best Practices Tab */}
          <TabsContent value="practices">
            <div className="space-y-6">
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-4">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <Input
                      placeholder="Search practices..."
                      value={practiceFilter}
                      onChange={(e) => setPracticeFilter(e.target.value)}
                      className="pl-9 w-64"
                    />
                  </div>
                </div>

                <Dialog open={practiceDialogOpen} onOpenChange={setPracticeDialogOpen}>
                  <DialogTrigger asChild>
                    <Button onClick={() => {
                      setEditingPractice({
                        title: '',
                        description: '',
                        example: '',
                        priority: 2,
                        practice_type: 'rule',
                        source: 'Practice Manager'
                      });
                    }}>
                      <Plus className="h-4 w-4 mr-2" />
                      Add Practice
                    </Button>
                  </DialogTrigger>
                  <PracticeDialog
                    practice={editingPractice}
                    setPractice={setEditingPractice}
                    onSave={saveBestPractice}
                    saving={saving}
                    onClose={() => {
                      setPracticeDialogOpen(false);
                      setEditingPractice(null);
                    }}
                  />
                </Dialog>
              </div>

              {loadingPractices ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="h-8 w-8 animate-spin" />
                </div>
              ) : filteredPractices.length === 0 ? (
                <Card>
                  <CardContent className="py-8 text-center text-gray-500">
                    {practiceFilter ? 'No practices match your search.' : 'No best practices yet. Add your first one!'}
                  </CardContent>
                </Card>
              ) : (
                <div className="grid gap-4">
                  {filteredPractices.map((practice) => (
                    <PracticeCard
                      key={practice.id}
                      practice={practice}
                      onEdit={() => {
                        setEditingPractice(practice);
                        setPracticeDialogOpen(true);
                      }}
                      onDelete={() => practice.id && deleteBestPractice(practice.id)}
                      deleting={deleting === practice.id}
                      getPracticeTypeColor={getPracticeTypeColor}
                      getPriorityColor={getPriorityColor}
                    />
                  ))}
                </div>
              )}
            </div>
          </TabsContent>

          {/* Email Templates Tab */}
          <TabsContent value="templates">
            <div className="space-y-6">
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-4">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <Input
                      placeholder="Search templates..."
                      value={templateFilter}
                      onChange={(e) => setTemplateFilter(e.target.value)}
                      className="pl-9 w-64"
                    />
                  </div>
                </div>

                <Dialog open={templateDialogOpen} onOpenChange={setTemplateDialogOpen}>
                  <DialogTrigger asChild>
                    <Button onClick={() => {
                      setEditingTemplate({
                        name: '',
                        description: '',
                        category: 'general',
                        subject_line: '',
                        body: '',
                        is_active: true,
                        use_case: '',
                        target_audience: '',
                        tags: [],
                        variables: []
                      });
                    }}>
                      <Plus className="h-4 w-4 mr-2" />
                      Add Template
                    </Button>
                  </DialogTrigger>
                  <TemplateDialog
                    template={editingTemplate}
                    setTemplate={setEditingTemplate}
                    onSave={saveEmailTemplate}
                    saving={saving}
                    onClose={() => {
                      setTemplateDialogOpen(false);
                      setEditingTemplate(null);
                    }}
                  />
                </Dialog>
              </div>

              {loadingTemplates ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="h-8 w-8 animate-spin" />
                </div>
              ) : filteredTemplates.length === 0 ? (
                <Card>
                  <CardContent className="py-8 text-center text-gray-500">
                    {templateFilter ? 'No templates match your search.' : 'No email templates yet. Add your first one!'}
                  </CardContent>
                </Card>
              ) : (
                <div className="grid gap-4">
                  {filteredTemplates.map((template) => (
                    <TemplateCard
                      key={template.id}
                      template={template}
                      onEdit={() => {
                        setEditingTemplate(template);
                        setTemplateDialogOpen(true);
                      }}
                      onDelete={() => template.id && deleteEmailTemplate(template.id)}
                      deleting={deleting === template.id}
                    />
                  ))}
                </div>
              )}
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

// Best Practice Card Component
function PracticeCard({
  practice,
  onEdit,
  onDelete,
  deleting,
  getPracticeTypeColor,
  getPriorityColor
}: {
  practice: BestPractice;
  onEdit: () => void;
  onDelete: () => void;
  deleting: boolean;
  getPracticeTypeColor: (type?: string) => string;
  getPriorityColor: (priority: number) => string;
}) {
  return (
    <Card>
      <CardContent className="p-6">
        <div className="flex justify-between items-start mb-4">
          <div className="flex items-center gap-2">
            <Badge className={getPracticeTypeColor(practice.practice_type)}>
              {practice.practice_type === 'rule' ? '📏 Rule' :
                practice.practice_type === 'detailed' ? '📋 Detailed' :
                  practice.practice_type === 'guideline' ? '📖 Guideline' : 'Unknown'}
            </Badge>
            <Badge className={getPriorityColor(practice.priority)}>
              Priority {practice.priority}
            </Badge>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={onEdit}>
              <Edit className="h-4 w-4" />
            </Button>
            <Button
              variant="destructive"
              size="sm"
              onClick={onDelete}
              disabled={deleting}
            >
              {deleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
            </Button>
          </div>
        </div>

        <h3 className="font-semibold text-lg mb-2">{practice.title}</h3>
        <p className="text-gray-600 dark:text-gray-400 mb-3">{practice.description}</p>

        {practice.example && (
          <div className="bg-gray-50 dark:bg-gray-800 p-3 rounded border-l-4 border-blue-500 mb-3">
            <p className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-1">Example:</p>
            <p className="text-sm">{practice.example}</p>
          </div>
        )}

        {practice.source && (
          <p className="text-xs text-gray-500">Source: {practice.source}</p>
        )}
      </CardContent>
    </Card>
  );
}

// Email Template Card Component
function TemplateCard({
  template,
  onEdit,
  onDelete,
  deleting
}: {
  template: EmailTemplate;
  onEdit: () => void;
  onDelete: () => void;
  deleting: boolean;
}) {
  return (
    <Card>
      <CardContent className="p-6">
        <div className="flex justify-between items-start mb-4">
          <div className="flex items-center gap-2">
            <Badge variant={template.is_active ? "default" : "secondary"}>
              {template.is_active ? 'Active' : 'Inactive'}
            </Badge>
            {template.category && (
              <Badge variant="outline">{template.category}</Badge>
            )}
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={onEdit}>
              <Edit className="h-4 w-4" />
            </Button>
            <Button
              variant="destructive"
              size="sm"
              onClick={onDelete}
              disabled={deleting}
            >
              {deleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
            </Button>
          </div>
        </div>

        <h3 className="font-semibold text-lg mb-2">{template.name}</h3>
        {template.description && (
          <p className="text-gray-600 dark:text-gray-400 mb-3">{template.description}</p>
        )}

        <div className="space-y-2 mb-4">
          <div>
            <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Subject:</p>
            <p className="text-sm font-mono bg-gray-50 dark:bg-gray-800 p-2 rounded">
              {template.subject_line}
            </p>
          </div>

          <div>
            <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Body Preview:</p>
            <p className="text-sm bg-gray-50 dark:bg-gray-800 p-2 rounded line-clamp-3">
              {template.body.substring(0, 200)}...
            </p>
          </div>
        </div>

        {template.tags && template.tags.length > 0 && (
          <div className="flex flex-wrap gap-1 mb-2">
            {template.tags.map((tag, index) => (
              <Badge key={index} variant="outline" className="text-xs">
                {tag}
              </Badge>
            ))}
          </div>
        )}

        <div className="flex justify-between text-xs text-gray-500">
          {template.use_case && <span>Use case: {template.use_case}</span>}
          {template.target_audience && <span>Target: {template.target_audience}</span>}
        </div>
      </CardContent>
    </Card>
  );
}

// Practice Dialog Component
function PracticeDialog({
  practice,
  setPractice,
  onSave,
  saving,
  onClose
}: {
  practice: BestPractice | null;
  setPractice: (practice: BestPractice | null) => void;
  onSave: (practice: BestPractice) => void;
  saving: boolean;
  onClose: () => void;
}) {
  if (!practice || !setPractice) return null;

  const handleSave = () => {
    if (practice.title && practice.description && practice.priority) {
      onSave(practice);
    }
  };

  return (
    <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
      <DialogHeader>
        <DialogTitle>{practice.id ? 'Edit Best Practice' : 'Add Best Practice'}</DialogTitle>
      </DialogHeader>

      <div className="space-y-4">
        <div>
          <Label htmlFor="title">Title</Label>
          <Input
            id="title"
            value={practice.title}
            onChange={(e) => setPractice({ ...practice, title: e.target.value })}
            placeholder="Brief title for the practice"
          />
        </div>

        <div>
          <Label htmlFor="description">Description</Label>
          <Textarea
            id="description"
            value={practice.description}
            onChange={(e) => setPractice({ ...practice, description: e.target.value })}
            placeholder="Detailed description of the practice"
            className="min-h-[100px]"
          />
        </div>

        {practice.practice_type === 'detailed' && (
          <div>
            <Label htmlFor="example">Example</Label>
            <Textarea
              id="example"
              value={practice.example || ''}
              onChange={(e) => setPractice({ ...practice, example: e.target.value })}
              placeholder="Concrete example of implementation"
              className="min-h-[80px]"
            />
          </div>
        )}

        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label htmlFor="practice_type">Type</Label>
            <select
              id="practice_type"
              value={practice.practice_type || 'rule'}
              onChange={(e) => setPractice({ ...practice, practice_type: e.target.value as 'rule' | 'detailed' | 'guideline' })}
              className="mt-1 block w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
            >
              <option value="rule">Simple Rule</option>
              <option value="detailed">Detailed Practice</option>
              <option value="guideline">Guideline</option>
            </select>
          </div>

          <div>
            <Label htmlFor="priority">Priority</Label>
            <select
              id="priority"
              value={practice.priority}
              onChange={(e) => setPractice({ ...practice, priority: parseInt(e.target.value) })}
              className="mt-1 block w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
            >
              <option value={1}>High (1)</option>
              <option value={2}>Medium (2)</option>
              <option value={3}>Low (3)</option>
            </select>
          </div>
        </div>

        <div>
          <Label htmlFor="source">Source</Label>
          <Input
            id="source"
            value={practice.source || ''}
            onChange={(e) => setPractice({ ...practice, source: e.target.value })}
            placeholder="Where this practice came from"
          />
        </div>

        <div className="flex justify-end gap-2 pt-4">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={saving || !practice.title || !practice.description}>
            {saving ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Save className="h-4 w-4 mr-2" />
                Save
              </>
            )}
          </Button>
        </div>
      </div>
    </DialogContent>
  );
}

// Template Dialog Component
function TemplateDialog({
  template,
  setTemplate,
  onSave,
  saving,
  onClose
}: {
  template: EmailTemplate | null;
  setTemplate: (template: EmailTemplate | null) => void;
  onSave: (template: EmailTemplate) => void;
  saving: boolean;
  onClose: () => void;
}) {
  if (!template || !setTemplate) return null;

  const handleSave = () => {
    if (template.name && template.subject_line && template.body) {
      onSave(template);
    }
  };

  return (
    <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
      <DialogHeader>
        <DialogTitle>{template.id ? 'Edit Email Template' : 'Add Email Template'}</DialogTitle>
      </DialogHeader>

      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label htmlFor="name">Name</Label>
            <Input
              id="name"
              value={template.name}
              onChange={(e) => setTemplate({ ...template, name: e.target.value })}
              placeholder="Template name"
            />
          </div>

          <div>
            <Label htmlFor="category">Category</Label>
            <select
              id="category"
              value={template.category || 'general'}
              onChange={(e) => setTemplate({ ...template, category: e.target.value })}
              className="mt-1 block w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
            >
              <option value="general">General</option>
              <option value="cold_outreach">Cold Outreach</option>
              <option value="follow_up">Follow Up</option>
              <option value="nurture">Nurture</option>
              <option value="conversion">Conversion</option>
            </select>
          </div>
        </div>

        <div>
          <Label htmlFor="description">Description</Label>
          <Input
            id="description"
            value={template.description || ''}
            onChange={(e) => setTemplate({ ...template, description: e.target.value })}
            placeholder="Brief description of when to use this template"
          />
        </div>

        <div>
          <Label htmlFor="subject_line">Subject Line</Label>
          <Input
            id="subject_line"
            value={template.subject_line}
            onChange={(e) => setTemplate({ ...template, subject_line: e.target.value })}
            placeholder="Email subject line (use {{variables}} for placeholders)"
          />
        </div>

        <div>
          <Label htmlFor="body">Email Body</Label>
          <Textarea
            id="body"
            value={template.body}
            onChange={(e) => setTemplate({ ...template, body: e.target.value })}
            placeholder="Email body content (use {{variables}} for placeholders)"
            className="min-h-[200px]"
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label htmlFor="use_case">Use Case</Label>
            <Input
              id="use_case"
              value={template.use_case || ''}
              onChange={(e) => setTemplate({ ...template, use_case: e.target.value })}
              placeholder="When to use this template"
            />
          </div>

          <div>
            <Label htmlFor="target_audience">Target Audience</Label>
            <Input
              id="target_audience"
              value={template.target_audience || ''}
              onChange={(e) => setTemplate({ ...template, target_audience: e.target.value })}
              placeholder="Who this template is for"
            />
          </div>
        </div>

        <div>
          <Label htmlFor="tags">Tags (comma-separated)</Label>
          <Input
            id="tags"
            value={template.tags?.join(', ') || ''}
            onChange={(e) => setTemplate({
              ...template,
              tags: e.target.value.split(',').map(tag => tag.trim()).filter(tag => tag)
            })}
            placeholder="e.g., cold outreach, software, first contact"
          />
        </div>

        <div>
          <Label htmlFor="variables">Variables (comma-separated)</Label>
          <Input
            id="variables"
            value={template.variables?.join(', ') || ''}
            onChange={(e) => setTemplate({
              ...template,
              variables: e.target.value.split(',').map(variable => variable.trim()).filter(variable => variable)
            })}
            placeholder="e.g., first_name, company_name, industry"
          />
        </div>

        <div className="flex items-center space-x-2">
          <input
            type="checkbox"
            id="is_active"
            checked={template.is_active !== false}
            onChange={(e) => setTemplate({ ...template, is_active: e.target.checked })}
            className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
          />
          <Label htmlFor="is_active">Active Template</Label>
        </div>

        <div className="flex justify-end gap-2 pt-4">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={saving || !template.name || !template.subject_line || !template.body}>
            {saving ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Save className="h-4 w-4 mr-2" />
                Save
              </>
            )}
          </Button>
        </div>
      </div>
    </DialogContent>
  );
} 