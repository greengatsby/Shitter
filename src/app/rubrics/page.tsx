'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { 
  Loader2, 
  Plus, 
  Edit3, 
  Trash2, 
  Save, 
  X, 
  ChevronRight,
  ChevronDown,
  Settings
} from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface RubricLevel {
  id: string;
  level: number;
  title: string;
  description: string;
}

interface RubricField {
  id: string;
  name: string;
  description: string;
  display_order: number;
  levels?: RubricLevel[];
}

interface RubricCategory {
  id: string;
  name: string;
  description: string;
  icon: string;
  color_scheme: string;
  display_order: number;
  fields?: RubricField[];
}

export default function RubricsPage() {
  const [loading, setLoading] = useState(true);
  const [categories, setCategories] = useState<RubricCategory[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());
  const [expandedFields, setExpandedFields] = useState<Set<string>>(new Set());
  const [editingItem, setEditingItem] = useState<{ type: string; id: string } | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<{ type: string; id: string; name: string } | null>(null);
  const [editForm, setEditForm] = useState<any>({});
  const [saving, setSaving] = useState(false);

  const fetchRubrics = async () => {
    setLoading(true);
    setError(null);

    try {
      const res = await fetch('/api/rubrics?include_fields=true&include_levels=true');
      const data = await res.json();

      if (data.success) {
        setCategories(data.categories || []);
      } else {
        setError(data.error || 'Failed to fetch rubrics');
      }
    } catch (err) {
      setError('Failed to connect to API');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRubrics();
  }, []);

  const toggleCategory = (categoryId: string) => {
    const newExpanded = new Set(expandedCategories);
    if (newExpanded.has(categoryId)) {
      newExpanded.delete(categoryId);
    } else {
      newExpanded.add(categoryId);
    }
    setExpandedCategories(newExpanded);
  };

  const toggleField = (fieldId: string) => {
    const newExpanded = new Set(expandedFields);
    if (newExpanded.has(fieldId)) {
      newExpanded.delete(fieldId);
    } else {
      newExpanded.add(fieldId);
    }
    setExpandedFields(newExpanded);
  };

  const getLevelColor = (level: number) => {
    const colors = [
      'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400',
      'bg-orange-100 text-orange-800 dark:bg-orange-900/20 dark:text-orange-400',
      'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-400',
      'bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-400',
      'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400'
    ];
    return colors[level - 1] || colors[0];
  };

  const handleDelete = async (type: string, id: string) => {
    try {
      const response = await fetch(`/api/rubrics/${id}?type=${type}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        await fetchRubrics();
        setShowDeleteConfirm(null);
      } else {
        const data = await response.json();
        setError(data.error || 'Failed to delete item');
      }
    } catch (err) {
      setError('Failed to delete item');
    }
  };

  const handleEdit = (type: string, id: string) => {
    let item: any = null;
    
    if (type === 'category') {
      item = categories.find(c => c.id === id);
    } else if (type === 'field') {
      for (const category of categories) {
        item = category.fields?.find(f => f.id === id);
        if (item) break;
      }
    } else if (type === 'level') {
      for (const category of categories) {
        for (const field of category.fields || []) {
          item = field.levels?.find(l => l.id === id);
          if (item) break;
        }
        if (item) break;
      }
    }

    if (item) {
      setEditForm({ ...item });
      setEditingItem({ type, id });
    }
  };

  const handleSave = async () => {
    if (!editingItem) return;
    
    setSaving(true);
    try {
      const { id, type, ...formData } = editForm;
      
      const response = await fetch(`/api/rubrics/${editingItem.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          type: editingItem.type,
          data: formData
        }),
      });

      if (response.ok) {
        await fetchRubrics();
        setEditingItem(null);
        setEditForm({});
      } else {
        const data = await response.json();
        setError(data.error || 'Failed to save item');
      }
    } catch (err) {
      setError('Failed to save item');
    } finally {
      setSaving(false);
    }
  };

  const cancelEdit = () => {
    setEditingItem(null);
    setEditForm({});
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-white dark:bg-gray-950">
        <div className="max-w-6xl mx-auto px-6 py-16">
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
            <span className="ml-2 text-gray-600 dark:text-gray-400">Loading rubrics...</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white dark:bg-gray-950">
      <div className="max-w-6xl mx-auto px-6 py-16">
        {/* Header */}
        <div className="flex items-center justify-between mb-12">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 bg-gray-100 dark:bg-gray-800 rounded-xl">
                <Settings className="h-6 w-6 text-gray-700 dark:text-gray-300" />
              </div>
              <h1 className="text-3xl font-semibold text-gray-900 dark:text-white tracking-tight">
                Rubric Editor
              </h1>
            </div>
            <p className="text-gray-600 dark:text-gray-400 text-lg leading-relaxed">
              Manage scoring criteria for business idea evaluation
            </p>
          </div>
          <Button
            onClick={() => {/* TODO: Add new category */}}
            className="bg-gray-900 hover:bg-gray-800 dark:bg-white dark:hover:bg-gray-100 dark:text-gray-900"
          >
            <Plus className="h-4 w-4 mr-2" />
            Add Category
          </Button>
        </div>

        {/* Error State */}
        {error && (
          <Alert variant="destructive" className="mb-6">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {/* Categories */}
        <div className="space-y-4">
          {categories.map((category) => (
            <Card key={category.id} className="border-0 shadow-sm">
              <CardHeader 
                className="cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800/50"
                onClick={() => toggleCategory(category.id)}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    {expandedCategories.has(category.id) ? (
                      <ChevronDown className="h-5 w-5 text-gray-400" />
                    ) : (
                      <ChevronRight className="h-5 w-5 text-gray-400" />
                    )}
                    <span className="text-2xl">{category.icon}</span>
                    <div>
                      <CardTitle className="text-lg">{category.name}</CardTitle>
                      <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                        {category.description}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline">
                      {category.fields?.length || 0} fields
                    </Badge>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleEdit('category', category.id);
                      }}
                    >
                      <Edit3 className="h-3 w-3" />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        setShowDeleteConfirm({ type: 'category', id: category.id, name: category.name });
                      }}
                      className="text-red-600 hover:text-red-700 hover:bg-red-50"
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              </CardHeader>

              {expandedCategories.has(category.id) && (
                <CardContent className="pt-0">
                  <div className="space-y-3">
                    {category.fields?.map((field) => (
                      <div key={field.id} className="border border-gray-200 dark:border-gray-700 rounded-lg">
                        <div 
                          className="p-4 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800/50"
                          onClick={() => toggleField(field.id)}
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              {expandedFields.has(field.id) ? (
                                <ChevronDown className="h-4 w-4 text-gray-400" />
                              ) : (
                                <ChevronRight className="h-4 w-4 text-gray-400" />
                              )}
                              <div>
                                <h4 className="font-medium text-gray-900 dark:text-white">
                                  {field.name}
                                </h4>
                                <p className="text-sm text-gray-600 dark:text-gray-400">
                                  {field.description}
                                </p>
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              <Badge variant="outline">
                                {field.levels?.length || 0} levels
                              </Badge>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleEdit('field', field.id);
                                }}
                              >
                                <Edit3 className="h-3 w-3" />
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setShowDeleteConfirm({ type: 'field', id: field.id, name: field.name });
                                }}
                                className="text-red-600 hover:text-red-700 hover:bg-red-50"
                              >
                                <Trash2 className="h-3 w-3" />
                              </Button>
                            </div>
                          </div>
                        </div>

                        {expandedFields.has(field.id) && (
                          <div className="border-t border-gray-200 dark:border-gray-700 p-4">
                            <div className="space-y-3">
                              {field.levels?.map((level) => (
                                <div key={level.id} className="flex items-start gap-3 p-3 bg-gray-50 dark:bg-gray-800/50 rounded-lg">
                                  <Badge className={getLevelColor(level.level)}>
                                    Level {level.level}
                                  </Badge>
                                  <div className="flex-1">
                                    <h5 className="font-medium text-gray-900 dark:text-white mb-1">
                                      {level.title}
                                    </h5>
                                    <p className="text-sm text-gray-600 dark:text-gray-400">
                                      {level.description}
                                    </p>
                                  </div>
                                  <div className="flex items-center gap-1">
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      onClick={() => handleEdit('level', level.id)}
                                    >
                                      <Edit3 className="h-3 w-3" />
                                    </Button>
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      onClick={() => setShowDeleteConfirm({ type: 'level', id: level.id, name: level.title })}
                                      className="text-red-600 hover:text-red-700 hover:bg-red-50"
                                    >
                                      <Trash2 className="h-3 w-3" />
                                    </Button>
                                  </div>
                                </div>
                              ))}
                              <Button
                                variant="outline"
                                size="sm"
                                className="w-full"
                                onClick={() => {/* TODO: Add new level */}}
                              >
                                <Plus className="h-3 w-3 mr-2" />
                                Add Level
                              </Button>
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full"
                      onClick={() => {/* TODO: Add new field */}}
                    >
                      <Plus className="h-3 w-3 mr-2" />
                      Add Field
                    </Button>
                  </div>
                </CardContent>
              )}
            </Card>
          ))}
        </div>

        {/* Edit Dialog */}
        {editingItem && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white dark:bg-gray-900 p-6 rounded-lg shadow-xl max-w-md w-full mx-4">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                Edit {editingItem.type}
              </h3>
              
              <div className="space-y-4">
                {editingItem.type === 'category' && (
                  <>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Name
                      </label>
                      <Input
                        value={editForm.name || ''}
                        onChange={(e) => setEditForm({...editForm, name: e.target.value})}
                        placeholder="Category name"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Description
                      </label>
                      <Textarea
                        value={editForm.description || ''}
                        onChange={(e) => setEditForm({...editForm, description: e.target.value})}
                        placeholder="Category description"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Icon
                      </label>
                      <Input
                        value={editForm.icon || ''}
                        onChange={(e) => setEditForm({...editForm, icon: e.target.value})}
                        placeholder="📊"
                      />
                    </div>
                  </>
                )}
                
                {editingItem.type === 'field' && (
                  <>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Name
                      </label>
                      <Input
                        value={editForm.name || ''}
                        onChange={(e) => setEditForm({...editForm, name: e.target.value})}
                        placeholder="Field name"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Description
                      </label>
                      <Textarea
                        value={editForm.description || ''}
                        onChange={(e) => setEditForm({...editForm, description: e.target.value})}
                        placeholder="Field description"
                      />
                    </div>
                  </>
                )}
                
                {editingItem.type === 'level' && (
                  <>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Level Number
                      </label>
                      <Input
                        type="number"
                        min="1"
                        max="5"
                        value={editForm.level || ''}
                        onChange={(e) => setEditForm({...editForm, level: parseInt(e.target.value)})}
                        placeholder="1-5"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Title
                      </label>
                      <Input
                        value={editForm.title || ''}
                        onChange={(e) => setEditForm({...editForm, title: e.target.value})}
                        placeholder="Level title"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Description
                      </label>
                      <Textarea
                        value={editForm.description || ''}
                        onChange={(e) => setEditForm({...editForm, description: e.target.value})}
                        placeholder="Level description"
                      />
                    </div>
                  </>
                )}
              </div>
              
              <div className="flex justify-end gap-3 mt-6">
                <Button
                  variant="outline"
                  onClick={cancelEdit}
                  disabled={saving}
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleSave}
                  disabled={saving}
                >
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
          </div>
        )}

        {/* Delete Confirmation Dialog */}
        {showDeleteConfirm && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white dark:bg-gray-900 p-6 rounded-lg shadow-xl max-w-md w-full mx-4">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                Confirm Delete
              </h3>
              <p className="text-gray-600 dark:text-gray-400 mb-4">
                Are you sure you want to delete the {showDeleteConfirm.type} "{showDeleteConfirm.name}"? 
                This action cannot be undone.
              </p>
              <div className="flex justify-end gap-3">
                <Button
                  variant="outline"
                  onClick={() => setShowDeleteConfirm(null)}
                >
                  Cancel
                </Button>
                <Button
                  variant="destructive"
                  onClick={() => handleDelete(showDeleteConfirm.type, showDeleteConfirm.id)}
                >
                  Delete
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}